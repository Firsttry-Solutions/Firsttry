#!/usr/bin/env node
/**
 * build_meta.mjs — Compute build metadata (cross-platform, no bash dependency)
 *
 * Computes:
 *  - FT_BUILD_SHA: git commit short SHA (7 chars)
 *  - FT_BUILD_TIME_UTC: ISO 8601 timestamp (UTC, no milliseconds)
 *
 * Exports to: tools/.build_meta.json
 * Usage: node tools/build_meta.mjs && source tools/.build_meta.sh
 *        (or read .build_meta.json for programmatic access)
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function gitShaShort() {
  try {
    return execSync('git rev-parse --short=7 HEAD', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
  } catch (e) {
    console.error('❌ Failed to compute git SHA:', e.message);
    process.exit(1);
  }
}

function utcIsoNoMillis() {
  const iso = new Date().toISOString();
  // Convert "2026-01-14T06:45:13.123Z" to "2026-01-14T06:45:13Z"
  return iso.replace(/\.\d{3}Z$/, 'Z');
}

const meta = {
  FT_BUILD_SHA: gitShaShort(),
  FT_BUILD_TIME_UTC: utcIsoNoMillis(),
};

// Write JSON (for Node.js consumption)
const jsonPath = path.join(__dirname, '.build_meta.json');
fs.writeFileSync(jsonPath, JSON.stringify(meta, null, 2));
console.log(`✅ Wrote metadata to ${jsonPath}`);
console.log(`   FT_BUILD_SHA=${meta.FT_BUILD_SHA}`);
console.log(`   FT_BUILD_TIME_UTC=${meta.FT_BUILD_TIME_UTC}`);

// Write shell script (for cross-env/shell compatibility)
const shPath = path.join(__dirname, '.build_meta.sh');
const shContent = `#!/bin/bash
export FT_BUILD_SHA="${meta.FT_BUILD_SHA}"
export FT_BUILD_TIME_UTC="${meta.FT_BUILD_TIME_UTC}"
`;
fs.writeFileSync(shPath, shContent);
console.log(`✅ Wrote shell export to ${shPath}`);

// Write .env format (for cross-env-shell)
const envPath = path.join(__dirname, '.build_meta.env');
const envContent = `FT_BUILD_SHA=${meta.FT_BUILD_SHA}
FT_BUILD_TIME_UTC=${meta.FT_BUILD_TIME_UTC}
`;
fs.writeFileSync(envPath, envContent);
console.log(`✅ Wrote .env format to ${envPath}`);

// ============================================================================
// BACKBONE LAYER 0: Inject backend_build.ts with git SHA
// ============================================================================
// File: src/build/backend_build.ts
// This ensures BACKEND_BUILD_SHA is a constant at build time, not runtime or env var
const backendBuildPath = path.join(__dirname, '..', 'src', 'build', 'backend_build.ts');
const backendBuildContent = `/**
 * BACKEND BUILD METADATA — BACKBONE LAYER 0
 *
 * CRITICAL INVARIANT: This file is REWRITTEN at build time by tools/build_meta.mjs
 * Do NOT modify manually. The git short SHA is injected during \`npm run build:gadget\`.
 *
 * Single authoritative source for backend build SHA:
 * - Not from process.env (which can be manipulated or missing)
 * - Not from runtime git calls (which can fail)
 * - Not a fallback to "unknown" (which hides failures)
 *
 * ENFORCEMENT:
 * - BACKEND_BUILD_SHA must match /^[0-9a-f]{7,40}$/ (7-40 hex chars)
 * - Validation runs at import time (fail-fast on misconfiguration)
 * - If validation fails, module import will throw (stopping the build/invocation)
 * - All resolvers MUST import this constant; no fallbacks allowed
 *
 * RESULT: All logs and responses use the injected SHA, never "unknown"
 */

// Placeholder replaced by build-time script with git short SHA
export const BACKEND_BUILD_SHA = "${meta.FT_BUILD_SHA}";

/**
 * Validate that BACKEND_BUILD_SHA matches expected format.
 * This is called at import time to catch build misconfiguration early.
 *
 * REQUIREMENTS:
 * - Must be 7-40 hex characters (allow short SHA or full SHA)
 * - Must NOT be the placeholder "__BACKEND_BUILD_SHA__"
 *
 * BEHAVIOR:
 * - If valid: returns true, continues silently
 * - If invalid: throws Error (stops module import, stops invocation)
 *
 * RATIONALE:
 * - Fail-closed: better to detect build mistake immediately than silently use "unknown"
 * - No logging needed; the thrown error will be in logs + CI output
 */
