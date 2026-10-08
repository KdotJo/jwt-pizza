import { test, expect } from './testSetup';
import { basicInit, login, users } from './mocks';

test('login as diner', async ({ page }) => {
  await basicInit(page);
  await page.goto('/');
  await login(page, 'diner');

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('link', { name: 'KC' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Logout' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Login', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('token'))).toBe(`token-${users.diner.id}`);
});

test('login with bad credentials shows error', async ({ page }) => {
  await basicInit(page);
  await page.goto('/login');
  await page.getByPlaceholder('Email address').fill('d@jwt.com');
  await page.getByPlaceholder('Password').fill('wrong');
  await page.getByRole('button', { name: 'Login' }).click();

  await expect(page.getByText('unknown user')).toBeVisible();
  await expect(page.getByText('"code":401')).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test('register a new diner', async ({ page }) => {
  const state = await basicInit(page);
  await page.goto('/');
  await page.getByRole('link', { name: 'Register' }).click();
  await expect(page.getByText('Welcome to the party')).toBeVisible();

  await page.getByPlaceholder('Full name').fill('Pat Newman');
  await page.getByPlaceholder('Email address').fill('pat@jwt.com');
  await page.getByPlaceholder('Password').fill('secret');
  await page.getByRole('button', { name: 'Register' }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('link', { name: 'PN' })).toBeVisible();
  expect(state.users.map((u) => u.email)).toContain('pat@jwt.com');

  await page.getByRole('link', { name: 'PN' }).click();
  await expect(page.getByText('Your pizza kitchen')).toBeVisible();
  await expect(page.getByText('pat@jwt.com')).toBeVisible();
});

test('register with an existing email shows error', async ({ page }) => {
  await basicInit(page);
  await page.goto('/register');
  await page.getByPlaceholder('Full name').fill('Kai Again');
  await page.getByPlaceholder('Email address').fill(users.diner.email);
  await page.getByPlaceholder('Password').fill('diner');
  await page.getByRole('button', { name: 'Register' }).click();

  await expect(page.getByText('email already registered')).toBeVisible();
  await expect(page).toHaveURL(/\/register$/);
});

test('switch between login and register', async ({ page }) => {
  await basicInit(page);
  await page.goto('/login');
  await page.getByText('Register', { exact: true }).last().click();
  await expect(page).toHaveURL(/\/register$/);
  await expect(page.getByPlaceholder('Full name')).toBeVisible();

  await page.getByText('Login', { exact: true }).last().click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText('Welcome back')).toBeVisible();
});

test('logout', async ({ page }) => {
  await basicInit(page, { loggedInAs: 'diner' });
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'KC' })).toBeVisible();

  await page.getByRole('link', { name: 'Logout' }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('link', { name: 'Login', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'KC' })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull();

  // The session stays logged out across a reload.
  await page.reload();
  await expect(page.getByRole('link', { name: 'Login', exact: true })).toBeVisible();
});

test('stale token is discarded', async ({ page }) => {
  await basicInit(page);
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('stale')) {
      localStorage.setItem('token', 'expired-token');
      sessionStorage.setItem('stale', 'true');
    }
  });
  await page.goto('/');

  await expect(page.getByRole('link', { name: 'Login', exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('token'))).toBeNull();
});
