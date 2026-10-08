import { Page, Route } from '@playwright/test';
import { expect } from './testSetup';
import { Franchise, Order, Pizza, Role, User } from '../src/service/pizzaService';

// Test users, one per role
export const users: Record<'diner' | 'franchisee' | 'admin', Required<User>> = {
  diner: { id: '3', name: 'Kai Chen', email: 'd@jwt.com', password: 'diner', roles: [{ role: Role.Diner }] },
  franchisee: {
    id: '4',
    name: 'Fran Chisee',
    email: 'f@jwt.com',
    password: 'franchisee',
    roles: [{ role: Role.Diner }, { role: Role.Franchisee, objectId: '2' }],
  },
  admin: { id: '1', name: 'Mama Ricci', email: 'a@jwt.com', password: 'admin', roles: [{ role: Role.Admin }] },
};

// Menu returned by GET /api/order/menu
export const menu: Pizza[] = [
  { id: '1', title: 'Veggie', image: 'pizza1.png', price: 0.0038, description: 'A garden of delight' },
  { id: '2', title: 'Pepperoni', image: 'pizza2.png', price: 0.0042, description: 'Spicy treat' },
  { id: '3', title: 'Margarita', image: 'pizza3.png', price: 0.0014, description: 'Essential classic' },
];

// The only JWT the factory mock accepts as valid
export const validJwt = 'eyJpYXQ.valid.pizza';

export type MockUser = keyof typeof users;

export interface MockOptions {
  // Start the test already logged in as this user
  loggedInAs?: MockUser;
  franchises?: Franchise[];
  orders?: Order[];
}

// Mock backend state. Tests flip the *Fails flags to reach error branches.
export interface MockState {
  users: Required<User>[];
  franchises: Franchise[];
  orders: Order[];
  nextId: number;
  orderFails: boolean;
  verifyFails: boolean;
  createFranchiseFails: boolean;
}

// PizzaCorp (id 2) belongs to the franchisee; topSpot has no stores
function defaultFranchises(): Franchise[] {
  return [
    {
      id: '1',
      name: 'LotaPizza',
      admins: [{ id: '5', name: 'Lota Owner', email: 'lota@jwt.com' }],
      stores: [
        { id: '4', name: 'Lehi', totalRevenue: 1.5 },
        { id: '5', name: 'Springville', totalRevenue: 0.25 },
      ],
    },
    {
      id: '2',
      name: 'PizzaCorp',
      admins: [{ id: users.franchisee.id, name: users.franchisee.name, email: users.franchisee.email }],
      stores: [{ id: '7', name: 'Spanish Fork', totalRevenue: 3 }],
    },
    { id: '3', name: 'topSpot', admins: [], stores: [] },
  ];
}

// Token the mocks hand out for each user
function tokenFor(user: User) {
  return `token-${user.id}`;
}

// Reply with a JSON body and status code
async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, json: body });
}

