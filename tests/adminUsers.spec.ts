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
