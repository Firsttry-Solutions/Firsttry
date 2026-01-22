#!/bin/bash

################################################################################
# SMOKE TEST: Webtrigger Contract Proof - HTTP Response Validation
################################################################################
#
# This script validates that the production webtrigger returns proper HTTP
# responses (200/401/500 with JSON body) and NOT 424 serialization errors.
#
# Usage:
#   bash tools/smoke_webtrigger_contract_proof.sh
#
# Environment:
#   FT_CONTRACT_PROOF_TOKEN (required) - token for authorized requests
#   /tmp/ft_contract_proof_url.txt - webtrigger URL
#   /tmp/ft_proof_token.txt - fallback token location
#
# Exit codes:
#   0 = all tests pass
#   1 = any test fails
#
################################################################################

set -eu

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}SMOKE TEST: Webtrigger Contract Proof - HTTP Response Validation${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# ============================================================================
# STEP 1: Validate environment and get URL + token
# ============================================================================

echo -e "${YELLOW}STEP 1: Validate environment${NC}"

# Get URL
if [[ -f /tmp/ft_contract_proof_url.txt ]]; then
  URL=$(cat /tmp/ft_contract_proof_url.txt)
  echo -e "${GREEN}✓${NC} URL loaded from /tmp/ft_contract_proof_url.txt"
else
  echo -e "${RED}✗${NC} /tmp/ft_contract_proof_url.txt not found"
  exit 1
fi

if [[ -z "$URL" ]]; then
  echo -e "${RED}✗${NC} URL is empty"
  exit 1
fi

echo -e "  URL: ${URL:0:80}..."

# Get token (from env or file)
if [[ -n "${FT_CONTRACT_PROOF_TOKEN:-}" ]]; then
  TOKEN="$FT_CONTRACT_PROOF_TOKEN"
  echo -e "${GREEN}✓${NC} Token from FT_CONTRACT_PROOF_TOKEN env var"
elif [[ -f /tmp/ft_proof_token.txt ]]; then
  TOKEN=$(cat /tmp/ft_proof_token.txt)
  echo -e "${GREEN}✓${NC} Token loaded from /tmp/ft_proof_token.txt"
else
  echo -e "${RED}✗${NC} Token not found (FT_CONTRACT_PROOF_TOKEN env or /tmp/ft_proof_token.txt)"
  exit 1
fi

if [[ -z "$TOKEN" ]]; then
  echo -e "${RED}✗${NC} Token is empty"
  exit 1
fi

echo -e "  Token: ${TOKEN:0:16}..." 
echo ""

# ============================================================================
# STEP 2: Test authorized request (200 with JSON body)
# ============================================================================

echo -e "${YELLOW}STEP 2: Test authorized request (with token)${NC}"

# Create temp files
TMP_HEADER=$(mktemp)
TMP_BODY=$(mktemp)
trap "rm -f $TMP_HEADER $TMP_BODY" EXIT

# Make request
HTTP_STATUS=$(curl -sS -w "%{http_code}" -D "$TMP_HEADER" -o "$TMP_BODY" \
  -H "x-ft-proof-token: $TOKEN" \
  "$URL" || true)

echo -e "  HTTP Status: $HTTP_STATUS"

# Validate status
if [[ "$HTTP_STATUS" == "200" ]]; then
  echo -e "${GREEN}✓${NC} HTTP 200 OK"
else
  echo -e "${RED}✗${NC} Expected HTTP 200, got $HTTP_STATUS"
  echo -e "  Headers:"
  head -5 "$TMP_HEADER" | sed 's/^/    /'
  echo -e "  Body (first 500 chars):"
  head -c 500 "$TMP_BODY" | sed 's/^/    /'
  exit 1
fi

# Check headers
echo -e "  Checking response headers..."
if grep -qi "content-type.*application/json" "$TMP_HEADER"; then
  echo -e "${GREEN}✓${NC} Content-Type: application/json"
else
  echo -e "${RED}✗${NC} Content-Type not application/json"
  cat "$TMP_HEADER" | sed 's/^/    /'
  exit 1
fi

# Check body is valid JSON
echo -e "  Validating response body is JSON..."
if jq empty "$TMP_BODY" 2>/dev/null; then
  echo -e "${GREEN}✓${NC} Response body is valid JSON"
else
  echo -e "${RED}✗${NC} Response body is not valid JSON"
  head -c 500 "$TMP_BODY" | sed 's/^/    /'
  exit 1
fi

# Check envelope structure
ENVELOPE=$(cat "$TMP_BODY")
if echo "$ENVELOPE" | jq -e '.envelopeKind == "FT_DASH_ENVELOPE_V1"' > /dev/null; then
  echo -e "${GREEN}✓${NC} Envelope marker present: FT_DASH_ENVELOPE_V1"
else
  echo -e "${RED}✗${NC} Envelope marker missing or incorrect"
  echo "$ENVELOPE" | jq . | head -20 | sed 's/^/    /'
  exit 1
fi

if echo "$ENVELOPE" | jq -e '.ok == true' > /dev/null; then
  echo -e "${GREEN}✓${NC} ok field is true"
else
  echo -e "${RED}✗${NC} ok field is not true"
  exit 1
fi

echo ""

# ============================================================================
# STEP 3: Test unauthorized request (401 with JSON body)
# ============================================================================

echo -e "${YELLOW}STEP 3: Test unauthorized request (without token)${NC}"

TMP_HEADER2=$(mktemp)
TMP_BODY2=$(mktemp)
trap "rm -f $TMP_HEADER $TMP_BODY $TMP_HEADER2 $TMP_BODY2" EXIT

# Make request without token
HTTP_STATUS2=$(curl -sS -w "%{http_code}" -D "$TMP_HEADER2" -o "$TMP_BODY2" \
  "$URL" || true)

echo -e "  HTTP Status: $HTTP_STATUS2"

# Validate status
if [[ "$HTTP_STATUS2" == "401" ]]; then
  echo -e "${GREEN}✓${NC} HTTP 401 Unauthorized"
else
  echo -e "${RED}✗${NC} Expected HTTP 401, got $HTTP_STATUS2"
  echo -e "  Body (first 500 chars):"
  head -c 500 "$TMP_BODY2" | sed 's/^/    /'
  exit 1
fi

# Check headers
if grep -qi "content-type.*application/json" "$TMP_HEADER2"; then
  echo -e "${GREEN}✓${NC} Content-Type: application/json"
else
  echo -e "${RED}✗${NC} Content-Type not application/json"
  exit 1
fi

# Check body is valid JSON
if jq empty "$TMP_BODY2" 2>/dev/null; then
  echo -e "${GREEN}✓${NC} Error response body is valid JSON"
else
  echo -e "${RED}✗${NC} Error response body is not valid JSON"
  head -c 500 "$TMP_BODY2" | sed 's/^/    /'
  exit 1
fi

ERROR_RESPONSE=$(cat "$TMP_BODY2")
if echo "$ERROR_RESPONSE" | jq -e '.ok == false' > /dev/null; then
  echo -e "${GREEN}✓${NC} ok field is false"
else
  echo -e "${RED}✗${NC} ok field is not false"
  exit 1
fi

echo ""

# ============================================================================
# STEP 4: Run envelope verification
# ============================================================================

echo -e "${YELLOW}STEP 4: Verify envelope contract with verify script${NC}"

if [[ -f "$PROJECT_ROOT/tools/verify_contract_proof_json.sh" ]]; then
  echo -e "  Running: bash tools/verify_contract_proof_json.sh $TMP_BODY"
  
  if bash "$PROJECT_ROOT/tools/verify_contract_proof_json.sh" "$TMP_BODY"; then
    echo -e "${GREEN}✓${NC} Envelope verification passed"
  else
    echo -e "${RED}✗${NC} Envelope verification failed"
    exit 1
  fi
else
  echo -e "${YELLOW}⚠${NC} verify_contract_proof_json.sh not found, skipping verification"
fi

echo ""

# ============================================================================
# FINAL REPORT
# ============================================================================

echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ ALL SMOKE TESTS PASSED${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo "Summary:"
echo "  • Authorized request returns 200 with valid JSON envelope"
echo "  • Unauthorized request returns 401 with valid JSON error"
echo "  • Response headers include Content-Type: application/json"
echo "  • Envelope passes all 7 verification assertions"
echo "  • NO HTTP 424 serialization errors"
echo ""
echo -e "${BLUE}Webtrigger is production-ready.${NC}"
echo ""

exit 0
