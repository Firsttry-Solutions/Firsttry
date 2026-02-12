import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// === ENV FLAGS ===
const FORCE_FORGE_CONSOLE_ERROR = process.env.FT_FORCE_FORGE_CONSOLE_ERROR === '1';
const FT_DETERMINISTIC_IFRAME_SRC_HASH_ONLY = process.env.FT_DETERMINISTIC_IFRAME_SRC_HASH_ONLY === '1';

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

// === HELPER: Console entry structure ===
interface ConsoleEntry {
  kind: string;
  level: string;
  text: string;
  location: { url: string; lineNumber: number; columnNumber: number };
  ts: string;
}

// === HELPER: Classification context ===
interface ClassificationContext {
  iframeSrc: string;
  selectedFrameUrl: string;
  bundleUrl: string;
  iframeOriginHost: string;
  bundleHost: string;
}

// === HELPER: Deterministic console error entry (no timestamps) ===
interface DeterministicConsoleErrorEntry {
  level: string;
  text: string;
  locationUrl: string;
  lineNumber: number;
  columnNumber: number;
  derivedHost: string;
  originBasis: 'location' | 'text_fallback' | 'unknown';
}

// === HELPER: Runtime console error entry (includes timestamps) ===
interface RuntimeConsoleErrorEntry extends DeterministicConsoleErrorEntry {
  tsIso: string;
}

// === HELPER: Extract hostname from URL safely ===
function extractHostnameFromUrl(urlStr: string): string {
  if (!urlStr) return '';
  try {
    const url = new URL(urlStr);
    return url.hostname;
  } catch {
    return '';
  }
}

// === HELPER: Classify console entry as forge or host (fail-closed) ===
function classifyConsoleEntry(
  entry: ConsoleEntry,
  ctx: ClassificationContext
): { origin: 'forge' | 'host'; derivedHost: string; originBasis: 'location' | 'text_fallback' | 'unknown' } {
  const locationUrl = entry.location.url || '';
  const text = entry.text;

  // Extract hostname from location URL
  const locationHost = extractHostnameFromUrl(locationUrl);

  // PRIMARY BASIS: locationUrl hostname matching
  if (locationHost) {
    // Check if hostname matches iframe origin host
    if (ctx.iframeOriginHost && locationHost === ctx.iframeOriginHost) {
      return { origin: 'forge', derivedHost: locationHost, originBasis: 'location' };
    }

    // Check if hostname matches bundle host
    if (ctx.bundleHost && locationHost === ctx.bundleHost) {
      return { origin: 'forge', derivedHost: locationHost, originBasis: 'location' };
    }

    // Check if hostname ends with "atlassian-dev.net"
    if (locationHost.endsWith('atlassian-dev.net')) {
      return { origin: 'forge', derivedHost: locationHost, originBasis: 'location' };
    }

    // Check if hostname is forge.cdn.prod.atlassian-dev.net (bridge scripts)
    if (locationHost === 'forge.cdn.prod.atlassian-dev.net') {
      return { origin: 'forge', derivedHost: locationHost, originBasis: 'location' };
    }

    // If locationHost is populated but didn't match, it's host
    return { origin: 'host', derivedHost: locationHost, originBasis: 'location' };
  }

  // SECONDARY BASIS: Text fallback (only if locationUrl unparseable and we detected Forge iframe)
  if (text.includes('[FT_') || text.includes('[UI_')) {
    if (ctx.iframeSrc && ctx.iframeSrc !== 'EMPTY' && ctx.iframeSrc !== '') {
      return { origin: 'forge', derivedHost: 'unknown', originBasis: 'text_fallback' };
    }
  }

  // Default: unknown
  return { origin: 'host', derivedHost: '', originBasis: 'unknown' };
}

