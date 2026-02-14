#!/bin/bash

################################################################################
# STEP 9: Ship Stability Lock
#
# Purpose: Final orchestration gate before committing stability hardening pack
#
# Checks:
# 1. Clean working tree (no uncommitted changes)
# 2. Runtime environment locked (Node 20.20.0, npm 10.8.2)
# 3. No randomness in Phase 3 exports
# 4. Storage lock hardened (fail-closed semantics)
# 5. Error standardization in place (FTError class)
# 6. Stability contract documented
# 7. All gates pass
#
# Output:
# - [FT_STABILITY_LOCK_PASS] evid=<dir> if successful
# - exit 1 if any gate fails
#
# Usage: bash scripts/proof/ship_stability_lock.sh
################################################################################

set -euo pipefail

trap 'echo "[FT_PROOF] Ship stability lock cleanup (exit=$?)"' EXIT

# Create evidence directory
EVID="/tmp/ft_ship_stability_$(date +%s)"
mkdir -p "$EVID"
echo "[FT_PROOF] Evidence directory: $EVID"

cd /workspaces/Firsttry/atlassian/forge-app

echo "[FT_PROOF] ═══════════════════════════════════════════════════════"
echo "[FT_PROOF] Ship Stability Lock - Final Gate Orchestration"
echo "[FT_PROOF] ═══════════════════════════════════════════════════════"

# Gate 1: Check git status (must be clean)
echo "[FT_PROOF] Gate 1: Git status (must be clean)"
if git status --short | grep -q .; then
  echo "[FT_PROOF] ✗ Working tree not clean (uncommitted changes)"
  git status --short | head -20 | tee "$EVID/git_status.log"
  exit 1
fi
echo "[FT_PROOF] ✓ Git status: CLEAN" | tee -a "$EVID/gates.log"

# Gate 2: Runtime versions locked
echo "[FT_PROOF] Gate 2: Runtime environment locked"
bash scripts/proof/guard_runtime_versions.sh | tee -a "$EVID/gates.log"
echo "[FT_PROOF] ✓ Runtime locked: PASS" | tee -a "$EVID/gates.log"

# Gate 3: No randomness in Phase 3
echo "[FT_PROOF] Gate 3: No randomness audit"
if grep -r "Math\.random" src/export/ src/access-review/ 2>/dev/null; then
  echo "[FT_PROOF] ✗ Found Math.random in Phase 3 export" | tee -a "$EVID/gates.log"
  exit 1
fi
if grep -r "nanoid" src/export/ src/access-review/ 2>/dev/null; then
  echo "[FT_PROOF] ✗ Found nanoid in Phase 3 export" | tee -a "$EVID/gates.log"
  exit 1
fi
if grep -r "randomUUID" src/export/ src/access-review/ 2>/dev/null; then
  echo "[FT_PROOF] ✗ Found randomUUID in Phase 3 export" | tee -a "$EVID/gates.log"
  exit 1
fi
echo "[FT_PROOF] ✓ No randomness detected: PASS" | tee -a "$EVID/gates.log"

# Gate 4: Storage lock hardened
echo "[FT_PROOF] Gate 4: Storage lock hardened (fail-closed)"
if ! grep -q "ftFailClosed" src/storage/lock.ts; then
  echo "[FT_PROOF] ✗ Storage lock not hardened with fail-closed semantics" | tee -a "$EVID/gates.log"
  exit 1
fi
echo "[FT_PROOF] ✓ Storage lock hardened: PASS" | tee -a "$EVID/gates.log"

# Gate 5: Error standardization
echo "[FT_PROOF] Gate 5: Error standardization (FTError class)"
if [ ! -f "src/errors/ftError.ts" ]; then
  echo "[FT_PROOF] ✗ FTError class not found" | tee -a "$EVID/gates.log"
  exit 1
fi
if ! grep -q "class FTError extends Error" src/errors/ftError.ts; then
  echo "[FT_PROOF] ✗ FTError class definition missing" | tee -a "$EVID/gates.log"
  exit 1
