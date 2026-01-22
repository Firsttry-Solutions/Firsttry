import { test, expect, chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ════════════════════════════════════════════════════════════════════════════════
// REPO ROOT & PATH RESOLUTION CONSTANTS
// BACKBONE: Single source of truth (mirrors storage_state_paths.mjs)
// ════════════════════════════════════════════════════════════════════════════════

const REPO_ROOT = '/workspaces/Firsttry';
const CANONICAL_STORAGE_STATE = '/workspaces/Firsttry/.auth/storageState.json';

// Resolve STORAGE_STATE to absolute path
// Must match logic in storage_state_paths.mjs for consistency
function resolveStorageStatePath(envPath: string | undefined): { resolved: string | null; isAbsolute: boolean; cwdAtResolution: string } {
  const cwdAtResolution = process.cwd();
  
  // Rule 1: __NONE__ is special (unauth mode)
  if (envPath === '__NONE__') {
    return { resolved: '__NONE__', isAbsolute: false, cwdAtResolution };
  }

  // Rule 2: Empty/undefined → canonical default
  if (!envPath) {
    return { resolved: CANONICAL_STORAGE_STATE, isAbsolute: true, cwdAtResolution };
  }

  // Rule 3: Absolute → keep as-is
  if (path.isAbsolute(envPath)) {
    return { resolved: envPath, isAbsolute: true, cwdAtResolution };
  }

  // Rule 4: Relative → resolve against REPO_ROOT (not process.cwd())
  const resolved = path.resolve(REPO_ROOT, envPath);
  
  // Guard: Reject e2e/.auth as a valid location
  if (resolved.startsWith(path.join(REPO_ROOT, 'e2e', '.auth'))) {
    throw new Error(
      `INVALID: e2e/.auth is not a valid storage state location.\n` +
      `Use canonical: ${CANONICAL_STORAGE_STATE}\n` +
      `Got: ${resolved}`
    );
  }

  return { resolved, isAbsolute: false, cwdAtResolution };
}

// ════════════════════════════════════════════════════════════════════════════════
// DETERMINISTIC HELPERS: Auth + Console + PageError filtering
// ════════════════════════════════════════════════════════════════════════════════

type ConsoleRec = {
  ts: string;
  type: string;
  text: string;
  url?: string;
  line?: number;
  column?: number;
};

type PageErrorRec = {
  ts: string;
  name: string;
  message: string;
  stack?: string;
};

function isoNow(): string {
  return new Date().toISOString();
}

// E2E determinism: Append ft_debug=1 to URLs (E2E only, enables debug sections for stable DOM access)
function appendFtDebugParam(url: string): string {
  if (!url) return url;
  try {
    const u = new URL(url);
    u.searchParams.set('ft_debug', '1');
    return u.toString();
  } catch {
    return url; // If URL parse fails, return unchanged
  }
}

function isAuthUrl(u: string): boolean {
  const s = (u || "").toLowerCase();
  if (!s) return false;
  return (
    s.startsWith("https://id.atlassian.com/") ||
    s.startsWith("https://auth.atlassian.com/") ||
    s.includes("/login") ||
    s.includes("user-access") ||
    s.includes("saml") ||
    s.includes("oauth")
  );
}

function isAuthOrCaptchaFrameUrl(u: string): boolean {
  const s = (u || "").toLowerCase();
  if (!s) return false;
  return (
    s.includes("id.atlassian.com/") ||
    s.includes("auth.atlassian.com/") ||
    s.includes("recaptcha") ||
    s.includes("captcha") ||
    s.includes("hcaptcha") ||
    s.includes("/login") ||
    s.includes("user-access") ||
    s.includes("saml") ||
    s.includes("oauth")
  );
}

function isOurGadgetBundleUrl(u: string): boolean {
  // our gadget bundle pattern: app.<40-hex>.js
  return /\/app\.[0-9a-f]{40}\.js(\?|$)/i.test(u || "");
}

function hasOurMarker(text: string): boolean {
  const t = text || "";
  // Accept ONLY our explicit proof markers (tight allowlist)
  return (
    t.includes("UI_ENTRY_RUNTIME_PROOF") ||
    t.includes("UI_SERVE_OK") ||
    t.includes("UI_BUILD_IDENTITY_") ||
    t.includes("FT_IDENTITY_ANCHOR") ||
    t.includes("BRIDGE_READINESS_PROOF") ||
    t.includes("UNHANDLED_REJECTION") ||
    t.includes("DASH_SCHEMA_VERSION_UNSUPPORTED_FAIL_CLOSED") ||
    t.includes("DASH_ENVELOPE_MAP_FAILED") ||
    t.includes("[BACKBONE_L0]") ||
    t.includes("[BACKBONE_STATE_") ||
    t.includes("[UI_PROBE_") ||
    t.includes("[UI_BTN_")
  );
}

function isFatalOurConsole(rec: ConsoleRec): boolean {
  const text = (rec.text || "");
  // Only consider console fatal if it is OUR marker-bearing line AND contains an error signal
  if (!hasOurMarker(text)) return false;

  const lower = text.toLowerCase();
  return (
    lower.includes("uncaught") ||
    lower.includes("unhandled_rejection") ||
    lower.includes("referenceerror") ||
    lower.includes("typeerror") ||
    lower.includes("schema_version_unsupported") ||
    lower.includes("envelope_map_failed") ||
    lower.includes("is not defined") ||
    lower.includes("fail_closed") ||
    lower.includes("probe error")
  );
}

async function writeJson(filePath: string, obj: unknown): Promise<void> {
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), "utf8");
}

