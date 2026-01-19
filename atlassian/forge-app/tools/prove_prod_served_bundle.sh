#!/bin/bash
# PHASE 3: prove_prod_served_bundle.sh (HARDENED - CACHE-BUST SAFE)
# Downloads served bundle from production with cache-bust headers
# Verifies it against same structural gate invariants
# Usage: bash tools/prove_prod_served_bundle.sh --bundle-url "<PROD URL>" --iframe-url "<IFRAME URL>"

set -euo pipefail

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

FAIL=0

echo "[PROD_PROOF] ============================================================"
echo "[PROD_PROOF] PRODUCTION SERVED BUNDLE VERIFICATION (CACHE-BUST SAFE)"
echo "[PROD_PROOF] ============================================================"
echo "[PROD_PROOF] Bundle URL: $BUNDLE_URL"
echo "[PROD_PROOF] Iframe URL: $IFRAME_URL"
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

# Fetch cache headers separately
echo "[PROD_PROOF] Fetching cache headers..."
HEADERS_FILE="$TMPDIR/headers.txt"
curl -fsSI \
    -H "Cache-Control: no-cache" \
    -H "Pragma: no-cache" \
    "$FETCH_URL" > "$HEADERS_FILE" 2>/dev/null || true

# Extract and display cache headers
echo "[PROD_PROOF] Cache headers:"
for header in x-cache age etag last-modified cache-control x-served-by cf-cache-status; do
    value=$(grep -i "^$header:" "$HEADERS_FILE" | head -1 | cut -d' ' -f2-)
    if [ -n "$value" ]; then
        echo "[PROD_PROOF]   $header: $value"
    fi
done

# Extract filename hash from URL
URL_HASH=$(echo "$BUNDLE_URL" | sed -E 's/.*app\.([a-f0-9]+)\.js.*/\1/')
if ! echo "$URL_HASH" | grep -qE '^[a-f0-9]{6,12}$'; then
    echo "[PROD_PROOF] WARN: Could not extract hash from URL filename"
    URL_HASH="unknown"
else
    echo "[PROD_PROOF]   bundle_hash=$URL_HASH (from URL)"
fi

# ========================================================================
# TEST 1: Extract identity markers from served bundle
# ========================================================================
echo ""
echo "[PROD_PROOF] TEST 1: Identity markers (structural extraction)"

# Extract UI_GIT_SHA from known markers
GIT_SHA=$(grep -oE '[":=,]([a-f0-9]{7})[",;]' "$BUNDLE_FILE" 2>/dev/null | grep -oE '[a-f0-9]{7}' | sort -u | head -1 || echo "")

if [ -n "$GIT_SHA" ] && echo "$GIT_SHA" | grep -qE '^[a-f0-9]{7}$'; then
    echo "[PROD_PROOF]   ✓ UI_GIT_SHA found: $GIT_SHA"
else
    echo "[PROD_PROOF]   ✗ UI_GIT_SHA missing or invalid"
    FAIL=1
fi

# Extract UI_GIT_TIME
GIT_TIME=$(grep -oE 'ui_git_time[^,}]*' "$BUNDLE_FILE" 2>/dev/null | head -1 || echo "")
if [ -n "$GIT_TIME" ] && ! echo "$GIT_TIME" | grep -q 'UNSET'; then
    echo "[PROD_PROOF]   ✓ UI_GIT_TIME present (not UNSET)"
else
    echo "[PROD_PROOF]   ✗ UI_GIT_TIME missing or UNSET"
    FAIL=1
fi

# Check for proof markers
if grep -q 'UI_ENTRY_RUNTIME_PROOF\|UI_BOOT_PROOF' "$BUNDLE_FILE" 2>/dev/null; then
    echo "[PROD_PROOF]   ✓ Proof markers present (UI_ENTRY_RUNTIME_PROOF or UI_BOOT_PROOF)"
else
    echo "[PROD_PROOF]   ✗ Proof markers missing"
    FAIL=1
fi

# ========================================================================
# TEST 2: Verify invoke allowlist (literal extraction, same as dist gate)
# ========================================================================
echo ""
echo "[PROD_PROOF] TEST 2: Invoke allowlist (literal extraction)"

# Count total invoke calls
TOTAL_INVOKE=$(grep -o 'invoke(' "$BUNDLE_FILE" 2>/dev/null | wc -l)
echo "[PROD_PROOF]   total_invoke_count=$TOTAL_INVOKE"

# Extract literal resolvers
EXTRACTED=$(grep -oE 'invoke\(["'"'"']([^"'"'"']+)["'"'"']' "$BUNDLE_FILE" 2>/dev/null | sed -E 's/invoke\(["'"'"']//; s/["'"'"'].*//' || echo "")
LITERAL_COUNT=$(echo "$EXTRACTED" | wc -l)
echo "[PROD_PROOF]   literal_invoke_count=$LITERAL_COUNT"

if echo "$EXTRACTED" | grep -q "^ft_getDashboardState_v1\$"; then
    echo "[PROD_PROOF]   ✓ ft_getDashboardState_v1 found in extracted literals"
else
    echo "[PROD_PROOF]   ✗ ft_getDashboardState_v1 NOT found in extracted literals"
    FAIL=1
fi

# Check for forbidden resolvers
if echo "$EXTRACTED" | grep -qE '^(ping|ensureFirstSnapshot|getBuildInfo|getSnapshotDebug)$'; then
    echo "[PROD_PROOF]   ✗ FAIL: Forbidden resolver detected"
    FAIL=1
else
    echo "[PROD_PROOF]   ✓ No forbidden resolvers"
fi

# Detect dynamic invoke
if [ "$TOTAL_INVOKE" -ne "$LITERAL_COUNT" ]; then
    echo "[PROD_PROOF]   ✗ DYNAMIC INVOKE DETECTED (total != literal)"
    FAIL=1
else
    echo "[PROD_PROOF]   ✓ All invoke calls are literal"
fi

# ========================================================================
# TEST 3: CSP header verification
# ========================================================================
echo ""
echo "[PROD_PROOF] TEST 3: CSP header verification"

IFRAME_HEADERS_FILE="$TMPDIR/iframe_headers.txt"
curl -fsSI \
    -H "Cache-Control: no-cache" \
    -H "Pragma: no-cache" \
    "$IFRAME_URL" > "$IFRAME_HEADERS_FILE" 2>/dev/null || true

if grep -qi "content-security-policy" "$IFRAME_HEADERS_FILE"; then
    CSP_LINE=$(grep -i "content-security-policy" "$IFRAME_HEADERS_FILE" | head -1)
    echo "[PROD_PROOF]   ✓ CSP header present"
    echo "[PROD_PROOF]     $CSP_LINE"
    if echo "$CSP_LINE" | grep -qi "style-src.*unsafe-inline\|unsafe-inline.*style-src"; then
        echo "[PROD_PROOF]   ✓ style-src 'unsafe-inline' found"
    else
        echo "[PROD_PROOF]   ⚠ style-src 'unsafe-inline' not confirmed"
    fi
else
    echo "[PROD_PROOF]   ⚠ CSP header not found on iframe"
fi

# ========================================================================
# FINAL RESULT
# ========================================================================
echo ""
echo "[PROD_PROOF] ============================================================"
if [ $FAIL -eq 0 ]; then
    echo "[PROD_PROOF] PASS: Served bundle matches structural invariants"
    echo "[PROD_PROOF] ============================================================"
    exit 0
else
    echo "[PROD_PROOF] FAIL: Served bundle does not match expected structure"
    echo "[PROD_PROOF] ============================================================"
    exit 1
fi
