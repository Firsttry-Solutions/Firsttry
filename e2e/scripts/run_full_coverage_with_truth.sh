#!/bin/bash
#
# run_full_coverage_with_truth.sh
#
# PHASE 2: Deterministic E2E runner with build proof
#
# Usage:
#   STORAGE_STATE="..." JIRA_DASHBOARD_URL="..." bash e2e/scripts/run_full_coverage_with_truth.sh
#
# Steps:
# 1. Run expected_build_truth.mjs to capture local expected state
# 2. Export EXPECTED_BACKEND_SHA and EXPECTED_UI_GIT_SHA from JSON
# 3. Run E2E suite with those expectations
# 4. Output verdict and artifacts

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
REPO_ROOT="$( cd "$SCRIPT_DIR/../.." && pwd )"

echo ""
echo "╔════════════════════════════════════════════════════════════════════════════════╗"
echo "║ PHASE 2: Full Coverage E2E with Build Truth & Cloud Proof                      ║"
echo "╚════════════════════════════════════════════════════════════════════════════════╝"
echo ""

# ════════════════════════════════════════════════════════════════════════════════════
# Validate environment
# ════════════════════════════════════════════════════════════════════════════════════

if [ -z "$STORAGE_STATE" ]; then
  echo "[ERROR] STORAGE_STATE env var required (use '__NONE__' for unauth or path to .json)"
  exit 2
fi

if [ -z "$JIRA_DASHBOARD_URL" ]; then
  echo "[ERROR] JIRA_DASHBOARD_URL env var required"
  exit 2
fi

echo "[RUNNER] Configuration:"
echo "  STORAGE_STATE: $STORAGE_STATE"
echo "  JIRA_DASHBOARD_URL: $JIRA_DASHBOARD_URL"
echo ""

# ════════════════════════════════════════════════════════════════════════════════════
# Step 1: Run expected_build_truth.mjs
# ════════════════════════════════════════════════════════════════════════════════════

echo "[RUNNER] Step 1: Capturing expected build truth..."
cd "$REPO_ROOT"
node e2e/scripts/expected_build_truth.mjs

if [ ! -f "/tmp/ft_expected_build_truth.json" ]; then
  echo "[ERROR] expected_build_truth.mjs did not create output file"
  exit 1
fi

echo ""
echo "[RUNNER] ✓ Build truth captured"
echo ""

# ════════════════════════════════════════════════════════════════════════════════════
# Step 2: Parse expected SHAs from JSON
# ════════════════════════════════════════════════════════════════════════════════════

BACKEND_SHA=$(jq -r '.forge_app_head_full' /tmp/ft_expected_build_truth.json)
UI_SHA=$(jq -r '.ui_git_sha_from_generated_meta' /tmp/ft_expected_build_truth.json)

echo "[RUNNER] Expected build identifiers:"
echo "  Backend SHA (forge-app): $BACKEND_SHA"
echo "  UI SHA (gadget):         $UI_SHA"
echo ""

# Export for E2E suite to use
export EXPECTED_BACKEND_SHA="$BACKEND_SHA"
export EXPECTED_UI_GIT_SHA="$UI_SHA"

# ════════════════════════════════════════════════════════════════════════════════════
# Step 3: Run E2E suite
# ════════════════════════════════════════════════════════════════════════════════════

echo "[RUNNER] Step 3: Running E2E suite..."
echo ""

cd "$REPO_ROOT/e2e"
npx playwright test tests/dashboard_full_coverage.spec.ts --reporter=line

E2E_EXIT=$?

echo ""
echo "[RUNNER] E2E suite completed with exit code: $E2E_EXIT"
echo ""

# ════════════════════════════════════════════════════════════════════════════════════
# Step 4: Output summary
# ════════════════════════════════════════════════════════════════════════════════════

echo "[RUNNER] ╔════════════════════════════════════════════════════════════════╗"
echo "[RUNNER] ║ ARTIFACTS & SUMMARY                                            ║"
echo "[RUNNER] ╚════════════════════════════════════════════════════════════════╝"
echo ""

# Find latest suite artifact dir
LATEST_SUITE=$(ls -td /tmp/dashboard_full_coverage_* 2>/dev/null | head -1)
if [ -n "$LATEST_SUITE" ]; then
  echo "[RUNNER] Latest suite artifacts: $LATEST_SUITE"
  echo ""

  # Show cloud build proof if it exists
  if [ -f "$LATEST_SUITE/cloud_build_proof.json" ]; then
    echo "[RUNNER] ✓ Cloud Build Proof:"
    jq '.' "$LATEST_SUITE/cloud_build_proof.json" | sed 's/^/  /'
    echo ""
  fi

  # Show verdict
  if [ -f "$LATEST_SUITE/cloud_build_proof.json" ]; then
    VERDICT=$(jq -r '.verdict' "$LATEST_SUITE/cloud_build_proof.json")
    echo "[RUNNER] BUILD STATE VERDICT: $VERDICT"
    echo ""
  fi

  # Show console summary
  if [ -f "$LATEST_SUITE/console_summary.json" ]; then
    echo "[RUNNER] ✓ Console Summary (first test):"
    cat "$LATEST_SUITE/console_summary.json" | head -20 | sed 's/^/  /'
    echo ""
  fi
else
  echo "[RUNNER] ⚠️  No suite artifacts found"
fi

echo "[RUNNER] ✓ Done"
echo ""

exit $E2E_EXIT
