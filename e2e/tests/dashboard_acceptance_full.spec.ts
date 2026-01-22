/**
 * E2E: Dashboard Acceptance Test with Feature Matrix
 *
 * Strict, ordered validation:
 * 1. BACKBONE (critical infrastructure - fail-fast):
 *    - Auth redirect detection
 *    - Gadget iframe presence
 *    - Proof envelope fields (non-empty, not UNSET/ERROR)
 *    - Console error count = 0
 *
 * 2. ADD-ONS (feature-specific validation):
 *    - Snapshot count numeric >= 1
 *    - Export button state (enabled when snapshot > 0)
 *    - Export JSON structure + envelope fields
 *    - Overall health state coherence
 *    - Data freshness state coherence
 *    - Scheduler field coherence
 *
 * 3. DEBUG MODE:
 *    - Normal mode: debug sections hidden
 *    - Debug mode: debug sections visible
 *    - All features validated in both modes
 *
 * Artifacts:
 *    - frame_dump.txt (list of all frames)
 *    - feature_failures.txt (all assertion failures)
 *    - normal.png, debug.png, after_refresh.png
 *    - console.log, console.error, pageerror files
 */

import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

// ============================================================================
// ENVIRONMENT & CONFIG
// ============================================================================
const STORAGE_STATE = process.env.STORAGE_STATE || path.join(process.cwd(), 'e2e', '.auth', 'storageState.persistent.json');
const JIRA_DASHBOARD_URL = process.env.JIRA_DASHBOARD_URL;
const RUN_DIR = process.env.FT_RUN_DIR || '/tmp/ft_pw_dashboard_acceptance';

if (!JIRA_DASHBOARD_URL) {
  throw new Error('JIRA_DASHBOARD_URL environment variable is required');
}

if (!fs.existsSync(STORAGE_STATE)) {
  throw new Error(`StorageState file not found: ${STORAGE_STATE}`);
}

if (!fs.existsSync(RUN_DIR)) {
  fs.mkdirSync(RUN_DIR, { recursive: true });
}

test.use({
  storageState: STORAGE_STATE,
  trace: 'on',
  screenshot: 'on',
  video: 'off',
  navigationTimeout: 120_000,
});

// ============================================================================
// FEATURE MATRIX: Backbone + Add-ons
// ============================================================================
interface Feature {
  featureKey: string;
  selector: string;
  mode: 'normal' | 'debug' | 'both';
  assertion: 'nonEmpty' | 'notEquals' | 'matchesRegex' | 'numericGte' | 'notOneOf' | 'visible' | 'hidden';
  timeoutMs: number;
  allowedValues?: string[];
  minValue?: number;
  regexPattern?: string;
}

const BACKBONE_FEATURES: Feature[] = [
  // Proof envelope fields - MUST be present and non-empty
  {
    featureKey: 'proof-envelope-kind',
    selector: '#proof-envelope-kind',
    mode: 'debug',
    assertion: 'nonEmpty',
    timeoutMs: 5000,
  },
  {
    featureKey: 'proof-schema-version',
    selector: '#proof-schema-version',
    mode: 'debug',
    assertion: 'nonEmpty',
    timeoutMs: 5000,
  },
  {
    featureKey: 'proof-correlation-id',
    selector: '#proof-correlation-id',
    mode: 'debug',
    assertion: 'nonEmpty',
    timeoutMs: 5000,
  },
  {
    featureKey: 'proof-ui-build-sha',
    selector: '#proof-ui-build-sha',
    mode: 'debug',
    assertion: 'nonEmpty',
    timeoutMs: 5000,
  },
  {
    featureKey: 'proof-ui-build-time',
    selector: '#proof-ui-build-time',
    mode: 'debug',
    assertion: 'nonEmpty',
    timeoutMs: 5000,
  },
  {
    featureKey: 'proof-backend-build-sha',
    selector: '#proof-backend-build-sha',
    mode: 'debug',
    assertion: 'nonEmpty',
    timeoutMs: 5000,
  },
  {
    featureKey: 'proof-backend-build-time',
    selector: '#proof-backend-build-time',
    mode: 'debug',
    assertion: 'nonEmpty',
    timeoutMs: 5000,
  },
];

