/**
 * Marketplace screenshot capture test.
 *
 * Captures 3 real screenshots of the running Forge app for Atlassian
 * Marketplace submission.  Each image is saved to
 *   <repo-root>/docs/marketplace/screenshots/
 *
 * Supports two modes — set exactly one:
 *
 * MODE A — Jira Dashboard Gadget (this app):
 *   Required:
 *     JIRA_DASHBOARD_URL  e.g. https://firsttry.atlassian.net/jira/dashboards/10102
 *     JIRA_EMAIL          Atlassian account email
 *     JIRA_PASSWORD       Atlassian account password
 *   Optional:
 *     PLAYWRIGHT_STORAGE_STATE_PATH  path to cached auth state JSON (skips login)
 *
 * MODE B — Direct URL app (Forge full-page / custom tunnel):
 *   Required:
 *     FORGE_TUNNEL_URL  direct HTTPS URL that renders the app without login
 */

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// ── Resolve repo root ────────────────────────────────────────────────────────

function findRepoRoot(): string {
  // 1. Honour explicit env override
  if (process.env.REPO_ROOT) {
    return process.env.REPO_ROOT;
  }

  // 2. Walk up from cwd looking for the top-level package.json
  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    const candidate = path.join(dir, 'package.json');
    if (fs.existsSync(candidate)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(candidate, 'utf8'));
        if (typeof pkg.name === 'string' && pkg.name.toLowerCase() === 'firsttry') {
          return dir;
        }
      } catch {
        // malformed JSON — keep climbing
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break; // filesystem root
    dir = parent;
  }

  // 3. Fallback: treat the forge-app directory's parent's parent as repo root
  //    cwd is typically <repo>/atlassian/forge-app when running via npx playwright
  return path.resolve(process.cwd(), '..', '..');
}

// ── Determine mode ────────────────────────────────────────────────────────────

const jiraDashboardUrl  = process.env.JIRA_DASHBOARD_URL || '';
const forgeTunnelUrl    = process.env.FORGE_TUNNEL_URL   || '';
const jiraEmail         = process.env.JIRA_EMAIL         || '';
const jiraPassword      = process.env.JIRA_PASSWORD      || '';
const storageStatePath  = process.env.PLAYWRIGHT_STORAGE_STATE_PATH || '';

const MODE: 'jira' | 'tunnel' | 'none' =
  jiraDashboardUrl ? 'jira' :
  forgeTunnelUrl   ? 'tunnel' :
  'none';

if (MODE === 'none') {
  throw new Error(
    'Set JIRA_DASHBOARD_URL (recommended for this dashboard gadget app) or\n' +
    'FORGE_TUNNEL_URL (for direct-URL apps).\n\n' +
    'For this app:\n' +
    '  export JIRA_DASHBOARD_URL="https://firsttry.atlassian.net/jira/dashboards/10102"\n' +
    '  export JIRA_EMAIL="your-email@example.com"\n' +
    '  export JIRA_PASSWORD="your-password"',
  );
}

if (MODE === 'jira' && !storageStatePath) {
  if (!jiraEmail || !jiraPassword) {
    throw new Error(
      'JIRA_DASHBOARD_URL is set but JIRA_EMAIL and JIRA_PASSWORD are required.\n' +
      '  export JIRA_EMAIL="your-email@example.com"\n' +
      '  export JIRA_PASSWORD="your-password"\n' +
      'Or supply cached auth state:\n' +
      '  export PLAYWRIGHT_STORAGE_STATE_PATH="tests/playwright/.auth/state.json"',
    );
  }
}

const repoRoot = findRepoRoot();
const screenshotsDir = path.join(repoRoot, 'docs', 'marketplace', 'screenshots');

// ── Utilities ────────────────────────────────────────────────────────────────

/** Disable all CSS transitions and animations for pixel-stable screenshots. */
async function disableAnimations(page: import('@playwright/test').Page): Promise<void> {
  await page.addStyleTag({
    content: `*, *::before, *::after {
      transition: none !important;
      animation: none !important;
      animation-duration: 0s !important;
      transition-duration: 0s !important;
    }`,
  });
}

/** Wait for app to reach visually stable state. */
async function waitForStable(page: import('@playwright/test').Page): Promise<void> {
  try {
    await page.waitForSelector('[data-testid="app-root"]', { timeout: 8_000 });
  } catch {
    await page.waitForSelector('body', { state: 'visible', timeout: 10_000 });
    await page.waitForTimeout(2_000);
  }
  await disableAnimations(page);
}