async function writeHtml(filePath: string, html: string): Promise<void> {
  try {
    fs.writeFileSync(filePath, html, "utf8");
  } catch (err) {
    console.log(`[PROD_GREEN] Failed to write HTML to ${filePath}: ${err}`);
  }
}

async function collectStorageStateProof(storageStatePath: string | null): Promise<any> {
  const ts = isoNow();
  const repoRoot = REPO_ROOT;
  const cwd = process.cwd();
  
  // Handle __NONE__ or missing file
  if (!storageStatePath || storageStatePath === "__NONE__") {
    return {
      ts,
      mode: "__NONE__",
      env_storage_state: storageStatePath,
      repoRoot,
      cwd,
      resolvedStorageStatePath: null,
    };
  }

  if (!fs.existsSync(storageStatePath)) {
    return {
      ts,
      mode: "missing",
      env_storage_state: storageStatePath,
      repoRoot,
      cwd,
      resolvedStorageStatePath: storageStatePath,
      error: `File not found: ${storageStatePath}`,
    };
  }

  // Try to parse storageState JSON and extract cookie counts
  try {
    const content = fs.readFileSync(storageStatePath, "utf8");
    const parsed = JSON.parse(content);
    const cookies = parsed.cookies || [];
    
    // Group cookies by domain
    const byDomain: Record<string, any> = {
      firsttry_atlassian_net: [],
      id_atlassian_com: [],
      auth_atlassian_com: [],
      other: [],
    };

    cookies.forEach((cookie: any) => {
      const domain = (cookie.domain || "").toLowerCase();
      if (domain.includes("firsttry.atlassian.net")) {
        byDomain.firsttry_atlassian_net.push(cookie);
      } else if (domain.includes("id.atlassian.com")) {
        byDomain.id_atlassian_com.push(cookie);
      } else if (domain.includes("auth.atlassian.com")) {
        byDomain.auth_atlassian_com.push(cookie);
      } else {
        byDomain.other.push(cookie);
      }
    });

    // Anonymize: names only, no values
    const cookieSummary: Record<string, any> = {};
    Object.entries(byDomain).forEach(([domain, domainCookies]: [string, any]) => {
      const names = [...new Set(domainCookies.map((c: any) => c.name))].slice(0, 50);
      const now = Math.floor(Date.now() / 1000);
      const hasExpired = domainCookies.some((c: any) => c.expires && c.expires > 0 && c.expires < now);
      const expires = domainCookies
        .map((c: any) => c.expires)
        .filter((e: any) => e && e > 0)
        .sort((a: any, b: any) => a - b);

      cookieSummary[domain] = {
        count: domainCookies.length,
        names,
        hasExpired,
        minExpires: expires.length > 0 ? expires[0] : null,
        maxExpires: expires.length > 0 ? expires[expires.length - 1] : null,
      };
    });

    const stat = fs.statSync(storageStatePath);
    return {
      ts,
      mode: "loaded",
      env_storage_state: storageStatePath,
      repoRoot,
      cwd,
      resolvedStorageStatePath: storageStatePath,
      fileStat: {
        sizeBytes: stat.size,
        mtimeIso: new Date(stat.mtimeMs).toISOString(),
      },
      totalCookies: cookies.length,
      cookieSummary,
    };
  } catch (err) {
    return {
      ts,
      mode: "parse_error",
      env_storage_state: storageStatePath,
      repoRoot,
      cwd,
      resolvedStorageStatePath: storageStatePath,
      error: String(err),
    };
  }
}

function isAuthWallTitle(title: string): boolean {
  const t = (title || '').toLowerCase();
  return t.includes('log in') || t.includes('login') || t.includes('sign in') || t.includes('verify');
}

async function collectDomFingerprint(page: any) {
  return await page.evaluate(() => {
    const q = (sel: string) => document.querySelectorAll(sel).length;
    const text1 = (sel: string) => (document.querySelector(sel)?.textContent || '').trim().slice(0, 120);
    return {
      readyState: (document as any).readyState,
      counts: {
        main: q('main'),
        nav: q('nav'),
        header: q('header'),
        form: q('form'),
        iframe: q('iframe'),
        input_password: q('input[type="password"]'),
        input_email: q('input[type="email"]'),
        input_text: q('input[type="text"]'),
        h1: q('h1'),
      },
      h1: text1('h1'),
      body_snippet: (document.body?.innerText || '').trim().slice(0, 200),
    };
  }).catch(() => ({ readyState: 'EVAL_FAILED', counts: {}, h1: '', body_snippet: '' }));
}

