/*
 * JWT Pizza load test: login -> browse menu -> purchase pizza -> verify pizza JWT
 *
 * Each VU iteration walks the same path a real diner takes in the jwt-pizza frontend
 * (see src/service/httpPizzaService.ts and src/views/{login,menu,payment,delivery}.tsx):
 *   1. Login     PUT  {BASE_URL}/api/auth                      {email, password} -> {user, token}
 *                GET  {BASE_URL}/api/user/me                   (app reloads the current user)
 *   2. Menu      GET  {BASE_URL}/api/order/menu
 *                GET  {BASE_URL}/api/franchise?page=0&limit=20&name=*
 *   3. Purchase  GET  {BASE_URL}/api/user/me                   (payment page checks login)
 *                POST {BASE_URL}/api/order                     {franchiseId, storeId, items:[{menuId, description, price}]}
 *   4. Verify    POST {FACTORY_URL}/api/order/verify           {jwt}  (jwt taken from the purchase response)
 *
 * Menu item and franchise/store IDs are picked from the live responses; nothing is hard-coded.
 *
 * Run locally:
 *   k6 run -e EMAIL=d@jwt.com -e PASSWORD=<password> loadTests/loginAndOrder.js
 *   # optional: -e BASE_URL=https://pizza-service.kalokjo.click -e FACTORY_URL=https://pizza-factory.cs329.click
 *   # quick smoke test: k6 run --vus 1 --iterations 1 -e EMAIL=... -e PASSWORD=... loadTests/loginAndOrder.js
 *
 * Run in Grafana Cloud k6:
 *   Paste this file into the Script Editor, set EMAIL / PASSWORD (and optionally BASE_URL)
 *   as environment variables in the test settings, and run it.
 */
import http from 'k6/http';
import { check, group, sleep, fail } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'https://pizza-service.kalokjo.click';
const FACTORY_URL = __ENV.FACTORY_URL || 'https://pizza-factory.cs329.click';
// Example diner account: EMAIL=d@jwt.com (supply the password via -e PASSWORD=..., never commit it)
const EMAIL = __ENV.EMAIL;
const PASSWORD = __ENV.PASSWORD;

export const options = {
  // Top-level stages = k6's ramping-vus executor (Grafana Cloud's editor rejects targets/startVUs of 0)
  stages: [
    { duration: '30s', target: 5 }, // ramp up to 5 VUs
    { duration: '1m30s', target: 5 }, // hold
    { duration: '30s', target: 1 }, // ramp down
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
  },
  cloud: {
    projectID: 8507095, // Grafana Cloud k6 project ID
    name: 'JWT Pizza login and order',
  },
};

export function setup() {
  if (!EMAIL || !PASSWORD) {
    fail('Set EMAIL and PASSWORD environment variables, e.g. k6 run -e EMAIL=d@jwt.com -e PASSWORD=<password> loadTests/loginAndOrder.js');
  }
}

// Same headers the frontend sends from callEndpoint() in httpPizzaService.ts
function headers(token = null) {
  const h = { 'Content-Type': 'application/json' };
  if (token) {
    h['Authorization'] = `Bearer ${token}`;
  }
  return { headers: h };
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

export default function () {
  let token;
  let order;
  let pizzaJwt;

  group('Login', () => {
    const res = http.put(`${BASE_URL}/api/auth`, JSON.stringify({ email: EMAIL, password: PASSWORD }), headers());
    if (!check(res, { 'login status is 200': (r) => r.status === 200 })) {
      console.log(`Login failed (${res.status}): ${res.body}`);
      fail('Login was not successful');
    }
    token = res.json('token');

    // App reloads the logged-in user after login
    http.get(`${BASE_URL}/api/user/me`, headers(token));
  });

  sleep(1 + Math.random() * 2);

  group('Menu', () => {
    const menuRes = http.get(`${BASE_URL}/api/order/menu`, headers(token));
    const franchiseRes = http.get(`${BASE_URL}/api/franchise?page=0&limit=20&name=*`, headers(token));
    check(menuRes, { 'menu status is 200': (r) => r.status === 200 });
    check(franchiseRes, { 'franchise status is 200': (r) => r.status === 200 });

    const menu = menuRes.json();
    const franchises = (franchiseRes.json('franchises') || []).filter((f) => f.stores && f.stores.length > 0);
    if (!Array.isArray(menu) || menu.length === 0 || franchises.length === 0) {
      console.log(`Menu/franchise data unusable. menu=${menuRes.body} franchises=${franchiseRes.body}`);
      fail('No menu items or stores available to order from');
    }

    const franchise = pick(franchises);
    const store = pick(franchise.stores);
    const pizza = pick(menu);
    // Matches menu.tsx: { menuId: pizza.id, description: pizza.title, price: pizza.price }
    order = {
      franchiseId: franchise.id,
      storeId: store.id,
      items: [{ menuId: pizza.id, description: pizza.title, price: pizza.price }],
    };
  });

  sleep(1 + Math.random() * 2);

  group('Purchase', () => {
    // Payment page confirms the user is still logged in before ordering
    http.get(`${BASE_URL}/api/user/me`, headers(token));

    const res = http.post(`${BASE_URL}/api/order`, JSON.stringify(order), headers(token));
    if (!check(res, { 'purchase status is 200': (r) => r.status === 200 })) {
      console.log(`Purchase failed (${res.status}): ${res.body}`);
      fail('Purchase was not successful');
    }
    pizzaJwt = res.json('jwt');
    if (!check(pizzaJwt, { 'pizza jwt extracted': (j) => typeof j === 'string' && j.length > 0 })) {
      console.log(`No jwt in purchase response: ${res.body}`);
      fail('Purchase response did not contain a pizza jwt');
    }
  });

  sleep(1 + Math.random() * 2);

  group('Verify', () => {
    const res = http.post(`${FACTORY_URL}/api/order/verify`, JSON.stringify({ jwt: pizzaJwt }), headers(token));
    if (
      !check(res, {
        'verify status is 200': (r) => r.status === 200,
        'verify message is valid': (r) => r.json('message') === 'valid',
      })
    ) {
      console.log(`Verify failed (${res.status}): ${res.body}`);
    }
  });

  sleep(1 + Math.random() * 2);
}
