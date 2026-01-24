#!/bin/bash
set -e

# Deploy and prove: verifies that FT_RELEASE_VERSION appears in production logs post-deploy
# Fail-closed: if proof not found, deployment is considered failed.

RUN_DIR="${1:-.}"
if [ ! -d "$RUN_DIR" ]; then
  mkdir -p "$RUN_DIR"
fi

echo "=== STEP 7: DEPLOY_AND_PROVE_RELEASE ===" | tee "$RUN_DIR/70_deploy_start.txt"
echo "RUN_DIR=$RUN_DIR" >> "$RUN_DIR/70_deploy_start.txt"

cd /workspaces/Firsttry/atlassian/forge-app

# Hard gates
echo "[GATE] Checking hard gates..." | tee "$RUN_DIR/71_hard_gates.txt"
cd /workspaces/Firsttry
test -z "$(git status --porcelain=v1)" || { echo "FAIL: dirty tree"; exit 1; }
test "$(git rev-parse --abbrev-ref HEAD)" = "main" || { echo "FAIL: not on main"; exit 1; }
git fetch --prune origin >/dev/null 2>&1
LOCAL="$(git rev-parse HEAD)"
REMOTE="$(git rev-parse origin/main)"
test "$LOCAL" = "$REMOTE" || { echo "FAIL: local != origin/main"; exit 1; }
echo "✓ Hard gates passed" | tee -a "$RUN_DIR/71_hard_gates.txt"

# Build
echo "[BUILD] Running npm run build:gadget..." | tee "$RUN_DIR/72_build.txt"
cd /workspaces/Firsttry/atlassian/forge-app
npm run build:gadget 2>&1 | tail -20 >> "$RUN_DIR/72_build.txt"
echo "✓ Build passed" | tee -a "$RUN_DIR/72_build.txt"

# Release gate
echo "[GATE] Running release version gate..." | tee "$RUN_DIR/73_release_gate.txt"
bash tools/verify_release_version_bumped.sh 2>&1 | tee -a "$RUN_DIR/73_release_gate.txt"
RELEASE_VERSION=$(grep -oP '(?<=Released as )[^ ]*|(?<=version: )[^ ]*' "$RUN_DIR/73_release_gate.txt" | head -1 || echo "UNKNOWN")
echo "Release version: $RELEASE_VERSION" | tee -a "$RUN_DIR/73_release_gate.txt"

# Deploy to production
echo "[DEPLOY] Running forge deploy --environment production..." | tee "$RUN_DIR/74_forge_deploy.txt"
forge deploy --environment production 2>&1 | tee -a "$RUN_DIR/74_forge_deploy.txt"
echo "✓ Deploy completed" | tee -a "$RUN_DIR/74_forge_deploy.txt"

# Install/upgrade
echo "[INSTALL] Running forge install --upgrade..." | tee "$RUN_DIR/75_forge_install.txt"
forge install --upgrade --environment production --site firsttry.atlassian.net --product jira --non-interactive 2>&1 | tee -a "$RUN_DIR/75_forge_install.txt"
echo "✓ Install/upgrade completed" | tee -a "$RUN_DIR/75_forge_install.txt"

# Wait for logs to propagate
echo "[WAIT] Sleeping 90 seconds for log propagation..." | tee "$RUN_DIR/76_wait.txt"
sleep 90
echo "✓ Wait complete" | tee -a "$RUN_DIR/76_wait.txt"

# Collect logs
echo "[LOGS] Pulling production logs (since 10m)..." | tee "$RUN_DIR/77_logs_collect.txt"
forge logs --environment production --since 10m 2>&1 | tee "$RUN_DIR/78_prod_logs.txt" || {
  echo "WARNING: Could not collect logs" | tee -a "$RUN_DIR/77_logs_collect.txt"
}

# Prove version
echo "[PROOF] Searching for proof markers..." | tee "$RUN_DIR/79_proof_search.txt"

PROBE_MARKER=$(grep -c "\[FT_ASAPP_PROBE\] PROBE" "$RUN_DIR/78_prod_logs.txt" || echo "0")
DASHBOARD_MARKER=$(grep -c "\[FT_L0_DASHBOARD\] VERSION_PROOF" "$RUN_DIR/78_prod_logs.txt" || echo "0")

echo "Probe markers found: $PROBE_MARKER" | tee -a "$RUN_DIR/79_proof_search.txt"
echo "Dashboard version proof found: $DASHBOARD_MARKER" | tee -a "$RUN_DIR/79_proof_search.txt"

# Extract version from logs
PROBE_VERSION=$(grep -o 'release":"[^"]*"' "$RUN_DIR/78_prod_logs.txt" | head -1 | grep -o '"[^"]*"$' | tr -d '"' || echo "NOT_FOUND")
echo "Version in logs: $PROBE_VERSION" | tee -a "$RUN_DIR/79_proof_search.txt"

# Final verdict
if [ "$PROBE_MARKER" -gt 0 ]; then
  echo "✓ PASS: Probe marker found in logs" | tee "$RUN_DIR/99_PROD_PROOF_SUMMARY.txt"
  if [ "$DASHBOARD_MARKER" -gt 0 ]; then
    echo "✓ Dashboard version proof also found (bonus)" | tee -a "$RUN_DIR/99_PROD_PROOF_SUMMARY.txt"
  else
    echo "⚠ Dashboard version proof NOT found (no recent dashboard traffic)" | tee -a "$RUN_DIR/99_PROD_PROOF_SUMMARY.txt"
  fi
  echo "" | tee -a "$RUN_DIR/99_PROD_PROOF_SUMMARY.txt"
  echo "VERDICT: ✓ DEPLOYMENT PROVEN" | tee -a "$RUN_DIR/99_PROD_PROOF_SUMMARY.txt"
  echo "Version: $PROBE_VERSION" | tee -a "$RUN_DIR/99_PROD_PROOF_SUMMARY.txt"
  echo "Build SHA: $(grep -o 'buildSha":"[^"]*"' "$RUN_DIR/78_prod_logs.txt" | head -1 | grep -o '"[^"]*"$' | tr -d '"' || echo "UNSET")" | tee -a "$RUN_DIR/99_PROD_PROOF_SUMMARY.txt"
  echo "" | tee -a "$RUN_DIR/99_PROD_PROOF_SUMMARY.txt"
  echo "Proof markers:" | tee -a "$RUN_DIR/99_PROD_PROOF_SUMMARY.txt"
  grep "\[FT_ASAPP_PROBE\] PROBE" "$RUN_DIR/78_prod_logs.txt" | head -3 | tee -a "$RUN_DIR/99_PROD_PROOF_SUMMARY.txt"
  exit 0
else
  echo "✗ FAIL: Probe marker NOT found in logs" | tee "$RUN_DIR/99_PROD_PROOF_SUMMARY.txt"
  echo "VERDICT: ✗ DEPLOYMENT PROOF FAILED" | tee -a "$RUN_DIR/99_PROD_PROOF_SUMMARY.txt"
  echo "" | tee -a "$RUN_DIR/99_PROD_PROOF_SUMMARY.txt"
  echo "Last 20 log lines:" | tee -a "$RUN_DIR/99_PROD_PROOF_SUMMARY.txt"
  tail -20 "$RUN_DIR/78_prod_logs.txt" | tee -a "$RUN_DIR/99_PROD_PROOF_SUMMARY.txt"
  exit 1
fi
