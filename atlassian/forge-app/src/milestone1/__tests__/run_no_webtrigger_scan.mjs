#!/usr/bin/env node

/**
 * CI Gate: No Webtriggers Scan
 * 
 * REQUIREMENT: Runs on Atlassian (RoA) eligibility requires zero webtrigger modules.
 * 
 * BEHAVIOR:
 * - Read manifest.yml
 * - FAIL if "webtrigger" found anywhere in the file
 * - PASS and emit [FT_NO_WEBTRIGGER_SCAN_PASS] on success
 * 
 * PURPOSE: Prevent RoA eligibility regression by catching webtrigger re-introduction.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const manifestPath = path.resolve(__dirname, '../../../manifest.yml');

console.log('[FT_NO_WEBTRIGGER_SCAN_START] Scanning for webtriggers in manifest...');
console.log(`Script dir: ${__dirname}`);
console.log(`Manifest path: ${manifestPath}\n`);

// Check if manifest exists
if (!fs.existsSync(manifestPath)) {
  console.error(`[FT_NO_WEBTRIGGER_SCAN_FAIL] Manifest not found at ${manifestPath}`);
  process.exit(1);
}

// Read manifest
let manifestContent;
try {
  manifestContent = fs.readFileSync(manifestPath, 'utf8');
} catch (err) {
  console.error(`[FT_NO_WEBTRIGGER_SCAN_FAIL] Failed to read manifest: ${err.message}`);
  process.exit(1);
}

// Check for "webtrigger" anywhere in manifest
const webtriggerMatches = manifestContent.match(/webtrigger/gi) || [];

if (webtriggerMatches.length > 0) {
  console.error(`\n[FT_NO_WEBTRIGGER_SCAN_FAIL] Found ${webtriggerMatches.length} reference(s) to "webtrigger" in manifest`);
  console.error('\nWebtrigger references are incompatible with Runs on Atlassian (RoA) eligibility.');
  console.error('These must be removed for the app to be eligible for RoA.');
  
  // Show context around each match
  const lines = manifestContent.split('\n');
  let lineNum = 0;
  for (const line of lines) {
    lineNum++;
    if (/webtrigger/i.test(line)) {
      console.error(`\nLine ${lineNum}: ${line}`);
    }
  }
  
  process.exit(1);
}

console.log('[FT_NO_WEBTRIGGER_SCAN_PASS] ✓ No webtrigger references found in manifest');
console.log('[FT_NO_WEBTRIGGER_SCAN_PASS] ✓ App is eligible for Runs on Atlassian (RoA)');
process.exit(0);
