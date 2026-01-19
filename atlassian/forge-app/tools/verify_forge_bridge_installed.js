#!/usr/bin/env node
/**
 * Verify @forge/bridge is available before building UI
 * Fails deterministically if missing
 */
const fs = require("fs");
const path = require("path");

const packageJsonPath = path.join(__dirname, "../package.json");
const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));

const bridgeInDeps = pkg.dependencies?.["@forge/bridge"];
const bridgeInDevDeps = pkg.devDependencies?.["@forge/bridge"];

if (!bridgeInDeps && !bridgeInDevDeps) {
  console.error("[FATAL_BUILD_CHECK] @forge/bridge is NOT installed");
  console.error("[FATAL_BUILD_CHECK] Current dependencies:");
  console.error(JSON.stringify(pkg.dependencies, null, 2));
  console.error("[FATAL_BUILD_CHECK] REQUIRED: Add '@forge/bridge' to dependencies");
  console.error("[FATAL_BUILD_CHECK] BUILD FAILED - Cannot proceed without bridge");
  process.exit(1);
}

console.log("[BUILD_CHECK] ✓ @forge/bridge verified in dependencies");
console.log(`[BUILD_CHECK] Version: ${bridgeInDeps || bridgeInDevDeps}`);
process.exit(0);
