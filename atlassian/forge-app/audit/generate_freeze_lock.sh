#!/bin/bash
# Generate FREEZE_LOCK.json using exact deterministic algorithm
# This is the ONLY authorized way to create or update FREEZE_LOCK.json

set -euo pipefail
export LC_ALL=C
export LANG=C

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
AUDIT_DIR="$SCRIPT_DIR"
FREEZE_LOCK_PATH="$AUDIT_DIR/marketplace_submission/FREEZE_LOCK.json"

# Get current HEAD commit
CURRENT_COMMIT=$(cd "$REPO_ROOT" && git rev-parse HEAD)

# Get current UTC ISO-8601 timestamp
FROZEN_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

cd "$REPO_ROOT"

# Step 1: Get all git-tracked files under atlassian/forge-app/
ALL_FILES=$(git ls-files "atlassian/forge-app" 2>/dev/null || echo "")

# Step 2: Filter out excluded patterns (MUST MATCH verify_freeze_lock.sh exactly)
FILTERED_FILES=$(echo "$ALL_FILES" | grep -v -E "(audit/proof_runs|OV_RESULTS|SHK_REPORT|audit/verification_reports|audit/out_runs|audit/.*OUT|audit/state_assessment/run_|FREEZE_LOCK\.json|node_modules/|dist/)" || true)

# Step 3: Sort lexicographically with locale stability
SORTED_FILES=$(echo "$FILTERED_FILES" | LC_ALL=C sort)

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
done | LC_ALL=C sort > "$MANIFEST"

# Step 5: Hash the manifest to get FROZEN_CONTENT_SHA
FROZEN_SHA=$(sha256sum "$MANIFEST" | awk '{print $1}')

# Create JSON output atomically
TEMP_LOCK=$(mktemp)
trap "rm -f $MANIFEST $TEMP_LOCK" EXIT

cat > "$TEMP_LOCK" << EOF
{
  "commitSha": "$CURRENT_COMMIT",
  "frozenContentSha": "$FROZEN_SHA",
  "method": "git-tracked-files+sha256-manifest",
  "frozenAt": "$FROZEN_AT"
}
EOF

# Atomically move to target
mkdir -p "$(dirname "$FREEZE_LOCK_PATH")"
mv "$TEMP_LOCK" "$FREEZE_LOCK_PATH"

echo "Generated: $FREEZE_LOCK_PATH"
echo "  commitSha: $CURRENT_COMMIT"
echo "  frozenContentSha: $FROZEN_SHA"
echo "  frozenAt: $FROZEN_AT"
