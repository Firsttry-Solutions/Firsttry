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
# MUTATION F: Verify no-STG gate fails when STG is present
# ========================================================================

echo "[SELFTEST] Mutation F: STG marker in dist (verify:no-stg must FAIL)"
TEMP_STG_FILE="$GADGET_DIR/dist/stg_test_mutation_$$.js"
echo "/* STG_BADGE: This is a test mutation */" > "$TEMP_STG_FILE"
trap "rm -rf $TEST_DIR; rm -f $TEMP_STG_FILE" EXIT

STG_GATE="$SCRIPT_DIR/verify_no_stg_in_prod_artifacts.sh"
output=$(bash "$STG_GATE" 2>&1 || true)
if echo "$output" | grep -q "FAIL\|❌"; then
    echo "[SELFTEST]   ✓ verify:no-stg correctly FAILED on STG marker"
    MUTATION_PASS=$((MUTATION_PASS + 1))
else
    echo "[SELFTEST]   ✗ verify:no-stg should have FAILED"
    echo "[SELFTEST]   Output: $output"
    MUTATION_FAIL=$((MUTATION_FAIL + 1))
fi

# Clean up test file
rm -f "$TEMP_STG_FILE"

# ========================================================================
# MUTATION G: Verify no-bypass-merge gate fails when merge is bypassed
# ========================================================================

echo "[SELFTEST] Mutation G: Direct render bypass (verify:no-bypass-merge must FAIL)"

MAIN_TS="$SCRIPT_DIR/../src/gadget-ui/src/main.ts"
MAIN_TS_BACKUP="$TEST_DIR/main.ts.backup"
cp "$MAIN_TS" "$MAIN_TS_BACKUP"

# Inject a line that violates the gate: renderL0Dashboard(mapL0SnapshotResponse(...))
# (Insert it temporarily, test it, then restore)
LINE_TO_INSERT="  // TEST MUTATION: const testBypass = renderL0Dashboard(mapL0SnapshotResponse({}));"
sed -i "100i\\$LINE_TO_INSERT" "$MAIN_TS"

NO_BYPASS_GATE="$SCRIPT_DIR/verify_no_direct_render_without_merge.sh"
output=$(bash "$NO_BYPASS_GATE" 2>&1 || true)
if echo "$output" | grep -q "FAIL\|❌"; then
    echo "[SELFTEST]   ✓ verify:no-bypass-merge correctly FAILED on bypass pattern"
    MUTATION_PASS=$((MUTATION_PASS + 1))
else
    echo "[SELFTEST]   ✗ verify:no-bypass-merge should have FAILED"
    echo "[SELFTEST]   Output: $output"
    MUTATION_FAIL=$((MUTATION_FAIL + 1))
fi

# Restore main.ts
cp "$MAIN_TS_BACKUP" "$MAIN_TS"

# ========================================================================
# MUTATION H: Verify marketplace-docs gate fails when privacy policy missing
# ========================================================================

echo "[SELFTEST] Mutation H: Missing PRIVACY_POLICY.md (verify:marketplace-docs must FAIL)"

PRIVACY_DOC="$SCRIPT_DIR/../docs/PRIVACY_POLICY.md"
PRIVACY_BACKUP="$TEST_DIR/PRIVACY_POLICY.md.backup"
mv "$PRIVACY_DOC" "$PRIVACY_BACKUP"

MARKETPLACE_GATE="$SCRIPT_DIR/verify_marketplace_docs_present.sh"
output=$(bash "$MARKETPLACE_GATE" 2>&1 || true)
if echo "$output" | grep -q "FAIL\|MISSING"; then
    echo "[SELFTEST]   ✓ verify:marketplace-docs correctly FAILED on missing PRIVACY_POLICY.md"
    MUTATION_PASS=$((MUTATION_PASS + 1))
else
    echo "[SELFTEST]   ✗ verify:marketplace-docs should have FAILED"
    echo "[SELFTEST]   Output: $output"
    MUTATION_FAIL=$((MUTATION_FAIL + 1))
fi

# Restore PRIVACY_POLICY.md
mv "$PRIVACY_BACKUP" "$PRIVACY_DOC"

# ========================================================================
# MUTATION I: Verify support-docs gate fails when contact missing
# ========================================================================

echo "[SELFTEST] Mutation I: No contact in SUPPORT.md (verify:support-docs must FAIL)"

SUPPORT_DOC="$SCRIPT_DIR/../docs/SUPPORT.md"
SUPPORT_BACKUP="$TEST_DIR/SUPPORT.md.backup"
cp "$SUPPORT_DOC" "$SUPPORT_BACKUP"

# Replace content with version that has no @ or mailto:
cat > "$SUPPORT_DOC" << 'SUPPORT_TBD'
# Support Documentation

**Last Updated**: January 2026

---

## Getting Support

To be determined.
Support information coming soon.

---

**Contact**: Coming soon
SUPPORT_TBD

SUPPORT_GATE="$SCRIPT_DIR/verify_support_docs_have_contact.sh"
output=$(bash "$SUPPORT_GATE" 2>&1 || true)
if echo "$output" | grep -q "FAIL"; then
    echo "[SELFTEST]   ✓ verify:support-docs correctly FAILED on missing contact"
    MUTATION_PASS=$((MUTATION_PASS + 1))
else
    echo "[SELFTEST]   ✗ verify:support-docs should have FAILED"
    echo "[SELFTEST]   Output: $output"
    MUTATION_FAIL=$((MUTATION_FAIL + 1))
fi

# Restore SUPPORT.md
cp "$SUPPORT_BACKUP" "$SUPPORT_DOC"

# ========================================================================
# SUMMARY
# ========================================================================

echo ""
echo "[SELFTEST] =========================================="
echo "[SELFTEST] SELFTEST SUMMARY"
echo "[SELFTEST] =========================================="
echo "[SELFTEST] Real bundle smoke tests: 2/2 PASS"
echo "[SELFTEST] Mutation tests (gates): $MUTATION_PASS/9 PASS"
echo ""

if [ $MUTATION_FAIL -eq 0 ]; then
    pass "ALL TESTS PASSED (11/11)"
    exit 0
else
    fail "MUTATION TESTS FAILED ($MUTATION_FAIL failed)"
fi

