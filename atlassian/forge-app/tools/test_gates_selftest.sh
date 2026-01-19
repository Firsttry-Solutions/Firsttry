#!/bin/bash
# SELFTEST: test_gates_selftest.sh (REAL BUNDLE + MUTATION TESTS)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GATE1="$SCRIPT_DIR/verify_bundle_integrity.sh"
GATE2="$SCRIPT_DIR/verify_dist_identity_labels.sh"
GADGET_DIR="$SCRIPT_DIR/../src/gadget-ui"

# ========================================================================
# HELPER FUNCTIONS
# ========================================================================

fail() {
    echo "[SELFTEST] FAIL: $1"
    exit 1
}

pass() {
    echo "[SELFTEST] PASS: $1"
}

# ========================================================================
# LOCATE REAL BUNDLE
# ========================================================================

echo "[SELFTEST] Phase 1: Locate real dist bundle"

if [ ! -d "$GADGET_DIR/dist" ]; then
    fail "dist directory not found: $GADGET_DIR/dist"
fi

if [ ! -f "$GADGET_DIR/dist/index.html" ]; then
    fail "index.html not found in $GADGET_DIR/dist"
fi

# Extract bundle path from index.html
BUNDLE_REF=$(grep -oE 'app\.[a-f0-9]+\.(js|mjs)' "$GADGET_DIR/dist/index.html" 2>/dev/null | head -1 || true)
if [ -z "$BUNDLE_REF" ]; then
    fail "Cannot extract app bundle reference from index.html"
fi

REAL_BUNDLE="$GADGET_DIR/dist/$BUNDLE_REF"
if [ ! -f "$REAL_BUNDLE" ]; then
    fail "Real bundle not found: $REAL_BUNDLE"
fi

pass "Real bundle located: $REAL_BUNDLE"

# ========================================================================
# REAL BUNDLE SMOKE TESTS
# ========================================================================

echo ""
echo "[SELFTEST] Phase 2: Real bundle smoke tests (must PASS)"

echo "[SELFTEST] Running Gate 2 on real bundle..."
if ! output2=$("$GATE2" --bundle-file "$REAL_BUNDLE" 2>&1); then
    echo "[SELFTEST] Gate 2 output:"
    echo "$output2"
    fail "Gate 2 failed on real bundle"
fi
pass "Gate 2 PASSED on real bundle"

echo "[SELFTEST] Running Gate 1 on real bundle..."
if ! output1=$("$GATE1" --bundle-file "$REAL_BUNDLE" 2>&1); then
    echo "[SELFTEST] Gate 1 output:"
    echo "$output1"
    fail "Gate 1 failed on real bundle"
fi
pass "Gate 1 PASSED on real bundle"

# ========================================================================
# MUTATION TESTS (Real bundle copies with minimal edits)
# ========================================================================

echo ""
echo "[SELFTEST] Phase 3: Mutation tests on real bundle"

TEST_DIR=$(mktemp -d)
trap "rm -rf $TEST_DIR" EXIT

MUTATION_PASS=0
MUTATION_FAIL=0

# Mutation A: Remove anchor substring
echo "[SELFTEST] Mutation A: Remove anchor substring"
BUNDLE_A="$TEST_DIR/bundle_no_anchor.js"
cp "$REAL_BUNDLE" "$BUNDLE_A"
sed -i '/FT_IDENTITY_ANCHOR_V1/d' "$BUNDLE_A"
output=$("$GATE2" --bundle-file "$BUNDLE_A" 2>&1 || true)
if echo "$output" | grep -q "FAIL"; then
    echo "[SELFTEST]   ✓ Gate 2 correctly FAILED"
    MUTATION_PASS=$((MUTATION_PASS + 1))
else
    echo "[SELFTEST]   ✗ Gate 2 should have FAILED"
    MUTATION_FAIL=$((MUTATION_FAIL + 1))
fi

