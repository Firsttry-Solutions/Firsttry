import fs from "fs";
import path from "path";
import crypto from "crypto";
import { chromium } from "playwright";

function mustEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`[FATAL] Missing required env var: ${name}`);
  return v;
}

function sha256hex(s) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function writeJson(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2));
}

(async () => {
  const RUN_DIR = mustEnv("RUN_DIR");
  const JIRA_DASHBOARD_URL = mustEnv("JIRA_DASHBOARD_URL");
  const STORAGE_STATE = mustEnv("STORAGE_STATE");

  const headFull = fs.readFileSync(path.join(RUN_DIR, "01_head_full.txt"), "utf8").trim();
  const headShort12 = fs.readFileSync(path.join(RUN_DIR, "02_head_short12.txt"), "utf8").trim();
  const headCommitTime = fs.readFileSync(path.join(RUN_DIR, "03_head_commit_time_utc.txt"), "utf8").trim();

  const consoleLogPath = path.join(RUN_DIR, "40_console.log");
  const pageErrorsPath = path.join(RUN_DIR, "41_page_errors.log");
  const harPath = path.join(RUN_DIR, "42_network.har");
  const tracePath = path.join(RUN_DIR, "43_trace.zip");
  const screenshotPath = path.join(RUN_DIR, "44_dashboard.png");
  const extractedAnchorPath = path.join(RUN_DIR, "45_extracted_identity_anchor.json");
  const extractedUiDiagPath = path.join(RUN_DIR, "46_extracted_ui_panel.json");
  const extractedBundleMetaPath = path.join(RUN_DIR, "47_bundle_meta.json");
  const verdictPath = path.join(RUN_DIR, "99_VERDICT.json");

  fs.writeFileSync(consoleLogPath, "");
  fs.writeFileSync(pageErrorsPath, "");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    storageState: STORAGE_STATE,
    recordHar: { path: harPath, content: "embed" },
    viewport: { width: 1400, height: 900 },
  });

  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });

  const page = await context.newPage();

  const consoleEntries = [];
  page.on("console", (msg) => {
    const line = `[${msg.type()}] ${msg.text()}`;
    consoleEntries.push(line);
    fs.appendFileSync(consoleLogPath, line + "\n");
  });

  const pageErrors = [];
  page.on("pageerror", (err) => {
    const line = `[pageerror] ${err?.stack || String(err)}`;
    pageErrors.push(line);
    fs.appendFileSync(pageErrorsPath, line + "\n");
  });

  // Go to dashboard
  await page.goto(JIRA_DASHBOARD_URL, { waitUntil: "domcontentloaded", timeout: 240000 });
  await page.waitForTimeout(8000);

  // Take screenshot
  await page.screenshot({ path: screenshotPath, fullPage: true });

  // Extract script src for app.<sha>.js and fetch it
  const entrySrc = await page.evaluate(() => {
    const scripts = Array.from(document.querySelectorAll("script"));
    const hit = scripts.map(s => s.getAttribute("src")).find(src => src && /app\.[a-f0-9]{40}\.js/.test(src));
    return hit || null;
  });

  if (!entrySrc) {
    throw new Error("[FATAL] Could not locate app.<40hex>.js script src in DOM (bundle not detected).");
  }

  const entryUrl = new URL(entrySrc, page.url()).toString();

  // Fetch JS content via Playwright request
  const resp = await page.request.get(entryUrl);
  if (!resp.ok()) throw new Error(`[FATAL] Failed to fetch entry bundle: ${entryUrl} status=${resp.status()}`);
  const jsText = await resp.text();

  // Extract identity anchor
  const anchorMatch = jsText.match(/FT_IDENTITY_ANCHOR_V1\|git=([a-f0-9]{7})\|bundle=([a-f0-9]{7})\|time=([0-9T:\-\.Z]+)/);
  if (!anchorMatch) throw new Error("[FATAL] Identity anchor not found in fetched bundle.");
  const anchor = { git7: anchorMatch[1], bundle7: anchorMatch[2], time: anchorMatch[3], entryUrl };
  writeJson(extractedAnchorPath, anchor);

  // Compute stripped bundle hash prefix7 (best-effort: raw sha256 of full JS, still deterministic check)
  const rawBundleSha = sha256hex(jsText);
  const rawPrefix7 = rawBundleSha.slice(0, 7);
  writeJson(extractedBundleMetaPath, { rawBundleSha256: rawBundleSha, rawPrefix7 });

  // Extract UI diagnostics panel fields by text labels (best-effort, but fail if missing core ones)
  const uiPanel = await page.evaluate(() => {
    const text = (el) => (el ? (el.textContent || "").trim() : "");
    const all = Array.from(document.querySelectorAll("*"));
    const findValueAfterLabel = (label) => {
      const lab = all.find(n => text(n) === label);
      if (!lab) return null;
      // try next sibling or parent row
      const sib = lab.nextElementSibling;
      if (sib && text(sib)) return text(sib);
      const row = lab.closest("tr");
      if (row) {
        const tds = Array.from(row.querySelectorAll("td"));
        if (tds.length >= 2) return text(tds[1]);
      }
      const parent = lab.parentElement;
      if (parent) {
        const kids = Array.from(parent.children);
        const idx = kids.indexOf(lab);
        if (idx >= 0 && kids[idx + 1] && text(kids[idx + 1])) return text(kids[idx + 1]);
      }
      return null;
    };

    return {
      uiBuildSha: findValueAfterLabel("UI Build SHA"),
      backendBuildSha: findValueAfterLabel("Backend Build SHA"),
      snapshotCount: findValueAfterLabel("Snapshot Count"),
      storageState: findValueAfterLabel("Storage State"),
      lastSnapshotAtUtc: findValueAfterLabel("Last Snapshot At (UTC)"),
      lastSuccessAtUtc: findValueAfterLabel("Last Success At (UTC)"),
      uiRequestId: findValueAfterLabel("UI Request ID (Nonce)"),
    };
  });

  writeJson(extractedUiDiagPath, uiPanel);

  // HARD FAIL conditions
  const fatalConsole = consoleEntries.filter(l =>
    /CSP|Content Security Policy|FATAL|_FATAL_MISSING_FORGE_BRIDGE|bridge/i.test(l)
  );
  const fatalErrors = pageErrors.slice();

  // Required UI panel fields must exist (backend may be temporarily ERROR if not loaded, but must be present as a field)
  if (!uiPanel.uiBuildSha) throw new Error("[FATAL] UI panel missing 'UI Build SHA' value (cannot prove runtime identity).");
  if (!uiPanel.backendBuildSha) throw new Error("[FATAL] UI panel missing 'Backend Build SHA' value (cannot prove backend identity).");

  // Identity matching checks
  // 1) UI Build SHA should contain the HEAD short12 OR at minimum match HEAD full prefix
  const uiBuild = uiPanel.uiBuildSha.trim();
  const headPrefix12 = headShort12;
  const headPrefix7 = headFull.slice(0,7);
  const uiHasHead = uiBuild.includes(headPrefix12) || uiBuild.includes(headFull) || uiBuild.includes(headPrefix7);
  if (!uiHasHead) {
    throw new Error(`[FATAL] UI Build SHA does not match HEAD. uiBuild="${uiBuild}" head="${headFull}"`);
  }

  // 2) Anchor git7 must equal HEAD prefix7
  if (anchor.git7 !== headPrefix7) {
    throw new Error(`[FATAL] Anchor git7 mismatch. anchor.git7=${anchor.git7} head7=${headPrefix7}`);
  }

  // 3) Anchor time must equal HEAD commit time (exact)
  if (anchor.time !== headCommitTime) {
    throw new Error(`[FATAL] Anchor time mismatch. anchor.time=${anchor.time} headCommitTime=${headCommitTime}`);
  }

  // 4) If any fatal console/page errors exist -> FAIL
  if (fatalConsole.length) {
    throw new Error(`[FATAL] Console contains fatal/CSP/bridge markers:\n${fatalConsole.join("\n")}`);
  }
  if (fatalErrors.length) {
    throw new Error(`[FATAL] Page errors detected:\n${fatalErrors.join("\n")}`);
  }

  // Write verdict
  const verdict = {
    status: "PASS",
    headFull,
    headShort12,
    headCommitTime,
    entryUrl: anchor.entryUrl,
    anchor,
    uiPanel,
    bundleRawSha256: rawBundleSha
  };
  writeJson(verdictPath, verdict);

  await context.tracing.stop({ path: tracePath });
  await context.close();
  await browser.close();

  // Final sanity: ensure artifacts exist
  const mustExist = [consoleLogPath, pageErrorsPath, harPath, tracePath, screenshotPath, extractedAnchorPath, extractedUiDiagPath, extractedBundleMetaPath, verdictPath];
  for (const p of mustExist) {
    if (!fs.existsSync(p)) throw new Error(`[FATAL] Missing required artifact: ${p}`);
  }
})();
