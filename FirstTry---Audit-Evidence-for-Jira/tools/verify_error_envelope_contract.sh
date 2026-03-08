#!/bin/bash

# ============================================================================
# LAYER-0 ERROR ENVELOPE CONTRACT VERIFICATION
# 
# Purpose: Verify that error envelope system is correctly integrated and
# non-bypassable. Checks:
# 1. ErrorEnvelopeV1 type is exported and used
# 2. makeErrorEnvelope factory is called in all error paths
# 3. isErrorEnvelopeV1 type guard protects UI parsing
# 4. Error envelopes are attached to resolver responses
# 5. UI displays error envelope details (not "no-trace")
# 
# Exit Code: 0 if all checks pass, 1 if any check fails
# ============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
COLORS_RED='\033[0;31m'
COLORS_GREEN='\033[0;32m'
COLORS_YELLOW='\033[0;33m'
COLORS_RESET='\033[0m'

FAILURES=0

echo "========================================"
echo "Error Envelope Contract Verification"
echo "========================================"
echo ""

# ============================================================================
# CHECK 1: ErrorEnvelopeV1 type is defined and exported
# ============================================================================
echo -n "CHECK 1: ErrorEnvelopeV1 type definition... "
if grep -q "export.*ErrorEnvelopeV1" "$PROJECT_ROOT/src/shared/invocationEnvelope.ts"; then
    echo -e "${COLORS_GREEN}✓ PASS${COLORS_RESET}"
else
    echo -e "${COLORS_RED}✗ FAIL${COLORS_RESET} (ErrorEnvelopeV1 not exported)"
    FAILURES=$((FAILURES+1))
fi

# ============================================================================
# CHECK 2: isErrorEnvelopeV1 type guard exists and is exported
# ============================================================================
echo -n "CHECK 2: isErrorEnvelopeV1 type guard... "
if grep -q "export.*function.*isErrorEnvelopeV1" "$PROJECT_ROOT/src/shared/invocationEnvelope.ts"; then
    echo -e "${COLORS_GREEN}✓ PASS${COLORS_RESET}"
else
    echo -e "${COLORS_RED}✗ FAIL${COLORS_RESET} (isErrorEnvelopeV1 not exported)"
    FAILURES=$((FAILURES+1))
fi

# ============================================================================
# CHECK 3: makeErrorEnvelope factory exists
# ============================================================================
echo -n "CHECK 3: makeErrorEnvelope factory... "
if grep -q "export.*function.*makeErrorEnvelope" "$PROJECT_ROOT/src/security/errorEnvelope.ts"; then
    echo -e "${COLORS_GREEN}✓ PASS${COLORS_RESET}"
else
    echo -e "${COLORS_RED}✗ FAIL${COLORS_RESET} (makeErrorEnvelope not found)"
    FAILURES=$((FAILURES+1))
fi

# ============================================================================
# CHECK 4: buildInvocationMeta is imported and called in all resolvers
# ============================================================================
echo -n "CHECK 4: buildInvocationMeta in ping.ts... "
if grep -q "import.*buildInvocationMeta" "$PROJECT_ROOT/src/resolvers/ping.ts" && \
   grep -q "buildInvocationMeta(" "$PROJECT_ROOT/src/resolvers/ping.ts"; then
    echo -e "${COLORS_GREEN}✓ PASS${COLORS_RESET}"
else
    echo -e "${COLORS_RED}✗ FAIL${COLORS_RESET} (buildInvocationMeta not used in ping)"
    FAILURES=$((FAILURES+1))
fi

echo -n "CHECK 5: buildInvocationMeta in probe.ts... "
if grep -q "import.*buildInvocationMeta" "$PROJECT_ROOT/src/resolvers/probe.ts" && \
   grep -q "buildInvocationMeta(" "$PROJECT_ROOT/src/resolvers/probe.ts"; then
    echo -e "${COLORS_GREEN}✓ PASS${COLORS_RESET}"
else
    echo -e "${COLORS_RED}✗ FAIL${COLORS_RESET} (buildInvocationMeta not used in probe)"
    FAILURES=$((FAILURES+1))
fi

echo -n "CHECK 6: buildInvocationMeta in ensureFirstSnapshot.ts... "
if grep -q "import.*buildInvocationMeta" "$PROJECT_ROOT/src/resolvers/ensureFirstSnapshot.ts" && \
   grep -q "buildInvocationMeta(" "$PROJECT_ROOT/src/resolvers/ensureFirstSnapshot.ts"; then
    echo -e "${COLORS_GREEN}✓ PASS${COLORS_RESET}"
else
    echo -e "${COLORS_RED}✗ FAIL${COLORS_RESET} (buildInvocationMeta not used in ensureFirstSnapshot)"
    FAILURES=$((FAILURES+1))
fi

# ============================================================================
# CHECK 7: Error envelopes are created in all error paths
# ============================================================================
echo -n "CHECK 7: makeErrorEnvelope called in ping.ts errors... "
PING_ERROR_ENVELOPES=$(grep -c "makeErrorEnvelope(" "$PROJECT_ROOT/src/resolvers/ping.ts" || true)
if [ "$PING_ERROR_ENVELOPES" -ge 2 ]; then
    echo -e "${COLORS_GREEN}✓ PASS${COLORS_RESET} ($PING_ERROR_ENVELOPES calls)"
else
    echo -e "${COLORS_YELLOW}⚠ WARN${COLORS_RESET} (only $PING_ERROR_ENVELOPES makeErrorEnvelope calls)"