# Mutation B: Duplicate anchor (insert second occurrence)
echo "[SELFTEST] Mutation B: Duplicate anchor"
BUNDLE_B="$TEST_DIR/bundle_dup_anchor.js"
cp "$REAL_BUNDLE" "$BUNDLE_B"
ANCHOR_LINE=$(grep 'FT_IDENTITY_ANCHOR_V1|git=' "$BUNDLE_B" | head -1 || true)
if [ -n "$ANCHOR_LINE" ]; then
    echo "$ANCHOR_LINE" >> "$BUNDLE_B"
    output=$("$GATE2" --bundle-file "$BUNDLE_B" 2>&1 || true)
    if echo "$output" | grep -q "FAIL"; then
        echo "[SELFTEST]   ✓ Gate 2 correctly FAILED"
        MUTATION_PASS=$((MUTATION_PASS + 1))
    else
        echo "[SELFTEST]   ✗ Gate 2 should have FAILED"
        MUTATION_FAIL=$((MUTATION_FAIL + 1))
    fi
else
    echo "[SELFTEST]   ⊘ Skipped (no anchor found in real bundle)"
fi

# Mutation C: Replace time=... with time=UNSET
echo "[SELFTEST] Mutation C: Replace time with UNSET"
BUNDLE_C="$TEST_DIR/bundle_time_unset.js"
cp "$REAL_BUNDLE" "$BUNDLE_C"
sed -i 's/time=[^ |"]*/time=UNSET/g' "$BUNDLE_C"
output=$("$GATE2" --bundle-file "$BUNDLE_C" 2>&1 || true)
if echo "$output" | grep -q "FAIL"; then
    echo "[SELFTEST]   ✓ Gate 2 correctly FAILED"
    MUTATION_PASS=$((MUTATION_PASS + 1))
else
    echo "[SELFTEST]   ✗ Gate 2 should have FAILED"
    MUTATION_FAIL=$((MUTATION_FAIL + 1))
fi

# Mutation D: Replace git=XXXX with git=<bundlehash> (no distinctness)
echo "[SELFTEST] Mutation D: Replace git with bundle value (no distinctness)"
BUNDLE_D="$TEST_DIR/bundle_no_distinct.js"
cp "$REAL_BUNDLE" "$BUNDLE_D"
# Extract bundle hash and replace git with it
BUNDLE_HASH=$(grep -oE 'bundle=[a-f0-9]{6,12}' "$BUNDLE_D" | sed 's/bundle=//' | head -1)
if [ -n "$BUNDLE_HASH" ]; then
    sed -i "s/git=[a-f0-9]\{7\}/git=$BUNDLE_HASH/" "$BUNDLE_D"
    output=$("$GATE2" --bundle-file "$BUNDLE_D" 2>&1 || true)
    if echo "$output" | grep -q "FAIL"; then
        echo "[SELFTEST]   ✓ Gate 2 correctly FAILED"
        MUTATION_PASS=$((MUTATION_PASS + 1))
    else
        echo "[SELFTEST]   ✗ Gate 2 should have FAILED"
        MUTATION_FAIL=$((MUTATION_FAIL + 1))
    fi
else
    echo "[SELFTEST]   ⊘ Skipped (cannot extract bundle hash)"
fi

# Mutation E: Create tiny file (< 10KB)
echo "[SELFTEST] Mutation E: Tiny file (Gate 1 must FAIL)"
BUNDLE_E="$TEST_DIR/bundle_tiny.js"
echo "x" > "$BUNDLE_E"
output=$("$GATE1" --bundle-file "$BUNDLE_E" 2>&1 || true)
if echo "$output" | grep -q "FAIL"; then
    echo "[SELFTEST]   ✓ Gate 1 correctly FAILED"
    MUTATION_PASS=$((MUTATION_PASS + 1))
else
    echo "[SELFTEST]   ✗ Gate 1 should have FAILED"
    MUTATION_FAIL=$((MUTATION_FAIL + 1))
fi

# ========================================================================
# SUMMARY
# ========================================================================

echo ""
echo "[SELFTEST] =========================================="
echo "[SELFTEST] SELFTEST SUMMARY"
echo "[SELFTEST] =========================================="
echo "[SELFTEST] Real bundle smoke tests: 2/2 PASS"
echo "[SELFTEST] Mutation tests: $MUTATION_PASS/5 PASS"
echo ""

if [ $MUTATION_FAIL -eq 0 ]; then
    pass "ALL TESTS PASSED (7/7)"
    exit 0
else
    fail "MUTATION TESTS FAILED ($MUTATION_FAIL failed)"
fi
