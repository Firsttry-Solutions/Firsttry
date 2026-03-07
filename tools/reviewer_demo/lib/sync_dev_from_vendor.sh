#!/bin/bash

################################################################################
# sync_dev_from_vendor.sh - RETIRED (no-op stub)
#
# RETIRED: PATH A migration (2026-03-07) established atlassian/forge-app as the
# single canonical production source. The former vendor-to-dev sync relationship
# no longer exists. This script is retained as a no-op stub for compatibility
# with any callers that have not yet been updated.
#
# ACTION REQUIRED FOR CALLERS:
#   - Remove calls to this script; it does nothing.
#   - The canonical source is atlassian/forge-app/ — it does not need sync.
#   - Canonical integrity is now checked by parity_gate.sh single-tree check.
################################################################################

run_sync_dev_from_vendor() {
  local repo_root="${1:-.}"

  echo "[SYNC] sync_dev_from_vendor.sh is a no-op stub." >&2
  echo "[SYNC] PATH A migration: atlassian/forge-app is the single canonical source." >&2
  echo "[SYNC] No sync is needed. Canonical integrity is verified by parity_gate.sh." >&2
  return 0

  # --- RETIRED CODE BELOW --- kept for historical reference only ---
  # Validate REPO_ROOT
  if [[ ! -d "${repo_root}/.git" ]]; then
    echo "ERROR: REPO_ROOT is not a git repository: ${repo_root}" >&2
    return 2
  fi

  local VENDOR_APP="${repo_root}/FirstTry---Audit-Evidence-for-Jira"
  local DEV_APP="${repo_root}/atlassian/forge-app"

  log_sync() {
    echo "[SYNC] $*"
  }

  log_error() {
    echo "[SYNC] ❌ ERROR: $*" >&2
  }

  ################################################################################
  # Validation
  ################################################################################

  log_sync "=== APP SYNC VALIDATION ==="

  if [[ ! -d "${VENDOR_APP}" ]]; then
    log_error "Vendor app directory not found: ${VENDOR_APP}"
    return 2
  fi

  if [[ ! -d "${DEV_APP}" ]]; then
    log_error "Dev app directory not found: ${DEV_APP}"
    return 2
  fi

  if [[ ! -f "${VENDOR_APP}/manifest.yml" ]]; then
    log_error "Vendor manifest missing: ${VENDOR_APP}/manifest.yml"
    return 2
  fi

  ################################################################################
  # Backup dev app state (optional but safe)
  ################################################################################

  log_sync "=== BACKING UP DEV APP ==="

  local BACKUP_DIR="${DEV_APP}.backup.$(date +%s)"
  mkdir -p "${BACKUP_DIR}"

  # Backup key files if they exist
  local file
  for file in manifest.yml package.json package-lock.json; do
    if [[ -f "${DEV_APP}/${file}" ]]; then
      cp "${DEV_APP}/${file}" "${BACKUP_DIR}/" 2>/dev/null || true
      log_sync "Backed up ${file}"
    fi
  done

  # Backup src directory
  if [[ -d "${DEV_APP}/src" ]]; then
    cp -r "${DEV_APP}/src" "${BACKUP_DIR}/" 2>/dev/null || true
    log_sync "Backed up src/ directory"
  fi

  log_sync "Backup location: ${BACKUP_DIR}"

  ################################################################################
  # Sync manifest.yml
  ################################################################################

  log_sync "=== SYNCING MANIFEST ==="

  if ! cp "${VENDOR_APP}/manifest.yml" "${DEV_APP}/manifest.yml"; then
    log_error "Failed to sync manifest.yml"
    return 1
  fi
  log_sync "✅ Synced manifest.yml"

  ################################################################################
  # Sync source code (src/)
  ################################################################################

  log_sync "=== SYNCING SOURCE CODE ==="

  if [[ -d "${VENDOR_APP}/src" ]]; then
    if [[ -d "${DEV_APP}/src" ]]; then
      rm -rf "${DEV_APP}/src"
      log_sync "Removed existing dev src/"
    fi

    if ! cp -r "${VENDOR_APP}/src" "${DEV_APP}/"; then
      log_error "Failed to sync src/ directory"
      return 1
    fi
    log_sync "✅ Synced src/ directory"
  else
    log_sync "ℹ️  Vendor src/ not found, skipping"
  fi

  ################################################################################
  # Sync resources directory (if present)
  ################################################################################

  log_sync "=== SYNCING RESOURCES ==="

  if [[ -d "${VENDOR_APP}/resources" ]]; then
    if [[ -d "${DEV_APP}/resources" ]]; then
      rm -rf "${DEV_APP}/resources"
      log_sync "Removed existing dev resources/"
    fi

    if ! cp -r "${VENDOR_APP}/resources" "${DEV_APP}/"; then
      log_error "Failed to sync resources/ directory"
      return 1
    fi
    log_sync "✅ Synced resources/ directory"
  fi

  ################################################################################
  # Sync static directory (if present)
  ################################################################################

  log_sync "=== SYNCING STATIC ==="

  if [[ -d "${VENDOR_APP}/static" ]]; then
    if [[ -d "${DEV_APP}/static" ]]; then
      rm -rf "${DEV_APP}/static"
      log_sync "Removed existing dev static/"
    fi

    if ! cp -r "${VENDOR_APP}/static" "${DEV_APP}/"; then
      log_error "Failed to sync static/ directory"
      return 1
    fi
    log_sync "✅ Synced static/ directory"
  fi

  ################################################################################
  # Sync package.json
  ################################################################################

  log_sync "=== SYNCING PACKAGE.JSON ==="

  if [[ -f "${VENDOR_APP}/package.json" ]]; then
    if ! cp "${VENDOR_APP}/package.json" "${DEV_APP}/package.json"; then
      log_error "Failed to sync package.json"
      return 1
    fi
    log_sync "✅ Synced package.json"
  else
    log_sync "ℹ️  Vendor package.json not found, skipping"
  fi

  ################################################################################
  # Sync package-lock.json (if present)
  ################################################################################

  if [[ -f "${VENDOR_APP}/package-lock.json" ]]; then
    if ! cp "${VENDOR_APP}/package-lock.json" "${DEV_APP}/package-lock.json"; then
      log_error "Failed to sync package-lock.json"
      return 1
    fi
    log_sync "✅ Synced package-lock.json"
  fi

  ################################################################################
  # Verify parity
  ################################################################################

  log_sync "=== VERIFYING SYNC VIA PARITY GATE ==="

  # Run parity gate to verify sync was successful
  export REPO_ROOT="${repo_root}"
  export APP_ROOT="${VENDOR_APP}"
  export EVIDENCE_ROOT="/tmp/sync_verification_$(date +%s)"
  mkdir -p "${EVIDENCE_ROOT}"

  local SCRIPT_DIR
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  local PARITY_SCRIPT="${SCRIPT_DIR}/parity_gate.sh"

  if [[ ! -f "${PARITY_SCRIPT}" ]]; then
    log_error "parity_gate.sh not found: ${PARITY_SCRIPT}"
    return 2
  fi

  # Source the parity gate and call its function
  # shellcheck source=./parity_gate.sh
  source "${PARITY_SCRIPT}"

  if run_parity_gate "${EVIDENCE_ROOT}" "${REPO_ROOT}" "${APP_ROOT}" "${APP_ROOT}/manifest.yml"; then
    log_sync "✅ PARITY VERIFIED - Apps are now synchronized"
    return 0
  else
    log_error "PARITY STILL FAILED after sync"
    local parity_report="${EVIDENCE_ROOT}/02_parity/parity_report.json"
    if [[ -f "${parity_report}" ]]; then
      log_error "Parity report: ${parity_report}"
    fi
    return 1
  fi
}

# Only execute if run directly (not sourced)
if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  run_sync_dev_from_vendor "${1:-.}" || exit $?
fi