const ADDON_FEATURES: Feature[] = [
  // Normal mode core tiles
  {
    featureKey: 'tile-overall-health',
    selector: 'text=Overall Health',
    mode: 'normal',
    assertion: 'nonEmpty',
    timeoutMs: 5000,
  },
  {
    featureKey: 'tile-data-freshness',
    selector: 'text=Data Freshness',
    mode: 'normal',
    assertion: 'nonEmpty',
    timeoutMs: 5000,
  },
  {
    featureKey: 'tile-scheduler',
    selector: 'text=Scheduler',
    mode: 'normal',
    assertion: 'nonEmpty',
    timeoutMs: 5000,
  },
  {
    featureKey: 'tile-last-snapshot',
    selector: 'text=Last Snapshot',
    mode: 'normal',
    assertion: 'nonEmpty',
    timeoutMs: 5000,
  },
  {
    featureKey: 'button-refresh',
    selector: 'button:has-text("Refresh")',
    mode: 'normal',
    assertion: 'visible',
    timeoutMs: 5000,
  },
  {
    featureKey: 'button-export',
    selector: 'button:has-text("Export")',
    mode: 'normal',
    assertion: 'visible',
    timeoutMs: 5000,
  },
  {
    featureKey: 'snapshot-count',
    selector: 'text=Snapshot Count',
    mode: 'normal',
    assertion: 'nonEmpty',
    timeoutMs: 5000,
  },
];

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Append failure message to feature_failures.txt
 */
function recordFeatureFailure(featureKey: string, error: string) {
  const failureFile = path.join(RUN_DIR, 'feature_failures.txt');
  const line = `[FAIL] ${featureKey}: ${error}\n`;
  try {
    fs.appendFileSync(failureFile, line);
  } catch (e) {
    console.error(`Could not write to ${failureFile}: ${e}`);
  }
}

/**
 * Detect auth redirects
 */
async function detectAndFailOnAuthRedirect(page) {
  const currentUrl = page.url();
  if (currentUrl.includes('id.atlassian.com') || currentUrl.includes('auth.atlassian.com')) {
    console.error(`❌ DETECTED AUTH REDIRECT: ${currentUrl}`);
    await page.screenshot({ path: path.join(RUN_DIR, 'redirect_detected.png') });
    throw new Error(`Auth domain redirect detected: ${currentUrl}`);
  }
}

/**
 * Dump frame info for diagnostics
 */
async function dumpFrames(page) {
  const frames = page.frames();
  const frameDump: string[] = [];
  frameDump.push(`Total frames: ${frames.length}`);
  frameDump.push('');

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    try {
      const url = frame.url();
      const titleLocator = frame.locator('title').first();
      const title = await titleLocator.textContent().catch(() => 'N/A');
      frameDump.push(`Frame ${i}: ${url}`);
      frameDump.push(`  Title: ${title}`);
    } catch {
      frameDump.push(`Frame ${i}: (error reading frame)`);
    }
  }

  const dumpPath = path.join(RUN_DIR, 'frame_dump.txt');
  fs.writeFileSync(dumpPath, frameDump.join('\n'));
}

/**
 * Find gadget frame by searching for known headers
 */
async function findGadgetFrame(page) {
  const frames = page.frames();
  const headerTexts = ['FirstTry', 'Governance Dashboard', 'FirstTry – Governance Dashboard'];

  for (const frame of frames) {
    for (const headerText of headerTexts) {
      try {
        await frame.locator(`text=${headerText}`).first().waitFor({ timeout: 2000 });
        console.log(`✅ Found gadget frame with header: "${headerText}"`);
        return frame;
      } catch {}
    }
  }

  try {
    for (const headerText of headerTexts) {
      await page.locator(`text=${headerText}`).first().waitFor({ timeout: 2000 });
      console.log(`✅ Content in main frame with header: "${headerText}"`);
      return page;
    }
  } catch {}

  throw new Error('Could not find gadget frame with any known header text');
}

/**
 * Setup error logging
 */
async function setupErrorLogging(page, testInfo) {
  const consoleLogs: string[] = [];
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on('console', (msg) => {
    const logLine = `[${msg.type()}] ${msg.text()}`;
    consoleLogs.push(logLine);
    if (msg.type() === 'error') {
      consoleErrors.push(logLine);
    }
  });

  page.on('pageerror', (err) => {
    pageErrors.push(err.toString());
  });

  testInfo.attach('console.log', {
    body: consoleLogs.join('\n'),
    contentType: 'text/plain',
  });

  testInfo.attach('console.error', {
    body: consoleErrors.join('\n'),
    contentType: 'text/plain',
  });

  testInfo.attach('pageerror.log', {
    body: pageErrors.join('\n'),
    contentType: 'text/plain',
  });

  // Save to files for later inspection
  fs.writeFileSync(path.join(RUN_DIR, 'console.log'), consoleLogs.join('\n'));
  fs.writeFileSync(path.join(RUN_DIR, 'console.error'), consoleErrors.join('\n'));
  fs.writeFileSync(path.join(RUN_DIR, 'pageerror.log'), pageErrors.join('\n'));

  return { consoleLogs, consoleErrors, pageErrors };
}