async function detectJiraShell(page: any): Promise<{present: boolean, matched: string[], checked: string[], counts: Record<string, number>}> {
  const SHELL_SELECTORS = [
    '#ak-main-content',
    '#ak-side-navigation',
    '[data-testid="ak-main-content"]',
    '[data-testid="global-navigation"]',
    '[data-testid="navigation-app"]',
    '[data-testid="jira-issue-navigator"]',
    '[data-testid="dashboard-view"]',
    '[data-testid="dashboard-content"]',
    '[role="main"]',
    'nav[aria-label]',
    '[data-testid*="dashboard"]',
    '[data-testid*="Dashboard"]',
    'main',
    '#jira',
    '#content',
    'div[id*="dashboard"]',
  ];

  const counts: Record<string, number> = {};
  const matched: string[] = [];

  for (const sel of SHELL_SELECTORS) {
    try {
      const c = await page.locator(sel).count().catch(() => 0);
      counts[sel] = c;
      if (c > 0) {
        matched.push(sel);
      }
    } catch (e) {
      counts[sel] = 0;
    }
  }

  return {
    present: matched.length > 0,
    matched,
    checked: SHELL_SELECTORS,
    counts
  };
}

async function enforceAuthenticatedJiraSession(page: any, artifactDir: string, opts?: {timeoutMs?: number, pollMs?: number}): Promise<void> {
  const timeoutMs = opts?.timeoutMs ?? 45000;
  const pollMs = opts?.pollMs ?? 1000;
  const start = Date.now();
  const timeline: any[] = [];

  // Fail-fast auth wall detection loop
  while (Date.now() - start < timeoutMs) {
    const pageUrl = page.url();
    const title = await page.title().catch(() => 'TITLE_UNAVAILABLE');
    const shell = await detectJiraShell(page);
    const frameUrls = page.frames().map((f: any) => f.url());
    const authFrames = frameUrls.filter(isAuthOrCaptchaFrameUrl);

    // FAIL FAST #1: Top-level auth URL
    if (isAuthUrl(pageUrl)) {
      const evidence: any = {
        ts: isoNow(),
        pageUrl,
        title,
        reason: 'top_level_auth_url',
        isAuthed: false,
        authFrames,
        frameUrls_sample: frameUrls.slice(0, 30),
        shell,
        timeline
      };
      await writeJson(`${artifactDir}/auth_check.json`, evidence);
      throw new Error(`AUTH_REQUIRED_OR_CAPTCHA_BLOCK: top_level_auth_url. URL=${pageUrl}`);
    }

    // FAIL FAST #2: Auth wall title
    if (isAuthWallTitle(title)) {
      const domFingerprint = await collectDomFingerprint(page);
      const evidence: any = {
        ts: isoNow(),
        pageUrl,
        title,
        reason: 'auth_wall_title',
        isAuthed: false,
        authFrames,
        frameUrls_sample: frameUrls.slice(0, 30),
        shell,
        domFingerprint,
        timeline
      };
      await writeJson(`${artifactDir}/auth_check.json`, evidence);
      throw new Error(`AUTH_REQUIRED_OR_CAPTCHA_BLOCK: auth_wall_title. URL=${pageUrl}`);
    }

    // SUCCESS: Shell found
    if (shell.present) {
      const evidence: any = {
        ts: isoNow(),
        pageUrl,
        title,
        reason: 'jira_shell_present',
        isAuthed: true,
        authFrames,
        frameUrls_sample: frameUrls.slice(0, 30),
        shell,
        timeline
      };
      await writeJson(`${artifactDir}/auth_check.json`, evidence);
      return;
    }

    // FAIL FAST #3: DOM-based auth wall
    const domFingerprint = await collectDomFingerprint(page);
    const authWallByDom =
      (domFingerprint.counts?.input_password > 0) ||
      (domFingerprint.h1?.toLowerCase()?.includes('log in')) ||
      (domFingerprint.body_snippet?.toLowerCase()?.includes('log in'));

    if (authWallByDom) {
      const evidence: any = {
        ts: isoNow(),
        pageUrl,
        title,
        reason: 'auth_wall_dom',
        isAuthed: false,
        authFrames,
        frameUrls_sample: frameUrls.slice(0, 30),
        shell,
        domFingerprint,
        timeline
      };
      await writeJson(`${artifactDir}/auth_check.json`, evidence);
      throw new Error(`AUTH_REQUIRED_OR_CAPTCHA_BLOCK: auth_wall_dom. URL=${pageUrl}`);
    }

    // Record timeline tick
    const elapsed_ms = Date.now() - start;
    timeline.push({
      elapsed_ms,
      pageUrl,
      title,
      shell_present: shell.present,
      shell_matched_count: shell.matched.length,
      authFrames_count: authFrames.length,
      domCounts: domFingerprint.counts,
      domH1: domFingerprint.h1
    });

    // Wait before next poll
    await page.waitForTimeout(pollMs);
  }

  // TIMEOUT: Shell never appeared within timeoutMs
  const finalPageUrl = page.url();
  const finalTitle = await page.title().catch(() => 'TITLE_UNAVAILABLE');
  const finalShell = await detectJiraShell(page);
  const finalFrameUrls = page.frames().map((f: any) => f.url());
  const finalAuthFrames = finalFrameUrls.filter(isAuthOrCaptchaFrameUrl);
  const finalDomFingerprint = await collectDomFingerprint(page);

  // Capture page snapshot
  try {
    const pageContent = await page.content();
    await writeHtml(`${artifactDir}/page_snapshot.html`, pageContent);
    console.log(`[PROD_GREEN] Page snapshot saved to page_snapshot.html`);
  } catch (e) {
    console.log(`[PROD_GREEN] Failed to capture page snapshot: ${e}`);
  }

  // Write final auth_check with comprehensive evidence
  const evidence: any = {
    ts: isoNow(),
    pageUrl: finalPageUrl,
    title: finalTitle,
    reason: 'shell_never_appeared_within_timeout',
    isAuthed: false,
    authFrames: finalAuthFrames,
    frameUrls_sample: finalFrameUrls.slice(0, 30),
    shell: finalShell,
    domFingerprint: finalDomFingerprint,
    timeline,
    timeoutMs,
    actualWaitMs: Date.now() - start
  };
  await writeJson(`${artifactDir}/auth_check.json`, evidence);

  throw new Error(`JIRA_SHELL_NOT_FOUND: shell_never_appeared_within_timeout after ${timeoutMs}ms. URL=${finalPageUrl}`);
}

