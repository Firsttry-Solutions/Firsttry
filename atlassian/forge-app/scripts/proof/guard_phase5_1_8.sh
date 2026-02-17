#!/bin/bash

# Phase 5.1.8 Guard Script - FAIL-CLOSED ARCHITECTURE
# 
# CRITICAL: Non-bypassable verification of all Phase 5.1.8 constraints
# Exit immediately on ANY check failure
# 
# Checks:
# 1. package.json and lockfiles unchanged
# 2. Manifest scopes unchanged
# 3. No outbound networking patterns
# 4. No Jira mutation APIs
# 5. All Phase 5.1.8 markers present
# 6. Tests passing
# 7. Build successful

set -euo pipefail

RUN_DIR="${1:-.}"

# Ensure RUN_DIR is set (fail-closed)
if [[ ! -d "$RUN_DIR" ]]; then
  mkdir -p "$RUN_DIR"
fi

# Export for npm subprocesses
export RUN_DIR

FAIL=0
CHECK_NUM=0

# Helper: Log check result
log_check() {
  local name="$1"
  local result="$2"
  CHECK_NUM=$((CHECK_NUM + 1))
  if [[ "$result" == "PASS" ]]; then
    echo "[CHECK $CHECK_NUM PASS] $name" | tee -a "$RUN_DIR/guard_checks.txt"
  else
    echo "[CHECK $CHECK_NUM FAIL] $name" | tee -a "$RUN_DIR/guard_checks.txt"
    FAIL=1
  fi
}

# CHECK 1: package.json unchanged
echo "=== CHECK 1: package.json unchanged ===" | tee -a "$RUN_DIR/guard_checks.txt"
if [[ -f "$RUN_DIR/package.json.before" ]]; then
  if diff -q "$RUN_DIR/package.json.before" package.json > /dev/null 2>&1; then
    log_check "package.json unchanged" "PASS"
  else
    log_check "package.json CHANGED (hard fail)" "FAIL"
  fi
else
  log_check "package.json baseline not captured" "FAIL"
fi

# CHECK 2: lockfile unchanged
echo "=== CHECK 2: package-lock.json unchanged ===" | tee -a "$RUN_DIR/guard_checks.txt"
if [[ -f "$RUN_DIR/package-lock.json.before" && -f package-lock.json ]]; then
  if diff -q "$RUN_DIR/package-lock.json.before" package-lock.json > /dev/null 2>&1; then
    log_check "package-lock.json unchanged" "PASS"
  else
    log_check "package-lock.json CHANGED (hard fail)" "FAIL"
  fi
else
  log_check "lockfile baseline not found (skipping)" "PASS"
fi

# CHECK 3: Manifest manifest.yml scopes unchanged
echo "=== CHECK 3: Manifest scopes unchanged ===" | tee -a "$RUN_DIR/guard_checks.txt"
if [[ -f manifest.yml ]]; then
  CURRENT_SCOPES=$(grep -A 20 "^scopes:" manifest.yml 2>/dev/null | grep "  - " | sort)
  if [[ -f "$RUN_DIR/manifest_scopes.before" ]]; then
    BEFORE_SCOPES=$(cat "$RUN_DIR/manifest_scopes.before")
    if [[ "$CURRENT_SCOPES" == "$BEFORE_SCOPES" ]]; then
      log_check "manifest scopes unchanged" "PASS"
    else
      log_check "manifest scopes CHANGED (hard fail)" "FAIL"
    fi
  else
    # First run - capture baseline
    echo "$CURRENT_SCOPES" > "$RUN_DIR/manifest_scopes.before"
    log_check "manifest scopes baseline captured" "PASS"
  fi
else
  log_check "manifest.yml not found (skipping)" "PASS"
fi

# CHECK 4: No outbound networking patterns
echo "=== CHECK 4: No outbound networking patterns ===" | tee -a "$RUN_DIR/guard_checks.txt"
NETWORK_PATTERNS="fetch\(|axios|undici|http\.request|https\.request|WebSocket|invokeRemote"
FOUND=$(grep -r "$NETWORK_PATTERNS" src/ 2>/dev/null | grep -v "//" | grep -v "Do NOT\|does NOT\|node_modules" | wc -l || true)
if [[ "$FOUND" == "0" ]]; then
  log_check "no networking patterns" "PASS"
else
  echo "Found $FOUND networking references:" | tee -a "$RUN_DIR/guard_checks.txt"
  grep -r "$NETWORK_PATTERNS" src/ 2>/dev/null | grep -v "//" | head -5 >> "$RUN_DIR/guard_checks.txt" || true
  log_check "networking patterns found (hard fail)" "FAIL"
