#!/bin/bash

################################################################################
# parity_gate.sh - Enforce vendor <-> dev app synchronization
#
# PHASE 2: Validates that FirstTry---Audit-Evidence-for-Jira (vendor/canonical)
# and atlassian/forge-app (dev copy) are in sync.
#
# Comparisons:
#   1. Manifest scopes & modules (must be identical)
#   2. Source code parity (src/ directory sha256)
#   3. Package.json parity (dependencies, devDependencies)
#   4. Resources/static parity (if present)
#
# Output: $EVIDENCE_ROOT/02_parity/parity_report.json
#
# Exit behavior (when run directly):
#   - 0 if PARITY PASS (vendor == dev)
#   - 1 if PARITY FAIL (vendor != dev)
#   - 2 if CRITICAL ERROR (manifest missing, dirs not found, etc)
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

  # Paths
  local VENDOR_APP="${repo_root}/FirstTry---Audit-Evidence-for-Jira"
  local DEV_APP="${repo_root}/atlassian/forge-app"
  local EVIDENCE_PARITY_DIR="${evidence_root}/02_parity"
  local PARITY_REPORT="${EVIDENCE_PARITY_DIR}/parity_report.json"

  # Create evidence directory
  mkdir -p "${EVIDENCE_PARITY_DIR}"

  # Initialize report structure
  local parity_status="PASS"
  local parity_issues=()

  # Initialize hash variables for extended directories
  local resources_vendor_hash="" resources_dev_hash="" resources_vendor_count="0" resources_dev_count="0"
  local static_vendor_hash="" static_dev_hash="" static_vendor_count="0" static_dev_count="0"
  local dist_vendor_hash="" dist_dev_hash="" dist_vendor_count="0" dist_dev_count="0"
  local ui_vendor_hash="" ui_dev_hash="" ui_vendor_count="0" ui_dev_count="0"

  # Initialize dependency integrity variables
  local vendor_package_lock_hash="" dev_package_lock_hash=""
  local vendor_yarn_lock_hash="" dev_yarn_lock_hash=""
  local vendor_pnpm_lock_hash="" dev_pnpm_lock_hash=""
  local vendor_lockfile_present="false" dev_lockfile_present="false"
  local dependency_integrity_match="true"

  log_parity() {
    echo "[PARITY] $*"
  }

  fail_parity() {
    parity_status="FAIL"
    parity_issues+=("$1")
    echo "[PARITY] ❌ FAIL: $1" >&2
  }

  ################################################################################
  # 1. MANIFEST COMPARISON
  ################################################################################

  log_parity "=== MANIFEST COMPARISON ==="

  if [[ ! -f "${VENDOR_APP}/manifest.yml" ]]; then
    fail_parity "Vendor manifest missing: ${VENDOR_APP}/manifest.yml"
    echo "2" > "${EVIDENCE_PARITY_DIR}/exit_code"
    return 2
  fi

  if [[ ! -f "${DEV_APP}/manifest.yml" ]]; then
    fail_parity "Dev manifest missing: ${DEV_APP}/manifest.yml"
    echo "2" > "${EVIDENCE_PARITY_DIR}/exit_code"
    return 2
  fi

  # Extract app ID from vendor and dev manifests
  local vendor_app_id
  vendor_app_id=$(grep -E "^\s*id:" "${VENDOR_APP}/manifest.yml" | head -1 | sed 's/.*id:\s*//' | xargs)
  local dev_app_id
  dev_app_id=$(grep -E "^\s*id:" "${DEV_APP}/manifest.yml" | head -1 | sed 's/.*id:\s*//' | xargs)

  log_parity "Vendor app ID: ${vendor_app_id}"
  log_parity "Dev app ID:    ${dev_app_id}"

  if [[ "${vendor_app_id}" != "${dev_app_id}" ]]; then
    fail_parity "App ID mismatch: vendor='${vendor_app_id}' vs dev='${dev_app_id}'"
  fi

  # Compare full manifest content (ignoring comments and whitespace)
  local vendor_manifest_normalized
  vendor_manifest_normalized=$(sed '/^#/d; /^[[:space:]]*$/d; s/[[:space:]]*//g' "${VENDOR_APP}/manifest.yml" | sort)
  local dev_manifest_normalized
  dev_manifest_normalized=$(sed '/^#/d; /^[[:space:]]*$/d; s/[[:space:]]*//g' "${DEV_APP}/manifest.yml" | sort)

  if [[ "${vendor_manifest_normalized}" != "${dev_manifest_normalized}" ]]; then
    fail_parity "Manifest content mismatch (ignoring comments/whitespace)"
  fi

  ################################################################################
  # 2. SOURCE CODE PARITY (sha256) - WITH EMPTY-SRC FAIL-CLOSED CHECK
  ################################################################################

  log_parity "=== SOURCE CODE PARITY ==="

  # Count actual source files in each directory (FAIL-CLOSED: both must have files)
  local vendor_src_count=0
  local dev_src_count=0

  if [[ -d "${VENDOR_APP}/src" ]]; then
    vendor_src_count=$(find "${VENDOR_APP}/src" -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) 2>/dev/null | wc -l)
  fi

  if [[ -d "${DEV_APP}/src" ]]; then
    dev_src_count=$(find "${DEV_APP}/src" -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) 2>/dev/null | wc -l)
  fi

  log_parity "Vendor src files: ${vendor_src_count}"
  log_parity "Dev src files:    ${dev_src_count}"

  # FAIL-CLOSED: If either has no source files, FAIL immediately
  if [[ $vendor_src_count -eq 0 ]]; then
    fail_parity "CRITICAL: Vendor src has no source files (empty_src)"
    echo "2" > "${EVIDENCE_PARITY_DIR}/exit_code"
    # Write report and return FAIL
    cat > "${PARITY_REPORT}" << EMPTY_SRC_EOF
{
  "parity_status": "FAIL",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "vendor_app": "FirstTry---Audit-Evidence-for-Jira",
  "dev_app": "atlassian/forge-app",
  "failure_reason": "empty_src",
  "issues": ["CRITICAL: Vendor src directory is empty"],
  "recommendation": "Cannot proceed: vendor src must contain source files"
}
EMPTY_SRC_EOF
    return 2
  fi

  if [[ $dev_src_count -eq 0 ]]; then
    fail_parity "CRITICAL: Dev src has no source files (empty_src)"
    echo "2" > "${EVIDENCE_PARITY_DIR}/exit_code"
    # Write report and return FAIL
    cat > "${PARITY_REPORT}" << EMPTY_SRC_EOF
{
  "parity_status": "FAIL",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "vendor_app": "FirstTry---Audit-Evidence-for-Jira",
  "dev_app": "atlassian/forge-app",
  "failure_reason": "empty_src",
  "issues": ["CRITICAL: Dev src directory is empty"],
  "recommendation": "Cannot proceed: dev src must contain source files"
}
EMPTY_SRC_EOF
    return 2
  fi

  # Hash source files deterministically (content-based, not metadata)
  local vendor_src_hash=""
  local dev_src_hash=""

  if [[ -d "${VENDOR_APP}/src" ]]; then
    vendor_src_hash=$(cd "${VENDOR_APP}" && \
      find src -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) -print0 2>/dev/null | \
      LC_ALL=C sort -z | \
      xargs -0 sha256sum 2>/dev/null | \
      sha256sum | \
      awk '{print $1}')
  fi

  if [[ -d "${DEV_APP}/src" ]]; then
    dev_src_hash=$(cd "${DEV_APP}" && \
      find src -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) -print0 2>/dev/null | \
      LC_ALL=C sort -z | \
      xargs -0 sha256sum 2>/dev/null | \
      sha256sum | \
      awk '{print $1}')
  fi

  log_parity "Vendor src hash: ${vendor_src_hash}"
  log_parity "Dev src hash:    ${dev_src_hash}"

  if [[ -z "$vendor_src_hash" || -z "$dev_src_hash" ]]; then
    fail_parity "Failed to compute src hashes"
  elif [[ "${vendor_src_hash}" != "${dev_src_hash}" ]]; then
    fail_parity "Source code mismatch: src/ directories differ"
  fi

  ################################################################################
  # 3. PACKAGE.JSON PARITY
  ################################################################################

  log_parity "=== PACKAGE.JSON PARITY ==="

  local vendor_pkg_hash=""
  local dev_pkg_hash=""

  if [[ -f "${VENDOR_APP}/package.json" && -f "${DEV_APP}/package.json" ]]; then
    vendor_pkg_hash=$(sha256sum "${VENDOR_APP}/package.json" | awk '{print $1}')
    dev_pkg_hash=$(sha256sum "${DEV_APP}/package.json" | awk '{print $1}')

    log_parity "Vendor package.json hash: ${vendor_pkg_hash}"
    log_parity "Dev package.json hash:    ${dev_pkg_hash}"

    if [[ "${vendor_pkg_hash}" != "${dev_pkg_hash}" ]]; then
      fail_parity "Package.json mismatch: dependencies may differ"
    fi
  elif [[ ! -f "${VENDOR_APP}/package.json" ]]; then
    fail_parity "Vendor package.json missing: ${VENDOR_APP}/package.json"
  elif [[ ! -f "${DEV_APP}/package.json" ]]; then
    fail_parity "Dev package.json missing: ${DEV_APP}/package.json"
  fi

  ################################################################################
  # 4. EXTENDED PARITY (resources, static, dist, ui) - FAIL-CLOSED
  ################################################################################

  log_parity "=== EXTENDED PARITY (resources, static, dist, ui) ==="

  local subdir
  for subdir in resources static dist ui; do
    local vendor_dir="${VENDOR_APP}/${subdir}"
    local dev_dir="${DEV_APP}/${subdir}"

    log_parity "Checking ${subdir}..."

    # Check if directory exists in vendor or dev
    if [[ -d "${vendor_dir}" || -d "${dev_dir}" ]]; then
      if [[ ! -d "${vendor_dir}" ]]; then
        fail_parity "${subdir} present in dev but missing in vendor"
        continue
      elif [[ ! -d "${dev_dir}" ]]; then
        fail_parity "${subdir} present in vendor but missing in dev"
        continue
      fi

      # Ensure directory has files - FAIL-CLOSED if empty
      local vendor_file_count
      vendor_file_count=$(find "${vendor_dir}" -type f 2>/dev/null | wc -l)
      local dev_file_count
      dev_file_count=$(find "${dev_dir}" -type f 2>/dev/null | wc -l)

      log_parity "${subdir} vendor files: ${vendor_file_count}"
      log_parity "${subdir} dev files:    ${dev_file_count}"

      # FAIL-CLOSED: If directory exists but produces zero files
      if [[ $vendor_file_count -eq 0 && -d "${vendor_dir}" ]]; then
        fail_parity "CRITICAL: ${subdir} directory exists but contains no files in vendor"
        continue
      fi
      if [[ $dev_file_count -eq 0 && -d "${dev_dir}" ]]; then
        fail_parity "CRITICAL: ${subdir} directory exists but contains no files in dev"
        continue
      fi

      # Hash directory contents deterministically
      local vendor_hash=""
      local dev_hash=""

      # Compute hash using deterministic approach
      if [[ $vendor_file_count -gt 0 ]]; then
        vendor_hash=$(cd "${vendor_dir}" && \
          find . -type f -print0 2>/dev/null | \
          LC_ALL=C sort -z | \
          xargs -0 sha256sum 2>/dev/null | \
          sha256sum | \
          awk '{print $1}')
      fi

      if [[ $dev_file_count -gt 0 ]]; then
        dev_hash=$(cd "${dev_dir}" && \
          find . -type f -print0 2>/dev/null | \
          LC_ALL=C sort -z | \
          xargs -0 sha256sum 2>/dev/null | \
          sha256sum | \
          awk '{print $1}')
      fi

      log_parity "${subdir} vendor hash: ${vendor_hash}"
      log_parity "${subdir} dev hash:    ${dev_hash}"

      if [[ -n "${vendor_hash}" && -n "${dev_hash}" && "${vendor_hash}" != "${dev_hash}" ]]; then
        fail_parity "${subdir} content mismatch between vendor and dev"
      fi

      # Store hashes in global variables for report generation
      case "${subdir}" in
        "resources") resources_vendor_hash="${vendor_hash}"; resources_dev_hash="${dev_hash}"; resources_vendor_count="${vendor_file_count}"; resources_dev_count="${dev_file_count}" ;;
        "static") static_vendor_hash="${vendor_hash}"; static_dev_hash="${dev_hash}"; static_vendor_count="${vendor_file_count}"; static_dev_count="${dev_file_count}" ;;
        "dist") dist_vendor_hash="${vendor_hash}"; dist_dev_hash="${dev_hash}"; dist_vendor_count="${vendor_file_count}"; dist_dev_count="${dev_file_count}" ;;
        "ui") ui_vendor_hash="${vendor_hash}"; ui_dev_hash="${dev_hash}"; ui_vendor_count="${vendor_file_count}"; ui_dev_count="${dev_file_count}" ;;
      esac
    else
      log_parity "${subdir} not present in either vendor or dev (OK)"
      # Set empty values for report
      case "${subdir}" in
        "resources") resources_vendor_hash=""; resources_dev_hash=""; resources_vendor_count="0"; resources_dev_count="0" ;;
        "static") static_vendor_hash=""; static_dev_hash=""; static_vendor_count="0"; static_dev_count="0" ;;
        "dist") dist_vendor_hash=""; dist_dev_hash=""; dist_vendor_count="0"; dist_dev_count="0" ;;
        "ui") ui_vendor_hash=""; ui_dev_hash=""; ui_vendor_count="0"; ui_dev_count="0" ;;
      esac
    fi
  done

  ################################################################################
  # 5. DEPENDENCY INTEGRITY CHECK (FAIL-CLOSED)
  ################################################################################

  log_parity "=== DEPENDENCY INTEGRITY CHECK ==="

  # Check for package.json existence in both vendor and dev
  local vendor_has_package_json=false
  local dev_has_package_json=false

  if [[ -f "${VENDOR_APP}/package.json" ]]; then
    vendor_has_package_json=true
    log_parity "Vendor package.json found"
  fi

  if [[ -f "${DEV_APP}/package.json" ]]; then
    dev_has_package_json=true
    log_parity "Dev package.json found"
  fi

  # Check lockfiles for vendor app
  if [[ $vendor_has_package_json == true ]]; then
    if [[ -f "${VENDOR_APP}/package-lock.json" ]]; then
      vendor_package_lock_hash=$(sha256sum "${VENDOR_APP}/package-lock.json" | awk '{print $1}')
      vendor_lockfile_present="true"
      log_parity "Vendor package-lock.json hash: ${vendor_package_lock_hash}"
    elif [[ -f "${VENDOR_APP}/yarn.lock" ]]; then
      vendor_yarn_lock_hash=$(sha256sum "${VENDOR_APP}/yarn.lock" | awk '{print $1}')
      vendor_lockfile_present="true"
      log_parity "Vendor yarn.lock hash: ${vendor_yarn_lock_hash}"
    elif [[ -f "${VENDOR_APP}/pnpm-lock.yaml" ]]; then
      vendor_pnpm_lock_hash=$(sha256sum "${VENDOR_APP}/pnpm-lock.yaml" | awk '{print $1}')
      vendor_lockfile_present="true"
      log_parity "Vendor pnpm-lock.yaml hash: ${vendor_pnpm_lock_hash}"
    else
      fail_parity "CRITICAL: package.json exists but no lockfile found in vendor app"
      log_parity "Vendor lockfile: MISSING (CRITICAL)"
    fi
  fi

  # Check lockfiles for dev app
  if [[ $dev_has_package_json == true ]]; then
    if [[ -f "${DEV_APP}/package-lock.json" ]]; then
      dev_package_lock_hash=$(sha256sum "${DEV_APP}/package-lock.json" | awk '{print $1}')
      dev_lockfile_present="true"
      log_parity "Dev package-lock.json hash: ${dev_package_lock_hash}"
    elif [[ -f "${DEV_APP}/yarn.lock" ]]; then
      dev_yarn_lock_hash=$(sha256sum "${DEV_APP}/yarn.lock" | awk '{print $1}')
      dev_lockfile_present="true"
      log_parity "Dev yarn.lock hash: ${dev_yarn_lock_hash}"
    elif [[ -f "${DEV_APP}/pnpm-lock.yaml" ]]; then
      dev_pnpm_lock_hash=$(sha256sum "${DEV_APP}/pnpm-lock.yaml" | awk '{print $1}')
      dev_lockfile_present="true"
      log_parity "Dev pnpm-lock.yaml hash: ${dev_pnpm_lock_hash}"
    else
      fail_parity "CRITICAL: package.json exists but no lockfile found in dev app"
      log_parity "Dev lockfile: MISSING (CRITICAL)"
    fi
  fi

  # Compare lockfile hashes for consistency
  if [[ $vendor_lockfile_present == "true" && $dev_lockfile_present == "true" ]]; then
    local lockfile_match=false
    if [[ -n "$vendor_package_lock_hash" && -n "$dev_package_lock_hash" ]]; then
      if [[ "$vendor_package_lock_hash" == "$dev_package_lock_hash" ]]; then
        lockfile_match=true
      fi
    elif [[ -n "$vendor_yarn_lock_hash" && -n "$dev_yarn_lock_hash" ]]; then
      if [[ "$vendor_yarn_lock_hash" == "$dev_yarn_lock_hash" ]]; then
        lockfile_match=true
      fi
    elif [[ -n "$vendor_pnpm_lock_hash" && -n "$dev_pnpm_lock_hash" ]]; then
      if [[ "$vendor_pnpm_lock_hash" == "$dev_pnpm_lock_hash" ]]; then
        lockfile_match=true
      fi
    fi

    if [[ $lockfile_match == false ]]; then
      fail_parity "Dependency lockfile mismatch between vendor and dev"
      dependency_integrity_match="false"
    fi
  fi

  ################################################################################
  # 6. BUILD REPORT
  ################################################################################

  log_parity "=== GENERATING PARITY REPORT ==="

  # Build JSON report directly (avoids sed escaping issues)
  local app_id_match
  app_id_match=$([ "${vendor_app_id}" = "${dev_app_id}" ] && echo "true" || echo "false")
  local content_match
  content_match=$([ "${vendor_manifest_normalized}" = "${dev_manifest_normalized}" ] && echo "true" || echo "false")
  local src_match
  src_match=$([ "${vendor_src_hash}" = "${dev_src_hash}" ] && echo "true" || echo "false")
  local pkg_match
  pkg_match=$([ "${vendor_pkg_hash}" = "${dev_pkg_hash}" ] && echo "true" || echo "false")

  # Extended directory matches
  local resources_match="true"
  if [[ -n "${resources_vendor_hash}" || -n "${resources_dev_hash}" ]]; then
    resources_match=$([ "${resources_vendor_hash}" = "${resources_dev_hash}" ] && echo "true" || echo "false")
  fi
  local static_match="true"
  if [[ -n "${static_vendor_hash}" || -n "${static_dev_hash}" ]]; then
    static_match=$([ "${static_vendor_hash}" = "${static_dev_hash}" ] && echo "true" || echo "false")
  fi
  local dist_match="true"
  if [[ -n "${dist_vendor_hash}" || -n "${dist_dev_hash}" ]]; then
    dist_match=$([ "${dist_vendor_hash}" = "${dist_dev_hash}" ] && echo "true" || echo "false")
  fi
  local ui_match="true"
  if [[ -n "${ui_vendor_hash}" || -n "${ui_dev_hash}" ]]; then
    ui_match=$([ "${ui_vendor_hash}" = "${ui_dev_hash}" ] && echo "true" || echo "false")
  fi

  # Format issues as JSON array
  local issues_json="["
  local first_issue=true
  local issue
  for issue in "${parity_issues[@]}"; do
    if [[ "$first_issue" == true ]]; then
      issues_json="${issues_json}\"${issue}\""
      first_issue=false
    else
      issues_json="${issues_json},\"${issue}\""
    fi
  done
  issues_json="${issues_json}]"

  local recommendation="Apps are in sync. Safe to proceed with audits."
  if [[ "${parity_status}" == "FAIL" ]]; then
    recommendation="⚠️ PARITY FAILURE - Apps are out of sync. Run sync_dev_from_vendor.sh to remediate."
  fi

  cat > "${PARITY_REPORT}" << FINAL_EOF
{
  "parity_status": "${parity_status}",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "vendor_app": "FirstTry---Audit-Evidence-for-Jira",
  "dev_app": "atlassian/forge-app",
  "checks": {
    "manifest": {
      "vendor_path": "${VENDOR_APP}/manifest.yml",
      "dev_path": "${DEV_APP}/manifest.yml",
      "app_id_match": ${app_id_match},
      "content_match": ${content_match}
    },
    "source_code": {
      "vendor_src_count": ${vendor_src_count},
      "dev_src_count": ${dev_src_count},
      "vendor_src_hash": "${vendor_src_hash}",
      "dev_src_hash": "${dev_src_hash}",
      "match": ${src_match}
    },
    "package_json": {
      "vendor_hash": "${vendor_pkg_hash}",
      "dev_hash": "${dev_pkg_hash}",
      "match": ${pkg_match}
    },
    "resources": {
      "vendor_count": ${resources_vendor_count:-0},
      "dev_count": ${resources_dev_count:-0},
      "vendor_hash": "${resources_vendor_hash}",
      "dev_hash": "${resources_dev_hash}",
      "match": ${resources_match}
    },
    "static": {
      "vendor_count": ${static_vendor_count:-0},
      "dev_count": ${static_dev_count:-0},
      "vendor_hash": "${static_vendor_hash}",
      "dev_hash": "${static_dev_hash}",
      "match": ${static_match}
    },
    "dist": {
      "vendor_count": ${dist_vendor_count:-0},
      "dev_count": ${dist_dev_count:-0},
      "vendor_hash": "${dist_vendor_hash}",
      "dev_hash": "${dist_dev_hash}",
      "match": ${dist_match}
    },
    "ui": {
      "vendor_count": ${ui_vendor_count:-0},
      "dev_count": ${ui_dev_count:-0},
      "vendor_hash": "${ui_vendor_hash}",
      "dev_hash": "${ui_dev_hash}",
      "match": ${ui_match}
    },
    "dependencies": {
      "vendor_package_lock_hash": "${vendor_package_lock_hash}",
      "dev_package_lock_hash": "${dev_package_lock_hash}",
      "vendor_yarn_lock_hash": "${vendor_yarn_lock_hash}",
      "dev_yarn_lock_hash": "${dev_yarn_lock_hash}",
      "vendor_pnpm_lock_hash": "${vendor_pnpm_lock_hash}",
      "dev_pnpm_lock_hash": "${dev_pnpm_lock_hash}",
      "vendor_lockfile_present": ${vendor_lockfile_present},
      "dev_lockfile_present": ${dev_lockfile_present},
      "integrity_match": ${dependency_integrity_match}
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

  if [[ "${parity_status}" == "PASS" ]]; then
    log_parity "✅ PARITY PASS: Vendor and dev apps are synchronized"
    echo "0" > "${EVIDENCE_PARITY_DIR}/exit_code"
    return 0
  else
    log_parity "❌ PARITY FAIL: $(printf '%s; ' "${parity_issues[@]}")"
    echo "1" > "${EVIDENCE_PARITY_DIR}/exit_code"
    return 1
  fi
}

# Only execute if run directly (not sourced)
if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  run_parity_gate "${1:-}" "${2:-}" "${3:-}" "${4:-}" || exit $?
fi