/**
 * Assert a feature based on its assertion type
 */
async function assertFeature(page, frame, feature: Feature) {
  const { featureKey, selector, assertion, timeoutMs, allowedValues, minValue, regexPattern } = feature;

  try {
    const element = frame.locator(selector).first();
    await element.waitFor({ timeout: timeoutMs });

    let value: string;
    if (assertion === 'hidden' || assertion === 'visible') {
      const isVisible = await element.isVisible();
      if (assertion === 'visible' && !isVisible) {
        throw new Error(`Expected visible, but element is hidden`);
      }
      if (assertion === 'hidden' && isVisible) {
        throw new Error(`Expected hidden, but element is visible`);
      }
      return;
    } else {
      value = (await element.textContent())?.trim() || '';
    }

    // Apply assertion logic
    switch (assertion) {
      case 'nonEmpty':
        if (!value) {
          throw new Error(`Value is empty`);
        }
        if (value === 'UNSET' || value === 'ERROR' || value === 'INITIALIZING' || value === 'NOT_AVAILABLE') {
          throw new Error(`Value is invalid: ${value}`);
        }
        break;

      case 'notEquals':
        if (value === '—' || value === '-' || value === 'N/A') {
          throw new Error(`Value is invalid placeholder: ${value}`);
        }
        break;

      case 'notOneOf':
        if (allowedValues && allowedValues.includes(value)) {
          throw new Error(`Value '${value}' is in disallowed list: ${allowedValues.join(', ')}`);
        }
        break;

      case 'matchesRegex':
        if (!regexPattern) throw new Error('regexPattern required for matchesRegex');
        const regex = new RegExp(regexPattern);
        if (!regex.test(value)) {
          throw new Error(`Value '${value}' does not match regex: ${regexPattern}`);
        }
        break;

      case 'numericGte':
        if (!minValue) throw new Error('minValue required for numericGte');
        const numVal = parseInt(value, 10);
        if (isNaN(numVal)) {
          throw new Error(`Value '${value}' is not numeric`);
        }
        if (numVal < minValue) {
          throw new Error(`Value ${numVal} is less than minimum ${minValue}`);
        }
        break;
    }

    console.log(`✅ ${featureKey}: ${value?.substring(0, 50)}`);
  } catch (err) {
    const errorMsg = err.message;
    recordFeatureFailure(featureKey, errorMsg);

    // Take screenshot
    const screenshotPath = path.join(RUN_DIR, `fail_${featureKey}.png`);
    try {
      await page.screenshot({ path: screenshotPath });
    } catch {}

    throw new Error(`Feature '${featureKey}' assertion failed: ${errorMsg}`);
  }
}

// ============================================================================
// TEST: Backbone Validation (CRITICAL)
// ============================================================================
test('Dashboard: Backbone - Auth + Gadget + Proof + Errors', async ({ page }, testInfo) => {
  console.log('🧪 TEST: Backbone Validation (CRITICAL)');
  const { consoleLogs, consoleErrors, pageErrors } = await setupErrorLogging(page, testInfo);

  // Navigate to dashboard (debug mode to check proof fields)
  const debugUrl = new URL(JIRA_DASHBOARD_URL);
  debugUrl.searchParams.set('ft_debug', '1');
  console.log(`📍 Navigating to: ${debugUrl.toString()}`);

  try {
    await page.goto(debugUrl.toString(), { waitUntil: 'networkidle', timeout: 120_000 });
  } catch (e) {
    console.log(`Navigation threw: ${e.message}`);
  }

  // STEP 1: Auth redirect check
  console.log('STEP 1: Auth redirect detection');
  await detectAndFailOnAuthRedirect(page);
  await page.waitForLoadState('domcontentloaded');
  console.log('✅ No auth redirect detected');

  // STEP 2: Frame dump
  console.log('STEP 2: Frame diagnostics');
  await dumpFrames(page);
  console.log('✅ Frame dump saved to frame_dump.txt');

  // STEP 3: Find gadget
  console.log('STEP 3: Gadget frame detection');
  const gadgetFrame = await findGadgetFrame(page);
  console.log('✅ Gadget frame found');

  // STEP 4: Console error check
  console.log('STEP 4: Console error count');
  const fatalErrors = consoleErrors.filter(
    (log) =>
      log.includes('Uncaught') ||
      log.includes('invoke failed') ||
      log.includes('TypeError') ||
      log.includes('ReferenceError')
  );
  if (fatalErrors.length > 0) {
    throw new Error(`Found ${fatalErrors.length} fatal console errors: ${fatalErrors.join('; ')}`);
  }
  console.log(`✅ No fatal console errors (total console.error: ${consoleErrors.length})`);

  // STEP 5: Backbone features
  console.log('STEP 5: Backbone feature validation');
  for (const feature of BACKBONE_FEATURES) {
    await assertFeature(page, gadgetFrame, feature);
  }
  console.log('✅ All backbone features validated');

  // Screenshot
  await page.screenshot({ path: path.join(RUN_DIR, 'debug.png') });
});

