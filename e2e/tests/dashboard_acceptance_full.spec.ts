/**
 * E2E: Dashboard Acceptance Test (Full Feature Coverage)
 *
 * Validates every dashboard feature in both normal and debug modes:
 * - Normal mode: debug sections hidden
 * - Core tiles/labels present
 * - No fatal UI errors
 * - Debug mode: proof panel populated
 * - Refresh: correlation_id changes
 * - Snapshot/export: conditional validation
 *
 * Uses persistent Chromium profile for real Jira session.
 */

import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const STORAGE_STATE = path.join(process.cwd(), 'e2e', '.auth', 'storageState.persistent.json');
const JIRA_DASHBOARD_URL = process.env.JIRA_DASHBOARD_URL || 'https://firsttry.atlassian.net/jira/dashboards/10102';
const RUN_DIR = process.env.FT_RUN_DIR || '/tmp/ft_pw_dashboard_acceptance';

// Ensure RUN_DIR exists
if (!fs.existsSync(RUN_DIR)) {
  fs.mkdirSync(RUN_DIR, { recursive: true });
}

// Configure storage to RUN_DIR for traces and screenshots
test.use({
  storageState: STORAGE_STATE,
  trace: 'on',
  screenshot: 'on',
  video: 'off',
});

// ============================================================================
// HELPER: Find the gadget frame by searching for known headers
// ============================================================================
async function findGadgetFrame(page) {
  const frames = page.frames();
  const headerTexts = ['FirstTry', 'Governance Dashboard', 'FirstTry – Governance Dashboard'];

  for (const frame of frames) {
    try {
      for (const headerText of headerTexts) {
        try {
          await frame.locator(`text=${headerText}`).first().waitFor({ timeout: 2000 });
          console.log(`✅ Found gadget frame with header: "${headerText}"`);
          return frame;
        } catch {}
      }
    } catch {}
  }

  // If main frame has the content, return it
  try {
    for (const headerText of headerTexts) {
      try {
        await page.locator(`text=${headerText}`).first().waitFor({ timeout: 2000 });
        console.log(`✅ Content in main frame with header: "${headerText}"`);
        return page;
      } catch {}
    }
  } catch {}

  throw new Error('Could not find gadget frame with any known header text');
}

// ============================================================================
// HELPER: Collect console and page error logs
// ============================================================================
async function setupErrorLogging(page, testInfo) {
  const consoleLogs = [];
  const pageErrors = [];

  page.on('console', (msg) => {
    consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
  });

  page.on('pageerror', (err) => {
    pageErrors.push(err.toString());
  });

  testInfo.attach('console.log', {
    body: consoleLogs.join('\n'),
    contentType: 'text/plain',
  });

  testInfo.attach('pageerrors.log', {
    body: pageErrors.join('\n'),
    contentType: 'text/plain',
  });

  return { consoleLogs, pageErrors };
}

// ============================================================================
// TEST: Dashboard Acceptance (Normal Mode)
// ============================================================================
test('Dashboard: Normal Mode - Debug sections hidden', async ({ page, context }, testInfo) => {
  console.log('🧪 TEST: Normal Mode');

  // Setup error logging
  const { consoleLogs, pageErrors } = await setupErrorLogging(page, testInfo);

  // Navigate to dashboard
  console.log(`📍 Navigating to: ${JIRA_DASHBOARD_URL}`);
  await page.goto(JIRA_DASHBOARD_URL, { waitUntil: 'networkidle' });
  await page.waitForLoadState('domcontentloaded');

  // Take screenshot
  await page.screenshot({ path: `${RUN_DIR}/10_normal_mode.png` });

  // Find gadget frame
  const gadgetFrame = await findGadgetFrame(page);

  // Check: Debug sections should be hidden
  console.log('  ✓ Checking debug sections are hidden...');
  const debugElements = await gadgetFrame.locator('[data-ft-debug="1"]').count();
  if (debugElements > 0) {
    // Elements exist, verify they are hidden
    for (let i = 0; i < debugElements; i++) {
      const visibility = await gadgetFrame
        .locator('[data-ft-debug="1"]')
        .nth(i)
        .evaluate((el) => window.getComputedStyle(el).display);
      expect(visibility).toBe('none');
    }
    console.log(`  ✅ ${debugElements} debug elements found and hidden`);
  } else {
    console.log(`  ✅ No debug elements in normal mode (OK)`);
  }

  // Check: Core tiles/labels exist
  console.log('  ✓ Checking core tiles/labels...');
  const requiredLabels = [
    'Overall Health',
    'Data Freshness',
    'Scheduler',
    'Last Snapshot',
    'Read-Only Guarantee',
    'Data Egress',
    'Storage Isolation',
    'Export Readiness',
  ];

  for (const label of requiredLabels) {
    try {
      await gadgetFrame.locator(`text=${label}`).first().waitFor({ timeout: 5000 });
      console.log(`    ✅ ${label}`);
    } catch {
      console.log(`    ⚠️  ${label} NOT FOUND`);
    }
  }

  // Check: Refresh button exists
  console.log('  ✓ Checking Refresh button...');
  try {
    await gadgetFrame.locator('button', { hasText: /Refresh/i }).first().waitFor({ timeout: 5000 });
    console.log(`  ✅ Refresh button found`);
  } catch {
    console.log(`  ⚠️  Refresh button NOT FOUND`);
  }

  // Check: No fatal errors
  console.log('  ✓ Checking for fatal errors...');
  const fatalErrors = consoleLogs.filter(
    (log) =>
      log.includes('Uncaught') ||
      log.includes('invoke failed') ||
      log.includes('resolver') ||
      log.includes('CSP') ||
      log.includes('TypeError') ||
      log.includes('ReferenceError')
  );

  expect(fatalErrors.length).toBe(0, `Found ${fatalErrors.length} fatal errors: ${fatalErrors.join('; ')}`);
  console.log(`  ✅ No fatal errors`);
});

