import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

function isoTimestampZ() {
  const now = new Date();
  const iso = now.toISOString(); // YYYY-MM-DDTHH:MM:SS.sssZ
  return iso.replace(/[:.]/g, '').slice(0, 15); // YYYYMMDDTHHMMSSZ
}

// === HELPER: Dump frames information ===
async function dumpFrames(page: any, outDir: string): Promise<void> {
  const framesList: string[] = [];
  framesList.push(`Page URL: ${page.url()}`);
  framesList.push(`Total frames: ${page.frames().length}`);
  framesList.push('');

  for (let i = 0; i < page.frames().length; i++) {
    const frame = page.frames()[i];
    framesList.push(`[Frame ${i}]`);
    framesList.push(`  name: ${frame.name()}`);
    framesList.push(`  url: ${frame.url()}`);
  }

  fs.writeFileSync(path.join(outDir, 'frames.txt'), framesList.join('\n'));
}

// === HELPER: Dump iframe inventory as JSON ===
async function dumpIframeInventory(page: any, outDir: string): Promise<void> {
  const iframes: any[] = [];
  const iframeLocators = page.locator('iframe');
  const count = await iframeLocators.count();

  for (let i = 0; i < count; i++) {
    try {
      const locator = iframeLocators.nth(i);
      const el = locator.first();

      const src = await el.getAttribute('src').catch(() => '');
      const name = await el.getAttribute('name').catch(() => '');
      const id = await el.getAttribute('id').catch(() => '');
      const testid = await el.getAttribute('data-testid').catch(() => '');
      const title = await el.getAttribute('title').catch(() => '');
      const outerHtml = await el.evaluate((el: HTMLElement) => el.outerHTML.substring(0, 500)).catch(() => '');
      const box = await el.boundingBox().catch(() => null);

      iframes.push({
        index: i,
        name,
        id,
        src,
        title,
        testid,
        html: outerHtml,
        boundingBox: box ? { x: box.x, y: box.y, width: box.width, height: box.height } : null,
      });
    } catch (e) {
      // continue on error
    }
  }

  fs.writeFileSync(path.join(outDir, 'iframes.json'), JSON.stringify(iframes, null, 2));
}

// === HELPER: Dump DOM excerpt ===
async function dumpDomExcerpt(page: any, outDir: string): Promise<void> {
  try {
    const mainText = await page.locator('main').first().evaluate((el: HTMLElement) => el.innerText.substring(0, 4000)).catch(() => '(no main)<br/>');
    const mainHtml = await page.locator('main').first().evaluate((el: HTMLElement) => el.innerHTML.substring(0, 4000)).catch(() => '(no main html)');

    const excerpt = `=== MAIN ELEMENT TEXT (first 4000 chars) ===\n${mainText}\n\n=== MAIN ELEMENT HTML (first 4000 chars) ===\n${mainHtml}`;
    fs.writeFileSync(path.join(outDir, 'dom_excerpt.txt'), excerpt);
  } catch (e) {
    fs.writeFileSync(path.join(outDir, 'dom_excerpt.txt'), `Error dumping DOM: ${String(e)}`);
  }
}

test.use({ storageState: 'tests/playwright/.auth/state.json' });