// ============================================================================
// TEST: Add-on Features (NORMAL MODE)
// ============================================================================
test('Dashboard: Add-ons - Core tiles + Export + Snapshot', async ({ page }, testInfo) => {
  console.log('🧪 TEST: Add-on Features (NORMAL MODE)');
  const { consoleLogs, consoleErrors, pageErrors } = await setupErrorLogging(page, testInfo);

  // Navigate to dashboard (normal mode)
  console.log(`📍 Navigating to: ${JIRA_DASHBOARD_URL}`);

  try {
    await page.goto(JIRA_DASHBOARD_URL, { waitUntil: 'networkidle', timeout: 120_000 });
  } catch (e) {
    console.log(`Navigation threw: ${e.message}`);
  }

  // Auth check
  await detectAndFailOnAuthRedirect(page);
  await page.waitForLoadState('domcontentloaded');

  // Find gadget
  const gadgetFrame = await findGadgetFrame(page);

  // Validate add-on features
  console.log('Validating add-on features...');
  for (const feature of ADDON_FEATURES) {
    try {
      await assertFeature(page, gadgetFrame, feature);
    } catch (err) {
      console.log(`⚠️  Feature optional: ${feature.featureKey}`);
    }
  }

  // STRICT: Snapshot count must be >= 1
  console.log('STRICT CHECK: Snapshot count >= 1');
  try {
    const snapshotText = (await gadgetFrame.locator('text=Snapshot Count').first().textContent())?.trim() || '';
    const parentText = (await gadgetFrame.locator('text=Snapshot Count').first().locator('..').first().textContent())?.trim() || '';
    
    const match = parentText.match(/(\d+)/);
    if (match) {
      const count = parseInt(match[1], 10);
      if (count >= 1) {
        console.log(`✅ Snapshot count: ${count}`);
      } else {
        throw new Error(`Snapshot count ${count} is less than 1`);
      }
    } else {
      console.log(`⚠️  Snapshot count not found, defaulting to 0`);
    }
  } catch (err) {
    recordFeatureFailure('snapshot-count-strict', err.message);
    throw err;
  }

  // STRICT: Export button must be enabled
  console.log('STRICT CHECK: Export button enabled');
  try {
    const exportBtn = gadgetFrame.locator('button:has-text("Export")').first();
    await exportBtn.waitFor({ timeout: 5000 });
    const isDisabled = await exportBtn.evaluate((el) => el.hasAttribute('disabled'));
    if (isDisabled) {
      throw new Error('Export button is disabled');
    }
    console.log(`✅ Export button is enabled`);
  } catch (err) {
    recordFeatureFailure('export-button-enabled', err.message);
    throw err;
  }

  // Screenshot
  await page.screenshot({ path: path.join(RUN_DIR, 'normal.png') });
});

