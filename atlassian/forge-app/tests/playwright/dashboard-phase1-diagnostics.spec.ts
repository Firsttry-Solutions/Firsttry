import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

function ts() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

test.use({ storageState: 'tests/playwright/.auth/state.json' });

test('Dashboard gadget Phase1 click diagnostics', async ({ page }) => {

  const baseUrl = process.env.JIRA_BASE_URL;
  const dashboardUrl = process.env.JIRA_DASHBOARD_URL;
  const gadgetTitle = process.env.GADGET_TITLE || 'FirstTry: Audit Evidence for Jira';

  if (!baseUrl) throw new Error('Missing JIRA_BASE_URL');
  if (!dashboardUrl) throw new Error('Missing JIRA_DASHBOARD_URL');

  const outDir = path.join('/tmp', `pw_dash_diag_${ts()}`);
  fs.mkdirSync(outDir, { recursive: true });

  const consoleLogPath = path.join(outDir, 'console.log');
  const netLogPath = path.join(outDir, 'network.log');

  const consoleLines: string[] = [];
  const netLines: string[] = [];

  page.on('console', (msg) => {
    consoleLines.push(`[console.${msg.type()}] ${msg.text()}`);
  });

  page.on('pageerror', (err) => {
    consoleLines.push(`[pageerror] ${err?.stack || String(err)}`);
  });

  page.on('requestfailed', (req) => {
    const failure = req.failure();
    netLines.push(`[requestfailed] ${req.method()} ${req.url()} :: ${failure?.errorText}`);
  });

  page.on('response', async (res) => {
    if (res.status() >= 400) {
      netLines.push(`[response>=400] ${res.status()} ${res.url()}`);
    }
  });

  await page.goto(dashboardUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  await page.getByText(gadgetTitle, { exact: false }).first().waitFor({ timeout: 60_000 });

  let gadgetFrame = null;

  for (const frame of page.frames()) {
    try {
      const count = await frame.getByText(/Run Access Review/i).count().catch(() => 0);
      if (count > 0) {
        gadgetFrame = frame;
        break;
      }
    } catch {}
  }

  if (!gadgetFrame) {
    await page.screenshot({ path: path.join(outDir, 'no-gadget.png'), fullPage: true });
    fs.writeFileSync(consoleLogPath, consoleLines.join('\n'));
    fs.writeFileSync(netLogPath, netLines.join('\n'));
    throw new Error(`Gadget frame not found. See ${outDir}`);
  }

  await page.screenshot({ path: path.join(outDir, 'before.png'), fullPage: true });

  const runBtn = gadgetFrame.getByRole('button', { name: /Run Access Review/i });
  await expect(runBtn).toBeVisible({ timeout: 30_000 });

  await runBtn.click();

  const failBanner = gadgetFrame.getByText(/Scan Failed/i);
  const okBanner = gadgetFrame.getByText(/Scan Complete/i);

  const outcome = await Promise.race([
    okBanner.waitFor({ timeout: 45_000 }).then(() => 'OK'),
    failBanner.waitFor({ timeout: 45_000 }).then(() => 'FAIL')
  ]).catch(() => 'TIMEOUT');

  consoleLines.push(`[OUTCOME] ${outcome}`);

  await page.screenshot({ path: path.join(outDir, 'after.png'), fullPage: true });

  fs.writeFileSync(consoleLogPath, consoleLines.join('\n'));
  fs.writeFileSync(netLogPath, netLines.join('\n'));

  if (outcome !== 'OK') {
    throw new Error(`Phase1 outcome=${outcome}. Inspect ${outDir}`);
  }
});
