import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

function isoTimestampZ() {
  const now = new Date();
  const iso = now.toISOString(); // YYYY-MM-DDTHH:MM:SS.sssZ
  return iso.replace(/[:.]/g, '').slice(0, 15); // YYYYMMDDTHHMMSSZ
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

  // === Track HTTP 4xx/5xx responses ===
  page.on('response', async (res) => {
    const status = res.status();
    if (status >= 400) {
      http4xx5xxCount++;
      netLines.push(`[response.${status}] ${res.url()}`);
    }
  });

  // === NOTE: Tracing is already started by Playwright config (trace: "on") ===
  // === Do NOT manually call context.tracing.start() ===

  // === Navigate to dashboard ===
  consoleLines.push(`[NAV] Navigating to ${dashboardUrl}`);
  await page.goto(dashboardUrl, { waitUntil: 'domcontentloaded' });

  // === Find gadget frame (robust search: iframe[name*="forge"] OR brute-force frames) ===
  let gadgetFrame = null;

  // Attempt 1: Look for iframe with 'forge' in name or src attribute
  const forgeIframes = await page.locator('iframe[name*="forge"], iframe[src*="forge"]');
  const forgeCount = await forgeIframes.count();

  if (forgeCount > 0) {
    for (const frame of page.frames()) {
      try {
        const el = frame.owner();
        if (!el) continue;
        const name = (await el.getAttribute('name')) || '';
        const src = (await el.getAttribute('src')) || '';
        if (!name.includes('forge') && !src.includes('forge')) continue;

        const btnCount = await frame
          .locator('#ft-run-access-review-btn')
          .count()
          .catch(() => 0);
        if (btnCount > 0) {
          gadgetFrame = frame;
          consoleLines.push('[FRAME_SEARCH] Found gadget frame via forge iframe');
          break;
        }
      } catch {
        // continue
      }
    }
  }

  // Attempt 2: Brute-force search all frames for #ft-run-access-review-btn
  if (!gadgetFrame) {
    for (const frame of page.frames()) {
      try {
        const btnCount = await frame
          .locator('#ft-run-access-review-btn')
          .count()
          .catch(() => 0);
        if (btnCount > 0) {
          gadgetFrame = frame;
          consoleLines.push('[FRAME_SEARCH] Found gadget frame via brute-force scan');
          break;
        }
      } catch {
        // continue
      }
    }
  }

  // === Fail-closed: No gadget frame found ===
  if (!gadgetFrame) {
    consoleLines.push('[FAILURE] Gadget frame not found');
    const preSS = path.join(outDir, 'before.png');
    await page.screenshot({ path: preSS, fullPage: true });

    // Flush all logs and counters
    fs.writeFileSync(path.join(outDir, 'console.log'), consoleLines.join('\n'));
    fs.writeFileSync(path.join(outDir, 'network.log'), netLines.join('\n'));

    // === NOTE: Tracing is managed by Playwright config, no manual stop needed ===

    throw new Error(
      `Gadget frame not found. pageErrorCount=${pageErrorCount}, consoleErrorCount=${consoleErrorCount}, requestFailedCount=${requestFailedCount}, http4xx5xxCount=${http4xx5xxCount}. OUT_DIR=${outDir}`
    );
  }

  // === Take before screenshot ===
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

  // === NOTE: Tracing is managed by Playwright config, no manual stop needed ===
  // === Playwright will automatically save trace.zip when config has trace: "on" ===

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
});
