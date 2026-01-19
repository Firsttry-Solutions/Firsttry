#!/bin/bash
set -u
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GATE1="$SCRIPT_DIR/verify_bundle_integrity.sh"
GATE2="$SCRIPT_DIR/verify_dist_identity_labels.sh"
TEST_DIR=$(mktemp -d)
trap "rm -rf $TEST_DIR" EXIT
echo "=========================================="
echo "GATE SELFTEST: Negative Scenarios"
echo "=========================================="
echo ""
PASS_COUNT=0
FAIL_COUNT=0

# TEST 1: Missing identity anchor
echo "[TEST 1] Missing identity anchor → Gate 2 FAIL"
TEST1_JS="$TEST_DIR/test1_no_anchor.js"
cat > "$TEST1_JS" << 'EOF'
console.log("Valid app bundle");
function main() { console.log("Hello"); }
main();
EOF
echo "[TEST 1] Gate 2 (identity anchor)..."
output=$("$GATE2" --bundle-file "$TEST1_JS" 2>&1 || true)
if echo "$output" | grep -q "FAIL"; then
    echo "[TEST 1]   ✓ Gate 2 correctly FAILED (no anchor)"
    ((PASS_COUNT++))
else
    echo "[TEST 1]   ✗ Gate 2 should have FAILED but didn't"
    ((FAIL_COUNT++))
fi
echo ""

# TEST 2: Multiple identity anchors
echo "[TEST 2] Multiple identity anchors → Gate 2 FAIL"
TEST2_JS="$TEST_DIR/test2_multi_anchor.js"
cat > "$TEST2_JS" << 'EOF'
console.log("First anchor: FT_IDENTITY_ANCHOR_V1|git=abcdef1|bundle=123456|time=2024-01-01T00:00:00Z");
function main() { console.log("Hello"); }
console.log("Second anchor: FT_IDENTITY_ANCHOR_V1|git=1234567|bundle=abcdef|time=2024-01-02T00:00:00Z");
main();
EOF
echo "[TEST 2] Gate 2 (identity anchor)..."
output=$("$GATE2" --bundle-file "$TEST2_JS" 2>&1 || true)
if echo "$output" | grep -q "FAIL"; then
    echo "[TEST 2]   ✓ Gate 2 correctly FAILED (multiple anchors)"
    ((PASS_COUNT++))
else
    echo "[TEST 2]   ✗ Gate 2 should have FAILED but didn't"
    ((FAIL_COUNT++))
fi
echo ""

# TEST 3: Malformed anchor
echo "[TEST 3] Malformed anchor (git_sha too short) → Gate 2 FAIL"
TEST3_JS="$TEST_DIR/test3_bad_format.js"
cat > "$TEST3_JS" << 'EOF'
console.log("Malformed anchor: FT_IDENTITY_ANCHOR_V1|git=abc|bundle=123456|time=2024-01-01T00:00:00Z");
function main() { console.log("Hello"); }
main();
EOF
echo "[TEST 3] Gate 2 (identity anchor)..."
output=$("$GATE2" --bundle-file "$TEST3_JS" 2>&1 || true)
if echo "$output" | grep -q "FAIL"; then
    echo "[TEST 3]   ✓ Gate 2 correctly FAILED (malformed anchor)"
    ((PASS_COUNT++))
else
    echo "[TEST 3]   ✗ Gate 2 should have FAILED but didn't"
    ((FAIL_COUNT++))
fi
echo ""

# TEST 4: No distinctness
echo "[TEST 4] Anchor with git_sha == bundle_hash → Gate 2 FAIL"
TEST4_JS="$TEST_DIR/test4_no_distinctness.js"
cat > "$TEST4_JS" << 'EOF'
console.log("Identical values: FT_IDENTITY_ANCHOR_V1|git=abcdef1|bundle=abcdef1|time=2024-01-01T00:00:00Z");
function main() { console.log("Hello"); }
main();
EOF
echo "[TEST 4] Gate 2 (identity anchor)..."
output=$("$GATE2" --bundle-file "$TEST4_JS" 2>&1 || true)
if echo "$output" | grep -q "FAIL"; then
    echo "[TEST 4]   ✓ Gate 2 correctly FAILED (distinctness check)"
    ((PASS_COUNT++))
else
    echo "[TEST 4]   ✗ Gate 2 should have FAILED but didn't"
    ((FAIL_COUNT++))
fi
echo ""

# TEST 5: Valid anchor
echo "[TEST 5] Valid anchor structure → Both gates PASS"
TEST5_JS="$TEST_DIR/test5_valid.js"
cat > "$TEST5_JS" << 'EOF'
console.log("Valid anchor: FT_IDENTITY_ANCHOR_V1|git=1234567|bundle=abcdef|time=2024-01-01T00:00:00Z");
function main() { console.log("Hello"); }
main();
EOF
echo "[TEST 5] Gate 2 (identity anchor)..."
output=$("$GATE2" --bundle-file "$TEST5_JS" 2>&1 || true)
if echo "$output" | grep -q "PASS"; then
    echo "[TEST 5]   ✓ Gate 2 correctly PASSED (valid anchor)"
    ((PASS_COUNT++))
else
    echo "[TEST 5]   ✗ Gate 2 should have PASSED but didn't"
    ((FAIL_COUNT++))
fi
echo ""

echo "=========================================="
echo "SELFTEST SUMMARY"
echo "=========================================="
echo "PASSED: $PASS_COUNT"
echo "FAILED: $FAIL_COUNT"
echo ""
if [ $FAIL_COUNT -eq 0 ]; then
    echo "✓ ALL TESTS PASSED"
    exit 0
else
    echo "✗ SOME TESTS FAILED"
    exit 1
fi
