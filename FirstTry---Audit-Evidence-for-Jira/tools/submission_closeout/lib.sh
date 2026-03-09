#!/bin/bash
# lib.sh - Shared utilities for submission closeout harness
# Source this file; do not execute directly

set -euo pipefail

export LC_ALL=C  # Deterministic locale-free output

# ============================================================================
# LOGGING & OUTPUT
# ============================================================================

log_info() {
  echo "[INFO] $*" >&2
}

log_warn() {
  echo "[WARN] $*" >&2
}

log_error() {
  echo "[ERROR] $*" >&2
}

log_section() {
  echo ""
  echo "================================================================================" >&2
  echo "$*" >&2
  echo "================================================================================" >&2
}

# ============================================================================
# PATHS & SETUP
# ============================================================================

# Ensure we're in the vendor tree root
ensure_vendor_root() {
  local cwd="$(pwd)"
  local script_dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
  
  # vendor root is 3 levels up from tools/submission_closeout
  local vendor_root="$(cd "$script_dir/../.." && pwd)"
  
  # Verify we're in a git repo (parent repo is OK for vendor tree operations)
  if ! git -C "$vendor_root" rev-parse --git-dir &> /dev/null; then
    log_error "Not in a git repository (tried $vendor_root)"
    return 1
  fi
  
  cd "$vendor_root"
  export VENDOR_ROOT="$vendor_root"
  log_info "Vendor root: $VENDOR_ROOT"
}

# ============================================================================
# GIT OPERATIONS
# ============================================================================

git_status_short() {
  cd "$VENDOR_ROOT"
  git status --short 2>/dev/null || echo ""
}

git_diff_stat() {
  cd "$VENDOR_ROOT"
  git diff --stat 2>/dev/null || echo ""
}

git_untracked() {
  cd "$VENDOR_ROOT"
  git ls-files --others --exclude-standard 2>/dev/null || echo ""
}

git_current_head() {
  cd "$VENDOR_ROOT"
  git rev-parse HEAD 2>/dev/null
}

git_origin_main() {
  cd "$VENDOR_ROOT"
  git ls-remote origin refs/heads/main 2>/dev/null | awk '{print $1}' || echo ""
}

git_count_ahead_behind() {
  cd "$VENDOR_ROOT"
  git rev-list --left-right --count origin/main...HEAD 2>/dev/null || echo "0 0"
}

git_log_ahead() {
  cd "$VENDOR_ROOT"
  git log --oneline origin/main..HEAD 2>/dev/null || echo ""
}

# ============================================================================
# HTTP OPERATIONS
# ============================================================================

curl_http_code() {
  local url="$1"
  curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000"
}

curl_get() {
  local url="$1"
  curl -fsSL "$url" 2>/dev/null || echo ""
}

curl_headers() {
  local url="$1"
  curl -sI "$url" 2>/dev/null || echo ""
}

# ============================================================================
# FILE OPERATIONS
# ============================================================================

write_file() {
  local file="$1"
  local content="$2"
  mkdir -p "$(dirname "$file")"
  echo "$content" > "$file"
}

write_file_append() {
  local file="$1"
  local content="$2"
  mkdir -p "$(dirname "$file")"
  echo "$content" >> "$file"
}

file_exists() {
  [ -f "$1" ]
}

dir_exists() {
  [ -d "$1" ]
}

# ============================================================================
# TIMESTAMP
# ============================================================================

utc_stamp() {
  date -u +%Y%m%dT%H%M%SZ
}

# ============================================================================
# VERDICT DECISION LOGIC
# ============================================================================

# Returns 0 if FULL_SUBMISSION_BULLETPROOF_READY, 1 otherwise
apply_verdict_logic() {
  local pages_live="$1"           # PAGES_LIVE_COMPLETE or PAGES_ROOT_ONLY_NOT_DOCS_COMPLETE
  local freeze_pass="$2"          # 0 if PASS, 1 if FAIL
  local gate_pass="$3"            # 0 if PASS, 1 if FAIL
  local playwright_pass="$4"      # 0 if PASS, 1 if FAIL
  local cleanliness_verdict="$5"  # PASS, WARN, or FAIL
  local origin_parity="$6"        # REMOTE_MATCHED or LOCAL_AHEAD_OF_ORIGIN or other
  
  # FULL_SUBMISSION_BULLETPROOF_READY requires:
  # - pages_live == PAGES_LIVE_COMPLETE
  # - freeze_pass == 0 (pass)
  # - gate_pass == 0 (pass)
  # - playwright_pass == 0 (pass)
  # - cleanliness_verdict == PASS || WARN (allowlisted untracked ok)
  # - origin_parity == REMOTE_MATCHED (or local HEAD is same as origin/main)
  
  if [ "$pages_live" != "PAGES_LIVE_COMPLETE" ]; then
    return 1
  fi
  
  if [ "$freeze_pass" != "0" ]; then
    return 1
  fi
  
  if [ "$gate_pass" != "0" ]; then
    return 1
  fi
  
  if [ "$playwright_pass" != "0" ]; then
    return 1
  fi
  
  if [ "$cleanliness_verdict" = "FAIL" ]; then
    return 1
  fi
  
  # Note: origin_parity might be REMOTE_MATCHED or LOCAL_AHEAD, both OK if explicitly noted
  # The key is that we must not diverge or be behind
  if [[ "$origin_parity" == "LOCAL_BEHIND_ORIGIN" || "$origin_parity" == "DIVERGED" ]]; then
    return 1
  fi
  
  return 0
}

# ============================================================================
# EXPORT
# ============================================================================

export -f log_info log_warn log_error log_section
export -f ensure_vendor_root
export -f git_status_short git_diff_stat git_untracked git_current_head git_origin_main
export -f git_count_ahead_behind git_log_ahead
export -f curl_http_code curl_get curl_headers
export -f write_file write_file_append file_exists dir_exists
export -f utc_stamp
export -f apply_verdict_logic
