#!/bin/bash

################################################################################
# parity_gate.sh - Canonical App Integrity Check
#
# PHASE 2: Validates that atlassian/forge-app (canonical production source)
# is fully intact and contains all required artifacts.
#
# Checks:
#   1. Canonical app root directory exists
#   2. manifest.yml exists and is non-empty
#   3. package.json exists and is non-empty
#   4. src/ directory exists and contains source files
#   5. audit/marketplace_submission/FREEZE_LOCK.json exists
#   6. audit/reviewer_ready_gate.sh exists and is executable
#
# Output: $EVIDENCE_ROOT/02_parity/parity_report.json
#
# Exit behavior (when run directly):
#   - 0 if INTEGRITY PASS (canonical tree intact)
#   - 1 if INTEGRITY FAIL (required artifacts missing or corrupt)
#   - 2 if CRITICAL ERROR (app root not found, manifest missing, etc.)
#
# Dependencies: Must be called with function arguments:
#   run_parity_gate <evidence_root> <repo_root> <app_root> <manifest_path>
################################################################################

run_parity_gate() {
  local evidence_root="$1"
  local repo_root="$2"
  local app_root="$3"
  local manifest_path="$4"

  # Validate arguments
  if [[ -z "$evidence_root" || -z "$repo_root" || -z "$app_root" || -z "$manifest_path" ]]; then
    echo "ERROR: run_parity_gate requires 4 arguments: evidence_root repo_root app_root manifest_path" >&2
    return 2
  fi

  # Canonical app root (always atlassian/forge-app)
  local CANONICAL_APP="${repo_root}/atlassian/forge-app"
  local EVIDENCE_PARITY_DIR="${evidence_root}/02_parity"
  local PARITY_REPORT="${EVIDENCE_PARITY_DIR}/parity_report.json"

  # Create evidence directory
  mkdir -p "${EVIDENCE_PARITY_DIR}"

  # Initialize report structure
  local integrity_status="PASS"
  local integrity_issues=()

  log_parity() {
    echo "[PARITY] $*"
  }

  fail_integrity() {
    integrity_status="FAIL"
    integrity_issues+=("$1")
    echo "[PARITY] ❌ FAIL: $1" >&2
  }

  ################################################################################
  # 1. CANONICAL APP ROOT EXISTS
  ################################################################################

  log_parity "=== CHECK 1: CANONICAL APP ROOT ==="

  if [[ ! -d "${CANONICAL_APP}" ]]; then
    fail_integrity "Canonical app root missing: ${CANONICAL_APP}"
    cat > "${PARITY_REPORT}" << CRITICAL_EOF
{
  "integrity_status": "FAIL",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "canonical_app": "atlassian/forge-app",
  "failure_reason": "canonical_app_root_missing",
  "issues": ["Canonical app root missing: ${CANONICAL_APP}"],
  "recommendation": "Canonical source atlassian/forge-app directory not found. Repository may be corrupt."
}
CRITICAL_EOF
    echo "2" > "${EVIDENCE_PARITY_DIR}/exit_code"
    return 2
  fi

  log_parity "✓ Canonical app root exists: ${CANONICAL_APP}"

  ################################################################################
  # 2. MANIFEST.YML EXISTS AND IS NON-EMPTY
  ################################################################################

  log_parity "=== CHECK 2: MANIFEST.YML ==="

  if [[ ! -f "${CANONICAL_APP}/manifest.yml" ]]; then
    fail_integrity "manifest.yml missing: ${CANONICAL_APP}/manifest.yml"
    cat > "${PARITY_REPORT}" << CRITICAL_EOF
{
  "integrity_status": "FAIL",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "canonical_app": "atlassian/forge-app",
  "failure_reason": "manifest_missing",
  "issues": ["manifest.yml missing at canonical location"],
  "recommendation": "Canonical source is missing manifest.yml. Production deployment cannot proceed."
}
CRITICAL_EOF
    echo "2" > "${EVIDENCE_PARITY_DIR}/exit_code"
    return 2
  fi

  local manifest_size
  manifest_size=$(wc -c < "${CANONICAL_APP}/manifest.yml" 2>/dev/null || echo 0)
  if [[ "$manifest_size" -eq 0 ]]; then
    fail_integrity "manifest.yml is empty: ${CANONICAL_APP}/manifest.yml"
  fi

  # Capture app ID from manifest for report
  local canonical_app_id
  canonical_app_id=$(grep -E "^\s*id:" "${CANONICAL_APP}/manifest.yml" | head -1 | sed 's/.*id:\s*//' | xargs 2>/dev/null || echo "unknown")

  log_parity "✓ manifest.yml present (${manifest_size} bytes), app ID: ${canonical_app_id}"

  ################################################################################
  # 3. PACKAGE.JSON EXISTS AND IS NON-EMPTY
  ################################################################################

  log_parity "=== CHECK 3: PACKAGE.JSON ==="

  if [[ ! -f "${CANONICAL_APP}/package.json" ]]; then
    fail_integrity "package.json missing: ${CANONICAL_APP}/package.json"
  else
    local pkg_size
    pkg_size=$(wc -c < "${CANONICAL_APP}/package.json" 2>/dev/null || echo 0)
    if [[ "$pkg_size" -eq 0 ]]; then
      fail_integrity "package.json is empty: ${CANONICAL_APP}/package.json"
    else
      log_parity "✓ package.json present (${pkg_size} bytes)"
    fi
  fi

  ################################################################################
  # 4. SRC/ DIRECTORY WITH SOURCE FILES (FAIL-CLOSED)
  ################################################################################

  log_parity "=== CHECK 4: SRC/ DIRECTORY ==="

  if [[ ! -d "${CANONICAL_APP}/src" ]]; then
    fail_integrity "CRITICAL: src/ directory missing: ${CANONICAL_APP}/src"
    cat > "${PARITY_REPORT}" << CRITICAL_EOF
{
  "integrity_status": "FAIL",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "canonical_app": "atlassian/forge-app",
  "failure_reason": "src_directory_missing",
  "issues": ["CRITICAL: src/ directory missing from canonical source"],
  "recommendation": "Canonical source is missing src/. Repository may be corrupt."
}
CRITICAL_EOF
    echo "2" > "${EVIDENCE_PARITY_DIR}/exit_code"
    return 2
  fi

  local src_file_count
  src_file_count=$(find "${CANONICAL_APP}/src" -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) 2>/dev/null | wc -l)

  if [[ "$src_file_count" -eq 0 ]]; then
    fail_integrity "CRITICAL: src/ directory exists but contains no source files (empty_src)"
    cat > "${PARITY_REPORT}" << CRITICAL_EOF
{
  "integrity_status": "FAIL",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "canonical_app": "atlassian/forge-app",
  "failure_reason": "empty_src",
  "issues": ["CRITICAL: src/ directory is empty — no .ts/.tsx/.js/.jsx files"],
  "recommendation": "Cannot proceed: canonical src must contain source files"
}
CRITICAL_EOF
    echo "2" > "${EVIDENCE_PARITY_DIR}/exit_code"
    return 2
  fi

  # Compute src hash for audit evidence
  local src_hash
  src_hash=$(cd "${CANONICAL_APP}" && \
    find src -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) -print0 2>/dev/null | \
    LC_ALL=C sort -z | \
    xargs -0 sha256sum 2>/dev/null | \
    sha256sum | \
    awk '{print $1}')

  log_parity "✓ src/ present: ${src_file_count} source files, hash: ${src_hash}"

  ################################################################################
  # 5. FREEZE_LOCK.JSON EXISTS
  ################################################################################

  log_parity "=== CHECK 5: FREEZE_LOCK.JSON ==="

  local freeze_lock_path="${CANONICAL_APP}/audit/marketplace_submission/FREEZE_LOCK.json"
  local freeze_lock_present="false"
  local freeze_lock_hash=""

  if [[ ! -f "${freeze_lock_path}" ]]; then
    fail_integrity "FREEZE_LOCK.json missing: ${freeze_lock_path}"
    log_parity "❌ FREEZE_LOCK.json not found"
  else
    freeze_lock_present="true"
    freeze_lock_hash=$(sha256sum "${freeze_lock_path}" | awk '{print $1}')
    log_parity "✓ FREEZE_LOCK.json present, hash: ${freeze_lock_hash}"
  fi

  ################################################################################
  # 6. REVIEWER_READY_GATE.SH EXISTS AND IS EXECUTABLE
  ################################################################################

  log_parity "=== CHECK 6: REVIEWER_READY_GATE.SH ==="

  local gate_script_path="${CANONICAL_APP}/audit/reviewer_ready_gate.sh"
  local gate_script_present="false"
  local gate_script_executable="false"

  if [[ ! -f "${gate_script_path}" ]]; then
    fail_integrity "reviewer_ready_gate.sh missing: ${gate_script_path}"
    log_parity "❌ reviewer_ready_gate.sh not found"
  else
    gate_script_present="true"
    if [[ -x "${gate_script_path}" ]]; then
      gate_script_executable="true"
      log_parity "✓ reviewer_ready_gate.sh present and executable"
    else
      fail_integrity "reviewer_ready_gate.sh not executable: ${gate_script_path}"
      log_parity "❌ reviewer_ready_gate.sh not executable"
    fi
  fi

  ################################################################################
  # BUILD REPORT
  ################################################################################

  log_parity "=== GENERATING INTEGRITY REPORT ==="

  # Format issues as JSON array
  local issues_json="["
  local first_issue=true
  local issue
  for issue in "${integrity_issues[@]}"; do
    if [[ "$first_issue" == true ]]; then
      issues_json="${issues_json}\"${issue}\""
      first_issue=false
    else
      issues_json="${issues_json},\"${issue}\""
    fi
  done
  issues_json="${issues_json}]"

  local recommendation="Canonical source atlassian/forge-app is intact. Safe to proceed with audits."
  if [[ "${integrity_status}" == "FAIL" ]]; then
    recommendation="⚠️ INTEGRITY FAILURE - Canonical source tree is missing required artifacts. Verify atlassian/forge-app is intact."
  fi

  cat > "${PARITY_REPORT}" << FINAL_EOF
{
  "integrity_status": "${integrity_status}",
  "parity_status": "${integrity_status}",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "canonical_app": "atlassian/forge-app",
  "canonical_app_path": "${CANONICAL_APP}",
  "checks": {
    "app_root_exists": $([ -d "${CANONICAL_APP}" ] && echo "true" || echo "false"),
    "manifest": {
      "present": $([ -f "${CANONICAL_APP}/manifest.yml" ] && echo "true" || echo "false"),
      "size_bytes": ${manifest_size:-0},
      "app_id": "${canonical_app_id}"
    },
    "package_json": {
      "present": $([ -f "${CANONICAL_APP}/package.json" ] && echo "true" || echo "false"),
      "size_bytes": ${pkg_size:-0}
    },
    "src": {
      "present": $([ -d "${CANONICAL_APP}/src" ] && echo "true" || echo "false"),
      "file_count": ${src_file_count:-0},
      "hash": "${src_hash}"
    },
    "freeze_lock": {
      "present": ${freeze_lock_present},
      "path": "${freeze_lock_path}",
      "hash": "${freeze_lock_hash}"
    },
    "reviewer_ready_gate": {
      "present": ${gate_script_present},
      "executable": ${gate_script_executable},
      "path": "${gate_script_path}"
    }
  },
  "issues": ${issues_json},
  "recommendation": "${recommendation}"
}
FINAL_EOF

  log_parity "Report saved: ${PARITY_REPORT}"

  ################################################################################
  # EXIT / RETURN
  ################################################################################

  if [[ "${integrity_status}" == "PASS" ]]; then
    log_parity "✅ INTEGRITY PASS: Canonical source atlassian/forge-app is intact"
    echo "0" > "${EVIDENCE_PARITY_DIR}/exit_code"
    return 0
  else
    log_parity "❌ INTEGRITY FAIL: $(printf '%s; ' "${integrity_issues[@]}")"
    echo "1" > "${EVIDENCE_PARITY_DIR}/exit_code"
    return 1
  fi
}

# Only execute if run directly (not sourced)
if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  run_parity_gate "${1:-}" "${2:-}" "${3:-}" "${4:-}" || exit $?
fi
