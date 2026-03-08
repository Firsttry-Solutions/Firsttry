#!/bin/bash
# GATE PROD_PROOF: prove_prod_served_bundle.sh (NON-BYPASSABLE)
# Verifies served bundle matches expected identity values
# Requires --expected-git-sha and --expected-bundle-hash parameters
# FAILS if served bundle doesn't match expected values
# Usage: bash tools/prove_prod_served_bundle.sh --bundle-url "<URL>" \
#        --expected-git-sha "86bdc7b" --expected-bundle-hash "f1c06fb"

set -euo pipefail

BUNDLE_URL=""
EXPECTED_GIT_SHA=""
EXPECTED_BUNDLE_HASH=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --bundle-url) BUNDLE_URL="$2"; shift 2 ;;
        --expected-git-sha) EXPECTED_GIT_SHA="$2"; shift 2 ;;
        --expected-bundle-hash) EXPECTED_BUNDLE_HASH="$2"; shift 2 ;;
        *) 
            echo "Usage: $0 --bundle-url '<URL>' --expected-git-sha '<SHA>' --expected-bundle-hash '<HASH>'"
            exit 1
        ;;
    esac
done

if [ -z "$BUNDLE_URL" ] || [ -z "$EXPECTED_GIT_SHA" ] || [ -z "$EXPECTED_BUNDLE_HASH" ]; then
    echo "[PROD_PROOF] ERROR: Missing required parameters"
    echo "[PROD_PROOF]   --bundle-url: $BUNDLE_URL"
    echo "[PROD_PROOF]   --expected-git-sha: $EXPECTED_GIT_SHA"
    echo "[PROD_PROOF]   --expected-bundle-hash: $EXPECTED_BUNDLE_HASH"
    exit 1
fi

# Validate expected SHA format
if ! echo "$EXPECTED_GIT_SHA" | grep -qE '^[a-f0-9]{7}$'; then
    echo "[PROD_PROOF] ERROR: --expected-git-sha must be 7 hex characters"
    exit 1
fi

if ! echo "$EXPECTED_BUNDLE_HASH" | grep -qE '^[a-f0-9]{6,12}$'; then
    echo "[PROD_PROOF] ERROR: --expected-bundle-hash must be 6-12 hex characters"
    exit 1
fi

TMPDIR="/tmp/prod_proof_$$_$(date +%s)"
mkdir -p "$TMPDIR"
trap "rm -rf $TMPDIR" EXIT

FAIL=0

echo "[PROD_PROOF] ============================================================"
echo "[PROD_PROOF] PRODUCTION SERVED BUNDLE VERIFICATION (EXPECTED VALUES)"
echo "[PROD_PROOF] ============================================================"
echo "[PROD_PROOF] Bundle URL: $BUNDLE_URL"
echo "[PROD_PROOF] Expected git_sha: $EXPECTED_GIT_SHA"
echo "[PROD_PROOF] Expected bundle_hash: $EXPECTED_BUNDLE_HASH"
echo ""

# ========================================================================
# DOWNLOAD: Served bundle with cache-bust headers
# ========================================================================
echo "[PROD_PROOF] Fetching bundle with cache-bust headers..."
BUNDLE_FILE="$TMPDIR/served_bundle.js"
CACHE_BUST="$(date +%s)"

# Add cache bust to URL if not already present
if echo "$BUNDLE_URL" | grep -q "\?"; then
    FETCH_URL="$BUNDLE_URL&cb=$CACHE_BUST"
else
    FETCH_URL="$BUNDLE_URL?cb=$CACHE_BUST"
fi

# Fetch with no-cache headers
if ! curl -fsSL \
    -H "Cache-Control: no-cache" \
    -H "Pragma: no-cache" \
    -H "Cache-Control: max-age=0" \
    "$FETCH_URL" -o "$BUNDLE_FILE"; then
    echo "[PROD_PROOF] FAIL: Could not download bundle from $FETCH_URL"
    exit 1
fi

BUNDLE_SIZE=$(wc -c < "$BUNDLE_FILE")
echo "[PROD_PROOF]   ✓ Downloaded $BUNDLE_SIZE bytes"

# ========================================================================
# EXTRACT: Served git_sha from bundle proof marker
# Pattern: ui_git_sha:"<7-hex>"
# ========================================================================
echo "[PROD_PROOF] Extracting served identity..."
SERVED_GIT_SHA=$(grep -oE 'ui_git_sha:"[a-f0-9]{7,}"' "$BUNDLE_FILE" 2>/dev/null | head -1 | sed 's/ui_git_sha:"//' | sed 's/"$//' || echo "")

