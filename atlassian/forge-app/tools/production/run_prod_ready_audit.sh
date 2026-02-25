#!/bin/bash
set -uo pipefail

# Production readiness audit orchestrator
# Purpose: Run all verification gates sequentially and produce final verdict
# Design: Synchronous execution, real exit codes, deterministic evidence generation

# ==============================================================================
# Evidence directory resolution (fail-closed)
# ==============================================================================
E="${FT_PROD_READY_E:-}"
if [ -z "$E" ] && [ -f /tmp/ft_prod_ready_dir.txt ]; then
  E="$(cat /tmp/ft_prod_ready_dir.txt)"
fi

if [ -z "$E" ] || [ ! -d "$E" ]; then
  echo "FAIL: Evidence directory not set or does not exist" >&2
  exit 1
fi

# Pre-create all required evidence subdirectories (fail-closed)
mkdir -p "$E/03_tests" "$E/04_build" "$E/05_ui" "$E/09_release" "$E/13_repo_scans"

# Write E directory to lock file so steps can find it
echo "$E" > /tmp/ft_prod_ready_dir.txt

cd /workspaces/Firsttry/atlassian/forge-app

# ==============================================================================
# Define evidence file paths
# ==============================================================================
EXIT_FILE="$E/09_release/run_prod_ready_audit.exit_code.txt"
STEP_SUMMARY="$E/09_release/run_prod_ready_audit.step_summary.txt"
VERDICT_FILE="$E/PROD_READY_VERDICT.txt"
FULL_LOG="$E/09_release/run_prod_ready_audit.full.log"

# Initialize state (fail-closed)
OVERALL_EXIT=0

# Initialize exit code file to FAIL (1) by default
echo "1" > "$EXIT_FILE"

# Clear old artifacts
: > "$STEP_SUMMARY"
: > "$FULL_LOG"

# ==============================================================================
# Step execution helper
# ==============================================================================
run_step() {
  local step_no="$1"
  local label="$2"
  local cmd="$3"

  # Log step start
  echo "Step ${step_no}/7: ${label}" >> "$STEP_SUMMARY"
  echo "Step ${step_no}/7: ${label}" >> "$FULL_LOG"

  # Execute step (capture exit code immediately)
  bash -c "$cmd" >> "$FULL_LOG" 2>&1
  local rc=$?

  # Record result
  if [ "$rc" -ne 0 ]; then
    OVERALL_EXIT=1
    echo "RESULT: FAIL exit=$rc" >> "$STEP_SUMMARY"
    echo "✗ ${label} FAILED (exit $rc)" >> "$FULL_LOG"
  else
    echo "RESULT: PASS exit=0" >> "$STEP_SUMMARY"
    echo "✓ ${label} PASSED" >> "$FULL_LOG"
  fi

  echo "" >> "$STEP_SUMMARY"
}

# ==============================================================================
# Execute all verification steps (continue on failure)
# ==============================================================================
echo "Production Readiness Audit - Starting verification gates" >> "$FULL_LOG"
echo "" >> "$FULL_LOG"

# STEP 1: Tests verification
run_step 1 "Tests verification" \
  "bash tools/production/verify_tests_clean.sh"

# STEP 2: Build verification
run_step 2 "Build verification" \
  "bash tools/production/run_build_proof.sh"

# STEP 3: UI markers verification
run_step 3 "UI markers verification" \
  "bash tools/production/verify_ui_markers.sh"

# STEP 4: Outbound runtime verification
run_step 4 "Outbound runtime verification" \
  "FT_PROD_READY_E=\"$E\" bash tools/production/verify_no_outbound_runtime.sh"

# STEP 5: Scopes justification verification
run_step 5 "Scopes justification verification" \
  "FT_PROD_READY_E=\"$E\" node tools/production/verify_scopes_justified.mjs"

# STEP 6: Proof discipline verification
run_step 6 "Proof discipline verification" \
  "FT_PROD_READY_E=\"$E\" bash tools/production/verify_proof_discipline.sh"

# STEP 7: Repo-root E/ references verification
run_step 7 "No repo-root E refs verification" \
  "FT_PROD_READY_E=\"$E\" bash tools/production/verify_no_repo_root_E_refs.sh"

# ==============================================================================
# Finalization: Write evidence files and exit with recorded code
# ==============================================================================
echo "" >> "$STEP_SUMMARY"
echo "FINAL: exit=$OVERALL_EXIT" >> "$STEP_SUMMARY"

# Write exit code file (ALWAYS, overwriting any previous value - fail-closed)
# Initialize to fail, then set to pass only if OVERALL_EXIT is 0
if [ "$OVERALL_EXIT" -eq 0 ]; then
  echo "0" > "$EXIT_FILE"
else
  echo "1" > "$EXIT_FILE"
fi

# Write verdict file (ALWAYS, overwriting any previous value - single source of truth)
# Verdict is derived ONLY from OVERALL_EXIT
if [ "$OVERALL_EXIT" -eq 0 ]; then
  echo "PASS" > "$VERDICT_FILE"
  VERDICT_MSG="All verifications passed. Production ready."
else
  echo "FAIL" > "$VERDICT_FILE"
  VERDICT_MSG="One or more verifications failed."
fi

# Log verdict and evidence location
echo "$VERDICT_MSG" >> "$FULL_LOG"
echo "" >> "$FULL_LOG"
echo "Evidence directory: $E" >> "$FULL_LOG"
echo "Exit code: $OVERALL_EXIT" >> "$FULL_LOG"

# Print verdict to stdout (matches what was written)
echo ""
echo "========================================="
echo "VERDICT: $(cat "$VERDICT_FILE")"
echo "========================================="

# Exit with actual numeric code (not inferred)
exit "$OVERALL_EXIT"

