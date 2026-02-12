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

  // === Helper: Prove Jira authentication (strict proof) ===
  async function proveJiraAuthentication(): Promise<void> {
    // 1) Verify URL starts with baseUrl/jira/
    const currentUrl = page.url();
    if (!currentUrl.startsWith(`${baseUrl}/jira/`)) {
      throw new Error(
        `FATAL: Jira authentication proof failed (url not under /jira/: ${currentUrl})`
      );
    }
    console.log('[AUTH_PROOF] URL verified: starts with /jira/');

    // 2) Call Jira REST API /rest/api/3/myself and require 200 (primary proof)
    const resp = await page.request.get(`${baseUrl}/rest/api/3/myself`);
    const statusCode = resp.status();
    console.log(`[AUTH_PROOF] Jira /myself API status: ${statusCode}`);

    if (statusCode !== 200) {
      // Capture screenshot for debugging
      await page.screenshot({ path: `${authDir}/auth-failure.png` });
      throw new Error(
        `FATAL: Jira authentication proof failed (myself status=${statusCode}, url=${currentUrl})`
      );
    }

    // 3) Verify main element is visible (best effort, timeout 15s to avoid blocking)
    try {
      await page.locator('main').first().waitFor({ state: 'visible', timeout: 15_000 });
      console.log('[AUTH_PROOF] Main element verified: visible');
    } catch (err) {
      // Main element not visible is not fatal if API returned 200 (authenticated)
      console.log('[AUTH_PROOF] Warning: main element not visible, but API auth confirmed');
    }

    console.log('[AUTH_PROOF] ✓ All proofs passed - Jira authentication confirmed');
  }

  // === Navigate to deterministic Jira route ===
  const jiraRoute = `${baseUrl}/jira/your-work`;
  console.log(`[AUTH] Navigating to ${jiraRoute}`);
  await page.goto(jiraRoute, { waitUntil: 'domcontentloaded' });

  // === Check if login is required (check URL AND API status) ===
  let currentUrl = page.url();
  let isLoginRequired = !currentUrl.startsWith(`${baseUrl}/jira/`);

  // === If at Jira URL, verify authentication with API ===
  let apiStatus = 0;
  if (!isLoginRequired) {
    try {
      const resp = await page.request.get(`${baseUrl}/rest/api/3/myself`);
      apiStatus = resp.status();
      console.log(`[AUTH] Initial /myself API status: ${apiStatus}`);
      // If API returns non-200, we need login despite being at /jira/ URL
      if (apiStatus !== 200) {
        console.log('[AUTH] API returned non-200; treating as login required (stale/invalid auth)');
        isLoginRequired = true;
      }
    } catch (err) {
      console.log(`[AUTH] API check failed; treating as login required`);
      isLoginRequired = true;
    }
  }

  if (isLoginRequired) {
    console.log('[AUTH] Login page detected (URL does not start with Jira route)');

    const jiraEmail = process.env.JIRA_EMAIL;
    const jiraPassword = process.env.JIRA_PASSWORD;

    if (!jiraEmail || !jiraPassword) {
      // === Manual login mode (polling loop) ===
      console.log('[AUTH] MANUAL_LOGIN_REQUIRED: complete Atlassian login/MFA in visible browser within 600s');
      console.log('[AUTH] Keeping browser open, polling for authentication proof...');

      const deadline = Date.now() + 600_000; // 10 minutes
      let lastStatus = 0;
      let authenticated = false;

      // === Polling loop: keep page open and attempt proof every 2s ===
      while (Date.now() < deadline && !authenticated) {
        try {
          const resp = await page.request.get(`${baseUrl}/rest/api/3/myself`);
          lastStatus = resp.status();
          console.log(`[AUTH_POLL] /myself status: ${lastStatus}`);

          if (lastStatus === 200) {
            console.log('[AUTH_POLL] ✓ Authentication detected, breaking loop');
            authenticated = true;
            break;
          }
        } catch (err) {
          console.log(`[AUTH_POLL] Request error (will retry): ${(err as Error).message}`);
          lastStatus = 0;
        }

        // Wait 2 seconds before next attempt
        if (!authenticated) {
          await page.waitForTimeout(2000);
        }
      }

      // === Check if we reached success ===
      if (!authenticated) {
        // Deadline exceeded without auth proof
        await page.screenshot({ path: `${authDir}/auth-failure.png` });
        throw new Error(
          `FATAL: Manual MFA not completed within 600s (myself status=${lastStatus})`
        );
      }

      console.log('[AUTH] ✓ Manual login polling succeeded');
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
    console.log('[AUTH] Already at Jira page - will verify authentication');
  }

  // === Run Jira authentication proof (strict fail-closed) ===
  await proveJiraAuthentication();

  // === Save auth state (ONLY after proof passes) ===
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
