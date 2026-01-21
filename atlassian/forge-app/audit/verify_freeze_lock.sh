#!/bin/bash
# Verify FREEZE_LOCK.json by recomputing the deterministic content hash
# Uses the FROZEN_CONTENT_SHA algorithm
#
# PROOF MODE: During proof:auth runs, uses PHASE5_FREEZE_LOCK_MODE="proof" or lock path inside audit/proof_runs/
#             Requires commitSha only, frozenContentSha optional
# RELEASE MODE: For marketplace submissions, requires BOTH commitSha and frozenContentSha
#               Fails HARD if frozenContentSha missing

set -euo pipefail
export LC_ALL=C
export LANG=C

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
AUDIT_DIR="$(dirname "$0")"

# ============================================================================
# Determine mode: proof (run-scoped) or release (repo lock)
# ============================================================================
MODE="${PHASE5_FREEZE_LOCK_MODE:-release}"
LOCK_PATH="${PHASE5_FREEZE_LOCK_PATH:-${1:-$AUDIT_DIR/marketplace_submission/FREEZE_LOCK.json}}"
PAYLOAD="${PHASE5_PAYLOAD_COMMIT:-$(cd "$REPO_ROOT" && git rev-parse HEAD)}"

# Auto-detect proof mode if lock is inside audit/proof_runs/
if [[ "$LOCK_PATH" == *"audit/proof_runs/"* ]]; then
    MODE="proof"
fi

# ============================================================================
# Print evidence of mode and settings
# ============================================================================
echo "[FREEZE_VERIFY] mode=$MODE"
echo "[FREEZE_VERIFY] lock_path=$LOCK_PATH"
echo "[FREEZE_VERIFY] payload_commit=$PAYLOAD"

# Check if FREEZE_LOCK exists
if [[ ! -f "$LOCK_PATH" ]]; then
    echo "[FREEZE_VERIFY] FAIL: FREEZE_LOCK_MISSING at $LOCK_PATH"
    exit 1
fi

# ============================================================================
# Read lock file
# ============================================================================
LOCKED_COMMIT=$(jq -r '.commitSha' "$LOCK_PATH" 2>/dev/null || echo "")
LOCKED_SHA=$(jq -r '.frozenContentSha' "$LOCK_PATH" 2>/dev/null || echo "")

# Normalize "null" string from jq to empty string
[[ "$LOCKED_SHA" == "null" ]] && LOCKED_SHA=""

# ============================================================================
# MODE-SPECIFIC LOGIC
# ============================================================================

if [[ "$MODE" == "proof" ]]; then
    # PROOF MODE: Require commitSha, frozenContentSha is optional
    echo "[FREEZE_VERIFY] checking_frozenContentSha=no"
    
    # Validate commitSha exists
    if [[ -z "$LOCKED_COMMIT" ]]; then
        echo "[FREEZE_VERIFY] FAIL: commitSha missing in run-scoped lock"
        exit 1
    fi
    
    # Validate commitSha matches payload
    if [[ "$LOCKED_COMMIT" != "$PAYLOAD" ]]; then
        echo "[FREEZE_VERIFY] FAIL: commitSha mismatch"
        echo "  Expected: $PAYLOAD"
        echo "  Got:      $LOCKED_COMMIT"
        exit 1
    fi
    
    # Proof mode: Success on commitSha match
    echo "[FREEZE_VERIFY] OK: proof mode - commitSha validated"
    exit 0

else
    # RELEASE MODE: Require BOTH commitSha and frozenContentSha
    echo "[FREEZE_VERIFY] checking_frozenContentSha=yes"
    
    # HARD FAIL if frozenContentSha is missing in release mode
    if [[ -z "$LOCKED_SHA" ]]; then
        echo "[FREEZE_VERIFY] FAIL: frozenContentSha MISSING (release mode requires it)"
        echo "  lock_path: $LOCK_PATH"
        echo "  REMEDIATION: Run 'npm run release:freeze-lock' to generate a proper release lock"
        exit 1
    fi
    
    # Validate commitSha exists
    if [[ -z "$LOCKED_COMMIT" ]]; then
        echo "[FREEZE_VERIFY] FAIL: commitSha missing in release lock"
        exit 1
    fi
    
    # Validate commitSha matches payload
    if [[ "$LOCKED_COMMIT" != "$PAYLOAD" ]]; then
        echo "[FREEZE_VERIFY] FAIL: commitSha mismatch"
        echo "  Expected: $PAYLOAD"
        echo "  Got:      $LOCKED_COMMIT"
        exit 1
    fi
    
    # RELEASE MODE: Compute FROZEN_CONTENT_SHA from git snapshot (NOT working tree)
    # Use LOCKED_COMMIT (or PAYLOAD if provided) to get deterministic snapshot
    SNAPSHOT_COMMIT="${PAYLOAD}"
    echo "[FREEZE_VERIFY] Computing hash from git snapshot at ${SNAPSHOT_COMMIT}..."
    
    cd "$REPO_ROOT"

    # Step 1: Get all git-tracked files under atlassian/forge-app/ from git tree
    ALL_FILES=$(git ls-tree -r --name-only "${SNAPSHOT_COMMIT}" -- atlassian/forge-app/ 2>/dev/null || echo "")

    # Step 2: Filter out excluded patterns (including FREEZE_LOCK.json to avoid circularity)
    FILTERED_FILES=$(echo "$ALL_FILES" | grep -v -E "(audit/proof_runs|OV_RESULTS|SHK_REPORT|audit/verification_reports|audit/out_runs|audit/.*OUT|audit/state_assessment/run_|audit/marketplace_submission/FREEZE_LOCK\.json|node_modules/|dist/)" || true)

    # Step 3: Sort lexicographically with locale stability
    SORTED_FILES=$(echo "$FILTERED_FILES" | LC_ALL=C sort)

    # Step 4: Build canonical manifest with sha256 for each file (from git snapshot, not working tree)
    MANIFEST=$(mktemp)
    trap "rm -f $MANIFEST" EXIT

    echo "$SORTED_FILES" | while read -r file; do
        if [[ -z "$file" ]]; then
            continue
        fi
        # Pipe git show through sha256sum (binary-safe)
        git show "${SNAPSHOT_COMMIT}:${file}" 2>/dev/null | sha256sum | awk -v f="$file" '{print $1 "  " f}'
    done | LC_ALL=C sort > "$MANIFEST"

    # Step 5: Hash the manifest to get CURRENT_SHA
    CURRENT_SHA=$(sha256sum "$MANIFEST" | awk '{print $1}')

    # Compare frozen content
    if [[ "$CURRENT_SHA" == "$LOCKED_SHA" ]]; then
        echo "[FREEZE_VERIFY] OK: release mode - commitSha and frozenContentSha validated"
        exit 0
    else
        echo "[FREEZE_VERIFY] FAIL: frozenContentSha mismatch (release mode)"
        echo "  Expected: $LOCKED_SHA"
        echo "  Got:      $CURRENT_SHA"
        echo "  PAYLOAD:  $PAYLOAD"
        echo "  Commit:   $LOCKED_COMMIT"
        echo "  REMEDIATION: Ensure RELEASE_PAYLOAD_COMMIT matches lock's commitSha, then run 'npm run release:freeze-lock'"
        exit 1
    fi
fi
