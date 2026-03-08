#!/bin/bash
# Generate FREEZE_LOCK.json with real deterministic content hash
# Uses the FROZEN_CONTENT_SHA algorithm: 
#   1. List all git-tracked files under atlassian/forge-app/
#   2. Exclude specific patterns (proof_runs, node_modules, dist, etc.)
#   3. Sort lexicographically
#   4. Compute sha256 for each file
#   5. Create manifest and hash the manifest

set -euo pipefail

AUDIT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$AUDIT_DIR/../.." && pwd)"
FORGE_APP_ROOT="$REPO_ROOT/FirstTry---Audit-Evidence-for-Jira"
FREEZE_LOCK_PATH="$AUDIT_DIR/marketplace_submission/FREEZE_LOCK.json"

cd "$REPO_ROOT"

# Step 1: Get all git-tracked files under atlassian/forge-app/
# Use git ls-files which returns committed files
ALL_FILES=$(git ls-files "FirstTry---Audit-Evidence-for-Jira" 2>/dev/null || echo "")

# Step 2: Filter out excluded patterns
# Exclusion patterns:
#   - audit/proof_runs/ (excluded runs)
#   - audit/OV_RESULTS/ (operator verification results)
#   - audit/shakedown/ (shakedown test outputs)
#   - audit/verification_reports/ (verification reports)
#   - audit/out_runs/ (operator output runs)
#   - audit/**/OUT/ (output directories)
#   - audit/state_assessment/run_*/ (timestamped assessment runs)
#   - audit/*/FREEZE_LOCK.json (the freeze lock file itself - circular dependency)
#   - node_modules/ (dependencies)
#   - dist/ (build artifacts)

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

# Step 5: Hash the manifest to get FROZEN_CONTENT_SHA
FROZEN_CONTENT_SHA=$(sha256sum "$MANIFEST" | awk '{print $1}')

# Get current git HEAD
COMMIT_SHA=$(git rev-parse HEAD)

# Current UTC timestamp
FROZEN_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Create FREEZE_LOCK.json
cat > "$FREEZE_LOCK_PATH" << EOF
{
  "commitSha": "$COMMIT_SHA",
  "frozenContentSha": "$FROZEN_CONTENT_SHA",
  "method": "git-tracked-files+sha256-manifest",
  "frozenAt": "$FROZEN_AT"
}
EOF

echo "FREEZE_GENERATED $FROZEN_CONTENT_SHA"
exit 0
