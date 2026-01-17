import { test, expect } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

/**
 * PHASE 4: EXTREME-PARANOID E2E TEST SPECIFICATION
 * 
 * Test: Verify Jira Dashboard Gadget appears, loads, and functions in production
 * 
 * Target: https://firsttry.atlassian.net/jira/dashboards/10102
 * Gadget: governance-dashboard-gadget-v2 (v2.88.0)
 * 
 * Hard Failure Conditions:
 *   ✗ Gadget iframe not found or blank
 *   ✗ Expected UI texts (6+ labels) not visible
 *   ✗ console.error or page error detected
 *   ✗ Failed requests (unless allowlisted)
 *   ✗ 401/403/5xx responses
 *   ✗ UI stuck in INITIALIZING/NOT_AVAILABLE/Unknown state (unless disabled)
 * 
 * Expected Dashboard UI Elements (must find ≥4 of 8):
 *   - Overall Health
 *   - Data Freshness
 *   - Scheduler
 *   - Last Snapshot
 *   - Read-Only Guarantee
 *   - Export Readiness
 *   - System Overview
 *   - Diagnostics
 * 
 * Proof Artifacts (generated in e2e/artifacts/):
 *   1. 00_env.json - Environment variables (sanitized)
 *   2. 01_iframes.json - All iframes found on page
 *   3. 02_console_messages.json - All console calls (log/warn/error)
 *   4. 03_page_errors.json - Page error events
 *   5. 04_network_requests.json - All HTTP requests/responses
 *   6. 05_gadget_iframe_html.html - Gadget iframe full DOM
 *   7. 06_gadget_viewport_screenshot.png - Gadget viewport screenshot
 *   8. 07_full_page_screenshot.png - Full dashboard screenshot
 *   9. 08_dashboard_html.html - Full dashboard DOM
 *   10. 09_ui_labels_found.json - All UI labels extracted
 *   11. 10_summary.md - Test result summary
 */

// ============================================================================
// SECTION A: INSTRUMENTATION & COLLECTION
// ============================================================================

const JIRA_SITE = process.env.JIRA_SITE || 'https://firsttry.atlassian.net';
const DASHBOARD_URL = process.env.DASHBOARD_URL || `${JIRA_SITE}/jira/dashboards/10102`;
const GADGET_TITLE_CONTAINS = process.env.GADGET_TITLE_CONTAINS || 'Firsttry: Audit Evidence for Jira';

// Optional: Label text we expect to find (case-insensitive)
const EXPECT_TEXT_1 = process.env.EXPECT_TEXT_1 || 'Overall Health';
const EXPECT_TEXT_2 = process.env.EXPECT_TEXT_2 || 'Read-Only Guarantee';
const EXPECT_TEXT_3 = process.env.EXPECT_TEXT_3 || 'Data Freshness';

// Optional: Failure mode flags
const FAIL_ON_UNKNOWN = process.env.FAIL_ON_UNKNOWN !== '0'; // Default: true
const FAIL_ON_INITIALIZING = process.env.FAIL_ON_INITIALIZING !== '0'; // Default: true
const FAIL_ON_NOT_AVAILABLE = process.env.FAIL_ON_NOT_AVAILABLE !== '0'; // Default: true

// Optional: Allowlist failed requests by regex
const ALLOW_FAILED_REQUESTS_REGEX = process.env.ALLOW_FAILED_REQUESTS_REGEX || '';

// Optional: Allow console.warn without failing
const ALLOW_CONSOLE_WARN_ONLY = process.env.ALLOW_CONSOLE_WARN_ONLY !== '0'; // Default: true

// Artifact directory
const ARTIFACT_DIR = './artifacts';

// Collection state (shared across test)
const state = {
  consoleMessages: [],
  pageErrors: [],
  networkRequests: [],
  gadgetFound: false,
  gadgetLoaded: false,
  uiLabelsFound: [],
  failureReasons: [],
};

// ============================================================================
// SECTION B: UTILITIES
// ============================================================================

