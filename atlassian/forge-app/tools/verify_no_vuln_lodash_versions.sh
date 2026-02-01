#!/usr/bin/env bash
set -euo pipefail

# Deterministic lockfile gate: verify no vulnerable lodash versions (4.17.21, 4.17.22)
# This gate operates OFFLINE on package-lock.json (no network calls, no npm audit).
# Fails CLOSED: any vulnerable version found = FAIL (exit 1).
#
# Context:
# - Forge app depends on @forge/i18n@0.0.7 → lodash ^4.17.21
# - CVE: lodash 4.0.0-4.17.22 have known vulnerabilities
# - Fix: npm override to 4.17.23 (patched version)
# - Goal: Ensure package-lock.json contains only safe version (4.17.23)

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCK="$ROOT/package-lock.json"

# Fail CLOSED: missing lockfile = FAIL
if [[ ! -f "$LOCK" ]]; then
  echo "[LODASH_GATE] FAIL: missing package-lock.json at $LOCK"
  exit 1
fi

# Search for VULNERABLE lodash versions in lockfile (4.17.21, 4.17.22)
# Pattern: look for "version" within 2 lines of lodash entry
VULN_COUNT=$(grep -A2 '"node_modules/lodash":' "$LOCK" | grep -c '"version".*"4\.17\.(21|22)"' || true)
if [[ $VULN_COUNT -gt 0 ]]; then
  echo "[LODASH_GATE] FAIL: vulnerable lodash version detected in package-lock.json"
  echo "[LODASH_GATE] Found 4.17.21 or 4.17.22 (CVE-vulnerable versions)"
  echo "[LODASH_GATE] Expected: 4.17.23 (patched version)"
  exit 1
fi

# Verify safe version (4.17.23) exists
SAFE_COUNT=$(grep -A2 '"node_modules/lodash":' "$LOCK" | grep -c '"version".*"4\.17\.23"' || true)
if [[ $SAFE_COUNT -eq 0 ]]; then
  echo "[LODASH_GATE] FAIL: expected safe lodash version (4.17.23) not found in package-lock.json"
  exit 1
fi

echo "[LODASH_GATE] PASS: verified no vulnerable lodash versions (4.17.21/4.17.22) in lockfile"
echo "[LODASH_GATE] PASS: safe version 4.17.23 confirmed in package-lock.json"
exit 0
