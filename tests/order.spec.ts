// Menu, payment, delivery, and JWT verify
import { test, expect } from './testSetup';
import { basicInit, login, validJwt } from './mocks';

test('purchase with login', async ({ page }) => {
  const state = await basicInit(page);
  await page.goto('/');

  await page.getByRole('button', { name: 'Order now' }).click();
  await expect(page.getByText('What are you waiting for?')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Checkout' })).toBeDisabled();

  await page.getByRole('combobox').selectOption({ label: 'Lehi' });
  await page.getByRole('button', { name: /Veggie/ }).click();
  await page.getByRole('button', { name: /Pepperoni/ }).click();
  await expect(page.getByText('Selected pizzas: 2')).toBeVisible();
  await page.getByRole('button', { name: 'Checkout' }).click();

  // Not logged in yet, so payment sends us to login first
  await expect(page).toHaveURL(/\/payment\/login$/);
  await page.getByPlaceholder('Email address').fill('d@jwt.com');
  await page.getByPlaceholder('Password').fill('diner');
  await page.getByRole('button', { name: 'Login' }).click();

  await expect(page).toHaveURL(/\/payment$/);
  await expect(page.getByText('Send me those 2 pizzas right now!')).toBeVisible();
  await expect(page.getByRole('row', { name: /Veggie/ })).toContainText('0.004 ₿');
  await expect(page.getByRole('row', { name: /Pepperoni/ })).toContainText('0.004 ₿');
  await expect(page.locator('tfoot')).toContainText('2 pies');
  await expect(page.locator('tfoot')).toContainText('0.008 ₿');

  await page.getByRole('button', { name: 'Pay now' }).click();

  await expect(page).toHaveURL(/\/delivery$/);
  await expect(page.getByText('Here is your JWT Pizza!')).toBeVisible();
  await expect(page.getByText('pie count:')).toBeVisible();
  await expect(page.getByText(validJwt)).toBeVisible();
  expect(state.orders).toHaveLength(1);
  expect(state.orders[0]).toMatchObject({ franchiseId: '1', storeId: '4' });
  expect(state.orders[0].items.map((i) => i.description)).toEqual(['Veggie', 'Pepperoni']);

  await page.getByRole('button', { name: 'Verify' }).click();
  const modal = page.locator('#hs-jwt-modal');
  await expect(modal.getByRole('heading')).toHaveText('JWT Pizza - valid');
  await expect(modal).toContainText('"name": "Student"');
  // Preline ignores Close until the open animation finishes
  await expect(modal).toHaveClass(/opened/);
  await modal.getByRole('button', { name: 'Close' }).click();
  await expect(modal).toBeHidden();
});

test('verify reports an invalid pizza', async ({ page }) => {
  const state = await basicInit(page, { loggedInAs: 'diner' });
  state.verifyFails = true;
  await page.goto('/menu');

  await page.getByRole('combobox').selectOption({ label: 'Spanish Fork' });
  await page.getByRole('button', { name: /Margarita/ }).click();
  await page.getByRole('button', { name: 'Checkout' }).click();
  await expect(page.getByText('Send me that pizza right now!')).toBeVisible();
  await expect(page.locator('tfoot')).toContainText('1 pie');
  await page.getByRole('button', { name: 'Pay now' }).click();

  await page.getByRole('button', { name: 'Verify' }).click();
  const modal = page.locator('#hs-jwt-modal');
  await expect(modal.getByRole('heading')).toHaveText('JWT Pizza - invalid');
  await expect(modal).toContainText('invalid JWT. Looks like you have a bad pizza!');
});

test('cancel payment keeps the order', async ({ page }) => {
  await basicInit(page, { loggedInAs: 'diner' });
  await page.goto('/menu');

  await page.getByRole('combobox').selectOption({ label: 'Springville' });
  await page.getByRole('button', { name: /Veggie/ }).click();
  await page.getByRole('button', { name: 'Checkout' }).click();
  await expect(page).toHaveURL(/\/payment$/);

  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page).toHaveURL(/\/menu$/);
  await expect(page.getByText('Selected pizzas: 1')).toBeVisible();
  await expect(page.getByRole('combobox')).toHaveValue('5');
});

test('failed order shows the error', async ({ page }) => {
  const state = await basicInit(page, { loggedInAs: 'diner' });
  state.orderFails = true;
  await page.goto('/menu');

  await page.getByRole('combobox').selectOption({ label: 'Lehi' });
  await page.getByRole('button', { name: /Pepperoni/ }).click();
  await page.getByRole('button', { name: 'Checkout' }).click();
  await page.getByRole('button', { name: 'Pay now' }).click();

  await expect(page.getByText('⚠️ Failed to fulfill order at factory')).toBeVisible();
  await expect(page).toHaveURL(/\/payment$/);
  expect(state.orders).toHaveLength(0);
});

test('delivery without an order has an invalid jwt', async ({ page }) => {
  await basicInit(page);
  await page.goto('/delivery');

  // No order in router state, so the page shows the 'error' placeholder JWT
  await expect(page.getByText('error', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Verify' }).click();
  const modal = page.locator('#hs-jwt-modal');
  await expect(modal.getByRole('heading')).toHaveText('JWT Pizza - invalid');
  await expect(modal).toHaveClass(/opened/);

  await modal.getByRole('button', { name: 'Close' }).click();
  await expect(modal).toBeHidden();
  await page.getByRole('button', { name: 'Order more' }).click();
  await expect(page).toHaveURL(/\/menu$/);
});
