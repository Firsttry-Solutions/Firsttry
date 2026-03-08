#!/bin/bash
# Generate FREEZE_LOCK.json with real deterministic content hash
# Uses the FROZEN_CONTENT_SHA algorithm matching verify_freeze_lock.sh: 
#   1. Get all git-tracked files from git tree (deterministic snapshot)
#   2. Exclude specific patterns (proof_runs, node_modules, dist, etc.)
#   3. Sort lexicographically
#   4. Compute sha256 for each file from git snapshot
#   5. Create manifest and hash the manifest

set -euo pipefail
export LC_ALL=C
export LANG=C

AUDIT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$AUDIT_DIR/../.." && pwd)"
FREEZE_LOCK_PATH="$AUDIT_DIR/marketplace_submission/FREEZE_LOCK.json"

cd "$REPO_ROOT"

# Get current git HEAD (the commit to freeze)
SNAPSHOT_COMMIT=$(git rev-parse HEAD)

# Step 1: Get all git-tracked files from git tree snapshot
ALL_FILES=$(git ls-tree -r --name-only "${SNAPSHOT_COMMIT}" -- FirstTry---Audit-Evidence-for-Jira/ 2>/dev/null || echo "")

# Step 2: Filter out excluded patterns (matching verify_freeze_lock.sh)
FILTERED_FILES=$(echo "$ALL_FILES" | grep -v -E "(audit/proof_runs|OV_RESULTS|SHK_REPORT|audit/verification_reports|audit/out_runs|audit/.*OUT|audit/state_assessment/run_|audit/marketplace_submission/FREEZE_LOCK\.json|node_modules/|dist/)" || true)

# Step 3: Sort lexicographically with locale stability
SORTED_FILES=$(echo "$FILTERED_FILES" | LC_ALL=C sort)

# Step 4: Build canonical manifest with sha256 for each file (from git snapshot)
MANIFEST=$(mktemp)
trap "rm -f $MANIFEST" EXIT

echo "$SORTED_FILES" | while read -r file; do
    if [[ -z "$file" ]]; then
        continue
    fi
    # Pipe git show through sha256sum (binary-safe, matching verify algorithm)
    git show "${SNAPSHOT_COMMIT}:${file}" 2>/dev/null | sha256sum | awk -v f="$file" '{print $1 "  " f}'
done | LC_ALL=C sort > "$MANIFEST"

# Step 5: Hash the manifest to get FROZEN_CONTENT_SHA
FROZEN_CONTENT_SHA=$(sha256sum "$MANIFEST" | awk '{print $1}')

# Current UTC timestamp
FROZEN_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Create FREEZE_LOCK.json with commitSha pointing to the frozen commit
cat > "$FREEZE_LOCK_PATH" << EOF
{
  "commitSha": "$SNAPSHOT_COMMIT",
  "frozenContentSha": "$FROZEN_CONTENT_SHA",
  "method": "git-tracked-files+sha256-manifest",
  "frozenAt": "$FROZEN_AT"
}
EOF

echo "FREEZE_GENERATED $FROZEN_CONTENT_SHA"
exit 0