// === HELPER: Extract bundle URL from markers ===
function extractBundleUrl(consoleLines: string[]): string {
  const bundlePattern = /https:\/\/[^\s"]+\/app\.[0-9a-f]{40}\.js/i;
  for (const line of consoleLines) {
    const match = line.match(bundlePattern);
    if (match) {
      return match[0];
    }
  }
  return '';
}

// === HELPER: Extract host from URL ===
function extractHostFromUrl(url: string): string {
  if (!url) return '';
  try {
    return new URL(url).host;
  } catch {
    return '';
  }
}

// === HELPER: Compute SHA256 hash of file content ===
function computeFileSha256(filePath: string): string {
  const content = fs.readFileSync(filePath, 'utf-8');
  return crypto.createHash('sha256').update(content).digest('hex');
}

// === HELPER: Compute SHA256 hash of string content ===
function computeStringSha256(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

// === HELPER: Write clean determinism hashes (path-independent format for clean diffs) ===
function writeCleanDeterminismHashes(outDir: string, detConsoleErrorsPath: string, detInjectionPath: string | null): void {
  const detConsoleErrorsSha = computeFileSha256(detConsoleErrorsPath);
  let detInjectionSha = '';
  if (detInjectionPath && fs.existsSync(detInjectionPath)) {
    detInjectionSha = computeFileSha256(detInjectionPath);
  }

  const cleanLines: string[] = [];
  cleanLines.push(`HASH_console_errors_deterministic=${detConsoleErrorsSha}`);
  if (detInjectionSha) {
    cleanLines.push(`HASH_forge_error_injection_deterministic=${detInjectionSha}`);
  }

  // Write clean hashes file, then compute its hash for inclusion
  const cleanHashesPath = path.join(outDir, 'determinism-hashes.clean.txt');
  fs.writeFileSync(cleanHashesPath, cleanLines.join('\n') + '\n');

  // Now compute hash of the clean hashes file and add it to itself
  const cleanHashesSha = computeFileSha256(cleanHashesPath);
  cleanLines.push(`HASH_determinism_hashes_txt=${cleanHashesSha}`);
  fs.writeFileSync(cleanHashesPath, cleanLines.join('\n') + '\n');
}

// === HELPER: Write split deterministic + runtime evidence files ===
function writeConsoleErrorsEvidence(params: {
  outDir: string;
  iframeSrc: string;
  selectedFrameUrl: string;
  bundleUrl: string;
  forgeIframeErrors: DeterministicConsoleErrorEntry[];
  hostPageErrors: DeterministicConsoleErrorEntry[];
  forgeIframeErrorsRuntime: RuntimeConsoleErrorEntry[];
  hostPageErrorsRuntime: RuntimeConsoleErrorEntry[];
  traceIdHint: string;
  consoleLinesTail: string[]; // Last 60 lines, not sorted
}): void {
  const {
    outDir,
    iframeSrc,
    selectedFrameUrl,
    bundleUrl,
    forgeIframeErrors,
    hostPageErrors,
    forgeIframeErrorsRuntime,
    hostPageErrorsRuntime,
    traceIdHint,
    consoleLinesTail,
  } = params;

  // Determine iframe hash fields based on flag
  let deterministicIframeSrc = iframeSrc;
  let deterministicIframeHost = '';
  let deterministicIframeSrcSha256 = '';
  if (FT_DETERMINISTIC_IFRAME_SRC_HASH_ONLY && iframeSrc && iframeSrc !== 'EMPTY') {
    deterministicIframeSrcSha256 = computeStringSha256(iframeSrc);
    deterministicIframeHost = extractHostnameFromUrl(iframeSrc);
    deterministicIframeSrc = ''; // Don't include raw src in deterministic
  }

  // === DETERMINISTIC FILE: console-errors.deterministic.json ===
  const deterministicReport: any = {
    marker: 'CONSOLE_ERRORS_V1_DETERMINISTIC',
  };

  if (FT_DETERMINISTIC_IFRAME_SRC_HASH_ONLY && iframeSrc && iframeSrc !== 'EMPTY') {
    deterministicReport.iframeHost = deterministicIframeHost;
    deterministicReport.iframeSrcSha256 = deterministicIframeSrcSha256;
  } else {
    deterministicReport.iframeSrc = iframeSrc;
  }

  deterministicReport.selectedFrameUrl = selectedFrameUrl;
  deterministicReport.bundleUrl = bundleUrl;
  deterministicReport.counts = {
    forgeConsoleErrorCount: forgeIframeErrors.length,
    hostConsoleErrorCount: hostPageErrors.length,
    totalConsoleErrorCount: forgeIframeErrors.length + hostPageErrors.length,
  };
  deterministicReport.forgeIframeErrors = forgeIframeErrors;
  deterministicReport.hostPageErrors = hostPageErrors;

  fs.writeFileSync(
    path.join(outDir, 'console-errors.deterministic.json'),
    JSON.stringify(deterministicReport, null, 2)
  );

  // === RUNTIME FILE: console-errors.runtime.json ===
  const runStartedIso = new Date().toISOString();
  const runtimeReport = {
    marker: 'CONSOLE_ERRORS_V1_RUNTIME',
    outDir,
    traceIdHint: traceIdHint === 'NONE' ? null : traceIdHint,
    runStartedIso,
    iframeSrc,
    selectedFrameUrl,
    bundleUrl,
    counts: {
      forgeConsoleErrorCount: forgeIframeErrorsRuntime.length,
      hostConsoleErrorCount: hostPageErrorsRuntime.length,
      totalConsoleErrorCount: forgeIframeErrorsRuntime.length + hostPageErrorsRuntime.length,
    },
    forgeIframeErrors: forgeIframeErrorsRuntime,
    hostPageErrors: hostPageErrorsRuntime,
    rawConsoleLinesTail: consoleLinesTail,
  };

  fs.writeFileSync(
    path.join(outDir, 'console-errors.runtime.json'),
    JSON.stringify(runtimeReport, null, 2)
  );
}

// === HELPER: Write split injection evidence files ===
function writeForgeErrorInjectionEvidence(params: {
  outDir: string;
  enabled: boolean;
  iframeSrc: string;
  selectedFrameUrl: string;
}): void {
  const { outDir, enabled, iframeSrc, selectedFrameUrl } = params;

  // Determine iframe hash fields based on flag
  let deterministicIframeHost = '';
  let deterministicIframeSrcSha256 = '';
  if (FT_DETERMINISTIC_IFRAME_SRC_HASH_ONLY && iframeSrc && iframeSrc !== 'EMPTY') {
    deterministicIframeSrcSha256 = computeStringSha256(iframeSrc);
    deterministicIframeHost = extractHostnameFromUrl(iframeSrc);
  }

  // === DETERMINISTIC FILE ===
  const deterministicInjection: any = {
    marker: 'FORGE_ERROR_INJECTION_V1_DETERMINISTIC',
    enabled,
  };

  if (FT_DETERMINISTIC_IFRAME_SRC_HASH_ONLY && iframeSrc && iframeSrc !== 'EMPTY') {
    deterministicInjection.iframeHost = deterministicIframeHost;
    deterministicInjection.iframeSrcSha256 = deterministicIframeSrcSha256;
  } else {
    deterministicInjection.iframeSrc = iframeSrc;
  }

  deterministicInjection.selectedFrameUrl = selectedFrameUrl;
  deterministicInjection.injectedText = enabled ? '[FT_FORCED_FORGE_ERROR]' : null;

  fs.writeFileSync(
    path.join(outDir, 'forge-error-injection.deterministic.json'),
    JSON.stringify(deterministicInjection, null, 2)
  );

  // === RUNTIME FILE ===
  const runtimeInjection = {
    marker: 'FORGE_ERROR_INJECTION_V1_RUNTIME',
    enabled,
    iframeSrc,
    selectedFrameUrl,
    injectedText: enabled ? '[FT_FORCED_FORGE_ERROR]' : null,
    ts: new Date().toISOString(),
  };

  fs.writeFileSync(
    path.join(outDir, 'forge-error-injection.runtime.json'),
    JSON.stringify(runtimeInjection, null, 2)
  );
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
  let requestFailedCount = 0;
  let http4xx5xxCount = 0;
  let forgeConsoleErrorCount = 0;
  let hostConsoleErrorCount = 0;

  const runStartedIso = new Date().toISOString(); // Capture once at beginning for runtime evidence

  const consoleLines: string[] = [];
  const consoleEntries: ConsoleEntry[] = [];
  const netLines: string[] = [];
  let traceIdHint = 'NONE';

  // Variables for console error classification and frame selection (needed in finally block)
  let iframeSrc = 'EMPTY';
  let selectedFrameUrl = 'NONE';
  let iframeSelectorUsed = 'NONE';
  let contentFrameNullAfterRetry = false;

  // === CREATE LOG FILES EARLY (before any navigation) ===
  fs.writeFileSync(path.join(outDir, 'console.log'), '', { flag: 'w' });
  fs.writeFileSync(path.join(outDir, 'network.log'), '', { flag: 'w' });

  // === Capture console messages with structured metadata ===
  page.on('console', (msg) => {
    const text = msg.text();
    const level = msg.type();
    const location = msg.location();
    const ts = new Date().toISOString();

    // Add to string log
    consoleLines.push(`[console.${level}] ${text}`);

    // Add to structured entries
    const entry: ConsoleEntry = {
      kind: 'console',
      level,
      text,
      location: {
        url: location?.url || '',
        lineNumber: location?.lineNumber || 0,
        columnNumber: location?.columnNumber || 0,
      },
      ts,
    };
    consoleEntries.push(entry);

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
        `Gadget frame not found (selectedFrameUrl=${selectedFrameUrl}, iframeSelectorUsed=${iframeSelectorUsed}, iframeSrc=${iframeSrc}, contentFrameNullAfterRetry=${contentFrameNullAfterRetry}). pageErrorCount=${pageErrorCount}, forgeConsoleErrorCount=${forgeConsoleErrorCount}, hostConsoleErrorCount=${hostConsoleErrorCount}, requestFailedCount=${requestFailedCount}, http4xx5xxCount=${http4xx5xxCount}. See frames.txt, iframes.json, iframe-selection.txt, dom_excerpt.txt in OUT_DIR=${outDir}`
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

    // === INJECT FORGE IFRAME CONSOLE ERROR (if FORCE_FORGE_CONSOLE_ERROR enabled) ===
    if (FORCE_FORGE_CONSOLE_ERROR) {
      await gadgetFrame.evaluate(() => console.error('[FT_FORCED_FORGE_ERROR]'));
      await page.waitForTimeout(250); // Ensure listener captures deterministically
      consoleLines.push('[FORGE_ERROR_INJECTED] ok');
    } else {
      consoleLines.push('[FORGE_ERROR_INJECTED] skipped');
    }

    // === DETERMINE CONSOLE ERROR CLASSIFICATION CONTEXT ===
    const bundleUrl = extractBundleUrl(consoleLines);
    const iframeOriginHost = extractHostFromUrl(iframeSrc);
    const bundleHost = extractHostFromUrl(bundleUrl);

    // Classify all console entries
    const ctx: ClassificationContext = {
      iframeSrc,
      selectedFrameUrl,
      bundleUrl,
      iframeOriginHost,
      bundleHost,
    };

    const forgeIframeErrorsDet: DeterministicConsoleErrorEntry[] = [];
    const hostPageErrorsDet: DeterministicConsoleErrorEntry[] = [];
    const forgeIframeErrorsRun: RuntimeConsoleErrorEntry[] = [];
    const hostPageErrorsRun: RuntimeConsoleErrorEntry[] = [];

    for (const entry of consoleEntries) {
      if (entry.level === 'error') {
        const { origin, derivedHost, originBasis } = classifyConsoleEntry(entry, ctx);

        // Deterministic entry (no timestamps)
        const detEntry: DeterministicConsoleErrorEntry = {
          level: entry.level,
          text: entry.text,
          locationUrl: entry.location.url,
          lineNumber: entry.location.lineNumber,
          columnNumber: entry.location.columnNumber,
          derivedHost,
          originBasis,
        };

        // Runtime entry (with timestamp)
        const runEntry: RuntimeConsoleErrorEntry = {
          ...detEntry,
          tsIso: entry.ts,
        };

        if (origin === 'forge') {
          forgeConsoleErrorCount++;
          forgeIframeErrorsDet.push(detEntry);
          forgeIframeErrorsRun.push(runEntry);
        } else {
          hostConsoleErrorCount++;
          hostPageErrorsDet.push(detEntry);
          hostPageErrorsRun.push(runEntry);
        }
      }
    }

    // Sort deterministic errors (stable order for hash consistency)
    const sortErrorFunc = (a: DeterministicConsoleErrorEntry, b: DeterministicConsoleErrorEntry) => {
      const urlA = a.locationUrl || '';
      const urlB = b.locationUrl || '';
      if (urlA !== urlB) return urlA.localeCompare(urlB);
      if (a.lineNumber !== b.lineNumber) return a.lineNumber - b.lineNumber;
      if (a.columnNumber !== b.columnNumber) return a.columnNumber - b.columnNumber;
      if (a.text !== b.text) return a.text.localeCompare(b.text);
      return a.derivedHost.localeCompare(b.derivedHost);
    };

    forgeIframeErrorsDet.sort(sortErrorFunc);
    hostPageErrorsDet.sort(sortErrorFunc);

    // Sort runtime errors using the same comparator on the deterministic fields
    forgeIframeErrorsRun.sort((a, b) => sortErrorFunc(a, b));
    hostPageErrorsRun.sort((a, b) => sortErrorFunc(a, b));

    // Get last 60 lines of console for runtime evidence (preserve order, don't sort)
    const consoleLinesTail = consoleLines.slice(-60);

    // Write split evidence files
    writeConsoleErrorsEvidence({
      outDir,
      iframeSrc,
      selectedFrameUrl,
      bundleUrl,
      forgeIframeErrors: forgeIframeErrorsDet,
      hostPageErrors: hostPageErrorsDet,
      forgeIframeErrorsRuntime: forgeIframeErrorsRun,
      hostPageErrorsRuntime: hostPageErrorsRun,
      traceIdHint,
      consoleLinesTail,
    });

    consoleLines.push(
      `[CONSOLE_ERRORS_WRITTEN] deterministic=${outDir}/console-errors.deterministic.json runtime=${outDir}/console-errors.runtime.json forgeErrors=${forgeConsoleErrorCount} hostErrors=${hostConsoleErrorCount}`
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
    console.log(`[COUNTERS] forgeConsoleErrorCount=${forgeConsoleErrorCount}`);
    console.log(`[COUNTERS] hostConsoleErrorCount=${hostConsoleErrorCount}`);
    console.log(`[COUNTERS] requestFailedCount=${requestFailedCount}`);
    console.log(`[COUNTERS] http4xx5xxCount=${http4xx5xxCount}`);
    console.log(`[COUNTERS] outcome=${outcome}`);
    console.log(`TRACE_ID_HINT=${traceIdHint}`);
    console.log(`OUT_DIR=${outDir}`);

    // === FAIL-CLOSED: ONLY fail if Forge iframe-origin error exists ===
    // Host noise, request failures, and 4xx/5xx are logged but do NOT cause failure
    if (forgeConsoleErrorCount > 0) {
      throw new Error(
        `forgeConsoleErrorCount=${forgeConsoleErrorCount} (expected 0). hostConsoleErrorCount=${hostConsoleErrorCount}. FORCE_FORGE_CONSOLE_ERROR=${FORCE_FORGE_CONSOLE_ERROR}. OUT_DIR=${outDir}`
      );
    }
  } finally {
    // === Ensure all artifacts are flushed even on exception ===
    fs.writeFileSync(path.join(outDir, 'console.log'), consoleLines.join('\n'));
    fs.writeFileSync(path.join(outDir, 'network.log'), netLines.join('\n'));

    // === Re-compute classification context in case it wasn't done due to early failure ===
    const bundleUrl = extractBundleUrl(consoleLines);
    const iframeOriginHost = extractHostFromUrl(iframeSrc);
    const bundleHost = extractHostFromUrl(bundleUrl);

    const ctx: ClassificationContext = {
      iframeSrc,
      selectedFrameUrl,
      bundleUrl,
      iframeOriginHost,
      bundleHost,
    };

    // === Re-classify entries if not already done (early failure case) ===
    // This is needed in finally block to ensure evidence is written regardless of test flow
    let forgeIframeErrorsDet: DeterministicConsoleErrorEntry[] = [];
    let hostPageErrorsDet: DeterministicConsoleErrorEntry[] = [];
    let forgeIframeErrorsRun: RuntimeConsoleErrorEntry[] = [];
    let hostPageErrorsRun: RuntimeConsoleErrorEntry[] = [];

    // Check if we need to reclassify (early failure case where console errors weren't written yet)
    const detConsoleErrorsPath = path.join(outDir, 'console-errors.deterministic.json');
    const runtimeConsoleErrorsPath = path.join(outDir, 'console-errors.runtime.json');
    const needsReclassification = !fs.existsSync(detConsoleErrorsPath);

    if (needsReclassification) {
      for (const entry of consoleEntries) {
        if (entry.level === 'error') {
          const { origin, derivedHost, originBasis } = classifyConsoleEntry(entry, ctx);

          const detEntry: DeterministicConsoleErrorEntry = {
            level: entry.level,
            text: entry.text,
            locationUrl: entry.location.url,
            lineNumber: entry.location.lineNumber,
            columnNumber: entry.location.columnNumber,
            derivedHost,
            originBasis,
          };

          const runEntry: RuntimeConsoleErrorEntry = {
            ...detEntry,
            tsIso: entry.ts,
          };

          if (origin === 'forge') {
            forgeConsoleErrorCount++;
            forgeIframeErrorsDet.push(detEntry);
            forgeIframeErrorsRun.push(runEntry);
          } else {
            hostConsoleErrorCount++;
            hostPageErrorsDet.push(detEntry);
            hostPageErrorsRun.push(runEntry);
          }
        }
      }

      // Sort deterministic errors
      const sortErrorFunc = (a: DeterministicConsoleErrorEntry, b: DeterministicConsoleErrorEntry) => {
        const urlA = a.locationUrl || '';
        const urlB = b.locationUrl || '';
        if (urlA !== urlB) return urlA.localeCompare(urlB);
        if (a.lineNumber !== b.lineNumber) return a.lineNumber - b.lineNumber;
        if (a.columnNumber !== b.columnNumber) return a.columnNumber - b.columnNumber;
        if (a.text !== b.text) return a.text.localeCompare(b.text);
        return a.derivedHost.localeCompare(b.derivedHost);
      };

      forgeIframeErrorsDet.sort(sortErrorFunc);
      hostPageErrorsDet.sort(sortErrorFunc);
      forgeIframeErrorsRun.sort((a, b) => sortErrorFunc(a, b));
      hostPageErrorsRun.sort((a, b) => sortErrorFunc(a, b));
    } else {
      // Evidence was already written in the try block above
      // Parse them from files for re-use in hash computation if needed
      const detReport = JSON.parse(fs.readFileSync(detConsoleErrorsPath, 'utf-8'));
      forgeIframeErrorsDet = detReport.forgeIframeErrors || [];
      hostPageErrorsDet = detReport.hostPageErrors || [];
      const runReport = JSON.parse(fs.readFileSync(runtimeConsoleErrorsPath, 'utf-8'));
      forgeIframeErrorsRun = runReport.forgeIframeErrors || [];
      hostPageErrorsRun = runReport.hostPageErrors || [];
    }

    // Get last 60 lines of console for runtime evidence
    const consoleLinesTail = consoleLines.slice(-60);

    // Compute iframe hashing params for deterministic evidence (if enabled)
    let iframeHost = '';
    let iframeSrcSha256 = '';
    if (FT_DETERMINISTIC_IFRAME_SRC_HASH_ONLY && iframeSrc && iframeSrc !== 'EMPTY') {
      iframeHost = extractHostnameFromUrl(iframeSrc);
      iframeSrcSha256 = computeStringSha256(iframeSrc);
    }

    // Write split evidence files (even if already written, this ensures consistency)
    writeConsoleErrorsEvidence({
      outDir,
      iframeSrc,
      selectedFrameUrl,
      bundleUrl,
      forgeIframeErrors: forgeIframeErrorsDet,
      hostPageErrors: hostPageErrorsDet,
      forgeIframeErrorsRuntime: forgeIframeErrorsRun,
      hostPageErrorsRuntime: hostPageErrorsRun,
      traceIdHint,
      consoleLinesTail,
    });

    // Write forge error injection evidence files
    writeForgeErrorInjectionEvidence({
      outDir,
      enabled: FORCE_FORGE_CONSOLE_ERROR,
      iframeSrc,
      selectedFrameUrl,
    });

    // === DETERMINISTIC HASH PROOF (if enabled) ===
    const FT_ASSERT_DETERMINISTIC_HASH = process.env.FT_ASSERT_DETERMINISTIC_HASH === '1';
    if (FT_ASSERT_DETERMINISTIC_HASH) {
      const detConsoleErrorsSha = computeFileSha256(detConsoleErrorsPath);
      const deterministicHashes: string[] = [];
      deterministicHashes.push(`console-errors.deterministic.json ${detConsoleErrorsSha}`);

      // Add injection file hash if it was created
      const detInjectionPath = path.join(outDir, 'forge-error-injection.deterministic.json');
      if (fs.existsSync(detInjectionPath)) {
        const detInjectionSha = computeFileSha256(detInjectionPath);
        deterministicHashes.push(`forge-error-injection.deterministic.json ${detInjectionSha}`);
      }

      // Write deterministic hashes file (no timestamps, just stable hashes)
      fs.writeFileSync(
        path.join(outDir, 'determinism-hashes.txt'),
        deterministicHashes.join('\n')
      );

      // Write clean determinism hashes (path-independent format)
      writeCleanDeterminismHashes(outDir, detConsoleErrorsPath, detInjectionPath);

      consoleLines.push('[DETERMINISM] determinism-hashes.txt written');
      consoleLines.push('[DETERMINISM] determinism-hashes.clean.txt written');
      fs.writeFileSync(path.join(outDir, 'console.log'), consoleLines.join('\n'));
    }
  }
});

/*
========== PROOF COMMANDS (Split Deterministic + Runtime Evidence) ==========

Run 1 without injection (deterministic hashing enabled):
  rm -rf /tmp/pw_dash_diag_* /tmp/pw_novnc_run_*
  export JIRA_BASE_URL="https://firsttry.atlassian.net"
  export JIRA_DASHBOARD_URL="https://firsttry.atlassian.net/jira/dashboards/10102"
  unset FT_FORCE_FORGE_CONSOLE_ERROR
  export FT_ASSERT_DETERMINISTIC_HASH=1
  timeout 180 bash scripts/proof/run_playwright_with_novnc.sh 2>&1 | tee /tmp/pw_run1.log
  OUT1="$(ls -1dt /tmp/pw_dash_diag_* | head -1)"
  echo "=== Run 1 Hashes ==="
  cat "$OUT1/determinism-hashes.txt"
  echo "=== Run 1 Clean Hashes ==="
  cat "$OUT1/determinism-hashes.clean.txt"

Run 2 without injection (must match Run 1 hashes for determinism):
  rm -rf /tmp/pw_dash_diag_* /tmp/pw_novnc_run_*
  export JIRA_BASE_URL="https://firsttry.atlassian.net"
  export JIRA_DASHBOARD_URL="https://firsttry.atlassian.net/jira/dashboards/10102"
  unset FT_FORCE_FORGE_CONSOLE_ERROR
  export FT_ASSERT_DETERMINISTIC_HASH=1
  timeout 180 bash scripts/proof/run_playwright_with_novnc.sh 2>&1 | tee /tmp/pw_run2.log
  OUT2="$(ls -1dt /tmp/pw_dash_diag_* | head -1)"
  echo "=== Run 2 Hashes ==="
  cat "$OUT2/determinism-hashes.txt"
  echo "=== Run 2 Clean Hashes ==="
  cat "$OUT2/determinism-hashes.clean.txt"
  echo "=== Determinism Check (hashes should match) ==="
  diff "$OUT1/determinism-hashes.txt" "$OUT2/determinism-hashes.txt" && echo "✓ DETERMINISTIC" || echo "✗ NOT deterministic"
  echo "=== Clean Diff Check (should be empty/no paths) ==="
  diff "$OUT1/determinism-hashes.clean.txt" "$OUT2/determinism-hashes.clean.txt" && echo "✓ CLEAN DIFF (identical)" || echo "✗ Clean hashes differ"

Run 3 with iframe src hashing enabled (clean diff + no raw iframeSrc in deterministic):
  rm -rf /tmp/pw_dash_diag_* /tmp/pw_novnc_run_*
  export JIRA_BASE_URL="https://firsttry.atlassian.net"
  export JIRA_DASHBOARD_URL="https://firsttry.atlassian.net/jira/dashboards/10102"
  unset FT_FORCE_FORGE_CONSOLE_ERROR
  export FT_ASSERT_DETERMINISTIC_HASH=1
  export FT_DETERMINISTIC_IFRAME_SRC_HASH_ONLY=1
  timeout 180 bash scripts/proof/run_playwright_with_novnc.sh 2>&1 | tee /tmp/pw_run3.log
  OUT3="$(ls -1dt /tmp/pw_dash_diag_* | head -1)"
  echo "=== Run 3 Console Errors Deterministic (has iframeHost & iframeSrcSha256, NO raw iframeSrc) ==="
  node -e 'const fs=require("fs");const j=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));console.log(JSON.stringify(j,null,2));' "$OUT3/console-errors.deterministic.json" | head -15
  echo "=== Run 3 Console Errors Runtime (still has raw iframeSrc for debugging) ==="
  node -e 'const fs=require("fs");const j=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));console.log("iframeSrc present:", !!j.iframeSrc);console.log("iframeSrc starts with:", j.iframeSrc?.substring(0,60));' "$OUT3/console-errors.runtime.json"

Run with injection (will fail on forgeConsoleErrorCount):
  rm -rf /tmp/pw_dash_diag_* /tmp/pw_novnc_run_*
  export JIRA_BASE_URL="https://firsttry.atlassian.net"
  export JIRA_DASHBOARD_URL="https://firsttry.atlassian.net/jira/dashboards/10102"
  export FT_FORCE_FORGE_CONSOLE_ERROR=1
  export FT_ASSERT_DETERMINISTIC_HASH=1
  timeout 180 bash scripts/proof/run_playwright_with_novnc.sh 2>&1 | tee /tmp/pw_inject.log
  OUT_INJ="$(ls -1dt /tmp/pw_dash_diag_* | head -1)"
  echo "=== Evidence Files ==="
  cat "$OUT_INJ/forge-error-injection.deterministic.json"
  echo "=== Console Errors Deterministic ==="
  node -e 'const fs=require("fs");const j=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));console.log("forge errors:",j.forgeIframeErrors.length);console.log("host errors:",j.hostPageErrors.length);' "$OUT_INJ/console-errors.deterministic.json"
  echo "=== Console Errors Runtime (tail) ==="
  node -e 'const fs=require("fs");const j=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));console.log("forge errors:",j.forgeIframeErrors.length);console.log("host errors:",j.hostPageErrors.length);console.log("rawConsoleTail lines:",j.rawConsoleLinesTail.length);' "$OUT_INJ/console-errors.runtime.json"
*/
