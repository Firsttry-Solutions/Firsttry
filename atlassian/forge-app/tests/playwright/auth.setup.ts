import { test as setup } from '@playwright/test';

setup('auth', async ({ page }) => {
  const baseUrl = process.env.JIRA_BASE_URL;
  if (!baseUrl) throw new Error('Missing JIRA_BASE_URL');

  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });

  await page.waitForURL('**/jira/**', { timeout: 120_000 });

  await page.context().storageState({
    path: 'tests/playwright/.auth/state.json'
  });
});
