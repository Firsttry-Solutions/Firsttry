#!/usr/bin/env bash
#
# verify_no_tracked_changes_after_test.sh
#
# POSTTEST GATE: Verify that test execution did NOT modify any tracked files.
# This ensures pretest script (build_meta.mjs) produces deterministic output.
#
# FAIL CONDITIONS:
#   - Any tracked files have uncommitted changes after tests
#   - exit code 1 if violations found
#
# SUCCESS:
#   - Working tree is clean (no tracked file modifications)
#   - exit code 0

set -euo pipefail

echo "[POSTTEST_GATE] Verifying no tracked changes after test execution..."

# Check if any tracked files were modified
if ! git diff --exit-code -- . >/dev/null 2>&1; then
  echo "❌ FAIL: Tracked changes detected after tests"
  echo "Files modified:"
  git diff --name-status -- . | sed 's/^/  /'
  echo ""
  echo "Tests must not modify source files. The pretest script should generate deterministic output."
  exit 1
fi

echo "✅ PASS: No tracked changes after test execution"
exit 0
