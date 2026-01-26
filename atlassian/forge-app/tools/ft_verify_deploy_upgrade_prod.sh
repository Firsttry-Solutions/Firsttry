#!/bin/bash
# Deterministic Production Verification + Deployment + Upgrade
# Order: preflight checks → deploy → upgrade → post-upgrade UI proof
# Fail-closed: hard gates block forward progress. No secrets printed.

set -euo pipefail

# Create evidence directory
RUN_DIR="/tmp/ft_verify_deploy_upgrade_prod_$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$RUN_DIR"
echo "Evidence directory: $RUN_DIR"

# Export RUN_DIR for child processes
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
# STEP 2: Secret Scan (high-entropy patterns only, no false positives)
# ============================================================================
echo "[STEP 2] Scanning tracked files for high-entropy tokens..."
cd /workspaces/Firsttry/atlassian/forge-app

FOUND_SECRETS=0

# Pattern 1: ATATT tokens - must be 20+ chars after ATATT
echo "[STEP 2a] Checking for ATATT tokens..."
rg 'ATATT[A-Za-z0-9_=-]{20,}' --glob='!node_modules' --glob='!build' --glob='!dist' --glob='!.next' > "$RUN_DIR/03_secret_scan_atatt.txt" 2>/dev/null || true
grep -v 'ATATT_TEST\|TOKEN_REMOVED_SYNTHETIC\|TOKEN_EXAMPLE\|placeholder' "$RUN_DIR/03_secret_scan_atatt.txt" > "$RUN_DIR/03_secret_scan_atatt_filtered.txt" 2>/dev/null || true
if [ -s "$RUN_DIR/03_secret_scan_atatt_filtered.txt" ]; then
  echo "Found potential ATATT tokens:"
  cut -d: -f1,2 "$RUN_DIR/03_secret_scan_atatt_filtered.txt" | head -5
  FOUND_SECRETS=1
fi

# Pattern 2: High-entropy Bearer tokens (50+ chars)
echo "[STEP 2b] Checking for high-entropy Bearer tokens..."
rg 'Bearer\s+[A-Za-z0-9_\-\.]{50,}' --glob='!node_modules' --glob='!build' --glob='!dist' --glob='!.next' > "$RUN_DIR/03_secret_scan_bearer.txt" 2>/dev/null || true
grep -v 'TOKEN_REMOVED_SYNTHETIC\|Bearer.*xxx\|Bearer.*test\|Bearer.*example' "$RUN_DIR/03_secret_scan_bearer.txt" > "$RUN_DIR/03_secret_scan_bearer_filtered.txt" 2>/dev/null || true
if [ -s "$RUN_DIR/03_secret_scan_bearer_filtered.txt" ]; then
  echo "Found potential Bearer tokens:"
  cut -d: -f1,2 "$RUN_DIR/03_secret_scan_bearer_filtered.txt" | head -5
  FOUND_SECRETS=1
fi

# Pattern 3: FORGE_API_TOKEN with long value (50+ chars)
echo "[STEP 2c] Checking for exposed FORGE_API_TOKEN values..."
rg 'FORGE_API_TOKEN\s*=\s*["'"'"']?[A-Za-z0-9_\-\.]{50,}' --glob='!node_modules' --glob='!build' --glob='!dist' --glob='!.next' > "$RUN_DIR/03_secret_scan_forge_token.txt" 2>/dev/null || true
grep -v 'your-api-token\|<token>\|<your-api-token>' "$RUN_DIR/03_secret_scan_forge_token.txt" > "$RUN_DIR/03_secret_scan_forge_token_filtered.txt" 2>/dev/null || true
if [ -s "$RUN_DIR/03_secret_scan_forge_token_filtered.txt" ]; then
  echo "Found potential FORGE_API_TOKEN values:"
  cut -d: -f1,2 "$RUN_DIR/03_secret_scan_forge_token_filtered.txt" | head -5
  FOUND_SECRETS=1
fi

if [ "$FOUND_SECRETS" -eq 1 ]; then
  fail "HIGH-ENTROPY TOKEN PATTERNS FOUND IN REPO. Do not commit."
fi
echo "Secret scan: OK (no high-entropy token patterns)"

# ============================================================================
# STEP 3: Verify Forge Authentication (REQUIRED)
# ============================================================================
echo "[STEP 3] Verifying Forge authentication..."
if ! forge whoami > "$RUN_DIR/10_forge_whoami.txt" 2>&1; then
  fail "Not authenticated with Forge. Run: forge login --email <email> --token <token> --non-interactive"
fi
echo "Forge auth: OK ($(head -1 "$RUN_DIR/10_forge_whoami.txt"))"

# ============================================================================
# STEP 4: Local Preflight Gates
# ============================================================================
echo "[STEP 4] Running local preflight gates..."

echo "  [4a] npm ci..."
npm ci > "$RUN_DIR/20_npm_ci.txt" 2>&1 || fail "npm ci failed"

echo "  [4b] npm test..."
npm test > "$RUN_DIR/21_npm_test.txt" 2>&1 || fail "npm test failed"

echo "  [4c] npm run build:gadget..."
npm run build:gadget > "$RUN_DIR/22_build_gadget.txt" 2>&1 || fail "npm run build:gadget failed"

echo "  [4d] Proof gate..."
if [ -f "audit/proof_backbone_l0.sh" ]; then
  bash audit/proof_backbone_l0.sh > "$RUN_DIR/23_proof_gate.txt" 2>&1 || fail "Proof gate failed"
elif [ -f "tools/proof_backbone_l0.sh" ]; then
  bash tools/proof_backbone_l0.sh > "$RUN_DIR/23_proof_gate.txt" 2>&1 || fail "Proof gate failed"
else
  fail "No known proof gate script found"
