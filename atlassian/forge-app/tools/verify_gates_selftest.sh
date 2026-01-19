#!/bin/bash
# GATE 3: verify_gates_selftest.sh (NEW - NON-BYPASSABLE)
# Mutation-based self-validation that gates actually catch regressions
# Creates malformed bundles and verifies each gate fails appropriately
# PASSES only if all negative tests succeed (gates are strong)

set -euo pipefail

BASE_PATH="${1:-.}"
DIST_DIR=""
if [ -d "$BASE_PATH/src/gadget-ui/dist" ]; then
    DIST_DIR="$BASE_PATH/src/gadget-ui/dist"
elif [ -d "$BASE_PATH/atlassian/forge-app/src/gadget-ui/dist" ]; then
    DIST_DIR="$BASE_PATH/atlassian/forge-app/src/gadget-ui/dist"
else
    echo "[GATE_SELFTEST] ERROR: Cannot locate dist"
    exit 1
fi

# Deterministic bundle discovery
if [ -f "$DIST_DIR/index.html" ]; then
    BUNDLE_REF=$(grep -oE 'app\.[a-f0-9]+\.(js|mjs)' "$DIST_DIR/index.html" 2>/dev/null | head -1)
    if [ -n "$BUNDLE_REF" ]; then
        DIST_JS="$DIST_DIR/$BUNDLE_REF"
    else
        echo "[GATE_SELFTEST] ERROR: Cannot resolve bundle from index.html"
        exit 1
    fi
else
    echo "[GATE_SELFTEST] ERROR: No index.html found"
    exit 1
fi

if [ ! -f "$DIST_JS" ]; then
    echo "[GATE_SELFTEST] ERROR: Bundle not found: $DIST_JS"
    exit 1
fi

BUNDLE_NAME=$(basename "$DIST_JS")
echo "[GATE_SELFTEST] Mutation Testing: $BUNDLE_NAME"

# Create temp directory for test bundles
TEMP_TEST_DIR=$(mktemp -d)
trap "rm -rf $TEMP_TEST_DIR" EXIT

TEST_DIR=$(cd "$(dirname "$DIST_JS")" && pwd)
GATE_INVOKE="$(dirname "$DIST_JS")/../../../tools/verify_dist_invoke_allowlist.sh"
GATE_IDENTITY="$(dirname "$DIST_JS")/../../../tools/verify_dist_identity_labels.sh"

# Verify gate scripts exist
if [ ! -f "$GATE_INVOKE" ]; then
    GATE_INVOKE="$(dirname "$DIST_JS")/../../tools/verify_dist_invoke_allowlist.sh"
fi
if [ ! -f "$GATE_IDENTITY" ]; then
    GATE_IDENTITY="$(dirname "$DIST_JS")/../../tools/verify_dist_identity_labels.sh"
fi

if [ ! -f "$GATE_INVOKE" ] || [ ! -f "$GATE_IDENTITY" ]; then
    echo "[GATE_SELFTEST] ERROR: Gate scripts not found"
    echo "[GATE_SELFTEST]   GATE_INVOKE=$GATE_INVOKE"
    echo "[GATE_SELFTEST]   GATE_IDENTITY=$GATE_IDENTITY"
    exit 1
fi

FAIL=0
TESTS_RUN=0
TESTS_PASSED=0

# ========================================================================
# MUTATION TEST 1: Inject forbidden invoke call invoke("ping")
# Expected: GATE_INVOKE_ALLOWLIST should FAIL
# ========================================================================
echo "[GATE_SELFTEST] Running mutation test 1: forbidden invoke call..."
TEST1_BUNDLE="$TEMP_TEST_DIR/test1_forbidden_invoke.js"
cp "$DIST_JS" "$TEST1_BUNDLE"

# Inject invoke("ping") call
sed -i 's/invoke(/invoke("ping");invoke(/' "$TEST1_BUNDLE"

# Point index.html to test bundle
TEST1_DIR="$TEMP_TEST_DIR/test1_dist"
mkdir -p "$TEST1_DIR"
cp "$DIST_DIR/index.html" "$TEST1_DIR/index.html" 2>/dev/null || true
cp "$TEST1_BUNDLE" "$TEST1_DIR/$(basename "$TEST1_BUNDLE")"
sed -i "s|$(basename "$DIST_JS")|$(basename "$TEST1_BUNDLE")|g" "$TEST1_DIR/index.html" 2>/dev/null || true
cp "$TEST1_BUNDLE" "$TEST1_DIR/app.test1.js"
echo '<html><body><script src="app.test1.js"></script></body></html>' > "$TEST1_DIR/index.html"

TESTS_RUN=$((TESTS_RUN + 1))
if bash "$GATE_INVOKE" "$TEMP_TEST_DIR/test1_dist" 2>&1 | grep -q "FAIL"; then
    echo "[GATE_SELFTEST]   ✓ Test 1 PASSED: Gate correctly rejected forbidden invoke"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo "[GATE_SELFTEST]   ✗ Test 1 FAILED: Gate did NOT catch forbidden invoke"
    FAIL=1
fi

