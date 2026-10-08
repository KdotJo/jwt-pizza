import { test as base, expect } from 'playwright-test-coverage';

// Page fixture that fails the test if anything reaches the real pizza service.
// Test mocks are registered later, so they win over this catch-all route.
export const test = base.extend({
  page: async ({ page }, use) => {
    const violations: string[] = [];
    await page.route('**/*', async (route) => {
      const request = route.request();
      if (request.url().startsWith('http://localhost:3000')) {
        // Unmocked call to the backend
        violations.push(`${request.method()} ${request.url()}`);
        await route.abort();
      } else {
        // Vite assets, images, etc. load normally
        await route.continue();
      }
    });

    await use(page);

    // Fail the test if any request slipped past the mocks
    expect(violations).toEqual([]);
  },
});

export { expect };
