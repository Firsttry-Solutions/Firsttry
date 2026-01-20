#!/bin/bash
# Test that release mode FAILS if frozenContentSha is missing
# This validates that release mode enforces strict integrity requirements

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
AUDIT_DIR="$REPO_ROOT/atlassian/forge-app/audit"
TEMP_DIR=$(mktemp -d)

trap "rm -rf $TEMP_DIR" EXIT

echo "═════════════════════════════════════════════════════════════════"
echo "TEST: Release mode must FAIL when frozenContentSha is missing"
echo "═════════════════════════════════════════════════════════════════"
echo ""

# Create a lock file WITHOUT frozenContentSha (missing release requirement)
TEMP_LOCK="$TEMP_DIR/test_lock_no_content_sha.json"
cat > "$TEMP_LOCK" << 'EOF'
{
  "commitSha": "dcf5814ff127c40db21a227f6469c70499cc83ae",
  "method": "git-tracked-files+sha256-manifest",
  "frozenAt": "2026-01-14T16:36:50Z"
}
EOF

echo "Created test lock WITHOUT frozenContentSha:"
cat "$TEMP_LOCK"
echo ""

# Set up environment for release mode (no PHASE5_FREEZE_LOCK_MODE set)
export PHASE5_FREEZE_LOCK_PATH="$TEMP_LOCK"
export PHASE5_PAYLOAD_COMMIT="dcf5814ff127c40db21a227f6469c70499cc83ae"
unset PHASE5_FREEZE_LOCK_MODE  # Force release mode

echo "Running verify_freeze_lock.sh in RELEASE mode with missing frozenContentSha..."
echo ""

# Run and capture exit code
set +e
bash "$AUDIT_DIR/verify_freeze_lock.sh" 2>&1 | tee "$TEMP_DIR/output.txt"
EXIT_CODE=$?
set -e

echo ""
echo "═════════════════════════════════════════════════════════════════"

if [[ $EXIT_CODE -eq 0 ]]; then
    echo "❌ TEST FAILED: Release mode should have failed (exit 0 is wrong)"
    exit 1
else
    echo "✓ TEST PASSED: Release mode correctly failed (exit code: $EXIT_CODE)"
    
    # Verify the error message mentions the missing frozenContentSha
    if grep -q "frozenContentSha.*MISSING" "$TEMP_DIR/output.txt"; then
        echo "✓ ERROR MESSAGE correct: mentions missing frozenContentSha"
    else
        echo "⚠ WARNING: Error message does not explicitly mention frozenContentSha"
        cat "$TEMP_DIR/output.txt"
    fi
fi

echo "═════════════════════════════════════════════════════════════════"
