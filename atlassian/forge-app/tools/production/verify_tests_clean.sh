#!/bin/bash
set -euo pipefail

# ==============================================================================
# verify_tests_clean.sh
# ==============================================================================
# Purpose: Hard-gate on dirty working tree, then run npm test with full proof
# Requirements:
#   - E dir from /tmp/ft_prod_ready_dir.txt
#   - Only allow uncommitted changes in: docs/production/*, tools/production/*, tests/production/*
#   - Save all test output and exit code for evidence

# Read E from lock file
if [[ ! -f /tmp/ft_prod_ready_dir.txt ]]; then
  echo "FAIL: /tmp/ft_prod_ready_dir.txt not found. Run production audit setup first."
  exit 1
fi

E=$(cat /tmp/ft_prod_ready_dir.txt)
if [[ ! -d "$E/03_tests" ]]; then
  echo "FAIL: Evidence directory $E/03_tests does not exist."
  exit 1
fi

cd /workspaces/Firsttry/atlassian/forge-app

# ==============================================================================
# Dirty tree gate (canonical policy)
# ==============================================================================
echo "=== GATE 1: Dirty Tree Check ==="

if ! bash tools/production/verify_clean_tree_allowlist.sh; then
  exit 1
fi

# ==============================================================================
# Run npm test
# ==============================================================================
echo ""
echo "=== GATE 2: Running npm test ==="

npm test > "$E/03_tests/npm_test_full.log" 2>&1
TEST_EXIT=$?

# Capture summary (tail)
tail -200 "$E/03_tests/npm_test_full.log" | tee "$E/03_tests/npm_test_summary_tail.txt"

# Write exit code
echo "$TEST_EXIT" | tee "$E/03_tests/npm_test_exit_code.txt"

if [[ $TEST_EXIT -ne 0 ]]; then
  echo ""
  echo "FAIL: npm test exited with code $TEST_EXIT"
  echo "Full log: $E/03_tests/npm_test_full.log"
  exit $TEST_EXIT
fi

echo ""
echo "PASS: npm test exited with code 0"
echo "Evidence:"
echo "  Full log: $E/03_tests/npm_test_full.log"
echo "  Exit code: $E/03_tests/npm_test_exit_code.txt"
echo "  Summary: $E/03_tests/npm_test_summary_tail.txt"

exit 0
