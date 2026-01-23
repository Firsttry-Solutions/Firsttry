#!/usr/bin/env node
/**
 * Phase 6 Runtime Probe - Deterministic, Fail-Closed
 * STRICT: Always produces artifacts. Explicit STOP codes. No recoveries.
 * 
 * Env vars:
 *   RUN_DIR - Artifact output directory
 *   JIRA_DASHBOARD_URL - Target dashboard
 *   STORAGE_STATE - Playwright auth file
 * 
 * Artifacts (ALWAYS written):
 *   50_runtime_console.log - Console lines
 *   51_runtime_truth.json - Extracted truth (if PASS)
 *   52_runtime_page.html - Page HTML
 *   53_runtime_screenshot.png - Screenshot
 *   54_runtime_trace.zip - Playwright trace
 *   46_runtime_probe_run.txt - STOP reason (if FAIL)
 * 
 * Exit codes:
 *   0 = All markers present, truth extracted, exit(0)
 *   1 = STOP:<REASON> written to 46_runtime_probe_run.txt
 */

import { promises as fs } from 'fs';
import { chromium } from 'playwright';

// === ENV VALIDATION ===
const RUN_DIR = process.env.RUN_DIR;
const STORAGE_STATE = process.env.STORAGE_STATE;
const JIRA_DASHBOARD_URL = process.env.JIRA_DASHBOARD_URL;

if (!RUN_DIR || !STORAGE_STATE || !JIRA_DASHBOARD_URL) {
  console.error('[probe] STOP: ENV_MISSING');
  console.error(`[probe]   RUN_DIR=${RUN_DIR}`);
  console.error(`[probe]   STORAGE_STATE=${STORAGE_STATE}`);
  console.error(`[probe]   JIRA_DASHBOARD_URL=${JIRA_DASHBOARD_URL}`);
  process.exit(1);
}

console.log(`[probe] RUN_DIR=${RUN_DIR}`);
console.log(`[probe] STORAGE_STATE=${STORAGE_STATE}`);
console.log(`[probe] URL=${JIRA_DASHBOARD_URL}`);

// === UTILITIES ===

async function writeStopReason(reason, details = '') {
  const content = `STOP: ${reason}\n${details}`;
  await fs.writeFile(`${RUN_DIR}/46_runtime_probe_run.txt`, content, 'utf-8');
}

async function writeConsoleLog(lines) {
  const content = lines.join('\n');
  await fs.writeFile(`${RUN_DIR}/50_runtime_console.log`, content, 'utf-8');
}

async function writeTruthJson(truth) {
  const content = JSON.stringify(truth, null, 2);
  await fs.writeFile(`${RUN_DIR}/51_runtime_truth.json`, content, 'utf-8');
}

async function writePageHtml(content) {
  await fs.writeFile(`${RUN_DIR}/52_runtime_page.html`, content, 'utf-8');
}

async function writeScreenshot(data) {
  await fs.writeFile(`${RUN_DIR}/53_runtime_screenshot.png`, data);
}

async function exitWithStop(reason, consoleLines = [], details = '') {
  console.log(`[probe] STOP: ${reason}`);
  
  // Always write console log if we have lines
  if (consoleLines.length > 0) {
    await writeConsoleLog(consoleLines);
  }
  
  // Write STOP reason
  await writeStopReason(reason, details);
  
  process.exit(1);
}

// === MAIN ===

