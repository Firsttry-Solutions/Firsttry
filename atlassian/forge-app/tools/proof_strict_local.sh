#!/bin/bash
#
# tools/proof_strict_local.sh
#
# STRICT FAIL-CLOSED PROOF RUNNER
#
# Requirements enforced (HARD RULES):
#   R1: Git tree must be clean (no tracked or untracked files except gitignored)
#   R2: Tests must exit 0 and have no unhandled errors
#   R3: Build must exit 0 and end with success markers (7/7 PASS)
#   R4: Build must NOT modify tracked files (determinism)
#   R5: Manifest must not contain webtrigger, remotes, or write/delete/manage scopes
#
# Output: /tmp/ft_durable_strict_proof_<UTC_TIMESTAMP>/
#   - 90_FINAL_STATUS.json (machine-readable results)
#   - 99_PASS.txt (only if ALL phases passed)
#   - Full logs and artifacts for audit

set -euo pipefail

# Generate timestamp for RUN_DIR uniqueness
TS=$(date -u +"%Y%m%dT%H%M%SZ")
RUN_DIR="/tmp/ft_durable_strict_proof_${TS}"

# Initialize counters and state
OVERALL_PASS="true"
FAIL_REASON=""

# Create RUN_DIR
mkdir -p "$RUN_DIR"
echo "$RUN_DIR" > "$RUN_DIR/00_run_dir.txt"

# Exec logging - capture all output
LOG="$RUN_DIR/00_full_log.txt"
exec > >(tee -a "$LOG") 2>&1

echo "╔════════════════════════════════════════════════════════════╗"
echo "║    STRICT FAIL-CLOSED PROOF RUNNER (Durable Edition)      ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo "RUN_DIR: $RUN_DIR"
echo "Started: $(date -u)"
echo ""

# ============================================================================
# PHASE 0: PREFLIGHT (Environment, Git State, Manifests)
# ============================================================================

echo "=== PHASE 0: PREFLIGHT CHECKS ==="

# Capture environment
echo "node $(node --version)" > "$RUN_DIR/01_node.txt"
echo "npm $(npm --version)" > "$RUN_DIR/01_npm.txt"
forge --version > "$RUN_DIR/01_forge.txt" 2>&1 || echo "forge (check failed)" > "$RUN_DIR/01_forge.txt"

# Capture git state
git rev-parse --abbrev-ref HEAD > "$RUN_DIR/02_branch.txt"
git rev-parse HEAD > "$RUN_DIR/03_head_sha.txt"

# HARD RULE: Git tree MUST be clean
PORCELAIN=$(git status --porcelain)
if [ -n "$PORCELAIN" ]; then
  echo "❌ FAIL: Git tree is NOT clean"
  echo "  Modified or untracked files detected:"
  echo "$PORCELAIN" | sed 's/^/    /'
  echo "DIRTY_TREE" > "$RUN_DIR/04_FAIL_git_dirty.txt"
  OVERALL_PASS="false"
  FAIL_REASON="Git tree not clean (tracked or untracked files exist)"
  
  # Create minimal status and exit
  echo "SKIPPED" > "$RUN_DIR/04_git_status_porcelain.txt"
  
  cat > "$RUN_DIR/90_FINAL_STATUS.json" << EOF
{
  "tsUtc": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "runDir": "$RUN_DIR",
  "gitClean": false,
  "overall": "FAIL",
  "failReason": "$FAIL_REASON"
}
EOF
  ls -1 "$RUN_DIR" | sort > "$RUN_DIR/91_ARTIFACT_INDEX.txt"
  echo ""; echo "❌ PROOF FAILED: $FAIL_REASON"; echo ""
  exit 1
fi

echo "✅ Git tree is clean" | tee "$RUN_DIR/04_git_clean.txt"
echo "" > "$RUN_DIR/04_git_status_porcelain.txt"

# ============================================================================
# PHASE 1: MANIFEST CHECKS (Forbidden Modules & Scopes)
# ============================================================================

echo ""
echo "=== PHASE 1: MANIFEST VERIFICATION ==="

MANIFEST_FILE="manifest.yml"
cp "$MANIFEST_FILE" "$RUN_DIR/10_manifest.yml"

# Check for forbidden webtrigger module
if grep -qE '^\s*webtrigger:' "$MANIFEST_FILE"; then
  echo "❌ FAIL: manifest.yml contains forbidden 'webtrigger:' module"
  echo "FORBIDDEN_MODULES" > "$RUN_DIR/13_FAIL_forbidden_modules.txt"
  OVERALL_PASS="false"
  FAIL_REASON="Manifest contains webtrigger module (ROA violation)"
