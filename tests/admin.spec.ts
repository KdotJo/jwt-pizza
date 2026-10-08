// Admin dashboard: list, page, filter, create, and close franchises
import { test, expect } from './testSetup';
import { basicInit, login } from './mocks';
import { Franchise } from '../src/service/pizzaService';

// Enough franchises to need more than one page (admin page size is 3)
function manyFranchises(count: number): Franchise[] {
  return Array.from({ length: count }, (_, i) => ({
    id: String(i + 1),
    name: `Franchise ${i + 1}`,
    admins: [{ id: '5', name: 'Lota Owner', email: 'lota@jwt.com' }],
    stores: [{ id: String(50 + i), name: `Store ${i + 1}`, totalRevenue: i }],
  }));
}

test('admin logs in and sees the dashboard', async ({ page }) => {
  await basicInit(page);
  await page.goto('/');
  await login(page, 'admin');

  const nav = page.getByRole('navigation', { name: 'Global' });
  await expect(nav.getByRole('link', { name: 'Franchise' })).toHaveCount(0);
  await nav.getByRole('link', { name: 'Admin' }).click();

  await expect(page).toHaveURL(/\/admin-dashboard$/);
  await expect(page.getByText("Mama Ricci's kitchen")).toBeVisible();
  await expect(page.getByRole('row', { name: /LotaPizza/ })).toContainText('Lota Owner');
  await expect(page.getByRole('row', { name: /Lehi/ })).toContainText('1.5 ₿');
  await expect(page.getByRole('row', { name: /PizzaCorp/ })).toContainText('Fran Chisee');
  await expect(page.getByRole('row', { name: /topSpot/ })).toBeVisible();
});

test('non-admin cannot see the admin dashboard', async ({ page }) => {
  await basicInit(page, { loggedInAs: 'diner' });
  await page.goto('/admin-dashboard');

  await expect(page.getByText('Oops')).toBeVisible();
  await expect(page.getByText("Mama Ricci's kitchen")).toHaveCount(0);
});

test('admin pages through franchises', async ({ page }) => {
  await basicInit(page, { loggedInAs: 'admin', franchises: manyFranchises(5) });
  await page.goto('/admin-dashboard');

  const prev = page.getByRole('button', { name: '«' });
  const next = page.getByRole('button', { name: '»' });
  await expect(page.getByText('Franchise 1', { exact: true })).toBeVisible();
  await expect(page.getByText('Franchise 3', { exact: true })).toBeVisible();
  await expect(page.getByText('Franchise 4', { exact: true })).toHaveCount(0);
  await expect(prev).toBeDisabled();
  await expect(next).toBeEnabled();

  await next.click();
  await expect(page.getByText('Franchise 4', { exact: true })).toBeVisible();
  await expect(page.getByText('Franchise 5', { exact: true })).toBeVisible();
  await expect(page.getByText('Franchise 1', { exact: true })).toHaveCount(0);
  await expect(next).toBeDisabled();
  await expect(prev).toBeEnabled();

  await prev.click();
  await expect(page.getByText('Franchise 1', { exact: true })).toBeVisible();
});

test('admin filters franchises by name', async ({ page }) => {
  await basicInit(page, { loggedInAs: 'admin' });
  await page.goto('/admin-dashboard');
  await expect(page.getByText('topSpot')).toBeVisible();

  await page.getByPlaceholder('Filter franchises').fill('pizza');
  await page.getByRole('button', { name: 'Submit' }).click();

  await expect(page.getByText('topSpot')).toHaveCount(0);
  await expect(page.getByText('LotaPizza')).toBeVisible();
  await expect(page.getByText('PizzaCorp')).toBeVisible();
});

