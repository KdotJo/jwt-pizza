import { test, expect } from './testSetup';
import { basicInit } from './mocks';

test.beforeEach(async ({ page }) => {
  await basicInit(page);
});

test('home page', async ({ page }) => {
  await page.goto('/');

  expect(await page.title()).toBe('JWT Pizza');
  await expect(page.getByRole('heading', { name: "The web's best pizza" })).toBeVisible();
  await expect(page.getByText('Most amazing pizza experience of my life.')).toBeAttached();
  await expect(page.getByText(/Version: \d{8}\.\d{6}/)).toBeVisible();
});

test('order now button opens the menu', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Order now' }).click();

  await expect(page).toHaveURL(/\/menu$/);
  await expect(page.getByText('Awesome is a click away')).toBeVisible();
});

test('header navigation for an anonymous user', async ({ page }) => {
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Global' });

  await expect(nav.getByRole('link', { name: 'Order' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Franchise' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Login' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Register' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Logout' })).toHaveCount(0);
  await expect(nav.getByRole('link', { name: 'Admin' })).toHaveCount(0);

  await nav.getByRole('link', { name: 'Order' }).click();
  await expect(page).toHaveURL(/\/menu$/);
});

test('about page from footer', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('contentinfo').getByRole('link', { name: 'About' }).click();

  await expect(page).toHaveURL(/\/about$/);
  await expect(page.getByText('The secret sauce')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Our employees' })).toBeVisible();
});

test('history page from footer', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('contentinfo').getByRole('link', { name: 'History' }).click();

  await expect(page).toHaveURL(/\/history$/);
  await expect(page.getByText('Mama Rucci, my my')).toBeVisible();
  await expect(page.getByText('It all started in Mama Ricci')).toBeVisible();
});

test('franchise page from footer when not logged in', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('contentinfo').getByRole('link', { name: 'Franchise' }).click();

  await expect(page).toHaveURL(/\/franchise-dashboard$/);
  await expect(page.getByText('So you want a piece of the pie?')).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('If you are already a franchisee, please');
  await expect(page.getByRole('link', { name: '800-555-5555' })).toBeVisible();

  await page.getByRole('alert').getByRole('link', { name: 'login' }).click();
  await expect(page).toHaveURL(/\/franchise-dashboard\/login$/);
  await expect(page.getByText('Welcome back')).toBeVisible();
});

test('breadcrumb navigates back home', async ({ page }) => {
  await page.goto('/about');
  await expect(page.getByRole('list').getByRole('link', { name: 'about' })).toBeVisible();

  await page.getByRole('link', { name: 'home' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: "The web's best pizza" })).toBeVisible();
});

test('unknown route shows not found page', async ({ page }) => {
  await page.goto('/this-page-does-not-exist');

  await expect(page.getByText('Oops')).toBeVisible();
  await expect(page.getByText('It looks like we have dropped a pizza on the floor.')).toBeVisible();
});

test('service docs', async ({ page }) => {
  await page.goto('/docs');

  await expect(page.getByText('JWT Pizza API')).toBeVisible();
  await expect(page.getByRole('heading', { name: '[PUT] /api/auth' })).toBeVisible();
  await expect(page.getByText('Login existing user')).toBeVisible();
  await expect(page.getByText('service: http://localhost:3000')).toBeVisible();
});

test('factory docs', async ({ page }) => {
  await page.goto('/docs/factory');

  await expect(page.getByRole('heading', { name: '🔐 [POST] /api/order/verify' })).toBeVisible();
  await expect(page.getByText('Verifies a pizza order')).toBeVisible();
});
