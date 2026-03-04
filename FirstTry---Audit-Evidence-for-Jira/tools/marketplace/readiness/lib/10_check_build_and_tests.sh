#!/bin/bash
# Phase 10: Build and Tests Check
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$SCRIPT_DIR/lib/00_common.sh"
PHASE_ID="PHASE_10_build_tests"

PHASE_DIR="$EVIDENCE_DIR/PHASE_10_build_tests"
mkdir -p "$PHASE_DIR"

info "Phase 10: Build and Tests"

cd "$FORGE_APP_DIR"

# Detect prebuilt mode: if build_meta.mjs is missing, assume pre-built dist (vendor flat layout)
# Override with PREBUILT_DIST=1 or PREBUILT_DIST=0 env var
DIST_DIR="$FORGE_APP_DIR/src/gadget-ui/dist"
if [ -z "${PREBUILT_DIST:-}" ]; then
  if [ ! -f "$FORGE_APP_DIR/tools/build_meta.mjs" ] && [ -f "$DIST_DIR/index.html" ]; then
    PREBUILT_DIST=1
    info "Pre-built dist detected (tools/build_meta.mjs absent, dist/index.html present) — skipping full build"
  else
    PREBUILT_DIST=0
  fi
fi

if [ "${PREBUILT_DIST:-0}" = "1" ]; then
  # Pre-built mode: verify dist artifacts exist and are non-trivial
  require_file "$DIST_DIR/index.html" 100
  DIST_JS_COUNT=$(find "$DIST_DIR" -name "*.js" | wc -l | tr -d ' ')
  if [ "$DIST_JS_COUNT" -eq 0 ]; then
    die "Pre-built dist at $DIST_DIR has no .js files"
  fi
  ok "Pre-built dist verified: $DIST_DIR ($DIST_JS_COUNT JS files)"
  echo "prebuilt_dist=true" > "$PHASE_DIR/build_mode.txt"
  echo "dist_dir=$DIST_DIR" >> "$PHASE_DIR/build_mode.txt"
  echo "dist_js_count=$DIST_JS_COUNT" >> "$PHASE_DIR/build_mode.txt"

  # Still run tests (they can run without a fresh build)
  # In pre-built mode, run vitest directly to bypass pretest/posttest lifecycle hooks
  # (which require tools/build_meta.mjs that is part of the dev build chain, not vendor)
  info "Running tests (pre-built mode: invoking vitest directly)..."
  # Ensure node_modules exist
  if [ ! -d "node_modules" ]; then
    info "Running npm ci for tests..."
    if ! npm ci --prefer-offline --no-audit > "$PHASE_DIR/npm_ci.log" 2>&1; then
      die "npm ci failed"
    fi
  fi
  # Run vitest directly bypassing npm hooks
  VITEST_BIN="./node_modules/.bin/vitest"
  if [ ! -f "$VITEST_BIN" ]; then
    VITEST_BIN="$(npm bin 2>/dev/null)/vitest"
  fi
  if ! "$VITEST_BIN" run --passWithNoTests > "$PHASE_DIR/npm_test.log" 2>&1; then
    die "Tests failed - see $PHASE_DIR/npm_test.log"
  fi
  ok "Tests passed"

  write_section "$REPORT_PATH" "Phase 10: Build and Tests - PASS"
  echo "- Build mode: pre-built dist (vendor layout)" >> "$REPORT_PATH"
  echo "- Dist artifacts: present ($DIST_JS_COUNT JS files)" >> "$REPORT_PATH"
  echo "- Tests: passed" >> "$REPORT_PATH"
  echo "- Evidence: \`$PHASE_DIR\`" >> "$REPORT_PATH"

  ok "Phase 10: Build and Tests - PASS"
  exit 0
fi

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
cd "$FORGE_APP_DIR"

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
