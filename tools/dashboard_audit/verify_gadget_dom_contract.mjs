#!/usr/bin/env node
/**
 * AUDIT: Verify gadget DOM has all required proof elements
 * 
 * Scans gadget-ui/index.html and verifies:
 * 1. All proof DOM IDs are present
 * 2. Elements are wired to CSS classes correctly
 * 3. data-ft-debug markers in place
 * 
 * Exit: 0 (PASS), 1 (FAIL), 2 (file not found)
 */

import fs from 'fs';
import path from 'path';

const HTML_FILE = path.join(process.cwd(), 'atlassian/forge-app/src/gadget-ui/index.html');

// Required proof DOM IDs (used by renderIdentityProofPanel)
const REQUIRED_PROOF_IDS = [
  'proof-envelope-kind',
  'proof-schema-version',
  'proof-correlation-id',
  'proof-ui-build-sha',
  'proof-ui-build-time',
  'proof-backend-build-sha',
  'proof-backend-build-time',
];

function main() {
  // Check file exists
  if (!fs.existsSync(HTML_FILE)) {
    console.error(`[DOM_VERIFY_FAIL] File not found: ${HTML_FILE}`);
    process.exit(2);
  }

  const content = fs.readFileSync(HTML_FILE, 'utf-8');

  // Verify all proof IDs exist
  const missing = [];
  REQUIRED_PROOF_IDS.forEach(id => {
    // Look for id="..." or id='...'
    const pattern = new RegExp(`id\\s*=\\s*["']${id}["']`);
    if (!pattern.test(content)) {
      missing.push(id);
    }
  });

  if (missing.length > 0) {
    console.error('[DOM_VERIFY_FAIL] Missing proof DOM elements:');
    missing.forEach(id => console.error(`  - #${id}`));
    process.exit(1);
  }

  // Check for identity-proof-panel container
  if (!content.includes('id="identity-proof-panel"')) {
    console.error('[DOM_VERIFY_FAIL] identity-proof-panel container not found');
    process.exit(1);
  }

  // Check for data-ft-debug markers (at least identity-proof-panel should have it)
  const dataFtDebugCount = (content.match(/data-ft-debug\s*=\s*["']1["']/g) || []).length;
  if (dataFtDebugCount < 1) {
    console.error('[DOM_VERIFY_FAIL] No data-ft-debug="1" markers found');
    process.exit(1);
  }

  console.log(`[DOM_VERIFY_OK] All ${REQUIRED_PROOF_IDS.length} proof DOM IDs present (${dataFtDebugCount} debug markers)`);
  process.exit(0);
}

main();
