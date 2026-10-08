// Franchisee dashboard: view, create, and close stores
import { test, expect } from './testSetup';
import { basicInit, login } from './mocks';

test('franchisee views their franchise', async ({ page }) => {
  await basicInit(page);
  await page.goto('/');
  await login(page, 'franchisee');
  await page.getByRole('navigation', { name: 'Global' }).getByRole('link', { name: 'Franchise' }).click();

  await expect(page).toHaveURL(/\/franchise-dashboard$/);
  await expect(page.getByText('PizzaCorp')).toBeVisible();
  await expect(page.getByText('Everything you need to run an JWT Pizza franchise.')).toBeVisible();
  await expect(page.getByRole('row', { name: /Spanish Fork/ })).toContainText('3 ₿');
});

test('franchisee creates a store', async ({ page }) => {
  const state = await basicInit(page, { loggedInAs: 'franchisee' });
  await page.goto('/franchise-dashboard');

  await page.getByRole('button', { name: 'Create store' }).click();
  await expect(page).toHaveURL(/\/franchise-dashboard\/create-store$/);
  await page.getByPlaceholder('store name').fill('Provo');
  await page.getByRole('button', { name: 'Create' }).click();

  await expect(page).toHaveURL(/\/franchise-dashboard$/);
  await expect(page.getByRole('row', { name: /Provo/ })).toContainText('0 ₿');
  expect(state.franchises.find((f) => f.id === '2')!.stores.map((s) => s.name)).toEqual(['Spanish Fork', 'Provo']);
});

test('franchisee cancels store creation', async ({ page }) => {
  await basicInit(page, { loggedInAs: 'franchisee' });
  await page.goto('/franchise-dashboard');

  await page.getByRole('button', { name: 'Create store' }).click();
  await page.getByRole('button', { name: 'Cancel' }).click();

  await expect(page).toHaveURL(/\/franchise-dashboard$/);
  await expect(page.getByRole('row')).toHaveCount(2); // Header + the one store
});

test('franchisee closes a store', async ({ page }) => {
  const state = await basicInit(page, { loggedInAs: 'franchisee' });
  await page.goto('/franchise-dashboard');

  await page.getByRole('row', { name: /Spanish Fork/ }).getByRole('button', { name: 'Close' }).click();
  await expect(page).toHaveURL(/\/franchise-dashboard\/close-store$/);
  await expect(page.getByText('Sorry to see you go')).toBeVisible();
  await expect(page.getByText('Are you sure you want to close the PizzaCorp store Spanish Fork ?')).toBeVisible();

  await page.getByRole('button', { name: 'Close' }).click();

  await expect(page).toHaveURL(/\/franchise-dashboard$/);
  await expect(page.getByRole('row', { name: /Spanish Fork/ })).toHaveCount(0);
  expect(state.franchises.find((f) => f.id === '2')!.stores).toEqual([]);
});

test('franchisee cancels closing a store', async ({ page }) => {
  await basicInit(page, { loggedInAs: 'franchisee' });
  await page.goto('/franchise-dashboard');

  await page.getByRole('row', { name: /Spanish Fork/ }).getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: 'Cancel' }).click();

  await expect(page).toHaveURL(/\/franchise-dashboard$/);
  await expect(page.getByRole('row', { name: /Spanish Fork/ })).toBeVisible();
});

test('diner without a franchise sees the sales pitch', async ({ page }) => {
  await basicInit(page, { loggedInAs: 'diner' });
  await page.goto('/franchise-dashboard');

  await expect(page.getByText('So you want a piece of the pie?')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Unleash Your Potential' })).toBeVisible();
});
