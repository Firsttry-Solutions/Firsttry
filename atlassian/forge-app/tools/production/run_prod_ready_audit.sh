#!/bin/bash
set -uo pipefail

# Production readiness audit orchestrator
# Purpose: Run all verification gates sequentially and produce final verdict
# Design: Synchronous execution, real exit codes, deterministic evidence generation

# ==============================================================================
# CWD-INDEPENDENT: resolve script and repo root regardless of caller cwd
# ==============================================================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT" || { echo "FAIL: cannot cd to REPO_ROOT: $REPO_ROOT" >&2; exit 1; }

# ==============================================================================
# Evidence directory resolution (fail-closed, FT_PROD_READY_E is SOLE source)
# ==============================================================================
E="${FT_PROD_READY_E:-}"
if [ -z "$E" ] || [ ! -d "$E" ]; then
  echo "FAIL: FT_PROD_READY_E must be set to an existing directory path" >&2
  exit 1
fi

# Pre-create all required evidence subdirectories (fail-closed)
mkdir -p "$E/03_tests" "$E/04_build" "$E/05_ui" "$E/09_release" "$E/13_repo_scans" "$E/14_enterprise_audit"

# Stay at REPO_ROOT for all tool invocations (do NOT cd inside step commands)

# ==============================================================================
# Define evidence file paths
# ==============================================================================
EXIT_FILE="$E/09_release/run_prod_ready_audit.exit_code.txt"
STEP_SUMMARY="$E/09_release/run_prod_ready_audit.step_summary.txt"
VERDICT_FILE="$E/PROD_READY_VERDICT.txt"
FULL_LOG="$E/09_release/run_prod_ready_audit.full.log"

# Initialize state (fail-closed)
TOTAL_STEPS=8
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
  echo "Step ${step_no}/${TOTAL_STEPS}: ${label}" >> "$STEP_SUMMARY"
  echo "Step ${step_no}/${TOTAL_STEPS}: ${label}" >> "$FULL_LOG"

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

# STEP 8: Enterprise audit (requestJira + zero egress + scope justification)
run_step 8 "Enterprise audit verification" \
  "FT_PROD_READY_E=\"$E\" bash tools/production/run_enterprise_audit.sh"

# ==============================================================================
# Function: Generate deterministic manifest + sha256 hashes + packhash binding
# ==============================================================================
generate_proof_pack_binding() {
  local manifest_files="$E/09_release/prod_ready_manifest_files.txt"
  local manifest_hash_inputs="$E/09_release/prod_ready_manifest_hash_inputs.txt"
  local manifest_sha256="$E/09_release/prod_ready_manifest_sha256.txt"
  local packhash_file="$E/09_release/prod_ready_packhash.txt"
  local exclusions_file="$E/09_release/prod_ready_manifest_exclusions.txt"

  # Ensure clean slate
  : > "$manifest_files"
  : > "$manifest_hash_inputs"
  : > "$manifest_sha256"
  : > "$packhash_file"
  : > "$exclusions_file"

  # Change to evidence directory for deterministic relative paths
  (
    cd "$E" || return 1

    export LC_ALL=C

    # Exclusions: ONLY the truly nondeterministic runtime logs
    # Binding files are NO LONGER excluded — the manifest must be self-describing
    {
      echo "stdout.txt"
      echo "stderr.txt"
    } | LC_ALL=C sort > "$exclusions_file"

    # manifest_files: ALL evidence files except stdout/stderr
    # Binding files (manifest_files, manifest_sha256, manifest_hash_inputs, packhash,
    # exclusions) ARE included — the manifest is self-describing
    find . -type f -print \
      | sed 's|^\./||' \
      | grep -v '^stdout\.txt$' \
      | grep -v '^stderr\.txt$' \
      | LC_ALL=C sort > "$manifest_files"

    if [ ! -s "$manifest_files" ]; then
      echo "ERROR: manifest_files is empty or unreadable" >&2
      return 1
    fi

    # manifest_hash_inputs: manifest_files MINUS the computed-output files AND full.log
    # - manifest_sha256 and packhash cannot be included in their own input set
    # - run_prod_ready_audit.full.log is excluded because finalization writes occur
    #   after this function returns (post-binding lines are not captured in the hash)
    grep -v '^09_release/prod_ready_manifest_sha256\.txt$' "$manifest_files" \
      | grep -v '^09_release/prod_ready_packhash\.txt$' \
      | grep -v '^09_release/run_prod_ready_audit\.full\.log$' \
      > "$manifest_hash_inputs"

    if [ ! -s "$manifest_hash_inputs" ]; then
      echo "ERROR: manifest_hash_inputs is empty or unreadable" >&2
      return 1
    fi

    # Compute sha256 for each file listed in hash_inputs (deterministic order)
    while IFS= read -r filepath; do
      sha256sum "$filepath" 2>/dev/null || {
        echo "ERROR: failed to hash $filepath" >&2
        return 1
      }
    done < "$manifest_hash_inputs" > "$manifest_sha256"

    if [ ! -s "$manifest_sha256" ]; then
      echo "ERROR: manifest_sha256 is empty or unreadable" >&2
      return 1
    fi

    # Compute packhash: sha256 of manifest_sha256.txt (tamper-evident binding)
    sha256sum "09_release/prod_ready_manifest_sha256.txt" | awk '{print $1}' > "$packhash_file"

    if [ ! -s "$packhash_file" ]; then
      echo "ERROR: packhash_file is empty or unreadable" >&2
      return 1
    fi

    return 0
  ) || return 1

  return 0
}

# ==============================================================================
# Finalization: Generate binding + write evidence files and exit with recorded code
# ==============================================================================
echo "" >> "$STEP_SUMMARY"
echo "FINAL: exit=$OVERALL_EXIT" >> "$STEP_SUMMARY"

# Generate tamper-evident proof pack binding (MUST succeed or mark overall failure)
if ! generate_proof_pack_binding >> "$FULL_LOG" 2>&1; then
  echo "ERROR: failed to generate proof pack binding" >> "$FULL_LOG"
  OVERALL_EXIT=1
else
  echo "✓ Proof pack binding generated successfully" >> "$FULL_LOG"
fi

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

