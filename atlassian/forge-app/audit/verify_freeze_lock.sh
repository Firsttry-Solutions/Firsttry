#!/bin/bash
# Verify FREEZE_LOCK.json by recomputing the deterministic content hash
# Uses the FROZEN_CONTENT_SHA algorithm

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
AUDIT_DIR="$(dirname "$0")"
FREEZE_LOCK_PATH="$AUDIT_DIR/marketplace_submission/FREEZE_LOCK.json"

# Check if FREEZE_LOCK exists
if [[ ! -f "$FREEZE_LOCK_PATH" ]]; then
    echo "FAIL: FREEZE_LOCK_MISSING"
    exit 1
fi

# Read the locked frozenContentSha
LOCKED_SHA=$(jq -r '.frozenContentSha' "$FREEZE_LOCK_PATH" 2>/dev/null || echo "")
if [[ -z "$LOCKED_SHA" ]]; then
    echo "FAIL: frozenContentSha not found in FREEZE_LOCK.json"
    exit 1
fi

cd "$REPO_ROOT"

# Step 1: Get all git-tracked files under atlassian/forge-app/
ALL_FILES=$(git ls-files "atlassian/forge-app" 2>/dev/null || echo "")

# Step 2: Filter out excluded patterns
FILTERED_FILES=$(echo "$ALL_FILES" | grep -v -E "(audit/proof_runs|OV_RESULTS|SHK_REPORT|audit/verification_reports|audit/out_runs|audit/.*OUT|audit/state_assessment/run_|FREEZE_LOCK\.json|node_modules/|dist/)" || true)

# Step 3: Sort lexicographically
SORTED_FILES=$(echo "$FILTERED_FILES" | sort)

# Step 4: Build canonical manifest with sha256 for each file
MANIFEST=$(mktemp)
trap "rm -f $MANIFEST" EXIT

echo "$SORTED_FILES" | while read -r file; do
    if [[ -z "$file" ]]; then
        continue
    fi
    if [[ -f "$REPO_ROOT/$file" ]]; then
        file_sha=$(sha256sum "$REPO_ROOT/$file" | awk '{print $1}')
        echo "$file_sha  $file"
    fi
done | sort > "$MANIFEST"

# Step 5: Hash the manifest to get current FROZEN_CONTENT_SHA
CURRENT_SHA=$(sha256sum "$MANIFEST" | awk '{print $1}')

# Compare
if [[ "$CURRENT_SHA" == "$LOCKED_SHA" ]]; then
    echo "✓ Freeze lock matches"
    exit 0
else
    echo "FAIL: FREEZE_VERIFY_FAIL"
    echo "  Expected: $LOCKED_SHA"
    echo "  Got:      $CURRENT_SHA"
    exit 1
fi