/** Navigate to Jira dashboard and wait for gadget iframe to appear. */
async function navigateToDashboard(
  page: import('@playwright/test').Page,
  dashboardUrl: string,
): Promise<void> {
  console.log(`[NAV] Navigating to dashboard: ${dashboardUrl}`);
  await page.goto(dashboardUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  try {
    await page.waitForSelector('[data-testid="dashboard"], #dashboard, .dashboard-content, iframe', {
      timeout: 20_000,
    });
  } catch {
    await page.waitForSelector('iframe', { timeout: 20_000 });
  }
  await page.waitForTimeout(3_000);
  await disableAnimations(page);
  console.log('[NAV] Dashboard loaded');
}

/** Perform Atlassian ID login; navigates to loginUrl, fills email+password. */
async function loginAtlassian(
  page: import('@playwright/test').Page,
  continueUrl: string,
  email: string,
  password: string,
): Promise<void> {
  const encodedContinue = encodeURIComponent(continueUrl);
  const loginUrl = `https://id.atlassian.com/login?continue=${encodedContinue}`;
  console.log(`[AUTH] Navigating to login: ${loginUrl}`);
  await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 });

  // ── Step 1: Fill email ──────────────────────────────────────────────────────
  // Atlassian Cloud uses #username (not type=email) in some tenants
  const emailSelectors = [
    'input[type="email"]',
    'input#username',
    'input[name="username"]',
    'input[name="email"]',
    'input[autocomplete="username"]',
  ].join(', ');
  await page.waitForSelector(emailSelectors, { timeout: 20_000 });
  await page.fill(emailSelectors, email);
  console.log(`[AUTH] Email filled: ${email}`);

  // ── Step 2: Click Continue ──────────────────────────────────────────────────
  const continueBtn = page.locator(
    'button:has-text("Continue"), button:has-text("Next"), button[type="submit"]',
  ).first();
  await continueBtn.click();
  console.log('[AUTH] Continue clicked');

  // ── Step 3: Wait for password field (appears after Continue on same or new page) ──
  const passwordSelectors = [
    'input[type="password"]',
    'input#password',
    'input[name="password"]',
    'input[autocomplete="current-password"]',
  ].join(', ');

  let passwordFieldFound = false;
  try {
    await page.waitForSelector(passwordSelectors, { timeout: 18_000 });
    passwordFieldFound = true;
  } catch {
    // Maybe already redirected to Jira (cached session / SSO)
    const cur = page.url();
    console.log(`[AUTH] No password field after 18s, current URL: ${cur}`);
    if (!cur.includes('id.atlassian.com')) {
      console.log('[AUTH] Redirected away from Atlassian ID — assuming authenticated');
      await page.waitForLoadState('domcontentloaded');
      return;
    }
    throw new Error(`[AUTH] Password field not found and still on login page: ${cur}`);
  }

  if (passwordFieldFound) {
    await page.fill(passwordSelectors, password);
    console.log('[AUTH] Password filled');

    // ── Step 4: Click Log in ────────────────────────────────────────────────
    const loginBtn = page.locator(
      'button:has-text("Log in"), button:has-text("Sign in"), button[type="submit"]',
    ).first();
    await loginBtn.click();
    console.log('[AUTH] Login button clicked, waiting for redirect away from id.atlassian.com...');

    // ── Step 5: Wait for navigation AWAY from id.atlassian.com ────────────────
    // IMPORTANT: do NOT use /atlassian\.net/ regexp — the login URL itself contains
    // `atlassian.net` inside the `?continue=` parameter and would match immediately.
    // Playwright's waitForURL callback receives a URL object, so use .href for string ops.
    await page.waitForURL(
      (url) => !url.href.includes('id.atlassian.com'),
      { timeout: 60_000 },
    );
    await page.waitForLoadState('domcontentloaded');
    console.log('[AUTH] Login complete, URL:', page.url());
  }
}

/** Try to click a labelled nav item; return true if URL changed. */
async function tryNavigate(
  page: import('@playwright/test').Page,
  labels: string[],
): Promise<boolean> {
  const urlBefore = page.url();
  for (const label of labels) {
    const selector = [
      `button:has-text("${label}")`,
      `a:has-text("${label}")`,
      `[role="tab"]:has-text("${label}")`,
      `[role="menuitem"]:has-text("${label}")`,
    ].join(', ');
    try {
      const el = page.locator(selector).first();
      if (await el.isVisible({ timeout: 2_000 })) {
        await el.click();
        await page.waitForTimeout(2_000);
        await disableAnimations(page);
        return page.url() !== urlBefore;
      }
    } catch { /* try next */ }
  }
  return false;
}

// ── Tests ────────────────────────────────────────────────────────────────────

