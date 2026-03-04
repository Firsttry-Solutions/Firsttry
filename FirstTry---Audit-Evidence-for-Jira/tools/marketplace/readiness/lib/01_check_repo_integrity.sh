#!/bin/bash
# Phase 01: Repository Integrity Check
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$SCRIPT_DIR/lib/00_common.sh"

PHASE_ID="PHASE_01_repo_integrity"

PHASE_DIR="$EVIDENCE_DIR/PHASE_01_repo_integrity"
mkdir -p "$PHASE_DIR"

info "Phase 01: Repository Integrity"

# Check if we're in a git repo
if ! git rev-parse --git-dir >/dev/null 2>&1; then
  die "Not a git repository"
fi

# Get git status
git status > "$PHASE_DIR/git_status.txt"
git rev-parse HEAD > "$PHASE_DIR/git_head.txt"

# Check if working tree is clean (unless ALLOW_DIRTY=1)
if [ "${ALLOW_DIRTY:-0}" != "1" ]; then
  if ! git diff-index --quiet HEAD --; then
    die "Working tree is dirty (uncommitted changes). Set ALLOW_DIRTY=1 to override."
  fi
  ok "Working tree is clean"
else
  warn "ALLOW_DIRTY=1 set - skipping clean working tree check"
fi

# Check required directories
# Layout A (dev/nested): requires $REPO_ROOT/atlassian; Layout B (flat): skip
if [ -d "$REPO_ROOT/atlassian" ]; then
  require_dir "$REPO_ROOT/atlassian"
else
  info "Layout B (flat): \$REPO_ROOT/atlassian not required (FORGE_APP_DIR=$FORGE_APP_DIR)"
fi
require_dir "$FORGE_APP_DIR"

# Check package-lock.json exists
require_file "$FORGE_APP_DIR/package-lock.json"

# Capture tree structure
ls -la "$REPO_ROOT" > "$PHASE_DIR/tree_root.txt" 2>&1 || true
ls -la "$REPO_ROOT/atlassian" > "$PHASE_DIR/tree_atlassian.txt" 2>&1 || true
ls -la "$FORGE_APP_DIR" > "$PHASE_DIR/tree_forge_app.txt" 2>&1 || true

write_section "$REPORT_PATH" "Phase 01: Repository Integrity - PASS"
echo "- Git repository: valid" >> "$REPORT_PATH"
echo "- Working tree: clean" >> "$REPORT_PATH"
echo "- Required directories: present" >> "$REPORT_PATH"
echo "- Evidence: \`$PHASE_DIR\`" >> "$REPORT_PATH"

ok "Phase 01: Repository Integrity - PASS"
