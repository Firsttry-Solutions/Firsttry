#!/bin/bash
# Minimal freeze lock verifier
# Checks that FREEZE_LOCK.json exists and is valid JSON

FREEZE_LOCK="$(dirname "$0")/marketplace_submission/FREEZE_LOCK.json"

if [[ ! -f "$FREEZE_LOCK" ]]; then
    echo "FAIL: Freeze lock file not found at $FREEZE_LOCK"
    exit 1
fi

# Validate JSON
if ! jq empty "$FREEZE_LOCK" 2>/dev/null; then
    echo "FAIL: Freeze lock file is not valid JSON"
    exit 1
fi

echo "✓ Freeze lock verified"
exit 0
