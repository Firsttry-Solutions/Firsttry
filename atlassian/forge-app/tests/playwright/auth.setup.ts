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

  // === Ensure .auth directory exists ===
  const authDir = path.join(__dirname, '.auth');
  fs.mkdirSync(authDir, { recursive: true });

  // === Navigate to Jira ===
  console.log(`[AUTH] Navigating to ${baseUrl}`);
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });

  // === Check if login is required ===
  const currentUrl = page.url();
  const isLoginRequired = currentUrl.includes('login') || currentUrl.includes('auth');

  if (isLoginRequired) {
    console.log('[AUTH] Login page detected');

    const jiraEmail = process.env.JIRA_EMAIL;
    const jiraPassword = process.env.JIRA_PASSWORD;

    if (!jiraEmail || !jiraPassword) {
      throw new Error(
        'Login required but JIRA_EMAIL and/or JIRA_PASSWORD not provided'
      );
    }

    // === Attempt login with robust selectors ===
    console.log('[AUTH] Attempting login...');

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
    await page.waitForURL('**/jira/**', { timeout: 120_000 });
  } else {
    console.log('[AUTH] Already authenticated or at Jira page');
    // If not at Jira yet, wait for it
    await page.waitForURL('**/jira/**', { timeout: 30_000 }).catch(() => {
      // It's okay if this fails; the user might already be on a Jira page
    });
  }

  // === Save auth state ===
  const statePath = 'tests/playwright/.auth/state.json';
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