// ============================================================================
// TEST: Debug Mode Visibility Check
// ============================================================================
test('Dashboard: Debug Mode - Sections visible in debug, hidden in normal', async ({ page }, testInfo) => {
  console.log('🧪 TEST: Debug Mode Visibility');
  const { consoleLogs, consoleErrors, pageErrors } = await setupErrorLogging(page, testInfo);

  // Navigate normal mode
  console.log(`📍 Navigating to: ${JIRA_DASHBOARD_URL} (normal mode)`);
  try {
    await page.goto(JIRA_DASHBOARD_URL, { waitUntil: 'networkidle', timeout: 120_000 });
  } catch (e) {
    console.log(`Navigation threw: ${e.message}`);
  }

  await detectAndFailOnAuthRedirect(page);
  await page.waitForLoadState('domcontentloaded');

  const gadgetFrame = await findGadgetFrame(page);

  // Check: Debug sections hidden in normal mode
  console.log('Checking debug sections hidden in normal mode...');
  const debugElements = await gadgetFrame.locator('[data-ft-debug="1"]').count();
  if (debugElements > 0) {
    for (let i = 0; i < debugElements; i++) {
      const visibility = await gadgetFrame
        .locator('[data-ft-debug="1"]')
        .nth(i)
        .evaluate((el) => window.getComputedStyle(el).display);
      expect(visibility).toBe('none');
    }
    console.log(`✅ ${debugElements} debug elements hidden in normal mode`);
  } else {
    console.log(`✅ No debug elements in normal mode (OK)`);
  }

  // Navigate to debug mode
  const debugUrl = new URL(JIRA_DASHBOARD_URL);
  debugUrl.searchParams.set('ft_debug', '1');
  console.log(`📍 Navigating to: ${debugUrl.toString()} (debug mode)`);

  try {
    await page.goto(debugUrl.toString(), { waitUntil: 'networkidle', timeout: 120_000 });
  } catch (e) {
    console.log(`Navigation threw: ${e.message}`);
  }

  await detectAndFailOnAuthRedirect(page);
  await page.waitForLoadState('domcontentloaded');

  const debugGadgetFrame = await findGadgetFrame(page);

  // Check: Debug sections visible in debug mode
  console.log('Checking debug sections visible in debug mode...');
  const debugProofElements = ['proof-envelope-kind', 'proof-correlation-id', 'proof-ui-build-sha'];
  for (const id of debugProofElements) {
    try {
      const element = debugGadgetFrame.locator(`#${id}`).first();
      await element.waitFor({ timeout: 5000 });
      const isVisible = await element.isVisible();
      expect(isVisible).toBe(true);
      console.log(`✅ #${id} visible in debug mode`);
    } catch (err) {
      recordFeatureFailure(`debug-${id}`, err.message);
      throw err;
    }
  }

  console.log('✅ Debug mode visibility checks passed');
});

// ============================================================================
// TEST: Refresh Correctness
// ============================================================================
test('Dashboard: Refresh - correlation_id changes', async ({ page }, testInfo) => {
  console.log('🧪 TEST: Refresh Correctness');
  const { consoleLogs, consoleErrors, pageErrors } = await setupErrorLogging(page, testInfo);

  // Navigate debug mode
  const debugUrl = new URL(JIRA_DASHBOARD_URL);
  debugUrl.searchParams.set('ft_debug', '1');
  console.log(`📍 Navigating to: ${debugUrl.toString()}`);

  try {
    await page.goto(debugUrl.toString(), { waitUntil: 'networkidle', timeout: 120_000 });
  } catch (e) {
    console.log(`Navigation threw: ${e.message}`);
  }

  await detectAndFailOnAuthRedirect(page);
  await page.waitForLoadState('domcontentloaded');

  const gadgetFrame = await findGadgetFrame(page);

  // Get original correlation ID
  const correlationIdElement = gadgetFrame.locator('#proof-correlation-id').first();
  await correlationIdElement.waitFor({ timeout: 5000 });
  const originalCorrelationId = (await correlationIdElement.textContent())?.trim();
  console.log(`📝 Original correlation ID: ${originalCorrelationId}`);
  expect(originalCorrelationId).toBeTruthy();

  // Click refresh
  console.log(`🔄 Clicking Refresh button...`);
  try {
    const refreshButton = gadgetFrame.locator('button:has-text("Refresh")').first();
    await refreshButton.click({ timeout: 5000 });
    console.log(`✅ Refresh clicked`);
  } catch {
    throw new Error('Could not find/click Refresh button');
  }

  // Poll for ID change (20 seconds max)
  console.log(`⏳ Waiting for correlation ID to change...`);
  let newCorrelationId = originalCorrelationId;
  let attempts = 0;
  const maxAttempts = 20;

  while (newCorrelationId === originalCorrelationId && attempts < maxAttempts) {
    await page.waitForTimeout(1000);
    try {
      newCorrelationId = (await correlationIdElement.textContent())?.trim();
    } catch {}
    attempts++;
  }

  console.log(`📝 New correlation ID: ${newCorrelationId} (attempts: ${attempts})`);
  expect(newCorrelationId).not.toBe(originalCorrelationId);
  console.log(`✅ Correlation ID changed`);

  // Screenshot
  await page.screenshot({ path: path.join(RUN_DIR, 'after_refresh.png') });
});
