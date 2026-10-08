import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  timeout: 15000, // Extra headroom so slow CI runners don't flake
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  // Chromium only, at the course's 800x600 viewport
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 800, height: 600 } },
    },
  ],
  // Start Vite for the tests (reuses one already running locally)
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60000, // Vite can be slow to boot on a cold CI runner
  },
});