test('admin creates a franchise', async ({ page }) => {
  const state = await basicInit(page, { loggedInAs: 'admin' });
  await page.goto('/admin-dashboard');

  await page.getByRole('button', { name: 'Add Franchise' }).click();
  await expect(page).toHaveURL(/\/admin-dashboard\/create-franchise$/);
  await expect(page.getByText('Want to create franchise?')).toBeVisible();
  await page.getByPlaceholder('franchise name').fill('pizzaPocket');
  await page.getByPlaceholder('franchisee admin email').fill('d@jwt.com');
  await page.getByRole('button', { name: 'Create' }).click();

  await expect(page).toHaveURL(/\/admin-dashboard$/);
  // New franchise lands on page 2 (page size is 3)
  await page.getByRole('button', { name: '»' }).click();
  await expect(page.getByRole('row', { name: /pizzaPocket/ })).toContainText('Kai Chen');
  expect(state.franchises.map((f) => f.name)).toContain('pizzaPocket');
});

test('admin franchise creation fails for an unknown franchisee', async ({ page }) => {
  const state = await basicInit(page, { loggedInAs: 'admin' });
  await page.goto('/admin-dashboard/create-franchise');

  await page.getByPlaceholder('franchise name').fill('ghostPizza');
  await page.getByPlaceholder('franchisee admin email').fill('nobody@jwt.com');
  const response = page.waitForResponse(/\/api\/franchise$/);
  await page.getByRole('button', { name: 'Create' }).click();

  // The app shows no error, it just stays on the form
  expect((await response).status()).toBe(404);
  await expect(page).toHaveURL(/\/admin-dashboard\/create-franchise$/);
  expect(state.franchises.map((f) => f.name)).not.toContain('ghostPizza');
});

test('admin cancels franchise creation', async ({ page }) => {
  await basicInit(page, { loggedInAs: 'admin' });
  await page.goto('/admin-dashboard');

  await page.getByRole('button', { name: 'Add Franchise' }).click();
  await page.getByRole('button', { name: 'Cancel' }).click();

  await expect(page).toHaveURL(/\/admin-dashboard$/);
  await expect(page.getByText("Mama Ricci's kitchen")).toBeVisible();
});

test('admin closes a franchise', async ({ page }) => {
  const state = await basicInit(page, { loggedInAs: 'admin' });
  await page.goto('/admin-dashboard');

  await page.getByRole('row', { name: /LotaPizza/ }).getByRole('button', { name: 'Close' }).click();
  await expect(page).toHaveURL(/\/admin-dashboard\/close-franchise$/);
  await expect(page.getByText('Are you sure you want to close the LotaPizza franchise?')).toBeVisible();

  await page.getByRole('button', { name: 'Close' }).click();

  await expect(page).toHaveURL(/\/admin-dashboard$/);
  await expect(page.getByText('PizzaCorp')).toBeVisible();
  await expect(page.getByText('LotaPizza')).toHaveCount(0);
  expect(state.franchises.map((f) => f.id)).toEqual(['2', '3']);
});

test('admin cancels closing a franchise', async ({ page }) => {
  await basicInit(page, { loggedInAs: 'admin' });
  await page.goto('/admin-dashboard');

  await page.getByRole('row', { name: /LotaPizza/ }).getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: 'Cancel' }).click();

  await expect(page).toHaveURL(/\/admin-dashboard$/);
  await expect(page.getByText('LotaPizza')).toBeVisible();
});

test('admin closes a store', async ({ page }) => {
  const state = await basicInit(page, { loggedInAs: 'admin' });
  await page.goto('/admin-dashboard');

  await page.getByRole('row', { name: /Springville/ }).getByRole('button', { name: 'Close' }).click();
  await expect(page).toHaveURL(/\/admin-dashboard\/close-store$/);
  await expect(page.getByText('Are you sure you want to close the LotaPizza store Springville ?')).toBeVisible();

  await page.getByRole('button', { name: 'Close' }).click();

  await expect(page).toHaveURL(/\/admin-dashboard$/);
  await expect(page.getByRole('row', { name: /Lehi/ })).toBeVisible();
  await expect(page.getByRole('row', { name: /Springville/ })).toHaveCount(0);
  expect(state.franchises[0].stores.map((s) => s.name)).toEqual(['Lehi']);
});
