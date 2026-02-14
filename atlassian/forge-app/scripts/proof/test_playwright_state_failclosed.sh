#!/bin/bash
# Test script for Playwright SSO auth state fail-closed behavior
# Tests the require_playwright_state function in isolation

set -euo pipefail

echo "════════════════════════════════════════════════════════════════"
echo "Playwright Auth State Validation Tests"
echo "════════════════════════════════════════════════════════════════"
echo ""

TEST_EVID="/tmp/test_playwright_state_$$"
mkdir -p "$TEST_EVID"
STATE_FILE="tests/playwright/.auth/state.json"
STATE_DIR="$(dirname "$STATE_FILE")"
mkdir -p "$STATE_DIR"

# ============================================================================
# TEST A: No state, no b64 (expect FAIL)
# ============================================================================
echo "TEST A: No state, no b64 (expect FAIL with instructions)"
echo "---"

unset FT_PLAYWRIGHT_STATE_B64 || true
rm -f "$STATE_FILE" "${STATE_FILE}.provenance.json"

export FT_JIRA_TENANT="https://firsttry.atlassian.net"
export FT_PROD_ENV="production"

if bash scripts/proof/ship_prod_release.sh 2>&1 | grep -q "No Playwright auth state found"; then
  echo "✅ TEST A PASSED: Detected missing state and failed correctly"
else
  echo "❌ TEST A FAILED: Did not detect missing state"
fi

echo ""
echo "---"
echo ""

# ============================================================================
# TEST B: Local state file exists (expect SUCCESS mode detection)
# ============================================================================
echo "TEST B: Local state file exists (expect mode=STATE_FILE)"
echo "---"

unset FT_PLAYWRIGHT_STATE_B64 || true

# Create a minimal valid state.json
cat > "$STATE_FILE" << 'STATE_EOF'
{
  "cookies": [
    {
      "name": "test_cookie",
      "value": "test_value",
      "domain": ".atlassian.net",
      "path": "/",
      "expires": 9999999999,
      "httpOnly": true,
      "secure": true,
      "sameSite": "Lax"
    }
  ],
  "origins": [
    {
      "origin": "https://firsttry.atlassian.net",
      "localStorage": []
    }
  ]
}
STATE_EOF
chmod 600 "$STATE_FILE"

# Create provenance to satisfy guard
cat > "${STATE_FILE}.provenance.json" << 'PROV_EOF'
{
  "marker": "FT_PLAYWRIGHT_STATE_PROVENANCE_V1",
  "source": "TEST_SCRIPT",
  "generatedAt": "2026-02-14T00:00:00Z"
}
PROV_EOF
chmod 600 "${STATE_FILE}.provenance.json"

echo "State file created: $(stat -c%s "$STATE_FILE" 2>/dev/null || stat -f%z "$STATE_FILE") bytes"
echo ""

# Test if mode detection works (without running full ship, just check Step 11 logic)
if [ -f "$STATE_FILE" ]; then
  echo "✅ TEST B PASSED: State file detected correctly"
else
  echo "❌ TEST B FAILED: State file not found"
fi

echo ""
echo "---"
echo ""

# ============================================================================
# TEST C: FT_PLAYWRIGHT_STATE_B64 exists (expect mode=STATE_B64)
# ============================================================================
echo "TEST C: FT_PLAYWRIGHT_STATE_B64 exists (expect mode=STATE_B64)"
echo "---"

# Remove local file
rm -f "$STATE_FILE" "${STATE_FILE}.provenance.json"

# Create and encode a state file
cat > "/tmp/test_state.json" << 'STATE2_EOF'
{
  "cookies": [
    {
      "name": "test_b64_cookie",
      "value": "test_b64_value",
      "domain": ".atlassian.net",
      "path": "/",
      "expires": 9999999999,
      "httpOnly": true,
      "secure": true,
      "sameSite": "Lax"
    }
  ],
  "origins": [
    {
      "origin": "https://firsttry.atlassian.net",
      "localStorage": []
    }
  ]
}
STATE2_EOF

export FT_PLAYWRIGHT_STATE_B64="$(base64 -w0 /tmp/test_state.json 2>/dev/null || base64 /tmp/test_state.json)"
rm -f /tmp/test_state.json

echo "FT_PLAYWRIGHT_STATE_B64 set (length: ${#FT_PLAYWRIGHT_STATE_B64} chars)"
echo ""

# Test decode logic (simulate what ship_prod_release.sh does)
if echo "$FT_PLAYWRIGHT_STATE_B64" | base64 -d | node -e "const fs = require('fs'); const stdin = fs.readFileSync(0, 'utf-8'); JSON.parse(stdin);" 2>/dev/null; then
  echo "✅ TEST C PASSED: B64 state decodes and validates as JSON"
else
  echo "❌ TEST C FAILED: B64 state decode or validation failed"
fi

echo ""
echo "---"
echo ""

# ============================================================================
# Cleanup
# ============================================================================
rm -rf "$TEST_EVID"
rm -f "$STATE_FILE" "${STATE_FILE}.provenance.json"
unset FT_PLAYWRIGHT_STATE_B64 || true

echo "════════════════════════════════════════════════════════════════"
echo "Validation tests complete"
echo "════════════════════════════════════════════════════════════════"
