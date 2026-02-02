#!/usr/bin/env node
/**
 * gen_backend_build_identity.mjs
 * 
 * Generates buildIdentityBackend.gen.ts at build time with deterministic values from git HEAD.
 * These values are included in resolver responses for runtime verification.
 * 
 * REQUIREMENTS:
 * - backend_git_sha: full 40-character git SHA (lowercase hex)
 * - backend_build_time_utc: ISO-8601 UTC build time from git commit (git show -s --format=%cI HEAD)
 * - backend_app_version: from package.json version
 * - FAIL-CLOSED: if any git command fails, the build must fail
 * - NO hardcoded constants or snapshot timestamps
 */

import { execSync } from 'child_process';
import { writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

const REPO_ROOT = process.cwd();
const GENERATED_FILE = join(REPO_ROOT, 'src', 'build', 'buildIdentityBackend.gen.ts');

console.log('[BACKEND_BUILD_IDENTITY] Starting generation...');
console.log(`[BACKEND_BUILD_IDENTITY] repo_root=${REPO_ROOT}`);
console.log(`[BACKEND_BUILD_IDENTITY] output_file=${GENERATED_FILE}`);

try {
  // ============================================================================
  // STEP 1: Get git SHA (full 40 characters)
  // ============================================================================
  console.log('[BACKEND_BUILD_IDENTITY] Executing: git rev-parse HEAD');
  let gitSha;
  try {
    gitSha = execSync('git rev-parse HEAD', { encoding: 'utf-8', cwd: REPO_ROOT }).trim();
  } catch (err) {
    console.error('[BACKEND_BUILD_IDENTITY] FAIL: git rev-parse HEAD failed');
    console.error(err.message);
    process.exit(1);
  }

  // Validate format: 40 hex characters
  if (!/^[0-9a-f]{40}$/.test(gitSha)) {
    console.error(`[BACKEND_BUILD_IDENTITY] FAIL: Invalid git SHA format: ${gitSha}`);
    process.exit(1);
  }
  console.log(`[BACKEND_BUILD_IDENTITY] ✓ git_sha=${gitSha}`);

  // Short form: first 7 characters
  const gitShaShort = gitSha.substring(0, 7);
  console.log(`[BACKEND_BUILD_IDENTITY] ✓ git_sha_short=${gitShaShort}`);

  // ============================================================================
  // STEP 2: Get build time UTC from git commit (ISO-8601)
  // ============================================================================
  console.log('[BACKEND_BUILD_IDENTITY] Executing: git show -s --format=%cI HEAD');
  let buildTimeUtc;
  try {
    buildTimeUtc = execSync('git show -s --format=%cI HEAD', { encoding: 'utf-8', cwd: REPO_ROOT }).trim();
  } catch (err) {
    console.error('[BACKEND_BUILD_IDENTITY] FAIL: git show -s --format=%cI HEAD failed');
    console.error(err.message);
    process.exit(1);
  }

  // Validate format: looks like ISO-8601
  if (!buildTimeUtc.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
    console.error(`[BACKEND_BUILD_IDENTITY] FAIL: Invalid ISO-8601 format: ${buildTimeUtc}`);
    process.exit(1);
  }
  console.log(`[BACKEND_BUILD_IDENTITY] ✓ build_time_utc=${buildTimeUtc}`);

  // ============================================================================
  // STEP 3: Get app version from package.json
  // ============================================================================
  console.log('[BACKEND_BUILD_IDENTITY] Reading package.json version');
  let appVersion;
  try {
    const packageJson = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf-8'));
    appVersion = packageJson.version;
    if (!appVersion) {
      throw new Error('version field missing from package.json');
    }
  } catch (err) {
    console.error('[BACKEND_BUILD_IDENTITY] FAIL: Could not read package.json version');
    console.error(err.message);
    process.exit(1);
  }
  console.log(`[BACKEND_BUILD_IDENTITY] ✓ app_version=${appVersion}`);

  // ============================================================================
  // STEP 4: Generate buildIdentityBackend.gen.ts
  // ============================================================================
  const generatedCode = `/**
 * AUTO-GENERATED FILE - DO NOT EDIT
 * 
 * Generated at build time by tools/gen_backend_build_identity.mjs
 * Contains deterministic build identity values from git HEAD and package.json
 * 
 * These values are returned by the resolver to:
 * 1. Enable runtime mismatch detection (UI SHA vs Backend SHA)
 * 2. Provide cryptographic proof of backend build identity
 * 3. Support forensic probes and audit trails
 */

/** Full 40-character git SHA (lowercase hex) from git rev-parse HEAD */
export const BACKEND_GIT_SHA = '${gitSha}';

/** Short form: first 7 characters of git SHA */
export const BACKEND_GIT_SHA_SHORT = '${gitShaShort}';

/** ISO-8601 UTC build time from git commit (git show -s --format=%cI HEAD) */
export const BACKEND_BUILD_TIME_UTC = '${buildTimeUtc}';

/** App version from package.json */
export const BACKEND_APP_VERSION = '${appVersion}';

/**
 * Format build identity for logging
 */
export function formatBackendBuildIdentity(): string {
  return \`Backend: \${BACKEND_GIT_SHA_SHORT} | \${BACKEND_BUILD_TIME_UTC}\`;
}
`;

  writeFileSync(GENERATED_FILE, generatedCode);
  console.log(`[BACKEND_BUILD_IDENTITY] ✓ Generated ${GENERATED_FILE}`);

  // ============================================================================
  // STEP 5: Emit success marker
  // ============================================================================
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('[BACKEND_BUILD_IDENTITY] SUCCESS: Backend identity generated');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Git SHA (40):  ${gitSha}`);
  console.log(`  Git SHA (7):   ${gitShaShort}`);
  console.log(`  Build Time:    ${buildTimeUtc}`);
  console.log(`  App Version:   ${appVersion}`);
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

} catch (err) {
  console.error('[BACKEND_BUILD_IDENTITY] FAIL: Unexpected error');
  console.error(err.message);
  process.exit(1);
}