# ========================================================================
# MUTATION TEST 2: Duplicate UI_ENTRY_RUNTIME_PROOF marker
# Expected: GATE_IDENTITY_LABELS should FAIL
# ========================================================================
echo "[GATE_SELFTEST] Running mutation test 2: duplicate proof marker..."
TEST2_BUNDLE="$TEMP_TEST_DIR/test2_duplicate_marker.js"
cp "$DIST_JS" "$TEST2_BUNDLE"

# Find first occurrence of UI_ENTRY_RUNTIME_PROOF and duplicate it
# Use pattern matching to duplicate the marker
sed -i 's/UI_ENTRY_RUNTIME_PROOF/UI_ENTRY_RUNTIME_PROOF,UI_ENTRY_RUNTIME_PROOF/' "$TEST2_BUNDLE"

# Point index.html to test bundle
TEST2_DIR="$TEMP_TEST_DIR/test2_dist"
mkdir -p "$TEST2_DIR"
echo '<html><body><script src="app.test2.js"></script></body></html>' > "$TEST2_DIR/index.html"
cp "$TEST2_BUNDLE" "$TEST2_DIR/app.test2.js"

TESTS_RUN=$((TESTS_RUN + 1))
if bash "$GATE_IDENTITY" "$TEMP_TEST_DIR/test2_dist" 2>&1 | grep -q "FAIL"; then
    echo "[GATE_SELFTEST]   ✓ Test 2 PASSED: Gate correctly rejected duplicate marker"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo "[GATE_SELFTEST]   ✗ Test 2 FAILED: Gate did NOT catch duplicate marker"
    FAIL=1
fi

# ========================================================================
# MUTATION TEST 3: Make git_sha equal to bundle_hash
# Expected: GATE_IDENTITY_LABELS should FAIL (distinctness check)
# ========================================================================
echo "[GATE_SELFTEST] Running mutation test 3: matching git_sha and bundle_hash..."
TEST3_BUNDLE="$TEMP_TEST_DIR/test3_matching_hashes.js"
cp "$DIST_JS" "$TEST3_BUNDLE"

# Extract bundle hash from filename and replace git_sha with it
BUNDLE_HASH=$(basename "$TEST3_BUNDLE" | sed -E 's/app\.([a-f0-9]+)\..*/\1/' || echo "test1234567")
# Replace git_sha value with bundle_hash
sed -i "s/ui_git_sha:\"[a-f0-9]*\"/ui_git_sha:\"$BUNDLE_HASH\"/g" "$TEST3_BUNDLE"

# Point index.html to test bundle
TEST3_DIR="$TEMP_TEST_DIR/test3_dist"
mkdir -p "$TEST3_DIR"
echo '<html><body><script src="app.test3.js"></script></body></html>' > "$TEST3_DIR/index.html"
cp "$TEST3_BUNDLE" "$TEST3_DIR/app.test3.js"

TESTS_RUN=$((TESTS_RUN + 1))
if bash "$GATE_IDENTITY" "$TEMP_TEST_DIR/test3_dist" 2>&1 | grep -q "FAIL"; then
    echo "[GATE_SELFTEST]   ✓ Test 3 PASSED: Gate correctly rejected matching hashes"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo "[GATE_SELFTEST]   ✗ Test 3 FAILED: Gate did NOT catch matching hashes"
    FAIL=1
fi

# ========================================================================
# MUTATION TEST 4: Remove FATAL_UI_LEGACY_RESOLVER marker
# Expected: GATE_INVOKE_ALLOWLIST should FAIL (missing legacy blocker)
# ========================================================================
echo "[GATE_SELFTEST] Running mutation test 4: missing legacy blocker marker..."
TEST4_BUNDLE="$TEMP_TEST_DIR/test4_missing_blocker.js"
cp "$DIST_JS" "$TEST4_BUNDLE"

# Remove FATAL_UI_LEGACY_RESOLVER marker
sed -i 's/FATAL_UI_LEGACY_RESOLVER//g' "$TEST4_BUNDLE"

# Point index.html to test bundle
TEST4_DIR="$TEMP_TEST_DIR/test4_dist"
mkdir -p "$TEST4_DIR"
echo '<html><body><script src="app.test4.js"></script></body></html>' > "$TEST4_DIR/index.html"
cp "$TEST4_BUNDLE" "$TEST4_DIR/app.test4.js"

TESTS_RUN=$((TESTS_RUN + 1))
if bash "$GATE_INVOKE" "$TEMP_TEST_DIR/test4_dist" 2>&1 | grep -q "FAIL"; then
    echo "[GATE_SELFTEST]   ✓ Test 4 PASSED: Gate correctly rejected missing legacy blocker"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo "[GATE_SELFTEST]   ✗ Test 4 FAILED: Gate did NOT catch missing legacy blocker"
    FAIL=1
fi

# ========================================================================
# FINAL RESULT
# ========================================================================
echo "[GATE_SELFTEST] Mutation tests completed: $TESTS_PASSED/$TESTS_RUN passed"

if [ $FAIL -eq 0 ] && [ $TESTS_PASSED -eq $TESTS_RUN ]; then
    echo "[GATE_SELFTEST] PASS (all negative mutations caught)"
    exit 0
else
    echo "[GATE_SELFTEST] FAIL (some mutations escaped detection)"
    exit 1
fi