else
  echo "webtrigger: not found" > "$RUN_DIR/11_webtrigger_scan.txt"
fi

if [ "$OVERALL_PASS" = "false" ]; then
  cat > "$RUN_DIR/90_FINAL_STATUS.json" << EOF
{
  "tsUtc": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "runDir": "$RUN_DIR",
  "gitClean": true,
  "forbiddenModules": true,
  "overall": "FAIL",
  "failReason": "$FAIL_REASON"
}
EOF
  ls -1 "$RUN_DIR" | sort > "$RUN_DIR/91_ARTIFACT_INDEX.txt"
  echo ""; echo "❌ PROOF FAILED: $FAIL_REASON"; echo ""
  exit 1
fi

# Check for forbidden remotes module
if grep -qE '^\s*remotes:' "$MANIFEST_FILE"; then
  echo "❌ FAIL: manifest.yml contains forbidden 'remotes:' module"
  echo "FORBIDDEN_MODULES" > "$RUN_DIR/13_FAIL_forbidden_modules.txt"
  OVERALL_PASS="false"
  FAIL_REASON="Manifest contains remotes module (ROA violation)"
else
  echo "remotes: not found" > "$RUN_DIR/12_remotes_scan.txt"
fi

if [ "$OVERALL_PASS" = "false" ]; then
  cat > "$RUN_DIR/90_FINAL_STATUS.json" << EOF
{
  "tsUtc": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "runDir": "$RUN_DIR",
  "gitClean": true,
  "forbiddenModules": true,
  "overall": "FAIL",
  "failReason": "$FAIL_REASON"
}
EOF
  ls -1 "$RUN_DIR" | sort > "$RUN_DIR/91_ARTIFACT_INDEX.txt"
  echo ""; echo "❌ PROOF FAILED: $FAIL_REASON"; echo ""
  exit 1
fi

# Extract and check scopes block
SCOPES_BLOCK=$(sed -n '/^permissions:/,/^[a-z]/p' "$MANIFEST_FILE" | sed -n '/^  scopes:/,/^  [^ ]/p')
echo "$SCOPES_BLOCK" > "$RUN_DIR/14_scopes_block.txt"

# Check for forbidden scopes (write, delete, manage, administer)
if echo "$SCOPES_BLOCK" | grep -qE '(write:|delete:|manage:|administer:)'; then
  echo "❌ FAIL: manifest.yml contains forbidden write/delete/manage/administer scopes"
  grep -E '(write:|delete:|manage:|administer:)' "$RUN_DIR/14_scopes_block.txt" | sed 's/^/  /'
  echo "FORBIDDEN_SCOPES" > "$RUN_DIR/15_FAIL_forbidden_scopes.txt"
  OVERALL_PASS="false"
  FAIL_REASON="Manifest contains forbidden scopes (read-only violation)"
fi

if [ "$OVERALL_PASS" = "false" ]; then
  cat > "$RUN_DIR/90_FINAL_STATUS.json" << EOF
{
  "tsUtc": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "runDir": "$RUN_DIR",
  "gitClean": true,
  "forbiddenModules": false,
  "forbiddenScopes": true,
  "overall": "FAIL",
  "failReason": "$FAIL_REASON"
}
EOF
  ls -1 "$RUN_DIR" | sort > "$RUN_DIR/91_ARTIFACT_INDEX.txt"
  echo ""; echo "❌ PROOF FAILED: $FAIL_REASON"; echo ""
  exit 1
fi

echo "✅ Manifest checks passed (no webtrigger, remotes, or forbidden scopes)"
echo ""

# ============================================================================
# PHASE 2: TESTS (Fail-Closed)
# ============================================================================

echo "=== PHASE 2: TEST EXECUTION ==="

TEST_RC=0
npm test 2>&1 | tee "$RUN_DIR/20_tests_full.txt" || TEST_RC=$?

# Extract test summary lines
grep -nE "Test Files|Tests\s|Errors\s|Duration" "$RUN_DIR/20_tests_full.txt" \
  > "$RUN_DIR/21_tests_summary_lines.txt" || true

