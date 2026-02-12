import { test as setup } from '@playwright/test';

setup('auth', async ({ page }) => {
  const baseUrl = process.env.JIRA_BASE_URL;
  if (!baseUrl) throw new Error('Missing JIRA_BASE_URL');

  const expectedUrl = 'https://firsttry.atlassian.net';
  if (baseUrl !== expectedUrl) {
    throw new Error(
      `JIRA_BASE_URL must be '${expectedUrl}', got '${baseUrl}'`
    );
  }

  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });

  await page.waitForURL('**/jira/**', { timeout: 120_000 });

  const statePath = 'tests/playwright/.auth/state.json';
  await page.context().storageState({ path: statePath });
  console.log(`AUTH_STATE_SAVED: ${statePath}`);
});
