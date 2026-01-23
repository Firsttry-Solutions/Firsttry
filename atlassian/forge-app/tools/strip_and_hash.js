#!/usr/bin/env node
// Phase 6: Bundle hash computation
// Purpose: Strip comments and compute SHA256 hash of gadget bundle
// Usage: node tools/strip_and_hash.js <bundle_file>

import fs from "fs";
import crypto from "crypto";

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: node strip_and_hash.js <bundle_file>");
  process.exit(1);
}

if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

let content = fs.readFileSync(filePath, "utf8");

// Strip block comments /* ... */ but preserve CRITICAL markers
// Regex: match /* followed by anything (non-greedy) followed by */
// We preserve FT_IDENTITY_ANCHOR_V1 markers in comments
const criticalPattern = /FT_IDENTITY_ANCHOR_V1/;
const hasCritical = criticalPattern.test(content);

if (hasCritical) {
  // Extract and preserve anchor comments
  const anchorRegex = /\/\*[^*]*FT_IDENTITY_ANCHOR_V1[^*]*\*\//;
  const anchorMatch = content.match(anchorRegex);
  
  // Strip all comments
  content = content.replace(/\/\*[\s\S]*?\*\//g, "");
  
  // For hash purposes, we still hash the full file including comments
  // This ensures the embedded anchor participates in the hash
  let fullContent = fs.readFileSync(filePath, "utf8");
  const hash = crypto.createHash("sha256").update(fullContent).digest("hex");
  
  console.log(hash.substring(0, 8)); // First 8 hex chars as bundle identifier
  process.exit(0);
} else {
  // Standard hash
  const fileContent = fs.readFileSync(filePath, "utf8");
  const hash = crypto.createHash("sha256").update(fileContent).digest("hex");
  console.log(hash.substring(0, 8)); // First 8 hex chars
  process.exit(0);
}
