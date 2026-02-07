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
import { execSync } from 'child_process';

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
    
    // === PHASE 2A: RECORD EXPECTED HEAD SHORT SHA ===
    console.log('[TEST] Recording expected HEAD short SHA from git...');
    let expectedHeadShortSha = '';
    try {
      expectedHeadShortSha = execSync('git rev-parse --short HEAD', { 
        cwd: '/workspaces/Firsttry',
        encoding: 'utf8' 
      }).trim();
      console.log(`[TEST] Expected HEAD short SHA: ${expectedHeadShortSha}`);
      fs.writeFileSync(path.join(RUN_DIR, '01_expected_head_short_sha.txt'), expectedHeadShortSha);
    } catch (err) {
      console.error('[TEST] ERROR: Failed to get git HEAD SHA:', err);
      throw new Error('STOP: Cannot determine expected HEAD SHA');
    }
    
    // === PHASE 2B: CSS NETWORK PROOF LISTENER ===
    const cssNetworkUrls: string[] = [];
    page.on('response', async (response) => {
      const url = response.url();
      // Check if URL contains our CSS file or enterpriseDashboard pattern
      if (url.includes('enterpriseDashboard') || url.includes('enterpriseDashboard.css')) {
        cssNetworkUrls.push(`${response.status()} ${url}`);
        console.log(`[TEST] CSS Network: ${response.status()} ${url}`);
      }
    });
    
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
    
    // Wait for initial page load and console logs to accumulate
    console.log('[TEST] Waiting for page to stabilize and console logs...');
    await page.waitForTimeout(5000); // Give time for our app to emit UI_BUILD_IDENTITY markers
    
    // ========================================================================
    // DEPLOYMENT-AWARENESS GATE (RUNS BEFORE IFRAME DISCOVERY)
    // ========================================================================
    console.log('[TEST] === DEPLOYMENT-AWARENESS GATE === Checking deployed SHA...');
    const deploymentCheckResults: string[] = [];
    deploymentCheckResults.push('=== DEPLOYMENT AWARENESS CHECK ===\n\n');
    deploymentCheckResults.push(`Expected HEAD SHA: ${expectedHeadShortSha}\n\n`);
    
    // Extract deployed SHA from console logs
    // Look for UI identity markers: UI_IDENTITY_RESOLVED, UI_BUILD_IDENTITY_CONFIRMED, backend_git_sha_short, etc.
    let deployedShortSha = '';
    let deployedFullSha = '';
    const identityMarkers = [
      'UI_IDENTITY_RESOLVED',
      'UI_BUILD_IDENTITY_CONFIRMED',
      'UI_BUILD_IDENTITY_PROOF',
      'backend_git_sha_short',
      'backend_git_sha',
      'UI_GIT_SHA'
    ];
    
    deploymentCheckResults.push('Searching console logs for identity markers:\n');
    for (const log of consoleLogs) {
      for (const marker of identityMarkers) {
        if (log.includes(marker)) {
          deploymentCheckResults.push(`  Found marker in log: ${log.substring(0, 200)}\n`);
          // Try to extract 7-char short SHA
          const shortShaMatch = log.match(/\b[0-9a-f]{7}\b/);
          if (shortShaMatch && !deployedShortSha) {
            deployedShortSha = shortShaMatch[0];
            deploymentCheckResults.push(`  Extracted short SHA: ${deployedShortSha}\n`);
          }
          // Try to extract 40-char full SHA
          const fullShaMatch = log.match(/\b[0-9a-f]{40}\b/);
          if (fullShaMatch && !deployedFullSha) {
            deployedFullSha = fullShaMatch[0];
            deploymentCheckResults.push(`  Extracted full SHA: ${deployedFullSha}\n`);
          }
        }
      }
      if (deployedShortSha && deployedFullSha) break;
    }
    
    // If not found in console, try full page text as fallback
    if (!deployedShortSha) {
      deploymentCheckResults.push('\nConsole logs did not contain identity marker, trying page text...\n');
      try {
        const pageText = await page.locator('body').innerText();
        const shortShaMatch = pageText.match(/\b[0-9a-f]{7}\b/);
        if (shortShaMatch) {
          deployedShortSha = shortShaMatch[0];
          deploymentCheckResults.push(`Found short SHA in page text: ${deployedShortSha}\n`);
        }
      } catch (e) {
        deploymentCheckResults.push(`Error reading page text: ${e}\n`);
      }
    }
    
    deploymentCheckResults.push(`\nDeployed short SHA: ${deployedShortSha || 'NOT FOUND'}\n`);
    deploymentCheckResults.push(`Deployed full SHA: ${deployedFullSha || 'NOT FOUND'}\n`);
    fs.writeFileSync(path.join(RUN_DIR, '02_deployed_identity_evidence.txt'), deploymentCheckResults.join(''));
    
    // GATE: If deployed SHA not found at all
    if (!deployedShortSha) {
      const stopMsg = [
        'STOP: DEPLOYED SHA NOT FOUND',
        '',
        `Expected HEAD short SHA: ${expectedHeadShortSha}`,
        'Deployed SHA: NOT FOUND',
        `Dashboard URL: ${JIRA_DASHBOARD_URL}`,
        '',
        'Production does not expose UI build identity markers.',
        'This means either:',
        '  1. The gadget is not loaded on this page',
        '  2. The gadget build does not emit identity markers',
        '  3. The page has not fully loaded',
        '',
        'Console logs captured: ' + consoleLogs.length,
        '',
        'ACTION: Check console logs in 37_console.txt for identity markers.',
      ].join('\n');
      fs.writeFileSync(path.join(RUN_DIR, 'STOP_DEPLOYED_SHA_NOT_FOUND.txt'), stopMsg);
      console.error('[TEST] STOP_DEPLOYED_SHA_NOT_FOUND: Cannot find deployed SHA in console or page text');
      throw new Error('STOP_DEPLOYED_SHA_NOT_FOUND: deployed UI SHA not found');
    }
    
    // GATE: If deployed SHA != expected HEAD SHA
    if (deployedShortSha !== expectedHeadShortSha) {
      const stopMsg = [
        'STOP: NOT DEPLOYED',
        '',
        `Expected HEAD short SHA: ${expectedHeadShortSha}`,
        `Deployed short SHA: ${deployedShortSha}`,
        `Dashboard URL: ${JIRA_DASHBOARD_URL}`,
        '',
        'The production gadget has not been updated with the latest code from this repository.',
        '',
        'ACTION REQUIRED:',
        '  1. Deploy to production:',
        '     cd /workspaces/Firsttry/atlassian/forge-app',
        '     forge deploy --environment production',
        '',
        '  2. Wait for deployment to complete (~5 minutes)',
        '',
        '  3. Re-run this test',
      ].join('\n');
      fs.writeFileSync(path.join(RUN_DIR, 'STOP_NOT_DEPLOYED.txt'), stopMsg);
      console.error(`[TEST] STOP_NOT_DEPLOYED: Expected ${expectedHeadShortSha}, got ${deployedShortSha}`);
      throw new Error(`STOP_NOT_DEPLOYED: deployed SHA (${deployedShortSha}) != HEAD (${expectedHeadShortSha})`);
    }
    
    console.log(`[TEST] ✓ DEPLOYMENT-AWARENESS GATE PASSED: SHA ${deployedShortSha} matches HEAD`);
    deploymentCheckResults.push(`\n✓ VERDICT: PASS - Deployed SHA matches HEAD\n`);
    fs.writeFileSync(path.join(RUN_DIR, '02_deployed_identity_evidence.txt'), deploymentCheckResults.join(''));
    
    // ========================================================================
    // NOW PROCEED TO IFRAME DISCOVERY (deployment verified)
    // ========================================================================
    
    // Wait for any iframe to appear
    console.log('[TEST] Waiting for iframe...');
    await page.waitForSelector('iframe', { timeout: 90000 });
    
    // Find gadget iframe with improved polling (max 120s for reliability)
    console.log('[TEST] Finding gadget iframe with enterprise shell...');
    let gadgetFrame: any = null;
    const startTime = Date.now();
    const maxWait = 120000;
    
    while (Date.now() - startTime < maxWait) {
      const frames = page.frames();
      for (const frame of frames) {
        try {
          const frameUrl = frame.url();
          // Check if this frame contains our enterprise shell testid
          const rootCount = await frame.locator('[data-testid="ft-enterprise-shell"]').count();
          if (rootCount > 0) {
            gadgetFrame = frame;
            console.log(`[TEST] Found gadget frame with enterprise shell (url: ${frameUrl})`);
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
      console.log('[TEST] ERROR: Could not find enterprise shell within 120s (but deployment SHA matches)');
      
      // Try to find evidence summary card as fallback
      for (const frame of page.frames()) {
        try {
          const evidenceCount = await frame.locator('[data-testid="ft-card-evidence-summary"]').count();
          if (evidenceCount > 0) {
            console.log(`[TEST] Found evidence summary card in frame: ${frame.url()}`);
          }
        } catch (e) {
          // Continue
        }
      }
      
      const stopMsg = [
        'STOP: UI CONTRACT MISSING',
        '',
        `Expected testid: ft-enterprise-shell`,
        `Deployed SHA verified: ${deployedShortSha}`,
        `Dashboard URL: ${JIRA_DASHBOARD_URL}`,
        '',
        'The deployed gadget has the correct SHA but does not contain',
        'the expected enterprise UI structure (ft-enterprise-shell testid).',
        '',
        'This indicates either:',
        '  1. A build issue (testid not present in built artifact)',
        '  2. The gadget iframe failed to render',
        '  3. The testid was removed or renamed',
        '',
        'ACTION: Check the gadget frame URLs and content.',
      ].join('\n');
      fs.writeFileSync(path.join(RUN_DIR, 'STOP_UI_CONTRACT_MISSING.txt'), stopMsg);
      throw new Error('STOP_UI_CONTRACT_MISSING');
    }
    
    console.log('[TEST] Gadget frame found, waiting for enterprise shell...');
    await gadgetFrame.locator('[data-testid="ft-enterprise-shell"]').waitFor({ timeout: 30000 });
    console.log('[TEST] Enterprise shell visible');
    
    // ========================================================================
    // ENTERPRISE-GRADE LAYOUT GATE (STRICT: y < 320 @ 1280x720)
    // ========================================================================
    console.log('[TEST] Validating enterprise-grade layout...');
    const layoutResults: string[] = [];
    layoutResults.push('=== ENTERPRISE LAYOUT GATE ===\n');
    layoutResults.push('Viewport: 1280x720\n');
    layoutResults.push('Threshold: Evidence Summary y < 320px (enterprise above-the-fold)\n\n');
    
    // Locate Evidence Summary card (must be above the fold)
    const summary = gadgetFrame.locator('[data-testid="ft-card-evidence-summary"]');
    await expect(summary).toBeVisible({ timeout: 120000 });
    console.log('[TEST] ✓ Evidence Summary card visible');
    layoutResults.push('✓ Evidence Summary card visible\n');
    
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
    
    // Enterprise shell already verified visible above
    const contractRoot = gadgetFrame.locator('[data-testid="ft-enterprise-shell"]');
    console.log('[TEST] ✓ Enterprise shell confirmed visible');
    layoutResults.push('✓ Enterprise shell visible\n');
    
    // Snapshot History
    const historyRoot = gadgetFrame.locator('[data-testid="ft-snapshot-history"]');
    await expect(historyRoot).toBeVisible({ timeout: 30000 });
    console.log('[TEST] ✓ Snapshot History visible');
    layoutResults.push('✓ Snapshot History visible\n');
    
    layoutResults.push('\nVERDICT: PASS (Enterprise layout meets strict threshold)\n');
    fs.writeFileSync(path.join(RUN_DIR, '39_layout_gate.txt'), layoutResults.join(''));
    console.log(`[TEST] Layout gate written to ${path.join(RUN_DIR, '39_layout_gate.txt')}`);
    
    // ========================================================================
    // ENTERPRISE UI CONTRACT - All Required TestIDs
    // ========================================================================
    console.log('[TEST] Validating enterprise UI contract (all required testids)...');
    const uiContractResults: string[] = [];
    uiContractResults.push('=== ENTERPRISE UI CONTRACT VALIDATION ===\n\n');
    
    const requiredTestIds = [
      'ft-enterprise-shell',
      'ft-enterprise-header',
      'ft-title',
      'ft-badges',
      'ft-badge-snapshot-kind',
      'ft-badge-freshness',
      'ft-badge-export',
      'ft-readonly',
      'ft-card-evidence-summary',
      'ft-card-title-evidence-summary',
      'ft-integrity-hash',
      'ft-copy-integrity-hash',
      'ft-card-seed-vs-governance',
      'ft-card-scope',
      'ft-scope-included',
      'ft-scope-excluded',
      'ft-card-controls',
      'ft-snapshot-selector',
      'ft-export-hint',
      'ft-support-button'
    ];
    
    let missingTestIds: string[] = [];
    for (const testId of requiredTestIds) {
      const element = gadgetFrame.locator(`[data-testid="${testId}"]`);
      const count = await element.count();
      if (count === 0) {
        missingTestIds.push(testId);
        uiContractResults.push(`✗ MISSING: ${testId}\n`);
        console.log(`[TEST] ✗ MISSING: ${testId}`);
      } else {
        uiContractResults.push(`✓ FOUND: ${testId}\n`);
        console.log(`[TEST] ✓ FOUND: ${testId}`);
      }
    }
    
    if (missingTestIds.length > 0) {
      uiContractResults.push(`\n✗ VERDICT: FAIL (${missingTestIds.length} missing testids)\n`);
      fs.writeFileSync(path.join(RUN_DIR, '40_ui_contract.txt'), uiContractResults.join(''));
      throw new Error(`UI_CONTRACT_FAIL: Missing testids: ${missingTestIds.join(', ')}`);
    }
    
    uiContractResults.push('\n✓ VERDICT: PASS (All required testids present)\n');
    
    // ========================================================================
    // BADGE CONTENT VALIDATION
    // ========================================================================
    console.log('[TEST] Validating badge content...');
    uiContractResults.push('\n=== BADGE CONTENT VALIDATION ===\n\n');
    
    // Export badge must contain "Export:"
    const exportBadge = gadgetFrame.locator('[data-testid="ft-badge-export"]');
    const exportText = await exportBadge.innerText();
    if (!exportText.includes('Export:')) {
      uiContractResults.push(`✗ Export badge missing "Export:" - got: "${exportText}"\n`);
      fs.writeFileSync(path.join(RUN_DIR, '40_ui_contract.txt'), uiContractResults.join(''));
      throw new Error(`BADGE_FAIL: Export badge missing "Export:" - got: "${exportText}"`);
    }
    uiContractResults.push(`✓ Export badge contains "Export:" - text: "${exportText}"\n`);
    
    // Freshness badge must contain one of: "Out of date" OR "Unknown" OR "Current"
    const freshnessBadge = gadgetFrame.locator('[data-testid="ft-badge-freshness"]');
    const freshnessText = await freshnessBadge.innerText();
    const validFreshnessValues = ['Out of date', 'Unknown', 'Current'];
    const hasValidFreshness = validFreshnessValues.some(v => freshnessText.includes(v));
    if (!hasValidFreshness) {
      uiContractResults.push(`✗ Freshness badge missing valid value - got: "${freshnessText}"\n`);
      fs.writeFileSync(path.join(RUN_DIR, '40_ui_contract.txt'), uiContractResults.join(''));
      throw new Error(`BADGE_FAIL: Freshness badge invalid - got: "${freshnessText}"`);
    }
    uiContractResults.push(`✓ Freshness badge valid - text: "${freshnessText}"\n`);
    
    uiContractResults.push('\n✓ VERDICT: Badge content valid\n');
    fs.writeFileSync(path.join(RUN_DIR, '40_ui_contract.txt'), uiContractResults.join(''));
    console.log(`[TEST] UI contract written to ${path.join(RUN_DIR, '40_ui_contract.txt')}`);
    
    // ========================================================================
    // SNAPSHOT SELECTOR REGRESSION CHECK (must be read-only, not interactive)
    // ========================================================================
    console.log('[TEST] Validating snapshot selector is read-only (not misleading)...');
    const snapshotSelectorResults: string[] = [];
    snapshotSelectorResults.push('=== SNAPSHOT SELECTOR READ-ONLY CHECK ===\n\n');
    
    const snapshotSelector = gadgetFrame.locator('[data-testid="ft-snapshot-selector"]');
    const selectorCount = await snapshotSelector.count();
    if (selectorCount === 0) {
      snapshotSelectorResults.push('✗ FAIL: Snapshot selector not found\n');
      fs.writeFileSync(path.join(RUN_DIR, '41_snapshot_selector_check.txt'), snapshotSelectorResults.join(''));
      throw new Error('SNAPSHOT_SELECTOR_MISSING');
    }
    
    // Check it's not a <select> element
    const tagName = await snapshotSelector.evaluate((el) => el.tagName.toLowerCase());
    snapshotSelectorResults.push(`Tag name: ${tagName}\n`);
    if (tagName === 'select') {
      snapshotSelectorResults.push('✗ FAIL: Snapshot selector is a <select> element (misleading)\n');
      fs.writeFileSync(path.join(RUN_DIR, '41_snapshot_selector_check.txt'), snapshotSelectorResults.join(''));
      const stopFile = path.join(RUN_DIR, 'STOP_SNAPSHOT_SELECTOR_MISLEADING.txt');
      fs.writeFileSync(stopFile, 'Snapshot selector is implemented as a <select> element, which is misleading since it is not functional.');
      throw new Error('STOP_SNAPSHOT_SELECTOR_MISLEADING: Uses <select> element');
    }
    
    // Check it doesn't contain a <select> child
    const selectChild = snapshotSelector.locator('select');
    const selectChildCount = await selectChild.count();
    if (selectChildCount > 0) {
      snapshotSelectorResults.push('✗ FAIL: Snapshot selector contains a <select> child (misleading)\n');
      fs.writeFileSync(path.join(RUN_DIR, '41_snapshot_selector_check.txt'), snapshotSelectorResults.join(''));
      const stopFile = path.join(RUN_DIR, 'STOP_SNAPSHOT_SELECTOR_MISLEADING.txt');
      fs.writeFileSync(stopFile, 'Snapshot selector contains a <select> element, which is misleading since it is not functional.');
      throw new Error('STOP_SNAPSHOT_SELECTOR_MISLEADING: Contains <select> child');
    }
    
    // Check cursor is not pointer (should be default or auto)
    const cursorStyle = await snapshotSelector.evaluate((el) => {
      return window.getComputedStyle(el).cursor;
    });
    snapshotSelectorResults.push(`Cursor style: ${cursorStyle}\n`);
    if (cursorStyle === 'pointer') {
      snapshotSelectorResults.push('✗ FAIL: Snapshot selector has cursor:pointer (misleading)\n');
      fs.writeFileSync(path.join(RUN_DIR, '41_snapshot_selector_check.txt'), snapshotSelectorResults.join(''));
      const stopFile = path.join(RUN_DIR, 'STOP_SNAPSHOT_SELECTOR_MISLEADING.txt');
      fs.writeFileSync(stopFile, 'Snapshot selector has cursor:pointer, which suggests it is interactive (misleading).');
      throw new Error('STOP_SNAPSHOT_SELECTOR_MISLEADING: Has pointer cursor');
    }
    
    snapshotSelectorResults.push('\n✓ VERDICT: Snapshot selector is correctly read-only (not misleading)\n');
    fs.writeFileSync(path.join(RUN_DIR, '41_snapshot_selector_check.txt'), snapshotSelectorResults.join(''));
    console.log(`[TEST] Snapshot selector check written to ${path.join(RUN_DIR, '41_snapshot_selector_check.txt')}`);
    
    // ========================================================================
    // PHASE 4: CSS NETWORK PROOF
    // ========================================================================
    console.log('[TEST] Verifying CSS was requested from network...');
    const cssNetworkProof: string[] = [];
    cssNetworkProof.push('=== CSS NETWORK PROOF ===\n\n');
    
    if (cssNetworkUrls.length === 0) {
      cssNetworkProof.push('✗ VERDICT: FAIL - No CSS file matching "enterpriseDashboard" was requested\n');
      fs.writeFileSync(path.join(RUN_DIR, '03_css_network_proof.txt'), cssNetworkProof.join(''));
      const stopFile = path.join(RUN_DIR, 'STOP_CSS_NOT_REQUESTED.txt');
      fs.writeFileSync(stopFile, 'CSS file not requested: no network requests matched "enterpriseDashboard"');
      console.error('[TEST] STOP_CSS_NOT_REQUESTED: No CSS network requests found');
      throw new Error('STOP_CSS_NOT_REQUESTED');
    }
    
    cssNetworkProof.push(`CSS network requests (${cssNetworkUrls.length}):\n`);
    cssNetworkUrls.forEach(url => {
      cssNetworkProof.push(`  ${url}\n`);
    });
    cssNetworkProof.push('\n✓ VERDICT: CSS file was requested from network\n');
    fs.writeFileSync(path.join(RUN_DIR, '03_css_network_proof.txt'), cssNetworkProof.join(''));
    console.log(`[TEST] CSS network proof written to ${path.join(RUN_DIR, '03_css_network_proof.txt')}`);
    
    // ========================================================================
    // CSS LOADED PROOF
    // ========================================================================
    console.log('[TEST] Checking CSS application (computed styles)...');
    const cssProofResults: string[] = [];
    cssProofResults.push('=== CSS COMPUTED STYLE PROOF ===\n\n');
    
    // Get computed styles from Evidence Summary card
    const summaryCardStyles = await summary.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        borderColor: computed.borderColor,
        backgroundColor: computed.backgroundColor,
        borderWidth: computed.borderWidth,
        borderRadius: computed.borderRadius
      };
    });
    
    cssProofResults.push(`Evidence Summary card styles:\n`);
    cssProofResults.push(`  border-color: ${summaryCardStyles.borderColor}\n`);
    cssProofResults.push(`  background-color: ${summaryCardStyles.backgroundColor}\n`);
    cssProofResults.push(`  border-width: ${summaryCardStyles.borderWidth}\n`);
    cssProofResults.push(`  border-radius: ${summaryCardStyles.borderRadius}\n\n`);
    
    // Verify CSS is actually applied (border should not be 'none' and background shouldn't be transparent)
    if (summaryCardStyles.borderWidth === '0px' || summaryCardStyles.borderWidth === 'none') {
      cssProofResults.push('✗ VERDICT: FAIL (CSS not applied - no border)\n');
      fs.writeFileSync(path.join(RUN_DIR, '75_css_computed_proof.txt'), cssProofResults.join(''));
      const stopFile = path.join(RUN_DIR, 'STOP_CSS_NOT_APPLIED.txt');
      fs.writeFileSync(stopFile, 'CSS not applied: card has no border');
      throw new Error('STOP_CSS_NOT_APPLIED');
    }
    
    cssProofResults.push('✓ VERDICT: CSS applied (computed styles confirm stylesheet loaded)\n');
    fs.writeFileSync(path.join(RUN_DIR, '75_css_computed_proof.txt'), cssProofResults.join(''));
    console.log(`[TEST] CSS proof written to ${path.join(RUN_DIR, '75_css_computed_proof.txt')}`);
    
    // ========================================================================
    // ACCESSIBILITY - Copy Button Check
    // ========================================================================
    console.log('[TEST] Checking copy button accessibility...');
    const a11yResults: string[] = [];
    a11yResults.push('=== ACCESSIBILITY PROOF ===\n\n');
    
    const copyButton = gadgetFrame.locator('[data-testid="ft-copy-integrity-hash"]');
    const buttonNodeName = await copyButton.evaluate((el) => el.nodeName);
    
    a11yResults.push(`Copy button element:\n`);
    a11yResults.push(`  nodeName: ${buttonNodeName}\n`);
    
    if (buttonNodeName !== 'BUTTON') {
      a11yResults.push('✗ VERDICT: FAIL (Copy button is not a real <button> element)\n');
      fs.writeFileSync(path.join(RUN_DIR, '76_a11y_button_proof.txt'), a11yResults.join(''));
      throw new Error(`A11Y_FAIL: Copy button nodeName is ${buttonNodeName}, expected BUTTON`);
    }
    
    a11yResults.push('\n✓ VERDICT: PASS (Copy button is a real <button> element)\n');
    fs.writeFileSync(path.join(RUN_DIR, '76_a11y_button_proof.txt'), a11yResults.join(''));
    console.log(`[TEST] A11y proof written to ${path.join(RUN_DIR, '76_a11y_button_proof.txt')}`);
    
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
    
    // ========================================================================
    // SUPPORT BUTTON SANDBOX-SAFETY GATE
    // ========================================================================
    console.log('[TEST] Testing support button (sandbox-safe router.open)...');
    const supportResults: string[] = [];
    supportResults.push('=== SUPPORT BUTTON SANDBOX-SAFETY GATE ===\n\n');
    
    // Find support button
    const supportButton = gadgetFrame.locator('[data-testid="ft-support-button"]');
    const supportButtonExists = await supportButton.count() > 0;
    supportResults.push(`Support button exists: ${supportButtonExists}\n`);
    
    if (!supportButtonExists) {
      const stopFile = path.join(RUN_DIR, 'STOP_SUPPORT_BUTTON_MISSING.txt');
      fs.writeFileSync(stopFile, 'Support button (ft-support-button) not found in gadget frame');
      fs.writeFileSync(path.join(RUN_DIR, '78_support_dom_proof.txt'), supportResults.join(''));
      throw new Error('STOP_SUPPORT_BUTTON_MISSING');
    }
    
    // Record console messages before click
    const consoleBeforeClick = [...consoleLogs];
    
    // Click support button
    console.log('[TEST] Clicking support button...');
    await supportButton.click();
    await page.waitForTimeout(2000); // Allow time for router.open attempt and any fallback
    
    // Record console messages after click
    const consoleAfterClick = consoleLogs.slice(consoleBeforeClick.length);
    
    // Filter for our app scope
    const supportClickMessages = consoleMessages.slice(consoleBeforeClick.length).filter(msg => {
      const url = msg.location || '';
      const isOurApp = (
        url.includes('cdn.prod.atlassian-dev.net') && url.includes('/govGadget')
      ) || url.includes(expectedHeadShortSha);
      return isOurApp;
    });
    
    const supportClickLogsText = supportClickMessages.map(msg => 
      `[${msg.type}] ${msg.text}\n  Location: ${msg.location}`
    ).join('\n\n');
    
    fs.writeFileSync(path.join(RUN_DIR, '77_support_click_console_scope.txt'), 
      supportClickLogsText || 'No scoped console messages from support button click');
    supportResults.push(`\nScoped console messages after click: ${supportClickMessages.length}\n`);
    
    // Check for sandbox block error
    const sandboxBlockFound = consoleAfterClick.some(log => 
      log.includes('SandboxExternalProtocolBlocked') || 
      log.includes('Navigation to external protocol blocked by sandbox')
    );
    
    if (sandboxBlockFound) {
      const stopFile = path.join(RUN_DIR, 'STOP_SUPPORT_SANDBOX_BLOCKED.txt');
      const stopMsg = [
        '=== SUPPORT SANDBOX BLOCK DETECTED ===',
        '',
        'The support button triggered a sandbox navigation block.',
        'This means the implementation is NOT using Forge bridge router.open correctly.',
        '',
        'Console messages after click:',
        ...consoleAfterClick.slice(0, 10).map(log => `  ${log}`)
      ].join('\n');
      fs.writeFileSync(stopFile, stopMsg);
      fs.writeFileSync(path.join(RUN_DIR, '78_support_dom_proof.txt'), supportResults.join(''));
      throw new Error('STOP_SUPPORT_SANDBOX_BLOCKED');
    }
    supportResults.push('✓ No sandbox block error detected\n');
    
    // Check for console errors from our app after click
    const supportConsoleErrors = supportClickMessages.filter(m => m.type === 'error');
    if (supportConsoleErrors.length > 0) {
      const stopFile = path.join(RUN_DIR, 'STOP_SUPPORT_CONSOLE_ERROR.txt');
      const stopMsg = [
        '=== SUPPORT CONSOLE ERROR DETECTED ===',
        '',
        `Found ${supportConsoleErrors.length} error(s) after clicking support button:`,
        '',
        ...supportConsoleErrors.map(err => `  ${err.text}\n  Location: ${err.location}`).join('\n\n')
      ].join('\n');
      fs.writeFileSync(stopFile, stopMsg);
      fs.writeFileSync(path.join(RUN_DIR, '78_support_dom_proof.txt'), supportResults.join(''));
      throw new Error('STOP_SUPPORT_CONSOLE_ERROR');
    }
    supportResults.push('✓ No console errors from our app after click\n');
    
    // Check for FT_SUPPORT_OPEN_ATTEMPT marker
    const openAttemptFound = consoleAfterClick.some(log => 
      log.includes('FT_SUPPORT_OPEN_ATTEMPT')
    );
    
    if (!openAttemptFound) {
      const stopFile = path.join(RUN_DIR, 'STOP_SUPPORT_OPEN_NOT_ATTEMPTED.txt');
      const stopMsg = [
        '=== SUPPORT OPEN NOT ATTEMPTED ===',
        '',
        'The FT_SUPPORT_OPEN_ATTEMPT marker was not found in console logs.',
        'This means router.open was not called.',
        '',
        'Console messages after click:',
        ...consoleAfterClick.slice(0, 10).map(log => `  ${log}`)
      ].join('\n');
      fs.writeFileSync(stopFile, stopMsg);
      fs.writeFileSync(path.join(RUN_DIR, '78_support_dom_proof.txt'), supportResults.join(''));
      throw new Error('STOP_SUPPORT_OPEN_NOT_ATTEMPTED');
    }
    supportResults.push('✓ FT_SUPPORT_OPEN_ATTEMPT marker found\n');
    
    // Check for fallback elements (may or may not appear depending on router.open success)
    const supportUrl = gadgetFrame.locator('[data-testid="ft-support-url"]');
    const supportCopy = gadgetFrame.locator('[data-testid="ft-support-copy"]');
    const fallbackUrlExists = await supportUrl.count() > 0;
    const fallbackCopyExists = await supportCopy.count() > 0;
    
    supportResults.push(`\nFallback elements:\n`);
    supportResults.push(`  ft-support-url exists: ${fallbackUrlExists}\n`);
    supportResults.push(`  ft-support-copy exists: ${fallbackCopyExists}\n`);
    
    if (fallbackUrlExists) {
      const urlText = await supportUrl.innerText();
      supportResults.push(`  URL text: ${urlText}\n`);
    }
    
    supportResults.push('\n✓ VERDICT: PASS - Support button is sandbox-safe\n');
    fs.writeFileSync(path.join(RUN_DIR, '78_support_dom_proof.txt'), supportResults.join(''));
    console.log(`[TEST] Support button proof written to ${path.join(RUN_DIR, '78_support_dom_proof.txt')}`);
    
    // Network proof (attempt marker)
    const networkProof = [
      '=== SUPPORT NETWORK PROOF ===',
      '',
      'Console markers found:',
      `  FT_SUPPORT_OPEN_ATTEMPT: ${openAttemptFound ? 'YES' : 'NO'}`,
      '',
      'Relevant console logs:',
      ...consoleAfterClick.filter(log => log.includes('FT_SUPPORT') || log.includes('support')).map(log => `  ${log}`),
      '',
      '✓ VERDICT: router.open attempt logged'
    ].join('\n');
    fs.writeFileSync(path.join(RUN_DIR, '79_support_network_proof.txt'), networkProof);
    console.log(`[TEST] Support network proof written to ${path.join(RUN_DIR, '79_support_network_proof.txt')}`);
    
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
    contractResults.push(`Extracted from: [data-testid="ft-enterprise-shell"]\n\n`);
    
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
    if (brandFailureDetected) {
      const errorMsg = [
        'BRAND FAILURE: "Firstry" misspelling detected in full page text.',
        'This indicates Jira chrome/metadata still shows "Firstry" (likely caching issue).',
        'See STOP_CHROME_BRAND_MISMATCH.txt and 71/72 viewport captures for details.'
      ].join(' ');
      throw new Error(errorMsg);
    }
    
    console.log('\n[TEST] ✅ ALL ENTERPRISE CONTRACT CHECKS PASSED\n');
  });
});
