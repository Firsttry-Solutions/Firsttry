#!/usr/bin/env node
/**
 * Codespaces-compatible storageState generator (headless / manual cookie paste).
 *
 * Use this when heading a real browser is not possible (e.g. GitHub Codespaces).
 *
 * Instructions:
 *   1. In your local browser, open https://firsttry.atlassian.net and log in.
 *   2. Navigate to a Jira issue page where the FirstTry panel is visible.
 *   3. Open DevTools → Console tab.
 *   4. Run this command and copy the full JSON output:
 *
 *        copy(JSON.stringify(document.cookie.split(';').map(c => {
 *          const [name, ...rest] = c.trim().split('=');
 *          return { name: name.trim(), value: rest.join('=') };
 *        })));
 *
 *   5. Paste the JSON here when prompted and press ENTER (then Ctrl+D on a new line).
 *
 * Output: Playwright-compatible storageState JSON
 *   Default: /tmp/ft_storage_state.json (override with FT_E2E_STORAGE_STATE)
 *
 * Marker: FT_E2E_SAVE_STORAGE_STATE_MANUAL_V1
 */

import fs from "fs";
import path from "path";
import readline from "readline";

const OUT_PATH = process.env.FT_E2E_STORAGE_STATE || "/tmp/ft_storage_state.json";
const JIRA_DOMAIN = "firsttry.atlassian.net";

console.log("╔══════════════════════════════════════════════════════════════════════╗");
console.log("║     FT_E2E_SAVE_STORAGE_STATE_MANUAL_V1 — Codespaces Cookie Paste    ║");
console.log("╠══════════════════════════════════════════════════════════════════════╣");
console.log("║  1. In your LOCAL browser, open:                                     ║");
console.log(`║     https://${JIRA_DOMAIN}                                  ║`);
console.log("║  2. Log in and navigate to a Jira issue with the FirstTry panel.     ║");
console.log("║  3. Open DevTools → Console → paste and run exactly:                 ║");
console.log("║                                                                       ║");
console.log("║  copy(JSON.stringify(document.cookie.split(';').map(c => {           ║");
console.log("║    const [n,...r]=c.trim().split('=');                                ║");
console.log("║    return {name:n.trim(),value:r.join('=')};                          ║");
console.log("║  })))                                                                 ║");
console.log("║                                                                       ║");
console.log("║  4. Paste the copied JSON below and press ENTER, then Ctrl+D.        ║");
console.log("╚══════════════════════════════════════════════════════════════════════╝");
console.log("");
console.log("Paste cookie JSON (then Ctrl+D to finish):");

const rl = readline.createInterface({ input: process.stdin });
const lines = [];

rl.on("line", (line) => lines.push(line));

rl.on("close", () => {
  const raw = lines.join("").trim();

  if (!raw) {
    console.error("[FAIL] No input received.");
    process.exit(1);
  }

  let cookies;
  try {
    cookies = JSON.parse(raw);
  } catch (e) {
    console.error(`[FAIL] Invalid JSON: ${e.message}`);
    process.exit(1);
  }

  if (!Array.isArray(cookies)) {
    console.error("[FAIL] Expected a JSON array of cookie objects.");
    process.exit(1);
  }

  if (cookies.length === 0) {
    console.error("[FAIL] Cookie array is empty — are you logged in?");
    process.exit(1);
  }

  // Enrich cookies with domain, path, sameSite defaults (Playwright storageState format)
  const enriched = cookies
    .filter((c) => c.name && c.name.trim() !== "")
    .map((c) => ({
      name: String(c.name),
      value: String(c.value ?? ""),
      domain: `.${JIRA_DOMAIN}`,
      path: "/",
      expires: -1,
      httpOnly: false,
      secure: true,
      sameSite: "None",
    }));

  if (enriched.length === 0) {
    console.error("[FAIL] No valid cookies after filtering empty names.");
    process.exit(1);
  }

  // Build Playwright storageState
  const state = {
    cookies: enriched,
    origins: [
      {
        origin: `https://${JIRA_DOMAIN}`,
        localStorage: [],
      },
    ],
  };

  // Ensure output dir exists
  const outDir = path.dirname(OUT_PATH);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  fs.writeFileSync(OUT_PATH, JSON.stringify(state, null, 2), "utf-8");

  try {
    fs.chmodSync(OUT_PATH, 0o600);
  } catch (_) {}

  // Validate saved file has atlassian.net domain cookie
  const saved = JSON.parse(fs.readFileSync(OUT_PATH, "utf-8"));
  const hasAtlassian = saved.cookies.some(
    (c) => typeof c.domain === "string" && c.domain.includes("atlassian.net")
  );

  if (!hasAtlassian) {
    console.error(
      "[FAIL] No cookie found with atlassian.net domain — " +
        "ensure you copied cookies from firsttry.atlassian.net."
    );
    process.exit(1);
  }

  console.log("");
  console.log(`[OK] storageState saved : ${OUT_PATH}`);
  console.log(`[OK] Cookie count       : ${saved.cookies.length} (values not printed)`);
  console.log("[OK] atlassian.net domain cookie: found");
  console.log("[OK] Validation PASS");
  console.log("");
  console.log("Next:");
  console.log(
    `  FT_E2E_ISSUE_URL=https://firsttry.atlassian.net/browse/<ISSUE-KEY> \\`
  );
  console.log(`  FT_E2E_STORAGE_STATE=${OUT_PATH} \\`);
  console.log("  tools/release_proof_run.sh");
  process.exit(0);
});