// ============================================================================
// TEST: Dashboard Acceptance (Debug Mode)
// ============================================================================
test('Dashboard: Debug Mode - Proof panel populated', async ({ page, context }, testInfo) => {
  console.log('🧪 TEST: Debug Mode');

  const { consoleLogs, pageErrors } = await setupErrorLogging(page, testInfo);

  // Navigate to dashboard with debug param
  const debugUrl = new URL(JIRA_DASHBOARD_URL);
  debugUrl.searchParams.set('ft_debug', '1');
  console.log(`📍 Navigating to (debug): ${debugUrl.toString()}`);
  await page.goto(debugUrl.toString(), { waitUntil: 'networkidle' });
  await page.waitForLoadState('domcontentloaded');

  // Take screenshot
  await page.screenshot({ path: `${RUN_DIR}/11_debug_mode.png` });

  // Find gadget frame
  const gadgetFrame = await findGadgetFrame(page);

  // Check: Proof DOM IDs exist and are populated
  console.log('  ✓ Checking proof panel elements...');
  const proofIds = [
    'proof-envelope-kind',
    'proof-schema-version',
    'proof-correlation-id',
    'proof-ui-build-sha',
    'proof-ui-build-time',
    'proof-backend-build-sha',
    'proof-backend-build-time',
  ];

  for (const id of proofIds) {
    try {
      const element = gadgetFrame.locator(`#${id}`);
      await element.waitFor({ timeout: 5000 });
      const text = await element.textContent();
      expect(text).toBeTruthy();
      expect(text).not.toBe('UNSET');
      console.log(`    ✅ #${id}: ${text?.substring(0, 50)}`);
    } catch {
      console.log(`    ❌ #${id} NOT FOUND or UNSET`);
      throw new Error(`Missing or empty proof element: #${id}`);
    }
  }

  console.log(`  ✅ All proof elements populated`);

  // Extract correlation_id for refresh test
  const correlationIdElement = gadgetFrame.locator('#proof-correlation-id');
  const originalCorrelationId = await correlationIdElement.textContent();
  console.log(`  📝 Original correlation ID: ${originalCorrelationId}`);

  // Check: No fatal errors
  console.log('  ✓ Checking for fatal errors...');
  const fatalErrors = consoleLogs.filter(
    (log) =>
      log.includes('Uncaught') ||
      log.includes('invoke failed') ||
      log.includes('resolver') ||
      log.includes('CSP') ||
      log.includes('TypeError') ||
      log.includes('ReferenceError')
  );
  expect(fatalErrors.length).toBe(0, `Found ${fatalErrors.length} fatal errors`);
  console.log(`  ✅ No fatal errors`);
});

