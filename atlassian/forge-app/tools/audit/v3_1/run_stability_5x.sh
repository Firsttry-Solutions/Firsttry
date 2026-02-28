#!/usr/bin/env bash
# run_stability_5x.sh — Stability harness for F100 Hostile Audit v3.1
# Runs audit 5 times and requires all 5 to exit 0 (CONDITIONAL_ACCEPT)
# Hard requirement: git tree must be clean
# Purpose: Prove deterministic verdict on identical code state

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/../../.." && pwd)"

cd "${REPO_DIR}"

echo "========================================================================"
echo "  F100 AUDIT STABILITY HARNESS — 5x Deterministic Run"
echo "  Repository: ${REPO_DIR}"
echo "  Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "========================================================================"
echo ""

# Enforce clean tree
if [[ -n "$(git status --porcelain)" ]]; then
  echo "[FAIL] Git working tree is not clean. Stability test requires clean tree."
  git status --porcelain
  exit 1
fi

# Capture environment
COMMIT_SHA=$(git rev-parse HEAD)
echo "Commit: ${COMMIT_SHA}"
echo ""

# Create parent evidence directory
STABILITY_DIR="/tmp/ft_audit_stability_5x_$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$STABILITY_DIR"
echo "Stability evidence parent: ${STABILITY_DIR}"
echo ""

# Track results
declare -a EVIDENCE_DIRS
declare -a EXIT_CODES
declare -a DECISIONS

# Run audit 5 times
for i in {1..5}; do
  echo "========================================================================"
  echo "  RUN ${i}/5"
  echo "========================================================================"
  
  # Run audit
  set +e
  bash "${SCRIPT_DIR}/run_f100_hostile_audit_v3_1.sh" > "${STABILITY_DIR}/run_${i}.log" 2>&1
  exit_code=$?
  set -e
  
  # Find latest evidence directory
  LATEST_EVIDENCE=$(ls -td /tmp/ft_f100_hostile_audit_v3_1_* 2>/dev/null | grep -v '.zip' | head -1)
  
  if [[ -z "$LATEST_EVIDENCE" ]] || [[ ! -d "$LATEST_EVIDENCE" ]]; then
    echo "[FAIL] Run ${i}: No evidence directory created"
    echo "FAIL: Run ${i} did not create evidence directory" > "${STABILITY_DIR}/FAILURE.txt"
    exit 1
  fi
  
  # Validate artifacts exist
  for artifact in results.json FINAL_REPORT.md 99_FINAL_DECISION.txt SCORING_SUMMARY.json; do
    if [[ ! -f "${LATEST_EVIDENCE}/${artifact}" ]]; then
      echo "[FAIL] Run ${i}: Missing canonical artifact: ${artifact}"
      echo "FAIL: Run ${i} missing ${artifact}" > "${STABILITY_DIR}/FAILURE.txt"
      exit 1
    fi
  done
  
  # Validate results.json is parseable
  if ! jq empty "${LATEST_EVIDENCE}/results.json" 2>/dev/null; then
    echo "[FAIL] Run ${i}: results.json is not valid JSON"
    echo "FAIL: Run ${i} results.json invalid" > "${STABILITY_DIR}/FAILURE.txt"
    exit 1
  fi
  
  # Extract decision
  DECISION=$(head -1 "${LATEST_EVIDENCE}/99_FINAL_DECISION.txt" 2>/dev/null || echo "UNKNOWN")
  
  # Record results
  EVIDENCE_DIRS+=("$LATEST_EVIDENCE")
  EXIT_CODES+=("$exit_code")
  DECISIONS+=("$DECISION")
  
  echo "  Evidence: ${LATEST_EVIDENCE}"
  echo "  Exit code: ${exit_code}"
  echo "  Decision: ${DECISION}"
  echo ""
  
  # Fail fast if this run didn't pass
  if [[ "$exit_code" -ne 0 ]]; then
    echo "[FAIL] Run ${i} exited non-zero: ${exit_code}"
    echo "Decision: ${DECISION}"
    echo ""
    echo "=== Last 50 lines of audit log ==="
    tail -50 "${STABILITY_DIR}/run_${i}.log"
    echo ""
    echo "=== SCORING_SUMMARY.json ==="
    cat "${LATEST_EVIDENCE}/SCORING_SUMMARY.json" 2>/dev/null || echo "(not found)"
    echo ""
    echo "=== 99_FINAL_DECISION.txt ==="
    cat "${LATEST_EVIDENCE}/99_FINAL_DECISION.txt" 2>/dev/null || echo "(not found)"
    echo ""
    echo "FAILURE: Audit did not exit 0 on run ${i}"
    echo "FAIL: Run ${i} exit ${exit_code}, decision ${DECISION}" > "${STABILITY_DIR}/FAILURE.txt"
    exit 1
  fi
  
  if [[ "$DECISION" != "CONDITIONAL_ACCEPT" ]]; then
    echo "[FAIL] Run ${i} decision is not CONDITIONAL_ACCEPT: ${DECISION}"
    echo "FAIL: Run ${i} decision ${DECISION}" > "${STABILITY_DIR}/FAILURE.txt"
    exit 1
  fi
  
  # Small delay to ensure timestamp uniqueness
  sleep 1
done

echo "========================================================================"
echo "  STABILITY TEST: SUCCESS"
echo "========================================================================"
echo ""
echo "All 5 runs completed successfully:"
for i in {0..4}; do
  run_num=$(( i + 1 ))
  echo "  Run ${run_num}: exit ${EXIT_CODES[$i]}, decision ${DECISIONS[$i]}"
  echo "           ${EVIDENCE_DIRS[$i]}"
done
echo ""

# Write summary
{
  echo "STABILITY TEST SUCCESS"
  echo "======================"
  echo ""
  echo "Commit: ${COMMIT_SHA}"
  echo "Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo ""
  echo "All 5 runs exited 0 with decision CONDITIONAL_ACCEPT"
  echo ""
  echo "Evidence directories:"
  for i in {0..4}; do
    run_num=$(( i + 1 ))
    echo "  Run ${run_num}: ${EVIDENCE_DIRS[$i]}"
  done
} > "${STABILITY_DIR}/SUCCESS.txt"

echo "Stability evidence: ${STABILITY_DIR}"
echo "Summary: ${STABILITY_DIR}/SUCCESS.txt"
echo ""

exit 0
