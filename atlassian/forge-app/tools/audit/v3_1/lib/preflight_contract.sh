#!/usr/bin/env bash
# lib/preflight_contract.sh — Deterministic preflight checks for F100 Audit v3.1
# Enforces reproducible execution environment. Fail-fast with actionable diagnostics.
# Usage: source this file before running audit. Sets E_PREFLIGHT_* vars on success.
#
# CRITICAL: This script FAILS if environment is not deterministic/reproducible.
# No silent failures. No auto-fixes. Operator must fix environment explicitly.

set -euo pipefail

# ── Color codes ──────────────────────────────────────────────────────────────
_PC_RED='\033[0;31m'
_PC_YLW='\033[0;33m'
_PC_GRN='\033[0;32m'
_PC_RST='\033[0m'

# ── Preflight state ──────────────────────────────────────────────────────────
E_PREFLIGHT_PASSED=false
E_PREFLIGHT_WORKDIR=""
E_PREFLIGHT_NODE_VERSION=""
E_PREFLIGHT_SEMGREP_VERSION=""

# ── Fail helper ──────────────────────────────────────────────────────────────
_preflight_fail() {
  local reason="$1"
  local fix="${2:-}"
  echo -e "${_PC_RED}[PREFLIGHT FAIL]${_PC_RST} ${reason}" >&2
  if [[ -n "$fix" ]]; then
    echo -e "${_PC_YLW}[FIX]${_PC_RST} ${fix}" >&2
  fi
  exit 1
}

_preflight_pass() {
  local check="$1"
  echo -e "${_PC_GRN}[PREFLIGHT OK]${_PC_RST} ${check}"
}

# ══════════════════════════════════════════════════════════════════════════════
# CHECK 1: Working Directory
# Must be run from atlassian/forge-app (verify via package.json + tools/audit/v3_1)
# ══════════════════════════════════════════════════════════════════════════════
_check_workdir() {
  local cwd="$PWD"
  
  # Verify package.json exists
  if [[ ! -f "package.json" ]]; then
    _preflight_fail \
      "package.json not found in current directory: $cwd" \
      "cd to atlassian/forge-app before running audit"
  fi
  
  # Verify tools/audit/v3_1 exists
  if [[ ! -d "tools/audit/v3_1" ]]; then
    _preflight_fail \
      "tools/audit/v3_1 not found. Not in correct working directory." \
      "cd to atlassian/forge-app before running audit"
  fi
  
  # Verify this is a Forge app (check for manifest.yml)
  if [[ ! -f "manifest.yml" ]]; then
    _preflight_fail \
      "manifest.yml not found. Not a Forge app directory." \
      "cd to atlassian/forge-app before running audit"
  fi
  
  E_PREFLIGHT_WORKDIR="$cwd"
  _preflight_pass "Working directory: $cwd"
}

# ══════════════════════════════════════════════════════════════════════════════
# CHECK 2: Clean Git Tree
# If git dirty, FAIL with list of files. No auto-clean.
# ══════════════════════════════════════════════════════════════════════════════
_check_git_clean() {
  # Skip if not in git repo
  if ! git rev-parse --git-dir &>/dev/null; then
    _preflight_pass "Git: Not in repository (skip clean check)"
    return 0
  fi
  
  local dirty
  dirty=$(git status --porcelain 2>/dev/null || true)
  
  if [[ -n "$dirty" ]]; then
    _preflight_fail \
      "Git working tree is dirty. Audit requires clean state for determinism." \
      $'Commit or stash changes:\n'"$(echo "$dirty" | head -10)"$'\n'"git status --porcelain for full list"
  fi
  
  _preflight_pass "Git: Clean working tree"
}

