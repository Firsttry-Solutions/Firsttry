import { test as setup } from '@playwright/test';
import { chromium, Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

// === CONSTANTS ===
const AUTH_SETUP_TIMEOUT_MS = 120_000; // 120s fixed, deterministic (outer guard)
const AUTH_INTERACTIVE_MAX_SECONDS = parseInt(process.env.FT_AUTH_INTERACTIVE_MAX_SECONDS || '25', 10); // 25s fail-fast window for bot-guard/MFA
const AUTH_MODE = (process.env.FT_AUTH_MODE || 'state-first') as 'state-first' | 'state-only' | 'interactive'; // state-first (default), state-only, interactive

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
  | 'AUTH_SETUP_TIMEOUT'
  | 'AUTH_STATE_REQUIRED'
  | 'UNKNOWN_LOGIN_VARIANT';

type AuthMode = 'state-first' | 'state-only' | 'interactive';

interface AuthObservations {
  hasAtlassianIdHost: boolean;
  hasEmailInput: boolean;
  hasPasswordInput: boolean;
  hasContinueButton: boolean;
  hasSsoButtons: boolean;
  hasTwoStep: boolean;
  hasMfaChallenge: boolean;
  finalUrlHost?: string;
  frameHosts?: string[];
}

interface AuthFailureEvidence {
  reasonCode: AuthFailureReasonCode;
  observations: AuthObservations & { finalUrlHost?: string; frameHosts?: string[] };
  authMode: AuthMode;
  stateReuseAttempted: boolean;
  stateReuseSucceeded: boolean;
}

// === HELPER: Build Atlassian ID login URL with continue parameter ===
function buildAtlassianIdLoginUrl(baseUrlNorm: string): string {
  const continueUrl = `${baseUrlNorm}/jira/your-work`;
  const encodedContinue = encodeURIComponent(continueUrl);
  return `https://id.atlassian.com/login?continue=${encodedContinue}`;
}

// === HELPER: Find visible locator across main frame and iframes ===
interface FrameLocatorResult {
  frameUrl: string;
  selector: string;
  locator: any; // Playwright Locator type
}

async function findVisibleLocatorAcrossFrames(
  page: Page,
  selectors: string[]
): Promise<FrameLocatorResult | null> {
  // Try main frame first
  for (const selector of selectors) {
    try {
      const locator = page.locator(selector).first();
      if ((await locator.count()) > 0 && await locator.isVisible({ timeout: 1500 })) {
        return {
          frameUrl: page.url(),
          selector,
          locator,
        };
      }
    } catch (err) {
      // Continue to next selector
    }
  }

  // Try all child frames in DOM order
  try {
    const frames = page.frames();
    for (const frame of frames) {
      if (frame === page.mainFrame()) continue; // Skip main frame (already tried)

      for (const selector of selectors) {
        try {
          const locator = frame.locator(selector).first();
          if ((await locator.count()) > 0 && await locator.isVisible({ timeout: 1500 })) {
            return {
              frameUrl: frame.url(),
              selector,
              locator,
            };
          }
        } catch (err) {
          // Continue to next selector or frame
        }
      }
    }
  } catch (err) {
    console.log(`[AUTH] Warning: frame enumeration error - ${(err as Error).message}`);
  }

  return null;
}


// === HELPER: Capture auth failure evidence (no secrets) ===
async function captureAuthFailureEvidence(
  page: Page,
  reasonCode: AuthFailureReasonCode,
  observations: AuthObservations,
  authMode: AuthMode = 'state-first',
  stateReuseAttempted: boolean = false,
  stateReuseSucceeded: boolean = false
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
    // Write reason code with frame info (no timestamps, deterministic)
    const finalUrlHost = new URL(page.url()).host;
    const reasonJson: AuthFailureEvidence = {
      reasonCode,
      observations: {
        ...observations,
        finalUrlHost,
      },
      authMode,
      stateReuseAttempted,
      stateReuseSucceeded,
    };
    
    // Add unique sorted frame hosts if available
    if (observations.frameHosts && observations.frameHosts.length > 0) {
      reasonJson.observations.frameHosts = Array.from(new Set(observations.frameHosts)).sort();
    }
    
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

// === HELPER: Detect login page variant and SSO/MFA indicators (frame-aware) ===
async function detectLoginVariant(page: Page): Promise<AuthObservations> {
  const url = new URL(page.url());
  const mainHostIsAtlassianId = url.host.includes('id.atlassian.com') || url.host.includes('login.atlassian.com');

  // Collect all frame URLs for observations
  const frameHosts: string[] = [];
  try {
    const frames = page.frames();
    for (const frame of frames) {
      try {
        const frameUrl = frame.url();
        const frameHost = new URL(frameUrl).host;
        frameHosts.push(frameHost);
      } catch (err) {
        // Skip frames with invalid URLs
      }
    }
  } catch (err) {
    // Ignore frame enumeration errors
  }

  // Check if any frame is Atlassian ID
  const hasAtlassianIdHost =
    mainHostIsAtlassianId ||
    frameHosts.some(host => host.includes('id.atlassian.com') || host.includes('login.atlassian.com'));

  // Check for email/username inputs (main + frames)
  let hasEmailInput = false;
  const emailSelectors = [
    'input[type="email"]',
    'input#username',
    'input[name="username"]',
    'input[name="email"]',
    'input[autocomplete="username"]',
  ];
  const emailResult = await findVisibleLocatorAcrossFrames(page, emailSelectors);
  hasEmailInput = emailResult !== null;

  // Check for password input (main + frames)
  let hasPasswordInput = false;
  const passwordSelectors = [
    'input[type="password"]',
    'input#password',
    'input[name="password"]',
    'input[autocomplete="current-password"]',
  ];
  const passwordResult = await findVisibleLocatorAcrossFrames(page, passwordSelectors);
  hasPasswordInput = passwordResult !== null;

  // Check for continue/next button (main + frames)
  let hasContinueButton = false;
  const continueSelectors = [
    'button:has-text("Continue")',
    'button:has-text("Next")',
    'input[type="submit"]',
  ];
  const continueResult = await findVisibleLocatorAcrossFrames(page, continueSelectors);
  hasContinueButton = continueResult !== null;

  // Check for SSO indicators in main content
  let hasSsoButtons = false;
  try {
    const mainContent = await page.content();
    if (
      mainContent.includes('Google') ||
      mainContent.includes('Microsoft') ||
      mainContent.includes('SSO') ||
      mainContent.includes('organization') ||
      /saml|sso|Continue with/i.test(mainContent)
    ) {
      hasSsoButtons = true;
    }
  } catch (err) {
    // Ignore content fetch errors
  }

  // Check for MFA/2FA indicators in main content
  let hasTwoStep = false;
  let hasMfaChallenge = false;
  try {
    const mainContent = await page.content();
    if (/two.?step|2fa|two-factor|Verification code|OTP/i.test(mainContent)) {
      hasTwoStep = true;
    }
    if (
      /Enter your authentication code|Authenticator/i.test(mainContent) ||
      mainContent.includes('verification_code') ||
      mainContent.includes('otp')
    ) {
      hasMfaChallenge = true;
    }

    // Check for CAPTCHA
    if (mainContent.includes('recaptcha') || /robot|captcha|verify/i.test(mainContent)) {
      hasMfaChallenge = true;
    }
  } catch (err) {
    // Ignore content fetch errors
  }

  return {
    hasAtlassianIdHost,
    hasEmailInput,
    hasPasswordInput,
    hasContinueButton,
    hasSsoButtons,
    hasTwoStep,
    hasMfaChallenge,
    frameHosts: frameHosts.length > 0 ? frameHosts : undefined,
  };
}


// === HELPER: Try to find and fill email field (frame-aware) ===
async function findAndFillEmail(page: Page, email: string): Promise<boolean> {
  const emailSelectors = [
    'input[type="email"]',
    'input#username',
    'input[name="username"]',
    'input[name="email"]',
    'input[autocomplete="username"]',
  ];

  const result = await findVisibleLocatorAcrossFrames(page, emailSelectors);
  if (result) {
    try {
      await result.locator.fill(email);
      console.log(`[AUTH] Email field found and filled via: ${result.selector} (frame: ${result.frameUrl})`);
      return true;
    } catch (err) {
      console.log(`[AUTH] Failed to fill email field - ${(err as Error).message}`);
      return false;
    }
  }

  return false;
}

// === HELPER: Try to find and click continue/next button (frame-aware) ===
async function findAndClickContinue(page: Page): Promise<boolean> {
  const continueSelectors = [
    'button:has-text("Continue")',
    'button:has-text("Next")',
    'input[type="submit"]',
  ];

  const result = await findVisibleLocatorAcrossFrames(page, continueSelectors);
  if (result) {
    try {
      await result.locator.click();
      console.log(`[AUTH] Continue button clicked via: ${result.selector} (frame: ${result.frameUrl})`);
      return true;
    } catch (err) {
      console.log(`[AUTH] Failed to click continue - ${(err as Error).message}`);
      return false;
    }
  }

  return false;
}

// === HELPER: Try to find and fill password field (frame-aware) ===
async function findAndFillPassword(page: Page, password: string): Promise<boolean> {
  const passwordSelectors = [
    'input[type="password"]',
    'input#password',
    'input[name="password"]',
    'input[autocomplete="current-password"]',
  ];

  const result = await findVisibleLocatorAcrossFrames(page, passwordSelectors);
  if (result) {
    try {
      await result.locator.fill(password);
      console.log(`[AUTH] Password field found and filled via: ${result.selector} (frame: ${result.frameUrl})`);
      return true;
    } catch (err) {
      console.log(`[AUTH] Failed to fill password field - ${(err as Error).message}`);
      return false;
    }
  }

  return false;
}

// === HELPER: Try to find and click login/submit button (frame-aware) ===
async function findAndClickLogin(page: Page): Promise<boolean> {
  const loginSelectors = [
    'button:has-text("Log in")',
    'button:has-text("Sign in")',
    'input[type="submit"]',
  ];

  const result = await findVisibleLocatorAcrossFrames(page, loginSelectors);
  if (result) {
    try {
      await result.locator.click();
      console.log(`[AUTH] Login button clicked via: ${result.selector} (frame: ${result.frameUrl})`);
      return true;
    } catch (err) {
      console.log(`[AUTH] Failed to click login - ${(err as Error).message}`);
      return false;
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

  // === State reuse tracking ===
  let stateReuseAttempted = false;
  let stateReuseSucceeded = false;

  // === BACKBONE FIX 1: Try to reuse valid state.json (skip MFA if possible) ===
  if (fs.existsSync(statePath)) {
    const statSize = fs.statSync(statePath).size;
    if (statSize >= 10) {
      stateReuseAttempted = true;
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
          stateReuseSucceeded = true;
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

  // === PHASE 6: Mode-aware branching after state reuse check ===
  if (!stateReuseSucceeded) {
    // State reuse was not successful (either not attempted or failed)
    
    if (AUTH_MODE === 'state-only') {
      // Fail-closed: state-only mode requires valid cached state
      console.log('[AUTH] Fail-closed: state-only mode activated but no valid state available');
      
      let failureVariant: AuthObservations = {
        hasAtlassianIdHost: false,
        hasEmailInput: false,
        hasPasswordInput: false,
        hasContinueButton: false,
        hasSsoButtons: false,
        hasTwoStep: false,
        hasMfaChallenge: false,
        frameHosts: [],
      };

      try {
        // Try to capture page state for evidence
        await page.goto(`${baseUrlNorm}/jira/your-work`, { waitUntil: 'domcontentloaded' });
        failureVariant = await detectLoginVariant(page);
      } catch (err) {
        console.log(`[AUTH] Note: Could not capture variant on state-only failure: ${(err as Error).message}`);
      }

      await captureAuthFailureEvidence(
        page,
        'AUTH_STATE_REQUIRED',
        failureVariant,
        'state-only',
        stateReuseAttempted,
        stateReuseSucceeded
      );

      throw new Error(
        'AUTH_STATE_REQUIRED: state-only mode requires valid cached state, but no valid state exists. ' +
        'Run with FT_AUTH_MODE=interactive to attempt login.'
      );
    }

    // If state-first or interactive, fall through to interactive login below
    console.log(`[AUTH] State reuse unsuccessful; proceeding to interactive login (authMode: ${AUTH_MODE})`);
  }

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

  // === Helper: Perform authentication with timeout protection ===
  async function performAuthFlow(): Promise<void> {
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
        // === Force Atlassian ID login entry point (deterministic) ===
        const atlassianIdUrl = buildAtlassianIdLoginUrl(baseUrlNorm);
        console.log(`[AUTH] Forcing Atlassian ID login entry: ${atlassianIdUrl}`);
        await page.goto(atlassianIdUrl, { waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('networkidle');

        // === PHASE 6: Fail-fast detection for bot-guard/MFA/CAPTCHA (state-first mode optimization) ===
        // Poll for login variant with early exit on bot-guard/MFA detection
        const failFastDeadline = Date.now() + (AUTH_INTERACTIVE_MAX_SECONDS * 1000);
        const pollIntervalMs = 500;
        let variant = await detectLoginVariant(page);
        
        console.log(`[AUTH] Fail-fast window: checking for bot-guard/MFA for up to ${AUTH_INTERACTIVE_MAX_SECONDS}s`);

        // Poll loop: detect MFA/CAPTCHA/bot-guard early and fail immediately
        while (Date.now() < failFastDeadline) {
          // Check for MFA challenge (requires manual intervention)
          if (variant.hasMfaChallenge) {
            console.log('[AUTH] [FAIL-FAST] MFA challenge detected early (will not wait 120s)');
            await captureAuthFailureEvidence(page, 'MFA_REQUIRED', variant, AUTH_MODE, stateReuseAttempted, stateReuseSucceeded);
            throw new Error('MFA_REQUIRED: Multi-factor authentication required. Use FT_AUTH_MODE=state-only with valid cached state or set JIRA_EMAIL/JIRA_PASSWORD=empty for manual login.');
          }

          // Check if we found acceptable login form (email input visible)
          if (variant.hasEmailInput && variant.hasContinueButton) {
            console.log('[AUTH] [FAIL-FAST] Login form found, exiting fail-fast window');
            break; // Exit polling loop, proceed with login
          }

          // Not ready yet, poll again after brief delay
          const remainingMs = failFastDeadline - Date.now();
          if (remainingMs > 0) {
            await page.waitForTimeout(Math.min(pollIntervalMs, remainingMs));
            variant = await detectLoginVariant(page); // Re-detect for next iteration
          } else {
            break; // Deadline reached
          }
        }

        console.log(`[AUTH] Login page detected - variant detection: ${JSON.stringify(variant)}`);

        // === Check for SSO-only (no username/password inputs) ===
        if (variant.hasSsoButtons && !variant.hasEmailInput && !variant.hasPasswordInput) {
          console.log('[AUTH] SSO-only login detected (no email/password inputs)');
          await captureAuthFailureEvidence(page, 'SSO_REQUIRED', variant, AUTH_MODE, stateReuseAttempted, stateReuseSucceeded);
          throw new Error('SSO_REQUIRED: This instance requires single sign-on (no direct email/password login available)');
        }

        // === Check for MFA challenge ===
        if (variant.hasMfaChallenge) {
          console.log('[AUTH] MFA challenge detected (requires 2FA/OTP)');
          await captureAuthFailureEvidence(page, 'MFA_REQUIRED', variant, AUTH_MODE, stateReuseAttempted, stateReuseSucceeded);
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
            await captureAuthFailureEvidence(page, 'UNKNOWN_LOGIN_VARIANT', variant, AUTH_MODE, stateReuseAttempted, stateReuseSucceeded);
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
            await captureAuthFailureEvidence(page, 'LOGIN_FORM_NOT_FOUND', variant, AUTH_MODE, stateReuseAttempted, stateReuseSucceeded);
            throw new Error('LOGIN_FORM_NOT_FOUND: Email input field not found (may be SSO variant, MFA challenge, or unknown login page)');
          }

          // Click continue/next button
          const continueFound = await findAndClickContinue(page);
          if (!continueFound) {
            const variant = await detectLoginVariant(page);
            await captureAuthFailureEvidence(page, 'LOGIN_FORM_NOT_FOUND', variant, AUTH_MODE, stateReuseAttempted, stateReuseSucceeded);
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
            await captureAuthFailureEvidence(page, 'MFA_REQUIRED', variantAfterEmail, AUTH_MODE, stateReuseAttempted, stateReuseSucceeded);
            throw new Error('MFA_REQUIRED: Multi-factor authentication required (cannot automate OTP/Authenticator)');
          }

          // Try to fill password field
          const passwordFound = await findAndFillPassword(page, jiraPassword);
          if (!passwordFound) {
            const variant = await detectLoginVariant(page);
            await captureAuthFailureEvidence(page, 'LOGIN_FORM_NOT_FOUND', variant, AUTH_MODE, stateReuseAttempted, stateReuseSucceeded);
            throw new Error('LOGIN_FORM_NOT_FOUND: Password input field not found');
          }

          // Click login/submit button
          const loginFound = await findAndClickLogin(page);
          if (!loginFound) {
            const variant = await detectLoginVariant(page);
            await captureAuthFailureEvidence(page, 'LOGIN_FORM_NOT_FOUND', variant, AUTH_MODE, stateReuseAttempted, stateReuseSucceeded);
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
              await captureAuthFailureEvidence(page, 'INVALID_CREDENTIALS', variant, AUTH_MODE, stateReuseAttempted, stateReuseSucceeded);
              throw new Error('INVALID_CREDENTIALS: Login failed (possibly invalid email/password)');
            }

            // Unknown error after login attempt
            await captureAuthFailureEvidence(page, 'UNKNOWN_LOGIN_VARIANT', variant, AUTH_MODE, stateReuseAttempted, stateReuseSucceeded);
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
        'AUTH_SETUP_TIMEOUT',
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
          await captureAuthFailureEvidence(page, extractedReason, variant, AUTH_MODE, stateReuseAttempted, stateReuseSucceeded);
        }
      } catch (captureErr) {
        console.log(`[AUTH] Warning: failed to capture evidence on failure - ${(captureErr as Error).message}`);
      }

      throw err;  // Re-throw the original error
    }
  }

  // === HELPER: Simple delay utility (deterministic, not logged) ===
  async function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // === HELPER: Auth flow with timeout protection ===
  async function authFlowWithTimeout(): Promise<void> {
    return await Promise.race([
      performAuthFlow(),
      (async () => {
        // Wait for timeout duration
        await delay(AUTH_SETUP_TIMEOUT_MS);
        
        // CRITICAL: MUST await evidence capture before throwing
        // This ensures page context is not torn down mid-capture
        try {
          const variant = await detectLoginVariant(page);
          await captureAuthFailureEvidence(page, 'AUTH_SETUP_TIMEOUT', variant, AUTH_MODE, stateReuseAttempted, stateReuseSucceeded);
        } catch (captureErr) {
          console.log(`[AUTH_TIMEOUT] Warning: failed to capture timeout evidence - ${(captureErr as Error).message}`);
        }
        
        // Throw AFTER evidence is captured
        throw new Error('AUTH_SETUP_TIMEOUT: Authentication setup exceeded 120s timeout');
      })(),
    ]);
  }

  // === Wrap auth flow with timeout protection ===
  try {
    await authFlowWithTimeout();
  } catch (err) {
    // If it's a timeout error, it's already captured above
    if ((err as Error).message.includes('AUTH_SETUP_TIMEOUT')) {
      console.log('[AUTH] Timeout occurred during auth setup');
      throw err;
    }
    // Otherwise, let the performAuthFlow error handling take care of it
    throw err;
  }
});