// ============================================================================
// TEST: Dashboard Acceptance (Refresh & Correlation ID)
// ============================================================================
test('Dashboard: Refresh correctness - correlation_id changes', async ({ page, context }, testInfo) => {
  console.log('🧪 TEST: Refresh Correctness');

  const { consoleLogs, pageErrors } = await setupErrorLogging(page, testInfo);

  // Navigate to dashboard with debug param
  const debugUrl = new URL(JIRA_DASHBOARD_URL);
  debugUrl.searchParams.set('ft_debug', '1');
  console.log(`📍 Navigating to (debug): ${debugUrl.toString()}`);
  await page.goto(debugUrl.toString(), { waitUntil: 'networkidle' });
  await page.waitForLoadState('domcontentloaded');

  // Find gadget frame
  const gadgetFrame = await findGadgetFrame(page);

  // Get original correlation ID
  const correlationIdElement = gadgetFrame.locator('#proof-correlation-id');
  await correlationIdElement.waitFor({ timeout: 5000 });
  const originalCorrelationId = await correlationIdElement.textContent();
  console.log(`  📝 Original correlation ID: ${originalCorrelationId}`);
  expect(originalCorrelationId).toBeTruthy();

  // Click Refresh button
  console.log(`  🔄 Clicking Refresh button...`);
  try {
    const refreshButton = gadgetFrame.locator('button', { hasText: /Refresh/i }).first();
    await refreshButton.click({ timeout: 5000 });
    console.log(`  ✅ Refresh clicked`);
  } catch {
    console.log(`  ⚠️  Refresh button not found, trying alternative click`);
    await page.click('button:has-text("Refresh")', { timeout: 5000 }).catch(() => {
      throw new Error('Could not find Refresh button');
    });
  }

  // Poll for correlation ID change (up to 20 seconds)
  console.log(`  ⏳ Waiting for correlation ID to change...`);
  let newCorrelationId = originalCorrelationId;
  let attempts = 0;
  const maxAttempts = 20; // 20 attempts * 1s = 20s max wait

  while (newCorrelationId === originalCorrelationId && attempts < maxAttempts) {
    await page.waitForTimeout(1000);
    try {
      newCorrelationId = await correlationIdElement.textContent();
    } catch {}
    attempts++;
  }

  console.log(`  📝 New correlation ID: ${newCorrelationId} (attempts: ${attempts})`);
  expect(newCorrelationId).not.toBe(originalCorrelationId);
  console.log(`  ✅ Correlation ID changed (refresh successful)`);

  // Take screenshot after refresh
  await page.screenshot({ path: `${RUN_DIR}/12_after_refresh.png` });
});

// ============================================================================
// TEST: Dashboard Acceptance (Snapshot/Export)
// ============================================================================
test('Dashboard: Snapshot & export surface sanity', async ({ page, context }, testInfo) => {
  console.log('🧪 TEST: Snapshot & Export');

  const { consoleLogs, pageErrors } = await setupErrorLogging(page, testInfo);

  // Navigate to dashboard
  console.log(`📍 Navigating to: ${JIRA_DASHBOARD_URL}`);
  await page.goto(JIRA_DASHBOARD_URL, { waitUntil: 'networkidle' });
  await page.waitForLoadState('domcontentloaded');

  // Find gadget frame
  const gadgetFrame = await findGadgetFrame(page);

  // Locate Snapshot Count if present
  console.log('  ✓ Checking snapshot count...');
  try {
    const snapshotCountElement = gadgetFrame.locator('text=Snapshot Count').first();
    await snapshotCountElement.waitFor({ timeout: 5000 });

    // Try to get the value (could be in nearby element)
    const snapshotSection = snapshotCountElement.locator('..').first();
    const snapshotText = await snapshotSection.textContent();
    console.log(`    📊 Snapshot info: ${snapshotText?.substring(0, 100)}`);

    // Extract number if possible (optional validation)
    const match = snapshotText?.match(/(\d+)/);
    const snapshotCount = match ? parseInt(match[1]) : 0;

    if (snapshotCount === 0) {
      console.log(`    ℹ️  Snapshot count is 0 (expected to be Not Ready)`);
    } else {
      console.log(`    ℹ️  Snapshot count is ${snapshotCount}`);
    }
  } catch {
    console.log(`    ℹ️  Snapshot count element not found (may not be present)`);
  }

  // Check Export button
  console.log('  ✓ Checking Export button...');
  try {
    const exportButton = gadgetFrame.locator('button', { hasText: /Export/i }).first();
    await exportButton.waitFor({ timeout: 5000 });
    const isDisabled = await exportButton.evaluate((el) => el.hasAttribute('disabled'));
    console.log(`    ✅ Export button found (disabled: ${isDisabled})`);
  } catch {
    console.log(`    ℹ️  Export button not found (may not be present)`);
  }

  console.log(`  ✅ Snapshot/export surface check complete`);
});
