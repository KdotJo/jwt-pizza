// Admin dashboard: list, page, filter, and delete users
import { test, expect } from './testSetup';
import { basicInit, login } from './mocks';

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
