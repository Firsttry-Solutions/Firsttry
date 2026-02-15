#!/bin/bash

##############################################################################
# PHASE 3 v3.2 - Proof Library (Common Functions)
# Shared utilities for all proof/verification scripts
#
# Fail-closed: all errors exit with status 1
##############################################################################

set -euo pipefail

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

##############################################################################
# Logger Functions
##############################################################################

die() {
  local msg="$1"
  echo -e "${RED}[ERROR]${NC} $msg" >&2
  exit 1
}

warn() {
  local msg="$1"
  echo -e "${YELLOW}[WARN]${NC} $msg" >&2
}

log_info() {
  local msg="$1"
  echo -e "${BLUE}[INFO]${NC} $msg"
}

log_pass() {
  local msg="$1"
  echo -e "${GREEN}[PASS]${NC} $msg"
}

log_fail() {
  local msg="$1"
  echo -e "${RED}[FAIL]${NC} $msg" >&2
}

log_marker() {
  local marker="$1"
  echo "[${marker}]"
}

##############################################################################
# Command Validation
##############################################################################

need_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" &> /dev/null; then
    die "Required command not found: $cmd"
  fi
}

##############################################################################
# Directory Management
##############################################################################

mk_evidence_dir() {
  local prefix="$1"
  local utc_stamp=$(date -u +%Y%m%dT%H%M%SZ)
  local dir="/tmp/${prefix}_${utc_stamp}"
  mkdir -p "$dir"
  echo "$dir"
}

##############################################################################
# Git Validation
##############################################################################

require_clean_git() {
  local repo_root="$1"
  local status=$(cd "$repo_root" 2>/dev/null && git status --porcelain 2>/dev/null || echo "dirty")
  
  if [[ "$status" != "" ]]; then
    die "Git repo not clean. Commit or stash changes first."
  fi
}

##############################################################################
# Tee Helper
##############################################################################

tee_to() {
  local file="$1"
  tee "$file"
}

##############################################################################
# Markers
##############################################################################

# All valid markers for v3.2 proof
VALID_MARKERS=(
  "FT_PROOF_DOCS_CLAIMS_OK"
  "FT_PROOF_DOCS_NO_EMAIL_OK"
  "FT_PROOF_DOCS_SUBPROCESSOR_OK"
  "FT_PROOF_NO_EGRESS_OK"
  "FT_PROOF_SCOPE_ALLOWLIST_OK"
  "FT_PROOF_PW_START"
  "FT_PROOF_PW_PASS"
  "FT_PROOF_PROD_LOGS_MARKERS_OK"
  "FT_PROOF_PHASE32_AUDIT_FIX_PASS"
)

##############################################################################
# Assert Marker Presence
##############################################################################

assert_marker_in_output() {
  local marker="$1"
  local file="$2"
  
  if ! grep -q "\[$marker\]" "$file" 2>/dev/null; then
    die "Expected marker [$marker] not found in $file"
  fi
  
  log_pass "Marker [$marker] confirmed in $file"
}

##############################################################################
# Export for sourcing
##############################################################################

export die warn log_info log_pass log_fail log_marker
export need_cmd mk_evidence_dir require_clean_git tee_to
export assert_marker_in_output
