#!/bin/bash
# Verify FREEZE_LOCK.json by recomputing the deterministic content hash
# Uses the FROZEN_CONTENT_SHA algorithm
#
# RUN-SCOPED MODE: During proof:auth runs, uses PHASE5_FREEZE_LOCK_PATH (from run folder)
# STANDALONE MODE: When run directly, uses audit/marketplace_submission/FREEZE_LOCK.json (for releases)

set -euo pipefail
export LC_ALL=C
export LANG=C

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
AUDIT_DIR="$(dirname "$0")"

# ============================================================================
# Determine FREEZE_LOCK path: run-scoped (proof mode) or repo (release mode)
# ============================================================================
if [[ -n "${PHASE5_FREEZE_LOCK_PATH:-}" ]]; then
    # RUN-SCOPED MODE: proof:auth passes this env var
    FREEZE_LOCK_PATH="$PHASE5_FREEZE_LOCK_PATH"
    RUN_MODE="proof"
else
    # STANDALONE MODE: release verification (uses repo-committed lock)
    FREEZE_LOCK_PATH="$AUDIT_DIR/marketplace_submission/FREEZE_LOCK.json"
    RUN_MODE="release"
fi

# ============================================================================
# Single Source of Truth: Payload commit
# ============================================================================
EXPECTED_PAYLOAD_COMMIT="${PHASE5_PAYLOAD_COMMIT:-}"

if [[ -z "$EXPECTED_PAYLOAD_COMMIT" ]]; then
    # Fallback: use current HEAD (standalone mode only)
    EXPECTED_PAYLOAD_COMMIT=$(cd "$REPO_ROOT" && git rev-parse HEAD)
fi

CURRENT_HEAD=$(cd "$REPO_ROOT" && git rev-parse HEAD)

# Check if FREEZE_LOCK exists
if [[ ! -f "$FREEZE_LOCK_PATH" ]]; then
    echo "FAIL: FREEZE_LOCK_MISSING"
    exit 1
fi

# Read the locked commit and content SHA
LOCKED_COMMIT=$(jq -r '.commitSha' "$FREEZE_LOCK_PATH" 2>/dev/null || echo "")
LOCKED_SHA=$(jq -r '.frozenContentSha' "$FREEZE_LOCK_PATH" 2>/dev/null || echo "")

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
    echo "  FREEZE_LOCK_PATH:        $FREEZE_LOCK_PATH"
    echo "  RUN_MODE:                $RUN_MODE"
    echo ""
    echo "REMEDIATION:"
    if [[ "$RUN_MODE" == "proof" ]]; then
        echo "  Proof run: Re-run proof:auth to generate fresh run-scoped lock"
    else
        echo "  Release mode: Run 'npm run release:freeze-lock' to update repo lock"
    fi
    exit 1
fi

# ============================================================================
# Content validation: Only for release mode (proof mode has no content SHA)
# ============================================================================
if [[ "$RUN_MODE" == "release" ]]; then
    # Release mode: Verify frozen content SHA
    
    # Compute FROZEN_CONTENT_SHA from git-tracked files
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
        echo "✓ Freeze lock matches (release mode: commitSha + frozenContentSha validated)"
        exit 0
    else
        echo "FAIL: FREEZE_VERIFY_FAIL"
        echo "  Expected SHA: $LOCKED_SHA"
        echo "  Got SHA:      $CURRENT_SHA"
        echo ""
        echo "REMEDIATION:"
        echo "  The frozen content does not match the lock."
        echo "  Run: npm run release:freeze-lock"
        exit 1
    fi

else
    # Proof mode: Only commitSha validation (no content check)
    echo "✓ Freeze lock validated (proof mode: commitSha only, no content check)"
    exit 0
fi