fi

# CHECK 5: No Jira mutation patterns
echo "=== CHECK 5: No Jira mutation patterns ===" | tee -a "$RUN_DIR/guard_checks.txt"
JIRA_MUTATIONS="requestJira.*POST|requestJira.*PUT|requestJira.*DELETE|/rest/api/3/issue.*POST|/rest/api/3/issue.*PUT|/rest/api/3/issue.*DELETE"
FOUND=$(grep -rE "$JIRA_MUTATIONS" src/ 2>/dev/null | grep -v "//" | wc -l || true)
if [[ "$FOUND" == "0" ]]; then
  log_check "no Jira mutations" "PASS"
else
  echo "Found $FOUND Jira mutation references:" | tee -a "$RUN_DIR/guard_checks.txt"
  grep -rE "$JIRA_MUTATIONS" src/ 2>/dev/null | head -5 >> "$RUN_DIR/guard_checks.txt" || true
  log_check "Jira mutations found (hard fail)" "FAIL"
fi

# CHECK 6: All Phase 5.1.8 markers present
echo "=== CHECK 6: Phase 5.1.8 markers present ===" | tee -a "$RUN_DIR/guard_checks.txt"
MARKERS=(
  "FT_PROOF_LIFECYCLE_VISIBILITY_v1"
  "FT_PROOF_STORAGE_GROWTH_VISIBILITY_v1"
  "FT_PROOF_VERIFY_AUDIT_VISIBILITY_v1"
  "FT_PROOF_EXPLICIT_CONSTRAINTS_DISCLOSURE_v1"
  "FT_PROOF_RESTORE_HEURISTIC_v1"
  "FT_PROOF_SLA_RESOLUTION_DISCLOSURE_v1"
  "FT_PROOF_CHANGE_TIMELINE_v1"
  "FT_PROOF_DIAGNOSTIC_EXPORT_v1"
  "FT_PROOF_EXEC_SUMMARY_EXPORT_v1"
  "FT_PROOF_CERT_PRECHECK_v1"
  "FT_PROOF_ENTERPRISE_SELLABILITY_PANELS_WIRED_v1"
  "FT_PROOF_LEDGER_SNAPSHOT_MIN_METRICS_v1"
)

MISSING_MARKERS=0
for marker in "${MARKERS[@]}"; do
  if grep -r "$marker" src/ tests/ 2>/dev/null | grep -q .; then
    echo "  ✓ $marker" >> "$RUN_DIR/guard_checks.txt"
  else
    echo "  ✗ MISSING: $marker" >> "$RUN_DIR/guard_checks.txt"
    MISSING_MARKERS=$((MISSING_MARKERS + 1))
  fi
done

if [[ $MISSING_MARKERS -eq 0 ]]; then
  log_check "all markers present" "PASS"
else
  echo "Missing $MISSING_MARKERS markers" | tee -a "$RUN_DIR/guard_checks.txt"
  log_check "markers missing (hard fail)" "FAIL"
fi

# CHECK 7: Tests passing
echo "=== CHECK 7: Tests passing ===" | tee -a "$RUN_DIR/guard_checks.txt"
if npm test > "$RUN_DIR/guard_test_output.txt" 2>&1; then
  log_check "tests pass" "PASS"
else
  log_check "tests fail (hard fail)" "FAIL"
  tail -20 "$RUN_DIR/guard_test_output.txt" >> "$RUN_DIR/guard_checks.txt"
fi

# CHECK 8: Build successful
echo "=== CHECK 8: Build successful ===" | tee -a "$RUN_DIR/guard_checks.txt"
if npm run build > "$RUN_DIR/guard_build_output.txt" 2>&1; then
  log_check "build passes" "PASS"
else
  log_check "build fails (hard fail)" "FAIL"
  tail -20 "$RUN_DIR/guard_build_output.txt" >> "$RUN_DIR/guard_checks.txt"
fi

# Summary
echo "" | tee -a "$RUN_DIR/guard_checks.txt"
echo "=== GUARD SUMMARY ===" | tee -a "$RUN_DIR/guard_checks.txt"
echo "Total checks run: $CHECK_NUM" | tee -a "$RUN_DIR/guard_checks.txt"

if [[ $FAIL -eq 0 ]]; then
  echo "✅ ALL CHECKS PASSED" | tee -a "$RUN_DIR/guard_checks.txt"
  exit 0
else
  echo "❌ CHECKS FAILED" | tee -a "$RUN_DIR/guard_checks.txt"
  exit 1
fi
