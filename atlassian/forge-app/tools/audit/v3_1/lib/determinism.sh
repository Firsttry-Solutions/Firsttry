#!/usr/bin/env bash
# lib/determinism.sh — Phase 6: Determinism hard proof
set -euo pipefail

run_determinism() {
  local e="${E}"
  local repo_dir="${REPO_DIR}"
  phase_start "06" "Determinism Hard Proof"

  # ── Entropy scan ──────────────────────────────────────────────────────────
  local entropy_patterns=(
    'Date\.now\(\)'
    'new Date\('
    'Math\.random\('
    '\buuid\b'
    'randomBytes\('
    'process\.env\.'
  )

  local entropy_violations=""
  local export_files
  # Scope to export/canonicalization paths
  local relevant_dirs=(
    "${repo_dir}/src/canonicalize.ts"
    "${repo_dir}/src/security/canonicalJson.ts"
    "${repo_dir}/src/security/hash.ts"
    "${repo_dir}/src/core/audit_snapshot"
    "${repo_dir}/src/export"
    "${repo_dir}/src/evidence"
    "${repo_dir}/src/backbone"
    "${repo_dir}/src/security"
    "${repo_dir}/src/milestone1"
    "${repo_dir}/src/governance"
    "${repo_dir}/src/zip"
  )

  echo "[06] Entropy scan of export/canonicalization paths..." \
    | tee "${e}/PHASE_06_determinism.txt"

  for path in "${relevant_dirs[@]}"; do
    [[ -e "$path" ]] || continue
    for pat in "${entropy_patterns[@]}"; do
      local hits
      hits=$(rg -n --glob '!**/node_modules/**' --glob '*.ts' "$pat" "$path" 2>/dev/null || true)
      if [[ -n "$hits" ]]; then
        # Filter: allow in test-only files
        local non_test_hits
        non_test_hits=$(echo "$hits" | grep -v '\.test\.ts\|__tests__' || true)
        if [[ -n "$non_test_hits" ]]; then
          echo "  [ENTROPY RISK] ${pat} in ${path}:" | tee -a "${e}/PHASE_06_determinism.txt"
          echo "$non_test_hits" | head -5 | tee -a "${e}/PHASE_06_determinism.txt"
          entropy_violations+="$non_test_hits"$'\n'
        fi
      fi
    done
  done

  if [[ -n "$entropy_violations" ]]; then
    phase_fail "06" \
      "Non-deterministic constructs (Date.now/Math.random/uuid/process.env) found in export/canonicalization code path. Determinism is violated." \
      "${e}/PHASE_06_determinism.txt"
  fi
  echo "  [PASS] No entropy violations in export/canonicalization paths." \
    | tee -a "${e}/PHASE_06_determinism.txt"

  # ── correlationId taint proof ──────────────────────────────────────────────
  echo "[06] Taint scan: correlationId must not leak into deterministic paths..." \
    | tee -a "${e}/PHASE_06_correlationId_taint_scan.txt"

  # Search for correlationId in deterministic paths
  local taint_violations=""
  local forbidden_paths=(
    "${repo_dir}/src/export"
    "${repo_dir}/src/evidence"
    "${repo_dir}/src/milestone1"
    "${repo_dir}/src/phase6"
    "${repo_dir}/src/backbone"
    "${repo_dir}/src/zip"
  )

  # Also check for files with canonical/hash/export in their name anywhere
  local forbidden_file_patterns=(
    "**/canonical*.ts"
    "**/hash*.ts"
    "**/export*.ts"
  )

  local correlation_hits=""
  
  # Scan forbidden directories
  for path in "${forbidden_paths[@]}"; do
    if [[ -d "$path" ]]; then
      local hits
      hits=$(rg -n --glob '!**/*.test.ts' --glob '!**/__tests__/**' \
        'correlationId' "$path" 2>/dev/null || true)
      if [[ -n "$hits" ]]; then
        echo "  [TAINT VIOLATION] correlationId found in ${path}:" \
          | tee -a "${e}/PHASE_06_correlationId_taint_scan.txt"
        echo "$hits" | tee -a "${e}/PHASE_06_correlationId_taint_scan.txt"
        taint_violations+="$hits"$'\n'
      fi
    fi
  done

  # Scan for forbidden file patterns anywhere in src/
  for pattern in "${forbidden_file_patterns[@]}"; do
    local file_hits
    file_hits=$(find "${repo_dir}/src" -type f -name "${pattern#**/}" \
      -not -path "*/node_modules/*" \
      -not -path "*/__tests__/*" \
      -not -name "*.test.ts" 2>/dev/null || true)
    
    for file in $file_hits; do
      local hits
      hits=$(rg -n 'correlationId' "$file" 2>/dev/null || true)
      if [[ -n "$hits" ]]; then
        echo "  [TAINT VIOLATION] correlationId found in ${file}:" \
          | tee -a "${e}/PHASE_06_correlationId_taint_scan.txt"
        echo "$hits" | tee -a "${e}/PHASE_06_correlationId_taint_scan.txt"
        taint_violations+="$hits"$'\n'
      fi
    done
  done

  # Check for correlationId passed to forbidden functions
  local forbidden_functions=(
    "computeCanonicalHash"
    "computePackHash"
    "buildExport"
    "writeEvidence"
    "canonicalJsonString"
    "hashDriftEvent"
  )

  for func in "${forbidden_functions[@]}"; do
    local func_calls
    # Search for function calls with correlationId as argument
    func_calls=$(rg -n --glob '!**/*.test.ts' --glob '!**/__tests__/**' \
      "${func}\([^)]*correlationId" "${repo_dir}/src" 2>/dev/null || true)
    if [[ -n "$func_calls" ]]; then
      echo "  [TAINT VIOLATION] correlationId passed to ${func}:" \
        | tee -a "${e}/PHASE_06_correlationId_taint_scan.txt"
      echo "$func_calls" | tee -a "${e}/PHASE_06_correlationId_taint_scan.txt"
      taint_violations+="$func_calls"$'\n'
    fi
  done

  if [[ -n "$taint_violations" ]]; then
    phase_fail "06" \
      "correlationId taint detected: random UUID used in deterministic code path (export/canonical/hash). This violates determinism guarantee." \
      "${e}/PHASE_06_correlationId_taint_scan.txt"
  fi

  echo "  [PASS] correlationId taint scan: no violations detected." \
    | tee -a "${e}/PHASE_06_correlationId_taint_scan.txt"

  # ── randomUUID taint proof (prevents bypass via renaming) ──────────────────
  echo "[06] Taint scan: randomUUID() must not appear in deterministic paths..." \
    | tee -a "${e}/PHASE_06_randomUUID_taint_scan.txt"

  # This check prevents bypassing the correlationId gate by renaming or by
  # directly using randomUUID() in deterministic code paths.
  
  local uuid_taint_violations=""
  local uuid_forbidden_dirs=(
    "${repo_dir}/src/export"
    "${repo_dir}/src/evidence"
    "${repo_dir}/src/zip"
    "${repo_dir}/src/pack"
    "${repo_dir}/src/phase6"
  )

  # Scan forbidden directories for randomUUID(
  for path in "${uuid_forbidden_dirs[@]}"; do
    if [[ -d "$path" ]]; then
      local uuid_hits
      uuid_hits=$(rg -n --glob '!**/*.test.ts' --glob '!**/__tests__/**' \
        'randomUUID\(' "$path" 2>/dev/null || true)
      if [[ -n "$uuid_hits" ]]; then
        echo "  [TAINT VIOLATION] randomUUID() found in ${path}:" \
          | tee -a "${e}/PHASE_06_randomUUID_taint_scan.txt"
        echo "$uuid_hits" | tee -a "${e}/PHASE_06_randomUUID_taint_scan.txt"
        uuid_taint_violations+="$uuid_hits"$'\n'
      fi
    fi
  done

  # Scan for randomUUID in forbidden file patterns anywhere in src/
  local uuid_forbidden_patterns=(
    "*canonical*.ts"
    "*hash*.ts"
    "*export*.ts"
  )

  for pattern in "${uuid_forbidden_patterns[@]}"; do
    local uuid_file_hits
    uuid_file_hits=$(find "${repo_dir}/src" -type f -name "$pattern" \
      -not -path "*/node_modules/*" \
      -not -path "*/__tests__/*" \
      -not -name "*.test.ts" 2>/dev/null || true)
    
    for file in $uuid_file_hits; do
      local uuid_hits
      uuid_hits=$(rg -n 'randomUUID\(' "$file" 2>/dev/null || true)
      if [[ -n "$uuid_hits" ]]; then
        echo "  [TAINT VIOLATION] randomUUID() found in ${file}:" \
          | tee -a "${e}/PHASE_06_randomUUID_taint_scan.txt"
        echo "$uuid_hits" | tee -a "${e}/PHASE_06_randomUUID_taint_scan.txt"
        uuid_taint_violations+="$uuid_hits"$'\n'
      fi
    done
  done

  if [[ -n "$uuid_taint_violations" ]]; then
    phase_fail "06" \
      "randomUUID() taint detected: random UUID generation in deterministic code path. This violates determinism guarantee and cannot be bypassed by renaming." \
      "${e}/PHASE_06_randomUUID_taint_scan.txt"
  fi

  echo "  [PASS] randomUUID taint scan: 0 violations detected." \
    | tee -a "${e}/PHASE_06_randomUUID_taint_scan.txt"

  # ── Double-run determinism ─────────────────────────────────────────────────
  echo "[06] Locating export entrypoint test runner..." \
    | tee -a "${e}/PHASE_06_determinism.txt"

  # Find a test file that exercises the export entrypoint
  local test_runner=""
  local candidate_tests=(
    "${repo_dir}/src/milestone1/__tests__/run_export_full_pack_test.mjs"
    "${repo_dir}/src/__tests__/DashboardSnapshotV1.test.ts"
    "${repo_dir}/src/__tests__/RuntimeProofpackV2_NoSimulation.test.ts"
    "${repo_dir}/src/phase9/determinism.test.ts"
  )

  for t in "${candidate_tests[@]}"; do
    if [[ -f "$t" ]]; then
      test_runner="$t"
      echo "  Found test runner: ${test_runner}" | tee -a "${e}/PHASE_06_determinism.txt"
      break
    fi
  done

  if [[ -z "$test_runner" ]]; then
    phase_fail "06" "No export entrypoint test runner exists. Create a test that directly exercises the export path for determinism verification." \
      "${e}/PHASE_06_determinism.txt"
  fi

  # Run twice and compare outputs
  local run1_dir="${e}/run1"
  local run2_dir="${e}/run2"
  mkdir -p "$run1_dir" "$run2_dir"

  echo "[06] Run 1..." | tee -a "${e}/PHASE_06_determinism.txt"
  (
    cd "${repo_dir}"
    npx vitest run --reporter=json "$test_runner" \
      > "${run1_dir}/test_output.json" 2>"${run1_dir}/test_stderr.txt" || true
  )

  echo "[06] Run 2..." | tee -a "${e}/PHASE_06_determinism.txt"
  (
    cd "${repo_dir}"
    npx vitest run --reporter=json "$test_runner" \
      > "${run2_dir}/test_output.json" 2>"${run2_dir}/test_stderr.txt" || true
  )

  # Compare outputs (strip timestamps from JSON)
  local r1_stripped r2_stripped
  r1_stripped=$(jq 'del(..|.timestamp?,.startTime?,.endTime?,.duration?)' \
    "${run1_dir}/test_output.json" 2>/dev/null | sha256sum | awk '{print $1}' || echo "parse_fail_r1")
  r2_stripped=$(jq 'del(..|.timestamp?,.startTime?,.endTime?,.duration?)' \
    "${run2_dir}/test_output.json" 2>/dev/null | sha256sum | awk '{print $1}' || echo "parse_fail_r2")

  echo "  Run1 hash (content): ${r1_stripped}" | tee -a "${e}/PHASE_06_determinism.txt"
  echo "  Run2 hash (content): ${r2_stripped}" | tee -a "${e}/PHASE_06_determinism.txt"

  if [[ "$r1_stripped" != "$r2_stripped" ]]; then
    echo "  MISMATCH: Run1 != Run2" | tee -a "${e}/PHASE_06_determinism.txt"
    diff "${run1_dir}/test_output.json" "${run2_dir}/test_output.json" \
      > "${e}/PHASE_06_run_diff.txt" 2>&1 || true
    phase_fail "06" "Double-run of export test produced different output. Non-determinism detected." \
      "${e}/PHASE_06_run_diff.txt"
  fi

  echo "  [PASS] Both runs produce identical output." | tee -a "${e}/PHASE_06_determinism.txt"
  phase_pass "06" "Determinism verified: entropy-free paths + identical double-run."
}

export -f run_determinism