test.describe('Marketplace Screenshots', () => {
  test.setTimeout(180_000);

  test('capture 3 marketplace screenshots', async ({ browser }) => {
    fs.mkdirSync(screenshotsDir, { recursive: true });

    // Use cached auth state if available
    const contextOptions: Parameters<typeof browser.newContext>[0] = {
      viewport: { width: 1440, height: 900 },
    };
    if (storageStatePath && fs.existsSync(storageStatePath)) {
      contextOptions.storageState = storageStatePath;
      console.log(`[INFO] Using cached auth state: ${storageStatePath}`);
    }

    const context = await browser.newContext(contextOptions);
    const page = await context.newPage();

    try {
      if (MODE === 'jira') {
        // ── MODE A: Jira Dashboard Gadget ────────────────────────────────────
        if (!storageStatePath || !fs.existsSync(storageStatePath)) {
          await loginAtlassian(page, jiraDashboardUrl, jiraEmail, jiraPassword);
        }

        // Screenshot 1: Full dashboard view
        await navigateToDashboard(page, jiraDashboardUrl);
        const shot1 = path.join(screenshotsDir, 'marketplace_01_main.png');
        await page.screenshot({ path: shot1, fullPage: false });
        const size1 = fs.statSync(shot1).size;
        console.log(`[OK] marketplace_01_main.png saved (${Math.round(size1 / 1024)} KB)`);
        expect(size1, 'marketplace_01_main.png must be >= 30 KB').toBeGreaterThanOrEqual(30_720);

        // Screenshot 2: Gadget iframe scrolled into view
        await page.goto(jiraDashboardUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 });
        await page.waitForTimeout(4_000);
        await disableAnimations(page);
        try {
          await page.locator('iframe').first().scrollIntoViewIfNeeded({ timeout: 5_000 });
          await page.waitForTimeout(1_500);
        } catch { /* no iframe, capture as-is */ }
        const shot2 = path.join(screenshotsDir, 'marketplace_02_evidence.png');
        await page.screenshot({ path: shot2, fullPage: false });
        const size2 = fs.statSync(shot2).size;
        console.log(`[OK] marketplace_02_evidence.png saved (${Math.round(size2 / 1024)} KB)`);
        expect(size2, 'marketplace_02_evidence.png must be >= 30 KB').toBeGreaterThanOrEqual(30_720);

        // Screenshot 3: Dashboard scrolled to bottom
        await page.goto(jiraDashboardUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 });
        await page.waitForTimeout(4_000);
        await disableAnimations(page);
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(1_000);
        const shot3 = path.join(screenshotsDir, 'marketplace_03_about.png');
        await page.screenshot({ path: shot3, fullPage: false });
        const size3 = fs.statSync(shot3).size;
        console.log(`[OK] marketplace_03_about.png saved (${Math.round(size3 / 1024)} KB)`);
        expect(size3, 'marketplace_03_about.png must be >= 30 KB').toBeGreaterThanOrEqual(30_720);

      } else {
        // ── MODE B: Direct URL (FORGE_TUNNEL_URL) ───────────────────────────
        const baseUrl = forgeTunnelUrl;

        // Screenshot 1: Main view
        await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 45_000 });
        await waitForStable(page);
        const shot1 = path.join(screenshotsDir, 'marketplace_01_main.png');
        await page.screenshot({ path: shot1, fullPage: false });
        const size1 = fs.statSync(shot1).size;
        console.log(`[OK] marketplace_01_main.png saved (${Math.round(size1 / 1024)} KB)`);
        expect(size1).toBeGreaterThanOrEqual(30_720);

        // Screenshot 2: Evidence/Snapshot or mid-scroll
        if (!await tryNavigate(page, ['Evidence', 'Snapshot', 'Drift', 'Audit'])) {
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
          await page.waitForTimeout(500);
          await disableAnimations(page);
        }
        const shot2 = path.join(screenshotsDir, 'marketplace_02_evidence.png');
        await page.screenshot({ path: shot2, fullPage: false });
        const size2 = fs.statSync(shot2).size;
        console.log(`[OK] marketplace_02_evidence.png saved (${Math.round(size2 / 1024)} KB)`);
        expect(size2).toBeGreaterThanOrEqual(30_720);

        // Screenshot 3: About/Settings or bottom-scroll
        await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 45_000 });
        await waitForStable(page);
        if (!await tryNavigate(page, ['About', 'Settings', 'Help', 'Info'])) {
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          await page.waitForTimeout(500);
          await disableAnimations(page);
        }
        const shot3 = path.join(screenshotsDir, 'marketplace_03_about.png');
        await page.screenshot({ path: shot3, fullPage: false });
        const size3 = fs.statSync(shot3).size;
        console.log(`[OK] marketplace_03_about.png saved (${Math.round(size3 / 1024)} KB)`);
        expect(size3).toBeGreaterThanOrEqual(30_720);
      }

      console.log('[OK] All 3 marketplace screenshots captured successfully');
      console.log(`[OK] Output directory: ${screenshotsDir}`);
    } finally {
      await context.close();
    }
  });
});
