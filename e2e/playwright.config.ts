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
  retries: process.env.CI ? 1 : 0, // CI gets 1 retry; local gets fail-fast
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
        storageState: process.env.STORAGE_STATE === '__NONE__' ? undefined : (process.env.STORAGE_STATE || './.auth/storageState.json'),
        // Stable launch options for headless Chromium in CI/container environments
        launchOptions: {
          args: [
            '--no-sandbox', // Allow running in container without CAP_SYS_ADMIN
            '--disable-dev-shm-usage', // Use /tmp instead of /dev/shm for shared memory
            '--disable-gpu', // Disable GPU acceleration (not needed for headless)
            '--disable-features=IsolateOrigins,site-per-process', // Disable features that require special setup
          ],
        },
      },
    },
  ],
  webServer: undefined, // No local server; testing against production
  timeout: 120 * 1000, // 120 seconds per test
  expect: {
    timeout: 20 * 1000, // 20 seconds for expect assertions
  },
});
