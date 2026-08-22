import { defineConfig, devices } from '@playwright/test';

/** Smoke tests against a running deployment. BASE_URL defaults to the production SPA. */
export default defineConfig({
  testDir: '.',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  fullyParallel: false,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: process.env.BASE_URL || 'https://frontend-iota-two-70.vercel.app', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
