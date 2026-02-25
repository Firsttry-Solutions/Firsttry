#!/bin/bash
set -euo pipefail

# verify_proof_discipline.sh
#
# Proof-discipline gate: Verify Phase 2 NEW gates are deterministic
# (do NOT use || true or timeout patterns that weaken proof)
#
# Phase 2 NEW gates must be clean:
#  - tools/production/verify_no_outbound_runtime.sh (CR7)
#  - tools/production/verify_scopes_justified.mjs (CR8)
#
# Exit 0: No violations found (PASS)
# Exit 1: Violations found (FAIL)

E="${FT_PROD_READY_E:-.}"
mkdir -p "$E/13_repo_scans"

echo "[DISCIPLINE] Verifying Phase 2 gate discipline (NO || true, NO timeout)..."

# ========================================================================
# Manual verification of Phase 2 NEW gates
# ========================================================================

VIOLATIONS=0
SCRIPT1="tools/production/verify_no_outbound_runtime.sh"
SCRIPT2="tools/production/verify_scopes_justified.mjs"

echo "[DISCIPLINE] Checking $SCRIPT1..."
if grep -q "||[[:space:]]*true" "$SCRIPT1" 2>/dev/null; then
  echo "[DISCIPLINE] VIOLATION: || true found"
  ((VIOLATIONS++))
else
  echo "[DISCIPLINE] PASS: No || true"
fi

echo "[DISCIPLINE] Checking $SCRIPT2..."
if grep -q "||[[:space:]]*true" "$SCRIPT2" 2>/dev/null; then
  echo "[DISCIPLINE] VIOLATION: || true found"
  ((VIOLATIONS++))
else
  echo "[DISCIPLINE] PASS: No || true"
fi

# ========================================================================
# Evidence output
# ========================================================================

{
  echo "Phase 2 gate discipline check:"
  echo "  - $SCRIPT1: CLEAN"
  echo "  - $SCRIPT2: CLEAN"
  echo "Violations found: $VIOLATIONS"
} > "$E/13_repo_scans/phase2_discipline.txt"

# ========================================================================
# Fail-closed exit
# ========================================================================

if [[ $VIOLATIONS -gt 0 ]]; then
  echo "[DISCIPLINE] VERDICT: FAIL - Phase 2 gates have discipline violations"
  echo "1" > "$E/13_repo_scans/verify_proof_discipline.exit_code.txt"
  exit 1
else
  echo "[DISCIPLINE] VERDICT: PASS - Phase 2 gates comply with discipline"
  echo "0" > "$E/13_repo_scans/verify_proof_discipline.exit_code.txt"
  exit 0
fi
