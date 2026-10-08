import { test as base, expect } from 'playwright-test-coverage';

// Every test gets a page that refuses to talk to the real pizza service.
// Mocks registered by a test take priority over this catch-all route, so any
// request that reaches here for localhost:3000 was not mocked.
export const test = base.extend({
  page: async ({ page }, use) => {
    const violations: string[] = [];
    await page.route('**/*', async (route) => {
      const request = route.request();
      if (request.url().startsWith('http://localhost:3000')) {
        violations.push(`${request.method()} ${request.url()}`);
        await route.abort();
      } else {
        await route.continue();
      }
    });

    await use(page);

    expect(violations).toEqual([]);
  },
});

export { expect };
