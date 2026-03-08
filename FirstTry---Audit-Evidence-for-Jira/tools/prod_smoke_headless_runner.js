#!/usr/bin/env node
/**
 * Production Customer Smoke Runner (Headless, API Token Auth)
 * 
 * Produces the same evidence as e2e/prod_customer_smoke.spec.ts but works
 * without manual login by injecting Basic auth headers on every request.
 * 
 * Usage:
 *   FT_TARGET_URL="https://firsttry.atlassian.net/jira/dashboards/10102" \
 *   FT_EVIDENCE_DIR="/tmp/evidence" \
 *   FORGE_EMAIL="contact@firsttry.run" \
 *   JIRA_API_TOKEN="..." \
 *   node tools/prod_smoke_headless_runner.js
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const TARGET_URL = process.env.FT_TARGET_URL;
  const evidenceDir = process.env.FT_EVIDENCE_DIR || `/tmp/ft_pw_prod_smoke_${new Date().toISOString().replace(/[:.]/g, '')}`;
  const email = process.env.FORGE_EMAIL || 'contact@firsttry.run';
  const token = process.env.JIRA_API_TOKEN;
  const storagePath = process.env.FT_STORAGE_STATE_PATH || '/tmp/ft_storage_state.json';

  if (!TARGET_URL) {
    console.error('FAIL: FT_TARGET_URL not set');
    process.exit(1);
  }
  if (!token) {
    console.error('FAIL: JIRA_API_TOKEN not set');
    process.exit(1);
  }

  fs.mkdirSync(evidenceDir, { recursive: true });

  const auth = Buffer.from(`${email}:${token}`).toString('base64');
  const siteOrigin = new URL(TARGET_URL).origin;
  console.log(`Target: ${TARGET_URL}`);
  console.log(`Evidence: ${evidenceDir}`);
  console.log(`Auth: Basic (${email}) — scoped to ${siteOrigin}`);

  const browser = await chromium.launch({ headless: true });

  // Context: use storage state cookies if available (NO global extraHTTPHeaders
  // to avoid CORS preflight failures on CDN cross-origin requests)
  const contextOpts = {};
  if (fs.existsSync(storagePath)) {
    contextOpts.storageState = storagePath;
    console.log(`Using storageState: ${storagePath}`);
  }

  const context = await browser.newContext(contextOpts);
  const page = await context.newPage();

  // Selectively inject Basic auth ONLY for same-origin requests
  await page.route(`${siteOrigin}/**`, async (route) => {
    const headers = { ...route.request().headers(), 'Authorization': `Basic ${auth}` };
    await route.continue({ headers });
  });

  const consoleLines = [];
  const pageErrors = [];

  page.on('console', (msg) => consoleLines.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', (err) => pageErrors.push(String(err)));

  // Navigate to the target page
  console.log('Navigating...');
  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(6000);

  // Wait for Forge gadget iframe to appear (optional, best-effort)
  const iframeLocator = page.locator('iframe[id*="forge"]').first();
  const hasIframe = await iframeLocator.isVisible({ timeout: 10000 }).catch(() => false);
  console.log(`Forge iframe detected: ${hasIframe}`);

  // If gadget renders in an iframe, switch context
  let gadgetPage = page;
  if (hasIframe) {
    const frame = await iframeLocator.contentFrame();
    if (frame) {
      console.log('Switched to Forge gadget iframe');
      gadgetPage = frame;
      // Capture iframe console too
      await gadgetPage.waitForTimeout(3000);
    }
  }

  await page.screenshot({ path: `${evidenceDir}/prod_ui.png`, fullPage: true });
  console.log('PASS: prod_ui.png saved');

  // Click buttons (in gadget context)
  async function clickIfPossible(label, testId) {
    const target = gadgetPage;
    const locator = testId
      ? target.locator(`[data-testid="${testId}"]`)
      : target.getByRole('button', { name: label });
    const visible = await locator.first().isVisible({ timeout: 3000 }).catch(() => false);
    if (!visible) return { clicked: false, reason: 'NOT_VISIBLE' };
    const disabled = await locator.first().isDisabled().catch(() => true);
    if (disabled) return { clicked: false, reason: 'DISABLED' };
    await locator.first().click({ timeout: 5000 });
    await page.waitForTimeout(2000);
    return { clicked: true, reason: 'CLICKED' };
  }

  const results = {};
  results.runAccessReview = await clickIfPossible('Run Access Review', 'ft-action-run-access-review');
  results.exportEvidence = await clickIfPossible('Export Evidence Pack', 'ft-action-export-evidence');
  results.sealReview = await clickIfPossible('Seal Review (Immutable)', 'ft-action-seal-review');

  await page.screenshot({ path: `${evidenceDir}/prod_ui_after_clicks.png`, fullPage: true });
  console.log('PASS: prod_ui_after_clicks.png saved');

  fs.writeFileSync(`${evidenceDir}/browser_console.txt`, consoleLines.join('\n'), 'utf8');
  fs.writeFileSync(`${evidenceDir}/page_errors.txt`, pageErrors.join('\n'), 'utf8');
  fs.writeFileSync(`${evidenceDir}/click_results.json`, JSON.stringify(results, null, 2), 'utf8');

  // Assertions
  const forbidden = 'Backend invoke failed: data is not defined';
  const forbiddenInConsole = consoleLines.some(l => l.includes(forbidden));
  const hasRenderCrash = consoleLines.some(l => l.includes('FT_PROOF_UI_RENDER_CRASH'));
  const anyClicked = Object.values(results).some(r => r.clicked === true);
  const hasClickProof = consoleLines.some(l => l.includes('[FT_PROOF_UI_CLICK]'));

  console.log('');
  console.log('=== ASSERTIONS ===');
  console.log(`Forbidden string in console: ${forbiddenInConsole ? 'FAIL' : 'PASS'}`);
  console.log(`Render crash marker: ${hasRenderCrash ? 'FAIL' : 'PASS'}`);
  console.log(`Buttons clicked: ${anyClicked}`);
  if (anyClicked) {
    console.log(`Click proof in console: ${hasClickProof ? 'PASS' : 'FAIL'}`);
  }

  // Report click results
  console.log('');
  console.log('=== CLICK RESULTS ===');
  for (const [name, result] of Object.entries(results)) {
    console.log(`  ${name}: ${result.reason}`);
  }

  // Report console proof markers
  const proofMarkers = consoleLines.filter(l => l.includes('[FT_PROOF_'));
  console.log('');
  console.log(`=== PROOF MARKERS IN CONSOLE (${proofMarkers.length}) ===`);
  proofMarkers.forEach(l => console.log(`  ${l}`));

  await context.close();
  await browser.close();

  // Exit code
  let failed = false;
  if (forbiddenInConsole) { console.error('FAIL: Forbidden string found in console'); failed = true; }
  if (hasRenderCrash) { console.error('FAIL: Render crash marker found'); failed = true; }
  if (anyClicked && !hasClickProof) { console.error('FAIL: Click proof missing after button click'); failed = true; }

  console.log('');
  console.log(`FT_EVIDENCE_DIR=${evidenceDir}`);
  process.exit(failed ? 1 : 0);
})();
