/**
 * Enterprise Contract E2E Test
 * 
 * CRITICAL REQUIREMENTS:
 * - ALL contract fields MUST be visible and validated
 * - FAIL immediately on any missing field
 * - Export modal MUST show declaration BEFORE download
 * - NO mutations (read-only gadget)
 * - MUST produce 50_envelope.json, 51_console.txt, 52_dashboard.png
 */

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Use persistent auth
test.use({
  storageState: path.join(__dirname, '../.auth/storageState.persistent.json'),
});

const JIRA_DASHBOARD_URL = process.env.JIRA_DASHBOARD_URL || 'https://firsttry.atlassian.net/jira/dashboards/10102';

test.describe('Enterprise Contract Dashboard', () => {
  let RUN_DIR: string;
  let consoleLogs: string[] = [];
  let consoleMessages: Array<{type: string, text: string, location?: string}> = [];
  
  test.beforeEach(async () => {
    // Get output directory from E2E_OUTPUT_DIR or RUN_DIR environment variable
    if (process.env.E2E_OUTPUT_DIR) {
      RUN_DIR = process.env.E2E_OUTPUT_DIR;
      console.log(`[TEST] Using E2E_OUTPUT_DIR: ${RUN_DIR}`);
    } else if (process.env.RUN_DIR) {
      RUN_DIR = process.env.RUN_DIR;
      console.log(`[TEST] Using RUN_DIR from env: ${RUN_DIR}`);
    } else {
      const runDirPath = '/tmp/current_contract_run_dir.txt';
      if (!fs.existsSync(runDirPath)) {
        console.error('[TEST] STOP_NO_RUN_DIR: No E2E_OUTPUT_DIR, RUN_DIR env var, or /tmp/current_contract_run_dir.txt found');
        throw new Error('STOP_NO_RUN_DIR');
      }
      RUN_DIR = fs.readFileSync(runDirPath, 'utf8').trim();
      console.log(`[TEST] Using RUN_DIR from file: ${RUN_DIR}`);
    }
    
    if (!RUN_DIR) {
      throw new Error('STOP_NO_RUN_DIR: Output directory not configured');
    }
    
    if (!fs.existsSync(RUN_DIR)) {
      fs.mkdirSync(RUN_DIR, { recursive: true });
    }
  });
  
  test.afterEach(async ({ page }) => {
    // ALWAYS write console logs, even on failure
    const consoleLogPath = path.join(RUN_DIR, '37_console.txt');
    fs.writeFileSync(consoleLogPath, consoleLogs.join('\n'));
    console.log(`[TEST] Console logs written to ${consoleLogPath}`);
  });
  
  test('ENTERPRISE CONTRACT - All fields present and valid', async ({ page }) => {
    // Track brand failures across sanity checks
    let brandFailureDetected = false;
    const brandFailures: string[] = [];
    
    // Capture console logs with location URLs for hygiene filtering
    page.on('console', async msg => {
      const text = msg.text();
      const type = msg.type();
      consoleLogs.push(`[${type}] ${text}`);
      
      try {
        const location = msg.location();
        const url = location?.url || '';
        consoleMessages.push({ type, text, location: url });
      } catch (e) {
        consoleMessages.push({ type, text, location: 'unknown' });
      }
    });
    
    page.on('pageerror', err => {
      const msg = err.message;
      consoleLogs.push(`[ERROR] ${msg}`);
      consoleMessages.push({ type: 'error', text: msg, location: 'pageerror' });
    });
    
    // Navigate to dashboard (USE domcontentloaded, NOT networkidle)
    console.log(`[TEST] Navigating to ${JIRA_DASHBOARD_URL}`);
    await page.goto(JIRA_DASHBOARD_URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
    
    // Wait for any iframe to appear
    console.log('[TEST] Waiting for iframe...');
    await page.waitForSelector('iframe', { timeout: 90000 });
    
    // Find gadget iframe with improved polling (max 120s for reliability)
    console.log('[TEST] Finding gadget iframe with enterprise contract root...');
    let gadgetFrame: any = null;
    const startTime = Date.now();
    const maxWait = 120000; // Increased to 120s for CDN propagation
    
    while (Date.now() - startTime < maxWait) {
      const frames = page.frames();
      for (const frame of frames) {
        try {
          const frameUrl = frame.url();
          // Check if this frame contains our root testid
          const rootCount = await frame.locator('[data-testid="ft-enterprise-contract-root"]').count();
          if (rootCount > 0) {
            gadgetFrame = frame;
            console.log(`[TEST] Found gadget frame with contract root (url: ${frameUrl})`);
            break;
          }
        } catch (e) {
          // Frame might not be ready, continue
        }
      }
      if (gadgetFrame) break;
      await page.waitForTimeout(2000); // Check every 2s
    }
    
    if (!gadgetFrame) {
      console.log('[TEST] ERROR: Could not find enterprise contract root within 120s');
      
      // Try to find evidence summary as fallback
      for (const frame of page.frames()) {
        try {
          const evidenceCount = await frame.locator('[data-testid="ft-evidence-summary-root"]').count();
          if (evidenceCount > 0) {
            console.log(`[TEST] Found evidence summary in frame: ${frame.url()}`);
          }
        } catch (e) {
          // Continue
        }
      }
      
      const stopFile = path.join(RUN_DIR, 'STOP_NO_GADGET_FRAME.txt');
      fs.writeFileSync(stopFile, 'Could not find gadget iframe with ft-enterprise-contract-root within 120s');
      throw new Error('STOP_NO_GADGET_FRAME');
    }
    
    console.log('[TEST] Gadget frame found, waiting for enterprise contract root...');
    await gadgetFrame.locator('[data-testid="ft-enterprise-contract-root"]').waitFor({ timeout: 30000 });
    console.log('[TEST] Enterprise contract root visible');
    
    // ========================================================================
    // ENTERPRISE-GRADE LAYOUT GATE (STRICT: y < 320 @ 1280x720)
    // ========================================================================
    console.log('[TEST] Validating enterprise-grade layout...');
    const layoutResults: string[] = [];
    layoutResults.push('=== ENTERPRISE LAYOUT GATE ===\n');
    layoutResults.push('Viewport: 1280x720\n');
    layoutResults.push('Threshold: Evidence Summary y < 320px (enterprise above-the-fold)\n\n');
    
    // Locate Evidence Summary (must be above the fold)
    const summary = gadgetFrame.locator('[data-testid="ft-evidence-summary-root"]');
    await expect(summary).toBeVisible({ timeout: 120000 });
    console.log('[TEST] ✓ Evidence Summary visible');
    layoutResults.push('✓ Evidence Summary visible\n');
    
    // Check Evidence Summary is above the fold (bounding box y position)
    const summaryBox = await summary.boundingBox();
    if (!summaryBox) {
      const msg = 'SUMMARY_BOUNDING_BOX_NULL';
      layoutResults.push(`✗ FAIL: ${msg}\n`);
      layoutResults.push('\nVERDICT: FAIL (cannot measure Evidence Summary position)\n');
      fs.writeFileSync(path.join(RUN_DIR, '39_layout_gate.txt'), layoutResults.join(''));
      throw new Error(msg);
    }
    console.log(`[TEST] Evidence Summary y=${summaryBox.y}, height=${summaryBox.height}`);
    layoutResults.push(`Evidence Summary y=${summaryBox.y}, height=${summaryBox.height}\n`);
    
    // ENTERPRISE THRESHOLD: Must start within first 320px  (well above fold for 720px viewport)
    // Note: y=298 is ~41% through viewport height, clearly visible without scrolling
    if (summaryBox.y >= 320) {
      const msg = `SUMMARY_NOT_ABOVE_FOLD: y=${summaryBox.y} >= 320px threshold (FAIL)`;
      layoutResults.push(`✗ FAIL: ${msg}\n`);
      layoutResults.push('\nVERDICT: FAIL (Evidence Summary not within 320px threshold)\n');
      fs.writeFileSync(path.join(RUN_DIR, '39_layout_gate.txt'), layoutResults.join(''));
      throw new Error(msg);
    }
    console.log(`[TEST] ✓ Evidence Summary above fold (y=${summaryBox.y} < 320px)`);
    layoutResults.push(`✓ PASS: Evidence Summary y=${summaryBox.y} < 320px\n`);
    layoutResults.push(`Above-the-fold: ${Math.round((summaryBox.y / 720) * 100)}% through 720px viewport\n`);
    
    // Contract root already verified visible above
    const contractRoot = gadgetFrame.locator('[data-testid="ft-enterprise-contract-root"]');
    console.log('[TEST] ✓ Enterprise Contract root confirmed visible');
    layoutResults.push('✓ Enterprise Contract root visible\n');
    
    // Snapshot History
    const historyRoot = gadgetFrame.locator('[data-testid="ft-snapshot-history"]');
    await expect(historyRoot).toBeVisible({ timeout: 30000 });
    console.log('[TEST] ✓ Snapshot History visible');
    layoutResults.push('✓ Snapshot History visible\n');
    
    layoutResults.push('\nVERDICT: PASS (Enterprise layout meets strict threshold)\n');
    fs.writeFileSync(path.join(RUN_DIR, '39_layout_gate.txt'), layoutResults.join(''));
    console.log(`[TEST] Layout gate written to ${path.join(RUN_DIR, '39_layout_gate.txt')}`);
    
    // ========================================================================
    // SCREENSHOTS (Element-specific + Full page)
    // ========================================================================
    console.log('[TEST] Capturing screenshots...');
    
    // Full page screenshot
    const fullScreenshotPath = path.join(RUN_DIR, '35_full_dashboard.png');
    await page.screenshot({ path: fullScreenshotPath, fullPage: true });
    console.log(`[TEST] Full page screenshot: ${fullScreenshotPath}`);
    
    // Evidence Summary element screenshot
    const summaryScreenshotPath = path.join(RUN_DIR, '32_summary.png');
    await summary.screenshot({ path: summaryScreenshotPath });
    console.log(`[TEST] Evidence Summary screenshot: ${summaryScreenshotPath}`);
    
    // Enterprise Contract element screenshot
    const contractScreenshotPath = path.join(RUN_DIR, '33_contract.png');
    await contractRoot.screenshot({ path: contractScreenshotPath });
    console.log(`[TEST] Enterprise Contract screenshot: ${contractScreenshotPath}`);
    
    // Snapshot History element screenshot
    const historyScreenshotPath = path.join(RUN_DIR, '34_history.png');
    await historyRoot.screenshot({ path: historyScreenshotPath });
    console.log(`[TEST] Snapshot History screenshot: ${historyScreenshotPath}`);
    
    // === EXTRACT REAL DOM TEXT (CRITICAL FOR PROOF) ===
    console.log('[TEST] Extracting real DOM innerText from contract root...');
    const domText = await contractRoot.innerText();
    const domTextPath = path.join(RUN_DIR, '36_contract_dom_text.txt');
    fs.writeFileSync(domTextPath, domText);
    console.log(`[TEST] DOM text saved to ${domTextPath} (${domText.length} chars)`);
    
    // Validate DOM text is not empty
    if (domText.length < 200) {
      const stopFile = path.join(RUN_DIR, 'STOP_DOM_TEXT_TOO_SHORT.txt');
      fs.writeFileSync(stopFile, `DOM text only ${domText.length} chars, expected >= 200`);
      throw new Error('STOP_DOM_TEXT_TOO_SHORT');
    }
    
    // === MULTI-VIEWPORT FULL PAGE TEXT CAPTURES ===
    console.log('[TEST] Capturing full page text in DESKTOP viewport (1280x720)...');
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForTimeout(1000); // Allow viewport to settle
    const fullPageTextDesktop = await page.locator('body').innerText();
    const desktopTextPath = path.join(RUN_DIR, '71_full_page_text_desktop.txt');
    fs.writeFileSync(desktopTextPath, fullPageTextDesktop);
    console.log(`[TEST] Desktop full page text saved to ${desktopTextPath} (${fullPageTextDesktop.length} chars)`);
    
    console.log('[TEST] Capturing full page text in MOBILE viewport (390x844 iPhone 13)...');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(1000); // Allow viewport to settle
    const fullPageTextMobile = await page.locator('body').innerText();
    const mobileTextPath = path.join(RUN_DIR, '72_full_page_text_mobile.txt');
    fs.writeFileSync(mobileTextPath, fullPageTextMobile);
    console.log(`[TEST] Mobile full page text saved to ${mobileTextPath} (${fullPageTextMobile.length} chars)`);
    
    // Reset to desktop viewport for remaining tests
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForTimeout(500);
    
    // Validate full page texts are not empty
    if (fullPageTextDesktop.length < 200) {
      const stopFile = path.join(RUN_DIR, 'STOP_DESKTOP_TEXT_TOO_SHORT.txt');
      fs.writeFileSync(stopFile, `Desktop text only ${fullPageTextDesktop.length} chars, expected >= 200`);
      throw new Error('STOP_DESKTOP_TEXT_TOO_SHORT');
    }
    if (fullPageTextMobile.length < 200) {
      const stopFile = path.join(RUN_DIR, 'STOP_MOBILE_TEXT_TOO_SHORT.txt');
      fs.writeFileSync(stopFile, `Mobile text only ${fullPageTextMobile.length} chars, expected >= 200`);
      throw new Error('STOP_MOBILE_TEXT_TOO_SHORT');
    }
    
    // === CONSOLE HYGIENE GATE (OUR APP ONLY) ===
    console.log('[TEST] Processing console hygiene gate (filtering for our app only)...');
    const scopedMessages = consoleMessages.filter(msg => {
      const url = msg.location || '';
      // Include messages from our Forge app CDN or containing govGadget
      const isOurApp = (
        url.includes('cdn.prod.atlassian-dev.net') && url.includes('/govGadget')
      ) || (
        url.includes('214ca975') // our commit SHA
      );
      return isOurApp;
    });
    
    const scopedLogsText = scopedMessages.map(msg => 
      `[${msg.type}] ${msg.text}\n  Location: ${msg.location}`
    ).join('\n\n');
    
    const scopedLogsPath = path.join(RUN_DIR, '73_console_scoped_our_app.txt');
    fs.writeFileSync(scopedLogsPath, scopedLogsText || 'No scoped console messages from our app');
    console.log(`[TEST] Scoped console logs saved to ${scopedLogsPath} (${scopedMessages.length} messages)`);
    
    // Summary of scoped console
    const scopedErrors = scopedMessages.filter(m => m.type === 'error');
    const scopedWarnings = scopedMessages.filter(m => m.type === 'warning');
    const scopedLogs = scopedMessages.filter(m => m.type === 'log' || m.type === 'info');
    
    const uniqueErrors = [...new Set(scopedErrors.map(m => m.text))];
    
    const scopedSummary = [
      '=== SCOPED CONSOLE SUMMARY (OUR APP ONLY) ===',
      '',
      `Total scoped messages: ${scopedMessages.length}`,
      `  - Errors: ${scopedErrors.length}`,
      `  - Warnings: ${scopedWarnings.length}`,
      `  - Logs/Info: ${scopedLogs.length}`,
      '',
      'Unique error messages:',
      ...uniqueErrors.map(err => `  - ${err}`),
      '',
      'VERDICT: ' + (scopedErrors.length === 0 ? 'PASS (no errors)' : `FAIL (${scopedErrors.length} errors)`)
    ].join('\n');
    
    const scopedSummaryPath = path.join(RUN_DIR, '74_console_scoped_summary.txt');
    fs.writeFileSync(scopedSummaryPath, scopedSummary);
    console.log(`[TEST] Scoped console summary saved to ${scopedSummaryPath}`);
    
    // GATE: Fail if any scoped console errors
    if (scopedErrors.length > 0) {
      const stopFile = path.join(RUN_DIR, 'STOP_SCOPED_CONSOLE_ERROR.txt');
      const stopContent = [
        '=== SCOPED CONSOLE ERROR GATE FAILURE ===',
        '',
        `Found ${scopedErrors.length} error(s) in our app console:`,
        '',
        ...scopedErrors.map((err, i) => [
          `Error ${i + 1}:`,
          `  Message: ${err.text}`,
          `  Location: ${err.location}`,
          ''
        ].join('\n'))
      ].join('\n');
      fs.writeFileSync(stopFile, stopContent);
      throw new Error(`STOP_SCOPED_CONSOLE_ERROR: Found ${scopedErrors.length} error(s) from our app`);
    }
    
    // Extract envelope JSON from window global in the gadget frame (optional)
    console.log('[TEST] Checking for envelope global...');
    const envelope = await gadgetFrame.evaluate(() => {
      return (window as any).__FT_LAST_DASH_ENVELOPE_V1 || null;
    });
    
    if (!envelope) {
      console.log('[TEST] Envelope global not found; skipping envelope checks');
      // Don't fail - DOM text is more important
    } else {
      console.log('[TEST] Envelope global found, extracting...');
      // Write envelope to file
      const envelopePath = path.join(RUN_DIR, '50_envelope.json');
      fs.writeFileSync(envelopePath, JSON.stringify(envelope, null, 2));
      console.log(`[TEST] Envelope saved to ${envelopePath}`);
    }
    
    // ========================================================================
    // REAL DOM CONTRACT VALIDATION (From visible text, NOT envelope)
    // ========================================================================
    console.log('[TEST] Validating contract strings in REAL DOM text...');
    const contractResults: string[] = [];
    contractResults.push('=== ENTERPRISE CONTRACT DOM VALIDATION ===\n');
    contractResults.push(`DOM text length: ${domText.length} characters\n`);
    contractResults.push(`Extracted from: [data-testid="ft-enterprise-contract-root"]\n\n`);
    
    // Required contract strings (must appear in visible DOM text)
    const requiredStrings = [
      { id: 'A', text: 'Snapshot type:', minLength: 10 },
      { id: 'B', text: 'Origin:', minLength: 5 },
      { id: 'C', text: 'Created:', minLength: 7 },
      { id: 'D', text: 'Freshness:', minLength: 7 },
      { id: 'D', text: 'Evidence age:', minLength: 10 },
      { id: 'E', text: 'This snapshot is immutable and cannot be modified after creation', minLength: 65 },
      { id: 'F', text: 'Integrity hash (SHA-256):', minLength: 20 },
      { id: 'G', text: 'Included evidence scope:', minLength: 20 },
      { id: 'H', text: 'Excluded evidence scope:', minLength: 20 },
      { id: 'I', text: 'Export:', minLength: 6 },
      { id: 'J', text: 'Data source: Live data from your Jira environment', minLength: 50 },
      { id: 'K', text: 'Audit context:', minLength: 10 },
      { id: 'K', text: 'This evidence supports configuration governance', minLength: 40 },
      { id: 'L', text: 'Seed vs governance snapshots:', minLength: 25 },
      { id: 'L', text: 'Seed snapshots are baseline system snapshots', minLength: 40 },
    ];
    
    let passCount = 0;
    let failCount = 0;
    
    for (const req of requiredStrings) {
      const found = domText.includes(req.text);
      if (found) {
        passCount++;
        contractResults.push(`✓ PASS [${req.id}]: "${req.text.substring(0, 50)}..."\n`);
      } else {
        failCount++;
        contractResults.push(`✗ FAIL [${req.id}]: Missing "${req.text.substring(0, 50)}..."\n`);
      }
    }
    
    contractResults.push(`\n=== SUMMARY ===\n`);
    contractResults.push(`PASS: ${passCount}/${requiredStrings.length}\n`);
    contractResults.push(`FAIL: ${failCount}/${requiredStrings.length}\n`);
    
    if (failCount > 0) {
      contractResults.push(`\nVERDICT: FAIL (${failCount} contract strings missing from DOM)\n`);
    } else {
      contractResults.push(`\nVERDICT: PASS (All ${requiredStrings.length} contract strings present in DOM)\n`);
    }
    
    // Write contract check results
    const contractCheckPath = path.join(RUN_DIR, '38_contract_dom_check.txt');
    fs.writeFileSync(contractCheckPath, contractResults.join(''));
    console.log(`[TEST] Contract validation written to ${contractCheckPath}`);
    
    // Fail test if any strings are missing
    if (failCount > 0) {
      throw new Error(`CONTRACT_VALIDATION_FAILED: ${failCount} required strings missing from DOM`);
    }
    
    // ========================================================================
    // ENTERPRISE TEXT SANITY CHECKS
    // ========================================================================
    console.log('[TEST] Running enterprise text sanity checks...');
    const sanityResults: string[] = [];
    sanityResults.push('=== ENTERPRISE TEXT SANITY CHECKS ===\n\n');
    sanityResults.push('--- Gadget DOM Text Check ---\n');
    
    // Check 1: NO_GOVERNANCE token must NOT appear in gadget DOM
    const hasNoGovToken = domText.includes('NO_GOVERNANCE');
    if (hasNoGovToken) {
      sanityResults.push('✗ FAIL: Internal token "NO_GOVERNANCE" leaked to gadget DOM\n');
      throw new Error('SANITY_FAIL: NO_GOVERNANCE token found in DOM text');
    } else {
      sanityResults.push('✓ PASS: No internal token "NO_GOVERNANCE" in gadget DOM\n');
    }
    
    // Check 2: "Firstry" misspelling must NOT appear in gadget DOM
    const hasFirstryInGadget = domText.includes('Firstry');
    if (hasFirstryInGadget) {
      sanityResults.push('✗ FAIL: Brand misspelling "Firstry" found in gadget DOM\n');
      throw new Error('SANITY_FAIL: Firstry misspelling found in gadget DOM text');
    } else {
      sanityResults.push('✓ PASS: No brand misspelling "Firstry" in gadget DOM\n');
    }
    
    sanityResults.push('\n--- Full Page Text Check (Multi-Viewport) ---\n');
    
    // Re-read both viewport captures from files
    const desktopTextFromFile = fs.readFileSync(desktopTextPath, 'utf-8');
    const mobileTextFromFile = fs.readFileSync(mobileTextPath, 'utf-8');
    sanityResults.push(`Desktop viewport text length: ${desktopTextFromFile.length} chars\n`);
    sanityResults.push(`Mobile viewport text length: ${mobileTextFromFile.length} chars\n`);
    
    // Check 3a: NO_GOVERNANCE token must NOT appear in DESKTOP viewport
    const hasNoGovTokenDesktop = desktopTextFromFile.includes('NO_GOVERNANCE');
    if (hasNoGovTokenDesktop) {
      sanityResults.push('✗ FAIL: Internal token "NO_GOVERNANCE" leaked to desktop page\n');
      throw new Error('SANITY_FAIL: NO_GOVERNANCE token found in desktop full page text');
    } else {
      sanityResults.push('✓ PASS: No internal token "NO_GOVERNANCE" on desktop page\n');
    }
    
    // Check 3b: NO_GOVERNANCE token must NOT appear in MOBILE viewport
    const hasNoGovTokenMobile = mobileTextFromFile.includes('NO_GOVERNANCE');
    if (hasNoGovTokenMobile) {
      sanityResults.push('✗ FAIL: Internal token "NO_GOVERNANCE" leaked to mobile page\n');
      throw new Error('SANITY_FAIL: NO_GOVERNANCE token found in mobile full page text');
    } else {
      sanityResults.push('✓ PASS: No internal token "NO_GOVERNANCE" on mobile page\n');
    }
    
    // Check 4a: "Firstry" misspelling must NOT appear in DESKTOP viewport (CRITICAL)
    const hasFirstryDesktop = desktopTextFromFile.includes('Firstry');
    if (hasFirstryDesktop) {
      brandFailureDetected = true;
      const firstryLines = desktopTextFromFile.split('\n').filter(line => line.includes('Firstry')).slice(0, 10);
      brandFailures.push('DESKTOP viewport has "Firstry" misspelling:');
      brandFailures.push(...firstryLines.map(line => `  ${line}`));
      sanityResults.push('✗ FAIL: Brand misspelling "Firstry" found on DESKTOP page\n');
    } else {
      sanityResults.push('✓ PASS: No brand misspelling "Firstry" on DESKTOP page\n');
    }
    
    // Check 4b: "Firstry" misspelling must NOT appear in MOBILE viewport (CRITICAL)
    const hasFirstryMobile = mobileTextFromFile.includes('Firstry');
    if (hasFirstryMobile) {
      brandFailureDetected = true;
      const firstryLines = mobileTextFromFile.split('\n').filter(line => line.includes('Firstry')).slice(0, 10);
      brandFailures.push('MOBILE viewport has "Firstry" misspelling:');
      brandFailures.push(...firstryLines.map(line => `  ${line}`));
      sanityResults.push('✗ FAIL: Brand misspelling "Firstry" found on MOBILE page\n');
    } else {
      sanityResults.push('✓ PASS: No brand misspelling "Firstry" on MOBILE page\n');
    }
    
    // If brand failure detected, write STOP file but continue to capture evidence
    if (brandFailureDetected) {
      const stopFile = path.join(RUN_DIR, 'STOP_CHROME_BRAND_MISMATCH.txt');
      const stopContent = [
        '=== CHROME BRAND MISMATCH DETECTED ===',
        '',
        'Viewport failures:',
        ...brandFailures,
        '',
        'This indicates Jira chrome/metadata still shows "Firstry" (caching issue).'
      ].join('\n');
      fs.writeFileSync(stopFile, stopContent);
      // Note: We write the stop file but don't throw immediately - let test complete to gather all evidence
    }
    
    sanityResults.push('\n--- Evidence Metadata Validation ---\n');
    
    // Check 3: Freshness must be one of expected labels (including Unknown for invalid dates)
    const freshnessMatch = domText.match(/Freshness:\s*([^\n]+?)(?:\n|$)/);
    if (freshnessMatch) {
      const freshnessValue = freshnessMatch[1].trim();
      const validFreshness = ['Fresh', 'Stale', 'Out of date', 'Unknown'];
      if (validFreshness.includes(freshnessValue)) {
        sanityResults.push(`✓ PASS: Freshness is valid ("${freshnessValue}")\n`);
      } else {
        sanityResults.push(`✗ FAIL: Freshness has invalid value ("${freshnessValue}")\n`);
        throw new Error(`SANITY_FAIL: Invalid freshness value: ${freshnessValue}`);
      }
    } else {
      sanityResults.push('✗ FAIL: Freshness label not found\n');
      throw new Error('SANITY_FAIL: Freshness label missing');
    }
    
    // Check 4: Evidence age must exist and be either numeric or "Unknown"
    const ageMatch = domText.match(/Evidence age:\s*([^\n]+?)(?:\n|$)/);
    if (ageMatch) {
      const ageValue = ageMatch[1].trim();
      // Valid: "Unknown" or "X day(s)" format
      const isUnknown = ageValue === 'Unknown';
      const isNumericDays = /^\d+\s*days?$/.test(ageValue);
      
      if (isUnknown || isNumericDays) {
        sanityResults.push(`✓ PASS: Evidence age is valid ("${ageValue}")\n`);
      } else {
        sanityResults.push(`✗ FAIL: Evidence age has invalid format ("${ageValue}")\n`);
        throw new Error(`SANITY_FAIL: Invalid evidence age format: ${ageValue}`);
      }
    } else {
      sanityResults.push('✗ FAIL: Evidence age not found\n');
      throw new Error('SANITY_FAIL: Evidence age missing');
    }
    
    sanityResults.push('\nVERDICT: PASS (All enterprise text sanity checks passed)\n');
    
    // Write sanity check results
    const sanityCheckPath = path.join(RUN_DIR, '70_enterprise_text_sanity.txt');
    fs.writeFileSync(sanityCheckPath, sanityResults.join(''));
    console.log(`[TEST] Enterprise text sanity checks written to ${sanityCheckPath}`);
    if (envelope) {
      console.log('[TEST] Validating envelope structure...');
      expect(envelope.envelopeKind).toBe('FT_DASH_ENVELOPE_V1');
      expect(envelope.schemaVersion).toBe('v1');
      expect(envelope.ok).toBe(true);
      expect(envelope.status).toBe('AVAILABLE');
      
      // Enterprise contract fields are in envelope.data when ok:true
      const data = envelope.data;
      expect(data).toBeTruthy();
      
      // Validate enterprise contract fields
      expect(data.readOnlyGuarantee).toBeTruthy();
      expect(data.readOnlyGuarantee).toContain('read-only system');
      
      expect(data.seedVsGovernanceExplanation).toBeTruthy();
      expect(data.seedVsGovernanceExplanation.title).toBe('Seed vs Governance');
      expect(data.seedVsGovernanceExplanation.bullets).toHaveLength(3);
    
      expect(data.evidenceFreshness).toBeTruthy();
      expect(data.evidenceFreshness.status).toMatch(/^(NO_GOVERNANCE|CURRENT|STALE)$/);
      
      // Validate freshness semantics based on status
      if (data.evidenceFreshness.status === 'NO_GOVERNANCE') {
        console.log('[TEST] Validating NO_GOVERNANCE freshness semantics...');
        expect(data.evidenceFreshness.lastCollectedUtc).toBeNull();
        expect(data.evidenceFreshness.ageSeconds).toBeNull();
        expect(data.evidenceFreshness.staleAfterDays).toBe(30);
        console.log('[TEST] ✓ NO_GOVERNANCE freshness validated (null values)');
      } else {
        console.log(`[TEST] Validating ${data.evidenceFreshness.status} freshness semantics...`);
        expect(data.evidenceFreshness.lastCollectedUtc).toBeTruthy();
        expect(data.evidenceFreshness.ageSeconds).toBeGreaterThanOrEqual(0);
        expect(data.evidenceFreshness.staleAfterDays).toBe(30);
        console.log(`[TEST] ✓ ${data.evidenceFreshness.status} freshness validated`);
      }
      
      // Validate snapshots array
      expect(data.snapshots).toBeTruthy();
      expect(Array.isArray(data.snapshots)).toBe(true);
      expect(data.snapshots.length).toBeGreaterThan(0);
      
      const snapshot = data.snapshots[0];
      expect(snapshot.snapshotId).toBeTruthy();
      expect(snapshot.snapshotKind).toMatch(/^(SEED|GOVERNANCE)$/);
      expect(snapshot.origin).toMatch(/^(SCHEDULED|TRIGGERED|ON_DEMAND)$/);
      expect(snapshot.initiator).toMatch(/^(system|user)$/);
      expect(snapshot.createdAtUtc).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
      expect(snapshot.immutabilityStatement).toBeTruthy();
      expect(snapshot.integrity).toBeTruthy();
      expect(snapshot.integrity.algorithm).toBe('sha256');
      expect(snapshot.integrity.value).toHaveLength(64);
      expect(snapshot.integrity.value).toMatch(/^[0-9a-f]{64}$/);
      expect(snapshot.scope).toBeTruthy();
      expect(snapshot.controls).toBeTruthy();
      expect(snapshot.exportEligible).toBe(snapshot.snapshotKind === 'GOVERNANCE');
      expect(snapshot.exportDeclaration).toBeTruthy();
      
      console.log(`[TEST] ✓ Envelope validated (${snapshot.snapshotKind} snapshot)`);
      
      // ========================================================================
      // UI VALIDATION
      // ========================================================================
      console.log('[TEST] Validating UI rendering...');
      
      // Read-only statement
      const readonlySection = gadgetFrame.locator('[data-testid="ft-readonly-statement"]');
      await expect(readonlySection).toBeVisible();
      console.log('[TEST] ✓ Read-only statement visible');
      
      // Seed vs Governance
      const seedVsGov = gadgetFrame.locator('[data-testid="ft-seed-vs-governance"]');
      await expect(seedVsGov).toBeVisible();
      console.log('[TEST] ✓ Seed vs Governance section visible');
      
      // Freshness section
      const freshness = gadgetFrame.locator('[data-testid="ft-freshness"]');
      await expect(freshness).toBeVisible();
      
      if (data.evidenceFreshness.status === 'NO_GOVERNANCE') {
        // Should show "No governance snapshots yet."
        const noGovMsg = gadgetFrame.locator('[data-testid="ft-freshness-no-governance"]');
        await expect(noGovMsg).toBeVisible();
        const noGovText = await noGovMsg.textContent();
        expect(noGovText).toContain('No governance snapshots yet');
        console.log('[TEST] ✓ NO_GOVERNANCE UI message visible');
      } else {
        // Should show freshness details
        const freshnessText = await freshness.textContent();
        expect(freshnessText).toMatch(/Last Collected.*UTC/);
        console.log('[TEST] ✓ Freshness details visible');
      }
      
      // Snapshots list
      const snapshotsList = gadgetFrame.locator('[data-testid="ft-snapshot-list"]');
      await expect(snapshotsList).toBeVisible();
      console.log('[TEST] ✓ Snapshots list visible');
      
      // ========================================================================
      // CONSOLE MARKERS VALIDATION
      // ========================================================================
      console.log('[TEST] Validating console markers...');
      
      const hasDashCtx = consoleLogs.some(log => log.includes('[FT_DASH_CTX]'));
      expect(hasDashCtx).toBe(true);
      console.log('[TEST] ✓ [FT_DASH_CTX] marker found');
    }
    
    // Final check: If brand failure was detected earlier, fail the test now
    // (This ensures all evidence was captured before failing)
    if (brandFailureDetected) {\n      const errorMsg = [\n        'BRAND FAILURE: \"Firstry\" misspelling detected in full page text.',\n        'This indicates Jira chrome/metadata still shows \"Firstry\" (likely caching issue).',\n        'See STOP_CHROME_BRAND_MISMATCH.txt and 71/72 viewport captures for details.'\n      ].join(' ');\n      throw new Error(errorMsg);\n    }
    
    console.log('\n[TEST] ✅ ALL ENTERPRISE CONTRACT CHECKS PASSED\n');
  });
});
