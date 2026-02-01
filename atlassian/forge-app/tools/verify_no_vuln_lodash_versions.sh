#!/usr/bin/env bash
set -euo pipefail

# Deterministic lodash version gate: full dependency tree scan
# Scans ENTIRE resolved npm dependency tree for vulnerable lodash versions.
# Fails CLOSED: any version != 4.17.23 = FAIL. Missing lodash = FAIL.
#
# Context:
# - Forge app depends on @forge/i18n@0.0.7 → lodash ^4.17.21
# - CVE: lodash 4.0.0-4.17.22 have known vulnerabilities
# - Fix: npm override to 4.17.23 (patched version)
# - Design: Scan entire dependency tree deterministically (npm ls + Node JSON parse)
#
# Method:
# 1. Use npm ls lodash --all --json to get clean JSON of resolved tree
# 2. Parse with Node.js to extract ALL lodash versions recursively
# 3. Verify only 4.17.23 is present (exact match, fail-closed)
# 4. Output deterministic markers [LODASH_GATE] for audit trail
#
# Why npm ls + JSON parse (not grep on lockfile)?
# - npm has already resolved and deduplicated dependencies
# - Clean JSON format without circular references
# - Handles npm v7+ with locked/deduped markers correctly
# - No edge cases with package-lock.json v2/v3 format variance

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Collect all lodash versions from npm ls output
npm ls lodash --all --json 2>/dev/null | node -e "
const fs = require('fs');
const input = fs.readFileSync(0, 'utf8');

// Parse npm ls JSON output
let data;
try {
  data = JSON.parse(input);
} catch (e) {
  console.log('[LODASH_GATE] FAIL: invalid JSON from npm ls output');
  process.exit(1);
}

// Recursively collect all lodash versions from npm tree
function collectVersions(obj, versions = new Set()) {
  if (!obj || typeof obj !== 'object') return versions;
  
  // npm ls format: each dependency has name and version
  // Root object may not have 'name', so check for lodash explicitly first
  if (obj.name === 'lodash' && obj.version && typeof obj.version === 'string') {
    versions.add(obj.version);
  }
  
  // Recurse into dependencies (npm ls structure)
  if (obj.dependencies && typeof obj.dependencies === 'object') {
    for (const [key, dep] of Object.entries(obj.dependencies)) {
      // Check if this dependency object is lodash
      if (dep && typeof dep === 'object') {
        if (dep.version && typeof dep.version === 'string' && key === 'lodash') {
          versions.add(dep.version);
        }
        // Recurse deeper
        collectVersions(dep, versions);
      }
    }
  }
  
  return versions;
}

const versions = collectVersions(data);
const versionArray = Array.from(versions).sort();

console.log('[LODASH_GATE] FOUND_VERSIONS=' + JSON.stringify(versionArray));

// Fail-closed: no lodash found anywhere (fail if missing)
if (versionArray.length === 0) {
  console.log('[LODASH_GATE] FAIL: no lodash found in resolved dependency tree (fail-closed)');
  process.exit(1);
}

// Fail: any version is not exactly 4.17.23
if (!versionArray.every(v => v === '4.17.23')) {
  const bad = versionArray.filter(v => v !== '4.17.23');
  console.log('[LODASH_GATE] FAIL: found non-4.17.23 lodash: ' + bad.join(', '));
  process.exit(1);
}

// Pass: all versions are exactly 4.17.23
console.log('[LODASH_GATE] PASS: all lodash versions resolved to exactly 4.17.23 (safe)');
console.log('[LODASH_GATE] PASS: ' + versionArray.length + ' distinct version(s), all patched');
process.exit(0);
" || exit 1
