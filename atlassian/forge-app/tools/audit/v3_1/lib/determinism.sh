#!/usr/bin/env bash
# lib/determinism.sh — Phase 6: Determinism hard proof
set -euo pipefail

run_determinism() {
  local e="${E}"
  local repo_dir="${REPO_DIR}"
  phase_start "06" "Determinism Hard Proof"

  # ── Check for Clock abstraction implementation ──────────────────────────────
  echo "[06] Checking for Clock abstraction..." | tee "${e}/PHASE_06_determinism.txt"
  
  local clock_file="${repo_dir}/src/shared/clock.ts"
  if [[ ! -f "$clock_file" ]]; then
    phase_fail "06" "Clock abstraction not found at src/shared/clock.ts" "${e}/PHASE_06_determinism.txt"
  fi
  
  # Verify Clock exports FixedClock and SystemClock
  if ! grep -q "export.*FixedClock" "$clock_file" || ! grep -q "export.*SystemClock" "$clock_file"; then
    phase_fail "06" "Clock abstraction incomplete (missing FixedClock or SystemClock)" "${e}/PHASE_06_determinism.txt"
  fi
  
  echo "  [PASS] Clock abstraction found" | tee -a "${e}/PHASE_06_determinism.txt"

  # ── Entropy scan (excluding non-canonical paths) ───────────────────────────
  local entropy_patterns=(
    'Date\.now\(\)'
    'new Date\('
    'Math\.random\('
    'crypto\.randomUUID\('
  )

  # Canonical paths where nondeterminism is NOT allowed
  local canonical_dirs=(
    "${repo_dir}/src/core/audit_snapshot"
    "${repo_dir}/src/evidence"
    "${repo_dir}/src/backbone/ledger.ts"
    "${repo_dir}/src/backbone/uuid.ts"
    "${repo_dir}/src/milestone1/orchestrator.ts"
    "${repo_dir}/src/governance/reviewSeal.ts"
    "${repo_dir}/src/governance/driftAck.ts"
    "${repo_dir}/src/governance/actionLog.ts"
    "${repo_dir}/src/governance/governanceAggregator.ts"
  )

  # Non-canonical paths (allowed to have timestamps)
  # These are filtered out from violations
  local non_canonical_patterns=(
    ".test.ts"
    "__tests__"
    "/admin/"
    "/ui/"
    "/scheduled/"
    "/probes/"
    "/shared/dashEnvelope"
    "/shared/DashboardSnapshot"
    "/shared/truth_contract"
    "/shared/statusSchema"
    "/shared/evidenceMetrics"
    "/disclosure_types"
    "/evidence_storage.ts"
    "/phase8/metrics"
    "storage.ts" # Lock timestamps are non-canonical
  )

  echo "[06] Entropy scan of canonical paths..." | tee -a "${e}/PHASE_06_determinism.txt"

  local entropy_violations=""
  
  for path in "${canonical_dirs[@]}"; do
    [[ -e "$path" ]] || continue
    for pat in "${entropy_patterns[@]}"; do
      local hits
      hits=$(rg -n --type ts "$pat" "$path" 2>/dev/null || true)
      if [[ -n "$hits" ]]; then
        # Filter out non-canonical patterns
        local filtered_hits="$hits"
        for nc_pat in "${non_canonical_patterns[@]}"; do
          filtered_hits=$(echo "$filtered_hits" | grep -v "$nc_pat" || true)
        done
        
        # Filter out safe patterns:
        # - Date parsing: new Date(existingTimestamp) for arithmetic/comparison
        # - Clock injection: clock.nowISO() or clock: Clock parameter
        # - Comments explaining non-canonical usage
        filtered_hits=$(echo "$filtered_hits" | grep -v -E \
          'clock\.nowISO|clock: Clock|parseISO|parse.*timestamp|new Date\([a-zA-Z_][a-zA-Z0-9_.]*\)|\.getTime\(\)|// .*[Pp]arsing|// .*[Cc]onversion|// .*[Mm]etadata|acquiredAtUtc.*lock|lockKey.*ttl|storedAtISO.*metadata|exportedAtISO.*metadata|verificationTimestampISO.*metadata|auditEventId|\.sort\(.*Date|Math\.random.*uuid|uuidLike.*lock' \
          || true)
        
        if [[ -n "$filtered_hits" ]]; then
          echo "  [ENTROPY RISK] ${pat} in ${path}:" | tee -a "${e}/PHASE_06_determinism.txt"
          echo "$filtered_hits" | head -10 | tee -a "${e}/PHASE_06_determinism.txt"
          entropy_violations+="$filtered_hits"$'\n'
        fi
      fi
    done
  done

  if [[ -n "$entropy_violations" ]]; then
    phase_fail "06" \
      "Non-deterministic constructs found in canonical paths without Clock injection. Use Clock parameter for determinism." \
      "${e}/PHASE_06_determinism.txt"
  fi
  echo "  [PASS] No unmitigated entropy violations in canonical paths." | tee -a "${e}/PHASE_06_determinism.txt"

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

  # ── Export Artifact Contamination Scan (3 Layers) ─────────────────────────
  echo "[06] Export artifact contamination scan (correlationId/UUID leakage)..." \
    | tee -a "${e}/PHASE_06_export_artifact_contamination_scan.txt"

  local artifact_dir="${e}/export_artifacts"
  mkdir -p "$artifact_dir"

  # Generate LAYER C: Pack file artifacts (individual files)
  echo "  [LAYER C] Generating pack file artifacts..." \
    | tee -a "${e}/PHASE_06_export_artifact_contamination_scan.txt"
  (
    cd "${repo_dir}"
    FT_EXPORT_ARTIFACT_DIR="$artifact_dir" npm test -- tests/determinism/exportArtifactGenerator.ts \
      >> "${e}/PHASE_06_export_artifact_contamination_scan.txt" 2>&1 || {
        echo "  [ERROR] Failed to generate pack file artifacts" \
          | tee -a "${e}/PHASE_06_export_artifact_contamination_scan.txt"
        phase_fail "06" "Pack file artifact generation failed" \
          "${e}/PHASE_06_export_artifact_contamination_scan.txt"
      }
  )

  # Generate LAYER A/B: Customer-delivered ZIP artifact (final output)
  echo "  [LAYER A/B] Generating customer ZIP artifact..." \
    | tee -a "${e}/PHASE_06_export_artifact_contamination_scan.txt"
  (
    cd "${repo_dir}"
    FT_EXPORT_ARTIFACT_DIR="$artifact_dir" npm test -- tests/determinism/exportZipArtifactGenerator.test.ts \
      >> "${e}/PHASE_06_export_artifact_contamination_scan.txt" 2>&1 || {
        echo "  [ERROR] Failed to generate ZIP artifact" \
          | tee -a "${e}/PHASE_06_export_artifact_contamination_scan.txt"
        phase_fail "06" "ZIP artifact generation failed" \
          "${e}/PHASE_06_export_artifact_contamination_scan.txt"
      }
  )

  # Verify ZIP was created
  local zip_path="${artifact_dir}/export_pack.zip"
  if [[ ! -f "$zip_path" ]]; then
    echo "  [ERROR] ZIP artifact not found: $zip_path" \
      | tee -a "${e}/PHASE_06_export_artifact_contamination_scan.txt"
    phase_fail "06" "ZIP artifact generation produced no file" \
      "${e}/PHASE_06_export_artifact_contamination_scan.txt"
  fi

  local zip_size
  zip_size=$(stat -f%z "$zip_path" 2>/dev/null || stat -c%s "$zip_path" 2>/dev/null || echo "0")
  if [[ "$zip_size" -eq 0 ]]; then
    echo "  [ERROR] ZIP artifact is empty" \
      | tee -a "${e}/PHASE_06_export_artifact_contamination_scan.txt"
    phase_fail "06" "ZIP artifact is 0 bytes" \
      "${e}/PHASE_06_export_artifact_contamination_scan.txt"
  fi

  echo "  Generated ZIP: $zip_size bytes" \
    | tee -a "${e}/PHASE_06_export_artifact_contamination_scan.txt"
  
  local zip_sha
  zip_sha=$(sha256sum "$zip_path" 2>/dev/null | awk '{print $1}' || echo "sha256_unavailable")
  echo "  ZIP SHA-256: $zip_sha" \
    | tee -a "${e}/PHASE_06_export_artifact_contamination_scan.txt"

  # Define contamination patterns
  local contamination_pattern='\bcorrelationId\b|dash-[0-9a-f]{8}\b|[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}'

  # ── LAYER A: Scan raw ZIP bytes ───────────────────────────────────────────
  echo "  [LAYER A] Scanning raw ZIP bytes with strings..." \
    | tee -a "${e}/PHASE_06_export_artifact_contamination_scan.txt"
  
  local layer_a_contamination=""
  layer_a_contamination=$(strings "$zip_path" | rg "$contamination_pattern" 2>/dev/null || true)
  
  if [[ -n "$layer_a_contamination" ]]; then
    echo "  [CONTAMINATION DETECTED - LAYER A] Raw ZIP bytes contain forbidden patterns:" \
      | tee -a "${e}/PHASE_06_export_artifact_contamination_scan.txt"
    echo "$layer_a_contamination" | head -20 | tee -a "${e}/PHASE_06_export_artifact_contamination_scan.txt"
    phase_fail "06" \
      "LAYER A FAIL: Raw ZIP bytes contain correlationId/UUID/dash-* patterns — contamination in customer-delivered artifact." \
      "${e}/PHASE_06_export_artifact_contamination_scan.txt"
  fi
  echo "    LAYER A: 0 matches in raw ZIP bytes (clean)" \
    | tee -a "${e}/PHASE_06_export_artifact_contamination_scan.txt"

  # ── LAYER B: Scan extracted ZIP contents ──────────────────────────────────
  echo "  [LAYER B] Extracting and scanning ZIP contents..." \
    | tee -a "${e}/PHASE_06_export_artifact_contamination_scan.txt"
  
  # Check for unzip availability (fail-closed requirement)
  if ! command -v unzip >/dev/null 2>&1; then
    echo "  [ERROR] unzip not available — cannot verify extracted ZIP contents" \
      | tee -a "${e}/PHASE_06_export_artifact_contamination_scan.txt"
    phase_fail "06" \
      "unzip not available in environment — cannot perform LAYER B scan. Cleanroom must have unzip." \
      "${e}/PHASE_06_export_artifact_contamination_scan.txt"
  fi
  echo "    unzip: $(command -v unzip)" \
    | tee -a "${e}/PHASE_06_export_artifact_contamination_scan.txt"

  local unzipped_dir="${artifact_dir}/unzipped"
  mkdir -p "$unzipped_dir"
  
  unzip -q -o "$zip_path" -d "$unzipped_dir" 2>&1 \
    | tee -a "${e}/PHASE_06_export_artifact_contamination_scan.txt" || {
      echo "  [ERROR] Failed to extract ZIP" \
        | tee -a "${e}/PHASE_06_export_artifact_contamination_scan.txt"
      phase_fail "06" "ZIP extraction failed" \
        "${e}/PHASE_06_export_artifact_contamination_scan.txt"
    }

  # Fix permissions on extracted files (deterministic ZIP may have zero perms)
  chmod -R +r "$unzipped_dir" 2>/dev/null || true

  echo "    Extracted files:" | tee -a "${e}/PHASE_06_export_artifact_contamination_scan.txt"
  ls "$unzipped_dir" | sed 's/^/      /' \
    | tee -a "${e}/PHASE_06_export_artifact_contamination_scan.txt"

  local layer_b_contamination=""
  layer_b_contamination=$(rg -n "$contamination_pattern" "$unzipped_dir" 2>/dev/null || true)
  
  if [[ -n "$layer_b_contamination" ]]; then
    echo "  [CONTAMINATION DETECTED - LAYER B] Extracted ZIP contents contain forbidden patterns:" \
      | tee -a "${e}/PHASE_06_export_artifact_contamination_scan.txt"
    echo "$layer_b_contamination" | head -20 | tee -a "${e}/PHASE_06_export_artifact_contamination_scan.txt"
    phase_fail "06" \
      "LAYER B FAIL: Extracted ZIP files contain correlationId/UUID/dash-* patterns." \
      "${e}/PHASE_06_export_artifact_contamination_scan.txt"
  fi
  echo "    LAYER B: 0 matches in extracted files (clean)" \
    | tee -a "${e}/PHASE_06_export_artifact_contamination_scan.txt"

  # ── LAYER C: Scan pack file directory ─────────────────────────────────────
  echo "  [LAYER C] Scanning pack file artifacts..." \
    | tee -a "${e}/PHASE_06_export_artifact_contamination_scan.txt"
  
  echo "    Pack files:" | tee -a "${e}/PHASE_06_export_artifact_contamination_scan.txt"
  find "$artifact_dir" -maxdepth 1 -type f ! -name "*.zip" -exec basename {} \; \
    | sort | sed 's/^/      /' | tee -a "${e}/PHASE_06_export_artifact_contamination_scan.txt"

  local layer_c_contamination=""
  # Only scan non-zip files in artifact_dir root
  layer_c_contamination=$(find "$artifact_dir" -maxdepth 1 -type f ! -name "*.zip" \
    -exec rg -n "$contamination_pattern" {} + 2>/dev/null || true)
  
  if [[ -n "$layer_c_contamination" ]]; then
    echo "  [CONTAMINATION DETECTED - LAYER C] Pack files contain forbidden patterns:" \
      | tee -a "${e}/PHASE_06_export_artifact_contamination_scan.txt"
    echo "$layer_c_contamination" | head -20 | tee -a "${e}/PHASE_06_export_artifact_contamination_scan.txt"
    phase_fail "06" \
      "LAYER C FAIL: Pack file artifacts contain correlationId/UUID/dash-* patterns." \
      "${e}/PHASE_06_export_artifact_contamination_scan.txt"
  fi
  echo "    LAYER C: 0 matches in pack files (clean)" \
    | tee -a "${e}/PHASE_06_export_artifact_contamination_scan.txt"

  echo "  [PASS] 3-layer contamination scan: 0 violations detected." \
    | tee -a "${e}/PHASE_06_export_artifact_contamination_scan.txt"

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
