// Admin dashboard: list, page, filter, and delete users
import { test, expect } from './testSetup';
import { basicInit, login } from './mocks';
import { Role, User } from '../src/service/pizzaService';

// Diners named "User 1".."User n" (ids 201..) to fill more than one page
function manyUsers(count: number): Required<User>[] {
  return Array.from({ length: count }, (_, i) => ({
    id: String(201 + i),
    name: `User ${i + 1}`,
    email: `user${i + 1}@jwt.com`,
    password: 'a',
    roles: [{ role: Role.Diner }],
  }));
}

test('admin sees the users table', async ({ page }) => {
  await basicInit(page);
  await page.goto('/');
  await login(page, 'admin');
  await page.getByRole('navigation', { name: 'Global' }).getByRole('link', { name: 'Admin' }).click();

  await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible();
  const table = page.getByRole('table', { name: 'Users' });
  await expect(table.getByRole('columnheader')).toHaveText(['Name', 'Email', 'Role', 'Action']);
  await expect(table.getByRole('row', { name: /Kai Chen/ })).toContainText('d@jwt.com');
  await expect(table.getByRole('row', { name: /Kai Chen/ })).toContainText('diner');
  await expect(table.getByRole('row', { name: /Fran Chisee/ })).toContainText('diner, franchisee');
  await expect(table.getByRole('row', { name: /Mama Ricci/ })).toContainText('admin');
});

test('admin pages through users', async ({ page }) => {
  await basicInit(page, { loggedInAs: 'admin', extraUsers: manyUsers(12) });
  await page.goto('/admin-dashboard');

  const table = page.getByRole('table', { name: 'Users' });
  const rows = table.locator('tbody tr');
  const prev = page.getByRole('button', { name: 'Prev' });
  const next = page.getByRole('button', { name: 'Next' });

  // Page 1: the 3 role users and User 1..7
  await expect(rows).toHaveCount(10);
  await expect(rows.first()).toContainText('Kai Chen');
  await expect(rows.last()).toContainText('User 7');
  await expect(prev).toBeDisabled();
  await expect(next).toBeEnabled();

  // Page 2 is the last page
  const request = page.waitForRequest(/\/api\/user\?/);
  await next.click();
  expect(new URL((await request).url()).searchParams.get('page')).toBe('2');
  await expect(rows).toHaveCount(5);
  await expect(rows.first()).toContainText('User 8');
  await expect(rows.last()).toContainText('User 12');
  await expect(next).toBeDisabled();
  await expect(prev).toBeEnabled();

  await prev.click();
  await expect(rows).toHaveCount(10);
  await expect(rows.first()).toContainText('Kai Chen');
  await expect(prev).toBeDisabled();
});

