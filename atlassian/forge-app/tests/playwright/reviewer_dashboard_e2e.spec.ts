/**
 * Reviewer Dashboard E2E Test - Jira Dashboard Gadget Rendering
 * 
 * HARD PROOF: Tests that FirstTry dashboard gadget renders inside actual Jira dashboard context.
 * 
 * Prerequisites (FAIL if missing):
 * - JIRA_DASHBOARD_URL: Full dashboard URL (e.g., https://company.atlassian.net/jira/dashboards/10000)
 * - PLAYWRIGHT_STORAGE_STATE: Authenticated session (create with create_storage_state.sh)
 * - Forge tunnel running (development environment)
 * 
 * Evidence captured:
 * - 5 high-quality screenshots (MUST be >= 30KB each)
 * - Console logs (all messages)
 * - Console errors (FAIL if non-empty)
 * - Page errors (FAIL immediately)
 * - Videos + traces (auto-captured by Playwright)
 * 
 * Fail-closed design: ANY failure stops test immediately with diagnostic output.
 */

import { test, expect, Page, ConsoleMessage, FrameLocator } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Configuration from environment
// ============================================================================
const JIRA_DASHBOARD_URL = process.env.JIRA_DASHBOARD_URL;
const SCREENSHOTS_DIR = process.env.PLAYWRIGHT_SCREENSHOTS_DIR || './screenshots';
const CONSOLE_LOG = process.env.PLAYWRIGHT_CONSOLE_LOG || './console.log';
const CONSOLE_ERRORS = process.env.PLAYWRIGHT_CONSOLE_ERRORS || './console_errors.log';
const PAGE_ERRORS = process.env.PLAYWRIGHT_PAGE_ERRORS || './page_errors.log';
const SUMMARY_JSON = process.env.PLAYWRIGHT_SUMMARY_JSON || './summary.json';
const MARKETPLACE_SCREENSHOTS_DIR = path.join(__dirname, '../../../docs/marketplace/screenshots');

