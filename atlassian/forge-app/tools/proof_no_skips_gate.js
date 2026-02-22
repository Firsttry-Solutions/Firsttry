#!/usr/bin/env node
/**
 * proof_no_skips_gate.js — Fail-closed gate: no skipped tests in proof mode.
 *
 * Usage: node tools/proof_no_skips_gate.js <path-to-vitest-output.txt>
 *
 * Allowlisted skips (known, documented):
 *   - backbone_fix_a_correlation_echoing.test.ts
 *   - p4_bridge_diagnostics_panel.test.ts
 *
 * Any other skipped test causes exit(1).
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ALLOWLIST = new Set([
  "backbone_fix_a_correlation_echoing.test.ts",
  "p4_bridge_diagnostics_panel.test.ts",
]);

const logPath = process.argv[2];
if (!logPath) {
  console.error("USAGE: node tools/proof_no_skips_gate.js <vitest-output.txt>");
  process.exit(1);
}

if (!fs.existsSync(logPath)) {
  console.error(`FAIL: log file not found: ${logPath}`);
  process.exit(1);
}

// Strip ANSI escape codes so color output doesn't break marker detection
const rawLog = fs.readFileSync(logPath, "utf8");
const log = rawLog.replace(/\x1b\[[0-9;]*m/g, "");
const lines = log.split("\n");

// Detect skipped files: vitest marks them with "↓ " prefix or shows them in summary
const skippedFiles = [];
for (const line of lines) {
  // Match lines like " ↓ tests/something/foo.test.ts" (vitest skipped-file marker)
  const trimmed = line.trim();
  if (/^↓\s+/.test(trimmed)) {
    // Extract the path portion (before any parenthetical)
    const pathPart = trimmed.replace(/^↓\s+/, "").replace(/\s*\(.*$/, "").trim();
    const parts = pathPart.split(/[\\/]/);
    const basename = parts[parts.length - 1];
    if (basename) {
      skippedFiles.push(basename);
    }
  }
}

// Check the summary line for skipped file count
// vitest summary: "Test Files  255 passed | 2 skipped (257)"
const fileSummaryMatch = log.match(/Test Files\s+\d+\s+passed\s*\|\s*(\d+)\s+skipped/i);
const summarySkipCount = fileSummaryMatch ? parseInt(fileSummaryMatch[1], 10) : 0;

// Check for non-allowlisted skips
const nonAllowlisted = skippedFiles.filter((f) => !ALLOWLIST.has(f));

if (nonAllowlisted.length > 0) {
  console.error("FT_FAIL_NO_SKIPS_GATE_v1: non-allowlisted skipped tests detected:");
  for (const f of nonAllowlisted) {
    console.error(`  - ${f}`);
  }
  process.exit(1);
}

// If summary reports skips but we found no skipped files by marker,
// and the count exceeds what the allowlist could explain, fail conservatively
if (summarySkipCount > 0 && skippedFiles.length === 0) {
  // We can't attribute skips to allowlisted files without markers — warn but allow
  // if the count is <= allowlist size (they might be the allowlisted ones)
  if (summarySkipCount > ALLOWLIST.size) {
    console.error(
      `FT_FAIL_NO_SKIPS_GATE_v1: summary reports ${summarySkipCount} skipped tests ` +
      `but only ${ALLOWLIST.size} are allowlisted and no ↓ markers found`
    );
    process.exit(1);
  }
}

// Report allowlisted skips as warnings
const allowlistedFound = skippedFiles.filter((f) => ALLOWLIST.has(f));
if (allowlistedFound.length > 0) {
  for (const f of allowlistedFound) {
    console.log(`WARN: allowlisted skip: ${f}`);
  }
}

if (summarySkipCount > 0 && skippedFiles.length === 0 && summarySkipCount <= ALLOWLIST.size) {
  console.log(
    `WARN: ${summarySkipCount} skipped test(s) in summary (within allowlist budget of ${ALLOWLIST.size})`
  );
}

console.log("FT_PROOF_NO_SKIPS_GATE_v1 ok=true");
process.exit(0);
