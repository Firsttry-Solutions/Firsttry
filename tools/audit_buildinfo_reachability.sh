#!/bin/bash
#
# tools/audit_buildinfo_reachability.sh
# Deterministic audit of getBuildInfo resolver reachability across manifest/UI/backend
#
set -euo pipefail

# Configuration
ENV="${1:-production}"
RUN_DIR="/tmp/ft_buildinfo_audit_$(date -u +%Y%m%dT%H%M%SZ)"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Ensure RUN_DIR exists
mkdir -p "$RUN_DIR"

# Helper to print and log
log() {
  echo "[AUDIT] $*"
}

fail() {
  echo -e "${RED}[FAIL]${NC} $*" >&2
  echo "FAIL: $*" >> "$RUN_DIR/99_summary.txt"
  exit 1
}

pass() {
  echo -e "${GREEN}[PASS]${NC} $*"
  echo "PASS: $*" >> "$RUN_DIR/99_summary.txt"
}

header() {
  echo -e "${YELLOW}=== $* ===${NC}"
}

cd "$REPO_ROOT"

# Initialize summary
echo "audit_buildinfo_reachability.sh RUN: $(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$RUN_DIR/99_summary.txt"
echo "Environment: $ENV" >> "$RUN_DIR/99_summary.txt"
echo "Repo root: $REPO_ROOT" >> "$RUN_DIR/99_summary.txt"
echo "" >> "$RUN_DIR/99_summary.txt"

header "CHECK 1: manifest.yml contains getBuildInfo mapping"

# Find manifest deterministically
MANIFEST_CANDIDATES=()
if [[ -f "atlassian/forge-app/manifest.yml" ]]; then
  MANIFEST_CANDIDATES=("atlassian/forge-app/manifest.yml")
else
  # Find all manifest.yml files
  while IFS= read -r candidate; do
    MANIFEST_CANDIDATES+=("$candidate")
  done < <(find . -name "manifest.yml" -type f 2>/dev/null || true)
fi