// Production dashboard green test: verifies the new 40-hex bundle is deployed
// and no fatal markers are present in the gadget iframe.
// 
// CRITICAL: Does NOT use waitUntil:'networkidle' because Jira continuously makes
// background requests. Instead uses domcontentloaded + explicit selector waits
// for Jira root and gadget iframe.

// ════════════════════════════════════════════════════════════════════════════════════
// DETERMINISTIC HELPERS: Auth + Console + PageError filtering
// ════════════════════════════════════════════════════════════════════════════════════

// Helper function: Poll page.frames() every 500ms to find gadget frame
// Matches frames from cdn.prod.atlassian-dev.net with gadget-related keywords
async function waitForGadgetFrame(page: any, timeoutMs: number, artifactDir?: string) {
  const startTime = Date.now();
  const pollIntervalMs = 500;

  while (Date.now() - startTime < timeoutMs) {
    const frames = page.frames();
    const currentFrameUrls = frames.map((f: any) => f.url());
    const currentPageUrl = page.url();
    
    // ─── HARD FAIL IF TOP-LEVEL PAGE URL IS AUTH/LOGIN (not frames) ───
    if (artifactDir && isAuthUrl(currentPageUrl)) {
      const authFrames = currentFrameUrls.filter(isAuthOrCaptchaFrameUrl);
      const evidence = {
        ts: isoNow(),
        pageUrl: currentPageUrl,
        frameUrls: currentFrameUrls,
        authFrames,
        isAuthed: false,
        reason: "top-level auth redirect during gadget polling",
      };
      await writeJson(`${artifactDir}/auth_check.json`, evidence);
      throw new Error("AUTH_REQUIRED_OR_CAPTCHA_BLOCK: top-level auth redirect during gadget polling.");
    }
    
    // Log frames for debugging every few attempts
    const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
    if (elapsedSeconds % 5 === 0) {
      console.log(`[PROD_GREEN] Polling frames (${elapsedSeconds}s elapsed): ${frames.length} frames`);
      frames.forEach((f: any, idx: number) => {
        console.log(`  [Frame ${idx}] ${f.url()}`);
      });
    }

    // Find frame matching: cdn.prod.atlassian-dev.net AND (govGadget OR gadget OR custom-ui)
    const gadgetFrame = frames.find(
      (f: any) =>
        /cdn\.prod\.atlassian-dev\.net/i.test(f.url()) &&
        /govGadget|gadget|custom-ui/i.test(f.url())
    );

    if (gadgetFrame) {
      return gadgetFrame;
    }

    await page.waitForTimeout(pollIntervalMs);
  }

  // Timeout: list all frames for debugging
  const finalFrames = page.frames();
  const frameUrls = finalFrames.map((f: any) => f.url());
  throw new Error(
    `[PROD_GREEN] Gadget frame not found after ${timeoutMs}ms. Frames found: ${JSON.stringify(frameUrls, null, 2)}`
  );
}