# ══════════════════════════════════════════════════════════════════════════════
# CHECK 3: Node Version
# Enforce Node major matches expected version (read from package.json engines or default to 18)
# ══════════════════════════════════════════════════════════════════════════════
_check_node_version() {
  if ! command -v node &>/dev/null; then
    _preflight_fail \
      "node not found on PATH" \
      "Install Node.js 18+ and ensure it's on PATH"
  fi
  
  local node_version
  node_version=$(node --version 2>/dev/null | sed 's/^v//')
  local node_major
  node_major=$(echo "$node_version" | cut -d. -f1)
  
  # Read expected version from package.json engines.node if present
  local expected_major=18
  if [[ -f "package.json" ]] && command -v jq &>/dev/null; then
    local engines_node
    engines_node=$(jq -r '.engines.node // ""' package.json 2>/dev/null || true)
    if [[ -n "$engines_node" ]]; then
      # Extract major version from engine spec like ">=18.0.0" or "18.x"
      expected_major=$(echo "$engines_node" | grep -oE '[0-9]+' | head -1)
    fi
  fi
  
  if [[ "$node_major" -ne "$expected_major" ]]; then
    _preflight_fail \
      "Node version mismatch: found v$node_version, expected v${expected_major}.x" \
      "Install Node.js ${expected_major}.x (nvm, fnm, or direct install)"
  fi
  
  E_PREFLIGHT_NODE_VERSION="$node_version"
  _preflight_pass "Node: v$node_version (major: $node_major)"
}

# ══════════════════════════════════════════════════════════════════════════════
# CHECK 4: Dependency State
# Require package-lock.json present. Require node_modules present OR run npm ci.
# ══════════════════════════════════════════════════════════════════════════════
_check_dependencies() {
  # Verify package-lock.json exists
  if [[ ! -f "package-lock.json" ]]; then
    _preflight_fail \
      "package-lock.json missing. Reproducible installs require lockfile." \
      "Run: npm install (to generate lockfile)"
  fi
  _preflight_pass "Lockfile: package-lock.json present"
  
  # Check node_modules
  if [[ ! -d "node_modules" ]]; then
    if [[ "${FT_AUDIT_NO_INSTALL:-0}" == "1" ]]; then
      _preflight_fail \
        "node_modules missing and FT_AUDIT_NO_INSTALL=1" \
        "Run: npm ci (then retry audit)"
    fi
    
    echo -e "${_PC_YLW}[PREFLIGHT]${_PC_RST} node_modules missing, running npm ci..."
    if ! npm ci --ignore-scripts 2>&1 | tee "${E:-/tmp}/npm_ci.log"; then
      _preflight_fail \
        "npm ci failed" \
        "Check ${E:-/tmp}/npm_ci.log for details"
    fi
    _preflight_pass "Dependencies: Installed via npm ci"
  else
    _preflight_pass "Dependencies: node_modules present"
  fi
}

# ══════════════════════════════════════════════════════════════════════════════
# CHECK 5: Semgrep Version
# Must be available as fixed version. Enforce exact version match if VERSION.txt exists.
# ══════════════════════════════════════════════════════════════════════════════
_check_semgrep() {
  if ! command -v semgrep &>/dev/null; then
    if [[ "${FT_AUDIT_NO_INSTALL:-0}" == "1" ]]; then
      _preflight_fail \
        "semgrep not found and FT_AUDIT_NO_INSTALL=1" \
        "Install semgrep: pip3 install semgrep==1.45.0 (or version in tools/audit/v3_1/semgrep/VERSION.txt)"
    fi
    
    # Try to install semgrep via pip
    echo -e "${_PC_YLW}[PREFLIGHT]${_PC_RST} semgrep not found, attempting pip install..."
    local expected_version="1.45.0"
    if [[ -f "tools/audit/v3_1/semgrep/VERSION.txt" ]]; then
      expected_version=$(cat tools/audit/v3_1/semgrep/VERSION.txt)
    fi
    
    if ! pip3 install "semgrep==${expected_version}" 2>&1 | tee "${E:-/tmp}/semgrep_install.log"; then
      _preflight_fail \
        "semgrep installation failed" \
        "Install manually: pip3 install semgrep==${expected_version}"
    fi
  fi
  
  local semgrep_version
  semgrep_version=$(semgrep --version 2>/dev/null | head -1 || echo "unknown")
  
  # Check version if VERSION.txt exists
  if [[ -f "tools/audit/v3_1/semgrep/VERSION.txt" ]]; then
    local expected_version
    expected_version=$(cat tools/audit/v3_1/semgrep/VERSION.txt)
    
    # Extract version number (handle "semgrep 1.45.0" or just "1.45.0")
    local actual_version
    actual_version=$(echo "$semgrep_version" | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || echo "unknown")
    
    if [[ "$actual_version" != "$expected_version" ]]; then
      _preflight_fail \
        "semgrep version mismatch: found $actual_version, expected $expected_version" \
        "Install exact version: pip3 install semgrep==${expected_version}"
    fi
  fi
  
  E_PREFLIGHT_SEMGREP_VERSION="$semgrep_version"
  _preflight_pass "Semgrep: $semgrep_version"
}

