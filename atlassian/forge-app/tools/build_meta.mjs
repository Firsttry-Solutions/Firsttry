#!/usr/bin/env node
/**
 * build_meta.mjs — Compute build metadata (cross-platform, no bash dependency)
 *
 * Computes:
 *  - FT_BUILD_SHA: git commit short SHA (12 chars for backward compat)
 *  - UI_GIT_SHA: full git commit SHA (40 chars for UI runtime identity)
 *  - FT_BUILD_TIME_UTC: ISO 8601 timestamp (UTC, no milliseconds)
 *
 * Exports to: tools/.build_meta.json (backend) and src/gadget-ui/src/build/ui_build_meta.json (UI)
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
    return execSync('git rev-parse --short=12 HEAD', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
  } catch (e) {
    console.error('❌ Failed to compute git SHA (short):', e.message);
    process.exit(1);
  }
}

function gitShaFull() {
  try {
    const sha = execSync('git rev-parse HEAD', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    if (!sha || sha.length !== 40) {
      console.error(`❌ Failed to compute full git SHA: expected 40 chars, got ${sha ? sha.length : 0}`);
      process.exit(1);
    }
    return sha;
  } catch (e) {
    console.error('❌ Failed to compute git SHA (full):', e.message);
    process.exit(1);
  }
}

function gitCommitTimeUtc() {
  try {
    // Get commit timestamp in ISO 8601 format (e.g., 2026-01-25T09:54:48Z)
    const commitTime = execSync('git show -s --format=%cI HEAD', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    if (!commitTime) {
      console.error('❌ Failed to get git commit time: empty result');
      process.exit(1);
    }
    // Ensure it's valid ISO 8601 UTC
    if (!commitTime.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
      console.error(`❌ Invalid commit time format: ${commitTime} (expected ISO 8601)`);
      process.exit(1);
    }
    return commitTime;
  } catch (e) {
    console.error('❌ Failed to get git commit time:', e.message);
    process.exit(1);
  }
}

const meta = {
  FT_BUILD_SHA: gitShaShort(),
  UI_GIT_SHA: gitShaFull(),
  FT_BUILD_TIME_UTC: gitCommitTimeUtc(),
};

// Write JSON (for Node.js consumption)
const jsonPath = path.join(__dirname, '.build_meta.json');
fs.writeFileSync(jsonPath, JSON.stringify(meta, null, 2));
console.log(`✅ Wrote metadata to ${jsonPath}`);
console.log(`   FT_BUILD_SHA=${meta.FT_BUILD_SHA}`);
console.log(`   UI_GIT_SHA=${meta.UI_GIT_SHA}`);
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

// FAIL-CLOSED: Ensure parent directory exists before writing
const backendBuildDir = path.dirname(backendBuildPath);
if (!fs.existsSync(backendBuildDir)) {
  fs.mkdirSync(backendBuildDir, { recursive: true });
  console.log(`✅ Created directory: ${backendBuildDir}`);
}

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
// This ensures UI_GIT_SHA is available at Vite config time (not runtime)
// and is fail-closed in production (throws if missing or invalid)

const uiBuildDir = path.join(__dirname, '..', 'src', 'gadget-ui', 'src', 'build');
const uiBuildMetaPath = path.join(uiBuildDir, 'ui_build_meta.json');

// Create directory if it doesn't exist
if (!fs.existsSync(uiBuildDir)) {
  fs.mkdirSync(uiBuildDir, { recursive: true });
}

const uiBuildMeta = {
  UI_GIT_SHA: meta.UI_GIT_SHA,
  UI_GIT_TIME: meta.FT_BUILD_TIME_UTC,
};

fs.writeFileSync(uiBuildMetaPath, JSON.stringify(uiBuildMeta, null, 2));
console.log(`✅ Wrote UI build metadata to ${uiBuildMetaPath}`);

// VERIFICATION STEP: Read back and verify ui_build_meta.json injection succeeded
try {
  const writtenJson = fs.readFileSync(uiBuildMetaPath, 'utf8');
  const parsed = JSON.parse(writtenJson);
  
  // Check 1: UI_GIT_SHA must exist and be exactly 40 hex chars
  if (!parsed.UI_GIT_SHA) {
    console.error('❌ UI INJECTION FAILED: UI_GIT_SHA missing from ui_build_meta.json');
    process.exit(1);
  }
  
  const fullShaRegex = /^[0-9a-f]{40}$/;
  if (!fullShaRegex.test(parsed.UI_GIT_SHA)) {
    console.error(`❌ UI INJECTION FAILED: UI_GIT_SHA "${parsed.UI_GIT_SHA}" must be exactly 40 hex chars, got ${parsed.UI_GIT_SHA.length}`);
    process.exit(1);
  }
  
  // Check 2: Verify it matches what we wrote
  if (parsed.UI_GIT_SHA !== meta.UI_GIT_SHA) {
    console.error(`❌ UI INJECTION FAILED: Mismatch. Expected ${meta.UI_GIT_SHA}, got ${parsed.UI_GIT_SHA}`);
    process.exit(1);
  }
  
  // Check 3: UI_GIT_TIME must also exist
  if (!parsed.UI_GIT_TIME) {
    console.error('❌ UI INJECTION FAILED: UI_GIT_TIME missing from ui_build_meta.json');
    process.exit(1);
  }
  
  console.log(`✅ Verified ui_build_meta.json with UI_GIT_SHA="${parsed.UI_GIT_SHA}" (40-hex confirmed)`);
} catch (err) {
  console.error(`❌ UI VERIFICATION FAILED: Could not verify ui_build_meta.json injection: ${err.message}`);
  process.exit(1);
}

process.exit(0);
