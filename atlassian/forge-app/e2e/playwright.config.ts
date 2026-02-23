import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for e2e/prod_customer_smoke.spec.ts
 * 
 * Separate from the main playwright.config.ts which targets tests/playwright/.
 * This config is designed for production customer runtime proof capture.
 *
 * Usage:
 *   FT_TARGET_URL="https://firsttry.atlassian.net/jira/dashboards/10102" \
 *   FT_EVIDENCE_DIR="/tmp/..." \
 *   npx playwright test --config e2e/playwright.config.ts --project=chromium
 */
export default defineConfig({
  testDir: '.',
  testMatch: 'e2e/*.spec.ts',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  retries: 0,
  workers: 1,
  reporter: [['line']],
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        headless: true,
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
        trace: 'retain-on-failure',
      },
    },
  ],
});