# HARD RULE: Tests must exit 0
if [ $TEST_RC -ne 0 ]; then
  echo "❌ FAIL: Tests exited with code $TEST_RC"
  echo "TEST_EXIT_CODE" > "$RUN_DIR/22_FAIL_tests_exit_code.txt"
  OVERALL_PASS="false"
  FAIL_REASON="Tests exited non-zero (exit code: $TEST_RC)"
fi

if [ "$OVERALL_PASS" = "false" ]; then
  cat > "$RUN_DIR/90_FINAL_STATUS.json" << EOF
{
  "tsUtc": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "runDir": "$RUN_DIR",
  "gitClean": true,
  "forbiddenModules": false,
  "forbiddenScopes": false,
  "testsExitCode": $TEST_RC,
  "overall": "FAIL",
  "failReason": "$FAIL_REASON"
}
EOF
  ls -1 "$RUN_DIR" | sort > "$RUN_DIR/91_ARTIFACT_INDEX.txt"
  echo ""; echo "❌ PROOF FAILED: $FAIL_REASON"; echo ""
  exit 1
fi

# HARD RULE: Check for unhandled errors or rejections
if grep -qE "Unhandled Errors|Unhandled Rejection" "$RUN_DIR/20_tests_full.txt"; then
  echo "❌ FAIL: Test output contains unhandled errors or rejections"
  echo "UNHANDLED_ERRORS" > "$RUN_DIR/23_FAIL_tests_unhandled.txt"
  OVERALL_PASS="false"
  FAIL_REASON="Tests produced unhandled errors or rejections"
fi

if [ "$OVERALL_PASS" = "false" ]; then
  cat > "$RUN_DIR/90_FINAL_STATUS.json" << EOF
{
  "tsUtc": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "runDir": "$RUN_DIR",
  "gitClean": true,
  "forbiddenModules": false,
  "forbiddenScopes": false,
  "testsExitCode": 0,
  "testsUnhandled": true,
  "overall": "FAIL",
  "failReason": "$FAIL_REASON"
}
EOF
  ls -1 "$RUN_DIR" | sort > "$RUN_DIR/91_ARTIFACT_INDEX.txt"
  echo ""; echo "❌ PROOF FAILED: $FAIL_REASON"; echo ""
  exit 1
fi

# HARD RULE: Check for Errors count > 0 (only if "Errors" line exists)
if grep -qE "^\s*Errors\s+[1-9]" "$RUN_DIR/20_tests_full.txt"; then
  echo "❌ FAIL: Vitest output shows non-zero Errors count"
  echo "ERRORS_NOT_ZERO" > "$RUN_DIR/24_FAIL_tests_errors_nonzero.txt"
  OVERALL_PASS="false"
  FAIL_REASON="Vitest reported errors count > 0"
fi

if [ "$OVERALL_PASS" = "false" ]; then
  cat > "$RUN_DIR/90_FINAL_STATUS.json" << EOF
{
  "tsUtc": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "runDir": "$RUN_DIR",
  "gitClean": true,
  "forbiddenModules": false,
  "forbiddenScopes": false,
  "testsExitCode": 0,
  "testsUnhandled": false,
  "testsErrorsZero": false,
  "overall": "FAIL",
  "failReason": "$FAIL_REASON"
}
EOF
  ls -1 "$RUN_DIR" | sort > "$RUN_DIR/91_ARTIFACT_INDEX.txt"
  echo ""; echo "❌ PROOF FAILED: $FAIL_REASON"; echo ""
  exit 1
fi

echo "✅ Tests passed (exit 0, no unhandled errors, Errors = 0 or absent)"
echo ""

# ============================================================================
# GIT CLEAN CHECK AFTER TESTS
# ============================================================================

echo "=== CHECKING GIT STATE AFTER TESTS ==="

PORCELAIN_AFTER_TESTS=$(git status --porcelain)
if [ -n "$PORCELAIN_AFTER_TESTS" ]; then
  echo "❌ FAIL: Tests modified tracked files"
  echo "$PORCELAIN_AFTER_TESTS" | sed 's/^/    /'
  echo "DIRTY_TREE_AFTER_TESTS" > "$RUN_DIR/25_FAIL_git_dirty_after_tests.txt"
  OVERALL_PASS="false"
  FAIL_REASON="Git tree became dirty after tests"
fi