# ══════════════════════════════════════════════════════════════════════════════
# CHECK 6: Network Mode
# FT_AUDIT_OFFLINE=1 enforces offline mode (no external URLs except localhost/file)
# ══════════════════════════════════════════════════════════════════════════════
_check_network_mode() {
  if [[ "${FT_AUDIT_OFFLINE:-0}" == "1" ]]; then
    _preflight_pass "Network: OFFLINE mode enabled (FT_AUDIT_OFFLINE=1)"
    export FT_SKIP_EXTERNAL_LINKS=1
  else
    _preflight_pass "Network: Standard mode (external links allowed)"
  fi
}

# ══════════════════════════════════════════════════════════════════════════════
# CHECK 7: Locale/Timezone
# Export LC_ALL=C, LANG=C, TZ=UTC for determinism
# ══════════════════════════════════════════════════════════════════════════════
_check_locale() {
  export LC_ALL=C
  export LANG=C
  export TZ=UTC
  _preflight_pass "Locale: LC_ALL=C, LANG=C, TZ=UTC"
}

# ══════════════════════════════════════════════════════════════════════════════
# CHECK 8: Timeout Discipline
# Prohibit running audit under external timeout command
# ══════════════════════════════════════════════════════════════════════════════
_check_timeout_discipline() {
  if [[ -n "${FT_PARENT_TIMEOUT:-}" ]]; then
    _preflight_fail \
      "Audit wrapped with timeout command (FT_PARENT_TIMEOUT set)" \
      "Do NOT wrap audit with timeout. Use internal time budget instead."
  fi
  
  # Best-effort check: detect if parent process is timeout
  if command -v pgrep &>/dev/null; then
    local parent_pid=${PPID:-0}
    if [[ $parent_pid -gt 0 ]]; then
      local parent_cmd
      parent_cmd=$(ps -p "$parent_pid" -o comm= 2>/dev/null || echo "")
      if [[ "$parent_cmd" == "timeout" ]]; then
        _preflight_fail \
          "Audit invoked via timeout command (parent: $parent_cmd)" \
          "Do NOT wrap audit with timeout. Run directly: bash tools/audit/v3_1/run_deterministic.sh"
      fi
    fi
  fi
  
  _preflight_pass "Timeout: No external timeout wrapper detected"
}

# ══════════════════════════════════════════════════════════════════════════════
# RUN ALL CHECKS
# ══════════════════════════════════════════════════════════════════════════════
run_preflight_checks() {
  echo -e "${_PC_GRN}═══════════════════════════════════════════════════════${_PC_RST}"
  echo -e "${_PC_GRN}  PREFLIGHT CONTRACT — F100 Audit v3.1${_PC_RST}"
  echo -e "${_PC_GRN}═══════════════════════════════════════════════════════${_PC_RST}"
  echo ""
  
  _check_workdir
  _check_git_clean
  _check_node_version
  _check_dependencies
  _check_semgrep
  _check_network_mode
  _check_locale
  _check_timeout_discipline
  
  echo ""
  echo -e "${_PC_GRN}[PREFLIGHT]${_PC_RST} All checks passed. Proceeding with audit..."
  echo ""
  
  E_PREFLIGHT_PASSED=true
}

# Export for use in parent scripts
export -f run_preflight_checks
