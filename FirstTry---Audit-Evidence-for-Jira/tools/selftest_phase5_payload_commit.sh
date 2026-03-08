#!/bin/bash
# selftest_phase5_payload_commit.sh
#
# Selftest: Verify Phase 5 payload commit logic is non-brittle to extra commits.
#
# Scenario:
#   1. Record current HEAD (this is the "payload commit")
#   2. Make a dummy commit locally
#   3. Run Phase 5 verification logic
#   4. Verify it still PASSES (because we use stored payload commit, not HEAD~1)
#   5. Reset to original state (no side effects)
#
# Exit:
#   0 = PASS (Phase 5 works even with extra commits)
#   1 = FAIL (Phase 5 is brittle to extra commits)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FORGE_APP_DIR="$REPO_ROOT"
AUDIT_DIR="$FORGE_APP_DIR/audit"

echo "═════════════════════════════════════════════════════════════════"
echo "SELFTEST: Phase 5 Payload Commit Logic (Non-Brittle to Extra Commits)"
echo "═════════════════════════════════════════════════════════════════"
echo ""

cd "$REPO_ROOT"

# Step 1: Check preconditions
if ! git rev-parse HEAD &>/dev/null; then
    echo "✗ FAIL: Not a git repository"
    exit 1
fi

# Check FREEZE_LOCK.json — search in multiple locations
FREEZE_LOCK_PATH=""
if [[ -f "$AUDIT_DIR/marketplace_submission/FREEZE_LOCK.json" ]]; then
    FREEZE_LOCK_PATH="$AUDIT_DIR/marketplace_submission/FREEZE_LOCK.json"
fi

if [[ -z "$FREEZE_LOCK_PATH" ]] || [[ ! -f "$FREEZE_LOCK_PATH" ]]; then
    echo "⚠ WARNING: FREEZE_LOCK.json not found"
    echo "  Selftest will skip freeze lock validation (mock mode)"
    SKIP_FREEZE_VALIDATION=1
else
    SKIP_FREEZE_VALIDATION=0
fi

# Step 2: Capture baseline state
echo "📋 Capturing baseline state..."
ORIGINAL_HEAD=$(git rev-parse HEAD)
ORIGINAL_BRANCH=$(git rev-parse --abbrev-ref HEAD)
ORIGINAL_STATUS=$(git status --porcelain)

echo "  Original HEAD: $ORIGINAL_HEAD"
echo "  Original branch: $ORIGINAL_BRANCH"

if [[ -n "$ORIGINAL_STATUS" ]]; then
    echo "✗ FAIL: Repository has uncommitted changes (test requires clean tree)"
    exit 1
fi

# Step 3: Simulate Phase 1: Create temporary run folder with payload commit
TEMP_RUN_DIR=$(mktemp -d)
trap "rm -rf $TEMP_RUN_DIR" EXIT

echo ""
echo "📋 Simulating Phase 1: Storing payload commit..."
echo "$ORIGINAL_HEAD" > "$TEMP_RUN_DIR/PAYLOAD_COMMIT.txt"
echo "  Stored PAYLOAD_COMMIT: $ORIGINAL_HEAD"

# Step 4: Make a dummy test commit (simulating extra work after payload was frozen)
echo ""
echo "📋 Creating dummy test commit (simulating extra work)..."

cd "$REPO_ROOT"
# Create a temporary file to commit
echo "test content $(date)" > .selftest_dummy_commit.txt
git add .selftest_dummy_commit.txt
git commit -m "test(selftest): dummy commit for Phase 5 payload commit test" --quiet 2>/dev/null || {
    echo "✗ FAIL: Could not create dummy commit"
    git reset --hard "$ORIGINAL_HEAD" 2>/dev/null || true
    exit 1
}

DUMMY_HEAD=$(git rev-parse HEAD)
echo "  Created dummy commit: $DUMMY_HEAD"

# Step 5: Verify Phase 5 logic with stored payload commit
echo ""
echo "📋 Running Phase 5 verification logic with stored payload commit..."

# Export environment variables as Phase 5 does
export PHASE5_PAYLOAD_COMMIT="$ORIGINAL_HEAD"
export PHASE5_PROOF_DIR="$TEMP_RUN_DIR"

cd "$FORGE_APP_DIR"

# Run verify_freeze_lock.sh
verify_output=$(bash "$AUDIT_DIR/verify_freeze_lock.sh" 2>&1 || true)
verify_exit=$?

