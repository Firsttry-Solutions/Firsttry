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
  
  test.beforeEach(async () => {
    // Get RUN_DIR from environment variable (Phase 6 requirement) or fallback to file
    if (process.env.RUN_DIR) {
      RUN_DIR = process.env.RUN_DIR;
      console.log(`[TEST] Using RUN_DIR from env: ${RUN_DIR}`);
    } else {
      const runDirPath = '/tmp/current_contract_run_dir.txt';
      if (!fs.existsSync(runDirPath)) {
        console.error('[TEST] STOP_NO_RUN_DIR: No RUN_DIR env var and /tmp/current_contract_run_dir.txt not found');
        throw new Error('STOP_NO_RUN_DIR');
      }
      RUN_DIR = fs.readFileSync(runDirPath, 'utf8').trim();
      console.log(`[TEST] Using RUN_DIR from file: ${RUN_DIR}`);
    }
    
    if (!fs.existsSync(RUN_DIR)) {
      fs.mkdirSync(RUN_DIR, { recursive: true });
    }
  });
  
  test.afterEach(async ({ page }) => {
    // ALWAYS write console logs, even on failure
    const consoleLogPath = path.join(RUN_DIR, '51_console.txt');
    fs.writeFileSync(consoleLogPath, consoleLogs.join('\n'));
    console.log(`[TEST] Console logs written to ${consoleLogPath}`);
  });
  
  test('ENTERPRISE CONTRACT - All fields present and valid', async ({ page }) => {
    // Capture console logs
    page.on('console', msg => {
      const text = msg.text();
      consoleLogs.push(`[${msg.type()}] ${text}`);
    });
    
    page.on('pageerror', err => {
      consoleLogs.push(`[ERROR] ${err.message}`);
    });
    
    // Navigate to dashboard (USE domcontentloaded, NOT networkidle)
    console.log(`[TEST] Navigating to ${JIRA_DASHBOARD_URL}`);
    await page.goto(JIRA_DASHBOARD_URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
    
    // Wait for any iframe to appear
    console.log('[TEST] Waiting for iframe...');
    await page.waitForSelector('iframe', { timeout: 60000 });
    
    // Find gadget iframe intelligently (polling loop, max 60s)
    console.log('[TEST] Finding gadget iframe...');
    let gadgetFrame: any = null;
    const startTime = Date.now();
    const maxWait = 60000;
    
    while (Date.now() - startTime < maxWait) {
      const frames = page.frames();
      for (const frame of frames) {
        try {
          const frameUrl = frame.url();
          // Check if this frame contains our root testid
          const rootCount = await frame.locator('[data-testid="ft-enterprise-contract-root"]').count();
          if (rootCount > 0) {
            gadgetFrame = frame;
            console.log(`[TEST] Found gadget frame with root testid (url: ${frameUrl})`);
            break;
          }
        } catch (e) {
          // Frame might not be ready, continue
        }
      }
      if (gadgetFrame) break;
      await page.waitForTimeout(1000);
    }
    
    if (!gadgetFrame) {
      const stopFile = path.join(RUN_DIR, 'STOP_NO_GADGET_FRAME.txt');
      fs.writeFileSync(stopFile, 'Could not find gadget iframe with ft-enterprise-contract-root within 60s');
      throw new Error('STOP_NO_GADGET_FRAME');
    }
    
    console.log('[TEST] Gadget frame found, waiting for enterprise contract root...');
    await gadgetFrame.locator('[data-testid="ft-enterprise-contract-root"]').waitFor({ timeout: 30000 });
    console.log('[TEST] Enterprise contract root visible');
    
    // Capture screenshot EARLY (before any assertions fail)
    const screenshotPath = path.join(RUN_DIR, '52_dashboard.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`[TEST] Screenshot saved to ${screenshotPath}`);
    
    // Extract envelope JSON from window global in the gadget frame
    console.log('[TEST] Extracting envelope from window global...');
    const envelope = await gadgetFrame.evaluate(() => {
      return (window as any).__FT_LAST_DASH_ENVELOPE_V1 || null;
    });
    
    if (!envelope) {
      const stopFile = path.join(RUN_DIR, 'STOP_NO_ENVELOPE_GLOBAL.txt');
      fs.writeFileSync(stopFile, 'window.__FT_LAST_DASH_ENVELOPE_V1 not found in gadget frame');
      throw new Error('STOP_NO_ENVELOPE_GLOBAL');
    }
    
    // Write envelope to file
    const envelopePath = path.join(RUN_DIR, '50_envelope.json');
    fs.writeFileSync(envelopePath, JSON.stringify(envelope, null, 2));
    console.log(`[TEST] Envelope saved to ${envelopePath}`);
    
    // ========================================================================
    // ENVELOPE VALIDATION
    // ========================================================================
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
    
    console.log('\n[TEST] ✅ ALL ENTERPRISE CONTRACT CHECKS PASSED\n');
  });
});
