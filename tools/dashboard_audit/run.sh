#!/bin/bash
#
# AUDIT: Deterministic Dashboard Feature Audit
#
# Validates, in-repo, that every dashboard feature is wired correctly.
# Does NOT require Jira UI login - all checks are static/deterministic.
#
# Checks:
#  1. npm run e2e:ci (deterministic CI gate passes)
#  2. npm run build (all build gates pass)
#  3. All resolvers registered
#  4. Status schema has proof envelope fields
#  5. Gadget DOM has proof elements
#  6. Debug toggle contract intact
#  7. No accidental network primitives
#
# Exit: 0 (ALL PASS), 1 (FIRST FAILURE - HARD STOP), 2 (missing prereqs)
#

set -euo pipefail

# Setup
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
RUN_DIR="/tmp/ft_dashboard_audit_$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$RUN_DIR"

echo "================================================================================"
echo "DASHBOARD FEATURE AUDIT"
echo "================================================================================"
echo "RUN_DIR: $RUN_DIR"
echo ""

# Save environment baseline
{
  echo "=== GIT STATUS ==="
  git status --short
  echo ""
  echo "=== NODE VERSION ==="
  node -v
  echo ""
  echo "=== NPM VERSION ==="
  npm -v
} > "$RUN_DIR/00_baseline.txt" 2>&1

# Trap to always print results
trap "
echo ''
echo '================================================================================'
echo 'AUDIT RESULTS SAVED TO:'
echo '  '$RUN_DIR
echo '================================================================================'
" EXIT

# ============================================================================
# CHECK 1: npm run e2e:ci (HARD STOP)
# ============================================================================
echo "[STEP 1/7] Running deterministic CI gate (npm run e2e:ci)..."
if npm run e2e:ci > "$RUN_DIR/10_e2e_ci.log" 2>&1; then
  echo "✅ [PASS] npm run e2e:ci"
else
  echo "❌ [FAIL] npm run e2e:ci"
  echo "See: $RUN_DIR/10_e2e_ci.log"
  exit 1
fi
echo ""

# ============================================================================
# CHECK 2: npm run build (HARD STOP)
# ============================================================================
echo "[STEP 2/7] Building gadget UI (npm run build)..."
if npm run build --prefix atlassian/forge-app > "$RUN_DIR/11_build.log" 2>&1; then
  echo "✅ [PASS] Build succeeded (all 7/7 gates)"
else
  echo "❌ [FAIL] Build failed"
  echo "See: $RUN_DIR/11_build.log"
  exit 1
fi
echo ""

# ============================================================================
# CHECK 3: Verify resolvers registered (HARD STOP)
# ============================================================================
echo "[STEP 3/7] Verifying resolver registrations..."
if node "$SCRIPT_DIR/verify_resolvers_registered.mjs" > "$RUN_DIR/20_resolvers.log" 2>&1; then
  grep "RESOLVER_VERIFY_OK" "$RUN_DIR/20_resolvers.log"
  echo "✅ [PASS] All resolvers registered"
else
  cat "$RUN_DIR/20_resolvers.log"
  echo "❌ [FAIL] Resolver registration audit failed"
  exit 1
fi
echo ""

# ============================================================================
# CHECK 4: Verify status schema contract (HARD STOP)
# ============================================================================
echo "[STEP 4/7] Verifying status schema proof fields..."
if node "$SCRIPT_DIR/verify_status_schema_contract.mjs" > "$RUN_DIR/21_schema.log" 2>&1; then
  grep "SCHEMA_VERIFY_OK" "$RUN_DIR/21_schema.log"
  echo "✅ [PASS] Status schema has all proof fields"
else
  cat "$RUN_DIR/21_schema.log"
  echo "❌ [FAIL] Status schema audit failed"
  exit 1
fi
echo ""

# ============================================================================
# CHECK 5: Verify gadget DOM contract (HARD STOP)
# ============================================================================
echo "[STEP 5/7] Verifying gadget DOM proof elements..."
if node "$SCRIPT_DIR/verify_gadget_dom_contract.mjs" > "$RUN_DIR/22_dom.log" 2>&1; then
  grep "DOM_VERIFY_OK" "$RUN_DIR/22_dom.log"
  echo "✅ [PASS] All proof DOM elements present"
else
  cat "$RUN_DIR/22_dom.log"
  echo "❌ [FAIL] Gadget DOM audit failed"
  exit 1
fi
echo ""

# ============================================================================
# CHECK 6: Verify debug toggle contract (HARD STOP)
# ============================================================================
echo "[STEP 6/7] Verifying debug toggle contract..."
if node "$SCRIPT_DIR/verify_debug_toggle_contract.mjs" > "$RUN_DIR/23_debug.log" 2>&1; then
  grep "DEBUG_VERIFY_OK" "$RUN_DIR/23_debug.log"
  echo "✅ [PASS] Debug toggle contract verified"
else
  cat "$RUN_DIR/23_debug.log"
  echo "❌ [FAIL] Debug toggle audit failed"
  exit 1
fi
echo ""

# ============================================================================
# CHECK 7: Verify no external network primitives (HARD STOP)
# ============================================================================
echo "[STEP 7/7] Verifying no external network primitives..."
if node "$SCRIPT_DIR/verify_no_external_network_primitives.mjs" > "$RUN_DIR/24_network.log" 2>&1; then
  grep "NETWORK_VERIFY_OK" "$RUN_DIR/24_network.log"
  echo "✅ [PASS] No accidental network primitives found"
else
  cat "$RUN_DIR/24_network.log"
  echo "❌ [FAIL] Network primitives audit failed"
  exit 1
fi
echo ""

# ============================================================================
# ALL PASSED
# ============================================================================
echo "================================================================================"
echo "✅ DASHBOARD FEATURE AUDIT PASSED (7/7 CHECKS)"
echo "================================================================================"
echo ""
echo "Evidence saved to: $RUN_DIR"
echo ""
echo "Checks verified:"
echo "  ✓ Deterministic CI gate (e2e:ci)"
echo "  ✓ Build with all 7/7 gates"
echo "  ✓ All required resolvers registered"
echo "  ✓ Status schema has proof fields"
echo "  ✓ Gadget DOM has proof elements"
echo "  ✓ Debug toggle contract intact"
echo "  ✓ No external network primitives"
echo ""

exit 0
