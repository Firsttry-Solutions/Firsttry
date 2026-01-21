#!/bin/bash
#
# fetch_and_verify_contract_proof_prod.sh
#
# Fetch production contract proof artifact with token authentication
# and verify it against deterministic assertions.
#
# Requirements:
#   - FT_CONTRACT_PROOF_TOKEN env var set with production token
#   - /tmp/ft_contract_proof_url.txt containing webtrigger URL
#   - verify_contract_proof_json.sh script available
#
# Usage:
#   export FT_CONTRACT_PROOF_TOKEN="your-token-here"
#   bash tools/fetch_and_verify_contract_proof_prod.sh
#
# Exit codes:
#   0 = Fetch succeeded, verification passed
#   1 = Fetch failed or verification failed
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "════════════════════════════════════════════════════════════════"
echo "FETCH & VERIFY PRODUCTION CONTRACT PROOF"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Check token is set
if [[ -z "${FT_CONTRACT_PROOF_TOKEN:-}" ]]; then
  echo "❌ ERROR: FT_CONTRACT_PROOF_TOKEN env var not set"
  echo ""
  echo "Usage:"
  echo "  export FT_CONTRACT_PROOF_TOKEN=\"your-token\""
  echo "  bash $0"
  exit 1
fi

# Check URL file exists
if [[ ! -f /tmp/ft_contract_proof_url.txt ]]; then
  echo "❌ ERROR: /tmp/ft_contract_proof_url.txt not found"
  echo ""
  echo "Create it with:"
  echo "  echo 'https://...' > /tmp/ft_contract_proof_url.txt"
  exit 1
fi

URL=$(cat /tmp/ft_contract_proof_url.txt)

if [[ -z "$URL" ]]; then
  echo "❌ ERROR: URL file is empty"
  exit 1
fi

echo "URL: $URL"
echo "Token: [REDACTED]"
echo ""

# Fetch with token header
echo "Fetching production artifact with token..."
if ! curl -fsSL -H "x-ft-proof-token: $FT_CONTRACT_PROOF_TOKEN" "$URL" \
  -o /tmp/ft_contract_proof_prod.json 2>&1; then
  echo "❌ ERROR: Failed to fetch production artifact"
  exit 1
fi

echo "✓ Artifact fetched successfully"
echo ""

# Test negative case: verify 401 without token
echo "Testing negative case (no token should give 401)..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$URL" 2>&1 || true)
if [[ "$HTTP_CODE" == "401" ]]; then
  echo "✓ Correctly denied request without token (HTTP 401)"
else
  echo "⚠ WARNING: Expected 401 for no-token request, got HTTP $HTTP_CODE"
fi

echo ""

# Verify the artifact
echo "Running verification script..."
if bash "$REPO_ROOT/tools/verify_contract_proof_json.sh" /tmp/ft_contract_proof_prod.json; then
  echo ""
  echo "════════════════════════════════════════════════════════════════"
  echo "✅ SUCCESS: Production proof verified"
  echo "════════════════════════════════════════════════════════════════"
  exit 0
else
  echo ""
  echo "════════════════════════════════════════════════════════════════"
  echo "❌ FAILED: Verification failed"
  echo "════════════════════════════════════════════════════════════════"
  exit 1
fi
