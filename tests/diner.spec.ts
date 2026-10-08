import { test, expect } from './testSetup';
import { basicInit } from './mocks';

test('diner with no orders', async ({ page }) => {
  await basicInit(page, { loggedInAs: 'diner' });
  await page.goto('/');
  await page.getByRole('link', { name: 'KC' }).click();

  await expect(page).toHaveURL(/\/diner-dashboard$/);
  await expect(page.getByText('Your pizza kitchen')).toBeVisible();
  await expect(page.getByText('Kai Chen')).toBeVisible();
  await expect(page.getByText('d@jwt.com')).toBeVisible();
  await expect(page.getByText('How have you lived this long without having a pizza?')).toBeVisible();

  await page.getByRole('link', { name: 'Buy one' }).click();
  await expect(page).toHaveURL(/\/menu$/);
});

test('diner with order history', async ({ page }) => {
  await basicInit(page, {
    loggedInAs: 'diner',
    orders: [
      { id: '11', franchiseId: '1', storeId: '4', date: '2024-06-05T05:14:40.000Z', items: [{ menuId: '1', description: 'Veggie', price: 0.05 }] },
      {
        id: '12',
        franchiseId: '1',
        storeId: '5',
        date: '2024-06-06T05:14:40.000Z',
        items: [
          { menuId: '2', description: 'Pepperoni', price: 0.25 },
          { menuId: '3', description: 'Margarita', price: 0.5 },
        ],
      },
    ],
  });
  await page.goto('/diner-dashboard');

  await expect(page.getByText('Here is your history of all the good times.')).toBeVisible();
  await expect(page.getByRole('row')).toHaveCount(3);
  await expect(page.getByRole('row', { name: /^11/ })).toContainText('0.05 ₿');
  await expect(page.getByRole('row', { name: /^12/ })).toContainText('0.75 ₿');
  await expect(page.getByRole('row', { name: /^12/ })).toContainText('2024-06-06T05:14:40.000Z');
});

test('franchisee role is described on the dashboard', async ({ page }) => {
  await basicInit(page, { loggedInAs: 'franchisee' });
  await page.goto('/diner-dashboard');

  await expect(page.getByText('Fran Chisee')).toBeVisible();
  await expect(page.getByText('diner, Franchisee on 2')).toBeVisible();
});
