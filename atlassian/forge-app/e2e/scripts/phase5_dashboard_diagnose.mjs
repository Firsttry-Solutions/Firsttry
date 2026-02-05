#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { chromium } from "playwright";

const JIRA_DASHBOARD_URL = process.env.JIRA_DASHBOARD_URL;
const STORAGE_STATE = process.env.STORAGE_STATE;
const OUTPUT_DIR =
  process.env.OUTPUT_DIR ||
  `/tmp/phase5_dashboard_diag_${Date.now()}_${Math.random().toString(36).substring(7)}`;
const TIMEOUT_MS = parseInt(process.env.TIMEOUT_MS || "60000");
const MAX_WAIT_MARKERS_MS = parseInt(process.env.MAX_WAIT_MARKERS_MS || "45000");
const STRICT = process.env.STRICT !== "0";
const HEADLESS = process.env.HEADLESS !== "0";

let exitCode = 0;
let markerCount = 0;
let bundleMatched = false;
let fatalDetected = false;
let selectedFrameUrl = "";
let jiraSite = "";
const startedAt = new Date().toISOString();
let finishedAt = startedAt;

const consoleLines = [];
const networkLines = [];
const domLines = [];
const markerLines = [];
const pageErrors = [];
const failedRequests = [];

console.log(`[OUTPUT_DIR] ${OUTPUT_DIR}`);

/**
 * PHASE 4 REGRESSION TESTS: Validate UI content for enterprise requirements
 * Returns: { passed: boolean, failures: string[], checks: object }
 */
async function validateUIContent(frame) {
  const results = {
    passed: true,
    failures: [],
    checks: {
      noNotAvailable: false,
      appVersionPresent: false,
      buildShaValid: false,
      snapshotMetadataPopulated: false
    }
  };

  try {
    // Extract visible text content from the frame
    const pageText = await frame.evaluate(() => document.body.innerText);
    
    // TEST 1: No "NOT_AVAILABLE" in rendered UI
    if (pageText.includes("NOT_AVAILABLE")) {
      results.passed = false;
      results.failures.push("FAIL: UI contains 'NOT_AVAILABLE' placeholder");
    } else {
      results.checks.noNotAvailable = true;
    }

    // TEST 2: App Version field present with non-empty value
    const appVersionEl = await frame.$('#proof-app-version');
    if (appVersionEl) {
      const appVersionText = await appVersionEl.innerText();
      if (appVersionText && appVersionText !== "UNSET" && appVersionText.trim().length > 0) {
        results.checks.appVersionPresent = true;
      } else {
        results.passed = false;
        results.failures.push(`FAIL: App Version is empty or UNSET: "${appVersionText}"`);
      }
    } else {
      results.passed = false;
      results.failures.push("FAIL: App Version field not found in DOM");
    }

    // TEST 3: Build SHA matches expected pattern [a-f0-9]{7,40}
    const buildShaEl = await frame.$('#proof-ui-build-sha');
    if (buildShaEl) {
      const buildShaText = await buildShaEl.innerText();
      if (buildShaText && /^[a-f0-9]{7,40}$/.test(buildShaText.trim())) {
        results.checks.buildShaValid = true;
      } else {
        results.passed = false;
        results.failures.push(`FAIL: Build SHA invalid format: "${buildShaText}"`);
      }
    } else {
      results.passed = false;
      results.failures.push("FAIL: Build SHA field not found in DOM");
    }

    // TEST 4: Snapshot Metadata section has at least 3 non-empty fields
    const metadataSections = await frame.$$('.l0-dashboard-metadata-block');
    let nonEmptyFields = 0;
    for (const section of metadataSections) {
      const text = await section.innerText();
      const lines = text.split('\n').filter(line => line.trim().length > 0);
      nonEmptyFields += lines.length;
    }
    
    if (nonEmptyFields >= 3) {
      results.checks.snapshotMetadataPopulated = true;
    } else {
      results.passed = false;
      results.failures.push(`FAIL: Snapshot Metadata has only ${nonEmptyFields} non-empty fields, expected >= 3`);
    }

  } catch (error) {
    results.passed = false;
    results.failures.push(`FAIL: UI validation exception: ${error.message}`);
  }

  return results;
}

