#!/usr/bin/env bash
set -euo pipefail

cd /workspaces/Firsttry/atlassian/forge-app

TS="$(date -u +%Y%m%dT%H%M%SZ)"
RUN_DIR="/tmp/ft_strict_proof_${TS}"
mkdir -p "$RUN_DIR"
echo "RUN_DIR=$RUN_DIR" | tee "$RUN_DIR/00_run_dir.txt"

LOG="$RUN_DIR/00_full_log.txt"
exec > >(tee -a "$LOG") 2>&1

echo "=== PHASE 0: PREFLIGHT ==="
node -v | tee "$RUN_DIR/01_node.txt"
npm -v | tee "$RUN_DIR/01_npm.txt"
forge --version | tee "$RUN_DIR/01_forge.txt"
git rev-parse --abbrev-ref HEAD | tee "$RUN_DIR/02_branch.txt"
git rev-parse HEAD | tee "$RUN_DIR/03_head_sha.txt"

git status --porcelain=v1 | tee "$RUN_DIR/04_git_status_porcelain.txt"
if [ -s "$RUN_DIR/04_git_status_porcelain.txt" ]; then
  echo "FAIL: DIRTY OR UNTRACKED FILES PRESENT" | tee "$RUN_DIR/04_FAIL_dirty_tree.txt"
  exit 1
fi
echo "CLEAN" | tee "$RUN_DIR/04_git_clean.txt"

echo "=== PHASE 1: MANIFEST HARD CHECKS ==="
cp manifest.yml "$RUN_DIR/10_manifest.yml"

(grep -nE "^\s*webtrigger\s*:" manifest.yml || true) | tee "$RUN_DIR/11_webtrigger_scan.txt"
(grep -nE "^\s*remotes\s*:" manifest.yml || true) | tee "$RUN_DIR/12_remotes_scan.txt"
if [ -s "$RUN_DIR/11_webtrigger_scan.txt" ] || [ -s "$RUN_DIR/12_remotes_scan.txt" ]; then
  echo "FAIL: FORBIDDEN MODULES PRESENT" | tee "$RUN_DIR/13_FAIL_forbidden_modules.txt"
  exit 1
fi

awk '
  /^\s*scopes:\s*$/ {p=1; print; next}
  p==1 && /^\s*[A-Za-z0-9_-]+\s*:/ {exit}
  p==1 {print}
' manifest.yml | tee "$RUN_DIR/14_scopes_block.txt"

if grep -qE "write:|manage:|delete:|administer:" "$RUN_DIR/14_scopes_block.txt"; then
  echo "FAIL: FORBIDDEN SCOPES PRESENT" | tee "$RUN_DIR/15_FAIL_forbidden_scopes.txt"
  exit 1
fi

echo "=== PHASE 2: TESTS (FAIL-CLOSED ON UNHANDLED) ==="
set +e
npm test 2>&1 | tee "$RUN_DIR/20_tests_full.txt"
TEST_RC="${PIPESTATUS[0]}"
set -e

grep -nE "Test Files|Tests\s|Errors\s|Duration" "$RUN_DIR/20_tests_full.txt" | tail -30 | tee "$RUN_DIR/21_tests_summary_lines.txt"

if [ "$TEST_RC" -ne 0 ]; then
  echo "FAIL: npm test exit code $TEST_RC" | tee "$RUN_DIR/22_FAIL_tests_exit_code.txt"
  exit 1
fi
if grep -qE "Unhandled Errors|Unhandled Rejection" "$RUN_DIR/20_tests_full.txt"; then
  echo "FAIL: Unhandled errors detected in tests" | tee "$RUN_DIR/23_FAIL_tests_unhandled.txt"
  exit 1
fi

echo "=== PHASE 3: BUILD (FAIL-CLOSED ON FAILURE MARKERS) ==="
set +e
npm run build 2>&1 | tee "$RUN_DIR/30_build_full.txt"
BUILD_RC="${PIPESTATUS[0]}"
set -e

tail -120 "$RUN_DIR/30_build_full.txt" | tee "$RUN_DIR/31_build_tail.txt"

if [ "$BUILD_RC" -ne 0 ]; then
  echo "FAIL: npm run build exit code $BUILD_RC" | tee "$RUN_DIR/32_FAIL_build_exit_code.txt"
  exit 1
fi
if grep -qE "ERROR|ERROR:" "$RUN_DIR/30_build_full.txt"; then
  echo "FAIL: error markers found in build log" | tee "$RUN_DIR/33_FAIL_build_markers.txt"
  exit 1
fi

echo "=== PHASE 4: FINAL STATUS ==="
(cd "$RUN_DIR" && ls -1 | sort) | tee "$RUN_DIR/91_ARTIFACT_INDEX.txt"

cat > "$RUN_DIR/90_FINAL_STATUS.json" <<EOF
{
  "tsUtc": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "runDir": "$RUN_DIR",
  "headSha": "$(cat "$RUN_DIR/03_head_sha.txt")",
  "gitClean": true,
  "forbiddenModules": false,
  "forbiddenScopes": false,
  "testsExitCode": 0,
  "testsUnhandled": false,
  "testsErrorsZero": true,
  "buildExitCode": 0,
  "buildMarkersClean": true,
  "overall": "PASS"
}
EOF

echo "PASS" > "$RUN_DIR/99_PASS.txt"
echo "✅ PROOF COMPLETE: $RUN_DIR"