if [ "$OVERALL_PASS" = "false" ]; then
  cat > "$RUN_DIR/90_FINAL_STATUS.json" << EOF
{
  "tsUtc": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "runDir": "$RUN_DIR",
  "gitClean": true,
  "forbiddenModules": false,
  "forbiddenScopes": false,
  "testsExitCode": 0,
  "testsUnhandled": false,
  "testsErrorsZero": true,
  "gitCleanAfterTests": false,
  "overall": "FAIL",
  "failReason": "$FAIL_REASON"
}
EOF
  ls -1 "$RUN_DIR" | sort > "$RUN_DIR/91_ARTIFACT_INDEX.txt"
  echo ""; echo "❌ PROOF FAILED: $FAIL_REASON"; echo ""
  exit 1
fi

echo "✅ Git tree remains clean after tests"
echo ""

# ============================================================================
# PHASE 3: BUILD (Fail-Closed, Determinism Check)
# ============================================================================

echo "=== PHASE 3: BUILD EXECUTION ==="

BUILD_RC=0
npm run build 2>&1 | tee "$RUN_DIR/30_build_full.txt" || BUILD_RC=$?

# Capture last 120 lines for analysis
tail -120 "$RUN_DIR/30_build_full.txt" > "$RUN_DIR/31_build_tail.txt" || true

# HARD RULE: Build must exit 0
if [ $BUILD_RC -ne 0 ]; then
  echo "❌ FAIL: Build exited with code $BUILD_RC"
  echo "BUILD_EXIT_CODE" > "$RUN_DIR/32_FAIL_build_exit_code.txt"
  OVERALL_PASS="false"
  FAIL_REASON="Build exited non-zero (exit code: $BUILD_RC)"
fi

if [ "$OVERALL_PASS" = "false" ]; then
  cat > "$RUN_DIR/90_FINAL_STATUS.json" << EOF
{
  "tsUtc": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "runDir": "$RUN_DIR",
  "gitClean": true,
  "forbiddenModules": false,
  "forbiddenScopes": false,
  "testsExitCode": 0,
  "testsUnhandled": false,
  "testsErrorsZero": true,
  "gitCleanAfterTests": true,
  "buildExitCode": $BUILD_RC,
  "overall": "FAIL",
  "failReason": "$FAIL_REASON"
}
EOF
  ls -1 "$RUN_DIR" | sort > "$RUN_DIR/91_ARTIFACT_INDEX.txt"
  echo ""; echo "❌ PROOF FAILED: $FAIL_REASON"; echo ""
  exit 1
fi

# HARD RULE: Build must end with success markers within last 200 lines
TAIL_200=$(tail -200 "$RUN_DIR/30_build_full.txt")
if ! echo "$TAIL_200" | grep -q "7/7"; then
  echo "❌ FAIL: Build success marker '7/7' not found in last 200 lines"
  echo "BUILD_MARKERS_MISSING" > "$RUN_DIR/33_FAIL_build_markers.txt"
  OVERALL_PASS="false"
  FAIL_REASON="Build did not produce success markers (7/7 PASS not found)"
fi

if [ "$OVERALL_PASS" = "true" ] && ! echo "$TAIL_200" | grep -q "PASS"; then
  echo "❌ FAIL: Build success marker 'PASS' not found in last 200 lines"
  echo "BUILD_MARKERS_MISSING" > "$RUN_DIR/33_FAIL_build_markers.txt"
  OVERALL_PASS="false"
  FAIL_REASON="Build did not produce success markers (PASS not found)"
fi

if [ "$OVERALL_PASS" = "false" ]; then
  cat > "$RUN_DIR/90_FINAL_STATUS.json" << EOF
{
  "tsUtc": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "runDir": "$RUN_DIR",
  "gitClean": true,
  "forbiddenModules": false,
  "forbiddenScopes": false,
  "testsExitCode": 0,
  "testsUnhandled": false,
  "testsErrorsZero": true,
  "gitCleanAfterTests": true,
  "buildExitCode": 0,
  "buildMarkersClean": false,
  "overall": "FAIL",
  "failReason": "$FAIL_REASON"
}
EOF
  ls -1 "$RUN_DIR" | sort > "$RUN_DIR/91_ARTIFACT_INDEX.txt"
  echo ""; echo "❌ PROOF FAILED: $FAIL_REASON"; echo ""
  exit 1
fi

# HARD RULE: Check for actual build failures (not test verification output)
if tail -50 "$RUN_DIR/30_build_full.txt" | grep -qE "Build failed|build error"; then
  echo "❌ FAIL: Build log contains failure markers in last 50 lines"
  echo "BUILD_ERROR_MARKERS" > "$RUN_DIR/34_FAIL_build_errors.txt"
  OVERALL_PASS="false"
  FAIL_REASON="Build produced error markers"