function writeUIValidation(results) {
  const outputPath = path.join(OUTPUT_DIR, "25_ui_validation.txt");
  let content = "=== PHASE 4 UI VALIDATION RESULTS ===\n\n";
  content += `Overall: ${results.passed ? "PASS" : "FAIL"}\n\n`;
  content += "Checks:\n";
  content += `  - No NOT_AVAILABLE: ${results.checks.noNotAvailable ? "✓" : "✗"}\n`;
  content += `  - App Version present: ${results.checks.appVersionPresent ? "✓" : "✗"}\n`;
  content += `  - Build SHA valid: ${results.checks.buildShaValid ? "✓" : "✗"}\n`;
  content += `  - Snapshot Metadata populated: ${results.checks.snapshotMetadataPopulated ? "✓" : "✗"}\n`;
  
  if (results.failures.length > 0) {
    content += "\nFailures:\n";
    results.failures.forEach(failure => {
      content += `  - ${failure}\n`;
    });
  }
  
  fs.writeFileSync(outputPath, content);
  console.log(`[UI_VALIDATION] ${results.passed ? "PASS" : "FAIL"} (details in 25_ui_validation.txt)`);
}

async function run() {
  try {
    // Create output directories
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
    fs.mkdirSync(path.join(OUTPUT_DIR, "screenshots"), { recursive: true });
    fs.mkdirSync(path.join(OUTPUT_DIR, "traces"), { recursive: true });

    // Validate inputs
    if (!JIRA_DASHBOARD_URL) {
      exitCode = 5;
      writeMetadata();
      console.error("[ERR] JIRA_DASHBOARD_URL not set");
      process.exit(exitCode);
    }

    if (!STORAGE_STATE || !fs.existsSync(STORAGE_STATE)) {
      exitCode = 5;
      writeMetadata();
      console.error("[ERR] STORAGE_STATE not found:", STORAGE_STATE);
      process.exit(exitCode);
    }

    // Check for rapid board URLs
    if (
      JIRA_DASHBOARD_URL.includes("RapidBoard.jspa") ||
      JIRA_DASHBOARD_URL.includes("rapidView=") ||
      JIRA_DASHBOARD_URL.includes("/secure/RapidBoard.jspa")
    ) {
      exitCode = 6;
      writeMetadata();
      console.error("[ERR] URL is a RapidBoard, not a dashboard");
      process.exit(exitCode);
    }

    // Extract Jira site
    const siteMatch = JIRA_DASHBOARD_URL.match(/https?:\/\/([^\/]+)/);
    jiraSite = siteMatch ? siteMatch[1] : "unknown";

    const browser = await chromium.launch({
      headless: HEADLESS,
    });

    const context = await browser.newContext({
      storageState: STORAGE_STATE,
      viewport: { width: 1280, height: 800 },
      recordHar: { path: path.join(OUTPUT_DIR, "network.har"), mode: "full" },
    });

    await context.tracing.start({
      screenshots: true,
      snapshots: true,
      sources: true,
    });

    const page = await context.newPage();

    // Set up listeners
    page.on("console", (msg) => {
      const location =
        msg.location().url + ":" + msg.location().lineNumber + ":" + msg.location().columnNumber;
      const line = `[${new Date().toISOString()}] ${msg.type()} ${msg.text()} (${location})`;
      consoleLines.push(line);
    });

    page.on("pageerror", (err) => {
      const line = `[${new Date().toISOString()}] PAGE_ERROR ${err.stack}`;
      consoleLines.push(line);
      pageErrors.push(err.message);
    });

    page.on("requestfailed", (req) => {
      failedRequests.push(`${req.method()} ${req.url()}`);
      networkLines.push(
        `[${new Date().toISOString()}] REQUEST_FAILED ${req.method()} ${req.url()}`
      );
    });

    page.on("response", (res) => {
      const url = res.url();
      if (
        url.includes("forge.cdn.prod.atlassian-dev.net") ||
        url.includes("atlassian-dev.net") ||
        url.includes("/gateway/api/")
      ) {
        const method = res.request().method();
        networkLines.push(
          `[${new Date().toISOString()}] ${res.status()} ${method} ${url}`
        );
      }
    });

    // Navigate
    console.log(`[NAV] Goto ${JIRA_DASHBOARD_URL}`);
    try {
      await page.goto(JIRA_DASHBOARD_URL, {
        waitUntil: "domcontentloaded",
        timeout: TIMEOUT_MS,
      });
    } catch (e) {
      console.error("[ERR] Navigation timeout:", e.message);
      exitCode = 3;
    }

    // Try network idle
    try {
      await page.waitForLoadState("networkidle", { timeout: 15000 });
    } catch {
      console.log("[WARN] networkidle timeout (continuing)");
    }

    // Check auth
    if (page.url().includes("login") || (await page.$("input[type=password]"))) {
      exitCode = 2;
      await captureScreenshots(page);
      await context.tracing.stop({ path: path.join(OUTPUT_DIR, "traces/trace.zip") });
      writeEvidence();
      writeMetadata();
      await context.close();
      await browser.close();
      process.exit(exitCode);
    }

    // Check if it's a dashboard URL
    if (!page.url().includes("/browse/") && !page.url().includes("/projects/")) {
      if (!page.url().includes("dashboard")) {
        exitCode = 6;
        await captureScreenshots(page);
        await context.tracing.stop({ path: path.join(OUTPUT_DIR, "traces/trace.zip") });
        writeEvidence();
        writeMetadata();
        await context.close();
        await browser.close();
        process.exit(exitCode);
      }
    }

    // Frame enumeration
    const frames = page.frames();
    console.log(`[FRAMES] Found ${frames.length} frames`);

    const frameScores = [];

    for (const frame of frames) {
      const frameUrl = frame.url();
      let score = 0;
      let markerHits = [];

      if (frameUrl.includes("atlassian-dev.net") || frameUrl.includes("forge")) {
        score += 10;
      }

      try {
        const content = await frame.content();
        if (content.includes("UI_ENTRY_RUNTIME_PROOF")) {
          score += 100;
          markerHits.push("UI_ENTRY_RUNTIME_PROOF");
        }
        if (content.includes("FT_PROOF_MARKER")) {
          score += 100;
          markerHits.push("FT_PROOF_MARKER");
        }
        if (content.includes("BUILDINFO_UI_PROOF")) {
          score += 100;
          markerHits.push("BUILDINFO_UI_PROOF");
        }
        if (content.includes("FATAL_")) {
          markerHits.push("FATAL_");
        }
      } catch {
        // Content access denied
      }

      frameScores.push({
        url: frameUrl,
        score,
        markerHits,
        frame,
      });
    }

    frameScores.sort((a, b) => b.score - a.score);

    if (frameScores.length === 0) {
      exitCode = 4;
      writeEvidence();
      writeMetadata();
      await context.tracing.stop({ path: path.join(OUTPUT_DIR, "traces/trace.zip") });
      await context.close();
      await browser.close();
      process.exit(exitCode);
    }

    // Ambiguity check
    if (
      frameScores.length > 1 &&
      frameScores[0].score === frameScores[1].score &&
      frameScores[0].score > 0
    ) {
      console.log("[AMBIGUOUS] Multiple frames with same score");
      networkLines.push("AMBIGUOUS_FRAMES:");
      for (let i = 0; i < Math.min(5, frameScores.length); i++) {
        networkLines.push(
          `  ${i}: ${frameScores[i].url} (score=${frameScores[i].score}, markers=${frameScores[i].markerHits.join(",")})`
        );
      }
      exitCode = 4;
      writeEvidence();
      writeMetadata();
      await context.tracing.stop({ path: path.join(OUTPUT_DIR, "traces/trace.zip") });
      await context.close();
      await browser.close();
      process.exit(exitCode);
    }

    // Choose best frame
    const selectedFrame = frameScores[0].frame;
    selectedFrameUrl = frameScores[0].url;
    console.log(`[FRAME] Selected: ${selectedFrameUrl}`);

    // Wait for markers in selected frame
    const startWait = Date.now();
    let foundMarkers = false;

    while (Date.now() - startWait < MAX_WAIT_MARKERS_MS) {
      try {
        const content = await selectedFrame.content();
        const proofMarkers = [
          "UI_ENTRY_RUNTIME_PROOF",
          "FT_PROOF_MARKER",
          "BUILDINFO_UI_PROOF",
        ];
        for (const marker of proofMarkers) {
          if (content.includes(marker)) {
            foundMarkers = true;
            break;
          }
        }
        if (foundMarkers) break;
      } catch {
        // Continue
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // Extract bundle identity from network
    for (const line of networkLines) {
      if (line.includes("app.") && line.includes(".js")) {
        bundleMatched = true;
        break;
      }
    }

    // Scan frame HTML for bundle
    try {
      const frameContent = await selectedFrame.content();
      if (frameContent.includes("app.") && frameContent.includes(".js")) {
        bundleMatched = true;
      }

      // Extract markers from content
      const lines = frameContent.split("\n");
      for (const line of lines) {
        if (
          line.includes("UI_ENTRY_RUNTIME_PROOF") ||
          line.includes("FT_PROOF_MARKER") ||
          line.includes("BUILDINFO_UI_PROOF") ||
          line.includes("FATAL_") ||
          line.includes("invoke(") ||
          line.includes("ft_getDashboardState_v1") ||
          line.includes("ping") ||
          line.includes("ensureFirstSnapshot") ||
          line.includes("ERROR_")
        ) {
          markerLines.push(line.trim());
          markerCount++;
        }
      }

      // Get DOM excerpt
      const rootElement = await selectedFrame.$("#root");
      if (rootElement) {
        const html = await rootElement.evaluate((el) => el.outerHTML);
        domLines.push(html.substring(0, 50000));
      } else {
        const html = await selectedFrame.evaluate(() => document.documentElement.outerHTML);
        domLines.push(html.substring(0, 50000));
      }
    } catch (e) {
      console.error("[WARN] Frame content extraction error:", e.message);
    }

    // Check for fatal markers
    for (const line of markerLines) {
      if (line.includes("FATAL_")) {
        fatalDetected = true;
        break;
      }
    }

    // Capture screenshots
    await captureScreenshots(page);
    try {
      await selectedFrame.screenshot({
        path: path.join(OUTPUT_DIR, "screenshots/frame.png"),
      });
    } catch {
      console.log("[WARN] Frame screenshot failed");
    }

    // PHASE 4 REGRESSION TESTS: Validate UI content for enterprise requirements
    const uiValidationResults = await validateUIContent(selectedFrame);
    writeUIValidation(uiValidationResults);
    
    // If UI validation failed, set appropriate exit code
    if (!uiValidationResults.passed) {
      console.error("[UI_VALIDATION_FAILED]", uiValidationResults.failures.join("; "));
      exitCode = 7; // New exit code for UI validation failures
    }

    // Stop tracing
    await context.tracing.stop({ path: path.join(OUTPUT_DIR, "traces/trace.zip") });

    // Determine exit code
    if (fatalDetected) {
      exitCode = 3;
    } else if (!bundleMatched && markerCount === 0) {
      exitCode = 4;
    } else if (markerCount > 0 && !fatalDetected && bundleMatched) {
      exitCode = 0;
    } else if (markerCount === 0) {
      exitCode = 4;
    }

    writeEvidence();
    writeMetadata();

    await context.close();
    await browser.close();

    process.exit(exitCode);
  } catch (err) {
    console.error("[EXCEPTION]", err);
    exitCode = 5;
    writeMetadata();
    process.exit(exitCode);
  }
}

async function captureScreenshots(page) {
  try {
    await page.screenshot({
      path: path.join(OUTPUT_DIR, "screenshots/page.png"),
    });
  } catch {
    console.log("[WARN] Page screenshot failed");
  }
}

function writeEvidence() {
  // 20_console_markers.txt
  fs.writeFileSync(
    path.join(OUTPUT_DIR, "20_console_markers.txt"),
    consoleLines.join("\n")
  );

  // 21_network_bundle_identity.txt
  let networkOutput = networkLines.join("\n");
  networkOutput += "\n\n[BUNDLE_MATCHED] " + (bundleMatched ? "yes" : "no");
  networkOutput += "\n[SELECTED_FRAME_URL] " + selectedFrameUrl;
  fs.writeFileSync(path.join(OUTPUT_DIR, "21_network_bundle_identity.txt"), networkOutput);

  // 22_dom_identity.txt
  let domOutput = "[SELECTED_FRAME_URL] " + selectedFrameUrl + "\n\n";
  domOutput += domLines.join("\n");
  fs.writeFileSync(path.join(OUTPUT_DIR, "22_dom_identity.txt"), domOutput);

  // 23_proof_markers.txt
  let markerOutput = markerLines.join("\n");
  markerOutput += "\n\n[CLASSIFICATION]";

  if (markerLines.some((l) => l.includes("BUILDINFO_UI_PROOF"))) {
    markerOutput += "\nLEGACY_MARKERS_PRESENT";
    if (
      !markerLines.some((l) => l.includes("UI_ENTRY_RUNTIME_PROOF")) &&
      !markerLines.some((l) => l.includes("FT_PROOF_MARKER"))
    ) {
      markerOutput += "\nEXPECTED_V2_MARKERS_MISSING";
    }
  }

  if (
    networkLines.some((l) => l.includes("invoke")) &&
    !networkLines.some((l) => l.includes("invoke") && !l.includes("REQUEST_FAILED"))
  ) {
    markerOutput += "\nINVOKE_STALL";
  }

  if (networkLines.some((l) => l.match(/\s[45]\d{2}\s/))) {
    markerOutput += "\nINVOKE_HTTP_ERROR";
  }

  fs.writeFileSync(path.join(OUTPUT_DIR, "23_proof_markers.txt"), markerOutput);
}

function writeMetadata() {
  finishedAt = new Date().toISOString();
  const metadata = {
    exitCode,
    markerCount,
    bundleMatched,
    fatalDetected,
    selectedFrameUrl,
    jiraDashboardUrl: JIRA_DASHBOARD_URL,
    jiraSite,
    startedAt,
    finishedAt,
  };
  fs.writeFileSync(
    path.join(OUTPUT_DIR, "run_metadata.json"),
    JSON.stringify(metadata, null, 2)
  );
}

run().catch((err) => {
  console.error("[FATAL]", err);
  exitCode = 5;
  writeMetadata();
  process.exit(exitCode);
});
