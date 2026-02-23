#!/usr/bin/env node
/**
 * Operator Login Helper — Saves Playwright storageState for E2E smoke gate.
 *
 * Usage:
 *   node tools/e2e_save_storage_state.mjs
 *
 * Environment variables (optional):
 *   FT_E2E_LOGIN_URL      — Jira base URL to open (default: https://firsttry.atlassian.net)
 *   FT_E2E_STORAGE_STATE  — Path to write storageState JSON (default: /tmp/ft_storage_state.json)
 *
 * Operator steps:
 *   1. A browser window will open automatically.
 *   2. Log in interactively with your Atlassian credentials.
 *   3. Navigate to a Jira issue page where the FirstTry panel is visible.
 *   4. Return to this terminal and press ENTER.
 *   5. The authenticated session is saved to FT_E2E_STORAGE_STATE.
 *
 * Security:
 *   - storageState file contains session cookies — never commit it to the repo.
 *   - Cookies are NOT printed to stdout.
 *   - File permissions are set to 600 (owner read/write only).
 *
 * Marker: FT_E2E_SAVE_STORAGE_STATE_V1
 */

import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const LOGIN_URL = process.env.FT_E2E_LOGIN_URL || "https://firsttry.atlassian.net";
const OUT_PATH = process.env.FT_E2E_STORAGE_STATE || "/tmp/ft_storage_state.json";

async function main() {
  console.log("[FT_E2E_SAVE_STORAGE_STATE_V1] Starting operator login session...");
  console.log(`[CONFIG] Login URL : ${LOGIN_URL}`);
  console.log(`[CONFIG] Output    : ${OUT_PATH}`);
  console.log("");

  // Ensure output directory exists
  const outDir = path.dirname(OUT_PATH);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  let browser;
  try {
    browser = await chromium.launch({ headless: false });
  } catch (err) {
    console.error(`[FAIL] Browser launch failed: ${err.message}`);
    process.exit(1);
  }

  const context = await browser.newContext();
  const page = await context.newPage();

  console.log(`[INFO] Opening: ${LOGIN_URL}`);
  await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded" });

  console.log("");
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║              ACTION REQUIRED — DO NOT CLOSE BROWSER         ║");
  console.log("╠══════════════════════════════════════════════════════════════╣");
  console.log("║  1. Log in interactively in the browser window that opened. ║");
  console.log("║  2. Navigate to a Jira ISSUE page where the FirstTry panel  ║");
  console.log("║     is visible (e.g. https://firsttry.atlassian.net/browse/ ║");
  console.log("║     DEMO-1 or any real issue with the FirstTry gadget).      ║");
  console.log("║  3. Confirm you can see the FirstTry panel loading.          ║");
  console.log("║  4. Return to this terminal and press ENTER.                 ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
  console.log("");

  // Wait for operator to confirm
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(false);
  }
  process.stdin.setEncoding("utf8");
  process.stdin.resume();

  await new Promise((resolve) => {
    process.stdin.once("data", resolve);
  });

  process.stdin.pause();

  console.log("[INFO] Saving storageState (cookies NOT printed to stdout)...");

  let state;
  try {
    state = await context.storageState();
  } catch (err) {
    console.error(`[FAIL] Failed to capture storageState: ${err.message}`);
    await browser.close();
    process.exit(1);
  }

  // Write to disk (do NOT log cookies)
  fs.writeFileSync(OUT_PATH, JSON.stringify(state, null, 2), "utf-8");

  // Restrict file permissions to owner read/write only (600)
  try {
    fs.chmodSync(OUT_PATH, 0o600);
  } catch (err) {
    console.warn(`[WARN] Could not set file permissions: ${err.message}`);
  }

  await browser.close();

  // ── Validation (fail-closed) ──────────────────────────────────────────────
  console.log("[INFO] Validating saved storageState...");

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(OUT_PATH, "utf-8"));
  } catch (err) {
    console.error(`[FAIL] storageState is not valid JSON: ${err.message}`);
    process.exit(1);
  }

  if (!Array.isArray(parsed.cookies)) {
    console.error("[FAIL] storageState missing 'cookies' array.");
    process.exit(1);
  }

  if (parsed.cookies.length === 0) {
    console.error("[FAIL] storageState has no cookies — session was not authenticated.");
    process.exit(1);
  }

  const atlassianCookie = parsed.cookies.find(
    (c) => typeof c.domain === "string" && c.domain.includes("atlassian.net")
  );
  if (!atlassianCookie) {
    console.error(
      "[FAIL] No cookie found for domain containing 'atlassian.net' — " +
      "ensure you are logged in to the correct Atlassian site."
    );
    process.exit(1);
  }

  console.log("");
  console.log(`[OK] storageState saved: ${OUT_PATH}`);
  console.log(`[OK] Cookies count   : ${parsed.cookies.length} (not printed)`);
  console.log(`[OK] Atlassian domain: found`);
  console.log("[OK] Validation PASS");
  console.log("");
  console.log("Next step:");
  console.log(
    `  FT_E2E_ISSUE_URL=https://firsttry.atlassian.net/browse/<ISSUE> \\`
  );
  console.log(`  FT_E2E_STORAGE_STATE=${OUT_PATH} \\`);
  console.log("  tools/release_proof_run.sh");
  process.exit(0);
}

main().catch((err) => {
  console.error(`[FATAL] ${err.message}`);
  process.exit(1);
});
