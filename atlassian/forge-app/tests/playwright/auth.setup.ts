import { test as setup } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

setup('auth', async ({ page }) => {
  const baseUrl = process.env.JIRA_BASE_URL;
  if (!baseUrl) throw new Error('Missing JIRA_BASE_URL');

  const expectedUrl = 'https://firsttry.atlassian.net';
  if (baseUrl !== expectedUrl) {
    throw new Error(
      `JIRA_BASE_URL must equal exactly '${expectedUrl}', got '${baseUrl}'`
    );
  }

  // === Ensure .auth directory exists (deterministic) ===
  const statePath = 'tests/playwright/.auth/state.json';
  const authDir = path.dirname(statePath);
  fs.mkdirSync(authDir, { recursive: true });

  // === Navigate to deterministic Jira route ===
  const jiraRoute = `${baseUrl}/jira/your-work`;
  console.log(`[AUTH] Navigating to ${jiraRoute}`);
  await page.goto(jiraRoute, { waitUntil: 'domcontentloaded' });

  // === Check if login is required (robust detection) ===
  const currentUrl = page.url();
  const isLoginRequired = !currentUrl.startsWith(`${baseUrl}/jira/`);

  if (isLoginRequired) {
    console.log('[AUTH] Login page detected (URL does not start with Jira route)');

    const jiraEmail = process.env.JIRA_EMAIL;
    const jiraPassword = process.env.JIRA_PASSWORD;

    if (!jiraEmail || !jiraPassword) {
      // === Manual login mode ===
      console.log('[AUTH] MANUAL_LOGIN_REQUIRED: complete Atlassian login in the visible browser within 180s');
      console.log('[AUTH] Waiting for user to complete login (180s timeout)...');
      try {
        await page.waitForURL(`${baseUrl}/jira/**`, { timeout: 180_000 });
        console.log('[AUTH] ✓ Manual login completed - navigated to Jira');
      } catch (err) {
        throw new Error(
          'FATAL: Manual login not completed within 180s; set JIRA_EMAIL/JIRA_PASSWORD or login via noVNC'
        );
      }
    } else {
      // === Automated login mode ===
      console.log('[AUTH] Attempting automated login with provided credentials...');

      // Email input (try multiple selectors)
      const emailLocators = [
        page.locator('input[type="email"]'),
        page.locator('input[name="username"]'),
        page.locator('#username'),
        page.locator('input[name="email"]'),
      ];

      let emailFound = false;
      for (const locator of emailLocators) {
        if ((await locator.count()) > 0) {
          await locator.fill(jiraEmail);
          emailFound = true;
          break;
        }
      }

      if (!emailFound) {
        throw new Error('Email input field not found');
      }

      // Submit / Continue button
      const submitLocators = [
        page.locator('button[type="submit"]'),
        page.locator('button:has-text("Continue")'),
        page.locator('button:has-text("Log in")'),
        page.locator('input[type="submit"]'),
      ];

      let submitFound = false;
      for (const locator of submitLocators) {
        if ((await locator.count()) > 0) {
          await locator.click();
          submitFound = true;
          break;
        }
      }

      if (!submitFound) {
        throw new Error('Submit button not found after email entry');
      }

      // Wait a bit for redirect to password page
      await page.waitForTimeout(2000);

      // Password input (try multiple selectors)
      const passwordLocators = [
        page.locator('input[type="password"]'),
        page.locator('input[name="password"]'),
        page.locator('#password'),
      ];

      let passwordFound = false;
      for (const locator of passwordLocators) {
        if ((await locator.count()) > 0) {
          await locator.fill(jiraPassword);
          passwordFound = true;
          break;
        }
      }

      if (!passwordFound) {
        throw new Error('Password input field not found');
      }

      // Submit password form
      for (const locator of submitLocators) {
        if ((await locator.count()) > 0) {
          await locator.click();
          break;
        }
      }

      // Wait for Jira dashboard to load
      console.log('[AUTH] Waiting for Jira dashboard...');
      await page.waitForURL(`${baseUrl}/jira/**`, { timeout: 120_000 });
    }
  } else {
    console.log('[AUTH] Already authenticated or at Jira page');
  }

  // === Save auth state ===
  await page.context().storageState({ path: statePath });

  // === Verify state file exists and is non-trivial ===
  if (!fs.existsSync(statePath)) {
    throw new Error(`Auth state file not created at ${statePath}`);
  }

  const statSize = fs.statSync(statePath).size;
  if (statSize < 10) {
    throw new Error(`Auth state file too small (${statSize} bytes), likely empty`);
  }

  console.log(`AUTH_STATE_SAVED: ${statePath}`);
});
