#!/bin/bash
# Deterministic Production Verification + Deployment + Upgrade
# This script verifies the UI status fix is live, then deploys and upgrades.
# Fail-closed: hard gates block forward progress. No secrets printed.

set -euo pipefail

# Create evidence directory
RUN_DIR="/tmp/ft_verify_deploy_upgrade_prod_$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$RUN_DIR"
echo "Evidence directory: $RUN_DIR"

# Export RUN_DIR for child processes (e.g., Playwright script)
export RUN_DIR

# Helper: Exit with FAIL message
fail() {
  echo "FAIL: $*" >&2
  exit 1
}

# ============================================================================
# STEP 1: Git State
# ============================================================================
echo "[STEP 1] Capturing git state..."
git rev-parse HEAD > "$RUN_DIR/01_git_head.txt"
git status --porcelain=v1 > "$RUN_DIR/02_git_status_porcelain.txt"

if [ -s "$RUN_DIR/02_git_status_porcelain.txt" ]; then
  tracked_changes=$(grep -v "^??" "$RUN_DIR/02_git_status_porcelain.txt" || true)
  if [ -n "$tracked_changes" ]; then
    fail "Tracked changes in working tree (untracked files OK). Commit or stash before proceeding."
  fi
fi
echo "Git state: OK (HEAD=$(cat "$RUN_DIR/01_git_head.txt"))"

# ============================================================================
# STEP 2: Secret Scan (repo only)
# ============================================================================
echo "[STEP 2] Scanning repo for potential secrets..."
# Look for patterns that indicate ACTUAL secrets (not documentation/tests)
# Real secrets typically have high entropy: 32+ alphanumeric chars
(cd /workspaces/Firsttry/atlassian/forge-app && \
 rg -n "ATATT[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9_\-]{30,}" . > "$RUN_DIR/03_secret_scan_repo.txt" || true)

# Additional check: FORGE_API_TOKEN= with actual value (not placeholder)
rg -n "FORGE_API_TOKEN\s*=\s*['\"]?[A-Za-z0-9]{30,}" /workspaces/Firsttry/atlassian/forge-app >> "$RUN_DIR/03_secret_scan_repo.txt" 2>/dev/null || true

# If any high-entropy matches found, fail
if [ -s "$RUN_DIR/03_secret_scan_repo.txt" ]; then
  MATCH_COUNT=$(wc -l < "$RUN_DIR/03_secret_scan_repo.txt")
  echo "Found $MATCH_COUNT potential secret patterns:"
  head -5 "$RUN_DIR/03_secret_scan_repo.txt"
  fail "POTENTIAL SECRETS IN REPO: Do not commit."
fi
echo "Secret scan: OK (no high-entropy token patterns found)"

# ============================================================================
# STEP 3: Require env vars (do NOT echo token)
# ============================================================================
echo "[STEP 3] Checking required environment variables..."
if [ -z "${FORGE_EMAIL:-}" ]; then
  fail "FORGE_EMAIL not set"
fi
if [ -z "${FORGE_API_TOKEN:-}" ]; then
  fail "FORGE_API_TOKEN not set"
fi

