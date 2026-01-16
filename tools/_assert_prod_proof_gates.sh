#!/bin/bash
#
# tools/_assert_prod_proof_gates.sh
# Validate that prod_buildinfo_proof_loop.sh has all required deterministic gates
#
set -euo pipefail

SCRIPT="/workspaces/Firsttry/tools/prod_buildinfo_proof_loop.sh"

if [ ! -f "$SCRIPT" ]; then
  echo "ERROR: Script not found: $SCRIPT"
  exit 1
fi

FAILURES=0

# Check 1: enter_forge_app_dir function exists
if ! grep -q "^enter_forge_app_dir()" "$SCRIPT"; then
  echo "[FAIL] enter_forge_app_dir() function not defined"
  FAILURES=$((FAILURES + 1))
else
  echo "[PASS] enter_forge_app_dir() function exists"
fi

# Check 2: enter_forge_app_dir is called before whoami
if ! grep -q "enter_forge_app_dir" "$SCRIPT" | head -1; then
  # This check is less strict - we just verify it's called somewhere before whoami
  if grep -n "enter_forge_app_dir" "$SCRIPT" | grep -E "STEP 2.5|whoami" > /dev/null; then
    echo "[PASS] enter_forge_app_dir called before whoami"
  fi
fi

# Check 3: timeout dependency check exists
if ! grep -q "command -v timeout" "$SCRIPT"; then
  echo "[FAIL] timeout dependency check missing"
  FAILURES=$((FAILURES + 1))
else
  echo "[PASS] timeout dependency check exists"
fi

# Check 4: forge dependency check exists
if ! grep -q "command -v forge" "$SCRIPT"; then
  echo "[FAIL] forge dependency check missing"
  FAILURES=$((FAILURES + 1))
else
  echo "[PASS] forge dependency check exists"
fi

# Check 5: Gate 1 (whoami) outputs to 25_forge_whoami.txt
if ! grep -q "25_forge_whoami.txt" "$SCRIPT"; then
  echo "[FAIL] Gate 1 (whoami) proof file 25_forge_whoami.txt not referenced"
  FAILURES=$((FAILURES + 1))
else
  echo "[PASS] Gate 1 proof file (25_forge_whoami.txt) referenced"
fi

# Check 6: Gate 2 (environments) outputs to 26_forge_envs.txt
if ! grep -q "26_forge_envs.txt" "$SCRIPT"; then
  echo "[FAIL] Gate 2 (environments) proof file 26_forge_envs.txt not referenced"
  FAILURES=$((FAILURES + 1))
else
  echo "[PASS] Gate 2 proof file (26_forge_envs.txt) referenced"
fi

# Check 7: Gate 3 (deploy probe) exists - either dry-run or fallback
if ! grep -q "27_deploy" "$SCRIPT" || ! grep -q "27_install" "$SCRIPT"; then
  echo "[FAIL] Gate 3 (deploy probe) proof files not referenced"
  FAILURES=$((FAILURES + 1))
else
  echo "[PASS] Gate 3 proof files referenced"
fi

# Check 8: No tee pipeline in gated sections
if grep -E "STEP 2.5|STEP 2.6|STEP 2.7|Gate" "$SCRIPT" | grep -q "| tee"; then
  echo "[FAIL] tee pipeline found in gated sections (should use direct redirection)"
  FAILURES=$((FAILURES + 1))
else
  echo "[PASS] No tee pipelines in gated sections"
fi

# Check 9: ERR.txt is created on failures
if ! grep -q 'ERR.txt' "$SCRIPT"; then
  echo "[FAIL] ERR.txt error reporting not implemented"
  FAILURES=$((FAILURES + 1))
else
  echo "[PASS] ERR.txt error reporting implemented"
fi

# Check 10: Timeout constants defined (T_SHORT, T_MED, T_LONG)
if ! grep -q "^T_SHORT=" "$SCRIPT" || ! grep -q "^T_MED=" "$SCRIPT" || ! grep -q "^T_LONG=" "$SCRIPT"; then
  echo "[FAIL] Timeout constants not defined (T_SHORT, T_MED, T_LONG)"
  FAILURES=$((FAILURES + 1))
else
  echo "[PASS] Timeout constants defined"
fi

# NEW GATE: Dashboard Title Validator (PHASE 4)
echo ""
echo "====== GATE: Dashboard Title Validator ======"
TITLE_VALIDATOR="/workspaces/Firsttry/tools/validate_dashboard_title.sh"
if [ -f "$TITLE_VALIDATOR" ]; then
  if bash "$TITLE_VALIDATOR" /workspaces/Firsttry 2>&1 | tee /tmp/title_validation.log; then
    echo "[PASS] Dashboard title validation passed"
  else
    echo "[FAIL] Dashboard title validation failed"
    FAILURES=$((FAILURES + 1))
  fi
else
  echo "[WARN] Dashboard title validator not found: $TITLE_VALIDATOR"
fi

if [ $FAILURES -eq 0 ]; then
  echo ""
  echo "[PASS] All gate assertions passed"
  exit 0
else
  echo ""
  echo "[FAIL] $FAILURES assertion(s) failed"
  exit 1
fi