(async () => {
  const consoleLines = [];
  let browser;
  let context;
  let page;

  try {
    // Start browser with tracing
    console.log('[probe] Starting browser...');
    browser = await chromium.launch({ headless: true });

    // Load storage state
    let contextOptions = {
      recordVideo: { dir: RUN_DIR },
    };

    try {
      const storageStateContent = await fs.readFile(STORAGE_STATE, 'utf-8');
      const storageState = JSON.parse(storageStateContent);
      contextOptions.storageState = storageState;
      console.log('[probe] Loaded storage state');
    } catch (e) {
      console.log('[probe] Warning: Could not load storage state:', e.message);
    }

    context = await browser.newContext(contextOptions);

    // Start tracing
    await context.tracing.start({ screenshots: true, snapshots: true });

    page = context.newPage();

    // Collect console messages
    page.on('console', (msg) => {
      const text = msg.text();
      consoleLines.push(`[${msg.type().toUpperCase()}] ${text}`);
    });

    // Collect page errors
    page.on('pageerror', (err) => {
      consoleLines.push(`[PAGEERROR] ${err.toString()}`);
    });

    // Collect request failures
    page.on('requestfailed', (req) => {
      const failureText = req.failure()?.errorText || 'unknown';
      consoleLines.push(`[REQUESTFAILED] ${req.method()} ${req.url()} - ${failureText}`);
    });

    // Navigate to dashboard
    console.log(`[probe] Navigating to ${JIRA_DASHBOARD_URL}...`);
    try {
      await page.goto(JIRA_DASHBOARD_URL, {
        waitUntil: 'domcontentloaded',
        timeout: 120000,
      });
    } catch (e) {
      await writeConsoleLog(consoleLines);
      try {
        await writePageHtml(await page.content());
      } catch {}
      try {
        await writeScreenshot(await page.screenshot({ fullPage: false }));
      } catch {}
      return exitWithStop('NAVIGATION_FAILED', consoleLines, e.message);
    }

    // Wait for page to settle
    console.log('[probe] Waiting for page to settle...');
    await page.waitForTimeout(5000);

    // === AUTH DETECTION ===
    const finalUrl = page.url();
    console.log(`[probe] Final URL: ${finalUrl}`);

    if (
      finalUrl.includes('id.atlassian.com') ||
      finalUrl.includes('/login') ||
      finalUrl.includes('/auth') ||
      finalUrl.includes('/sso') ||
      finalUrl.includes('/signup') ||
      finalUrl.includes('continue=')
    ) {
      await writeConsoleLog(consoleLines);
      try {
        await writePageHtml(await page.content());
        await writeScreenshot(await page.screenshot({ fullPage: true }));
      } catch {}
      return exitWithStop('AUTH_REDIRECT', consoleLines, `Redirected to: ${finalUrl}`);
    }

    // Check for auth input fields
    const authInputs = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input[type="email"], input[type="password"], input[name="email"], input[name="password"]');
      return inputs.length > 0;
    });

    if (authInputs) {
      await writeConsoleLog(consoleLines);
      try {
        await writePageHtml(await page.content());
        await writeScreenshot(await page.screenshot({ fullPage: true }));
      } catch {}
      return exitWithStop('AUTH_REDIRECT', consoleLines, 'Auth input fields detected on page');
    }

    // === DASHBOARD DETECTION ===
    const title = page.title();
    const hasDashboardTitle = title.includes('Dashboard');
    const hasDashboardUrl = finalUrl.includes('/jira/dashboards/');

    const dashboardContainerExists = await page.evaluate(() => {
      return (
        document.querySelector('[data-test-id="dashboards.public.dashboard.page"]') ||
        document.querySelector('.dashboard') ||
        document.querySelector('[role="main"]')
      ) !== null;
    });

    if (!hasDashboardTitle && !hasDashboardUrl && !dashboardContainerExists) {
      await writeConsoleLog(consoleLines);
      try {
        await writePageHtml(await page.content());
        await writeScreenshot(await page.screenshot({ fullPage: true }));
      } catch {}
      return exitWithStop('DASHBOARD_NOT_REACHED', consoleLines, `Title: ${title}, URL: ${finalUrl}`);
    }

    console.log('[probe] Dashboard detected');

    // === GADGET FRAME DETECTION ===
    console.log('[probe] Searching for gadget frame...');
    let gadgetFrame = null;
    const frameSearchStart = Date.now();
    const frameSearchTimeout = 90000;

    while (!gadgetFrame && Date.now() - frameSearchStart < frameSearchTimeout) {
      const frames = page.frames();
      
      for (const frame of frames) {
        const frameUrl = frame.url();
        const isGadgetFrame =
          frameUrl.includes('atlassian-dev.net') ||
          frameUrl.includes('forge.cdn') ||
          frameUrl.includes('gadget') ||
          frameUrl.includes('/gateway/api/') ||
          frameUrl.includes('govGadget') ||
          frameUrl.includes('atlassian.net/forge/');

        if (isGadgetFrame) {
          gadgetFrame = frame;
          console.log(`[probe] Found gadget frame: ${frameUrl}`);
          break;
        }
      }

      if (!gadgetFrame) {
        await page.waitForTimeout(1000);
      }
    }

    if (!gadgetFrame) {
      await writeConsoleLog(consoleLines);
      try {
        await writePageHtml(await page.content());
        await writeScreenshot(await page.screenshot({ fullPage: true }));
      } catch {}
      return exitWithStop('GADGET_FRAME_NOT_FOUND', consoleLines, 'No matching gadget frames found after 90s search');
    }

    // === WAIT FOR GADGET TO INITIALIZE ===
    console.log('[probe] Gadget frame found, waiting for initialization...');
    await page.waitForTimeout(20000);

    // === REQUIRED MARKERS ===
    console.log('[probe] Checking for required markers...');
    const hasEntryMarker = consoleLines.some(line => line.includes('[UI_ENTRY_RUNTIME_PROOF]'));
    const hasGetDashboardMarker = consoleLines.some(line => line.includes('[UI_FT_GETDASHBOARDSTATE_SUCCESS]'));
    const hasBackboneMarker = consoleLines.some(line => line.includes('[BACKBONE_STATE_COMMITTED]'));

    if (!hasEntryMarker || !hasGetDashboardMarker || !hasBackboneMarker) {
      await writeConsoleLog(consoleLines);
      try {
        await writePageHtml(await page.content());
        await writeScreenshot(await page.screenshot({ fullPage: true }));
      } catch {}
      const missing = [];
      if (!hasEntryMarker) missing.push('UI_ENTRY_RUNTIME_PROOF');
      if (!hasGetDashboardMarker) missing.push('UI_FT_GETDASHBOARDSTATE_SUCCESS');
      if (!hasBackboneMarker) missing.push('BACKBONE_STATE_COMMITTED');
      return exitWithStop('REQUIRED_MARKERS_MISSING', consoleLines, `Missing: ${missing.join(', ')}`);
    }

    console.log('[probe] All required markers present');

    // === TRUTH EXTRACTION ===
    console.log('[probe] Extracting truth fields from console...');

    const extractFromConsole = (pattern) => {
      for (const line of consoleLines) {
        const match = line.match(pattern);
        if (match && match[1]) {
          return match[1];
        }
      }
      return null;
    };

    const truth = {
      ui_entry: extractFromConsole(/\[UI_ENTRY_RUNTIME_PROOF\]\s+ENTRY=(\S+)/) || 'UNKNOWN',
      ui_build_sha: extractFromConsole(/\[UI_BUILD_SHA\]\s+SHA=([0-9a-f]+)/) || 'UNKNOWN',
      backend_build_sha: extractFromConsole(/\[BACKEND_BUILD_SHA\]\s+SHA=([0-9a-f]+)/) || 'UNKNOWN',
      ui_request_id: extractFromConsole(/\[UI_REQUEST_ID\]\s+ID=(\S+)/) || 'UNKNOWN',
      tenant_identity: extractFromConsole(/\[TENANT_IDENTITY\]\s+TENANT=(\S+)/) || 'UNKNOWN',
      snapshot_count: parseInt(extractFromConsole(/\[SNAPSHOT_COUNT\]\s+COUNT=(\d+)/) || '0'),
      storage_state: extractFromConsole(/\[STORAGE_STATE\]\s+STATE=(\S+)/) || 'UNKNOWN',
      export_ready: extractFromConsole(/\[EXPORT_READY\]\s+READY=(true|false)/) === 'true',
      overall_health_state: extractFromConsole(/\[OVERALL_HEALTH_STATE\]\s+STATE=(\S+)/) || 'UNKNOWN',
    };

    // === TRUTH VALIDATION ===
    const unsetFields = [];
    const unknownFields = [];

    for (const [key, value] of Object.entries(truth)) {
      if (value === 'UNSET') unsetFields.push(key);
      if (value === 'UNKNOWN' && key !== 'ui_entry') unknownFields.push(key);
    }

    if (unsetFields.length > 0) {
      await writeConsoleLog(consoleLines);
      try {
        await writePageHtml(await page.content());
        await writeScreenshot(await page.screenshot({ fullPage: true }));
      } catch {}
      return exitWithStop(
        'TRUTH_FIELDS_MISSING',
        consoleLines,
        `Fields with UNSET value: ${unsetFields.join(', ')}`
      );
    }

    if (unknownFields.length > 0) {
      console.log(`[probe] Warning: Fields with UNKNOWN value: ${unknownFields.join(', ')}`);
    }

    console.log('[probe] Truth validation passed');

    // === WRITE ARTIFACTS ===
    console.log('[probe] Writing artifacts...');

    await writeConsoleLog(consoleLines);
    await writeTruthJson(truth);
    try {
      await writePageHtml(await page.content());
    } catch (e) {
      console.error('[probe] Warning: Could not write page HTML:', e.message);
    }
    try {
      await writeScreenshot(await page.screenshot({ fullPage: true }));
    } catch (e) {
      console.error('[probe] Warning: Could not write screenshot:', e.message);
    }

    // Stop tracing and save
    await context.tracing.stop({ path: `${RUN_DIR}/54_runtime_trace.zip` });

    console.log('[probe] All artifacts written successfully');
    console.log('[probe] Runtime probe PASS');

    process.exit(0);
  } catch (error) {
    console.error('[probe] Unexpected error:', error);
    
    try {
      if (consoleLines.length > 0) {
        await writeConsoleLog(consoleLines);
      }
      if (page) {
        try {
          await writePageHtml(await page.content());
        } catch {}
        try {
          await writeScreenshot(await page.screenshot({ fullPage: true }));
        } catch {}
      }
      await writeStopReason('PROBE_ERROR', error.message);
    } catch (e) {
      console.error('[probe] Error writing artifacts:', e);
    }

    process.exit(1);
  } finally {
    // Cleanup
    try {
      if (page) await page.close();
      if (context) await context.close();
      if (browser) await browser.close();
    } catch (e) {
      console.error('[probe] Error during cleanup:', e);
    }
  }
})();
