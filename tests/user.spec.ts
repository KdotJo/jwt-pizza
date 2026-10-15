// Diner dashboard: edit the logged-in user's name, email and password
import { Page } from '@playwright/test';
import { test, expect } from './testSetup';
import { basicInit } from './mocks';

// Register a fresh diner through the UI and land on the home page
async function registerDiner(page: Page, email = 'pd@jwt.com') {
  await page.goto('/');
  await page.getByRole('link', { name: 'Register' }).click();
  await page.getByPlaceholder('Full name').fill('pizza diner');
  await page.getByPlaceholder('Email address').fill(email);
  await page.getByPlaceholder('Password').fill('diner');
  await page.getByRole('button', { name: 'Register' }).click();
}

// Log in through the login form with any credentials
async function loginAs(page: Page, email: string, password: string) {
  await page.getByRole('link', { name: 'Login', exact: true }).click();
  await page.getByPlaceholder('Email address').fill(email);
  await page.getByPlaceholder('Password').fill(password);
  await page.getByRole('button', { name: 'Login' }).click();
}

test('updateUser', async ({ page }) => {
  await basicInit(page);
  await registerDiner(page);

  await page.getByRole('link', { name: 'pd' }).click();

  await expect(page.getByRole('main')).toContainText('pizza diner');

  // Edit opens the dialog, Update closes it
  await page.getByRole('button', { name: 'Edit' }).click();
  await expect(page.locator('h3')).toContainText('Edit user');
  await page.getByRole('button', { name: 'Update' }).click();
  await page.waitForSelector('[role="dialog"].hidden', { state: 'attached' });
  await expect(page.getByRole('main')).toContainText('pizza diner');

  // Change the name
  await page.getByRole('button', { name: 'Edit' }).click();
  await expect(page.locator('h3')).toContainText('Edit user');
  await page.getByRole('textbox').first().fill('pizza dinerx');
  await page.getByRole('button', { name: 'Update' }).click();
  await page.waitForSelector('[role="dialog"].hidden', { state: 'attached' });
  await expect(page.getByRole('main')).toContainText('pizza dinerx');

  // The change is saved, not just shown
  await page.getByRole('link', { name: 'Logout' }).click();
  await loginAs(page, 'pd@jwt.com', 'diner');
  await page.getByRole('link', { name: 'pd' }).click();
  await expect(page.getByRole('main')).toContainText('pizza dinerx');
});

// Open the edit dialog, change the given fields, and wait for it to close
async function editUser(page: Page, fields: { name?: string; email?: string; password?: string }) {
  await page.getByRole('button', { name: 'Edit' }).click();
  await expect(page.locator('h3')).toContainText('Edit user');
  const dialog = page.getByRole('dialog');
  if (fields.name !== undefined) await dialog.getByRole('textbox').nth(0).fill(fields.name);
  if (fields.email !== undefined) await dialog.getByRole('textbox').nth(1).fill(fields.email);
  if (fields.password !== undefined) await dialog.locator('#password').fill(fields.password);
  await dialog.getByRole('button', { name: 'Update' }).click();
  await page.waitForSelector('[role="dialog"].hidden', { state: 'attached' });
}

test('update email and log in with it', async ({ page }) => {
  const state = await basicInit(page);
  await registerDiner(page);
  await page.getByRole('link', { name: 'pd' }).click();

  await editUser(page, { email: 'pdx@jwt.com' });
  await expect(page.getByRole('main')).toContainText('pdx@jwt.com');

  await page.getByRole('link', { name: 'Logout' }).click();
  await loginAs(page, 'pdx@jwt.com', 'diner');
  await page.getByRole('link', { name: 'pd' }).click();
  await expect(page.getByRole('main')).toContainText('pdx@jwt.com');
  expect(state.users.some((u) => u.email === 'pd@jwt.com')).toBe(false);
});

test('update password and log in with it', async ({ page }) => {
  await basicInit(page);
  await registerDiner(page);
  await page.getByRole('link', { name: 'pd' }).click();

  await editUser(page, { password: 'newpass' });

  // The old password stops working
  await page.getByRole('link', { name: 'Logout' }).click();
  await loginAs(page, 'pd@jwt.com', 'diner');
  await expect(page.getByText('unknown user')).toBeVisible();

  await page.getByPlaceholder('Password').fill('newpass');
  await page.getByRole('button', { name: 'Login' }).click();
  await page.getByRole('link', { name: 'pd' }).click();
  await expect(page.getByRole('main')).toContainText('pizza diner');
});

test('blank password keeps the old one', async ({ page }) => {
  const state = await basicInit(page);
  await registerDiner(page);
  await page.getByRole('link', { name: 'pd' }).click();

  const put = page.waitForRequest((r) => r.method() === 'PUT' && /\/api\/user\/\d+$/.test(r.url()));
  await editUser(page, { name: 'pizza dinerx' });
  expect((await put).postDataJSON().password).toBeUndefined();
  expect(state.users.find((u) => u.email === 'pd@jwt.com')?.password).toBe('diner');
});

test('franchisee updates name and keeps roles', async ({ page }) => {
  await basicInit(page, { loggedInAs: 'franchisee' });
  await page.goto('/');
  await page.getByRole('link', { name: 'FC' }).click();

  await editUser(page, { name: 'Fran Updated' });

  await expect(page.getByRole('main')).toContainText('Fran Updated');
  await expect(page.getByText('diner, Franchisee on 2')).toBeVisible();
  await expect(page.getByRole('link', { name: 'FU' })).toBeVisible();
});

test('admin updates own name and keeps admin access', async ({ page }) => {
  await basicInit(page, { loggedInAs: 'admin' });
  await page.goto('/');
  await page.getByRole('link', { name: 'MR' }).click();

  await editUser(page, { name: 'Mama Updated' });

  await expect(page.getByRole('main')).toContainText('Mama Updated');
  await expect(page.getByRole('main')).toContainText('admin');
  await page.getByRole('link', { name: 'Admin' }).click();
  await expect(page.getByText("Mama Ricci's kitchen")).toBeVisible();
});
