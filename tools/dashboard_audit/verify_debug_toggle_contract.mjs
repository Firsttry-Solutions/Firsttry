#!/usr/bin/env node
/**
 * AUDIT: Verify debug toggle contract
 * 
 * Scans main.ts, index.html, and main.css to verify:
 * 1. ftIsDebugMode() and ftApplyDebugModeClass() functions exist in main.ts
 * 2. At least 3 data-ft-debug="1" markers in index.html (debug sections)
 * 3. CSS has both display: none rule and @supports pattern for show
 * 
 * Exit: 0 (PASS), 1 (FAIL), 2 (file not found)
 */

import fs from 'fs';
import path from 'path';

const MAIN_TS = path.join(process.cwd(), 'atlassian/forge-app/src/gadget-ui/src/main.ts');
const INDEX_HTML = path.join(process.cwd(), 'atlassian/forge-app/src/gadget-ui/index.html');
const MAIN_CSS = path.join(process.cwd(), 'atlassian/forge-app/src/gadget-ui/src/styles/main.css');

function main() {
  const issues = [];

  // ======== Check main.ts ========
  if (!fs.existsSync(MAIN_TS)) {
    console.error(`[DEBUG_VERIFY_FAIL] File not found: ${MAIN_TS}`);
    process.exit(2);
  }
  const tsContent = fs.readFileSync(MAIN_TS, 'utf-8');

  if (!tsContent.includes('function ftIsDebugMode')) {
    issues.push('main.ts missing ftIsDebugMode() function');
  }
  if (!tsContent.includes('ftApplyDebugModeClass')) {
    issues.push('main.ts missing ftApplyDebugModeClass() function');
  }

  // ======== Check index.html ========
  if (!fs.existsSync(INDEX_HTML)) {
    console.error(`[DEBUG_VERIFY_FAIL] File not found: ${INDEX_HTML}`);
    process.exit(2);
  }
  const htmlContent = fs.readFileSync(INDEX_HTML, 'utf-8');

  const debugMarkerCount = (htmlContent.match(/data-ft-debug\s*=\s*["']1["']/g) || []).length;
  if (debugMarkerCount < 3) {
    issues.push(`index.html has only ${debugMarkerCount} data-ft-debug="1" markers (expected >= 3)`);
  }

  // ======== Check main.css ========
  if (!fs.existsSync(MAIN_CSS)) {
    console.error(`[DEBUG_VERIFY_FAIL] File not found: ${MAIN_CSS}`);
    process.exit(2);
  }
  const cssContent = fs.readFileSync(MAIN_CSS, 'utf-8');

  // Check for hide rule
  if (!cssContent.includes('[data-ft-debug="1"]') || !cssContent.includes('display: none')) {
    issues.push('main.css missing [data-ft-debug="1"] { display: none } rule');
  }

  // Check for @supports show pattern
  if (!cssContent.includes('@supports (display: revert)') || !cssContent.includes('html.ft-debug [data-ft-debug="1"]')) {
    issues.push('main.css missing @supports (display: revert) pattern for showing debug elements');
  }

  // Check for fallback pattern
  if (!cssContent.includes('@supports not (display: revert)')) {
    issues.push('main.css missing @supports not (display: revert) fallback pattern');
  }

  if (issues.length > 0) {
    console.error('[DEBUG_VERIFY_FAIL] Debug toggle contract violations:');
    issues.forEach(issue => console.error(`  - ${issue}`));
    process.exit(1);
  }

  console.log(`[DEBUG_VERIFY_OK] Debug toggle contract verified (${debugMarkerCount} markers, functions present, CSS patterns correct)`);
  process.exit(0);
}

main();