test('one page of users disables both paging buttons', async ({ page }) => {
  await basicInit(page, { loggedInAs: 'admin' });
  await page.goto('/admin-dashboard');

  await expect(page.getByRole('table', { name: 'Users' }).locator('tbody tr')).toHaveCount(3);
  await expect(page.getByRole('button', { name: 'Prev' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled();
});

test('admin filters users by name', async ({ page }) => {
  await basicInit(page, { loggedInAs: 'admin', extraUsers: manyUsers(25) });
  await page.goto('/admin-dashboard');
  const rows = page.getByRole('table', { name: 'Users' }).locator('tbody tr');
  await expect(rows).toHaveCount(10);

  // Search from page 2 to check it starts over at page 1
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(rows.first()).toContainText('User 8');

  await page.getByPlaceholder('Name').fill('user 1');
  const request = page.waitForRequest(/\/api\/user\?/);
  await page.getByRole('button', { name: 'Search' }).click();
  const params = new URL((await request).url()).searchParams;
  expect(params.get('name')).toBe('*user 1*');
  expect(params.get('page')).toBe('1');
  expect(params.get('limit')).toBe('10');

  // User 1 and User 10..19 match: 11 users, so 10 here and 1 on the next page
  await expect(rows).toHaveCount(10);
  await expect(rows.first()).toContainText('User 1');
  await expect(page.getByRole('table', { name: 'Users' })).not.toContainText('Kai Chen');

  // Paging keeps the filter
  const nextRequest = page.waitForRequest(/\/api\/user\?/);
  await page.getByRole('button', { name: 'Next' }).click();
  expect(new URL((await nextRequest).url()).searchParams.get('name')).toBe('*user 1*');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('User 19');
});

test('user search with no matches shows an empty table', async ({ page }) => {
  await basicInit(page, { loggedInAs: 'admin' });
  await page.goto('/admin-dashboard');
  const rows = page.getByRole('table', { name: 'Users' }).locator('tbody tr');
  await expect(rows).toHaveCount(3);

  await page.getByPlaceholder('Name').fill('nobody');
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(rows).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled();

  // Clearing the filter brings everyone back
  await page.getByPlaceholder('Name').fill('');
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(rows).toHaveCount(3);
});

test('user search text is URL encoded', async ({ page }) => {
  const odd: Required<User> = { id: '300', name: 'Pat & Lee #1', email: 'pat@jwt.com', password: 'a', roles: [{ role: Role.Diner }] };
  await basicInit(page, { loggedInAs: 'admin', extraUsers: [odd] });
  await page.goto('/admin-dashboard');

  await page.getByPlaceholder('Name').fill('& Lee #');
  const request = page.waitForRequest(/\/api\/user\?/);
  await page.getByRole('button', { name: 'Search' }).click();
  expect(new URL((await request).url()).searchParams.get('name')).toBe('*& Lee #*');
  const rows = page.getByRole('table', { name: 'Users' }).locator('tbody tr');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('Pat & Lee #1');
});

for (const who of ['diner', 'franchisee'] as const) {
  test(`${who} cannot see the users table`, async ({ page }) => {
    await basicInit(page, { loggedInAs: who });
    const listRequests: string[] = [];
    page.on('request', (r) => {
      if (/\/api\/user\?/.test(r.url())) listRequests.push(r.url());
    });
    await page.goto('/');
    await expect(page.getByRole('navigation', { name: 'Global' }).getByRole('link', { name: 'Admin' })).toHaveCount(0);

    await page.goto('/admin-dashboard');
    await expect(page.getByText('Oops')).toBeVisible();
    await expect(page.getByRole('table', { name: 'Users' })).toHaveCount(0);
    await expect(page.getByText('Kai Chen')).toHaveCount(0);
    expect(listRequests).toEqual([]);
  });
}

test('logged out visitor cannot see the users table', async ({ page }) => {
  await basicInit(page);
  await page.goto('/admin-dashboard');
  await expect(page.getByText('Oops')).toBeVisible();
  await expect(page.getByRole('table', { name: 'Users' })).toHaveCount(0);
});

test('admin deletes a user', async ({ page }) => {
  const state = await basicInit(page, { loggedInAs: 'admin' });
  await page.goto('/admin-dashboard');
  const table = page.getByRole('table', { name: 'Users' });
  await expect(table.getByRole('row', { name: /Kai Chen/ })).toBeVisible();

  page.once('dialog', async (dialog) => {
    expect(dialog.type()).toBe('confirm');
    expect(dialog.message()).toBe('Delete Kai Chen (d@jwt.com)?');
    await dialog.accept();
  });
  const deleteRequest = page.waitForRequest((r) => r.method() === 'DELETE' && /\/api\/user\/\d+$/.test(r.url()));
  const refresh = page.waitForRequest((r) => r.method() === 'GET' && /\/api\/user\?/.test(r.url()));
  await table.getByRole('row', { name: /Kai Chen/ }).getByRole('button', { name: 'Delete Kai Chen' }).click();

  expect((await deleteRequest).url()).toMatch(/\/api\/user\/3$/);
  await refresh;
  await expect(table.getByRole('row', { name: /Kai Chen/ })).toHaveCount(0);
  await expect(table.getByRole('row', { name: /Fran Chisee/ })).toBeVisible();
  expect(state.users.map((u) => u.id)).not.toContain('3');
});
