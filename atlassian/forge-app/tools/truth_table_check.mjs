#!/usr/bin/env node
/**
 * Phase 6 Truth Table Consistency Checker
 * 
 * HARD RULES (all must pass):
 *   R1: ui_request_id must not be "UNSET"
 *   R2: tenant_identity must not be "UNKNOWN"
 *   R3: ui_build_sha and backend_build_sha must not be "", "UNSET", or "ERROR_*"
 *   R4: If snapshot_count > 0 then storage_state must not be "EMPTY"
 *   R5: If snapshot_count > 0 then export_readiness_detail must not say "0 snapshots"
 *   R6: If snapshot_count > 0 then overall_health_state must not be "INITIALIZING"
 * 
 * Usage: node tools/truth_table_check.mjs <truth_json_file>
 * Exit: 0 if all pass, 1 if any fail
 */

import fs from "fs";
import process from "process";

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: node tools/truth_table_check.mjs <truth_json_file>");
  process.exit(1);
}

if (!fs.existsSync(filePath)) {
  console.error(`ERROR: File not found: ${filePath}`);
  process.exit(1);
}

const truthJson = JSON.parse(fs.readFileSync(filePath, "utf8"));

const norm = (s) => (s || "").trim().toUpperCase();

// Extract fields (case-insensitive)
const snap = parseInt(truthJson.snapshot_count) || 0;
const ui_req = truthJson.ui_request_id || "";
const ui_sha = truthJson.ui_build_sha || "";
const be_sha = truthJson.backend_build_sha || "";
const storage = norm(truthJson.storage_state);
const tenant = norm(truthJson.tenant_identity);
const overall = norm(truthJson.overall_health_state);
const export_detail = (truthJson.export_readiness_detail || "").toLowerCase();

console.log("[truth_table_check] Validating rules...");
console.log(`[truth_table_check] snapshot_count=${snap}`);
console.log(`[truth_table_check] ui_request_id=${ui_req}`);
console.log(`[truth_table_check] ui_build_sha=${ui_sha}`);
console.log(`[truth_table_check] backend_build_sha=${be_sha}`);
console.log(`[truth_table_check] storage_state=${storage}`);
console.log(`[truth_table_check] tenant_identity=${tenant}`);
console.log(`[truth_table_check] overall_health_state=${overall}`);

let failed = false;

// R1: ui_request_id must not be "UNSET"
if (ui_req === "UNSET" || ui_req === "") {
  console.error("❌ R1 FAIL: ui_request_id is UNSET or empty");
  failed = true;
} else {
  console.log("✅ R1 PASS: ui_request_id is set");
}

// R2: tenant_identity must not be "UNKNOWN"
if (tenant === "UNKNOWN" || tenant === "") {
  console.error("❌ R2 FAIL: tenant_identity is UNKNOWN or empty");
  failed = true;
} else {
  console.log("✅ R2 PASS: tenant_identity is known");
}

// R3: build SHAs must not be "", "UNSET", or "ERROR_*"
for (const [key, val] of [
  ["ui_build_sha", ui_sha],
  ["backend_build_sha", be_sha],
]) {
  if (
    val === "" ||
    norm(val) === "UNSET" ||
    norm(val).startsWith("ERROR_")
  ) {
    console.error(`❌ R3 FAIL: ${key}=${val} (invalid)`);
    failed = true;
  } else {
    console.log(`✅ R3 PASS: ${key}=${val} (valid)`);
  }
}

// R4: If snapshot_count > 0 then storage_state must not be "EMPTY"
if (snap > 0 && storage === "EMPTY") {
  console.error(
    `❌ R4 FAIL: snapshot_count=${snap} but storage_state=EMPTY`
  );
  failed = true;
} else if (snap > 0) {
  console.log(`✅ R4 PASS: snapshot_count=${snap} and storage not EMPTY`);
} else {
  console.log(`ℹ️  R4 N/A: snapshot_count=${snap} (skipped)`);
}

// R5: If snapshot_count > 0 then export_readiness_detail must not say "0 snapshots"
if (snap > 0 && export_detail.includes("0 snapshots")) {
  console.error(
    `❌ R5 FAIL: snapshot_count=${snap} but export says "0 snapshots"`
  );
  failed = true;
} else if (snap > 0) {
  console.log(
    `✅ R5 PASS: snapshot_count=${snap} and export doesn't say "0 snapshots"`
  );
} else {
  console.log(`ℹ️  R5 N/A: snapshot_count=${snap} (skipped)`);
}

// R6: If snapshot_count > 0 then overall_health_state must not be "INITIALIZING"
if (snap > 0 && overall === "INITIALIZING") {
  console.error(
    `❌ R6 FAIL: snapshot_count=${snap} but overall_health_state=INITIALIZING`
  );
  failed = true;
} else if (snap > 0) {
  console.log(
    `✅ R6 PASS: snapshot_count=${snap} and overall_health_state is not INITIALIZING`
  );
} else {
  console.log(`ℹ️  R6 N/A: snapshot_count=${snap} (skipped)`);
}

console.log("");
if (failed) {
  console.error("❌ TRUTH_TABLE_CONSISTENCY: FAILED");
  process.exit(1);
} else {
  console.log("✅ TRUTH_TABLE_CONSISTENCY: PASSED");
  process.exit(0);
}
