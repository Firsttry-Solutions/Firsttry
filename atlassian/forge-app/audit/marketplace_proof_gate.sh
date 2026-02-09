#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# MARKETPLACE PROOF GATE (Canonical Single-Command Proof)
# ==============================================================================
# Purpose: Deterministic marketplace proof without manual authentication
# 
# This script runs the complete verification chain:
# 1. reviewer_ready_gate.sh (code quality + freeze lock checks)
# 2. prod_dashboard_rulec_proof.spec.ts (auth wall detection + artifacts)
# 3. ruleC_secret_audit_v3.sh (secret scanning + classification)
# 
# Exit 0 on success (MARKETPLACE_PROOF_PASS), non-zero on any failure.
# ==============================================================================

RUN_DIR="/tmp/ft_marketplace_proof_$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$RUN_DIR"
echo "RUN_DIR=$RUN_DIR" | tee "$RUN_DIR/00_run_dir.txt"

echo "================================================================================"
echo "MARKETPLACE PROOF GATE — STARTING"
echo "RUN_DIR: $RUN_DIR"
echo "================================================================================"

# ------------------------------------------------------------------------------
# STEP 1: Reviewer Ready Gate (code quality + freeze lock)
# ------------------------------------------------------------------------------
echo ""
echo "[1/3] Running reviewer_ready_gate.sh..."
cd /workspaces/Firsttry/atlassian/forge-app
bash audit/reviewer_ready_gate.sh 2>&1 | tee "$RUN_DIR/10_reviewer_ready_gate.txt"
echo "✅ Reviewer ready gate PASS"

# ------------------------------------------------------------------------------
# STEP 2: Run deterministic Rule-C proof spec (no auth required)
# ------------------------------------------------------------------------------
echo ""
echo "[2/3] Running prod_dashboard_rulec_proof.spec.ts..."
cd /workspaces/Firsttry
JIRA_DASHBOARD_URL="https://firsttry.atlassian.net/jira/dashboards/10102" \
npx playwright test e2e/tests/prod_dashboard_rulec_proof.spec.ts --timeout=240000 \
2>&1 | tee "$RUN_DIR/20_rulec_proof.txt"
echo "✅ Rule-C proof spec PASS"

# ------------------------------------------------------------------------------
# STEP 3: Select newest bundle and run secret audit
# ------------------------------------------------------------------------------
echo ""
echo "[3/3] Running ruleC_secret_audit_v3.sh..."
BUNDLE="$(ls -1dt /tmp/prod_dashboard_rulec_proof_* 2>/dev/null | head -n1)"
if [ -z "$BUNDLE" ] || [ ! -d "$BUNDLE" ]; then
  echo "STOP_BUNDLE_NOT_FOUND" | tee "$RUN_DIR/STOP_BUNDLE_NOT_FOUND.txt"
  exit 1
fi
echo "BUNDLE=$BUNDLE" | tee "$RUN_DIR/30_bundle_selected.txt"

cd /workspaces/Firsttry/atlassian/forge-app
BUNDLE_OVERRIDE="$BUNDLE" bash audit/ruleC_secret_audit_v3.sh \
2>&1 | tee "$RUN_DIR/40_rulec_audit.txt"
echo "✅ Rule-C secret audit PASS"

# ------------------------------------------------------------------------------
# SUCCESS: All gates passed
# ------------------------------------------------------------------------------
echo ""
echo "================================================================================"
echo "MARKETPLACE_PROOF_PASS"
echo "================================================================================"
echo "MARKETPLACE_PROOF_PASS" | tee "$RUN_DIR/90_MARKETPLACE_PROOF_PASS.txt"

echo ""
echo "RUN_DIR contents:"
ls -Rlah "$RUN_DIR" | tee "$RUN_DIR/99_ls.txt"

echo ""
echo "✅ FirstTry marketplace proof complete - ready for submission"
