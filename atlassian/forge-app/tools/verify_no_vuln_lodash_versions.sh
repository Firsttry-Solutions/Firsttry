#!/usr/bin/env bash
set -euo pipefail

# Hybrid lodash gate: lockfile authoritative + npm ls sanity
# 
# Purpose: Ensure all lodash in dependency tree is ONLY 4.17.23 (no CVE versions 4.17.21/22)
#
# Design (fail-closed, deterministic, offline):
# 1. PRIMARY: Parse package-lock.json (authoritative, works from repo state)
#    - Recursively extract ALL lodash versions anywhere in lockfile
#    - FAIL if missing, empty, or any version != 4.17.23
# 2. SECONDARY: If node_modules exists, sanity check npm ls (runtime reality)
#    - Parse npm ls --all --json output
#    - Verify installed versions also 4.17.23 only
#    - FAIL if npm ls fails or non-4.17.23 found
#    - SKIP if node_modules absent (lockfile already authoritative)
#
# No network calls, no npm audit, deterministic markers for audit trail.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCKFILE="${FT_LOCKFILE_PATH:-$ROOT/package-lock.json}"

# ============================================================================
# PART A: LOCKFILE SCAN (authoritative)
# ============================================================================

if [[ ! -f "$LOCKFILE" ]]; then
  echo "[LODASH_GATE] FAIL: missing package-lock.json at $LOCKFILE"
  exit 1
fi

# Parse lockfile and extract ALL lodash versions
LOCKFILE_VERSIONS=$(node -e "
const fs = require('fs');
try {
  const lock = JSON.parse(fs.readFileSync('$LOCKFILE', 'utf8'));
  const versions = new Set();
  
  // Helper to recursively collect lodash versions from any object
  function collectLodash(obj, depth = 0) {
    if (!obj || typeof obj !== 'object' || depth > 50) return;
    
    // Format 1: packages[\"node_modules/lodash\"] = { version: \"X.Y.Z\" }
    if (obj.version && typeof obj.version === 'string') {
      // Check if this looks like a lodash package
      // If obj has a name field, check it. If in packages section, already keyed by path
      if (obj.name === 'lodash' || (typeof obj === 'object' && obj.resolved && obj.resolved.includes('/lodash-'))) {
        versions.add(obj.version);
      }
    }
    
    // Recurse into nested objects (dependencies, packages, etc)
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (typeof val === 'object' && val !== null) {
        // Special case: if key is 'lodash' or path ends with 'lodash', and has version
        if ((key === 'lodash' || key.endsWith('/lodash')) && val.version) {
          versions.add(val.version);
        } else {
          // Recurse
          collectLodash(val, depth + 1);
        }
      }
    }
  }
  
  collectLodash(lock);
  
  const arr = Array.from(versions).sort();
  console.log(JSON.stringify(arr));
} catch (err) {
  console.error('ERROR parsing lockfile:', err.message);
  process.exit(1);
}
")

echo "[LODASH_GATE] LOCKFILE_VERSIONS=$LOCKFILE_VERSIONS"

# Verify lockfile has versions
LOCKFILE_COUNT=$(echo "$LOCKFILE_VERSIONS" | node -e "const a = JSON.parse(require('fs').readFileSync(0, 'utf-8')); console.log(a.length)")
if [[ "$LOCKFILE_COUNT" -eq 0 ]]; then
  echo "[LODASH_GATE] FAIL: no lodash versions found in lockfile (lockfile may be corrupted)"
  exit 1
fi

# Verify all lockfile versions are exactly 4.17.23
echo "$LOCKFILE_VERSIONS" | node -e "
const arr = JSON.parse(require('fs').readFileSync(0, 'utf-8'));
const bad = arr.filter(v => v !== '4.17.23');
if (bad.length > 0) {
  console.log('[LODASH_GATE] FAIL: lockfile contains non-4.17.23 lodash: ' + bad.join(', '));
  process.exit(1);
}
console.log('[LODASH_GATE] PASS: lockfile scan verified, all versions are 4.17.23');
" || exit 1

# ============================================================================
# PART B: INSTALLED TREE SANITY (secondary, if node_modules exists)
# ============================================================================

if [[ ! -d "$ROOT/node_modules" ]]; then
  echo "[LODASH_GATE] SKIP: npm ls sanity check (no node_modules directory)"
  exit 0
fi

# node_modules exists, run sanity check
INSTALLED_VERSIONS=$(npm ls lodash --all --json 2>/dev/null | node -e "
const fs = require('fs');
const input = fs.readFileSync(0, 'utf-8');
try {
  const data = JSON.parse(input);
  const versions = new Set();
  
  // Traverse npm ls output recursively
  function collectVersions(obj) {
    if (!obj || typeof obj !== 'object') return;
    
    // npm ls format: dependencies keyed by name
    if (obj.dependencies) {
      for (const [key, dep] of Object.entries(obj.dependencies)) {
        if (key === 'lodash' && dep.version && typeof dep.version === 'string') {
          versions.add(dep.version);
        }
        // Recurse
        collectVersions(dep);
      }
    }
  }
  
  collectVersions(data);
  
  const arr = Array.from(versions).sort();
  console.log(JSON.stringify(arr));
} catch (err) {
  console.log(JSON.stringify({ error: 'parse error: ' + err.message }));
  process.exit(1);
}
" || echo '{"error":"npm ls failed"}')

echo "[LODASH_GATE] INSTALLED_VERSIONS=$INSTALLED_VERSIONS"

# Check for errors in installed versions parse
if echo "$INSTALLED_VERSIONS" | grep -q '"error"'; then
  ERROR_MSG=$(echo "$INSTALLED_VERSIONS" | node -e "const o = JSON.parse(require('fs').readFileSync(0, 'utf-8')); console.log(o.error)")
  echo "[LODASH_GATE] FAIL: npm ls sanity check failed: $ERROR_MSG"
  exit 1
fi

# Verify installed versions
echo "$INSTALLED_VERSIONS" | node -e "
const arr = JSON.parse(require('fs').readFileSync(0, 'utf-8'));

if (arr.length === 0) {
  console.log('[LODASH_GATE] FAIL: npm ls found no lodash in installed tree');
  process.exit(1);
}

const bad = arr.filter(v => v !== '4.17.23');
if (bad.length > 0) {
  console.log('[LODASH_GATE] FAIL: npm ls found non-4.17.23 lodash: ' + bad.join(', '));
  process.exit(1);
}

console.log('[LODASH_GATE] PASS: installed tree sanity verified, all versions are 4.17.23');
" || exit 1

echo "[LODASH_GATE] PASS: hybrid gate complete (lockfile + installed tree both verified to be 4.17.23 only)"
exit 0
