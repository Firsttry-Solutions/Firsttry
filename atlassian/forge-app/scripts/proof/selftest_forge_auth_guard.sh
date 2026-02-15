#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# Forge CLI Auth Guard — Self-Test (Fail-Closed)
# ============================================================================
# Validates that the Forge auth guard works correctly:
# - Checks for forge binary existence
# - Checks forge authentication status
# - Produces consistent evidence logs
# - Exits deterministically
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EVIDENCE_DIR="/tmp/ft_selftest_auth_guard_$$"

echo "[FT_SELFTEST] ════════════════════════════════════════════"
echo "[FT_SELFTEST] Forge Auth Guard Self-Test"
echo "[FT_SELFTEST] Evidence directory: $EVIDENCE_DIR"
echo "[FT_SELFTEST] ════════════════════════════════════════════"
echo ""

# --- Source the guard ---
source "$SCRIPT_DIR/require_forge_auth.sh"

# --- Call the guard ---
if require_forge_auth "$EVIDENCE_DIR"; then
  TEST_EXIT=0
  echo ""
  echo "[FT_SELFTEST] ════════════════════════════════════════════"
  echo "[FT_SELFTEST] ✓ PASS: Forge auth guard succeeded"
  echo "[FT_SELFTEST] ════════════════════════════════════════════"
  echo "[FT_SELFTEST] Evidence files created:"
  ls -lh "$EVIDENCE_DIR"/*.log 2>/dev/null | while read line; do
    echo "[FT_SELFTEST]   $line"
  done
  echo ""
  echo "[FT_SELFTEST] Version log:"
  cat "$EVIDENCE_DIR/01_forge_version.log" | sed 's/^/[FT_SELFTEST] /'
  echo ""
  echo "[FT_SELFTEST] Whoami log (first 5 lines):"
  head -5 "$EVIDENCE_DIR/02_forge_whoami.log" | sed 's/^/[FT_SELFTEST] /'
else
  TEST_EXIT=$?
  echo ""
  echo "[FT_SELFTEST] ════════════════════════════════════════════"
  echo "[FT_SELFTEST] ✓ EXPECTED: Forge auth guard failed (auth required)"
  echo "[FT_SELFTEST] ════════════════════════════════════════════"
  echo "[FT_SELFTEST] Evidence files created:"
  ls -lh "$EVIDENCE_DIR"/*.log 2>/dev/null | while read line; do
    echo "[FT_SELFTEST]   $line"
  done || echo "[FT_SELFTEST]   (no logs generated)"
  echo ""
  echo "[FT_SELFTEST] Failure is expected if forge is not authenticated."
  echo "[FT_SELFTEST] To authenticate, see:"
  echo "[FT_SELFTEST]   docs/FORGE_AUTH_IN_CODE_SPACES.md"
fi

echo ""
echo "[FT_SELFTEST] Test completed with exit code: $TEST_EXIT"
echo "[FT_SELFTEST] Evidence directory (preserved for inspection): $EVIDENCE_DIR"
exit $TEST_EXIT