TOKEN_LEN=${#FORGE_API_TOKEN}
echo "FORGE_EMAIL present: $FORGE_EMAIL"
echo "FORGE_API_TOKEN present (length=$TOKEN_LEN)"

# ============================================================================
# STEP 4: Forge Auth (use existing if available, attempt login otherwise)
# ============================================================================
echo "[STEP 4] Checking Forge authentication..."

# Check if already authenticated
if forge whoami > "$RUN_DIR/11_forge_whoami_check.txt" 2>&1; then
  echo "Forge auth: OK (already authenticated: $(cat "$RUN_DIR/11_forge_whoami_check.txt" | head -1))"
else
  echo "Not authenticated. Attempting login..."
  forge login --email "$FORGE_EMAIL" --token "$FORGE_API_TOKEN" --non-interactive > "$RUN_DIR/10_forge_login.txt" 2>&1 || {
    fail "Forge login failed. Check email and token. Details: $(cat "$RUN_DIR/10_forge_login.txt")"
  }
  forge whoami > "$RUN_DIR/11_forge_whoami.txt" 2>&1 || {
    fail "forge whoami failed after login"
  }
  echo "Forge auth: OK ($(head -1 "$RUN_DIR/11_forge_whoami.txt"))"
fi

# ============================================================================
# STEP 5: Collect Pre-Deployment State
# ============================================================================
echo "[STEP 5] Collecting production state (before deploy)..."
forge deploy list -e production > "$RUN_DIR/12_deploy_list_before.txt" 2>&1 || {
  fail "forge deploy list failed"
}
forge install list > "$RUN_DIR/13_install_list_before.txt" 2>&1 || {
  fail "forge install list failed"
}
echo "Pre-deployment state: OK"

# ============================================================================
# STEP 6: Local Build Gates
# ============================================================================
echo "[STEP 6] Running local build gates..."
cd /workspaces/Firsttry/atlassian/forge-app

npm ci > "$RUN_DIR/20_npm_ci.txt" 2>&1 || {
  fail "npm ci failed"
}
echo "  npm ci: OK"

npm test > "$RUN_DIR/21_npm_test.txt" 2>&1 || {
  fail "npm test failed"
}
echo "  npm test: OK"

npm run build:gadget > "$RUN_DIR/22_build_gadget.txt" 2>&1 || {
  fail "npm run build:gadget failed"
}
echo "  npm run build:gadget: OK"

# Proof gate
if [ -f "audit/proof_backbone_l0.sh" ]; then
  bash audit/proof_backbone_l0.sh > "$RUN_DIR/23_proof_gate.txt" 2>&1 || {
    fail "Proof gate (audit/proof_backbone_l0.sh) failed"
  }
elif [ -f "tools/proof_backbone_l0.sh" ]; then
  bash tools/proof_backbone_l0.sh > "$RUN_DIR/23_proof_gate.txt" 2>&1 || {
    fail "Proof gate (tools/proof_backbone_l0.sh) failed"
  }
else
  fail "No known proof gate script found"
fi
echo "  Proof gate: OK"

# ============================================================================
# STEP 7: Production Log Check (wire proof presence - informational)
# ============================================================================
echo "[STEP 7] Checking production logs for backend wire proof..."
forge logs -e production --since 2h > "$RUN_DIR/30_prod_logs_2h.txt" 2>&1 || {
  fail "forge logs failed"
}

WIRE_PROOF_COUNT=$(grep -c "FT_DASH_V1_WIRE_PROOF" "$RUN_DIR/30_prod_logs_2h.txt" || true)
echo "$WIRE_PROOF_COUNT" > "$RUN_DIR/31_wire_proof_count.txt"
echo "  Backend wire proof markers found: $WIRE_PROOF_COUNT (informational only)"

# ============================================================================
# STEP 8: UI Smoke Proof (HARD GATE: status must not be undefined)
# ============================================================================
echo "[STEP 8] Running UI smoke proof (checking status is not undefined)..."

if [ -z "${JIRA_DASHBOARD_URL:-}" ]; then
  fail "JIRA_DASHBOARD_URL env var not set. Required for UI smoke proof."
fi
if [ -z "${STORAGE_STATE:-}" ]; then
  fail "STORAGE_STATE env var not set. Required for UI smoke proof."
fi

node e2e/scripts/ft_dashboard_smoke_proof.mjs > "$RUN_DIR/40_ui_smoke_proof.txt" 2>&1 || {
  fail "UI smoke proof script failed or hard-gate failed"
}

# Parse output for hard gates
if grep -q "status=undefined" "$RUN_DIR/40_ui_smoke_proof.txt"; then
  fail "HARD GATE FAILED: status=undefined in UI response"
fi
if ! grep -q "\[UI_FT_GETDASHBOARDSTATE_SUCCESS\] status=" "$RUN_DIR/40_ui_smoke_proof.txt"; then
  fail "HARD GATE FAILED: [UI_FT_GETDASHBOARDSTATE_SUCCESS] status= marker missing"
fi
if ! grep -q "\[UI_RESP_KEYS\]" "$RUN_DIR/40_ui_smoke_proof.txt"; then
  fail "HARD GATE FAILED: [UI_RESP_KEYS] proof marker missing"
fi
if ! grep -q "UI_GIT_SHA=" "$RUN_DIR/40_ui_smoke_proof.txt"; then
  fail "HARD GATE FAILED: UI_GIT_SHA= identity marker missing"
fi
echo "UI smoke proof: OK (all hard gates passed)"

# ============================================================================
# STEP 9: Deploy to Production
# ============================================================================
echo "[STEP 9] Deploying to production..."
forge deploy -e production --non-interactive > "$RUN_DIR/50_forge_deploy_prod.txt" 2>&1 || {
  fail "forge deploy failed"
}
echo "Deploy: OK"

# Verify deployment registered
forge deploy list -e production > "$RUN_DIR/51_deploy_list_after.txt" 2>&1 || {
  fail "forge deploy list (post-deploy) failed"
}
echo "Deployment registered: OK"

# ============================================================================
# STEP 10: Upgrade Jira Installation
# ============================================================================
echo "[STEP 10] Upgrading Jira installation..."
forge install --upgrade -e production -s https://firsttry.atlassian.net -p jira \
  --confirm-scopes --non-interactive > "$RUN_DIR/60_forge_install_upgrade.txt" 2>&1 || {
  fail "forge install --upgrade failed"
}
echo "Upgrade: OK"

# Verify installation state
forge install list > "$RUN_DIR/61_install_list_after.txt" 2>&1 || {
  fail "forge install list (post-upgrade) failed"
}
echo "Installation updated: OK"

# ============================================================================
# STEP 11: Post-Deploy Logs
# ============================================================================
echo "[STEP 11] Collecting post-deploy logs..."
forge logs -e production --since 15m > "$RUN_DIR/70_prod_logs_15m.txt" 2>&1 || {
  fail "forge logs (post-deploy) failed"
}
echo "Post-deploy logs: OK"

# ============================================================================
# STEP 12: Manifest
# ============================================================================
echo "[STEP 12] Creating evidence manifest..."
ls -lah "$RUN_DIR" > "$RUN_DIR/99_manifest.txt"

echo ""
echo "============================================================================"
echo "✅ ALL GATES PASSED - PRODUCTION VERIFICATION + DEPLOYMENT + UPGRADE COMPLETE"
echo "============================================================================"
echo "Evidence directory: $RUN_DIR"
echo ""
echo "Key evidence files:"
echo "  - 01_git_head.txt: Commit hash"
echo "  - 12_deploy_list_before.txt: Pre-deploy state"
echo "  - 21_npm_test.txt: Test results"
echo "  - 22_build_gadget.txt: Build output (7/7 gates)"
echo "  - 23_proof_gate.txt: Backbone L0 verification"
echo "  - 31_wire_proof_count.txt: Backend wire proof markers"
echo "  - 40_ui_smoke_proof.txt: UI status proof (NOT undefined)"
echo "  - 50_forge_deploy_prod.txt: Deployment result"
echo "  - 60_forge_install_upgrade.txt: Upgrade result"
echo "  - 99_manifest.txt: Complete file listing"
echo ""
echo "DONE. Evidence: $RUN_DIR"
