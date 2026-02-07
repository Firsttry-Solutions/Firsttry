import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const RUN_DIR = process.env.RUN_DIR;
if (!RUN_DIR) { console.error("STOP: RUN_DIR not set"); process.exit(2); }

const DASHBOARD_URL = process.env.JIRA_DASHBOARD_URL || "https://firsttry.atlassian.net/jira/dashboards/10102";
const THRESHOLD = Number(process.env.FT_LAYOUT_Y_THRESHOLD || 320);

const OUT_JSON = path.join(RUN_DIR, "39_layout_gate.json");
const OUT_TXT  = path.join(RUN_DIR, "39_layout_gate.txt");

const STORAGE_STATE = path.join(process.cwd(), 'e2e/.auth/storageState.persistent.json');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ 
    viewport: { width: 1280, height: 720 },
    storageState: fs.existsSync(STORAGE_STATE) ? STORAGE_STATE : undefined
  });
  const page = await context.newPage();

  const log = [];
  const L = (m) => { console.log(m); log.push(m); };

  try {
    L("=== NUMERIC LAYOUT GATE (FAIL-CLOSED) ===");
    L("Dashboard: " + DASHBOARD_URL);
    L("Threshold y < " + THRESHOLD);

    await page.goto(DASHBOARD_URL, { waitUntil: "domcontentloaded", timeout: 120000 });
    L("Page loaded, waiting for iframe...");
    await page.waitForSelector('iframe', { timeout: 90000 });
    
    // Poll for gadget frame with enterprise contract root (similar to e2e test)
    L("Finding gadget iframe with enterprise contract root...");
    let gadgetFrame = null;
    const startTime = Date.now();
    const maxWait = 120000; // 120s for CDN propagation
    
    while (Date.now() - startTime < maxWait) {
      const frames = page.frames();
      for (const f of frames) {
        try {
          const rootCount = await f.locator('[data-testid="ft-enterprise-contract-root"]').count();
          if (rootCount > 0) {
            gadgetFrame = f;
            L(`Found gadget frame with contract root (url: ${f.url()})`);
            break;
          }
        } catch {}
      }
      if (gadgetFrame) break;
      await page.waitForTimeout(2000); // Check every 2s
    }
    
    if (!gadgetFrame) {
      // Try evidence summary as fallback
      L("Could not find enterprise-contract-root, trying evidence-summary-root...");
      for (const f of page.frames()) {
        try {
          const c = await f.locator('[data-testid="ft-evidence-summary-root"]').count();
          if (c > 0) { 
            gadgetFrame = f; 
            L(`Found gadget frame with evidence summary (url: ${f.url()})`);
            break; 
          }
        } catch {}
      }
    }
    
    if (!gadgetFrame) throw new Error("STOP: could not find gadget frame with ft-enterprise-contract-root or ft-evidence-summary-root");

    const el = gadgetFrame.locator('[data-testid="ft-evidence-summary-root"]');
    await el.waitFor({ state: "visible", timeout: 60000 });
    const box = await el.boundingBox();
    if (!box) throw new Error("STOP: boundingBox is null");

    const y = box.y;
    const height = box.height;

    const pass = y < THRESHOLD;

    const proof = {
      dashboard: DASHBOARD_URL,
      viewport: { width: 1280, height: 720 },
      threshold_y_lt: THRESHOLD,
      evidence_summary: { y, height },
      verdict: pass ? "PASS" : "FAIL",
      generated_utc: new Date().toISOString()
    };

    fs.writeFileSync(OUT_JSON, JSON.stringify(proof, null, 2));

    const txt =
`=== NUMERIC LAYOUT GATE ===
Evidence Summary y=${y.toFixed(2)} height=${height.toFixed(2)}
Threshold: y < ${THRESHOLD}
VERDICT: ${pass ? "PASS" : "FAIL"}
JSON: 39_layout_gate.json
`;
    fs.writeFileSync(OUT_TXT, txt);

    if (!pass) throw new Error(`STOP: Layout FAIL (y=${y} >= ${THRESHOLD})`);

    L("✓ PASS: y=" + y.toFixed(2) + " < " + THRESHOLD);
    L("Wrote: " + OUT_TXT);
    L("Wrote: " + OUT_JSON);

  } catch (e) {
    L("✗ FAIL: " + e.message);
    fs.writeFileSync(OUT_TXT, "VERDICT: FAIL\n" + e.message + "\n");
    await browser.close();
    process.exit(8);
  }

  await browser.close();
})();
