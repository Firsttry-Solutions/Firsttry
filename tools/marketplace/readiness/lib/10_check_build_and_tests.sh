#!/bin/bash
# Phase 10: Build and Tests Check
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$SCRIPT_DIR/lib/00_common.sh"
PHASE_ID="PHASE_10_build_tests"

PHASE_DIR="$EVIDENCE_DIR/PHASE_10_build_tests"
mkdir -p "$PHASE_DIR"

info "Phase 10: Build and Tests"

cd "$REPO_ROOT/atlassian/forge-app"

# Ensure npm ci has run (may have run in phase 09)
if [ ! -d "node_modules" ]; then
  info "Running npm ci..."
  if ! npm ci --prefer-offline --no-audit > "$PHASE_DIR/npm_ci.log" 2>&1; then
    die "npm ci failed"
  fi
fi

# Capture prebuild tracked status to enable smart change detection
# This allows build to proceed even if there are pre-existing uncommitted changes
# (build will only fail if IT introduces new changes)
PREBUILD_STATUS_FILE="$PHASE_DIR/prebuild_tracked_status.txt"
cd "$REPO_ROOT"
git status --porcelain=v1 -uno | sort > "$PREBUILD_STATUS_FILE" 2>&1 || touch "$PREBUILD_STATUS_FILE"
cd "$REPO_ROOT/atlassian/forge-app"

# Run build with prebuild snapshot
info "Running npm run build..."
if ! FT_PREBUILD_TRACKED_STATUS_FILE="$PREBUILD_STATUS_FILE" npm run build > "$PHASE_DIR/npm_build.log" 2>&1; then
  die "npm run build failed - see $PHASE_DIR/npm_build.log"
fi
ok "Build successful"

# Check for warnings (unless allowlisted)
ALLOWLIST_FILE="$SCRIPT_DIR/ALLOWLIST_BUILD_WARNINGS.txt"
if [ ! -f "$ALLOWLIST_FILE" ]; then
  touch "$ALLOWLIST_FILE"
fi

grep -iE "warning" "$PHASE_DIR/npm_build.log" > "$PHASE_DIR/warnings_found.txt" 2>&1 || echo "No warnings" > "$PHASE_DIR/warnings_found.txt"

WARNING_COUNT=$(grep -v "No warnings" "$PHASE_DIR/warnings_found.txt" | wc -l | tr -d ' ')
if [ "$WARNING_COUNT" -gt 0 ]; then
  # Check if warnings are allowlisted
  if [ ! -s "$ALLOWLIST_FILE" ] || ! grep -qf "$ALLOWLIST_FILE" "$PHASE_DIR/warnings_found.txt"; then
    warn "Build produced $WARNING_COUNT warnings (review required)"
  fi
fi

# Run tests
info "Running tests..."
TEST_CMD="test"
if ! grep -q '"test"' package.json 2>/dev/null; then
  if grep -q '"test:ci"' package.json 2>/dev/null; then
    TEST_CMD="test:ci"
  else
    die "No test script found in package.json (expected 'test' or 'test:ci')"
  fi
fi

if ! npm run "$TEST_CMD" > "$PHASE_DIR/npm_test.log" 2>&1; then
  die "Tests failed - see $PHASE_DIR/npm_test.log"
fi
ok "Tests passed"

write_section "$REPORT_PATH" "Phase 10: Build and Tests - PASS"
echo "- Build: successful" >> "$REPORT_PATH"
echo "- Warnings: $WARNING_COUNT" >> "$REPORT_PATH"
echo "- Tests: passed" >> "$REPORT_PATH"
echo "- Evidence: \`$PHASE_DIR\`" >> "$REPORT_PATH"

ok "Phase 10: Build and Tests - PASS"