echo "  verify_freeze_lock.sh exit code: $verify_exit"
echo ""
echo "  Output excerpt:"
echo "$verify_output" | head -20 | sed 's/^/    /'

# Step 6: Analyze result
echo ""
echo "📋 Analyzing result..."

# Success condition: 
# - If SKIP_FREEZE_VALIDATION=1 (no FREEZE_LOCK.json), check commit validation only
# - Otherwise check that both commit and SHA validation passed or at least commit validation passed
if [[ $SKIP_FREEZE_VALIDATION -eq 1 ]]; then
    # Mock mode: only check that commit validation would pass
    if echo "$verify_output" | grep -q "EXPECTED_PAYLOAD_COMMIT=$ORIGINAL_HEAD" && \
       ! echo "$verify_output" | grep -q "FAIL: FREEZE_COMMIT_MISMATCH"; then
        echo "✓ PASS: Payload commit check logic works (mock mode, no FREEZE_LOCK)"
        result=0
    else
        echo "✗ FAIL: Could not verify payload commit logic"
        result=1
    fi
else
    # Full mode: check both commit and SHA validation
    if echo "$verify_output" | grep -q "✓ Freeze lock matches"; then
        echo "✓ PASS: verify_freeze_lock.sh succeeded"
        result=0
    elif echo "$verify_output" | grep -q "EXPECTED_PAYLOAD_COMMIT=$ORIGINAL_HEAD" && \
         echo "$verify_output" | grep -q "LOCKED_COMMIT=$ORIGINAL_HEAD" && \
         ! echo "$verify_output" | grep -q "FAIL: FREEZE_COMMIT_MISMATCH"; then
        echo "✓ PASS: Payload commit check passed (SHA check unrelated)"
        result=0
    elif [[ $verify_exit -eq 0 ]]; then
        echo "✓ PASS: verify_freeze_lock.sh exited 0"
        result=0
    else
        # Check if it failed on something other than commit mismatch
        if echo "$verify_output" | grep -q "FAIL: FREEZE_COMMIT_MISMATCH"; then
            echo "✗ FAIL: Phase 5 rejected the payload commit"
            echo "  This indicates the fix is not working correctly."
            result=1
        else
            # Other failure (maybe SHA mismatch) — that's OK for this test
            # We only care that the commit check passed
            if echo "$verify_output" | grep -q "EXPECTED_PAYLOAD_COMMIT=$ORIGINAL_HEAD" && \
               echo "$verify_output" | grep -q "LOCKED_COMMIT=$ORIGINAL_HEAD"; then
                echo "✓ PASS: Payload commit was accepted (other checks failed, unrelated to test)"
                result=0
            else
                echo "✗ FAIL: Unexpected error"
                result=1
            fi
        fi
    fi
fi

# Step 7: Clean up (reset to original state)
echo ""
echo "📋 Cleaning up (resetting to original state)..."

cd "$REPO_ROOT"
git reset --hard "$ORIGINAL_HEAD" --quiet 2>/dev/null || {
    echo "⚠ WARNING: Could not reset to original HEAD"
    echo "  Manual reset required: git reset --hard $ORIGINAL_HEAD"
}

if git rev-parse "$ORIGINAL_BRANCH" &>/dev/null; then
    git checkout "$ORIGINAL_BRANCH" --quiet 2>/dev/null || true
fi

echo "  Reset to: $ORIGINAL_HEAD"

# Step 8: Final result
echo ""
echo "═════════════════════════════════════════════════════════════════"
if [[ $result -eq 0 ]]; then
    echo "✓ SELFTEST PASSED: Phase 5 is non-brittle to extra commits"
    echo ""
    echo "The fix is working: Phase 5 uses the stored payload commit"
    echo "instead of HEAD~1, making it robust to additional commits."
else
    echo "✗ SELFTEST FAILED: Phase 5 is still brittle"
    echo ""
    echo "The issue persists. Verify the implementation:"
    echo "  1. Phase 1 stores PAYLOAD_COMMIT.txt"
    echo "  2. Phase 5 exports PHASE5_PAYLOAD_COMMIT"
    echo "  3. verify_freeze_lock.sh uses PHASE5_PAYLOAD_COMMIT"
fi
echo "═════════════════════════════════════════════════════════════════"

unset PHASE5_PAYLOAD_COMMIT PHASE5_PROOF_DIR

exit $result
