#!/bin/bash
# Verify FREEZE_LOCK.json by recomputing the deterministic content hash
# Uses the FROZEN_CONTENT_SHA algorithm
#
# CRITICAL FIX: Payload commit is passed via PHASE5_PAYLOAD_COMMIT environment variable
# (set by proof_run_authenticated.sh Phase 5)
# This makes verification non-brittle to extra commits after payload creation.

set -euo pipefail
export LC_ALL=C
export LANG=C

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
AUDIT_DIR="$(dirname "$0")"
FREEZE_LOCK_PATH="$AUDIT_DIR/marketplace_submission/FREEZE_LOCK.json"

# ============================================================================
# Single Source of Truth: Payload commit
# ============================================================================
# This comes from Phase 1 (stored in PAYLOAD_COMMIT.txt in run folder)
# and is passed via PHASE5_PAYLOAD_COMMIT environment variable.
# If not set (e.g., running verify_freeze_lock.sh standalone), use current HEAD.
EXPECTED_PAYLOAD_COMMIT="${PHASE5_PAYLOAD_COMMIT:-}"
PROOF_DIR="${PHASE5_PROOF_DIR:-}"

if [[ -z "$EXPECTED_PAYLOAD_COMMIT" && -n "$PROOF_DIR" ]]; then
    # Try to read from proof folder
    if [[ -f "$PROOF_DIR/PAYLOAD_COMMIT.txt" ]]; then
        EXPECTED_PAYLOAD_COMMIT=$(cat "$PROOF_DIR/PAYLOAD_COMMIT.txt")
    fi
fi

if [[ -z "$EXPECTED_PAYLOAD_COMMIT" ]]; then
    # Fallback: use current HEAD (standalone mode, not ideal but safe)
    EXPECTED_PAYLOAD_COMMIT=$(cd "$REPO_ROOT" && git rev-parse HEAD)
fi

CURRENT_HEAD=$(cd "$REPO_ROOT" && git rev-parse HEAD)

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

# Read the locked commit
LOCKED_COMMIT=$(jq -r '.commitSha' "$FREEZE_LOCK_PATH" 2>/dev/null || echo "")
if [[ -z "$LOCKED_COMMIT" ]]; then
    echo "FAIL: FREEZE_COMMIT_MISSING"
    exit 1
fi

# ============================================================================
# CRITICAL VALIDATION: Payload commit must match
# ============================================================================
# The payload commit is the exact commit the freeze was locked against.
# It should NOT change between when the run started and when Phase 5 validates.
if [[ "$LOCKED_COMMIT" != "$EXPECTED_PAYLOAD_COMMIT" ]]; then
    echo "FAIL: FREEZE_COMMIT_MISMATCH"
    echo "  EXPECTED_PAYLOAD_COMMIT: $EXPECTED_PAYLOAD_COMMIT"
    echo "  LOCKED_COMMIT_IN_FREEZE: $LOCKED_COMMIT"
    echo "  CURRENT_HEAD:            $CURRENT_HEAD"
    echo ""
    echo "REMEDIATION:"
    echo "  This means the freeze was locked for a different commit than expected."
    echo "  Re-run: npm run proof:auth"
    exit 1
fi

# Enforce algorithm immutability
LOCKED_METHOD=$(jq -r '.method' "$FREEZE_LOCK_PATH" 2>/dev/null || echo "")
if [[ "$LOCKED_METHOD" != "git-tracked-files+sha256-manifest" ]]; then
    echo "FAIL: FREEZE_METHOD_MISMATCH"
    echo "  Expected: git-tracked-files+sha256-manifest"
    echo "  Got:      $LOCKED_METHOD"
    exit 1
fi

cd "$REPO_ROOT"

# Step 1: Get all git-tracked files under atlassian/forge-app/
ALL_FILES=$(git ls-files "atlassian/forge-app" 2>/dev/null || echo "")

# Step 2: Filter out excluded patterns
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

# Step 5: Hash the manifest to get current FROZEN_CONTENT_SHA
CURRENT_SHA=$(sha256sum "$MANIFEST" | awk '{print $1}')

# Emit machine-readable proof output
echo "COMPUTED_FROZEN_SHA=$CURRENT_SHA"
echo "LOCKED_FROZEN_SHA=$LOCKED_SHA"
echo "EXPECTED_PAYLOAD_COMMIT=$EXPECTED_PAYLOAD_COMMIT"
echo "LOCKED_COMMIT=$LOCKED_COMMIT"

# Compare frozen content
if [[ "$CURRENT_SHA" == "$LOCKED_SHA" ]]; then
    echo "✓ Freeze lock matches"
    exit 0
else
    echo "FAIL: FREEZE_VERIFY_FAIL"
    echo "  Expected SHA: $LOCKED_SHA"
    echo "  Got SHA:      $CURRENT_SHA"
    echo ""
    echo "REMEDIATION:"
    echo "  The frozen content does not match the lock."
    echo "  Run: ./audit/generate_freeze_lock.sh && ./audit/verify_freeze_lock.sh"
    exit 1
fi