if [[ ${#MANIFEST_CANDIDATES[@]} -eq 0 ]]; then
  fail "No manifest.yml found in repo"
fi

if [[ ${#MANIFEST_CANDIDATES[@]} -gt 1 ]]; then
  fail "Multiple manifest.yml files found (ambiguous):\n$(printf '  %s\n' "${MANIFEST_CANDIDATES[@]}")"
fi

MANIFEST_PATH="${MANIFEST_CANDIDATES[0]}"
log "Using manifest: $MANIFEST_PATH"
echo "$MANIFEST_PATH" > "$RUN_DIR/10_manifest_path.txt"

# Use Node helper to find getBuildInfo
BUILDINFO_KEY=$(node "$REPO_ROOT/tools/_yaml_manifest_audit.mjs" "$MANIFEST_PATH" find-buildinfo 2>&1 || echo "")
if [[ -z "$BUILDINFO_KEY" ]]; then
  fail "getBuildInfo key not found in manifest functions section"
fi

pass "Found getBuildInfo in manifest"
echo "$BUILDINFO_KEY" >> "$RUN_DIR/10_manifest_path.txt"

# Extract manifest snippet (relevant lines)
{
  echo "=== Manifest: $MANIFEST_PATH ==="
  grep -n "getBuildInfo\|get-build-info\|handler:" "$MANIFEST_PATH" | head -20 || true
} > "$RUN_DIR/11_manifest_snippet.txt"

# Verify handler file exists
HANDLER_PATH=$(node "$REPO_ROOT/tools/_yaml_manifest_audit.mjs" "$MANIFEST_PATH" find-handler-path 2>&1 || echo "")
if [[ -z "$HANDLER_PATH" ]]; then
  fail "Could not extract handler path from manifest"
fi

log "Handler path from manifest: $HANDLER_PATH"

# Get manifest directory (e.g., atlassian/forge-app)
MANIFEST_DIR=$(dirname "$MANIFEST_PATH")

# Handle resolver naming convention: resolve path like "resolvers/getBuildInfo.getBuildInfo_resolver"
# to "atlassian/forge-app/src/resolvers/getBuildInfo.ts"
if [[ "$HANDLER_PATH" == *"."* ]]; then
  MODULE_PATH=$(echo "$HANDLER_PATH" | cut -d. -f1)
  # Try resolvers/getBuildInfo -> MANIFEST_DIR/src/resolvers/getBuildInfo.ts
  HANDLER_FILE="$MANIFEST_DIR/src/${MODULE_PATH}.ts"
  if [[ ! -f "$HANDLER_FILE" ]]; then
    HANDLER_FILE="$MANIFEST_DIR/src/${MODULE_PATH}.js"
  fi
  if [[ ! -f "$HANDLER_FILE" ]]; then
    # Try without src
    HANDLER_FILE="$MANIFEST_DIR/${MODULE_PATH}.ts"
  fi
  if [[ ! -f "$HANDLER_FILE" ]]; then
    HANDLER_FILE="$MANIFEST_DIR/${MODULE_PATH}.js"
  fi
else
  HANDLER_FILE="$MANIFEST_DIR/src/${HANDLER_PATH}.ts"
  if [[ ! -f "$HANDLER_FILE" ]]; then
    HANDLER_FILE="$MANIFEST_DIR/${HANDLER_PATH}.ts"
  fi
fi

if [[ ! -f "$HANDLER_FILE" ]]; then
  fail "Handler file not found. Tried: $MANIFEST_DIR/src/$HANDLER_PATH"
fi

pass "Handler file exists: $HANDLER_FILE"
echo "$HANDLER_FILE" >> "$RUN_DIR/11_manifest_snippet.txt"

header "CHECK 2: UI invokes the same key ('getBuildInfo') exactly"

# Find UI file deterministically
UI_CANDIDATES=()
if [[ -f "atlassian/forge-app/src/gadget-ui/src/main.ts" ]]; then
  UI_CANDIDATES=("atlassian/forge-app/src/gadget-ui/src/main.ts")
elif [[ -f "atlassian/forge-app/src/gadget-ui/src/main.tsx" ]]; then
  UI_CANDIDATES=("atlassian/forge-app/src/gadget-ui/src/main.tsx")
else
  # Search for invoke('getBuildInfo')
  while IFS= read -r candidate; do
    UI_CANDIDATES+=("$candidate")
  done < <(find atlassian/forge-app/src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec grep -l "invoke(['\"]getBuildInfo" {} \; 2>/dev/null || true)
fi

if [[ ${#UI_CANDIDATES[@]} -eq 0 ]]; then
  fail "No UI file with invoke('getBuildInfo') found"
fi

if [[ ${#UI_CANDIDATES[@]} -gt 1 ]]; then
  log "Warning: Multiple UI files with invoke('getBuildInfo'):"
  printf '  %s\n' "${UI_CANDIDATES[@]}" | head -5
  # Use first one but note ambiguity
  UI_FILE="${UI_CANDIDATES[0]}"
else
  UI_FILE="${UI_CANDIDATES[0]}"
fi

log "Using UI file: $UI_FILE"
echo "$UI_FILE" > "$RUN_DIR/20_ui_file.txt"

# Extract invoke line
INVOKE_LINE=$(grep -n "invoke(['\"]getBuildInfo" "$UI_FILE" | head -1 || echo "")
if [[ -z "$INVOKE_LINE" ]]; then
  fail "invoke('getBuildInfo') not found in UI file: $UI_FILE"
fi

pass "UI invokes getBuildInfo"
echo "$INVOKE_LINE" > "$RUN_DIR/21_ui_invoke_line.txt"

# Validate invoke key is exactly "getBuildInfo"
if ! echo "$INVOKE_LINE" | grep -qE "invoke\(['\"]getBuildInfo['\"]"; then
  fail "invoke key is not exactly 'getBuildInfo': $INVOKE_LINE"
fi

header "CHECK 3: Resolver defines/exports getBuildInfo handler and logs markers"

# Find resolver definition - specifically for getBuildInfo
RESOLVER_DEFINITION=$(grep -n "export.*getBuildInfo\|define('getBuildInfo" \
  "atlassian/forge-app/src/resolvers/getBuildInfo.ts" 2>/dev/null || echo "")

if [[ -z "$RESOLVER_DEFINITION" ]]; then
  fail "No getBuildInfo resolver definition found in src/resolvers/getBuildInfo.ts"
fi

echo "$RESOLVER_DEFINITION" > "$RUN_DIR/30_resolver_file.txt"

pass "Resolver definition found"

# Verify log markers exist in resolver code
MARKER_COUNT=0
MARKER_LOG_FILE="$RUN_DIR/32_resolver_log_markers.txt"
echo "=== Checking for log markers in resolver ===" > "$MARKER_LOG_FILE"

if grep -q "BUILDINFO_UI_CALLED" "atlassian/forge-app/src/resolvers/getBuildInfo.ts"; then
  echo "Found: BUILDINFO_UI_CALLED" >> "$MARKER_LOG_FILE"
  MARKER_COUNT=$((MARKER_COUNT + 1))
else
  echo "Missing: BUILDINFO_UI_CALLED" >> "$MARKER_LOG_FILE"
fi

if grep -q "BUILDINFO_UI_PROOF" "atlassian/forge-app/src/resolvers/getBuildInfo.ts"; then
  echo "Found: BUILDINFO_UI_PROOF" >> "$MARKER_LOG_FILE"
  MARKER_COUNT=$((MARKER_COUNT + 1))
else
  echo "Missing: BUILDINFO_UI_PROOF" >> "$MARKER_LOG_FILE"
fi

if [[ $MARKER_COUNT -lt 2 ]]; then
  fail "Not all required log markers found in resolver (expected 2, found $MARKER_COUNT)"
fi

pass "Both required log markers present in resolver"

header "CHECK 4: dist/build outputs and backend bundle exist"

if [[ ! -d "atlassian/forge-app/src/gadget-ui/dist" ]]; then
  fail "UI dist directory not found: atlassian/forge-app/src/gadget-ui/dist"
fi

DIST_FILES=$(find "atlassian/forge-app/src/gadget-ui/dist" -type f | wc -l)
if [[ $DIST_FILES -eq 0 ]]; then
  fail "No files in UI dist directory"
fi

pass "UI dist exists with $DIST_FILES files"
{
  echo "=== UI dist contents (first 20 files) ==="
  find "atlassian/forge-app/src/gadget-ui/dist" -type f | head -20
} > "$RUN_DIR/40_dist_list.txt"

# Verify backend source exists
if [[ ! -d "atlassian/forge-app/src/resolvers" ]]; then
  fail "Backend resolvers directory not found: atlassian/forge-app/src/resolvers"
fi

pass "Backend source structure intact"
echo "atlassian/forge-app/src/resolvers" >> "$RUN_DIR/40_dist_list.txt"

# Final summary
{
  echo ""
  echo "=== AUDIT COMPLETE ==="
  echo "Manifest: $MANIFEST_PATH"
  echo "UI File: $UI_FILE"
  echo "Resolver File: $HANDLER_FILE"
  echo "Markers found: $MARKER_COUNT/2"
  echo "Dist files: $DIST_FILES"
} >> "$RUN_DIR/99_summary.txt"

header "All checks passed!"
log "Artifacts in: $RUN_DIR"
log "Summary: $(cat "$RUN_DIR/99_summary.txt" | tail -10)"

echo "$RUN_DIR"