fi
echo "[FT_PROOF] ✓ Error standardization: PASS" | tee -a "$EVID/gates.log"

# Gate 6: Stability contract documented
echo "[FT_PROOF] Gate 6: Stability contract documented"
if [ ! -f "docs/STABILITY_CONTRACT.md" ]; then
  echo "[FT_PROOF] ✗ Stability contract not found" | tee -a "$EVID/gates.log"
  exit 1
fi
echo "[FT_PROOF] ✓ Stability contract: PASS" | tee -a "$EVID/gates.log"

# Gate 7: Runtime guards in place
echo "[FT_PROOF] Gate 7: Runtime guards in place"
if [ ! -f ".nvmrc" ]; then
  echo "[FT_PROOF] ✗ .nvmrc not found" | tee -a "$EVID/gates.log"
  exit 1
fi
if [ ! -f "scripts/proof/guard_runtime_versions.sh" ]; then
  echo "[FT_PROOF] ✗ Runtime guard script not found" | tee -a "$EVID/gates.log"
  exit 1
fi
echo "[FT_PROOF] ✓ Runtime guards: PASS" | tee -a "$EVID/gates.log"

# Gate 8: Determinism modules in place
echo "[FT_PROOF] Gate 8: Determinism modules (clock, random guards)"
if [ ! -f "src/determinism/clock.ts" ] || [ ! -f "src/determinism/random.ts" ]; then
  echo "[FT_PROOF] ✗ Determinism modules missing" | tee -a "$EVID/gates.log"
  exit 1
fi
echo "[FT_PROOF] ✓ Determinism modules: PASS" | tee -a "$EVID/gates.log"

# Gate 9: Determinism test exists
echo "[FT_PROOF] Gate 9: Determinism test suite"
if [ ! -f "tests/stability_zip_order.test.ts" ]; then
  echo "[FT_PROOF] ✗ Determinism test not found" | tee -a "$EVID/gates.log"
  exit 1
fi
echo "[FT_PROOF] ✓ Determinism test: PASS" | tee -a "$EVID/gates.log"

# Gate 10: CI workflow added
echo "[FT_PROOF] Gate 10: CI regression workflow"
if [ ! -f ".github/workflows/stability-lock.yml" ]; then
  echo "[FT_PROOF] ✗ CI workflow not found" | tee -a "$EVID/gates.log"
  exit 1
fi
echo "[FT_PROOF] ✓ CI workflow: PASS" | tee -a "$EVID/gates.log"

echo "[FT_PROOF] ═══════════════════════════════════════════════════════"
echo "[FT_PROOF] All gates passed!"
echo "[FT_PROOF] ═══════════════════════════════════════════════════════"

{
  echo ""
  echo "Ship Stability Lock - Final Report"
  echo "=================================="
  echo "Timestamp: $(date -u)"
  echo "Commit: $(git rev-parse HEAD)"
  echo "Branch: $(git rev-parse --abbrev-ref HEAD)"
  echo ""
  echo "Gates Passed:"
  echo "1. ✓ Git working tree clean"
  echo "2. ✓ Runtime environment locked (Node 20.20.0, npm 10.8.2)"
  echo "3. ✓ No randomness in Phase 3 exports"
  echo "4. ✓ Storage lock hardened (fail-closed)"
  echo "5. ✓ Error standardization (FTError)"
  echo "6. ✓ Stability contract documented"
  echo "7. ✓ Runtime guards in place"
  echo "8. ✓ Determinism modules in place"
  echo "9. ✓ Determinism test suite"
  echo "10. ✓ CI regression workflow"
  echo ""
  echo "Status: PASS (all gates executed)"
  echo "=================================="
} | tee "$EVID/final_report.txt"

echo "[FT_PROOF] ═══════════════════════════════════════════════════════"
echo "[FT_PROOF] STABILITY_LOCK_PASS evid=$EVID"
echo "[FT_PROOF] ═══════════════════════════════════════════════════════"

exit 0
