#!/usr/bin/env node
/**
 * Phase 6 Real Runtime Probe (Playwright)
 * 
 * Purpose: Navigate to real Jira dashboard, extract truth table, capture artifacts
 * 
 * Required env vars:
 *   - RUN_DIR: Where to write artifacts
 *   - JIRA_DASHBOARD_URL: Target dashboard URL
 *   - STORAGE_STATE: Path to Playwright storageState.json
 * 
 * Artifacts produced:
 *   - 50_runtime_console.log: All console messages
 *   - 51_runtime_truth.json: Extracted truth table
 *   - 52_runtime_page.html: Full page HTML
 *   - 53_runtime_screenshot.png: Full page screenshot
 *   - 54_runtime_trace.zip: Playwright trace
 */

import fs from "fs";
import path from "path";
import { chromium } from "playwright";

const RUN_DIR = process.env.RUN_DIR;
const URL = process.env.JIRA_DASHBOARD_URL;
const STORAGE_STATE = process.env.STORAGE_STATE;

// Validate env
if (!RUN_DIR) {
  console.error("ERROR: RUN_DIR environment variable is required");
  process.exit(1);
}
if (!URL) {
  console.error("ERROR: JIRA_DASHBOARD_URL environment variable is required");
  process.exit(1);
}
if (!STORAGE_STATE) {
  console.error("ERROR: STORAGE_STATE environment variable is required");
  process.exit(1);
}
if (!fs.existsSync(STORAGE_STATE)) {
  console.error(`ERROR: storageState file not found: ${STORAGE_STATE}`);
  process.exit(1);
}

console.log(`[probe] RUN_DIR=${RUN_DIR}`);
console.log(`[probe] URL=${URL}`);
console.log(`[probe] STORAGE_STATE=${STORAGE_STATE}`);

const out = (name, data) => {
  const filePath = path.join(RUN_DIR, name);
  if (typeof data === "object") {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } else {
    fs.writeFileSync(filePath, data);
  }
  console.log(`[probe] Wrote: ${name}`);
};

function nowIso() {
  return new Date().toISOString();
}

// Extract truth table from page text (robust text parsing)
async function extractTruth(page) {
  return await page.evaluate(() => {
    const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
    const bodyText = norm(document.body?.innerText || "");

    // Helper: find label value by scanning for label + value pattern
    const pick = (label, pattern) => {
      const regex = new RegExp(`${label}[\\s\\S]{0,200}?${pattern}`, "i");
      const match = bodyText.match(regex);
      if (match) {
        const subMatch = match[0].match(new RegExp(pattern, "i"));
        return subMatch ? norm(subMatch[0]) : null;
      }
      return null;
    };

    return {
      generated_at_iso: new Date().toISOString(),

      // Overall health state
      overall_health_state: pick(
        "OVERALL HEALTH",
        "(INITIALIZING|RUNNING|ERROR|DEGRADED|UNKNOWN)"
      ),

      // Data freshness state
      data_freshness_state: pick(
        "DATA FRESHNESS",
        "(FRESH|AGING|STALE|UNKNOWN|NOT_AVAILABLE)"
      ),

      // Last snapshot
      last_snapshot_state: pick(
        "LAST SNAPSHOT",
        "(Never|Not available yet|[A-Za-z]{3}\\s+\\d{1,2},\\s+\\d{4})"
      ),

      // Export readiness (look for "N snapshots" pattern)
      export_readiness_detail: pick(
        "EXPORT READINESS",
        "(\\d+\\s+snapshots)"
      ),

      // Proof panel fields
      ui_request_id: pick("UI REQUEST ID", "([A-Za-z0-9_\\-]+|UNSET)"),
      ui_build_sha: pick("UI BUILD SHA", "([a-f0-9]+|UNSET|ERROR_[A-Z_]+)"),
      backend_build_sha: pick(
        "BACKEND BUILD SHA",
        "([a-f0-9]+|UNSET|ERROR_[A-Z_]+)"
      ),
      snapshot_count: pick("SNAPSHOT COUNT", "(\\d+)"),
      storage_state: pick("STORAGE STATE", "([A-Z_]+)"),

      // Availability signals
      tenant_identity: pick("Tenant Identity", "([A-Z_]+)"),

      // Raw excerpt for debugging
      _raw_text_excerpt: bodyText.slice(0, 8000),
    };
  });
}

(async () => {
  try {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ storageState: STORAGE_STATE });

    // Enable tracing
    await context.tracing.start({ screenshots: true, snapshots: true });

    const consoleLines = [];
    const page = await context.newPage();

    // Capture all console messages
    page.on("console", (msg) => {
      const line = `[${msg.type().toUpperCase()}] ${msg.text()}`;
      consoleLines.push(line);
      console.log(line);
    });

    // Capture page errors
    page.on("pageerror", (err) => {
      const line = `[PAGEERROR] ${String(err)}`;
      consoleLines.push(line);
      console.log(line);
    });

    // Navigate to dashboard
    console.log(`[probe] Navigating to ${URL}`);
    await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 120000 });

    // Wait for gadget to load (look for known markers)
    console.log("[probe] Waiting for dashboard gadget to appear...");
    try {
      await page.waitForSelector(
        'text=Governance Dashboard,text=FirstTry,text=/OVERALL HEALTH|DATA FRESHNESS/',
        { timeout: 60000 }
      );
    } catch (e) {
      console.warn(
        "[probe] Timeout waiting for specific text, but continuing..."
      );
    }

    // Extra settle time for async data loads
    console.log("[probe] Settling for 8 seconds to allow async loads...");
    await page.waitForTimeout(8000);

    // Extract truth table
    console.log("[probe] Extracting truth table from page...");
    const truth = await extractTruth(page);

    // Validate required fields are not null
    const requiredFields = [
      "overall_health_state",
      "data_freshness_state",
      "ui_request_id",
      "ui_build_sha",
      "backend_build_sha",
      "snapshot_count",
      "storage_state",
      "tenant_identity",
    ];

    const missing = requiredFields.filter(
      (k) =>
        truth[k] === null ||
        truth[k] === undefined ||
        truth[k] === ""
    );

    if (missing.length > 0) {
      console.error(`ERROR: Missing required truth fields: ${missing.join(", ")}`);
      process.exit(1);
    }

    // Write artifacts
    out("50_runtime_console.log", consoleLines.join("\n") + "\n");
    out("51_runtime_truth.json", truth);
    out("52_runtime_page.html", await page.content());

    // Screenshot
    const screenshotPath = path.join(RUN_DIR, "53_runtime_screenshot.png");
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log("[probe] Wrote: 53_runtime_screenshot.png");

    // Trace
    await context.tracing.stop({ path: path.join(RUN_DIR, "54_runtime_trace.zip") });
    console.log("[probe] Wrote: 54_runtime_trace.zip");

    await browser.close();
    console.log("[probe] ✅ All artifacts written successfully");
    process.exit(0);
  } catch (err) {
    console.error("[probe] ❌ FATAL ERROR:", err.message);
    process.exit(1);
  }
})();
