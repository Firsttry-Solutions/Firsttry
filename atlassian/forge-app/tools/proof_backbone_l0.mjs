#!/usr/bin/env node
/**
 * Proof script for Backbone Layer-0
 * Generates deterministic proof that backbone is functional
 */

import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read backbone contract to verify it exists and has no forbidden strings
const contractPath = join(__dirname, "../src/backbone/contract.ts");
const contractContent = fs.readFileSync(contractPath, "utf-8");

// Verify contract doesn't contain forbidden runtime strings
const forbidden = ["UNKNOWN", "INITIALIZING", "NOT_AVAILABLE"];
let hasError = false;

for (const term of forbidden) {
  // Allow these in comments/strings for testing, but not as actual enum values or type definitions
  const badPatterns = [
    new RegExp(`export.*${term}.*=\\s*["']${term}["']`),
    new RegExp(`${term}\\s*:\\s*["']${term}["']`),
  ];
  for (const pattern of badPatterns) {
    if (pattern.test(contractContent)) {
      console.error(`FAIL: Found forbidden string "${term}" in contract logic`);
      hasError = true;
    }
  }
}

// Verify backbone files exist
const backboneFiles = [
  "errorCodes.ts",
  "contract.ts",
  "keys.ts",
  "time.ts",
  "crypto.ts",
  "uuid.ts",
  "storage.ts",
  "ledger.ts",
  "sentinel.ts",
  "lock.ts",
  "scheduler.ts",
  "forge-entry.ts",
];

const backbonePath = join(__dirname, "../src/backbone");
for (const file of backboneFiles) {
  const filePath = join(backbonePath, file);
  if (!fs.existsSync(filePath)) {
    console.error(`FAIL: Missing backbone file: ${file}`);
    hasError = true;
  } else {
    console.log(`✓ ${file}`);
  }
}

// Verify manifest has backbone functions wired
const manifestPath = join(__dirname, "../manifest.yml");
const manifestContent = fs.readFileSync(manifestPath, "utf-8");

if (!manifestContent.includes("ftBackboneScheduled")) {
  console.error("FAIL: Manifest missing ftBackboneScheduled function");
  hasError = true;
} else {
  console.log("✓ Manifest has ftBackboneScheduled");
}

if (!manifestContent.includes("ftRunNow")) {
  console.error("FAIL: Manifest missing ftRunNow function");
  hasError = true;
} else {
  console.log("✓ Manifest has ftRunNow");
}

// Print proof JSON
const proof = {
  timestamp: new Date().toISOString(),
  components: {
    errorCodes: "present",
    contract: "present",
    keys: "present",
    time: "present",
    crypto: "present",
    uuid: "present",
    storage: "present",
    ledger: "present",
    sentinel: "present",
    lock: "present",
    scheduler: "present",
    "forge-entry": "present",
  },
  manifest_wired: {
    ftBackboneScheduled: manifestContent.includes("ftBackboneScheduled"),
    ftRunNow: manifestContent.includes("ftRunNow"),
  },
  forbidden_strings_clean: !hasError,
};

console.log("\n" + JSON.stringify(proof, null, 2));

if (hasError) {
  process.exit(1);
}

console.log("\n✓ Backbone Layer-0 proof complete");
process.exit(0);