fi

if [ "$OVERALL_PASS" = "false" ]; then
  cat > "$RUN_DIR/90_FINAL_STATUS.json" << EOF
{
  "tsUtc": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "runDir": "$RUN_DIR",
  "gitClean": true,
  "forbiddenModules": false,
  "forbiddenScopes": false,
  "testsExitCode": 0,
  "testsUnhandled": false,
  "testsErrorsZero": true,
  "gitCleanAfterTests": true,
  "buildExitCode": 0,
  "buildMarkersClean": true,
  "buildErrorMarkers": true,
  "overall": "FAIL",
  "failReason": "$FAIL_REASON"
}
EOF
  ls -1 "$RUN_DIR" | sort > "$RUN_DIR/91_ARTIFACT_INDEX.txt"
  echo ""; echo "❌ PROOF FAILED: $FAIL_REASON"; echo ""
  exit 1
fi

echo "✅ Build succeeded (exit 0, success markers present, no error markers)"
echo ""

# ============================================================================
# GIT CLEAN CHECK AFTER BUILD (DETERMINISM)
# ============================================================================

echo "=== CHECKING GIT STATE AFTER BUILD (DETERMINISM) ==="

PORCELAIN_AFTER_BUILD=$(git status --porcelain)
if [ -n "$PORCELAIN_AFTER_BUILD" ]; then
  echo "❌ FAIL: Build modified tracked files (determinism violation)"
  echo "$PORCELAIN_AFTER_BUILD" | sed 's/^/    /'
  echo "DIRTY_TREE_AFTER_BUILD" > "$RUN_DIR/35_FAIL_git_dirty_after_build.txt"
  OVERALL_PASS="false"
  FAIL_REASON="Build modified tracked files (determinism violation)"
fi

if [ "$OVERALL_PASS" = "false" ]; then
  cat > "$RUN_DIR/90_FINAL_STATUS.json" << EOF
{
  "tsUtc": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "runDir": "$RUN_DIR",
  "gitClean": true,
  "forbiddenModules": false,
  "forbiddenScopes": false,
  "testsExitCode": 0,
  "testsUnhandled": false,
  "testsErrorsZero": true,
  "gitCleanAfterTests": true,
  "buildExitCode": 0,
  "buildMarkersClean": true,
  "buildDeterministic": false,
  "overall": "FAIL",
  "failReason": "$FAIL_REASON"
}
EOF
  ls -1 "$RUN_DIR" | sort > "$RUN_DIR/91_ARTIFACT_INDEX.txt"
  echo ""; echo "❌ PROOF FAILED: $FAIL_REASON"; echo ""
  exit 1
fi

echo "✅ Git tree remains clean after build (determinism verified)"
echo ""

# ============================================================================
# PHASE 4: FINAL STATUS (only reached if all passed)
# ============================================================================

echo "=== PHASE 4: FINAL STATUS ==="

# Create artifact index
ls -1 "$RUN_DIR" | sort > "$RUN_DIR/91_ARTIFACT_INDEX.txt"

# Create final status JSON
cat > "$RUN_DIR/90_FINAL_STATUS.json" << EOF
{
  "tsUtc": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "runDir": "$RUN_DIR",
  "headSha": "$(cat "$RUN_DIR/03_head_sha.txt")",
  "branch": "$(cat "$RUN_DIR/02_branch.txt")",
  "gitClean": true,
  "forbiddenModules": false,
  "forbiddenScopes": false,
  "testsExitCode": 0,
  "testsUnhandled": false,
  "testsErrorsZero": true,
  "gitCleanAfterTests": true,
  "buildExitCode": 0,
  "buildMarkersClean": true,
  "buildDeterministic": true,
  "overall": "PASS",
  "failReason": ""
}
EOF

echo "PASS" > "$RUN_DIR/99_PASS.txt"

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                    ✅ PROOF COMPLETE                       ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "All requirements verified:"
echo "  ✅ R1: Go-to-market enterprise-ready (no webtrigger/remotes)"
echo "  ✅ R2: Read-only (no forbidden scopes)"
echo "  ✅ R3: Deterministic (git clean before and after)"
echo "  ✅ R4: Backbone-first (manifest checked first)"
echo "  ✅ R5: Tests passed (0 unhandled errors)"
echo "  ✅ R6: Build passed (7/7 gates, success markers present)"
echo ""
echo "Artifacts: $RUN_DIR"
echo ""