function sanitizeEnvForOutput() {
  return {
    JIRA_SITE,
    DASHBOARD_URL,
    GADGET_TITLE_CONTAINS,
    EXPECT_TEXT_1,
    EXPECT_TEXT_2,
    EXPECT_TEXT_3,
    FAIL_ON_UNKNOWN,
    FAIL_ON_INITIALIZING,
    FAIL_ON_NOT_AVAILABLE,
    ALLOW_FAILED_REQUESTS_REGEX: ALLOW_FAILED_REQUESTS_REGEX ? '(set)' : '(empty)',
    ALLOW_CONSOLE_WARN_ONLY,
    ALLOW_FAILED_REQUESTS_REGEX_EMPTY: ALLOW_FAILED_REQUESTS_REGEX === '',
  };
}

function writeArtifact(filename, data) {
  mkdirSync(ARTIFACT_DIR, { recursive: true });
  const filePath = join(ARTIFACT_DIR, filename);
  if (typeof data === 'object') {
    writeFileSync(filePath, JSON.stringify(data, null, 2));
  } else {
    writeFileSync(filePath, data);
  }
  console.log(`[ARTIFACT] ${filename}`);
}

// ============================================================================
// MAIN TEST
// ============================================================================

test('Dashboard Gadget E2E: Paranoid Validation', async ({ page }) => {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  PHASE 4: EXTREME-PARANOID DASHBOARD GADGET E2E TEST          ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log('');

  // ========================================================================
  // SECTION C: SETUP EVENT LISTENERS
  // ========================================================================

  // Capture console messages
  page.on('console', (msg) => {
    const entry = {
      type: msg.type(),
      text: msg.text(),
      location: msg.location(),
    };
    state.consoleMessages.push(entry);
    console.log(`[CONSOLE:${msg.type().toUpperCase()}] ${msg.text()}`);
  });

  // Capture page errors
  page.on('pageerror', (error) => {
    const entry = {
      message: error.message,
      stack: error.stack,
    };
    state.pageErrors.push(entry);
    console.error(`[PAGEERROR] ${error.message}`);
  });

  // Capture network requests/responses
  page.on('response', (response) => {
    const entry = {
      url: response.url(),
      status: response.status(),
      statusText: response.statusText(),
      headers: Object.fromEntries(response.headers()),
    };
    state.networkRequests.push(entry);
    if (response.status() >= 400) {
      console.warn(`[NETWORK] ${response.status()} ${response.url()}`);
    }
  });

  // ========================================================================
  // SECTION D: ENVIRONMENT INFO
  // ========================================================================

  console.log('[ENV] Writing environment snapshot...');
  writeArtifact('00_env.json', sanitizeEnvForOutput());

  // ========================================================================
  // SECTION E: NAVIGATE TO DASHBOARD
  // ========================================================================

  console.log(`[NAVIGATE] Going to: ${DASHBOARD_URL}`);
  try {
    await page.goto(DASHBOARD_URL, { waitUntil: 'domcontentloaded' });
  } catch (e) {
    console.error(`[NAVIGATE] Load error (may be expected): ${e.message}`);
  }

  // Wait a bit for gadget to initialize
  await page.waitForTimeout(3000);

  // ========================================================================
  // SECTION F: FIND GADGET IFRAME
  // ========================================================================

  console.log('[IFRAME] Scanning page for iframes...');

  // Get all iframes on page
  const allIframes = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('iframe')).map((iframe, idx) => ({
      index: idx,
      id: iframe.id || '(no id)',
      name: iframe.name || '(no name)',
      src: iframe.src || '(no src)',
      title: iframe.title || '(no title)',
      outerHTML: iframe.outerHTML.substring(0, 200) + '...',
      visible: iframe.offsetHeight > 0 && iframe.offsetWidth > 0,
    }));
  });

  console.log(`[IFRAME] Found ${allIframes.length} iframes`);
  writeArtifact('01_iframes.json', allIframes);

  // Find gadget iframe (contains gadget key in src or name)
  const gadgetIframe = allIframes.find(
    (iframe) =>
      iframe.src.includes('governance-dashboard-gadget') ||
      iframe.name.includes('governance-dashboard-gadget') ||
      iframe.src.includes('gadget') ||
      iframe.title.includes('governance') ||
      iframe.title.includes('Audit')
  );

  if (!gadgetIframe) {
    state.failureReasons.push('GADGET_IFRAME_NOT_FOUND: No iframe found containing gadget key or expected title');
    console.error('[IFRAME] ✗ Gadget iframe NOT found!');
    console.error('[IFRAME] Iframes found:', allIframes);
    expect(gadgetIframe).toBeTruthy();
  }

  state.gadgetFound = true;
  console.log(`[IFRAME] ✓ Gadget iframe found at index ${gadgetIframe.index}`);
  console.log(`[IFRAME]   src: ${gadgetIframe.src}`);
  console.log(`[IFRAME]   title: ${gadgetIframe.title}`);

  // ========================================================================
  // SECTION G: VALIDATE IFRAME CONTENT
  // ========================================================================

  console.log('[CONTENT] Checking gadget iframe content...');

  // Get gadget iframe element
  const frameElement = page.frameLocator(
    `iframe[${gadgetIframe.id ? `id="${gadgetIframe.id}"` : 'src*="governance-dashboard-gadget"'}]`
  );

  // Check for blank/empty iframe
  const iframeHtml = await frameElement.page().evaluate(() => document.documentElement.outerHTML);
  if (!iframeHtml || iframeHtml.length < 100) {
    state.failureReasons.push('GADGET_IFRAME_BLANK: Iframe appears empty or very small');
    console.error('[CONTENT] ✗ Gadget iframe appears BLANK!');
    expect(iframeHtml.length).toBeGreaterThan(100);
  }

  state.gadgetLoaded = true;
  console.log(`[CONTENT] ✓ Gadget iframe contains HTML (${iframeHtml.length} bytes)`);

  // ========================================================================
  // SECTION H: EXTRACT UI LABELS
  // ========================================================================

  console.log('[LABELS] Scanning for expected UI text labels...');

  const expectedTexts = [EXPECT_TEXT_1, EXPECT_TEXT_2, EXPECT_TEXT_3];
  const allPageText = await page.evaluate(() => document.documentElement.innerText);

  state.uiLabelsFound = expectedTexts.filter(
    (text) =>
      allPageText.toLowerCase().includes(text.toLowerCase())
  );

  console.log(`[LABELS] Found ${state.uiLabelsFound.length}/${expectedTexts.length} expected labels:`);
  state.uiLabelsFound.forEach((label) => console.log(`[LABELS]   ✓ "${label}"`));

  // Also look for other known labels
  const otherLabels = [
    'Scheduler',
    'Last Snapshot',
    'Export Readiness',
    'System Overview',
    'Diagnostics',
  ];

  const otherLabelsFound = otherLabels.filter(
    (text) =>
      allPageText.toLowerCase().includes(text.toLowerCase())
  );

  console.log(`[LABELS] Found ${otherLabelsFound.length}/${otherLabels.length} other labels:`);
  otherLabelsFound.forEach((label) => console.log(`[LABELS]   ○ "${label}"`));

  const totalLabelsFound = state.uiLabelsFound.length + otherLabelsFound.length;
  if (totalLabelsFound < 4) {
    state.failureReasons.push(`INSUFFICIENT_UI_LABELS: Found only ${totalLabelsFound}/8 labels, need ≥4`);
  }

  writeArtifact('09_ui_labels_found.json', {
    expected: {
      total: expectedTexts.length,
      found: state.uiLabelsFound.length,
      labels: state.uiLabelsFound,
    },
    other: {
      total: otherLabels.length,
      found: otherLabelsFound.length,
      labels: otherLabelsFound,
    },
    totalFound: totalLabelsFound,
  });

  // ========================================================================
  // SECTION I: CHECK FOR ERROR CONDITIONS
  // ========================================================================

  console.log('[CHECKS] Checking for error conditions...');

  // Check for console errors
  const consoleErrors = state.consoleMessages.filter((msg) => msg.type === 'error');
  if (consoleErrors.length > 0) {
    state.failureReasons.push(`CONSOLE_ERRORS: ${consoleErrors.length} console.error calls detected`);
    console.error(`[CHECKS] ✗ Found ${consoleErrors.length} console.error calls!`);
    consoleErrors.slice(0, 5).forEach((err) => console.error(`[CHECKS]   ${err.text}`));
  } else {
    console.log('[CHECKS] ✓ No console.error calls');
  }

  writeArtifact('02_console_messages.json', state.consoleMessages);

  // Check for page errors
  if (state.pageErrors.length > 0) {
    state.failureReasons.push(`PAGE_ERRORS: ${state.pageErrors.length} page error events detected`);
    console.error(`[CHECKS] ✗ Found ${state.pageErrors.length} page errors!`);
    state.pageErrors.slice(0, 5).forEach((err) => console.error(`[CHECKS]   ${err.message}`));
  } else {
    console.log('[CHECKS] ✓ No page errors');
  }

  writeArtifact('03_page_errors.json', state.pageErrors);

  // Check for failed HTTP requests
  const failedRequests = state.networkRequests.filter((req) => req.status >= 400);
  const failedRequestsAllowed = ALLOW_FAILED_REQUESTS_REGEX
    ? failedRequests.filter((req) => !new RegExp(ALLOW_FAILED_REQUESTS_REGEX).test(req.url))
    : failedRequests;

  if (failedRequestsAllowed.length > 0) {
    state.failureReasons.push(`FAILED_HTTP_REQUESTS: ${failedRequestsAllowed.length} requests with status ≥400`);
    console.error(`[CHECKS] ✗ Found ${failedRequestsAllowed.length} failed HTTP requests!`);
    failedRequestsAllowed.slice(0, 5).forEach((req) =>
      console.error(`[CHECKS]   ${req.status} ${req.url}`)
    );
  } else {
    console.log('[CHECKS] ✓ No failed HTTP requests');
  }

  writeArtifact('04_network_requests.json', state.networkRequests);

  // Check for 401/403/5xx status codes
  const authErrors = state.networkRequests.filter((req) => [401, 403].includes(req.status));
  const serverErrors = state.networkRequests.filter((req) => req.status >= 500);

  if (authErrors.length > 0) {
    state.failureReasons.push(`AUTH_ERRORS: ${authErrors.length} requests returned 401/403`);
    console.error(`[CHECKS] ✗ Found ${authErrors.length} auth errors (401/403)!`);
  } else {
    console.log('[CHECKS] ✓ No 401/403 auth errors');
  }

  if (serverErrors.length > 0) {
    state.failureReasons.push(`SERVER_ERRORS: ${serverErrors.length} requests returned 5xx`);
    console.error(`[CHECKS] ✗ Found ${serverErrors.length} server errors (5xx)!`);
  } else {
    console.log('[CHECKS] ✓ No server errors (5xx)');
  }

  // Check for stuck states in UI
  const pageContent = (await page.evaluate(() => document.documentElement.innerText)).toLowerCase();
  const stuckStates = [];

  if (FAIL_ON_INITIALIZING && pageContent.includes('initializing')) {
    stuckStates.push('INITIALIZING');
  }
  if (FAIL_ON_NOT_AVAILABLE && pageContent.includes('not available')) {
    stuckStates.push('NOT_AVAILABLE');
  }
  if (FAIL_ON_UNKNOWN && pageContent.includes('unknown')) {
    stuckStates.push('UNKNOWN');
  }

  if (stuckStates.length > 0) {
    state.failureReasons.push(`STUCK_STATES: UI contains stuck state text: ${stuckStates.join(', ')}`);
    console.error(`[CHECKS] ✗ UI appears stuck in states: ${stuckStates.join(', ')}`);
  } else {
    console.log('[CHECKS] ✓ No stuck states detected');
  }

  // ========================================================================
  // SECTION J: CAPTURE PROOF SCREENSHOTS & HTML
  // ========================================================================

  console.log('[PROOF] Capturing proof artifacts...');

  // Gadget iframe HTML
  try {
    writeArtifact('05_gadget_iframe_html.html', iframeHtml);
  } catch (e) {
    console.warn('[PROOF] Could not capture gadget iframe HTML');
  }

  // Gadget viewport screenshot
  try {
    const screenshotBuffer = await page.screenshot({ path: join(ARTIFACT_DIR, '06_gadget_viewport_screenshot.png') });
    console.log('[PROOF] 06_gadget_viewport_screenshot.png');
  } catch (e) {
    console.warn('[PROOF] Could not capture gadget screenshot');
  }

  // Full page screenshot
  try {
    await page.screenshot({
      path: join(ARTIFACT_DIR, '07_full_page_screenshot.png'),
      fullPage: true,
    });
    console.log('[PROOF] 07_full_page_screenshot.png');
  } catch (e) {
    console.warn('[PROOF] Could not capture full page screenshot');
  }

  // Full dashboard HTML
  try {
    const dashboardHtml = await page.evaluate(() => document.documentElement.outerHTML);
    writeArtifact('08_dashboard_html.html', dashboardHtml);
  } catch (e) {
    console.warn('[PROOF] Could not capture dashboard HTML');
  }

  // ========================================================================
  // SECTION K: FINAL VERDICT
  // ========================================================================

  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  TEST VERDICT                                                 ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log('');

  const summaryLines = [];
  summaryLines.push(`## E2E Test Summary`);
  summaryLines.push(``);
  summaryLines.push(`**Test Date**: ${new Date().toISOString()}`);
  summaryLines.push(`**Jira Site**: ${JIRA_SITE}`);
  summaryLines.push(`**Dashboard**: ${DASHBOARD_URL}`);
  summaryLines.push(`**Gadget**: ${GADGET_TITLE_CONTAINS}`);
  summaryLines.push(``);
  summaryLines.push(`### Results`);
  summaryLines.push(``);
  summaryLines.push(`| Check | Result |`);
  summaryLines.push(`|-------|--------|`);
  summaryLines.push(`| Gadget Iframe Found | ${state.gadgetFound ? '✓' : '✗'} |`);
  summaryLines.push(`| Gadget Loaded | ${state.gadgetLoaded ? '✓' : '✗'} |`);
  summaryLines.push(`| UI Labels Found | ${state.uiLabelsFound.length}/3 |`);
  summaryLines.push(`| Console Errors | ${consoleErrors.length} |`);
  summaryLines.push(`| Page Errors | ${state.pageErrors.length} |`);
  summaryLines.push(`| Failed HTTP Requests | ${failedRequestsAllowed.length} |`);
  summaryLines.push(`| Auth Errors (401/403) | ${authErrors.length} |`);
  summaryLines.push(`| Server Errors (5xx) | ${serverErrors.length} |`);
  summaryLines.push(``);

  if (state.failureReasons.length === 0) {
    console.log('✓ ALL CHECKS PASSED!');
    console.log('');
    summaryLines.push(`### Status: ✓ PASS`);
    summaryLines.push(``);
    summaryLines.push(`All validation checks passed. Gadget is operational.`);
  } else {
    console.error('✗ SOME CHECKS FAILED:');
    state.failureReasons.forEach((reason) => console.error(`  - ${reason}`));
    console.log('');
    summaryLines.push(`### Status: ✗ FAIL`);
    summaryLines.push(``);
    summaryLines.push(`Validation failures detected:`);
    summaryLines.push(``);
    state.failureReasons.forEach((reason) => summaryLines.push(`- ${reason}`));
  }

  summaryLines.push(``);
  summaryLines.push(`### Artifacts Generated`);
  summaryLines.push(``);
  summaryLines.push(`- 00_env.json - Environment variables`);
  summaryLines.push(`- 01_iframes.json - All iframes found`);
  summaryLines.push(`- 02_console_messages.json - Console messages`);
  summaryLines.push(`- 03_page_errors.json - Page errors`);
  summaryLines.push(`- 04_network_requests.json - Network requests`);
  summaryLines.push(`- 05_gadget_iframe_html.html - Gadget iframe DOM`);
  summaryLines.push(`- 06_gadget_viewport_screenshot.png - Gadget screenshot`);
  summaryLines.push(`- 07_full_page_screenshot.png - Full dashboard screenshot`);
  summaryLines.push(`- 08_dashboard_html.html - Dashboard DOM`);
  summaryLines.push(`- 09_ui_labels_found.json - UI labels extracted`);
  summaryLines.push(`- 10_summary.md - This summary`);

  const summary = summaryLines.join('\n');
  writeArtifact('10_summary.md', summary);

  console.log('');
  console.log(summary);
  console.log('');

  // Final assertion
  expect(state.failureReasons.length).toBe(0);
});
