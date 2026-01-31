#!/bin/bash
set -euo pipefail

###############################################################################
# Dashboard Audit Report - Shell Orchestrator
# Collects raw evidence and invokes Node.js report generator
###############################################################################

# Determine run directory and timestamp
UTC_TS=$(date -u +%Y%m%dT%H%M%SZ)
RUN_DIR="/tmp/ft_dashboard_audit_${UTC_TS}"
mkdir -p "$RUN_DIR"

APP_ROOT="/workspaces/Firsttry/atlassian/forge-app"

echo "[AUDIT] Starting dashboard audit: $UTC_TS"
echo "[AUDIT] RUN_DIR: $RUN_DIR"
echo "[AUDIT] APP_ROOT: $APP_ROOT"

# Save APP_ROOT for report generation
echo "$APP_ROOT" > "$RUN_DIR/APP_ROOT.txt"
echo "$UTC_TS" > "$RUN_DIR/UTC_TS.txt"

# ============================================================================
# STEP 2: Collect raw evidence
# ============================================================================

echo "[AUDIT] Collecting git metadata..."
cd "$APP_ROOT" || exit 1

# Git head
if git rev-parse HEAD > "$RUN_DIR/git_head.txt" 2>&1; then
  echo "[AUDIT] Git HEAD: $(cat "$RUN_DIR/git_head.txt")"
else
  echo "[AUDIT] Not a git repo or git failed"
  echo "N/A" > "$RUN_DIR/git_head.txt"
fi

# Git status (non-fatal)
git status --porcelain=v1 > "$RUN_DIR/git_status.txt" 2>&1 || true

echo "[AUDIT] Listing directory structure..."
# List key directories
for dir in src static resources frontend backend dist; do
  if [[ -d "$dir" ]]; then
    echo "=== $dir ===" >> "$RUN_DIR/ls_tree.txt"
    find "$dir" -type f -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.json" 2>/dev/null | head -50 >> "$RUN_DIR/ls_tree.txt" || true
  fi
done

echo "[AUDIT] Searching for dashboard markers with ripgrep..."

# Define search patterns
declare -A PATTERNS=(
  ["dashboard_resolver"]="ft_getDashboardState_v1"
  ["dashboard_ui_render"]="L0_DASHBOARD_RENDERED|l0-dashboard"
  ["ui_provenance"]="Build SHA|Build Time|Schema|Snapshot ID|Created|l0-provenance-strip|l0-provenance-field"
  ["ui_snapshot_selector"]="ft-snapshot-variant-select|View Snapshot|l0-variant-controls|l0-variant-select"
  ["snapshot_types"]="Seed Snapshot|snapshot.*AVAILABLE|INVALID_SNAPSHOT"
  ["scope_boundaries"]="Scope.*Boundaries|ScopeBoundaries|coverage.*integrity.*provenance"
  ["forge_bridge"]="@forge/bridge|invoke|view\.setHeight|view\.resize"
  ["export_logic"]="export.*JSON|download|schemaVersion|deterministic"
  ["support_hooks"]="support.*link|correlation.*ID|Copy.*diagnostics|UI.*identity"
  ["resize_handler"]="ResizeObserver|RESIZE_HANDLER|resizeFuncType"
  ["boot_markers"]="UI_RESIZE_CAPS|BRIDGE_READINESS_PROOF|UI_BUILD_IDENTITY"
  ["capability_detection"]="hasResize|hasSetHeight|resizeFuncType"
)

# Execute searches
for key in "${!PATTERNS[@]}"; do
  pattern="${PATTERNS[$key]}"
  output_file="$RUN_DIR/rg_${key}.txt"
  echo "[AUDIT] Searching: $key"
  rg -n "$pattern" src/ 2>/dev/null | head -100 > "$output_file" || echo "No matches for $key" > "$output_file"
done

# Additional specific searches
echo "[AUDIT] Searching for snapshot and state mapping..."
rg -n "state.*AVAILABLE|snapshotId|createdAtUtc" src/ 2>/dev/null | head -50 > "$RUN_DIR/rg_state_mapping.txt" || true

echo "[AUDIT] Searching for UI components and exports..."
rg -n "export.*Dashboard|export.*function.*render|export.*const.*Dashboard" src/ 2>/dev/null | head -50 > "$RUN_DIR/rg_exports.txt" || true

echo "[AUDIT] Searching for resolver definitions..."
rg -n "export.*function.*ft_|^export.*resolver" src/ 2>/dev/null | head -50 > "$RUN_DIR/rg_resolvers.txt" || true

echo "[AUDIT] Searching for timestamp and metadata..."
rg -n "createdAtUtc|timestamp|build.*SHA|buildId|UI_GIT_SHA|UI_BUNDLE_HASH" src/ 2>/dev/null | head -50 > "$RUN_DIR/rg_metadata.txt" || true

echo "[AUDIT] All evidence collected to $RUN_DIR"
ls -lh "$RUN_DIR"/ | head -20

# ============================================================================
# STEP 3: Invoke Node.js report generator
# ============================================================================

echo "[AUDIT] Generating structured reports..."

# Get the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Run the Node.js script to generate reports
node "$SCRIPT_DIR/dashboard_audit_report.mjs" "$RUN_DIR" "$APP_ROOT" "$UTC_TS"

REPORT_EXIT=$?

# ============================================================================
# STEP 7: Validation gates
# ============================================================================

echo "[AUDIT] Validating report output..."

if [[ ! -f "$RUN_DIR/REPORT.md" ]]; then
  echo "[ERROR] REPORT.md not found"
  exit 1
fi

if [[ ! -f "$RUN_DIR/report.json" ]]; then
  echo "[ERROR] report.json not found"
  exit 1
fi

# Validate JSON
if ! jq empty "$RUN_DIR/report.json" 2>/dev/null; then
  echo "[ERROR] report.json is not valid JSON"
  exit 1
fi

echo "[AUDIT] ✅ Reports generated successfully"
echo "[AUDIT] REPORT.md: $RUN_DIR/REPORT.md"
echo "[AUDIT] report.json: $RUN_DIR/report.json"
echo "[AUDIT] Evidence directory: $RUN_DIR"

exit 0
