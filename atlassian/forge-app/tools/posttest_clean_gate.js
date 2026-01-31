#!/usr/bin/env node
/**
 * Posttest Clean Gate
 *
 * DETERMINISTIC BEHAVIOR:
 * - If FT_REQUIRE_CLEAN=1, enforces strict repo cleanliness (for CI/release)
 * - Otherwise, skips clean gate and exits 0 (for local development)
 *
 * USAGE:
 *   Local dev (dirty tree OK):  npm test
 *   CI/release (strict clean):  FT_REQUIRE_CLEAN=1 npm test
 */

const { execSync } = require("child_process");
const path = require("path");

const REQUIRE_CLEAN = process.env.FT_REQUIRE_CLEAN === "1";

console.log(
  "[POSTTEST] FT_REQUIRE_CLEAN=" +
    (REQUIRE_CLEAN ? "1 (STRICT)" : "0 (SKIP)")
);

if (!REQUIRE_CLEAN) {
  console.log(
    "[POSTTEST] Skipping clean gate (FT_REQUIRE_CLEAN!=1). Local development mode."
  );
  process.exit(0);
}

// STRICT MODE: verify repo is clean
console.log("[POSTTEST] Verifying repo cleanliness (unstaged + staged + untracked)...");

try {
  const porcelain = execSync("git status --porcelain=v1", {
    cwd: path.resolve(__dirname, ".."),
    encoding: "utf8",
  }).trim();

  if (porcelain.length > 0) {
    console.error("[POSTTEST] ❌ FAIL: Working tree is not clean after tests.");
    console.error("[POSTTEST] git status --porcelain=v1:");
    console.error(porcelain);
    console.error(
      "[POSTTEST] Hint: staging changes must NOT be used to bypass this gate."
    );
    process.exit(1);
  }

  // Redundant hard checks (defense-in-depth)
  execSync("git diff --exit-code -- .", {
    cwd: path.resolve(__dirname, ".."),
    stdio: "pipe",
  });

  execSync("git diff --cached --exit-code -- .", {
    cwd: path.resolve(__dirname, ".."),
    stdio: "pipe",
  });

  console.log("[POSTTEST] ✅ PASS: Repo clean after tests (no unstaged, no staged, no untracked).");
  process.exit(0);
} catch (err) {
  console.error("[POSTTEST] ❌ FAIL: Clean check failed.");
  if (err.message) console.error(err.message);
  process.exit(1);
}