export function validateBackendBuildSha(): boolean {
  // Allow 7-40 hex chars (short SHA or full SHA)
  const hexRegex = /^[0-9a-f]{7,40}$/;

  if (!hexRegex.test(BACKEND_BUILD_SHA)) {
    throw new Error(
      \`BACKEND_BUILD_SHA_INVALID_FORMAT: "\${BACKEND_BUILD_SHA}" does not match /^[0-9a-f]{7,40}$/ \` +
        \`(7-40 hex characters). Build script may have failed to compute or inject git SHA correctly. \` +
        \`Current value: "\${BACKEND_BUILD_SHA}"\`
    );
  }

  return true;
}

// Validate at import time (synchronous, fail-fast)
// This ensures the module cannot be loaded if the build script didn't run correctly
try {
  validateBackendBuildSha();
} catch (err) {
  // Re-throw immediately; the error message is descriptive enough for debugging
  throw err;
}
`;

fs.writeFileSync(backendBuildPath, backendBuildContent);

// VERIFICATION STEP: Read back and verify injection succeeded
try {
  const writtenContent = fs.readFileSync(backendBuildPath, 'utf8');
  
  // Check 1: Verify the actual SHA was injected (not a placeholder or placeholder-like string)
  if (!writtenContent.includes(`export const BACKEND_BUILD_SHA = "${meta.FT_BUILD_SHA}";`)) {
    console.error(`❌ INJECTION FAILED: SHA not injected correctly. Expected: ${meta.FT_BUILD_SHA}`);
    process.exit(1);
  }
  
  // Check 2: Placeholder must NOT be in the actual export statement
  // (it's OK if the placeholder string appears in comments or validation code)
  const exportLineMatch = writtenContent.match(/export const BACKEND_BUILD_SHA = "(.+?)";/);
  if (!exportLineMatch || exportLineMatch[1] === '__BACKEND_BUILD_SHA__') {
    console.error('❌ INJECTION FAILED: Placeholder still in export statement');
    process.exit(1);
  }
  
  // Check 3: Validation function must be present
  if (!writtenContent.includes('validateBackendBuildSha')) {
    console.error('❌ INJECTION FAILED: Validation function missing from backend_build.ts');
    process.exit(1);
  }
  
  console.log(`✅ Injected backend_build.ts with BACKEND_BUILD_SHA="${meta.FT_BUILD_SHA}" (verified)`);
} catch (err) {
  console.error(`❌ VERIFICATION FAILED: Could not verify backend_build.ts injection: ${err.message}`);
  process.exit(1);
}

// ============================================================================
// UI LAYER 0: Write ui_build_meta.json with build metadata for Vite
// ============================================================================
// File: src/gadget-ui/src/build/ui_build_meta.json
// This ensures UI build SHA is available at Vite config time (not runtime)
// and is fail-closed in production (throws if missing or invalid)

const uiBuildDir = path.join(__dirname, '..', 'src', 'gadget-ui', 'src', 'build');
const uiBuildMetaPath = path.join(uiBuildDir, 'ui_build_meta.json');

// Create directory if it doesn't exist
if (!fs.existsSync(uiBuildDir)) {
  fs.mkdirSync(uiBuildDir, { recursive: true });
}

const uiBuildMeta = {
  FT_BUILD_SHA: meta.FT_BUILD_SHA,
  FT_BUILD_TIME_UTC: meta.FT_BUILD_TIME_UTC,
};

fs.writeFileSync(uiBuildMetaPath, JSON.stringify(uiBuildMeta, null, 2));
console.log(`✅ Wrote UI build metadata to ${uiBuildMetaPath}`);

// VERIFICATION STEP: Read back and verify ui_build_meta.json injection succeeded
try {
  const writtenJson = fs.readFileSync(uiBuildMetaPath, 'utf8');
  const parsed = JSON.parse(writtenJson);
  
  // Check 1: FT_BUILD_SHA must exist in parsed JSON
  if (!parsed.FT_BUILD_SHA) {
    console.error('❌ UI INJECTION FAILED: FT_BUILD_SHA missing from ui_build_meta.json');
    process.exit(1);
  }
  
  // Check 2: FT_BUILD_SHA must match hex regex (same as backend: 7-40 hex chars)
  const hexRegex = /^[0-9a-f]{7,40}$/;
  if (!hexRegex.test(parsed.FT_BUILD_SHA)) {
    console.error(`❌ UI INJECTION FAILED: FT_BUILD_SHA "${parsed.FT_BUILD_SHA}" does not match /^[0-9a-f]{7,40}$/`);
    process.exit(1);
  }
  
  // Check 3: Verify it matches what we wrote
  if (parsed.FT_BUILD_SHA !== meta.FT_BUILD_SHA) {
    console.error(`❌ UI INJECTION FAILED: Mismatch. Expected ${meta.FT_BUILD_SHA}, got ${parsed.FT_BUILD_SHA}`);
    process.exit(1);
  }
  
  // Check 4: FT_BUILD_TIME_UTC must also exist
  if (!parsed.FT_BUILD_TIME_UTC) {
    console.error('❌ UI INJECTION FAILED: FT_BUILD_TIME_UTC missing from ui_build_meta.json');
    process.exit(1);
  }
  
  console.log(`✅ Verified ui_build_meta.json with FT_BUILD_SHA="${parsed.FT_BUILD_SHA}" (verified)`);
} catch (err) {
  console.error(`❌ UI VERIFICATION FAILED: Could not verify ui_build_meta.json injection: ${err.message}`);
  process.exit(1);
}

process.exit(0);
