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

test('updateUser', async ({ page }) => {
  await basicInit(page);
  await registerDiner(page);

  await page.getByRole('link', { name: 'pd' }).click();

  await expect(page.getByRole('main')).toContainText('pizza diner');
});
