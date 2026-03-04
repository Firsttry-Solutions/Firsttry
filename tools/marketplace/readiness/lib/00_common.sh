#!/bin/bash
# Common library for marketplace readiness audit
# Provides helper functions and global variables

set -euo pipefail

# Global variables (set by runner)
: "${EVIDENCE_DIR:?EVIDENCE_DIR must be set}"
: "${REPORT_PATH:?REPORT_PATH must be set}"
: "${VERDICT_PATH:?VERDICT_PATH must be set}"
: "${REPO_ROOT:?REPO_ROOT must be set}"

# FULL run mode support
FAIL_COUNT=0
FAIL_LIST_FILE="${EVIDENCE_DIR}/FAILURES.txt"

# Phase context - must be set by each phase script
: "${PHASE_ID:=}"

# Check phase context is set
phase_ctx_require() {
  if [ -z "${PHASE_ID}" ]; then
    echo -e "${RED}[FATAL]${NC} PHASE_ID must be set by phase script" >&2
    exit 1
  fi
}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Record failure in FULL run mode
record_fail() {
  local phase="$1"
  local message="$2"
  local evidence_path="${3:-}"
  
  echo "PHASE=${phase} :: ${message} :: EVIDENCE=${evidence_path}" >> "$FAIL_LIST_FILE"
  FAIL_COUNT=$((FAIL_COUNT + 1))
  echo -e "${RED}[FAIL]${NC} Phase ${phase}: ${message}" >&2
}

# Phase fail - respects FULL run mode
phase_fail() {
  phase_ctx_require
  
  local message="$1"
  local evidence_path="${2:-}"
  
  if [ "${FULL:-0}" = "1" ]; then
    # FULL run mode: record and continue
    record_fail "$PHASE_ID" "$message" "$evidence_path"
    return 0
  else
    # Default: fail immediately
    record_fail "$PHASE_ID" "$message" "$evidence_path"
    echo -e "${RED}[FATAL]${NC} Phase ${PHASE_ID}: ${message}" >&2
    echo "FAIL" > "$VERDICT_PATH"
    echo "" >> "$REPORT_PATH"
    echo "## FAILURE" >> "$REPORT_PATH"
    echo "" >> "$REPORT_PATH"
    echo "**Phase Failed:** ${PHASE_ID}" >> "$REPORT_PATH"
    echo "**Reason:** $message" >> "$REPORT_PATH"
    if [ -n "$evidence_path" ]; then
      echo "**Evidence:** \`$evidence_path\`" >> "$REPORT_PATH"
    fi
    echo "" >> "$REPORT_PATH"
    echo "**Verdict:** FAIL" >> "$REPORT_PATH"
    exit 1
  fi
}

# Die with error message and fail the audit (legacy wrapper)
die() {
  local msg="$1"
  phase_fail "$msg" ""
}

# Success message
ok() {
  local msg="$1"
  echo -e "${GREEN}[OK]${NC} $msg"
}

# Info message
info() {
  local msg="$1"
  echo -e "${BLUE}[INFO]${NC} $msg"
}

# Warning message (for reporting only; must still fail if policy requires)
warn() {
  local msg="$1"
  echo -e "${YELLOW}[WARN]${NC} $msg"
}

# Require file exists with minimum size
require_file() {
  local path="$1"
  local min_bytes="${2:-1}"
  
  if [ ! -f "$path" ]; then
    die "Required file missing: $path"
  fi
  
  local size
  size=$(stat -c%s "$path" 2>/dev/null || stat -f%z "$path" 2>/dev/null || echo "0")
  
  if [ "$size" -lt "$min_bytes" ]; then
    die "Required file too small: $path (expected >=$min_bytes bytes, got $size bytes)"
  fi
  
  ok "File exists and meets size requirement: $path ($size bytes)"
}

# Require directory exists
require_dir() {
  local path="$1"
  
  if [ ! -d "$path" ]; then
    die "Required directory missing: $path"
  fi
  
  ok "Directory exists: $path"
}

# Calculate SHA256 of file
sha256_file() {
  local path="$1"
  
  if [ ! -f "$path" ]; then
    echo "FILE_NOT_FOUND"
    return 1
  fi
  
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$path" | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$path" | awk '{print $1}'
  else
    echo "SHA256_UNAVAILABLE"
    return 1
  fi
}

# Redact secrets from text for report
redact_secrets() {
  local text="$1"
  
  echo "$text" | \
    sed -E 's/(Authorization:[[:space:]]*)[^[:space:]]+/\1[REDACTED]/gi' | \
    sed -E 's/(Bearer[[:space:]]+)[^[:space:]]+/\1[REDACTED]/gi' | \
    sed -E 's/(apiToken[[:space:]]*[:=][[:space:]]*)[^[:space:]]+/\1[REDACTED]/gi' | \
    sed -E 's/(password[[:space:]]*[:=][[:space:]]*)[^[:space:]]+/\1[REDACTED]/gi' | \
    sed -E 's/(secret[[:space:]]*[:=][[:space:]]*)[^[:space:]]+/\1[REDACTED]/gi' | \
    sed -E 's/(token[[:space:]]*[:=][[:space:]]*)[^[:space:]]+/\1[REDACTED]/gi'
}

# Write section header to report
write_section() {
  local report="$1"
  local title="$2"
  
  echo "" >> "$report"
  echo "## $title" >> "$report"
  echo "" >> "$report"
}

# Check if command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Count lines matching pattern in file
count_matches() {
  local pattern="$1"
  local file="$2"
  
  if [ ! -f "$file" ]; then
    echo "0"
    return
  fi
  
  grep -c "$pattern" "$file" 2>/dev/null || echo "0"
}