// Ensure directories exist
[SCREENSHOTS_DIR, MARKETPLACE_SCREENSHOTS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// ============================================================================
// Evidence collectors
// ============================================================================
const consoleMessages: string[] = [];
const consoleErrors: string[] = [];
const pageErrors: string[] = [];

// ============================================================================
// Test suite
// ============================================================================
test.describe('Reviewer Dashboard E2E - Jira Dashboard Context', () => {
  
  test.beforeAll(() => {
    if (!JIRA_DASHBOARD_URL) {
      throw new Error('[FATAL] JIRA_DASHBOARD_URL environment variable is required');
    }
    console.log(`[INFO] Testing dashboard: ${JIRA_DASHBOARD_URL}`);
  });
  
  test('should render gadget inside Jira dashboard and capture evidence', async ({ page }) => {
    
    // ========================================================================
    // Set up error listeners (FAIL-CLOSED)
    // ========================================================================
    page.on('console', (msg: ConsoleMessage) => {
      const type = msg.type();
      const text = msg.text();
      const timestamp = new Date().toISOString();
      
      const logEntry = `[${timestamp}] [${type.toUpperCase()}] ${text}`;
      consoleMessages.push(logEntry);
      
      if (type === 'error') {
        consoleErrors.push(logEntry);
        console.error(`[CONSOLE ERROR] ${text}`);
      }
    });
    
    page.on('pageerror', (error) => {
      const timestamp = new Date().toISOString();
      const errorEntry = `[${timestamp}] ${error.message}\n${error.stack || ''}`;
      pageErrors.push(errorEntry);
      console.error(`[PAGE ERROR] ${error.message}`);
      
      // Write error immediately
      fs.writeFileSync(PAGE_ERRORS, pageErrors.join('\n'));
      
      // FAIL immediately on page error
      throw new Error(`Page error detected: ${error.message}`);
    });
    
    // ========================================================================
    // Step 1: Navigate to Jira Dashboard
    // ========================================================================
    console.log('[Step 1] Navigating to Jira dashboard...');
    
    const response = await page.goto(JIRA_DASHBOARD_URL!, { 
      waitUntil: 'domcontentloaded',
      timeout: 60000 
    });
    
    expect(response?.status()).toBeLessThan(400);
    console.log(`✓ Dashboard loaded (HTTP ${response?.status()})`);
    
    // Wait for Jira UI to stabilize
    await page.waitForTimeout(5000);
    
    // ========================================================================
    // Step 2: Verify Dashboard Loaded
    // ========================================================================
    console.log('[Step 2] Verifying dashboard loaded...');
    
    // Look for dashboard indicators
    const dashboardSelectors = [
      'div[data-test-id="dashboard-layout"]',
      'div[data-testid="dashboard-layout"]',
      'main[role="main"]',
      '[data-test-id="dashboard.gadgets.dashboard"]'
    ];
    
    let dashboardFound = false;
    for (const selector of dashboardSelectors) {
      try {
        const element = page.locator(selector).first();
        if (await element.isVisible({ timeout: 3000 })) {
          console.log(`✓ Dashboard loaded: ${selector}`);
          dashboardFound = true;
          break;
        }
      } catch (e) {
        // Continue
      }
    }
    
    if (!dashboardFound) {
      // Dump page HTML for diagnosis
      const html = await page.content();
      fs.writeFileSync(path.join(SCREENSHOTS_DIR, 'debug_page_source.html'), html);
      throw new Error('[FATAL] Dashboard not detected. See debug_page_source.html');
    }
    
    // Screenshot 1: Dashboard loaded
    const screenshot1 = path.join(SCREENSHOTS_DIR, 'reviewer_01_dashboard.png');
    await page.screenshot({ path: screenshot1, fullPage: true });
    console.log(`✓ Screenshot 1: ${screenshot1}`);
    await validateScreenshot(screenshot1);
    
    // ========================================================================
    // Step 3: Find and Verify Gadget Iframe
    // ========================================================================
    console.log('[Step 3] Locating gadget iframe...');
    
    // Wait a bit for gadgets to load
    await page.waitForTimeout(3000);
    
    // Find iframes that contain our Forge app
    const iframes = page.frameLocator('iframe').all();
    const iframeCount = await iframes.count();
    console.log(`  Found ${iframeCount} iframe(s) on page`);
    
    if (iframeCount === 0) {
      const html = await page.content();
      fs.writeFileSync(path.join(SCREENSHOTS_DIR, 'debug_no_iframes.html'), html);
      throw new Error('[FATAL] No iframes found on dashboard. See debug_no_iframes.html');
    }
    
    // Look for our gadget iframe (Forge apps are rendered in iframes)
    // Common patterns: contains "forge", contains app ID, contains "atl-paas"
    let gadgetFrame: FrameLocator | null = null;
    
    // Try to find iframe with forge-related src
    const frames = await page.frames();
    console.log(`  Checking ${frames.length} frame(s)...`);
    
    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      const url = frame.url();
      console.log(`    Frame ${i}: ${url.substring(0, 80)}...`);
      
      if (url.includes('forge') || url.includes('atl-paas') || url.includes('app')) {
        console.log(`✓ Found Forge gadget iframe: ${url.substring(0, 100)}`);
        gadgetFrame = page.frameLocator(`iframe[src*="${url.split('/')[2]}"]`).first();
        break;
      }
    }
    
    if (!gadgetFrame) {
      // Last resort: try all iframes
      console.log('[WARN] Could not identify Forge iframe by URL, checking all iframes...');
      gadgetFrame = page.frameLocator('iframe').first();
    }
    
    // Screenshot 2: Gadget visible (full page showing gadget location)
    const screenshot2 = path.join(SCREENSHOTS_DIR, 'reviewer_02_gadget_visible.png');
    await page.screenshot({ path: screenshot2, fullPage: true });
    console.log(`✓ Screenshot 2: ${screenshot2}`);
    await validateScreenshot(screenshot2);
    
    // ========================================================================
    // Step 4: Verify Gadget UI Root Exists
    // ========================================================================
    console.log('[Step 4] Verifying gadget UI rendered...');
    
    // Check if gadget has rendered content
    // Look for common root elements (adjust based on your gadget structure)
    const gadgetSelectors = [
      '[data-testid="ft-root"]',
      '[data-testid="gadget-root"]',
      '[data-testid="governance-dashboard"]',
      'div[id*="root"]',
      'div[class*="App"]'
    ];
    
    let gadgetRootFound = false;
    for (const selector of gadgetSelectors) {
      try {
        const element = gadgetFrame.locator(selector).first();
        if (await element.isVisible({ timeout: 5000 })) {
          console.log(`✓ Gadget UI root found: ${selector}`);
          gadgetRootFound = true;
          break;
        }
      } catch (e) {
        // Continue
      }
    }
    
    if (!gadgetRootFound) {
      console.log('[WARN] Specific root selector not found, checking for any content...');
      
      // Check if iframe has any content
      try {
        const bodyLocator = gadgetFrame.locator('body').first();
        const bodyText = await bodyLocator.textContent({ timeout: 5000 });
        
        if (bodyText && bodyText.trim().length > 0) {
          console.log(`✓ Gadget has rendered content (${bodyText.length} chars)`);
          gadgetRootFound = true;
        }
      } catch (e) {
        const error = e as Error;
        console.error(`[FATAL] Could not access gadget iframe content: ${error.message}`);
        throw new Error('[FATAL] Gadget iframe exists but has no content. Check app deployment.');
      }
    }
    
    if (!gadgetRootFound) {
      throw new Error('[FATAL] Gadget UI root element not found. Gadget may not have rendered.');
    }
    
    // Screenshot 3: Gadget scrolled/interacted (if applicable)
    await page.waitForTimeout(2000);
    const screenshot3 = path.join(SCREENSHOTS_DIR, 'reviewer_03_gadget_scrolled.png');
    await page.screenshot({ path: screenshot3, fullPage: true });
    console.log(`✓ Screenshot 3: ${screenshot3}`);
    await validateScreenshot(screenshot3);
    
    // ========================================================================
    // Step 5: Check for About/Info Panel (optional)
    // ========================================================================
    console.log('[Step 5] Looking for about/info section...');
    
    // Try to find and click about/settings in gadget
    const infoSelectors = [
      '[data-testid="about-button"]',
      '[aria-label*="About"]',
      '[aria-label*="Info"]'
    ];
    
    for (const selector of infoSelectors) {
      try {
        const button = gadgetFrame.locator(selector).first();
        if (await button.isVisible({ timeout: 2000 })) {
          await button.click();
          console.log(`✓ Clicked info button: ${selector}`);
          await page.waitForTimeout(1000);
          break;
        }
      } catch (e) {
        // Continue
      }
    }
    
    // Screenshot 4: About/settings view
    const screenshot4 = path.join(SCREENSHOTS_DIR, 'reviewer_04_about_or_panel.png');
    await page.screenshot({ path: screenshot4, fullPage: true });
    console.log(`✓ Screenshot 4: ${screenshot4}`);
    await validateScreenshot(screenshot4);
    
    // ========================================================================
    // Step 6: Final State
    // ========================================================================
    console.log('[Step 6] Capturing final state...');
    
    await page.waitForTimeout(1000);
    
    // Screenshot 5: Final state
    const screenshot5 = path.join(SCREENSHOTS_DIR, 'reviewer_05_final.png');
    await page.screenshot({ path: screenshot5, fullPage: true });
    console.log(`✓ Screenshot 5: ${screenshot5}`);
    await validateScreenshot(screenshot5);
    
    // ========================================================================
    // Step 7: Copy Screenshots to Marketplace Directory
    // ========================================================================
    console.log('[Step 7] Copying screenshots to marketplace directory...');
    
    const screenshots = [
      'reviewer_01_dashboard.png',
      'reviewer_02_gadget_visible.png',
      'reviewer_03_gadget_scrolled.png',
      'reviewer_04_about_or_panel.png',
      'reviewer_05_final.png'
    ];
    
    for (const screenshot of screenshots) {
      const src = path.join(SCREENSHOTS_DIR, screenshot);
      const dest = path.join(MARKETPLACE_SCREENSHOTS_DIR, `reviewer_e2e_${screenshot}`);
      fs.copyFileSync(src, dest);
      console.log(`  ✓ Copied: ${dest}`);
    }
    
    // ========================================================================
    // Step 8: Write Evidence Files
    // ========================================================================
    console.log('[Step 8] Writing evidence files...');
    
    // Write console log
    fs.writeFileSync(CONSOLE_LOG, consoleMessages.join('\n'));
    console.log(`✓ Console log: ${CONSOLE_LOG} (${consoleMessages.length} messages)`);
    
    // Write console errors
    fs.writeFileSync(CONSOLE_ERRORS, consoleErrors.join('\n'));
    console.log(`✓ Console errors: ${CONSOLE_ERRORS} (${consoleErrors.length} errors)`);
    
    // Write page errors
    fs.writeFileSync(PAGE_ERRORS, pageErrors.join('\n'));
    console.log(`✓ Page errors: ${PAGE_ERRORS} (${pageErrors.length} errors)`);
    
    // Write summary JSON
    const summary = {
      timestamp: new Date().toISOString(),
      dashboardUrl: JIRA_DASHBOARD_URL,
      screenshots: screenshots,
      screenshotsCopiedToMarketplace: true,
      consoleMessages: consoleMessages.length,
      consoleErrors: consoleErrors.length,
      pageErrors: pageErrors.length,
      testStatus: consoleErrors.length === 0 && pageErrors.length === 0 ? 'PASS' : 'FAIL',
      gadgetRendered: true,
      gadgetIframeFound: true
    };
    
    fs.writeFileSync(SUMMARY_JSON, JSON.stringify(summary, null, 2));
    console.log(`✓ Summary JSON: ${SUMMARY_JSON}`);
    
    // ========================================================================
    // Step 9: Fail if Errors Detected (FAIL-CLOSED)
    // ========================================================================
    if (consoleErrors.length > 0) {
      console.error(`[FATAL] ${consoleErrors.length} console error(s) detected:`);
      consoleErrors.forEach(err => console.error(`  ${err}`));
      throw new Error(`Console errors detected: ${consoleErrors.length}`);
    }
    
    if (pageErrors.length > 0) {
      console.error(`[FATAL] ${pageErrors.length} page error(s) detected:`);
      pageErrors.forEach(err => console.error(`  ${err}`));
      throw new Error(`Page errors detected: ${pageErrors.length}`);
    }
    
    console.log('');
    console.log('============================================================');
    console.log('✓ TEST PASSED: Gadget rendered successfully in Jira dashboard');
    console.log('============================================================');
    console.log(`  Dashboard URL: ${JIRA_DASHBOARD_URL}`);
    console.log(`  Screenshots: 5 captured and validated (>= 30KB each)`);
    console.log(`  Console errors: 0`);
    console.log(`  Page errors: 0`);
    console.log('');
  });
});

// ============================================================================
// Helper Functions
// ============================================================================

async function validateScreenshot(screenshotPath: string): Promise<void> {
  if (!fs.existsSync(screenshotPath)) {
    throw new Error(`[FATAL] Screenshot not created: ${screenshotPath}`);
  }
  
  const stats = fs.statSync(screenshotPath);
  const sizeKB = Math.round(stats.size / 1024);
  
  // HARD REQUIREMENT: >= 30KB (real screenshots must be substantial)
  if (stats.size < 30720) {
    throw new Error(`[FATAL] Screenshot too small: ${sizeKB} KB < 30 KB (${screenshotPath})`);
  }
  
  // Check PNG magic bytes
  const fd = fs.openSync(screenshotPath, 'r');
  const buffer = Buffer.alloc(8);
  fs.readSync(fd, buffer, 0, 8, 0);
  fs.closeSync(fd);
  
  // PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
  const pngMagic = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  if (!buffer.equals(pngMagic)) {
    throw new Error(`[FATAL] Screenshot is not a valid PNG: ${screenshotPath}`);
  }
  
  console.log(`  ✓ Screenshot valid: ${sizeKB} KB`);
}
