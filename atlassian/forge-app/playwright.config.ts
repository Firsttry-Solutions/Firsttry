import { defineConfig, devices } from '@playwright/test';

// === STRICT ENV VALIDATION AT CONFIG LOAD TIME ===
const baseUrl = process.env.JIRA_BASE_URL;
if (!baseUrl) {
  throw new Error('JIRA_BASE_URL environment variable is required');
}
const expectedBaseUrl = 'https://firsttry.atlassian.net';
if (baseUrl !== expectedBaseUrl) {
  throw new Error(
    `JIRA_BASE_URL must equal exactly '${expectedBaseUrl}', got '${baseUrl}'`
  );
}

export default defineConfig({
  testDir: './tests/playwright',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  retries: 0,
  workers: 1,
  reporter: [['list']],
  projects: [
    {
      name: 'setup',
      testMatch: /tests\/playwright\/auth\.setup\.ts/,
      timeout: 600_000,
      use: {
        ...devices['chromium'],
        baseURL: baseUrl,
        headless: true,
        trace: 'off',
      },
    },
    {
      name: 'chromium',
      testMatch: /tests\/playwright\/dashboard-phase1-diagnostics\.spec\.ts/,
      dependencies: ['setup'],
      use: {
        ...devices['chromium'],
        baseURL: baseUrl,
        storageState: 'tests/playwright/.auth/state.json',
        headless: true,
        trace: 'on',
        screenshot: 'off',
        video: 'off',
      },
    },
  ],
});
