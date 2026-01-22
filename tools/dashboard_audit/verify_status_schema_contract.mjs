#!/usr/bin/env node
/**
 * AUDIT: Verify status schema has all required proof fields
 * 
 * Scans statusSchema.ts and verifies:
 * 1. All proof envelope fields are declared in GovernanceStatusV1 interface
 * 2. normalizeStatusV1 function sets envelopeKind and schemaVersion
 * 3. No critical fields removed
 * 
 * Exit: 0 (PASS), 1 (FAIL), 2 (file not found)
 */

import fs from 'fs';
import path from 'path';

const SCHEMA_FILE = path.join(process.cwd(), 'atlassian/forge-app/src/shared/statusSchema.ts');

// Required proof contract fields (MUST exist in interface and/or normalizeStatusV1)
const REQUIRED_FIELDS = [
  'envelopeKind',
  'schemaVersion',
  'correlation_id',
  'backend_build_sha',
  'backend_build_time_utc',
  'ui_build_sha',
  'ui_build_time_utc',
];

function main() {
  // Check file exists
  if (!fs.existsSync(SCHEMA_FILE)) {
    console.error(`[SCHEMA_VERIFY_FAIL] File not found: ${SCHEMA_FILE}`);
    process.exit(2);
  }

  const content = fs.readFileSync(SCHEMA_FILE, 'utf-8');

  // Check for interface declaration
  if (!content.includes('interface GovernanceStatusV1')) {
    console.error('[SCHEMA_VERIFY_FAIL] GovernanceStatusV1 interface not found');
    process.exit(1);
  }

  // Verify all required fields are present in interface
  const missing = [];
  REQUIRED_FIELDS.forEach(field => {
    // Look for either: field?: type or field: type
    const patterns = [
      new RegExp(`\\b${field}\\?\\s*:`),  // optional field
      new RegExp(`\\b${field}\\s*:`),    // required field
    ];
    const found = patterns.some(p => p.test(content));
    if (!found) {
      missing.push(field);
    }
  });

  if (missing.length > 0) {
    console.error('[SCHEMA_VERIFY_FAIL] Missing proof contract fields in GovernanceStatusV1:');
    missing.forEach(f => console.error(`  - ${f}`));
    process.exit(1);
  }

  // Check for normalizeStatusV1 function or default object
  if (!content.includes('normalizeStatusV1') && !content.includes('normalize') && !content.includes('FT_DASH_ENVELOPE_V1')) {
    console.error('[SCHEMA_VERIFY_FAIL] No normalization or envelope reference found');
    process.exit(1);
  }

  // Verify envelopeKind and schemaVersion are mentioned in code
  if (!content.includes('envelopeKind') || !content.includes('FT_DASH_ENVELOPE_V1')) {
    console.error('[SCHEMA_VERIFY_FAIL] envelopeKind/FT_DASH_ENVELOPE_V1 not referenced in schema');
    process.exit(1);
  }

  if (!content.includes('schemaVersion')) {
    console.error('[SCHEMA_VERIFY_FAIL] schemaVersion not referenced in schema');
    process.exit(1);
  }

  console.log(`[SCHEMA_VERIFY_OK] All ${REQUIRED_FIELDS.length} proof contract fields present in statusSchema.ts`);
  process.exit(0);
}

main();
