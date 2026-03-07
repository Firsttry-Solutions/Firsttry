#!/usr/bin/env bash
# Common utilities for reviewer demo harness

# Enforce deterministic environment
export TZ=UTC
export LC_ALL=C
export LANG=C
umask 022

# Colors for output (if terminal supports it)
if [[ -t 1 ]]; then
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  YELLOW='\033[1;33m'
  BLUE='\033[0;34m'
  NC='\033[0m' # No Color
else
  RED=''
  GREEN=''
  YELLOW=''
  BLUE=''
  NC=''
fi

# Logging functions
log_info() {
  echo -e "${BLUE}[INFO]${NC} $*" >&2
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $*" >&2
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $*" >&2
}

log_success() {
  echo -e "${GREEN}[SUCCESS]${NC} $*" >&2
}

# Fail-closed error handling
fail() {
  local msg="$1"
  local exit_code="${2:-1}"
  log_error "$msg"
  return "$exit_code"
}

# Check if command exists
require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    fail "Required command not found: $cmd"
  fi
}

# Create deterministic timestamp
create_timestamp() {
  date -u +"%Y%m%dT%H%M%SZ"
}

# Create secure temp file
create_temp() {
  local prefix="$1"
  mktemp "/tmp/${prefix}.XXXXXX"
}

# Validate JSON structure
validate_json() {
  local file="$1"
  if ! node -e "JSON.parse(require('fs').readFileSync('$file', 'utf8'))" 2>/dev/null; then
    fail "Invalid JSON in $file"
  fi
}

# Write JSON with validation
write_json() {
  local file="$1"
  local content="$2"
  echo "$content" | node -e "
    const data = JSON.parse(require('fs').readFileSync(0, 'utf8'));
    require('fs').writeFileSync('$file', JSON.stringify(data, null, 2));
  "
  validate_json "$file"
}

# Extract domain from URL
extract_domain() {
  local url="$1"
  echo "$url" | sed -E 's#^https?://([^/]+).*$#\1#' | tr '[:upper:]' '[:lower:]'
}

# Require file exists with fail-closed behavior
require_file() {
  local file="$1"
  if [[ ! -f "$file" ]]; then
    fail "Required file not found: $file"
  fi
}

# ====================================================================
# APP ROOT RESOLUTION - DEFAULT TO CANONICAL VENDOR APP
# ====================================================================

resolve_repo_root() {
  # Try git first (most reliable)
  if command -v git >/dev/null 2>&1; then
    local repo_root
    repo_root=$(git rev-parse --show-toplevel 2>/dev/null || echo "")
    if [[ -n "$repo_root" && -d "$repo_root" ]]; then
      echo "$repo_root"
      return 0
    fi
  fi

  # Fallback: walk up filesystem from script location
  local current_dir
  current_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

  while [[ "$current_dir" != "/" ]]; do
    if [[ -d "$current_dir/tools/reviewer_demo" ]]; then
      echo "$current_dir"
      return 0
    fi
    current_dir="$(dirname "$current_dir")"
  done

  fail "Could not determine REPO_ROOT"
}

# Resolve Forge app root with ambiguity detection
resolve_app_root() {
  if [[ -n "${REPO_ROOT:-}" ]]; then
    return 0  # Already resolved
  fi

  # Find the script that called this function
  local calling_script
  if [[ -n "${BASH_SOURCE[1]:-}" ]]; then
    calling_script="${BASH_SOURCE[1]}"
  else
    calling_script="${BASH_SOURCE[0]}"
  fi

  local script_dir
  script_dir="$(cd "$(dirname "$calling_script")" && pwd)"

  # Navigate up to find repository root (contains tools/reviewer_demo)
  local current_dir="$script_dir"
  while [[ "$current_dir" != "/" && "$current_dir" != "" ]]; do
    if [[ -d "$current_dir/tools/reviewer_demo" ]]; then
      export REPO_ROOT="$current_dir"
      return 0
    fi
    current_dir="$(dirname "$current_dir")"
  done

  fail "Could not resolve repository root from script location: $calling_script"
}

# Resolve Forge app root with ambiguity detection
resolve_app_root() {
  if [[ -n "${APP_ROOT:-}" ]]; then
    return 0  # Already resolved
  fi

  # Resolve and capture repo root
  if [[ -z "${REPO_ROOT:-}" ]]; then
    REPO_ROOT=$(resolve_repo_root)
    export REPO_ROOT
  fi

  # Default app root: canonical source (atlassian/forge-app)
  # Can be overridden by FT_APP_ROOT env var
  local ft_app_root="${FT_APP_ROOT:-atlassian/forge-app}"

  # Check for ambiguity only if FT_APP_ROOT was not explicitly set
  if [[ -z "${FT_APP_ROOT:-}" ]]; then
    # Verify canonical location has a manifest
    if [[ ! -f "$REPO_ROOT/atlassian/forge-app/manifest.yml" ]]; then
      log_error "No Forge manifest detected at canonical location:"
      log_error "  Expected: $REPO_ROOT/atlassian/forge-app/manifest.yml"
      log_error "  Canonical source: atlassian/forge-app"
      fail "Forge manifest.yml not found in canonical location"
    fi
  fi

  export APP_ROOT="$REPO_ROOT/$ft_app_root"
  export MANIFEST_PATH="$APP_ROOT/manifest.yml"

  # Hard check: ensure manifest exists at resolved path
  if [[ ! -f "$MANIFEST_PATH" ]]; then
    log_error "Manifest not found at expected path: $MANIFEST_PATH"
    log_error "App root resolved to: $APP_ROOT"
    log_error ""
    log_error "Available manifests found in repository:"

    local found_manifests
    found_manifests=$(find "$REPO_ROOT" -name "manifest.yml" -maxdepth 6 2>/dev/null || true)

    if [[ -n "$found_manifests" ]]; then
      while IFS= read -r manifest; do
        log_error "  - $manifest"
      done <<< "$found_manifests"
      log_error ""
      log_error "  FT_APP_ROOT=atlassian/forge-app  (canonical default)"
      log_error "  FT_APP_ROOT=<custom-path>        (override)"
    else
      log_error "  (none found)"
    fi

    fail "Forge manifest.yml not found at resolved path"
  fi

  log_info "Resolved app root: $APP_ROOT"
  log_info "Manifest path: $MANIFEST_PATH"

}

# Initialize app root resolution (call this once at the start)
init_app_root() {
  resolve_app_root
}

# Normalize domain name
normalize_domain() {
  local url="$1"
  echo "$url" | sed -E 's#^https?://([^/]+).*$#\1#' | tr '[:upper:]' '[:lower:]'
}

# Check if file contains secrets/PII
contains_secrets() {
  local file="$1"
  if rg -i "authorization:|bearer|token|cookie|accountid|[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}|[A-Z]+-[0-9]+" "$file" >/dev/null 2>&1; then
    return 0
  fi
  return 1
}

# Extract version from command
get_version() {
  local cmd="$1"
  case "$cmd" in
    node) node --version | sed 's/^v//' ;;
    npm) npm --version ;;
    forge) forge --version | head -n1 | awk '{print $NF}' ;;
    git) git --version | awk '{print $NF}' ;;
    bash) bash --version | head -n1 | awk '{print $4}' | cut -d'(' -f1 ;;
    *) echo "unknown" ;;
  esac
}

# Get OS info
get_os_info() {
  if [[ -f /etc/os-release ]]; then
    grep '^PRETTY_NAME=' /etc/os-release | cut -d'"' -f2
  else
    uname -s
  fi
}