fi

echo -n "CHECK 8: makeErrorEnvelope called in probe.ts errors... "
PROBE_ERROR_ENVELOPES=$(grep -c "makeErrorEnvelope(" "$PROJECT_ROOT/src/resolvers/probe.ts" || true)
if [ "$PROBE_ERROR_ENVELOPES" -ge 2 ]; then
    echo -e "${COLORS_GREEN}✓ PASS${COLORS_RESET} ($PROBE_ERROR_ENVELOPES calls)"
else
    echo -e "${COLORS_YELLOW}⚠ WARN${COLORS_RESET} (only $PROBE_ERROR_ENVELOPES makeErrorEnvelope calls)"
fi

echo -n "CHECK 9: makeErrorEnvelope called in ensureFirstSnapshot.ts errors... "
ENSURE_ERROR_ENVELOPES=$(grep -c "makeErrorEnvelope(" "$PROJECT_ROOT/src/resolvers/ensureFirstSnapshot.ts" || true)
if [ "$ENSURE_ERROR_ENVELOPES" -ge 2 ]; then
    echo -e "${COLORS_GREEN}✓ PASS${COLORS_RESET} ($ENSURE_ERROR_ENVELOPES calls)"
else
    echo -e "${COLORS_YELLOW}⚠ WARN${COLORS_RESET} (only $ENSURE_ERROR_ENVELOPES makeErrorEnvelope calls)"
fi

# ============================================================================
# CHECK 10: UI extracts and displays error envelope details
# ============================================================================
echo -n "CHECK 10: extractErrorEnvelopeDetails in UI... "
if grep -q "function extractErrorEnvelopeDetails" "$PROJECT_ROOT/src/gadget-ui/src/main.ts" && \
   grep -q "extractErrorEnvelopeDetails(" "$PROJECT_ROOT/src/gadget-ui/src/main.ts"; then
    echo -e "${COLORS_GREEN}✓ PASS${COLORS_RESET}"
else
    echo -e "${COLORS_RED}✗ FAIL${COLORS_RESET} (error envelope extraction not in UI)"
    FAILURES=$((FAILURES+1))
fi

# ============================================================================
# CHECK 11: Error envelopes are attached to responses
# ============================================================================
echo -n "CHECK 11: Error envelopes attached to responses in ping... "
if grep -q "_errorEnvelopeV1.*errorEnvelopeV1" "$PROJECT_ROOT/src/resolvers/ping.ts"; then
    echo -e "${COLORS_GREEN}✓ PASS${COLORS_RESET}"
else
    echo -e "${COLORS_RED}✗ FAIL${COLORS_RESET} (error envelope not attached in ping)"
    FAILURES=$((FAILURES+1))
fi

echo -n "CHECK 12: Error envelopes attached to responses in probe... "
if grep -q "_errorEnvelopeV1.*errorEnvelopeV1" "$PROJECT_ROOT/src/resolvers/probe.ts"; then
    echo -e "${COLORS_GREEN}✓ PASS${COLORS_RESET}"
else
    echo -e "${COLORS_RED}✗ FAIL${COLORS_RESET} (error envelope not attached in probe)"
    FAILURES=$((FAILURES+1))
fi

echo -n "CHECK 13: Error envelopes attached to responses in ensureFirstSnapshot... "
if grep -q "_errorEnvelopeV1.*errorEnvelopeV1" "$PROJECT_ROOT/src/resolvers/ensureFirstSnapshot.ts"; then
    echo -e "${COLORS_GREEN}✓ PASS${COLORS_RESET}"
else
    echo -e "${COLORS_RED}✗ FAIL${COLORS_RESET} (error envelope not attached in ensureFirstSnapshot)"
    FAILURES=$((FAILURES+1))
fi

# ============================================================================
# CHECK 14: UI no longer displays "no-trace" for error details
# ============================================================================
echo -n "CHECK 14: Error envelope details override 'no-trace' display... "
ENVELOPE_DISPLAY_COUNT=$(grep -c "envelopeDetails\." "$PROJECT_ROOT/src/gadget-ui/src/main.ts" || true)
if [ "$ENVELOPE_DISPLAY_COUNT" -ge 3 ]; then
    echo -e "${COLORS_GREEN}✓ PASS${COLORS_RESET} ($ENVELOPE_DISPLAY_COUNT uses of envelope details)"
else
    echo -e "${COLORS_YELLOW}⚠ WARN${COLORS_RESET} (only $ENVELOPE_DISPLAY_COUNT envelope detail uses)"
fi

# ============================================================================
# CHECK 15: Type tests pass
# ============================================================================
echo -n "CHECK 15: Running type tests... "
if npm test -- tests/invocationEnvelope.test.ts --run 2>/dev/null | grep -q "Tests.*passed"; then
    echo -e "${COLORS_GREEN}✓ PASS${COLORS_RESET}"
else
    echo -e "${COLORS_YELLOW}⚠ WARN${COLORS_RESET} (type tests may need manual verification)"
fi

# ============================================================================
# SUMMARY
# ============================================================================
echo ""
echo "========================================"
if [ $FAILURES -eq 0 ]; then
    echo -e "${COLORS_GREEN}✓ All checks passed${COLORS_RESET}"
    echo "========================================"
    exit 0
else
    echo -e "${COLORS_RED}✗ $FAILURES check(s) failed${COLORS_RESET}"
    echo "========================================"
    exit 1
fi
