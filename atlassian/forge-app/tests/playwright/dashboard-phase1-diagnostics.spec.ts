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

  // Collect all frames and sort deterministically by url then name
  const framesData: Array<{ frame: any; name: string; url: string }> = [];
  for (let i = 0; i < page.frames().length; i++) {
    const frame = page.frames()[i];
    framesData.push({
      frame,
      name: frame.name(),
      url: frame.url(),
    });
  }

  // Sort by url ascending, then name ascending (empty strings first)
  framesData.sort((a, b) => {
    const urlA = a.url || '';
    const urlB = b.url || '';
    if (urlA !== urlB) return urlA.localeCompare(urlB);
    const nameA = a.name || '';
    const nameB = b.name || '';
    return nameA.localeCompare(nameB);
  });

  // Write sorted frames
  for (let i = 0; i < framesData.length; i++) {
    framesList.push(`[Frame ${i}]`);
    framesList.push(`  name: ${framesData[i].name}`);
    framesList.push(`  url: ${framesData[i].url}`);
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

  // Sort deterministically by src ascending, then index ascending
  iframes.sort((a, b) => {
    const srcA = a.src || '';
    const srcB = b.src || '';
    if (srcA !== srcB) return srcA.localeCompare(srcB);
    return a.index - b.index;
  });

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

// === HELPER: Resolve Forge iframe by src + contentFrame mapping ===
async function resolveForgeFrameByIframeSrc(page: any, consoleLines: string[]): Promise<{ frame: any, iframeSrc: string, usedSelector: string, contentFrameNull: boolean } | null> {
  const selectors = [
    'iframe[data-testid="hosted-resources-iframe"][data-forge-iframe="true"]',
    'iframe[data-forge-iframe="true"]',
  ];

  for (const selector of selectors) {
    const handle = await page.$(selector);
    if (!handle) {
      continue;
    }

    const src = (await handle.getAttribute('src')) || '';
    consoleLines.push(`[IFRAME_FOUND] selector=${selector} src=${src || 'EMPTY'}`);

    if (!src) {
      continue;
    }

    // Retry loop: poll contentFrame() for up to 30s with 250ms intervals
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      const frame = await handle.contentFrame();
      if (frame) {
        return { frame, iframeSrc: src, usedSelector: selector, contentFrameNull: false };
      }
      await page.waitForTimeout(250);
    }

    // After deadline, contentFrame() is still null
    consoleLines.push(`[IFRAME_CONTENTFRAME_NULL] selector=${selector} src=${src}`);
  }

  // No iframe matched or no valid frame found
  return null;
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

    // === BACKBONE FIX 3: Check for snapshot-not-available early (deterministic terminal state) ===
    const snapshotNotAvailableMarkers = consoleLines.filter(
      (line) =>
        line.includes('[FT_STATE]') ||
        (line.includes('[FT_GUARD]') && line.includes('BLOCK_RUN_ACCESS_REVIEW'))
    );

    if (snapshotNotAvailableMarkers.length > 0) {
      consoleLines.push('[SNAPSHOT_GUARD] Snapshot NOT_AVAILABLE - blocking action execution');

      // Parse and dump snapshot status
      const snapshotStatus: any[] = [];
      for (const markerLine of snapshotNotAvailableMarkers) {
        try {
          // Extract JSON from [FT_STATE]/[FT_GUARD] lines
          const jsonMatch = markerLine.match(/\{.*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            snapshotStatus.push(parsed);
          }
        } catch (e) {
          // JSON parse failed, just include raw line
          snapshotStatus.push({ rawLine: markerLine });
        }
      }

      // Write snapshot-status.json
      fs.writeFileSync(
        path.join(outDir, 'snapshot-status.json'),
        JSON.stringify(snapshotStatus, null, 2)
      );
      consoleLines.push('[INVENTORY] snapshot-status.json written');

      // Take screenshot showing the blocked state
      const snapshotRequiredSS = path.join(outDir, 'snapshot-required.png');
      await page.screenshot({ path: snapshotRequiredSS, fullPage: true });
      consoleLines.push('[SCREENSHOT] snapshot-required.png');

      // Fail-closed but with explicit error message
      throw new Error(
        `SNAPSHOT_REQUIRED: snapshot not available (see snapshot-status.json in OUT_DIR=${outDir})`
      );
    }

    // === BACKBONE FIX 2: Find gadget frame by atlassian-dev.net URL detection ===
    let gadgetFrame = null;
    let selectedFrameUrl = 'NONE';
    let iframeSelectorUsed = 'NONE';
    let iframeSrc = 'EMPTY';
    let contentFrameNullAfterRetry = false;
    const allFrames: any[] = [];

    // Step A: Enumerate ALL frames and record their URLs and names
    for (const frame of page.frames()) {
      const frameUrl = frame.url();
      const frameName = frame.name();
      const isMain = frame === page.mainFrame();
      allFrames.push({ frame, url: frameUrl, name: frameName, isMain });
      consoleLines.push(`[FRAME_ENUM] url=${frameUrl}, name=${frameName}, main=${isMain}`);
    }

    // Also write frames info to frames.txt
    await dumpFrames(page, outDir);
    consoleLines.push('[FRAME_DUMP] Enumerated all frames to frames.txt');

    // Step A1: PRIMARY - Try iframe[data-testid] + iframe[data-forge-iframe] with contentFrame mapping
    const iframeResult = await resolveForgeFrameByIframeSrc(page, consoleLines);
    if (iframeResult && iframeResult.frame) {
      gadgetFrame = iframeResult.frame;
      selectedFrameUrl = iframeResult.iframeSrc;
      iframeSelectorUsed = iframeResult.usedSelector;
      iframeSrc = iframeResult.iframeSrc;
      contentFrameNullAfterRetry = iframeResult.contentFrameNull;
      consoleLines.push(`[FRAME_SELECTED_IFRAME] selector=${iframeSelectorUsed} src=${selectedFrameUrl}`);
    } else {
      consoleLines.push('[FRAME_SELECTED_IFRAME] NONE');
    }

    // Step B: Fallback - Determine gadget frame by matching atlassian-dev.net URL
    // Sort deterministically by URL ascending, then by name ascending
    const sortedFrames = [...allFrames].sort((a, b) => {
      if (a.url !== b.url) return a.url.localeCompare(b.url);
      return a.name.localeCompare(b.name);
    });

    // Find first frame with atlassian-dev.net in URL (only if iframe selection failed)
    if (!gadgetFrame) {
      for (const frameInfo of sortedFrames) {
        if (
          frameInfo.url.includes('atlassian-dev.net') ||
          frameInfo.url.includes('hello.atlassian-dev.net') ||
          frameInfo.url.includes('/global-bridge.js')
        ) {
          gadgetFrame = frameInfo.frame;
          selectedFrameUrl = frameInfo.url;
          consoleLines.push(
            `[FRAME_SELECTED] url=${selectedFrameUrl}, name=${frameInfo.name}`
          );
          break;
        }
      }
    }

    // Step C: If no URL match found, fall back to searching by console marker UI_ENTRY_RUNTIME_PROOF
    if (!gadgetFrame) {
      consoleLines.push('[FRAME_FALLBACK] No atlassian-dev.net frame found; checking console markers...');
      // Console lines are already captured; look for UI_ENTRY_RUNTIME_PROOF patterns
      const uiEntryLine = consoleLines.find((line) => line.includes('[UI_ENTRY_RUNTIME_PROOF]'));
      if (uiEntryLine && uiEntryLine.includes('atlassian-dev.net')) {
        // Extract domain hint and match frames by that
        const match = uiEntryLine.match(/(https?:\/\/[\w.-]+\.atlassian-dev\.net)/i);
        if (match) {
          const domainHint = match[1];
          for (const frameInfo of sortedFrames) {
            if (frameInfo.url.includes('atlassian-dev.net')) {
              gadgetFrame = frameInfo.frame;
              selectedFrameUrl = frameInfo.url;
              consoleLines.push(
                `[FRAME_SELECTED_FALLBACK] via console hint, url=${selectedFrameUrl}`
              );
              break;
            }
          }
        }
      }
    }

    // Step D: If still no gadget frame, brute-force search all frames for the button
    if (!gadgetFrame) {
      consoleLines.push('[FRAME_BRUTE_FORCE] Attempting brute-force button search across all frames...');
      for (const frameInfo of sortedFrames) {
        try {
          const btnCount = await frameInfo.frame
            .locator('#ft-run-access-review-btn')
            .count()
            .catch(() => 0);
          if (btnCount > 0) {
            gadgetFrame = frameInfo.frame;
            selectedFrameUrl = frameInfo.url;
            consoleLines.push(
              `[FRAME_SELECTED_BUTTON] Found button in frame, url=${selectedFrameUrl}`
            );
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

      // Write iframe selection evidence
      const iframeSelectionEvidence = {
        marker: 'IFRAME_SELECTION_V1',
        selected: false,
        selector: iframeSelectorUsed,
        iframeSrc: iframeSrc,
        contentFrameNullAfterRetry: contentFrameNullAfterRetry,
        ts: new Date().toISOString(),
      };
      fs.writeFileSync(
        path.join(outDir, 'iframe-selection.txt'),
        JSON.stringify(iframeSelectionEvidence, null, 2)
      );
      consoleLines.push('[INVENTORY] iframe-selection.txt written');

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
        `Gadget frame not found (selectedFrameUrl=${selectedFrameUrl}, iframeSelectorUsed=${iframeSelectorUsed}, iframeSrc=${iframeSrc}, contentFrameNullAfterRetry=${contentFrameNullAfterRetry}). pageErrorCount=${pageErrorCount}, consoleErrorCount=${consoleErrorCount}, requestFailedCount=${requestFailedCount}, http4xx5xxCount=${http4xx5xxCount}. See frames.txt, iframes.json, iframe-selection.txt, dom_excerpt.txt in OUT_DIR=${outDir}`
      );
    }

    // === Print frame selection result ===
    console.log(`FRAME_SELECTED url=${selectedFrameUrl}`);

    // === Write iframe selection evidence (success case) ===
    const iframeSelectionSuccess = {
      marker: 'IFRAME_SELECTION_V1',
      selected: true,
      selector: iframeSelectorUsed,
      iframeSrc: iframeSrc,
      contentFrameNullAfterRetry: contentFrameNullAfterRetry,
      ts: new Date().toISOString(),
    };
    fs.writeFileSync(
      path.join(outDir, 'iframe-selection.txt'),
      JSON.stringify(iframeSelectionSuccess, null, 2)
    );

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