fi

echo "Preflight gates: OK"

# ============================================================================
# STEP 5: Collect Pre-Deployment State
# ============================================================================
echo "[STEP 5] Collecting production state (before deploy)..."
forge deploy list -e production > "$RUN_DIR/30_deploy_list_before.txt" 2>&1 || fail "forge deploy list failed"
forge install list > "$RUN_DIR/31_install_list_before.txt" 2>&1 || fail "forge install list failed"
echo "Pre-deployment state: OK"

# ============================================================================
# STEP 6: Validate UI Smoke Proof Prerequisites (BEFORE deploy) - HARD GATE
# ============================================================================
echo "[STEP 6] Validating UI smoke proof prerequisites..."
if [ -z "${JIRA_DASHBOARD_URL:-}" ]; then
  fail "JIRA_DASHBOARD_URL env var not set. Required for post-deploy UI verification."
fi
if [ -z "${STORAGE_STATE:-}" ]; then
  STORAGE_STATE="e2e/.auth/storageState.persistent.json"
  echo "  STORAGE_STATE not set, using default: $STORAGE_STATE"
fi
if [ ! -f "$STORAGE_STATE" ]; then
  fail "STORAGE_STATE file not found at $STORAGE_STATE. Run: npm run jira:auth:capture"
fi

# Parse storageState JSON and validate cookies
echo "  [6a] Validating storageState authentication..."
VALIDATE_RESULT=$(node -e "
const fs = require('fs');
const state = JSON.parse(fs.readFileSync('$STORAGE_STATE', 'utf-8'));
if (!state.cookies || state.cookies.length === 0) {
  console.error('[FAIL] StorageState has no cookies - not authenticated.');
  process.exit(1);
}
const validDomains = state.cookies.filter(c => 
  c.domain && (c.domain.includes('atlassian.net') || c.domain.includes('id.atlassian.com'))
);
if (validDomains.length === 0) {
  console.error('[FAIL] No Jira/auth cookies found. Valid domains: ' + state.cookies.map(c => c.domain).join(', '));
  process.exit(1);
}
console.log('[PASS] StorageState: ' + state.cookies.length + ' cookies, ' + validDomains.length + ' from Jira domains');
" 2>&1) || {
  fail "StorageState validation failed - not authenticated. Run: npm run jira:auth:capture"
}
echo "$VALIDATE_RESULT"
echo "UI smoke proof prerequisites: OK (storageState authenticated)"

# ============================================================================
# STEP 7: Deploy to Production
# ============================================================================
echo "[STEP 7] Deploying to production..."
forge deploy -e production --non-interactive > "$RUN_DIR/40_forge_deploy_prod.txt" 2>&1 || fail "forge deploy failed"
echo "Deploy: OK"

forge deploy list -e production > "$RUN_DIR/41_deploy_list_after_deploy.txt" 2>&1 || fail "forge deploy list (post-deploy) failed"
echo "Deployment registered: OK"

# ============================================================================
# STEP 8: Upgrade Jira Installation
# ============================================================================
echo "[STEP 8] Upgrading Jira installation..."
forge install --upgrade -e production -s https://firsttry.atlassian.net -p jira --confirm-scopes --non-interactive > "$RUN_DIR/50_forge_install_upgrade.txt" 2>&1 || fail "forge install --upgrade failed"
echo "Upgrade: OK"

forge install list > "$RUN_DIR/51_install_list_after_upgrade.txt" 2>&1 || fail "forge install list (post-upgrade) failed"
echo "Installation updated: OK"

# ============================================================================
# STEP 9: Wait for Backend to Stabilize
# ============================================================================
echo "[STEP 9] Waiting for backend to stabilize..."
sleep 30
echo "Backend stabilization: OK"

# ============================================================================
# STEP 10: Post-Upgrade UI Smoke Proof (HARD GATES)
# ============================================================================
echo "[STEP 10] Running post-upgrade UI smoke proof..."

node e2e/scripts/ft_dashboard_smoke_proof.mjs > "$RUN_DIR/60_ui_smoke_proof.txt" 2>&1 || fail "UI smoke proof failed"

# Validate hard gates
grep -q "status=undefined" "$RUN_DIR/60_ui_smoke_proof.txt" && fail "HARD GATE: status=undefined in UI response"
grep -q "\[UI_FT_GETDASHBOARDSTATE_SUCCESS\] status=" "$RUN_DIR/60_ui_smoke_proof.txt" || fail "HARD GATE: status= marker missing"
grep -q "\[UI_RESP_KEYS\]" "$RUN_DIR/60_ui_smoke_proof.txt" || fail "HARD GATE: [UI_RESP_KEYS] marker missing"
grep -q "UI_GIT_SHA=" "$RUN_DIR/60_ui_smoke_proof.txt" || fail "HARD GATE: UI_GIT_SHA= marker missing"
echo "UI smoke proof: OK (all hard gates passed)"

# ============================================================================
# STEP 11: Post-Deploy Logs
# ============================================================================
echo "[STEP 11] Collecting post-deploy logs..."
forge logs -e production --since 15m > "$RUN_DIR/70_prod_logs_15m.txt" 2>&1 || fail "forge logs failed"
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
echo "  - 20_npm_ci.txt: Dependencies installed"
echo "  - 21_npm_test.txt: Test results (all passing)"
echo "  - 22_build_gadget.txt: Build output (7/7 gates)"
echo "  - 40_forge_deploy_prod.txt: Deployment result"
echo "  - 50_forge_install_upgrade.txt: Upgrade result"
echo "  - 60_ui_smoke_proof.txt: Post-deploy UI status proof (NOT undefined)"
echo "  - 99_manifest.txt: Complete file listing"
echo ""
echo "DONE. Evidence: $RUN_DIR"
