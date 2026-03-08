#!/bin/bash
#
# verify_no_webtriggers_in_manifest.sh
#
# REGRESSION GATE: Ensure manifest.yml does NOT contain modules.webtrigger
#
# Purpose: Prevent accidental re-introduction of webtriggers, which breaks
# Runs on Atlassian eligibility.
#
# Exit codes:
#   0 = PASS: No webtrigger module found
#   1 = FAIL: Webtrigger module detected

set -e

MANIFEST_FILE="manifest.yml"

if [ ! -f "$MANIFEST_FILE" ]; then
  echo "[FAIL] manifest.yml not found"
  exit 1
fi

# Check for webtrigger module
if grep -q "^\s*webtrigger\s*:" "$MANIFEST_FILE"; then
  echo "[FORBIDDEN] modules.webtrigger detected in manifest.yml"
  grep -n "webtrigger:" "$MANIFEST_FILE"
  exit 1
fi

# Also check for function handlers that reference webtriggers (if accidentally readded)
if grep -q "webtriggers/runtime_proof\|webtriggers/contract-proof" "$MANIFEST_FILE"; then
  echo "[FORBIDDEN] Webtrigger handler references detected in manifest.yml"
  grep -n "webtriggers/runtime_proof\|webtriggers/contract-proof" "$MANIFEST_FILE"
  exit 1
fi

echo "✓ PASS: No webtrigger module found. ROA eligibility verified."
exit 0
