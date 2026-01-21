#!/usr/bin/env node
/**
 * auth_login_xvfb.mjs
 * 
 * Regenerates .auth/storageState.json using Xvfb display server.
 * Enforces canonical storage path using storage_state_paths.mjs
 * Validates storage state after creation.
 * 
 * Usage:
 *   node e2e/scripts/auth_login_xvfb.mjs
 * 
 * Exit codes:
 *   0 - Success
 *   1 - auth_login.mjs not found
 *   4 - Xvfb not installed
 *   5 - storageState validation failed (missing/empty/no cookies)
 *   6 - auth_login.mjs failed
 */

import { execSync, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { CANONICAL_STORAGE_STATE, REPO_ROOT } from './storage_state_paths.mjs';

const AUTH_DIR = path.join(REPO_ROOT, '.auth');
const STORAGE_STATE_FILE = CANONICAL_STORAGE_STATE;
const AUTH_LOGIN_SCRIPT = 'e2e/scripts/auth_login.mjs';
const PROVE_SCRIPT = 'e2e/scripts/prove_storage_state.mjs';

function log(msg) {
  console.log(`[AUTH_LOGIN_XVFB] ${msg}`);
}

function logError(msg) {
  console.error(`[AUTH_LOGIN_XVFB] ERROR: ${msg}`);
}

// Step 1: Ensure canonical .auth directory exists
if (!fs.existsSync(AUTH_DIR)) {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  log(`Created directory: ${AUTH_DIR}`);
}

// Step 2: Validate auth_login.mjs exists
if (!fs.existsSync(AUTH_LOGIN_SCRIPT)) {
  logError(`Auth login script not found: ${AUTH_LOGIN_SCRIPT}`);
  process.exit(1);
}
log(`Found auth login script: ${AUTH_LOGIN_SCRIPT}`);
log(`Canonical storage path: ${STORAGE_STATE_FILE}`);

// Step 3: Delete existing storageState.json (clean start)
if (fs.existsSync(STORAGE_STATE_FILE)) {
  fs.unlinkSync(STORAGE_STATE_FILE);
  log(`Deleted existing storageState: ${STORAGE_STATE_FILE}`);
}

// Step 4: Check if xvfb-run is installed
let hasXvfb = false;
try {
  execSync('which xvfb-run', { stdio: 'ignore' });
  hasXvfb = true;
} catch {
  hasXvfb = false;
}

if (!hasXvfb) {
  logError('Xvfb not found. Install with:');
  console.error('  sudo apt-get update && sudo apt-get install -y xvfb');
  process.exit(4);
}
log('Xvfb found, proceeding...');

// Step 5: Run auth_login.mjs under xvfb-run
log('Starting Xvfb display server and running auth login...');
log(`Command: xvfb-run -a node ${AUTH_LOGIN_SCRIPT}`);

const result = spawnSync('xvfb-run', ['-a', 'node', AUTH_LOGIN_SCRIPT], {
  stdio: 'inherit',
  cwd: process.cwd(),
});

if (result.error) {
  logError(`Failed to spawn xvfb-run: ${result.error.message}`);
  process.exit(6);
}

if (result.status !== 0) {
  logError(`auth_login.mjs exited with code ${result.status}`);
  process.exit(6);
}

log('auth_login.mjs completed');

// Step 6: Verify storageState.json exists and is non-empty
if (!fs.existsSync(STORAGE_STATE_FILE)) {
  logError(`storageState.json was not created at: ${STORAGE_STATE_FILE}`);
  process.exit(5);
}

const stat = fs.statSync(STORAGE_STATE_FILE);
if (stat.size === 0) {
  logError(`storageState.json is empty: ${STORAGE_STATE_FILE}`);
  process.exit(5);
}

log(`storageState.json created: ${STORAGE_STATE_FILE} (${stat.size} bytes)`);

// Step 7: Validate storage state content (has cookies)
try {
  const content = fs.readFileSync(STORAGE_STATE_FILE, 'utf8');
  const parsed = JSON.parse(content);
  const cookies = parsed.cookies || [];
  
  if (!Array.isArray(cookies) || cookies.length === 0) {
    logError(`Storage state appears invalid: no cookies found`);
    process.exit(5);
  }

  // Check for expired cookies
  const now = Math.floor(Date.now() / 1000);
  const expiredCookies = cookies.filter((c) => c.expires && c.expires > 0 && c.expires < now);
  if (expiredCookies.length > 0) {
    logError(`⚠️  Warning: ${expiredCookies.length} expired cookies detected`);
  }

  // Check for firsttry.atlassian.net cookies
  const firsttryCookies = cookies.filter((c) => (c.domain || '').includes('firsttry.atlassian.net'));
  if (firsttryCookies.length === 0) {
    logError(`Storage state appears invalid: missing firsttry.atlassian.net cookies`);
    process.exit(5);
  }

  log(`✓ Storage state validated: ${cookies.length} total cookies, ${firsttryCookies.length} for firsttry.atlassian.net`);
} catch (err) {
  logError(`Failed to validate storage state JSON: ${err.message}`);
  process.exit(5);
}

// Step 8: Run prove_storage_state.mjs to verify cookies
if (fs.existsSync(PROVE_SCRIPT)) {
  log(`Running proof script: ${PROVE_SCRIPT}`);
  const proveOut = '/tmp/storage_state_proof_after_login.json';
  try {
    execSync(`STORAGE_STATE="${STORAGE_STATE_FILE}" OUT="${proveOut}" node ${PROVE_SCRIPT}`, {
      stdio: 'inherit',
      cwd: process.cwd(),
    });
    log(`Proof written to: ${proveOut}`);
  } catch (err) {
    log(`Proof script failed (non-fatal): ${err.message}`);
  }
}

// Step 9: Print success summary
console.log('\n' + '='.repeat(80));
console.log('✅ AUTH LOGIN XVFB COMPLETE & VALIDATED');
console.log('='.repeat(80));
console.log(`storageState.json: ${STORAGE_STATE_FILE}`);
console.log(`Size: ${stat.size} bytes`);
console.log(`Modified: ${new Date(stat.mtime).toISOString()}`);
console.log('');
console.log('Next steps:');
console.log(`  STORAGE_STATE="${STORAGE_STATE_FILE}" npx playwright test ...`);
console.log('');
console.log('Or run preflight check:');
console.log(`  node e2e/scripts/auth_preflight_check.mjs`);
console.log('='.repeat(80));

process.exit(0);
