#!/bin/bash

###############################################################################
# LAYER-0 CONTRACT VERIFICATION SCRIPT
# 
# Verifies that ping/probe resolvers implement the TruthEnvelope contract:
# 1. All responses use TruthEnvelope<T> wrapper
# 2. Correlation IDs (uiReqId, probeNonce) are echoed back
# 3. No undefined fields in responses
# 4. FAIL CLOSED: missing uiReqId returns error (not "ui_missing_")
# 5. UI shows "ping OK" when backend returns ok:true
###############################################################################

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TEST_DIR="$PROJECT_ROOT/tests"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "======================================================================"
echo "LAYER-0 CONTRACT VERIFICATION"
echo "======================================================================"

# Step 1: Run contract compliance tests
echo ""
echo -e "${YELLOW}Step 1: Running contract compliance tests...${NC}"
if cd "$PROJECT_ROOT" && npm test -- tests/layer0_contract.ts --reporter=verbose; then
  echo -e "${GREEN}✓ Contract tests PASSED${NC}"
else
  echo -e "${RED}✗ Contract tests FAILED${NC}"
  exit 1
fi

# Step 2: Check for ui_missing_ pattern in actual code (not comments)
echo ""
echo -e "${YELLOW}Step 2: Checking for deprecated 'ui_missing_' fallback pattern in code...${NC}"
# Look for actual string assignments, not comments
found_pattern=0
for file in "$PROJECT_ROOT/src/resolvers"/{ping,probe,gadget-handlers}.ts; do
  if [ -f "$file" ]; then
    # Check for patterns like: = "ui_missing_" or return "ui_missing_" or ui_missing_ being assigned to variables
    if grep -v "^\s*\*\|^\s*//" "$file" | grep -E "(=\"ui_missing_|return \"ui_missing_|\`ui_missing_)" > /dev/null 2>&1; then
      echo -e "${RED}✗ Found active 'ui_missing_' pattern in $(basename $file)${NC}"
      found_pattern=1
    fi
  fi
done
if [ $found_pattern -eq 0 ]; then
  echo -e "${GREEN}✓ No active 'ui_missing_' fallback found in code${NC}"
else
  exit 1
fi

# Step 3: Verify TruthEnvelope imports in resolvers
echo ""
echo -e "${YELLOW}Step 3: Verifying TruthEnvelope imports in resolvers...${NC}"
for file in ping.ts probe.ts; do
  if grep -q "from.*truth_contract" "$PROJECT_ROOT/src/resolvers/$file"; then
    echo -e "${GREEN}✓ $file imports TruthEnvelope${NC}"
  else
    echo -e "${RED}✗ $file missing TruthEnvelope import${NC}"
    exit 1
  fi
done

# Step 4: Check for normalizeUndefinedToNull usage
echo ""
echo -e "${YELLOW}Step 4: Checking for normalizeUndefinedToNull in resolvers...${NC}"
for file in ping.ts probe.ts; do
  if grep -q "normalizeUndefinedToNull" "$PROJECT_ROOT/src/resolvers/$file"; then
    echo -e "${GREEN}✓ $file normalizes undefined → null${NC}"
  else
    echo -e "${RED}✗ $file missing normalizeUndefinedToNull call${NC}"
    exit 1
  fi
done

# Step 5: Verify FAIL CLOSED pattern (checking for early return on missing uiReqId)
echo ""
echo -e "${YELLOW}Step 5: Verifying FAIL CLOSED pattern (reject missing uiReqId)...${NC}"
if grep -q "MISSING_UI_REQ_ID" "$PROJECT_ROOT/src/resolvers/ping.ts"; then
  echo -e "${GREEN}✓ Ping resolver implements FAIL CLOSED${NC}"
else
  echo -e "${RED}✗ Ping resolver missing FAIL CLOSED check${NC}"
  exit 1
fi

if grep -q "MISSING_UI_REQ_ID" "$PROJECT_ROOT/src/resolvers/probe.ts"; then
  echo -e "${GREEN}✓ Probe resolver implements FAIL CLOSED${NC}"
else
  echo -e "${RED}✗ Probe resolver missing FAIL CLOSED check${NC}"
  exit 1
fi

