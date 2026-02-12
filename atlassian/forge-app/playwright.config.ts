import { defineConfig } from '@playwright/test';

const baseUrl = process.env.JIRA_BASE_URL;
if (!baseUrl) {
  throw new Error('JIRA_BASE_URL environment variable is required');
}

export default defineConfig({
  testDir: './tests/playwright',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    browserName: 'chromium',
    headless: true,
    trace: 'on',
    screenshot: 'off',
    video: 'off',
    baseURL: baseUrl,
    storageState: 'tests/playwright/.auth/state.json',
  },
});
