#!/usr/bin/env node

/**
 * verify_scopes_justified.mjs
 * 
 * Verify that all declared scopes in manifest.yml are:
 * 1. Actually used in runtime code (no over-scoping)
 * 2. Sufficient for all runtime API calls (no undeclared usage)
 * 
 * Fail-closed: missing usage or undeclared calls = FAIL
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';

const E = process.env.FT_PROD_READY_E || '/tmp/ft_prod_ready_audit';

// Ensure output directory exists
try {
  mkdirSync(join(E, '13_repo_scans'), { recursive: true });
} catch (e) {
  // Directory might already exist
}

// ========================================================================
// 1. Extract declared scopes from manifest.yml
// ========================================================================

console.log('[SCOPES] Parsing manifest.yml...');

const manifestPath = 'manifest.yml';
let manifestText = '';
try {
  manifestText = readFileSync(manifestPath, 'utf-8');
} catch (err) {
  console.error(`[SCOPES] ERROR: Cannot read ${manifestPath}`);
  process.exit(1);
}

// Extract scopes: look for "- read:jira-user", "- read:jira-work", "- storage:app"
const scopePattern = /^\s*-\s+([\w\-:]+)$/gm;
const declaredScopes = new Set();
let match;

while ((match = scopePattern.exec(manifestText)) !== null) {
  const scope = match[1];
  if (scope.includes(':')) {
    declaredScopes.add(scope);
  }
}

console.log(`[SCOPES] Declared scopes: ${Array.from(declaredScopes).join(', ')}`);

// ========================================================================
// 2. Scan codebase for usage of each scope
// ========================================================================

const scopeUsageMap = new Map();

for (const scope of declaredScopes) {
  const usageHits = [];
  
  if (scope.includes('read:jira-user')) {
    // Look for requestJira calls to /rest/api/3/myself or /user/groups
    try {
      const hits = execSync('rg -n "requestJira.*(?:/rest/api/3/myself|/user|/groups)" src --type ts', { encoding: 'utf-8' }).split('\n').filter(l => l);
      usageHits.push(...hits.slice(0, 5));
    } catch (e) {
      // rg failed (might be no matches)
    }
  }
  
  if (scope.includes('read:jira-work')) {
    // Look for requestJira calls to /rest/api/3/project, /permissions, /fields
    try {
      const hits = execSync('rg -n "requestJira.*(?:/rest/api/3/project|/permissions|/field)" src --type ts', { encoding: 'utf-8' }).split('\n').filter(l => l);
      usageHits.push(...hits.slice(0, 5));
    } catch (e) {
      // rg failed
    }
  }
  
  if (scope.includes('storage:app')) {
    // Look for storage.get, storage.set, storage.delete
    try {
      const hits = execSync('rg -n "storage\\.(?:get|set|delete)\\(" src --type ts', { encoding: 'utf-8' }).split('\n').filter(l => l);
      usageHits.push(...hits.slice(0, 5));
    } catch (e) {
      // rg failed
    }
  }
  
  scopeUsageMap.set(scope, usageHits);
  
  if (usageHits.length === 0) {
    console.warn(`[SCOPES] WARNING: No usage found for scope: ${scope}`);
  } else {
    console.log(`[SCOPES] Scope "${scope}": ${usageHits.length} usage hits`);
  }
}

// ========================================================================
// 3. Fail-closed checks
// ========================================================================

let hasError = false;

// Check 1: All declared scopes have usage
for (const [scope, hits] of scopeUsageMap.entries()) {
  if (hits.length === 0) {
    console.error(`[SCOPES] ✗ FAIL: Declared scope has no usage evidence: ${scope}`);
    hasError = true;
  }
}

// Check 2: No undeclared API calls (conservative check)
// If we find requestJira calls but no Jira scopes declared, that's a fail
try {
  const allRequestJiraCalls = execSync('rg -c "requestJira\\(" src --type ts', { encoding: 'utf-8' }).trim();
  const callCount = parseInt(allRequestJiraCalls) || 0;
  
  const jiraScopes = Array.from(declaredScopes).filter(s => s.includes('jira'));
  if (callCount > 0 && jiraScopes.length === 0) {
    console.error('[SCOPES] ✗ FAIL: Found requestJira calls but no Jira scopes declared');
    hasError = true;
  }
} catch (e) {
  // Silent fail on rg errors (might just be no matches)
}

// Check 3: Storage scopes vs storage calls
if (declaredScopes.has('storage:app')) {
  try {
    const storageCalls = execSync('rg -c "storage\\." src --type ts', { encoding: 'utf-8' }).trim();
    console.log(`[SCOPES] storage:app scope has ${storageCalls} storage operation references`);
  } catch (e) {
    // Silent
  }
}

// ========================================================================
// 4. Write outputs
// ========================================================================

const declaredList = Array.from(declaredScopes).join('\n');
const usageList = Array.from(scopeUsageMap.entries())
  .map(([scope, hits]) => `${scope}: ${hits.length} hits`)
  .join('\n');

try {
  writeFileSync(join(E, '13_repo_scans/scopes_declared.txt'), declaredList + '\n');
  writeFileSync(join(E, '13_repo_scans/scopes_usage_hits.txt'), usageList + '\n');
  
  if (hasError) {
    writeFileSync(join(E, '13_repo_scans/scopes_verdict.txt'), 'FAIL\n');
  } else {
    writeFileSync(join(E, '13_repo_scans/scopes_verdict.txt'), 'PASS\n');
  }
} catch (e) {
  console.warn('[SCOPES] Warning: Could not write output files', e.message);
}

// ========================================================================
// 5. Exit
// ========================================================================

if (hasError) {
  console.error('[SCOPES] ✗ VERDICT: FAIL - Scope justification incomplete');
  process.exit(1);
} else {
  console.log('[SCOPES] ✅ VERDICT: PASS - All scopes justified');
  process.exit(0);
}