if [ -z "$SERVED_GIT_SHA" ]; then
    echo "[PROD_PROOF] ✗ Served git_sha NOT FOUND in bundle"
    FAIL=1
elif ! echo "$SERVED_GIT_SHA" | grep -qE '^[a-f0-9]{7}$'; then
    echo "[PROD_PROOF] ✗ Served git_sha INVALID FORMAT: $SERVED_GIT_SHA"
    FAIL=1
else
    echo "[PROD_PROOF]   served_git_sha=$SERVED_GIT_SHA"
fi

# ========================================================================
# EXTRACT: Served bundle_hash from bundle filename or content
# Pattern: ui_bundle_hash:"<6-12-hex>"
# ========================================================================
SERVED_BUNDLE_HASH=$(grep -oE 'ui_bundle_hash:"[a-f0-9]{6,12}"' "$BUNDLE_FILE" 2>/dev/null | head -1 | sed 's/ui_bundle_hash:"//' | sed 's/"$//' || echo "")

if [ -z "$SERVED_BUNDLE_HASH" ]; then
    # Try extracting from URL filename as fallback
    SERVED_BUNDLE_HASH=$(echo "$BUNDLE_URL" | sed -E 's/.*app\.([a-f0-9]{6,12})\.js.*/\1/' || echo "")
fi

if [ -z "$SERVED_BUNDLE_HASH" ]; then
    echo "[PROD_PROOF] ✗ Served bundle_hash NOT FOUND"
    FAIL=1
elif ! echo "$SERVED_BUNDLE_HASH" | grep -qE '^[a-f0-9]{6,12}$'; then
    echo "[PROD_PROOF] ✗ Served bundle_hash INVALID FORMAT: $SERVED_BUNDLE_HASH"
    FAIL=1
else
    echo "[PROD_PROOF]   served_bundle_hash=$SERVED_BUNDLE_HASH"
fi

# ========================================================================
# CHECK 1: Served git_sha MUST equal expected git_sha
# ========================================================================
echo ""
echo "[PROD_PROOF] Verification..."
if [ "$SERVED_GIT_SHA" = "$EXPECTED_GIT_SHA" ]; then
    echo "[PROD_PROOF]   ✓ git_sha matches: $SERVED_GIT_SHA == $EXPECTED_GIT_SHA"
else
    echo "[PROD_PROOF]   ✗ git_sha MISMATCH"
    echo "[PROD_PROOF]     served:   $SERVED_GIT_SHA"
    echo "[PROD_PROOF]     expected: $EXPECTED_GIT_SHA"
    FAIL=1
fi

# ========================================================================
# CHECK 2: Served bundle_hash MUST equal expected bundle_hash
# ========================================================================
if [ "$SERVED_BUNDLE_HASH" = "$EXPECTED_BUNDLE_HASH" ]; then
    echo "[PROD_PROOF]   ✓ bundle_hash matches: $SERVED_BUNDLE_HASH == $EXPECTED_BUNDLE_HASH"
else
    echo "[PROD_PROOF]   ✗ bundle_hash MISMATCH"
    echo "[PROD_PROOF]     served:   $SERVED_BUNDLE_HASH"
    echo "[PROD_PROOF]     expected: $EXPECTED_BUNDLE_HASH"
    FAIL=1
fi

# ========================================================================
# CHECK 3: Verify git_sha != bundle_hash (distinctness)
# ========================================================================
if [ "$SERVED_GIT_SHA" = "$SERVED_BUNDLE_HASH" ]; then
    echo "[PROD_PROOF]   ✗ DISTINCTNESS FAILED: git_sha == bundle_hash"
    FAIL=1
else
    echo "[PROD_PROOF]   ✓ Distinctness: git_sha != bundle_hash"
fi

# ========================================================================
# CHECK 4: Verify proof marker exists
# ========================================================================
if grep -q 'UI_ENTRY_RUNTIME_PROOF' "$BUNDLE_FILE" 2>/dev/null; then
    echo "[PROD_PROOF]   ✓ Proof marker present: UI_ENTRY_RUNTIME_PROOF"
else
    echo "[PROD_PROOF]   ✗ Proof marker MISSING"
    FAIL=1
fi

# ========================================================================
# FINAL RESULT
# ========================================================================
echo ""
echo "[PROD_PROOF] ============================================================"
if [ $FAIL -eq 0 ]; then
    echo "[PROD_PROOF] PASS: Served bundle identity verified"
    echo "[PROD_PROOF] ============================================================"
    exit 0
else
    echo "[PROD_PROOF] FAIL: Served bundle does not match expected identity"
    echo "[PROD_PROOF] ============================================================"
    exit 1
fi
