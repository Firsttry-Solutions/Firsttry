import { defineConfig, devices } from '@playwright/test';

/**
 * EXTREME-PARANOID Playwright E2E Configuration
 * 
 * Deterministic execution rules:
 * - chromium only (not firefox/webkit)
 * - workers: 1 (serial execution, no parallelization)
 * - retries: 0 (fail fast on first failure)
 * - timeout: 120s per test (reasonable for Forge apps)
 * - expect timeout: 20s (allow time for async loads)
 * - storageState: gitignored e2e/.auth/storageState.json
 * - recording: screenshot + video + trace (all on for evidence)
 */

export default defineConfig({
  testDir: './tests',
  fullyParallel: false, // IMPORTANT: serial execution
  forbidOnly: process.env.CI ? true : false,
  retries: 0, // FAIL FAST
  workers: 1, // SERIAL EXECUTION ONLY
  reporter: [
    ['list'],
    ['html', { outputFolder: './playwright-report' }]
  ],
  use: {
    baseURL: process.env.JIRA_SITE || 'https://firsttry.atlassian.net',
    trace: 'on', // Always record trace
    screenshot: 'only-on-failure', // Screenshot on failure
    video: 'retain-on-failure', // Video on failure
    headless: process.env.HEADLESS !== 'false', // Headless by default
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: process.env.STORAGE_STATE || './.auth/storageState.json',
      },
    },
  ],
  webServer: undefined, // No local server; testing against production
  timeout: 120 * 1000, // 120 seconds per test
  expect: {
    timeout: 20 * 1000, // 20 seconds for expect assertions
  },
});
