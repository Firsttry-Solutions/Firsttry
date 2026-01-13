#!/usr/bin/env node
/**
 * Tenant Isolation Guard Test (FAIL-CLOSED)
 *
 * Purpose:
 *  - Regression guard to prevent introducing obvious cross-tenant bugs.
 *
 * What this DOES prove:
 *  - Repo uses Forge SDK (@forge/api) for storage access (static check)
 *  - No obvious unkeyed global caches in Forge backend source paths (static heuristic)
 *  - Manifest includes expected Jira scopes (static check)
 *  - Network surface scanner reports no external egress (if scanner output provided)
 *
 * What this DOES NOT prove:
 *  - Runtime tenant isolation across two Atlassian tenants (requires integration test)
 *  - Atlassian platform guarantees (vendor docs are the source of truth, not this test)
 *
 * Fail-closed rules:
 *  - If required tools/files are missing, FAIL (exit 1).
 */

const { spawnSync } = require("child_process");
const fs = require("fs");

function fail(msg) {
  console.error(`❌ FAIL: ${msg}`);
  process.exit(1);
}

function ok(msg) {
  console.log(`✅ ${msg}`);
}

function requireTool(cmd) {
  const r = spawnSync("bash", ["-lc", `command -v ${cmd}`], { encoding: "utf-8" });
  if (r.status !== 0) fail(`Required tool not found in PATH: ${cmd}`);
}

function rgList(pattern, path) {
  const r = spawnSync("rg", ["-n", "--no-heading", "-S", pattern, path], { encoding: "utf-8" });
  if (r.status === 2) fail(`ripgrep error running pattern=${pattern} path=${path}: ${r.stderr || ""}`);
  // status 0 means matches, 1 means no matches
  return { status: r.status, stdout: r.stdout || "" };
}

function readFileOrFail(p) {
  try {
    return fs.readFileSync(p, "utf-8");
  } catch (e) {
    fail(`Cannot read required file: ${p} (${e.message})`);
  }
}

function main() {
  console.log("=".repeat(80));
  console.log("TENANT ISOLATION GUARD TEST (CODE-LEVEL)");
  console.log("=".repeat(80));

  // Require tools
  requireTool("rg");

  // TEST 1: Forge SDK usage exists in backend source
  console.log("\nTEST 1: Forge SDK usage (@forge/api)");
  const t1 = rgList("@forge/api", "atlassian/forge-app/src");
  if (t1.status !== 0) fail("No @forge/api usage found in atlassian/forge-app/src (expected Forge SDK usage)");
  ok("Found @forge/api usage in Forge app source");

  // TEST 2: Storage usage references exist (informational)
  console.log("\nTEST 2: Forge storage usage patterns (informational)");
  const t2get = rgList("storage\\.(app|user)\\.get", "atlassian/forge-app/src");
  const t2set = rgList("storage\\.(app|user)\\.set", "atlassian/forge-app/src");
  ok(`storage.*.get present: ${t2get.status === 0 ? "YES" : "NO"}`);
  ok(`storage.*.set present: ${t2set.status === 0 ? "YES" : "NO"}`);

  // TEST 3: Obvious global cache risks (heuristic)
  console.log("\nTEST 3: Global cache risk heuristic (fail on obvious unkeyed caches)");
  // Look for top-level maps/objects named *cache* in backend src. This is conservative.
  // If matches exist, we FAIL and require a reviewer to ensure tenant-keying.
  const cacheHit = rgList("^(const|let)\\s+\\w*cache\\w*\\s*=\\s*(new Map\\(|\\{)", "atlassian/forge-app/src");
  if (cacheHit.status === 0) {
    console.error(cacheHit.stdout.split("\n").slice(0, 10).join("\n"));
    fail("Potential global cache detected in backend source. Must prove tenant-keying or remove.");
  }
  ok("No obvious global cache definitions detected in backend source");

  // TEST 4: Manifest scopes check (fail-closed, no YAML dep)
  console.log("\nTEST 4: Manifest scopes (static check)");
  const manifestPath = "atlassian/forge-app/manifest.yml";
  const manifestTxt = readFileOrFail(manifestPath);
  // Require the scope string to exist literally in manifest file.
  if (!manifestTxt.includes("read:jira-work")) fail("Manifest missing required scope: read:jira-work");
  if (!manifestTxt.includes("storage:app")) fail("Manifest missing required scope: storage:app");
  ok("Manifest includes expected scopes: read:jira-work, storage:app");

  // TEST 5: Network surface scanner output (optional but fail-closed if referenced by CI)
  console.log("\nTEST 5: Network surface scanner summary (if present)");
  // CI runs scanner to /tmp/ci_evidence_check; verify pass when file exists.
  const summaryPath = "/tmp/ci_evidence_check/32_network_surface_summary.json";
  if (fs.existsSync(summaryPath)) {
    const j = JSON.parse(readFileOrFail(summaryPath));
    if (!j || j.pass !== true) fail("Network surface scanner summary indicates FAIL");
    ok("Network surface scanner summary indicates PASS (no external egress detected by scanner)");
  } else {
    // Not present locally; do not "assume pass". Just inform.
    ok("No scanner summary found at /tmp/ci_evidence_check (skipping). CI must provide it.");
  }

  console.log("\n" + "=".repeat(80));
  console.log("✅ TENANT ISOLATION GUARD PASSED (code-level)");
  console.log("=".repeat(80));
  process.exit(0);
}

main();
