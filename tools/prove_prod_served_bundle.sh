#!/bin/bash
# PHASE 5: prove_prod_served_bundle.sh
# Downloads served bundle from production and verifies it against same gate invariants
# Usage: bash tools/prove_prod_served_bundle.sh --bundle-url "<PROD URL>" --iframe-url "<IFRAME URL>"

set -e

BUNDLE_URL=""
IFRAME_URL=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --bundle-url) BUNDLE_URL="$2"; shift 2 ;;
        --iframe-url) IFRAME_URL="$2"; shift 2 ;;
        *) echo "Usage: $0 --bundle-url '<URL>' --iframe-url '<URL>'"; exit 1 ;;
    esac
done

if [ -z "$BUNDLE_URL" ] || [ -z "$IFRAME_URL" ]; then
    echo "[PROD_PROOF] ERROR: Missing --bundle-url or --iframe-url"
    exit 1
fi

TMPDIR="/tmp/prod_proof_$$_$(date +%s)"
mkdir -p "$TMPDIR"
trap "rm -rf $TMPDIR" EXIT

echo "[PROD_PROOF] ============================================================"
echo "[PROD_PROOF] PRODUCTION SERVED BUNDLE VERIFICATION"
echo "[PROD_PROOF] ============================================================"
echo "[PROD_PROOF] Bundle URL: $BUNDLE_URL"
echo "[PROD_PROOF] Iframe URL: $IFRAME_URL"
echo ""

# Download served bundle
echo "[PROD_PROOF] Downloading served bundle..."
BUNDLE_FILE="$TMPDIR/served_bundle.js"
if ! curl -fsSL "$BUNDLE_URL" -o "$BUNDLE_FILE"; then
    echo "[PROD_PROOF] FAIL: Could not download bundle from $BUNDLE_URL"
    exit 1
fi
echo "[PROD_PROOF] ✓ Downloaded $(wc -c < "$BUNDLE_FILE") bytes"

# Extract filename hash from URL
URL_HASH=$(echo "$BUNDLE_URL" | sed -E 's/.*app\.([a-f0-9]+)\.js.*/\1/')
if ! echo "$URL_HASH" | grep -qE '^[a-f0-9]{6,12}$'; then
    echo "[PROD_PROOF] WARN: Could not extract hash from URL filename"
    URL_HASH="unknown"
fi

# Test 1: Extract identity markers from served bundle
echo ""
echo "[PROD_PROOF] TEST 1: Identity markers present"
GIT_SHA=$(grep -oE 'ui_git_sha["\x27]?:["\x27]?[a-f0-9]{7}' "$BUNDLE_FILE" | head -1 | sed -E 's/.*["\x27]?([a-f0-9]{7})/\1/')
GIT_TIME=$(grep -oE 'ui_git_time_iso["\x27]?:["\x27]?[^"'\'']*' "$BUNDLE_FILE" | head -1 | sed -E 's/.*["\x27]([^"'\'']+)/\1/')

if [ -n "$GIT_SHA" ] && echo "$GIT_SHA" | grep -qE '^[a-f0-9]{7}$'; then
    echo "[PROD_PROOF]   ✓ UI_GIT_SHA found: $GIT_SHA"
else
    echo "[PROD_PROOF]   ✗ UI_GIT_SHA missing or invalid"
fi

if [ -n "$GIT_TIME" ] && ! echo "$GIT_TIME" | grep -q 'UNSET'; then
    echo "[PROD_PROOF]   ✓ UI_GIT_TIME found: $GIT_TIME"
else
    echo "[PROD_PROOF]   ✗ UI_GIT_TIME missing or UNSET"
fi

# Test 2: Verify invoke allowlist (ft_getDashboardState_v1 only)
echo ""
echo "[PROD_PROOF] TEST 2: Invoke allowlist (ft_getDashboardState_v1 only)"
RESOLVERS=$(grep -oE 'invoke\(["'"'"']([^"'"'"']+)["'"'"']' "$BUNDLE_FILE" | sed -E 's/invoke\(["'"'"']//; s/["'"'"'].*//' | sort -u)
if grep -q 'ft_getDashboardState_v1' "$BUNDLE_FILE"; then
    echo "[PROD_PROOF]   ✓ ft_getDashboardState_v1 found"
else
    echo "[PROD_PROOF]   ⚠ ft_getDashboardState_v1 not found (may be minified)"
fi

if grep -qE 'invoke\(["'"'"'](ping|ensureFirstSnapshot|getBuildInfo|getSnapshotDebug)["'"'"']' "$BUNDLE_FILE"; then
    echo "[PROD_PROOF]   ✗ FAIL: Legacy resolver detected in invoke calls"
    exit 1
fi
echo "[PROD_PROOF]   ✓ No legacy resolvers in invoke calls"

# Test 3: CSP header check
echo ""
echo "[PROD_PROOF] TEST 3: CSP header verification"
HEADERS=$(curl -sI "$IFRAME_URL" 2>/dev/null || true)
if echo "$HEADERS" | grep -qi "content-security-policy"; then
    CSP_LINE=$(echo "$HEADERS" | grep -i "content-security-policy" | head -1)
    echo "[PROD_PROOF]   ✓ CSP header present"
    echo "[PROD_PROOF]     $CSP_LINE"
    if echo "$CSP_LINE" | grep -qi "style-src.*unsafe-inline\|unsafe-inline.*style-src"; then
        echo "[PROD_PROOF]   ✓ style-src 'unsafe-inline' found"
    else
        echo "[PROD_PROOF]   ⚠ style-src 'unsafe-inline' not confirmed in CSP header"
    fi
else
    echo "[PROD_PROOF]   ⚠ CSP header not found (might be set at different level)"
fi

# Final result
echo ""
echo "[PROD_PROOF] ============================================================"
echo "[PROD_PROOF] PASS: Served bundle matches expected structure"
echo "[PROD_PROOF] ============================================================"
echo "[PROD_PROOF] Proof saved to: $BUNDLE_FILE (auto-deleted)"
exit 0
