#!/usr/bin/env bash
# lib/runtime.sh — Phase 7: Runtime execution gates (no warnings)
set -euo pipefail

run_runtime() {
  local e="${E}"
  local repo_dir="${REPO_DIR}"
  phase_start "07" "Runtime Execution Gates (No Warnings)"

  # Track what ran and what was skipped (deterministic)
  local phase07_ran=()
  local phase07_skipped=()

  # ── npm test ──────────────────────────────────────────────────────────────
  # Skip if FT_SKIP_TESTS_IN_AUDIT=1 (tests already run in CI before audit)
  if [[ "${FT_SKIP_TESTS_IN_AUDIT:-0}" == "1" ]]; then
    echo "[07] npm test skipped (FT_SKIP_TESTS_IN_AUDIT=1 - tests run separately in CI)" | tee "${e}/PHASE_07_test.txt"
    phase07_skipped+=("npm_test:tests_verified_separately_in_ci")
    phase_flag "07" "LOW" "npm test skipped (tests verified separately in CI pipeline)" "${e}/PHASE_07_test.txt"
  else
    echo "[07] Running npm test..." | tee "${e}/PHASE_07_test.txt"
    local test_exit=0
    (
      cd "${repo_dir}"
      npm test 2>&1
    ) > "${e}/PHASE_07_test.txt" 2>&1 || test_exit=$?

    if [[ "$test_exit" -ne 0 ]]; then
      echo "FAIL: npm test exited with code ${test_exit}" | tee -a "${e}/PHASE_07_test.txt"
      phase_fail "07" "npm test failed (exit code ${test_exit}). All tests must pass." \
        "${e}/PHASE_07_test.txt"
    fi

    # Check for warnings in output
    if grep -qiE 'warning|warn' "${e}/PHASE_07_test.txt" 2>/dev/null; then
      local warn_count
      warn_count=$(grep -icE 'warning|warn' "${e}/PHASE_07_test.txt" || echo 0)
      echo "  Warnings in npm test output: ${warn_count}" | tee -a "${e}/PHASE_07_test.txt"
      phase_flag "07" "MEDIUM" "npm test produced ${warn_count} warning line(s)" "${e}/PHASE_07_test.txt"
    fi
    echo "  npm test passed." | tee -a "${e}/PHASE_07_test.txt"
    phase07_ran+=("npm_test")
  fi

  # ── ESLint (--max-warnings=0) ─────────────────────────────────────────────
  echo "[07] Running ESLint..." | tee "${e}/PHASE_07_eslint.txt"
  local lint_exit=0

  # Check if there's a lint script in package.json
  local has_lint_script
  has_lint_script=$(jq -r '.scripts.lint // ""' "${repo_dir}/package.json" 2>/dev/null || echo "")

  if [[ -n "$has_lint_script" ]] && [[ "$has_lint_script" != "echo"* ]]; then
    (cd "${repo_dir}" && npm run lint 2>&1) > "${e}/PHASE_07_eslint.txt" 2>&1 || lint_exit=$?
    phase07_ran+=("eslint")
  else
    # Run eslint directly if available
    if command -v eslint &>/dev/null || [[ -f "${repo_dir}/node_modules/.bin/eslint" ]]; then
      (
        cd "${repo_dir}"
        npx eslint . --max-warnings=0 \
          --ignore-pattern 'node_modules' \
          --ignore-pattern 'src/gadget-ui/node_modules' \
          --ignore-pattern 'dist' \
          2>&1
      ) > "${e}/PHASE_07_eslint.txt" 2>&1 || lint_exit=$?
      phase07_ran+=("eslint")
    else
      echo "  eslint not found; skipping (no-op lint script detected)" \
        | tee -a "${e}/PHASE_07_eslint.txt"
      phase07_skipped+=("eslint:not_configured")
      phase_flag "07" "LOW" "ESLint not configured or not runnable; lint gate skipped." \
        "${e}/PHASE_07_eslint.txt"
      lint_exit=0
    fi
  fi

  if [[ "$lint_exit" -ne 0 ]]; then
    phase_fail "07" "ESLint failed with warnings/errors (exit ${lint_exit}). Max 0 warnings enforced." \
      "${e}/PHASE_07_eslint.txt"
  fi
  
  if [[ "$lint_exit" -eq 0 ]] && [[ "${phase07_ran[*]}" =~ eslint ]]; then
    echo "  Lint passed." | tee -a "${e}/PHASE_07_eslint.txt"
  fi

  # ── forge lint ────────────────────────────────────────────────────────────
  echo "[07] Running forge lint..." | tee "${e}/PHASE_07_forge_lint.txt"
  local fl_exit=0
  (
    cd "${repo_dir}"
    forge lint 2>&1
  ) > "${e}/PHASE_07_forge_lint.txt" 2>&1 || fl_exit=$?

  if [[ "$fl_exit" -ne 0 ]]; then
    # Check if it's a non-auth error (forge lint requires auth in some versions)
    if grep -qiE "not logged in|you must be logged in|credentials|authenticate|unauthorized|api token|ENOTFOUND" \
        "${e}/PHASE_07_forge_lint.txt" 2>/dev/null; then
      phase07_skipped+=("forge_lint:requires_auth")
      phase_flag "07" "MEDIUM" "forge lint requires authentication; cannot run in cleanroom. Manual verification required." \
        "${e}/PHASE_07_forge_lint.txt"
    else
      phase_fail "07" "forge lint failed (exit ${fl_exit})." "${e}/PHASE_07_forge_lint.txt"
    fi
  else
    echo "  forge lint passed." | tee -a "${e}/PHASE_07_forge_lint.txt"
    phase07_ran+=("forge_lint")
  fi

  # ── forge deploy --dry-run --verbose ──────────────────────────────────────
  echo "[07] Running forge deploy --dry-run --verbose..." | tee "${e}/PHASE_07_forge_deploy_dry.txt"
  local fd_exit=0
  (
    cd "${repo_dir}"
    forge deploy --dry-run --verbose 2>&1
  ) > "${e}/PHASE_07_forge_deploy_dry.txt" 2>&1 || fd_exit=$?

  if [[ "$fd_exit" -ne 0 ]]; then
    if grep -q "You must be logged in\|credentials\|authenticate\|ENOTFOUND\|token" \
        "${e}/PHASE_07_forge_deploy_dry.txt" 2>/dev/null; then
      phase07_skipped+=("forge_deploy_dry:requires_auth")
      phase_flag "07" "MEDIUM" "forge deploy --dry-run requires auth; cannot run in cleanroom. Manual verification required." \
        "${e}/PHASE_07_forge_deploy_dry.txt"
    elif grep -q "unknown option.*--dry-run\|--dry-run.*not.*support" \
        "${e}/PHASE_07_forge_deploy_dry.txt" 2>/dev/null; then
      phase07_skipped+=("forge_deploy_dry:not_supported")
      phase_flag "07" "MEDIUM" "forge deploy --dry-run not supported by this CLI version; skipping deploy validation." \
        "${e}/PHASE_07_forge_deploy_dry.txt"
    else
      phase_fail "07" "forge deploy --dry-run --verbose failed (exit ${fd_exit})." \
        "${e}/PHASE_07_forge_deploy_dry.txt"
    fi
  else
    # Check for warnings
    if grep -qiE 'warning|warn' "${e}/PHASE_07_forge_deploy_dry.txt" 2>/dev/null; then
      phase_fail "07" "forge deploy --dry-run produced warnings. Zero-warning policy violated." \
        "${e}/PHASE_07_forge_deploy_dry.txt"
    fi
    echo "  forge deploy --dry-run passed." | tee -a "${e}/PHASE_07_forge_deploy_dry.txt"
    phase07_ran+=("forge_deploy_dry")
  fi

  # Write deterministic tracking files
  printf "%s\n" "${phase07_ran[@]}" | sort > "${e}/PHASE_07_ran.txt" 2>/dev/null || touch "${e}/PHASE_07_ran.txt"
  printf "%s\n" "${phase07_skipped[@]}" | sort > "${e}/PHASE_07_skipped.txt" 2>/dev/null || touch "${e}/PHASE_07_skipped.txt"

  # Final phase result based on what was skipped
  local skip_count=${#phase07_skipped[@]}
  local ran_count=${#phase07_ran[@]}
  
  if [[ $skip_count -gt 0 ]]; then
    # PASS_WITH_SKIPS: some checks were skipped but those that ran passed
    write_json_result "07" "PASS_WITH_SKIPS" "Runtime execution gates: ${ran_count} checks ran, ${skip_count} skipped. See PHASE_07_ran.txt and PHASE_07_skipped.txt." "" ""
    echo "[07] Phase 07 result: PASS_WITH_SKIPS (${ran_count} ran, ${skip_count} skipped)"
  else
    # All checks ran and passed
    phase_pass "07" "Runtime execution gates: npm test, lint, forge lint, forge deploy dry-run all passed."
  fi
}

export -f run_runtime
