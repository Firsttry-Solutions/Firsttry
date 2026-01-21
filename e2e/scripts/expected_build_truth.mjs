#!/usr/bin/env node
/**
 * expected_build_truth.mjs
 *
 * PHASE 0: Capture EXPECTED build identifiers from local working tree
 *
 * Purpose: Determine what the deployed Cloud gadget SHOULD contain
 * if it's up-to-date with the current working tree.
 *
 * Output: /tmp/ft_expected_build_truth.json
 *
 * Includes:
 * - repo_root (absolute path)
 * - forge_app_head_full (40-hex git SHA from forge-app directory)
 * - forge_app_head_short7 (first 7 chars)
 * - ui_git_sha_from_generated_meta (parsed from ui_build_meta.ts)
 * - ui_build_time_utc_from_generated_meta
 * - generated_at_utc (ISO timestamp when this script ran)
 *
 * Exit codes:
 * - 0: Success
 * - 1: Script error
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function main() {
  try {
    // ======================================================================
    // Step 1: Determine repo root
    // ======================================================================
    const repoRoot = path.resolve(__dirname, '../../');
    console.log(`[EXPECTED_BUILD_TRUTH] Repo root: ${repoRoot}`);

    // ======================================================================
    // Step 2: Get forge-app git HEAD
    // ======================================================================
    const forgeAppDir = path.join(repoRoot, 'atlassian/forge-app');
    if (!fs.existsSync(forgeAppDir)) {
      console.error(`[EXPECTED_BUILD_TRUTH] ERROR: forge-app directory not found at ${forgeAppDir}`);
      process.exit(1);
    }

    let forgeAppHeadFull = '';
    try {
      forgeAppHeadFull = execSync('git rev-parse HEAD', {
        cwd: forgeAppDir,
        encoding: 'utf8',
      }).trim();

      if (!/^[0-9a-f]{40}$/.test(forgeAppHeadFull)) {
        console.error(`[EXPECTED_BUILD_TRUTH] ERROR: git HEAD not 40-hex format: "${forgeAppHeadFull}"`);
        process.exit(1);
      }
    } catch (e) {
      console.error(`[EXPECTED_BUILD_TRUTH] ERROR: Could not get git HEAD from forge-app:`, e.message);
      process.exit(1);
    }

    const forgeAppHeadShort7 = forgeAppHeadFull.substring(0, 7);
    console.log(`[EXPECTED_BUILD_TRUTH] forge_app HEAD: ${forgeAppHeadFull} (${forgeAppHeadShort7})`);

    // ======================================================================
    // Step 3: Parse ui_build_meta.ts for UI_GIT_SHA and UI_BUILD_TIME_UTC
    // ======================================================================
    const uiBuildMetaPath = path.join(repoRoot, 'atlassian/forge-app/src/gadget-ui/src/ui_build_meta.ts');
    if (!fs.existsSync(uiBuildMetaPath)) {
      console.error(`[EXPECTED_BUILD_TRUTH] ERROR: ui_build_meta.ts not found at ${uiBuildMetaPath}`);
      process.exit(1);
    }

    const uiBuildMetaContent = fs.readFileSync(uiBuildMetaPath, 'utf8');

    // Parse: export const UI_GIT_SHA = "...";
    const uiGitShaMatch = uiBuildMetaContent.match(/export const UI_GIT_SHA = "([^"]+)"/);
    if (!uiGitShaMatch) {
      console.error('[EXPECTED_BUILD_TRUTH] ERROR: Could not parse UI_GIT_SHA from ui_build_meta.ts');
      process.exit(1);
    }
    const uiGitSha = uiGitShaMatch[1];

    // Validate format
    if (uiGitSha === 'UNSET') {
      console.error('[EXPECTED_BUILD_TRUTH] ERROR: UI_GIT_SHA is "UNSET" - build metadata not injected');
      process.exit(1);
    }
    if (!/^[0-9a-f]{40}$/.test(uiGitSha)) {
      console.error(`[EXPECTED_BUILD_TRUTH] ERROR: UI_GIT_SHA not 40-hex format: "${uiGitSha}"`);
      process.exit(1);
    }

    // Parse: export const UI_BUILD_TIME_UTC = "...";
    const uiBuildTimeMatch = uiBuildMetaContent.match(/export const UI_BUILD_TIME_UTC = "([^"]+)"/);
    if (!uiBuildTimeMatch) {
      console.error('[EXPECTED_BUILD_TRUTH] ERROR: Could not parse UI_BUILD_TIME_UTC from ui_build_meta.ts');
      process.exit(1);
    }
    const uiBuildTimeUtc = uiBuildTimeMatch[1];

    // Validate format (should be ISO-like)
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(uiBuildTimeUtc)) {
      console.error(`[EXPECTED_BUILD_TRUTH] ERROR: UI_BUILD_TIME_UTC not ISO format: "${uiBuildTimeUtc}"`);
      process.exit(1);
    }

    console.log(`[EXPECTED_BUILD_TRUTH] UI_GIT_SHA: ${uiGitSha}`);
    console.log(`[EXPECTED_BUILD_TRUTH] UI_BUILD_TIME_UTC: ${uiBuildTimeUtc}`);

    // ======================================================================
    // Step 4: Generate output
    // ======================================================================
    const now = new Date().toISOString();
    const truth = {
      repo_root: repoRoot,
      forge_app_head_full: forgeAppHeadFull,
      forge_app_head_short7: forgeAppHeadShort7,
      ui_git_sha_from_generated_meta: uiGitSha,
      ui_build_time_utc_from_generated_meta: uiBuildTimeUtc,
      generated_at_utc: now,
    };

    const outputPath = '/tmp/ft_expected_build_truth.json';
    fs.writeFileSync(outputPath, JSON.stringify(truth, null, 2));
    console.log(`[EXPECTED_BUILD_TRUTH] ✓ Written to: ${outputPath}`);

    // ======================================================================
    // Step 5: Display results
    // ======================================================================
    console.log('\n[EXPECTED_BUILD_TRUTH] EXPECTED BUILD TRUTH:');
    console.log(`  Backend (forge-app): ${forgeAppHeadFull}`);
    console.log(`  UI (gadget):         ${uiGitSha}`);
    console.log(`  Timestamp:           ${uiBuildTimeUtc}`);
    console.log(`\n[EXPECTED_BUILD_TRUTH] ✓ All validations passed\n`);

    process.exit(0);
  } catch (e) {
    console.error('[EXPECTED_BUILD_TRUTH] FATAL ERROR:', e.message);
    process.exit(1);
  }
}

main();
