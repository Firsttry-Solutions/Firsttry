#!/bin/bash
set -euo pipefail

# Guard No New Outbound
# Fail-closed: rejects any new outbound patterns introduced in diff
# CI-safe: git-based diff, no baseline file dependency

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

# Determine baseline
if git rev-parse origin/main >/dev/null 2>&1; then
  BASE="$(git merge-base origin/main HEAD)"
else
  BASE="HEAD~1"
fi

echo "[INFO] Baseline: $BASE"

OUTBOUND_PATTERNS='(fetch\(|axios|node-fetch|request\b|undici|https\.|http\.|net\.|tls\.|WebSocket|XMLHttpRequest|invokeRemote)'

# Check for new outbound patterns in src
echo "[INFO] Checking for new outbound patterns in src..."
if git diff "$BASE"...HEAD -- atlassian/forge-app/src | grep '^+' | grep -vE '^\+\+\+' | grep -E "$OUTBOUND_PATTERNS"; then
  echo "[FAIL] New outbound pattern introduced"
  exit 1
fi

# Check for new external.fetch in manifest
echo "[INFO] Checking manifest for new external permissions..."
if git diff "$BASE"...HEAD -- atlassian/forge-app/manifest.yml | grep '^+' | grep 'permissions\.external\.fetch'; then
  echo "[FAIL] New external permission introduced"
  exit 1
fi

echo "[PASS] No new outbound patterns detected"
echo "[FT_OUTBOUND_REGRESSION_PASS]"
