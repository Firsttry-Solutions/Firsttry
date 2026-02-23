import { test, expect } from '@playwright/test';
import fs from 'fs';

const TARGET_URL = process.env.FT_TARGET_URL || 'REPLACE_ME_WITH_GADGET_PAGE_URL';

test('FirstTry production customer smoke: screenshot + console + click proof', async ({ browser }) => {
  if (TARGET_URL.includes('REPLACE_ME')) {
    throw new Error('Set FT_TARGET_URL to the exact Jira page URL where the FirstTry gadget renders.');
  }

  const evidenceDir = process.env.FT_EVIDENCE_DIR || `/tmp/ft_pw_prod_smoke_${new Date().toISOString().replace(/[:.]/g, '')}`;
  fs.mkdirSync(evidenceDir, { recursive: true });

  const storageStatePath = process.env.FT_E2E_STORAGE_STATE || '/tmp/ft_storage_state.json';
  if (!fs.existsSync(storageStatePath)) {
    throw new Error(
      `FAIL: storageState not found at ${storageStatePath}. ` +
      'Run: FT_E2E_STORAGE_STATE=/tmp/ft_storage_state.json node tools/e2e_save_storage_state_manual.mjs'
    );
  }
  const context = await browser.newContext({ storageState: storageStatePath });
  const page = await context.newPage();

  const consoleLines: string[] = [];
  const pageErrors: string[] = [];

  page.on('console', (msg) => consoleLines.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', (err) => pageErrors.push(String(err)));

  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  await page.screenshot({ path: `${evidenceDir}/prod_ui.png`, fullPage: true });

  async function clickIfPossible(label: string, testId?: string) {
    const locator = testId ? page.locator(`[data-testid="${testId}"]`) : page.getByRole('button', { name: label });
    const visible = await locator.first().isVisible().catch(() => false);
    if (!visible) return { clicked: false, reason: 'NOT_VISIBLE' };
    const disabled = await locator.first().isDisabled().catch(() => true);
    if (disabled) return { clicked: false, reason: 'DISABLED' };
    await locator.first().click({ timeout: 5000 });
    await page.waitForTimeout(2000);
    return { clicked: true, reason: 'CLICKED' };
  }

  const results: any = {};
  results.runAccessReview = await clickIfPossible('Run Access Review', 'ft-action-run-access-review');
  results.exportEvidence = await clickIfPossible('Export Evidence Pack', 'ft-action-export-evidence');
  results.sealReview = await clickIfPossible('Seal Review (Immutable)', 'ft-action-seal-review');

  await page.screenshot({ path: `${evidenceDir}/prod_ui_after_clicks.png`, fullPage: true });

  fs.writeFileSync(`${evidenceDir}/browser_console.txt`, consoleLines.join('\n'), 'utf8');
  fs.writeFileSync(`${evidenceDir}/page_errors.txt`, pageErrors.join('\n'), 'utf8');
  fs.writeFileSync(`${evidenceDir}/click_results.json`, JSON.stringify(results, null, 2), 'utf8');

  // HARD CUSTOMER-READY ASSERTIONS
  const forbidden = 'Backend invoke failed: data is not defined';
  const forbiddenInConsole = consoleLines.some(l => l.includes(forbidden));
  expect(forbiddenInConsole, `Forbidden console string present: ${forbidden}`).toBeFalsy();

  const hasRenderCrash = consoleLines.some(l => l.includes('FT_PROOF_UI_RENDER_CRASH'));
  expect(hasRenderCrash, 'UI render crash marker found in console.').toBeFalsy();

  const anyClicked = Object.values(results).some((r: any) => r.clicked === true);
  const hasClickProof = consoleLines.some(l => l.includes('[FT_PROOF_UI_CLICK]'));
  if (anyClicked) {
    expect(hasClickProof, 'Expected [FT_PROOF_UI_CLICK] in browser console after clicking.').toBeTruthy();
  }

  await context.close();
  console.log(`FT_EVIDENCE_DIR=${evidenceDir}`);
});
