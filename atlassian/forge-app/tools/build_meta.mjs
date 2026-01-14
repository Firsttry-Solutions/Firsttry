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

process.exit(0);
