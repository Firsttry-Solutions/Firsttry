import { test as setup } from '@playwright/test';
import { chromium, Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

// === HELPER: Get output directory for failure evidence ===
function getOutDir(): string {
  const outDir = process.env.OUT_DIR || '/tmp/playwright-evidence';
  fs.mkdirSync(outDir, { recursive: true });
  return outDir;
}

// === HELPER: Reason codes for structured auth failures ===
type AuthFailureReasonCode =
  | 'LOGIN_FORM_NOT_FOUND'
  | 'MFA_REQUIRED'
  | 'SSO_REQUIRED'
  | 'CAPTCHA_OR_BOT_GUARD'
  | 'INVALID_CREDENTIALS'
  | 'UNKNOWN_LOGIN_VARIANT';

interface AuthObservations {
  hasAtlassianIdHost: boolean;
  hasEmailInput: boolean;
  hasPasswordInput: boolean;
  hasContinueButton: boolean;
  hasSsoButtons: boolean;
  hasTwoStep: boolean;
  hasMfaChallenge: boolean;
}

// === HELPER: Capture auth failure evidence (no secrets) ===
async function captureAuthFailureEvidence(
  page: Page,
  reasonCode: AuthFailureReasonCode,
  observations: AuthObservations
): Promise<void> {
  const outDir = getOutDir();

  try {
    // Capture screenshot
    await page.screenshot({ path: path.join(outDir, 'auth-failure.png') });
  } catch (err) {
    console.log(`[AUTH] Warning: failed to capture screenshot - ${(err as Error).message}`);
  }

  try {
    // Capture HTML content
    const content = await page.content();
    fs.writeFileSync(path.join(outDir, 'auth-failure.html'), content, 'utf-8');
  } catch (err) {
    console.log(`[AUTH] Warning: failed to capture HTML - ${(err as Error).message}`);
  }

  try {
    // Capture final URL
    const url = page.url();
    fs.writeFileSync(path.join(outDir, 'auth-failure-url.txt'), url, 'utf-8');
  } catch (err) {
    console.log(`[AUTH] Warning: failed to capture URL - ${(err as Error).message}`);
  }

  try {
    // Write reason code (no timestamps, deterministic)
    const reasonJson = {
      reasonCode,
      observations,
    };
    fs.writeFileSync(
      path.join(outDir, 'auth-failure-reason.json'),
      JSON.stringify(reasonJson, null, 2),
      'utf-8'
    );
    console.log(`[AUTH] Evidence captured: ${outDir}/auth-failure-reason.json (reasonCode: ${reasonCode})`);
  } catch (err) {
    console.log(`[AUTH] Warning: failed to write reason JSON - ${(err as Error).message}`);
  }
}

// === HELPER: Detect login page variant and SSO/MFA indicators ===
async function detectLoginVariant(page: Page): Promise<AuthObservations> {
  const url = new URL(page.url());
  const hasAtlassianIdHost = url.host.includes('id.atlassian.com') || url.host.includes('login.atlassian.com');

  // Check for email/username inputs
  const hasEmailInput =
    (await page.locator('input[type="email"]').count()) > 0 ||
    (await page.locator('input#username').count()) > 0 ||
    (await page.locator('input[name="username"]').count()) > 0 ||
    (await page.locator('input[name="email"]').count()) > 0 ||
    (await page.locator('input[autocomplete="username"]').count()) > 0;

  // Check for password input
  const hasPasswordInput =
    (await page.locator('input[type="password"]').count()) > 0 ||
    (await page.locator('input#password').count()) > 0 ||
    (await page.locator('input[name="password"]').count()) > 0 ||
    (await page.locator('input[autocomplete="current-password"]').count()) > 0;

  // Check for buttons
  const hasContinueButton =
    (await page.locator('button:has-text("Continue")').count()) > 0 ||
    (await page.locator('button:has-text("Next")').count()) > 0 ||
    (await page.locator('input[type="submit"]').count()) > 0;

  // Check for SSO indicators
  const hasSsoButtons =
    (await page.locator('button:has-text("Google")').count()) > 0 ||
    (await page.locator('button:has-text("Microsoft")').count()) > 0 ||
    (await page.locator('button:has-text("SSO")').count()) > 0 ||
    (await page.locator('button:has-text("organization")').count()) > 0 ||
    (await page.locator('text=/saml|sso|Continue with/i').count()) > 0;

  // Check for MFA/2FA indicators
  const hasTwoStep =
    (await page.locator('text=/two.?step|2fa|two-factor/i').count()) > 0 ||
    (await page.locator('text=/Verification code|OTP/i').count()) > 0;

  const hasMfaChallenge =
    (await page.locator('input[name="verification_code"]').count()) > 0 ||
    (await page.locator('input[name="otp"]').count()) > 0 ||
    (await page.locator('text=/Enter your authentication code|Authenticator/i').count()) > 0;

  // Check for CAPTCHA
  const hasCaptcha =
    (await page.locator('iframe[src*="recaptcha"]').count()) > 0 ||
    (await page.locator('text=/robot|captcha|verify/i').count()) > 0;

  return {
    hasAtlassianIdHost,
    hasEmailInput,
    hasPasswordInput,
    hasContinueButton,
    hasSsoButtons,
    hasTwoStep,
    hasMfaChallenge: hasMfaChallenge || hasCaptcha,
  };
}

// === HELPER: Try to find and fill email field (ordered fallback strategy) ===
async function findAndFillEmail(page: Page, email: string): Promise<boolean> {
  const emailSelectors = [
    { locator: page.locator('input[type="email"]'), name: 'input[type="email"]' },
    { locator: page.locator('input#username'), name: 'input#username' },
    { locator: page.locator('input[name="username"]'), name: 'input[name="username"]' },
    { locator: page.locator('input[name="email"]'), name: 'input[name="email"]' },
    { locator: page.locator('input[autocomplete="username"]'), name: 'input[autocomplete="username"]' },
  ];

  for (const { locator, name } of emailSelectors) {
    try {
      if ((await locator.count()) > 0) {
        const firstElement = locator.first();
        await firstElement.waitFor({ state: 'visible', timeout: 4000 });
        await firstElement.fill(email);
        console.log(`[AUTH] Email field found via selector: ${name}`);
        return true;
      }
    } catch (err) {
      // Selector not found or not visible, try next
      continue;
    }
  }

  return false;
}

// === HELPER: Try to find and click continue/next button ===
async function findAndClickContinue(page: Page): Promise<boolean> {
  const continueSelectors = [
    { locator: page.locator('button:has-text("Continue")'), name: 'button:has-text("Continue")' },
    { locator: page.locator('button:has-text("Next")'), name: 'button:has-text("Next")' },
    { locator: page.locator('input[type="submit"]').first(), name: 'input[type="submit"]' },
  ];

  for (const { locator, name } of continueSelectors) {
    try {
      if ((await locator.count()) > 0) {
        await locator.waitFor({ state: 'visible', timeout: 4000 });
        await locator.click();
        console.log(`[AUTH] Continue button clicked via selector: ${name}`);
        return true;
      }
    } catch (err) {
      continue;
    }
  }

  return false;
}

// === HELPER: Try to find and fill password field ===
async function findAndFillPassword(page: Page, password: string): Promise<boolean> {
  const passwordSelectors = [
    { locator: page.locator('input[type="password"]'), name: 'input[type="password"]' },
    { locator: page.locator('input#password'), name: 'input#password' },
    { locator: page.locator('input[name="password"]'), name: 'input[name="password"]' },
    { locator: page.locator('input[autocomplete="current-password"]'), name: 'input[autocomplete="current-password"]' },
  ];

  for (const { locator, name } of passwordSelectors) {
    try {
      if ((await locator.count()) > 0) {
        const firstElement = locator.first();
        await firstElement.waitFor({ state: 'visible', timeout: 4000 });
        await firstElement.fill(password);
        console.log(`[AUTH] Password field found via selector: ${name}`);
        return true;
      }
    } catch (err) {
      continue;
    }
  }

  return false;
}

// === HELPER: Try to find and click login/submit button ===
async function findAndClickLogin(page: Page): Promise<boolean> {
  const loginSelectors = [
    { locator: page.locator('button:has-text("Log in")'), name: 'button:has-text("Log in")' },
    { locator: page.locator('button:has-text("Sign in")'), name: 'button:has-text("Sign in")' },
    { locator: page.locator('input[type="submit"]').first(), name: 'input[type="submit"]' },
  ];

  for (const { locator, name } of loginSelectors) {
    try {
      if ((await locator.count()) > 0) {
        await locator.waitFor({ state: 'visible', timeout: 4000 });
        await locator.click();
        console.log(`[AUTH] Login button clicked via selector: ${name}`);
        return true;
      }
    } catch (err) {
      continue;
    }
  }

  return false;
}

setup('auth', async ({ page }) => {
  const baseUrl = process.env.JIRA_BASE_URL;
  if (!baseUrl) throw new Error('Missing JIRA_BASE_URL');

  // === Normalize base URL (remove trailing slash) ===
  const baseUrlNorm = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

  const expectedUrl = 'https://firsttry.atlassian.net';
  if (baseUrlNorm !== expectedUrl) {
    throw new Error(
      `JIRA_BASE_URL must equal exactly '${expectedUrl}', got '${baseUrlNorm}'`
    );
  }

  // === Ensure .auth directory exists ===
  const statePath = 'tests/playwright/.auth/state.json';
  const authDir = path.dirname(statePath);
  fs.mkdirSync(authDir, { recursive: true });

  // === BACKBONE FIX: Use FT_PLAYWRIGHT_MODE to control headless/headed launching ===
  const mode = process.env.FT_PLAYWRIGHT_MODE || 'headless';
  const headless = mode !== 'headed';
  console.log('[AUTH_MODE]', JSON.stringify({ mode, headless }));

  // === BACKBONE FIX 1: Try to reuse valid state.json (skip MFA if possible) ===
  if (fs.existsSync(statePath)) {
    const statSize = fs.statSync(statePath).size;
    if (statSize >= 10) {
      console.log(`[AUTH] Found existing state.json (${statSize} bytes) - attempting reuse...`);

      try {
        // Create a new context with the stored state
        const testBrowser = await chromium.launch({ headless });
        const testContext = await testBrowser.newContext({ storageState: statePath });
        const testPage = await testContext.newPage();

        // Navigate and verify auth
        const jiraRoute = `${baseUrlNorm}/jira/your-work`;
        await testPage.goto(jiraRoute, { waitUntil: 'domcontentloaded' });

        // Call /myself API to verify state is still valid
        const resp = await testPage.request.get(`${baseUrlNorm}/rest/api/3/myself`);
        const statusCode = resp.status();
        console.log(`[AUTH_REUSE_CHECK] /myself API status: ${statusCode}`);

        // Clean up test context/browser
        await testContext.close();
        await testBrowser.close();

        if (statusCode === 200) {
          // State is valid!
          console.log('[AUTH] ✓ AUTH_STATE_REUSED_OK - stored credentials are still valid');
          console.log(`AUTH_STATE_SAVED: ${statePath}`);
          return; // Exit setup successfully WITHOUT logging in again
        } else {
          // State is stale
          console.log(`[AUTH] AUTH_STATE_REUSE_FAILED status=${statusCode} → deleting stale state.json`);
          fs.unlinkSync(statePath);
          // Continue into normal login flow below
        }
      } catch (err) {
        // Error during reuse check - delete state and proceed with login
        console.log(`[AUTH] AUTH_STATE_REUSE_CHECK_ERROR: ${(err as Error).message} → deleting state and logging in`);
        if (fs.existsSync(statePath)) {
          fs.unlinkSync(statePath);
        }
        // Continue into normal login flow below
      }
    }
  }
  console.log('[AUTH] No valid cached state found; proceeding with login...');

  // === Helper: Prove Jira authentication (strict fail-closed) ===
  async function proveJiraAuthentication(): Promise<void> {
    // 1) Verify URL starts with baseUrl/jira/
    const currentUrl = page.url();
    if (!currentUrl.startsWith(`${baseUrlNorm}/jira/`)) {
      throw new Error(
        `FATAL: Jira authentication proof failed (url not under /jira/: ${currentUrl})`
      );
    }
    console.log('[AUTH_PROOF] URL verified: starts with /jira/');

    // 2) Call Jira REST API /rest/api/3/myself and require 200 (primary proof)
    const resp = await page.request.get(`${baseUrlNorm}/rest/api/3/myself`);
    const statusCode = resp.status();
    console.log(`[AUTH_PROOF] Jira /myself API status: ${statusCode}`);

    if (statusCode !== 200) {
      // Capture screenshot for debugging
      try {
        await page.screenshot({ path: path.join(getOutDir(), 'auth-failure.png') });
      } catch (err) {
        // Ignore screenshot errors
      }
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

  try {
    // === Navigate to deterministic Jira route ===
    const jiraRoute = `${baseUrlNorm}/jira/your-work`;
    console.log(`[AUTH] Navigating to ${jiraRoute}`);
    await page.goto(jiraRoute, { waitUntil: 'domcontentloaded' });

    // === Check if login is required (check URL AND API status) ===
    let currentUrl = page.url();
    let isLoginRequired = !currentUrl.startsWith(`${baseUrlNorm}/jira/`);

    // === If at Jira URL, verify authentication with API ===
    let apiStatus = 0;
    if (!isLoginRequired) {
      try {
        const resp = await page.request.get(`${baseUrlNorm}/rest/api/3/myself`);
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
      // Detect current login page variant
      const variant = await detectLoginVariant(page);
      console.log(`[AUTH] Login page detected - variant detection: ${JSON.stringify(variant)}`);

      // === Check for SSO-only (no username/password inputs) ===
      if (variant.hasSsoButtons && !variant.hasEmailInput && !variant.hasPasswordInput) {
        console.log('[AUTH] SSO-only login detected (no email/password inputs)');
        await captureAuthFailureEvidence(page, 'SSO_REQUIRED', variant);
        throw new Error('SSO_REQUIRED: This instance requires single sign-on (no direct email/password login available)');
      }

      // === Check for MFA challenge ===
      if (variant.hasMfaChallenge) {
        console.log('[AUTH] MFA challenge detected (requires 2FA/OTP)');
        await captureAuthFailureEvidence(page, 'MFA_REQUIRED', variant);
        throw new Error('MFA_REQUIRED: This login requires multi-factor authentication (OTP/Authenticator). Manual intervention needed.');
      }

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
            const resp = await page.request.get(`${baseUrlNorm}/rest/api/3/myself`);
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
          const variant = await detectLoginVariant(page);
          await captureAuthFailureEvidence(page, 'UNKNOWN_LOGIN_VARIANT', variant);
          throw new Error(
            `FATAL: Manual login not completed within 600s (myself status=${lastStatus})`
          );
        }

        console.log('[AUTH] ✓ Manual login polling succeeded');
      } else {
        // === Automated login mode ===
        console.log('[AUTH] Attempting automated login with provided credentials...');

        // Try to fill email field
        const emailFound = await findAndFillEmail(page, jiraEmail);
        if (!emailFound) {
          const variant = await detectLoginVariant(page);
          await captureAuthFailureEvidence(page, 'LOGIN_FORM_NOT_FOUND', variant);
          throw new Error('LOGIN_FORM_NOT_FOUND: Email input field not found (may be SSO variant, MFA challenge, or unknown login page)');
        }

        // Click continue/next button
        const continueFound = await findAndClickContinue(page);
        if (!continueFound) {
          const variant = await detectLoginVariant(page);
          await captureAuthFailureEvidence(page, 'LOGIN_FORM_NOT_FOUND', variant);
          throw new Error('LOGIN_FORM_NOT_FOUND: Continue button not found');
        }

        // Wait for password page or secondary flow
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(2000);

        // Detect again after email submission
        const variantAfterEmail = await detectLoginVariant(page);

        // === Check if MFA appeared after email ===
        if (variantAfterEmail.hasMfaChallenge) {
          console.log('[AUTH] MFA challenge detected after email entry');
          await captureAuthFailureEvidence(page, 'MFA_REQUIRED', variantAfterEmail);
          throw new Error('MFA_REQUIRED: Multi-factor authentication required (cannot automate OTP/Authenticator)');
        }

        // Try to fill password field
        const passwordFound = await findAndFillPassword(page, jiraPassword);
        if (!passwordFound) {
          const variant = await detectLoginVariant(page);
          await captureAuthFailureEvidence(page, 'LOGIN_FORM_NOT_FOUND', variant);
          throw new Error('LOGIN_FORM_NOT_FOUND: Password input field not found');
        }

        // Click login/submit button
        const loginFound = await findAndClickLogin(page);
        if (!loginFound) {
          const variant = await detectLoginVariant(page);
          await captureAuthFailureEvidence(page, 'LOGIN_FORM_NOT_FOUND', variant);
          throw new Error('LOGIN_FORM_NOT_FOUND: Login/submit button not found');
        }

        // Wait for Jira dashboard to load
        console.log('[AUTH] Waiting for Jira dashboard...');
        try {
          await page.waitForURL(`${baseUrlNorm}/jira/**`, { timeout: 30_000 });
        } catch (err) {
          // Timeout or navigation failed
          const variant = await detectLoginVariant(page);
          const currentUrl = page.url();

          // Check if we got login error page
          if (currentUrl.includes('error') || currentUrl.includes('login')) {
            await captureAuthFailureEvidence(page, 'INVALID_CREDENTIALS', variant);
            throw new Error('INVALID_CREDENTIALS: Login failed (possibly invalid email/password)');
          }

          // Unknown error after login attempt
          await captureAuthFailureEvidence(page, 'UNKNOWN_LOGIN_VARIANT', variant);
          throw new Error(`UNKNOWN_LOGIN_VARIANT: Expected Jira URL but got: ${currentUrl}`);
        }
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
    console.log('[AUTH_OK]', JSON.stringify({ usedStateReuse: false, finalHost: page.url() }));
  } catch (err) {
    // On any error, ensure we've captured evidence
    const errorMessage = (err as Error).message || String(err);

    // Extract reason code from error message if present
    const reasonCodes: AuthFailureReasonCode[] = [
      'SSO_REQUIRED',
      'MFA_REQUIRED',
      'LOGIN_FORM_NOT_FOUND',
      'INVALID_CREDENTIALS',
      'UNKNOWN_LOGIN_VARIANT',
    ];

    let extractedReason: AuthFailureReasonCode = 'UNKNOWN_LOGIN_VARIANT';
    for (const code of reasonCodes) {
      if (errorMessage.includes(code)) {
        extractedReason = code;
        break;
      }
    }

    // Make sure we have evidence captured
    try {
      const variant = await detectLoginVariant(page);
      const outDir = getOutDir();
      const reasonFile = path.join(outDir, 'auth-failure-reason.json');

      // Only capture if not already done
      if (!fs.existsSync(reasonFile)) {
        await captureAuthFailureEvidence(page, extractedReason, variant);
      }
    } catch (captureErr) {
      console.log(`[AUTH] Warning: failed to capture evidence on failure - ${(captureErr as Error).message}`);
    }

    throw err;  // Re-throw the original error
  }
});