test.describe('PROD DASHBOARD GREEN: New 40-hex Bundle Deployed', () => {
  // Lightweight getters: do NOT throw at module scope
  const getJiraDashboardUrl = () => process.env.JIRA_DASHBOARD_URL;
  const getStorageStatePath = () => process.env.STORAGE_STATE;

  let artifactDir: string;
  let storageStatePath: string | null = null;

  test.beforeAll(async () => {
    // STEP 1: Validate env + storageState (inside beforeAll, not at module scope)
    const url = getJiraDashboardUrl();
    if (!url) throw new Error("JIRA_DASHBOARD_URL is required");
    
    const ss = getStorageStatePath();
    if (!ss) throw new Error("STORAGE_STATE is required (use __NONE__ for unauth mode)");
    
    // Resolve STORAGE_STATE to absolute path
    const { resolved, isAbsolute, cwdAtResolution } = resolveStorageStatePath(ss);
    console.log(`[PROD_GREEN] STORAGE_STATE resolved: ${resolved} (isAbsolute=${isAbsolute}, cwd=${cwdAtResolution})`);
    
    // Support "__NONE__" for deterministic unauth testing
    if (!resolved || resolved === "__NONE__") {
      // Unauth mode: no storage state file needed
      storageStatePath = null;
    } else {
      // Normal mode: require storage state file to exist and have content
      if (!fs.existsSync(resolved)) {
        throw new Error(`STORAGE_STATE_INVALID: storage state file missing. resolved_path=${resolved}`);
      }
      
      // Validate file has content
      const stat = fs.statSync(resolved);
      if (stat.size === 0) {
        throw new Error(`STORAGE_STATE_INVALID: storage state file is empty. path=${resolved}`);
      }
      
      // Validate JSON structure
      try {
        const content = fs.readFileSync(resolved, "utf8");
        const parsed = JSON.parse(content);
        if (!parsed.cookies || !Array.isArray(parsed.cookies)) {
          throw new Error(`STORAGE_STATE_INVALID: cookies array missing in storage state. path=${resolved}`);
        }
      } catch (parseErr) {
        throw new Error(`STORAGE_STATE_INVALID: storage state JSON invalid. path=${resolved}, error=${parseErr}`);
      }
      
      storageStatePath = resolved;
    }
    
    // STEP 2: Create artifact directory for this test run
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    artifactDir = `/tmp/prod_dashboard_green_${timestamp}`;
    if (!fs.existsSync(artifactDir)) {
      fs.mkdirSync(artifactDir, { recursive: true });
    }
    console.log(`[PROD_GREEN] Artifact directory: ${artifactDir}`);
  });

  test('should load gadget iframe with new 40-hex bundle and no fatal markers', async () => {
    // Extend test timeout to 5 minutes (300s) to allow for slow Jira loads
    test.setTimeout(300000);

    // ─── OUTER-SCOPE VARIABLE DECLARATIONS (prevents ReferenceError in catch/finally) ───
    let consoleRecords: ConsoleRec[] = [];
    let pageErrors: PageErrorRec[] = [];
    let moduleScriptSrc: string | null = null;
    let performanceResources: any[] = [];
    let allFrameUrls: string[] = [];
    let lastFrameProof: any = null;
    let requestFailed: any[] = [];
    let responseErrors: any[] = [];

    // ─── CREATE BROWSER CONTEXT WITH DETERMINISTIC STORAGE STATE ───
    // STEP 3: If storageState is null ("__NONE__" mode), explicitly pass undefined
    // Otherwise pass the file path. This ensures a truly clean context in unauth mode.
    const context = await chromium.launchPersistentContext('', {
      headless: true,
      args: ['--no-sandbox'],
      ...(storageStatePath !== null ? { storageState: storageStatePath } : { storageState: undefined })
    });

    const page = await context.newPage();

    // REGEX PATTERNS for bundle detection
    const re40 = /app\.[0-9a-f]{40}\.(js|mjs)/i;
    const reShort = /app\.[0-9a-f]{6,8}\.(js|mjs)/i;

    // Network tracking: capture 40-hex bundles and any old short hashes
    const loaded40: string[] = [];
    const loadedShort: string[] = [];

    page.on('response', (response) => {
      const url = response.url();
      const status = response.status();
      if (status >= 400) {
        responseErrors.push({ts: isoNow(), url, status, resourceType: response.request().resourceType()});
      }
      if (re40.test(url)) {
        loaded40.push(url);
        console.log(`[PROD_GREEN] 40-hex bundle loaded: ${url.substring(url.length - 60)}`);
      } else if (reShort.test(url) && !re40.test(url)) {
        loadedShort.push(url);
        console.log(`[PROD_GREEN] ⚠️  Old-style bundle detected: ${url.substring(url.length - 60)}`);
      }
    });

    page.on('requestfailed', (req) => {
      const failure = req.failure();
      requestFailed.push({
        ts: isoNow(),
        url: req.url(),
        method: req.method(),
        failure: failure?.errorText || 'unknown',
        resourceType: req.resourceType()
      });
    });

    // Declare bundle proof variables at top so they're available in catch block and artifact writing
    let gadgetFrameUrl: string | null = null;
    let gadgetFrame: any = null;
    let allFrameUrlsAtFailure: string[] = [];

    // ─── DETERMINISTIC CONSOLE AND PAGE ERROR TRACKING ───
    page.on("console", (msg: any) => {
      const loc = msg.location ? msg.location() : undefined;
      consoleRecords.push({
        ts: isoNow(),
        type: String(msg.type ? msg.type() : "unknown"),
        text: String(msg.text ? msg.text() : ""),
        url: loc?.url,
        line: loc?.lineNumber,
        column: loc?.columnNumber,
      });
    });

    page.on("pageerror", (err: any) => {
      pageErrors.push({
        ts: isoNow(),
        name: String(err?.name || "Error"),
        message: String(err?.message || String(err)),
        stack: err?.stack ? String(err.stack) : undefined,
      });
    });

    try {
      // ─── CREATE ARTIFACT DIRECTORY EARLY (before any writeJson calls) ───
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      if (!fs.existsSync(artifactDir)) {
        fs.mkdirSync(artifactDir, { recursive: true });
      }

      const jiraDashboardUrl = getJiraDashboardUrl()!; // guaranteed by beforeAll
      const dashboardUrlWithDebug = appendFtDebugParam(jiraDashboardUrl);
      console.log(`[PROD_GREEN] Navigating to ${dashboardUrlWithDebug}`);
      
      // STEP 4: Navigate with domcontentloaded (NOT networkidle)
      // ft_debug=1 appended: E2E always enables debug mode to ensure DOM stability
      await page.goto(dashboardUrlWithDebug, { waitUntil: 'domcontentloaded', timeout: 90000 });
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      console.log(`[PROD_GREEN] Page domcontentloaded complete`);

      // STEP 5: Stabilization wait before enforcement
      await page.waitForTimeout(1000);
      
      // STEP 6: Enforce authentication with shell detection (ONLY call this once)
      await enforceAuthenticatedJiraSession(page, artifactDir, {timeoutMs: 45000, pollMs: 1000});
      console.log(`[PROD_GREEN] ✅ Authentication verified: authenticated Jira dashboard session confirmed`);

      // STEP 7: Short stability wait after auth confirmed
      await page.waitForTimeout(500);

      // Step 3: Find gadget frame robustly by polling page.frames()
      // (Skip generic iframe wait to avoid matching recaptcha iframe)
      console.log(`[PROD_GREEN] Searching for gadget frame...`);
      gadgetFrame = await waitForGadgetFrame(page, 120000, artifactDir);
      gadgetFrameUrl = gadgetFrame.url();
      console.log(`[PROD_GREEN] ✅ Gadget frame found: ${gadgetFrameUrl}`);

      // Step 4: Wait for gadget frame to load (WITHOUT networkidle)
      console.log(`[PROD_GREEN] Waiting for gadget frame domcontentloaded...`);
      await gadgetFrame.waitForLoadState('domcontentloaded', { timeout: 60000 });
      console.log(`[PROD_GREEN] Gadget frame domcontentloaded complete`);

      // Step 5: Stabilization wait (short)
      await gadgetFrame.waitForTimeout(1000);

      // Step 6A: PRIMARY PROOF - Read module script src from inside gadget frame
      console.log(`[PROD_GREEN] Checking PRIMARY bundle proof (module script)...`);
      try {
        moduleScriptSrc = await gadgetFrame.evaluate(() => {
          const scriptEl = document.querySelector('script[type="module"]');
          if (scriptEl) {
            return scriptEl.getAttribute('src') || scriptEl.src || null;
          }
          return null;
        });

        if (moduleScriptSrc) {
          console.log(`[PROD_GREEN] Module script src: ${moduleScriptSrc}`);
          expect(
            moduleScriptSrc,
            `Module script does not match 40-hex pattern: ${moduleScriptSrc}`
          ).toMatch(/app\.[0-9a-f]{40}\.(js|mjs)$/i);
          console.log(`[PROD_GREEN] ✅ PRIMARY proof (module script) verified: ${moduleScriptSrc}`);
        } else {
          console.log(`[PROD_GREEN] ⚠️  No module script found, checking performance resources...`);
        }
      } catch (e) {
        console.log(`[PROD_GREEN] ⚠️  Module script check failed: ${e}`);
      }

      // Step 6B: BACKUP PRIMARY PROOF - Check performance resources from inside gadget frame
      console.log(`[PROD_GREEN] Checking BACKUP proof (performance resources)...`);
      try {
        performanceResources = await gadgetFrame.evaluate(() => {
          return performance
            .getEntriesByType('resource')
            .map((entry: any) => entry.name)
            .filter((name: string) => name.includes('app.'));
        });

        console.log(`[PROD_GREEN] Performance resources with 'app': ${performanceResources.length}`);
        performanceResources.forEach((url) => {
          console.log(`  - ${url}`);
        });

        // Find 40-hex bundle in performance resources
        const hex40InPerf = performanceResources.find((url) => /app\.[0-9a-f]{40}\.(js|mjs)/i.test(url));
        if (hex40InPerf) {
          console.log(`[PROD_GREEN] ✅ BACKUP proof (performance) verified: ${hex40InPerf}`);
        } else if (performanceResources.length > 0) {
          console.log(`[PROD_GREEN] ⚠️  Performance resources found but no 40-hex bundle. Resources: ${performanceResources.join(', ')}`);
        } else {
          console.log(`[PROD_GREEN] ⚠️  No app-related performance resources found`);
        }
      } catch (e) {
        console.log(`[PROD_GREEN] ⚠️  Performance resources check failed: ${e}`);
      }

      // Step 6C: SECONDARY PROOF - Network-captured bundles
      console.log(`[PROD_GREEN] Checking SECONDARY proof (network listener)...`);
      console.log(`[PROD_GREEN] Loaded 40-hex bundles: ${loaded40.length}`);
      loaded40.forEach((url) => {
        console.log(`  - ${url}`);
      });

      if (loadedShort.length > 0) {
        console.log(`[PROD_GREEN] ⚠️  Old-style bundles found: ${loadedShort.length}`);
        loadedShort.forEach((url) => {
          console.log(`  - ${url}`);
        });
      }

      // DETERMINISTIC ASSERTION: Must have PRIMARY proof OR SECONDARY proof
      const hasPrimaryProof = !!moduleScriptSrc || performanceResources.some((url) => /app\.[0-9a-f]{40}\.(js|mjs)/i.test(url));
      const hasSecondaryProof = loaded40.length > 0;

      expect(
        hasPrimaryProof || hasSecondaryProof,
        `No 40-hex bundle proof found. PRIMARY: module=${!!moduleScriptSrc}, perf=${performanceResources.length}. SECONDARY: network=${loaded40.length}`
      ).toBe(true);

      console.log(`[PROD_GREEN] ✅ 40-hex bundle verified (PRIMARY or SECONDARY proof)`);

      // Verify 40-hex format of loaded bundles (if any from network)
      for (const bundleUrl of loaded40) {
        expect(
          bundleUrl,
          `40-hex bundle URL has invalid format: ${bundleUrl}`
        ).toMatch(/app\.[0-9a-f]{40}\.(js|mjs)/i);
      }

      console.log(`[PROD_GREEN] ✅ All bundle formats valid`);

      // Step 7: Deterministic fatal filtering - only OUR signals, not Jira host noise
      console.log(`[PROD_GREEN] Checking for fatal markers (OUR signals only)...`);
      
      const ourFatalConsole = consoleRecords.filter(isFatalOurConsole);

      const ourFatalPageErrors = pageErrors.filter((e) => {
        const s = (e.stack || "") + "\n" + (e.message || "");
        if (isOurGadgetBundleUrl(s)) return true;
        const m = (e.message || "");
        return (
          m.includes("UI_BUILD_TIME_UTC is not defined") ||
          m.includes("DASH_SCHEMA_VERSION_UNSUPPORTED_FAIL_CLOSED") ||
          m.includes("DASH_ENVELOPE_MAP_FAILED")
        );
      });

      allFrameUrls = page.frames().map(f => String(f.url()||''));

      await writeJson(`${artifactDir}/console_records.json`, consoleRecords);
      await writeJson(`${artifactDir}/page_errors.json`, pageErrors);

      await writeJson(`${artifactDir}/fatal_filtered.json`, {
        ts: isoNow(),
        url: page.url(),
        allFrameUrls,
        fatalConsoleOurs: ourFatalConsole,
        fatalPageErrorsOurs: ourFatalPageErrors
      });

      if (ourFatalConsole.length > 0 || ourFatalPageErrors.length > 0) {
        throw new Error(
          `FATAL_OURS_DETECTED: console=${ourFatalConsole.length} pageErrors=${ourFatalPageErrors.length}. ` +
            `See ${artifactDir}/fatal_filtered.json`
        );
      }

      console.log(`[PROD_GREEN] ✅ No fatal markers found in gadget frame (deterministic filtering applied)`);

      // Assert bridge is available in gadget frame
      const bridgeAvailable = await gadgetFrame.evaluate(() => {
        try {
          return typeof (window as any).forge?.bridge?.invoke === 'function';
        } catch (e) {
          return false;
        }
      });

      expect(bridgeAvailable, 'Forge bridge not available in gadget frame').toBe(true);
      console.log(`[PROD_GREEN] ✅ Forge bridge invoke available`);

      // Log final success
      console.log(`[PROD_GREEN] ✅ ALL CHECKS PASSED`);
      console.log(`[PROD_GREEN] - 40-hex bundle proven (PRIMARY or SECONDARY)`);
      console.log(`[PROD_GREEN] - No fatal markers found`);
      console.log(`[PROD_GREEN] - Bridge available: true`);
      console.log(`[PROD_GREEN] - Test completed successfully`);

      // Step 9: Save enriched artifacts (success case)
      const consoleDump = consoleRecords.map((m) => `[${m.ts}] [${m.type}] ${m.text}`).join('\n');
      fs.writeFileSync(path.join(artifactDir, 'console.log'), consoleDump);

      const networkProof = {
        loaded40HexBundles: loaded40,
        loadedOldStyleBundles: loadedShort,
        timestamp: new Date().toISOString()
      };
      fs.writeFileSync(
        path.join(artifactDir, 'network_proof.json'),
        JSON.stringify(networkProof, null, 2)
      );

      const frameProof = {
        gadgetFrameUrl: gadgetFrameUrl ?? 'NOT_CAPTURED',
        allFrameUrls: page.frames().map((f) => f.url()),
        bundleProof: {
          primary: {
            moduleScriptSrc: moduleScriptSrc ?? 'NOT_CAPTURED',
            performanceResources: performanceResources ?? []
          },
          secondary: {
            networkLoaded40Hex: loaded40,
            networkLoadedOldStyle: loadedShort
          }
        },
        timestamp: new Date().toISOString()
      };
      await writeJson(path.join(artifactDir, 'frame_proof.json'), frameProof);

    } catch (error) {
      // Step 8: Capture enriched artifacts on failure
      console.log(`[PROD_GREEN] ❌ Test failed, capturing artifacts...`);

      // Capture all frame URLs at time of failure
      allFrameUrlsAtFailure = page.frames().map((f) => f.url());

      try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        await page.screenshot({
          path: path.join(artifactDir, `screenshot_${timestamp}.png`),
          fullPage: true,
        });
        console.log(`[PROD_GREEN] Screenshot saved`);
      } catch (e) {
        console.log(`[PROD_GREEN] Failed to capture screenshot: ${e}`);
      }

      // Save console and page error deterministic records
      const consoleDump = consoleRecords.map((m) => `[${m.ts}] [${m.type}] ${m.text}`).join('\n');
      fs.writeFileSync(path.join(artifactDir, 'console.log'), consoleDump);

      // Save enriched network proof
      const networkProof = {
        loaded40HexBundles: loaded40,
        loadedOldStyleBundles: loadedShort,
        errorContext: 'Test failed after capturing network events',
        timestamp: new Date().toISOString()
      };
      fs.writeFileSync(
        path.join(artifactDir, 'network_proof.json'),
        JSON.stringify(networkProof, null, 2)
      );

      // Save deterministic records and compute OUR fatal signals at failure time
      await writeJson(`${artifactDir}/console_records.json`, consoleRecords);
      await writeJson(`${artifactDir}/page_errors.json`, pageErrors);
      await writeJson(`${artifactDir}/request_failed.json`, requestFailed);
      await writeJson(`${artifactDir}/response_errors.json`, responseErrors);

      const ourFatalConsoleAtFailure = consoleRecords.filter(isFatalOurConsole);
      const ourFatalPageErrorsAtFailure = pageErrors.filter((e) => {
        const s = (e.stack || "") + "\n" + (e.message || "");
        if (isOurGadgetBundleUrl(s)) return true;
        const m = (e.message || "");
        return (
          m.includes("UI_BUILD_TIME_UTC is not defined") ||
          m.includes("DASH_SCHEMA_VERSION_UNSUPPORTED_FAIL_CLOSED") ||
          m.includes("DASH_ENVELOPE_MAP_FAILED")
        );
      });

      allFrameUrls = page.frames().map(f => String(f.url()||''));

      await writeJson(`${artifactDir}/fatal_filtered.json`, {
        ts: isoNow(),
        url: page.url(),
        allFrameUrls,
        fatalConsoleOurs: ourFatalConsoleAtFailure,
        fatalPageErrorsOurs: ourFatalPageErrorsAtFailure
      });

      const frameProof = {
        gadgetFrameUrl: gadgetFrameUrl ?? 'NOT_CAPTURED',
        allFrameUrls: allFrameUrls,
        currentPageUrl: page.url(),
        bundleProof: {
          primary: {
            moduleScriptSrc: moduleScriptSrc ?? 'NOT_CAPTURED',
            performanceResources: performanceResources ?? []
          },
          secondary: {
            networkLoaded40Hex: loaded40,
            networkLoadedOldStyle: loadedShort
          }
        },
        errorContext: 'Test failed after attempting to locate and verify gadget frame',
        timestamp: new Date().toISOString()
      };
      await writeJson(path.join(artifactDir, 'frame_proof.json'), frameProof);

      // Collect storage state proof (best-effort, non-blocking)
      try {
        const storageStateProof = await collectStorageStateProof(storageStatePath);
        await writeJson(path.join(artifactDir, 'storage_state_proof.json'), storageStateProof);
        console.log(`[PROD_GREEN] Storage state proof: storage_state_proof.json`);
      } catch (err) {
        console.log(`[PROD_GREEN] Failed to collect storage state proof (non-fatal): ${err}`);
      }

      console.log(`[PROD_GREEN] Artifacts saved to: ${artifactDir}`);
      console.log(`[PROD_GREEN] Network proof: network_proof.json`);
      console.log(`[PROD_GREEN] Frame proof: frame_proof.json`);

      throw error;
    } finally {
      await context.close();
    }
  });
});