test('Dashboard gadget Phase1 click diagnostics', async ({ page, context }) => {
  const baseUrl = process.env.JIRA_BASE_URL;
  const dashboardUrl = process.env.JIRA_DASHBOARD_URL;

  // === ENV VALIDATION (fail before navigation) ===
  if (!baseUrl) throw new Error('Missing JIRA_BASE_URL');
  if (baseUrl !== 'https://firsttry.atlassian.net') {
    throw new Error(
      `JIRA_BASE_URL must be 'https://firsttry.atlassian.net', got '${baseUrl}'`
    );
  }

  if (!dashboardUrl) throw new Error('Missing JIRA_DASHBOARD_URL');
  const dashboardPrefix = 'https://firsttry.atlassian.net/jira/dashboards/';
  if (!dashboardUrl.startsWith(dashboardPrefix)) {
    throw new Error(
      `JIRA_DASHBOARD_URL must start with '${dashboardPrefix}', got '${dashboardUrl}'`
    );
  }

  // === DETERMINISTIC OUT DIR ===
  const outDir = path.join('/tmp', `pw_dash_diag_${isoTimestampZ()}`);
  fs.mkdirSync(outDir, { recursive: true });
  console.log(`OUT_DIR=${outDir}`);

  // === Error counters (fail-closed tracking) ===
  let pageErrorCount = 0;
  let consoleErrorCount = 0;
  let requestFailedCount = 0;
  let http4xx5xxCount = 0;

  const consoleLines: string[] = [];
  const netLines: string[] = [];
  let traceIdHint = 'NONE';

  // === CREATE LOG FILES EARLY (before any navigation) ===
  fs.writeFileSync(path.join(outDir, 'console.log'), '', { flag: 'w' });
  fs.writeFileSync(path.join(outDir, 'network.log'), '', { flag: 'w' });

  // === Capture console messages and extract trace_ hints ===
  page.on('console', (msg) => {
    const text = msg.text();
    consoleLines.push(`[console.${msg.type()}] ${text}`);

    if (msg.type() === 'error') {
      consoleErrorCount++;
    }

    // Extract trace_ hints from console (look for substring "trace_")
    if (traceIdHint === 'NONE' && text.includes('trace_')) {
      const match = text.match(/trace_[a-zA-Z0-9_-]+/);
      if (match) {
        traceIdHint = match[0];
      }
    }
  });

  // === Track page errors ===
  page.on('pageerror', (err) => {
    pageErrorCount++;
    const errStr = err?.stack || String(err);
    consoleLines.push(`[pageerror] ${errStr}`);
  });

  // === Track failed requests ===
  page.on('requestfailed', (req) => {
    requestFailedCount++;
    const failure = req.failure();
    netLines.push(
      `[requestfailed] ${req.method()} ${req.url()} :: ${failure?.errorText}`
    );
  });

  // === Track HTTP 4xx/5xx responses with deterministic format ===
  page.on('response', async (res) => {
    const status = res.status();
    if (status >= 400) {
      http4xx5xxCount++;
      netLines.push(`HTTP_${status} ${res.request().method()} ${res.url()}`);
    }
  });

  // === NOTE: Tracing is already started by Playwright config (trace: "on") ===
  // === Do NOT manually call context.tracing.start() ===

  try {
    // === Navigate to dashboard ===
    consoleLines.push(`[NAV] Navigating to ${dashboardUrl}`);
    await page.goto(dashboardUrl, { waitUntil: 'domcontentloaded' });

    // === Wait for dashboard readiness (main element + at least one iframe) ===
    consoleLines.push('[WAIT] Waiting for dashboard readiness...');
    try {
      await page.locator('main').first().waitFor({ state: 'visible', timeout: 60_000 });
      consoleLines.push('[READY] Main element visible');
    } catch (e) {
      consoleLines.push('[READY_WARN] Main element not visible after 60s');
    }

    try {
      await page.locator('iframe').first().waitFor({ state: 'attached', timeout: 30_000 });
      consoleLines.push('[READY] First iframe attached');
    } catch (e) {
      consoleLines.push('[READY_WARN] No iframes found after 30s');
    }

    // === Take screenshot after readiness ===
    const afterReadySS = path.join(outDir, 'after-ready.png');
    await page.screenshot({ path: afterReadySS, fullPage: true });
    consoleLines.push('[SCREENSHOT] after-ready.png');

    // === Find gadget frame (enhanced robust search) ===
    let gadgetFrame = null;
    const candidates: any[] = [];

    // Collect iframe candidates
    for (const frame of page.frames()) {
      try {
        const el = frame.owner();
        if (!el) continue;

        const name = (await el.getAttribute('name')) || '';
        const src = (await el.getAttribute('src')) || '';

        // Match criteria: forge, atlassian, hello, or iframe keywords
        const isCandidate = 
          name.toLowerCase().includes('forge') ||
          src.toLowerCase().includes('forge') ||
          src.toLowerCase().includes('atlassian') ||
          src.toLowerCase().includes('hello') ||
          src.toLowerCase().includes('iframe');

        if (isCandidate) {
          const box = await el.boundingBox().catch(() => null);
          const area = box ? box.width * box.height : 0;
          candidates.push({ frame, name, src, area, index: candidates.length, el });
        }
      } catch (e) {
        // continue
      }
    }

    consoleLines.push(`[CANDIDATES] Found ${candidates.length} iframe candidate(s)`);

    // Try to find button in candidates, prioritizing by area (deterministic tie-breaker: lowest index)
    if (candidates.length > 0) {
      candidates.sort((a, b) => (b.area - a.area) || (a.index - b.index));

      for (const candidate of candidates) {
        try {
          const btnCount = await candidate.frame
            .locator('#ft-run-access-review-btn')
            .count()
            .catch(() => 0);
          if (btnCount > 0) {
            gadgetFrame = candidate.frame;
            consoleLines.push(
              `[FRAME_FOUND] Selected candidate with button (name=${candidate.name}, area=${candidate.area})`
            );
            break;
          }
        } catch {
          // continue
        }
      }
    }

    // Attempt 2: Brute-force search all frames for button (fallback)
    if (!gadgetFrame) {
      consoleLines.push('[FRAME_SEARCH] No candidates with button; brute-force scanning all frames...');
      for (const frame of page.frames()) {
        try {
          const btnCount = await frame
            .locator('#ft-run-access-review-btn')
            .count()
            .catch(() => 0);
          if (btnCount > 0) {
            gadgetFrame = frame;
            consoleLines.push('[FRAME_FOUND] Found gadget frame via brute-force scan');
            break;
          }
        } catch {
          // continue
        }
      }
    }

    // === Fail-closed: No gadget frame found - dump inventory before failing ===
    if (!gadgetFrame) {
      consoleLines.push('[FAILURE] Gadget frame not found - collecting inventory...');

      // Dump all diagnostic artifacts
      await dumpFrames(page, outDir);
      consoleLines.push('[INVENTORY] frames.txt written');

      await dumpIframeInventory(page, outDir);
      consoleLines.push('[INVENTORY] iframes.json written');

      await dumpDomExcerpt(page, outDir);
      consoleLines.push('[INVENTORY] dom_excerpt.txt written');

      // Take final screenshot
      const failSS = path.join(outDir, 'after.png');
      await page.screenshot({ path: failSS, fullPage: true });
      consoleLines.push('[SCREENSHOT] after.png');

      throw new Error(
        `Gadget frame not found. pageErrorCount=${pageErrorCount}, consoleErrorCount=${consoleErrorCount}, requestFailedCount=${requestFailedCount}, http4xx5xxCount=${http4xx5xxCount}. See frames.txt, iframes.json, dom_excerpt.txt in OUT_DIR=${outDir}`
      );
    }

    // === Take before screenshot (gadget found) ===
    const preSS = path.join(outDir, 'before.png');
    await page.screenshot({ path: preSS, fullPage: true });
    consoleLines.push('[SCREENSHOT] before.png');

    // === Click button ===
    const runBtn = gadgetFrame.locator('#ft-run-access-review-btn');
    await expect(runBtn).toBeVisible({ timeout: 30_000 });
    consoleLines.push('[ACTION] Clicked button');
    await runBtn.click();

    // === Wait for button text to change: "Scan Complete!" OR startswith "Scan Failed:" OR startswith "Error:" ===
    let outcome = 'UNKNOWN';
    let endTime = Date.now() + 60_000; // 60s timeout

    while (Date.now() < endTime) {
      try {
        const btnText = await runBtn.textContent({ timeout: 1000 }).catch(() => '');
        if (btnText?.includes('Scan Complete!')) {
          outcome = 'OK';
          break;
        }
        if (btnText?.startsWith('Scan Failed:') || btnText?.startsWith('Error:')) {
          outcome = 'FAIL';
          break;
        }
      } catch {
        // timeout, retry
      }
      // Very brief micro-wait before retry
      await page.waitForTimeout(500);
    }

    if (outcome === 'UNKNOWN') {
      outcome = 'TIMEOUT';
    }

    consoleLines.push(`[OUTCOME] ${outcome}`);

    // === Take after screenshot ===
    const postSS = path.join(outDir, 'after.png');
    await page.screenshot({ path: postSS, fullPage: true });
    consoleLines.push('[SCREENSHOT] after.png');

    // === Write all logs ===
    fs.writeFileSync(path.join(outDir, 'console.log'), consoleLines.join('\n'));
    fs.writeFileSync(path.join(outDir, 'network.log'), netLines.join('\n'));

    // === Print final counters and trace hint ===
    console.log(`[COUNTERS] pageErrorCount=${pageErrorCount}`);
    console.log(`[COUNTERS] consoleErrorCount=${consoleErrorCount}`);
    console.log(`[COUNTERS] requestFailedCount=${requestFailedCount}`);
    console.log(`[COUNTERS] http4xx5xxCount=${http4xx5xxCount}`);
    console.log(`[COUNTERS] outcome=${outcome}`);
    console.log(`TRACE_ID_HINT=${traceIdHint}`);
    console.log(`OUT_DIR=${outDir}`);

    // === FAIL-CLOSED: Any error signal causes test failure ===
    if (pageErrorCount > 0) {
      throw new Error(
        `pageErrorCount=${pageErrorCount} (expected 0). OUT_DIR=${outDir}`
      );
    }

    if (consoleErrorCount > 0) {
      throw new Error(
        `consoleErrorCount=${consoleErrorCount} (expected 0). OUT_DIR=${outDir}`
      );
    }

    if (requestFailedCount > 0) {
      throw new Error(
        `requestFailedCount=${requestFailedCount} (expected 0). OUT_DIR=${outDir}`
      );
    }

    if (http4xx5xxCount > 0) {
      throw new Error(
        `http4xx5xxCount=${http4xx5xxCount} (expected 0). OUT_DIR=${outDir}`
      );
    }

    if (outcome !== 'OK') {
      throw new Error(
        `outcome=${outcome} (expected 'OK'). OUT_DIR=${outDir}`
      );
    }
  } finally {
    // === Ensure all artifacts are flushed even on exception ===
    fs.writeFileSync(path.join(outDir, 'console.log'), consoleLines.join('\n'));
    fs.writeFileSync(path.join(outDir, 'network.log'), netLines.join('\n'));
  }
});