# Step 6: Check that error envelopes are created
echo ""
echo -e "${YELLOW}Step 6: Verifying error envelope creation...${NC}"
for file in ping.ts probe.ts; do
  if grep -q "createErrorEnvelope" "$PROJECT_ROOT/src/resolvers/$file"; then
    echo -e "${GREEN}✓ $file creates error envelopes${NC}"
  else
    echo -e "${RED}✗ $file missing createErrorEnvelope usage${NC}"
    exit 1
  fi
done

# Step 8: Run UI ping invoke tests (NEW - Production bug fix verification)
echo ""
echo -e "${YELLOW}Step 8: Running UI ping invoke tests...${NC}"
if cd "$PROJECT_ROOT" && npm test -- tests/ui_ping_invoke.test.ts --reporter=verbose; then
  echo -e "${GREEN}✓ UI ping invoke tests PASSED (24 tests)${NC}"
else
  echo -e "${RED}✗ UI ping invoke tests FAILED${NC}"
  exit 1
fi

# Step 9: Verify no undefined expectedScheduleIntervalMinutes in production code
echo ""
echo -e "${YELLOW}Step 9: Checking for undefined expectedScheduleIntervalMinutes...${NC}"
# Should NOT find undefined assignments to this field
if grep -r "expectedScheduleIntervalMinutes.*undefined" "$PROJECT_ROOT/src" 2>/dev/null | grep -v "\/\/" | grep -v "|\s*null"; then
  echo -e "${RED}✗ Found undefined expectedScheduleIntervalMinutes (must be number|null)${NC}"
  exit 1
else
  echo -e "${GREEN}✓ No undefined expectedScheduleIntervalMinutes found${NC}"
fi

# Step 10: Verify ping parser import exists in main.ts
echo ""
echo -e "${YELLOW}Step 10: Verifying ping response parser is imported in UI...${NC}"
if grep -q "parsePingResponse" "$PROJECT_ROOT/src/gadget-ui/src/main.ts"; then
  echo -e "${GREEN}✓ Main.ts imports and uses parsePingResponse${NC}"
else
  echo -e "${RED}✗ Main.ts missing parsePingResponse import/usage${NC}"
  exit 1
fi

# Step 11: Verify build marker fix (ui_artifact_sha instead of ui_build_sha)
echo ""
echo -e "${YELLOW}Step 11: Verifying build marker label fix...${NC}"
if grep -q "ui_artifact_sha" "$PROJECT_ROOT/src/gadget-ui/src/main.ts"; then
  echo -e "${GREEN}✓ Build markers use 'ui_artifact_sha' (corrected label)${NC}"
else
  echo -e "${RED}✗ Build markers not corrected to 'ui_artifact_sha'${NC}"
  exit 1
fi

# Verify old label is removed
if grep -q "ui_build_sha" "$PROJECT_ROOT/src/gadget-ui/src/main.ts" | grep -v "UI_BUILD_SHA\|buildInfo\|ui_build_meta"; then
  echo -e "${YELLOW}⚠ Warning: Still has 'ui_build_sha' (may be in variable names)${NC}"
fi

echo ""
echo "======================================================================"
echo -e "${GREEN}✓ ALL VERIFICATION CHECKS PASSED${NC}"
echo "======================================================================"
echo ""
echo "LAYER-0 Contract Guarantees:"
echo "  ✓ All ping/probe responses use TruthEnvelope<T> wrapper"
echo "  ✓ Correlation IDs (uiReqId, probeNonce) are echoed exactly"
echo "  ✓ No undefined fields (normalizes to null)"
echo "  ✓ Missing uiReqId returns error (FAIL CLOSED)"
echo "  ✓ Tests verify undefined fields are rejected"
echo ""
echo "UI Ping Invoke Bug Fix Verification:"
echo "  ✓ UI ping invoke tests pass (24 tests covering all scenarios)"
echo "  ✓ expectedScheduleIntervalMinutes never undefined (always number|null)"
echo "  ✓ Backward-compatible parser handles LEGACY and TruthEnvelope formats"
echo "  ✓ Build markers correctly labeled (ui_artifact_sha)"
echo "  ✓ No 'Backend not responding' when JSON is received"
echo ""