export async function basicInit(page: Page, options: MockOptions = {}): Promise<MockState> {
  // Fresh state per test so create/delete flows change what the UI shows
  const state: MockState = {
    users: Object.values(users).map((u) => ({ ...u, roles: [...u.roles] })),
    franchises: structuredClone(options.franchises ?? defaultFranchises()),
    orders: structuredClone(options.orders ?? []),
    nextId: 100,
    orderFails: false,
    verifyFails: false,
    createFranchiseFails: false,
  };
  const newId = () => String(state.nextId++);

  // Find the user that owns the Bearer token on the request
  function authUser(route: Route) {
    const header = route.request().headers()['authorization'];
    return state.users.find((u) => header === `Bearer ${tokenFor(u)}`);
  }

  // Never send passwords back to the browser
  function publicUser(user: Required<User>): User {
    const { password: _password, ...rest } = user;
    return rest;
  }

  if (options.loggedInAs) {
    // Seed the token once per tab so that a later logout really clears it.
    const token = tokenFor(users[options.loggedInAs]);
    await page.addInitScript((t) => {
      if (!sessionStorage.getItem('seeded')) {
        localStorage.setItem('token', t);
        sessionStorage.setItem('seeded', 'true');
      }
    }, token);
  }

  // Authentication: login, register, logout
  await page.route(/\/api\/auth$/, async (route) => {
    const method = route.request().method();
    expect(['PUT', 'POST', 'DELETE']).toContain(method);

    // Login
    if (method === 'PUT') {
      const body = route.request().postDataJSON();
      expect(Object.keys(body).sort()).toEqual(['email', 'password']);
      const user = state.users.find((u) => u.email === body.email);
      if (!user || user.password !== body.password) {
        return json(route, { message: 'unknown user' }, 401);
      }
      return json(route, { user: publicUser(user), token: tokenFor(user) });
    }

    // Register
    if (method === 'POST') {
      const body = route.request().postDataJSON();
      expect(Object.keys(body).sort()).toEqual(['email', 'name', 'password']);
      if (state.users.some((u) => u.email === body.email)) {
        return json(route, { message: 'email already registered' }, 409);
      }
      const user: Required<User> = { id: newId(), name: body.name, email: body.email, password: body.password, roles: [{ role: Role.Diner }] };
      state.users.push(user);
      return json(route, { user: publicUser(user), token: tokenFor(user) });
    }

    // Logout
    expect(authUser(route)).toBeDefined();
    return json(route, { message: 'logout successful' });
  });

  // Current user (401 when the token is missing or bad)
  await page.route(/\/api\/user\/me$/, async (route) => {
    expect(route.request().method()).toBe('GET');
    const user = authUser(route);
    if (!user) return json(route, { message: 'unauthorized' }, 401);
    return json(route, publicUser(user));
  });

  // Pizza menu
  await page.route(/\/api\/order\/menu$/, async (route) => {
    expect(route.request().method()).toBe('GET');
    return json(route, menu);
  });

  // Order history and placing an order
  await page.route(/\/api\/order$/, async (route) => {
    const method = route.request().method();
    expect(['GET', 'POST']).toContain(method);
    const user = authUser(route);
    if (!user) return json(route, { message: 'unauthorized' }, 401);

    if (method === 'GET') {
      return json(route, { id: '1', dinerId: user.id, orders: state.orders });
    }

    const body = route.request().postDataJSON();
    expect(body.franchiseId).toBeTruthy();
    expect(body.storeId).toBeTruthy();
    expect(body.items.length).toBeGreaterThan(0);
    for (const item of body.items) {
      expect(Object.keys(item).sort()).toEqual(['description', 'menuId', 'price']);
    }
    if (state.orderFails) {
      return json(route, { message: 'Failed to fulfill order at factory' }, 500);
    }
    const order: Order = { ...body, id: newId(), date: '2024-06-05T05:14:40.000Z' };
    state.orders.push(order);
    return json(route, { order, jwt: validJwt });
  });

  // Pizza factory JWT verify
  await page.route(/\/api\/order\/verify$/, async (route) => {
    expect(route.request().method()).toBe('POST');
    const body = route.request().postDataJSON();
    expect(body).toEqual({ jwt: expect.any(String) });
    if (state.verifyFails || body.jwt !== validJwt) {
      return json(route, { message: 'invalid' }, 401);
    }
    return json(route, {
      message: 'valid',
      payload: { vendor: { id: 'student', name: 'Student' }, diner: { id: '3', name: 'Kai Chen' }, order: state.orders.at(-1) },
    });
  });

  // Franchise list (with paging + name filter) and franchise creation
  await page.route(/\/api\/franchise(\?.*)?$/, async (route) => {
    const method = route.request().method();
    expect(['GET', 'POST']).toContain(method);

    if (method === 'GET') {
      const params = new URL(route.request().url()).searchParams;
      const pageNum = Number(params.get('page') ?? 0);
      const limit = Number(params.get('limit') ?? 10);
      // Turn the '*' wildcard into a regex for the name filter
      const pattern = (params.get('name') ?? '*').replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
      const matcher = new RegExp(`^${pattern}$`, 'i');
      const matching = state.franchises.filter((f) => matcher.test(f.name));
      const start = pageNum * limit;
      return json(route, { franchises: matching.slice(start, start + limit), more: start + limit < matching.length });
    }

    // Only admins can create franchises
    const user = authUser(route);
    expect(user?.roles.some((r) => r.role === Role.Admin)).toBe(true);
    const body = route.request().postDataJSON();
    expect(body.name).toBeTruthy();
    expect(body.admins).toEqual([{ email: expect.any(String) }]);
    const admin = state.users.find((u) => u.email === body.admins[0].email);
    if (state.createFranchiseFails || !admin) {
      return json(route, { message: `unknown user for franchise admin ${body.admins[0].email} provided` }, 404);
    }
    const franchise: Franchise = { id: newId(), name: body.name, admins: [{ id: admin.id, name: admin.name, email: admin.email }], stores: [] };
    state.franchises.push(franchise);
    return json(route, franchise);
  });

  // GET /api/franchise/:userId  and  DELETE /api/franchise/:franchiseId
  await page.route(/\/api\/franchise\/\d+$/, async (route) => {
    const method = route.request().method();
    expect(['GET', 'DELETE']).toContain(method);
    const id = route.request().url().split('/').pop();
    const user = authUser(route);
    expect(user).toBeDefined();

    if (method === 'GET') {
      expect(id).toBe(user!.id);
      return json(route, state.franchises.filter((f) => f.admins?.some((a) => a.id === id)));
    }

    state.franchises = state.franchises.filter((f) => f.id !== id);
    return json(route, { message: 'franchise deleted' });
  });

  // Create a store
  await page.route(/\/api\/franchise\/\d+\/store$/, async (route) => {
    expect(route.request().method()).toBe('POST');
    expect(authUser(route)).toBeDefined();
    const franchiseId = route.request().url().split('/').at(-2);
    const franchise = state.franchises.find((f) => f.id === franchiseId);
    expect(franchise).toBeDefined();
    const body = route.request().postDataJSON();
    expect(body).toEqual({ id: '', name: expect.any(String) });
    const store = { id: newId(), name: body.name, totalRevenue: 0 };
    franchise!.stores.push(store);
    return json(route, store);
  });

  // Close a store
  await page.route(/\/api\/franchise\/\d+\/store\/\d+$/, async (route) => {
    expect(route.request().method()).toBe('DELETE');
    expect(authUser(route)).toBeDefined();
    const [franchiseId, , storeId] = route.request().url().split('/').slice(-3);
    const franchise = state.franchises.find((f) => f.id === franchiseId);
    expect(franchise).toBeDefined();
    franchise!.stores = franchise!.stores.filter((s) => s.id !== storeId);
    return json(route, { message: 'store deleted' });
  });

  // Service and factory API docs
  await page.route(/\/api\/docs$/, async (route) => {
    expect(route.request().method()).toBe('GET');
    const isFactory = route.request().url().includes('pizza-factory');
    return json(route, {
      endpoints: [
        isFactory
          ? { requiresAuth: true, method: 'POST', path: '/api/order/verify', description: 'Verifies a pizza order', example: 'curl -X POST /api/order/verify', response: { message: 'valid' } }
          : { requiresAuth: false, method: 'PUT', path: '/api/auth', description: 'Login existing user', example: 'curl -X PUT /api/auth', response: { user: { id: 1 }, token: 'tttttt' } },
      ],
    });
  });

  return state;
}

// Log in through the header link and login form
export async function login(page: Page, who: MockUser) {
  await page.getByRole('link', { name: 'Login', exact: true }).click();
  await page.getByPlaceholder('Email address').fill(users[who].email);
  await page.getByPlaceholder('Password').fill(users[who].password);
  await page.getByRole('button', { name: 'Login' }).click();
}
