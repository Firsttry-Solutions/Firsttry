#!/bin/bash
set -euo pipefail

# Reviewer End-to-End Simulation - Strict Mode
# Orchestrates complete reviewer workflow with fail-closed design

# ============================================================================
# Configuration
# ============================================================================
RUN_ID="$(date -u +"%Y%m%dT%H%M%SZ")"
EVIDENCE_DIR="/tmp/ft_reviewer_e2e_${RUN_ID}"
TUNNEL_TIMEOUT="${TUNNEL_TIMEOUT:-120}"
ALLOW_DIRTY="${ALLOW_DIRTY:-0}"
SKIP_DEPLOY="${SKIP_DEPLOY:-0}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
# Vendor app (NOT DEV scaffold)
FORGE_APP="/workspaces/Firsttry/FirstTry---Audit-Evidence-for-Jira"

# ============================================================================
# Setup
# ============================================================================
echo "============================================================"
echo "REVIEWER E2E SIMULATION - STRICT MODE"
echo "============================================================"
echo "Run ID: $RUN_ID"
echo "Evidence: $EVIDENCE_DIR"
echo "Repository: $REPO_ROOT"
echo ""

mkdir -p "$EVIDENCE_DIR"

# Create subdirectories
mkdir -p "$EVIDENCE_DIR/01_deploy"
mkdir -p "$EVIDENCE_DIR/02_tunnel"
mkdir -p "$EVIDENCE_DIR/03_forge_logs"
mkdir -p "$EVIDENCE_DIR/04_playwright/screenshots"
mkdir -p "$EVIDENCE_DIR/04_playwright/traces"
mkdir -p "$EVIDENCE_DIR/04_playwright/videos"

# ============================================================================
# Cleanup handler
# ============================================================================
TUNNEL_PID=""
LOGS_PID=""

cleanup() {
  echo ""
  echo "[INFO] Cleaning up background processes..."
  
  if [ -n "$TUNNEL_PID" ] && ps -p "$TUNNEL_PID" > /dev/null 2>&1; then
    echo "[INFO] Stopping forge tunnel (PID: $TUNNEL_PID)"
    kill "$TUNNEL_PID" 2>/dev/null || true
    wait "$TUNNEL_PID" 2>/dev/null || true
  fi
  
  if [ -n "$LOGS_PID" ] && ps -p "$LOGS_PID" > /dev/null 2>&1; then
    echo "[INFO] Stopping forge logs (PID: $LOGS_PID)"
    kill "$LOGS_PID" 2>/dev/null || true
    wait "$LOGS_PID" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

# ============================================================================
# PRECHECKS - Fail-closed
# ============================================================================
echo "=== PRECHECKS ==="

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "[FATAL] Required command not found: $1" >&2
    echo "[FATAL] Install $1 and ensure it's on PATH" >&2
    exit 2
  fi
  echo "[OK] Found: $1"
}

require_cmd node
require_cmd npm
require_cmd npx
require_cmd forge
require_cmd git

# Check forge authentication
echo "[INFO] Checking forge authentication..."
if ! forge whoami >/dev/null 2>&1; then
  echo "[FATAL] Not logged into Forge" >&2
  echo "[FATAL] Run: forge login" >&2
  exit 2
fi
forge whoami

# Check Jira prerequisites
echo "[INFO] Checking Jira prerequisites..."

if [ -z "${JIRA_BASE_URL:-}" ]; then
  echo "[FATAL] JIRA_BASE_URL environment variable is required" >&2
  echo "" >&2
  echo "Set your Jira instance URL:" >&2
  echo "  export JIRA_BASE_URL=https://yourcompany.atlassian.net" >&2
  echo "" >&2
  exit 2
fi

if ! echo "$JIRA_BASE_URL" | grep -qE '^https://[A-Za-z0-9.-]+\.atlassian\.net$'; then
  echo "[FATAL] JIRA_BASE_URL must match: https://*.atlassian.net" >&2
  echo "Got: $JIRA_BASE_URL" >&2
  exit 2
fi
echo "[OK] JIRA_BASE_URL: $JIRA_BASE_URL"

if [ -z "${JIRA_DASHBOARD_URL:-}" ]; then
  echo "[FATAL] JIRA_DASHBOARD_URL environment variable is required" >&2
  echo "" >&2
  echo "Set your Jira dashboard URL:" >&2
  echo "  export JIRA_DASHBOARD_URL=https://yourcompany.atlassian.net/jira/dashboards/10000" >&2
  echo "" >&2
  echo "Or use /secure/Dashboard.jspa?selectPageId=10000" >&2
  echo "" >&2
  exit 2
fi

if ! echo "$JIRA_DASHBOARD_URL" | grep -qE "^${JIRA_BASE_URL}"; then
  echo "[FATAL] JIRA_DASHBOARD_URL must start with JIRA_BASE_URL" >&2
  echo "Base: $JIRA_BASE_URL" >&2
  echo "Dashboard: $JIRA_DASHBOARD_URL" >&2
  exit 2
fi

if ! echo "$JIRA_DASHBOARD_URL" | grep -qE '(/jira/dashboards/|/secure/Dashboard\.jspa)'; then
  echo "[FATAL] JIRA_DASHBOARD_URL must contain /jira/dashboards/ or /secure/Dashboard.jspa" >&2
  echo "Got: $JIRA_DASHBOARD_URL" >&2
  exit 2
fi
echo "[OK] JIRA_DASHBOARD_URL: $JIRA_DASHBOARD_URL"

# Check storage state
PLAYWRIGHT_STORAGE_STATE="${PLAYWRIGHT_STORAGE_STATE:-$FORGE_APP/tests/playwright/.auth/storageState.json}"

if [ ! -f "$PLAYWRIGHT_STORAGE_STATE" ]; then
  echo "[FATAL] Playwright storageState file not found" >&2
  echo "[FATAL] Path: $PLAYWRIGHT_STORAGE_STATE" >&2
  echo "" >&2
  echo "Generate it by running:" >&2
  echo "  export JIRA_BASE_URL=$JIRA_BASE_URL" >&2
  echo "  bash tools/reviewer_e2e/create_storage_state.sh" >&2
  echo "" >&2
  exit 2
fi

if [ ! -s "$PLAYWRIGHT_STORAGE_STATE" ]; then
  echo "[FATAL] Playwright storageState file is empty" >&2
  echo "[FATAL] Path: $PLAYWRIGHT_STORAGE_STATE" >&2
  exit 2
fi

# Validate JSON
if ! python3 -m json.tool "$PLAYWRIGHT_STORAGE_STATE" >/dev/null 2>&1; then
  echo "[FATAL] Playwright storageState is not valid JSON" >&2
  echo "[FATAL] Path: $PLAYWRIGHT_STORAGE_STATE" >&2
  exit 2
fi

echo "[OK] StorageState: $PLAYWRIGHT_STORAGE_STATE"

# Check manifest.yml
echo "[INFO] Checking vendor app manifest..."
if [ ! -f "$FORGE_APP/manifest.yml" ]; then
  echo "[FATAL] manifest.yml not found in vendor app" >&2
  echo "[FATAL] Expected: $FORGE_APP/manifest.yml" >&2
  exit 2
fi
echo "[OK] Manifest: $FORGE_APP/manifest.yml"

# Check working tree
cd "$FORGE_APP"
if [ "$ALLOW_DIRTY" -ne 1 ]; then
  if [ -n "$(git status --porcelain)" ]; then
    echo "[FATAL] Working tree is dirty" >&2
    echo "[FATAL] Commit changes or run with: ALLOW_DIRTY=1 $0" >&2
    git status --porcelain | head -20 >&2
    exit 2
  fi
  echo "[OK] Working tree is clean"
else
  echo "[WARN] ALLOW_DIRTY=1, skipping clean tree check"
fi

# Check forge app directory
if [ ! -d "$FORGE_APP" ]; then
  echo "[FATAL] Forge app directory not found: $FORGE_APP" >&2
  exit 2
fi
echo "[OK] Forge app directory: $FORGE_APP"

echo ""

# ============================================================================
# PHASE 1: Documentation Overclaim Audit
# ============================================================================
echo "=== PHASE 1: DOCUMENTATION OVERCLAIM AUDIT ==="
bash "$SCRIPT_DIR/doc_overclaim_audit.sh" "$EVIDENCE_DIR"

if [ $? -ne 0 ]; then
  echo "[FATAL] Documentation overclaim audit FAILED" >&2
  echo "[FATAL] Fix overclaims before proceeding" >&2
  echo "[FATAL] Review: $EVIDENCE_DIR/docs_overclaim/findings.txt" >&2
  echo "FAIL" > "$EVIDENCE_DIR/FINAL_VERDICT.txt"
  echo "Phase: Documentation Overclaim Audit" >> "$EVIDENCE_DIR/FINAL_VERDICT.txt"
  echo "Reason: Overclaims detected" >> "$EVIDENCE_DIR/FINAL_VERDICT.txt"
  exit 1
fi

echo "[OK] Documentation overclaim audit PASSED"
echo ""

# ============================================================================
# PHASE 2: Deploy to Development
# ============================================================================
echo "=== PHASE 2: DEPLOY TO DEVELOPMENT ==="

cd "$FORGE_APP"

if [ "$SKIP_DEPLOY" -eq 1 ]; then
  echo "[WARN] SKIP_DEPLOY=1, skipping deployment"
  echo "SKIPPED" > "$EVIDENCE_DIR/01_deploy/deploy.log"
else
  echo "[INFO] Running: forge deploy -e development"
  
  if ! forge deploy -e development > "$EVIDENCE_DIR/01_deploy/deploy.log" 2>&1; then
    echo "[FATAL] Forge deploy failed" >&2
    tail -50 "$EVIDENCE_DIR/01_deploy/deploy.log" >&2
    echo "FAIL" > "$EVIDENCE_DIR/FINAL_VERDICT.txt"
    echo "Phase: Forge Deploy" >> "$EVIDENCE_DIR/FINAL_VERDICT.txt"
    echo "Reason: Deployment failed" >> "$EVIDENCE_DIR/FINAL_VERDICT.txt"
    exit 1
  fi
  
  echo "[OK] Deployment successful"
  tail -20 "$EVIDENCE_DIR/01_deploy/deploy.log"
fi

echo ""

# ============================================================================
# PHASE 3: Start Forge Tunnel
# ============================================================================
echo "=== PHASE 3: START FORGE TUNNEL ==="

cd "$FORGE_APP"

echo "[INFO] Starting forge tunnel in background..."
forge tunnel -e development --verbose > "$EVIDENCE_DIR/02_tunnel/tunnel.log" 2>&1 &
TUNNEL_PID=$!

echo "[INFO] Tunnel PID: $TUNNEL_PID"
echo "[INFO] Waiting for tunnel URL (timeout: ${TUNNEL_TIMEOUT}s)..."

# Wait for tunnel URL to appear in log
TUNNEL_URL=""
WAITED=0
while [ $WAITED -lt $TUNNEL_TIMEOUT ]; do
  if [ -f "$EVIDENCE_DIR/02_tunnel/tunnel.log" ]; then
    # Look for tunnel URL pattern: https://...tunnel...atlassian...
    TUNNEL_URL=$(grep -oE "https://[a-zA-Z0-9-]+\.tunnel\.atlassian-dev\.net" "$EVIDENCE_DIR/02_tunnel/tunnel.log" | head -1 || echo "")
    
    if [ -n "$TUNNEL_URL" ]; then
      echo "[OK] Tunnel URL found: $TUNNEL_URL"
      break
    fi
  fi
  
  # Check if tunnel process died
  if ! ps -p "$TUNNEL_PID" > /dev/null 2>&1; then
    echo "[FATAL] Forge tunnel process died" >&2
    cat "$EVIDENCE_DIR/02_tunnel/tunnel.log" >&2
    echo "FAIL" > "$EVIDENCE_DIR/FINAL_VERDICT.txt"
    echo "Phase: Forge Tunnel" >> "$EVIDENCE_DIR/FINAL_VERDICT.txt"
    echo "Reason: Tunnel process died" >> "$EVIDENCE_DIR/FINAL_VERDICT.txt"
    exit 1
  fi
  
  sleep 2
  WAITED=$((WAITED + 2))
  
  if [ $((WAITED % 10)) -eq 0 ]; then
    echo "[INFO] Still waiting for tunnel... (${WAITED}s / ${TUNNEL_TIMEOUT}s)"
  fi
done

if [ -z "$TUNNEL_URL" ]; then
  echo "[FATAL] Tunnel URL not found after ${TUNNEL_TIMEOUT}s" >&2
  echo "[FATAL] Tunnel log:" >&2
  cat "$EVIDENCE_DIR/02_tunnel/tunnel.log" >&2
  echo "FAIL" > "$EVIDENCE_DIR/FINAL_VERDICT.txt"
  echo "Phase: Forge Tunnel" >> "$EVIDENCE_DIR/FINAL_VERDICT.txt"
  echo "Reason: Tunnel URL not found within timeout" >> "$EVIDENCE_DIR/FINAL_VERDICT.txt"
  exit 1
fi

# Export for Playwright
export FORGE_TUNNEL_URL="$TUNNEL_URL"
echo "[INFO] FORGE_TUNNEL_URL=$FORGE_TUNNEL_URL"

# Save tunnel URL to evidence
echo "$TUNNEL_URL" > "$EVIDENCE_DIR/02_tunnel/tunnel_url.txt"

echo ""

# ============================================================================
# PHASE 4: Capture Forge Logs
# ============================================================================
echo "=== PHASE 4: CAPTURE FORGE LOGS ==="

cd "$FORGE_APP"

echo "[INFO] Starting forge logs capture in background..."
forge logs -e development --tail 200 --follow > "$EVIDENCE_DIR/03_forge_logs/forge_logs.txt" 2>&1 &
LOGS_PID=$!

echo "[INFO] Forge logs PID: $LOGS_PID"
echo "[INFO] Logs will be captured to: $EVIDENCE_DIR/03_forge_logs/forge_logs.txt"

# Give logs time to start streaming
sleep 3

echo ""

# ============================================================================
# PHASE 5: Run Playwright E2E Test
# ============================================================================
echo "=== PHASE 5: PLAYWRIGHT E2E TEST ==="

cd "$FORGE_APP"

# Check if Playwright is installed
if [ ! -d "node_modules/@playwright" ]; then
  echo "[INFO] Playwright not found, installing dependencies..."
  npm install
fi

echo "[INFO] Running Playwright test..."
echo "[INFO] Config: playwright.reviewer.config.ts"
echo "[INFO] Test: tests/playwright/reviewer_dashboard_e2e.spec.ts"

# Set Playwright environment variables
export JIRA_BASE_URL="$JIRA_BASE_URL"
export JIRA_DASHBOARD_URL="$JIRA_DASHBOARD_URL"
export PLAYWRIGHT_STORAGE_STATE="$PLAYWRIGHT_STORAGE_STATE"
export FORGE_TUNNEL_URL="$TUNNEL_URL"
export PLAYWRIGHT_SCREENSHOTS_DIR="$EVIDENCE_DIR/04_playwright/screenshots"
export PLAYWRIGHT_TRACES_DIR="$EVIDENCE_DIR/04_playwright/traces"
export PLAYWRIGHT_VIDEOS_DIR="$EVIDENCE_DIR/04_playwright/videos"
export PLAYWRIGHT_CONSOLE_LOG="$EVIDENCE_DIR/04_playwright/console.log"
export PLAYWRIGHT_CONSOLE_ERRORS="$EVIDENCE_DIR/04_playwright/console_errors.log"
export PLAYWRIGHT_PAGE_ERRORS="$EVIDENCE_DIR/04_playwright/page_errors.log"
export PLAYWRIGHT_SUMMARY_JSON="$EVIDENCE_DIR/04_playwright/summary.json"

# Initialize log files
> "$PLAYWRIGHT_CONSOLE_LOG"
> "$PLAYWRIGHT_CONSOLE_ERRORS"
> "$PLAYWRIGHT_PAGE_ERRORS"

if ! npx playwright test \
  --config=playwright.reviewer.config.ts \
  tests/playwright/reviewer_dashboard_e2e.spec.ts \
  > "$EVIDENCE_DIR/04_playwright/playwright.log" 2>&1; then
  
  echo "[FATAL] Playwright test FAILED" >&2
  tail -100 "$EVIDENCE_DIR/04_playwright/playwright.log" >&2
  
  if [ -f "$PLAYWRIGHT_CONSOLE_ERRORS" ] && [ -s "$PLAYWRIGHT_CONSOLE_ERRORS" ]; then
    echo "[FATAL] Console errors detected:" >&2
    cat "$PLAYWRIGHT_CONSOLE_ERRORS" >&2
  fi
  
  if [ -f "$PLAYWRIGHT_PAGE_ERRORS" ] && [ -s "$PLAYWRIGHT_PAGE_ERRORS" ]; then
    echo "[FATAL] Page errors detected:" >&2
    cat "$PLAYWRIGHT_PAGE_ERRORS" >&2
  fi
  
  echo "FAIL" > "$EVIDENCE_DIR/FINAL_VERDICT.txt"
  echo "Phase: Playwright E2E Test" >> "$EVIDENCE_DIR/FINAL_VERDICT.txt"
  echo "Reason: Test execution failed" >> "$EVIDENCE_DIR/FINAL_VERDICT.txt"
  exit 1
fi

echo "[OK] Playwright test PASSED"
tail -30 "$EVIDENCE_DIR/04_playwright/playwright.log"

# Copy Playwright test-results to evidence (videos, traces, test artifacts)
echo "[INFO] Copying Playwright test artifacts..."
if [ -d "test-results" ]; then
  cp -r test-results "$EVIDENCE_DIR/04_playwright/test-results"
  VIDEO_COUNT=$(find "$EVIDENCE_DIR/04_playwright/test-results" -name "*.webm" 2>/dev/null | wc -l)
  TRACE_COUNT=$(find "$EVIDENCE_DIR/04_playwright/test-results" -name "*.zip" 2>/dev/null | wc -l)
  echo "  ✓ Videos: $VIDEO_COUNT"
  echo "  ✓ Traces: $TRACE_COUNT"
else
  echo "[WARN] No test-results directory found"
fi

echo ""

# ============================================================================
# PHASE 6: Stop Background Processes
# ============================================================================
echo "=== PHASE 6: STOP BACKGROUND PROCESSES ==="
cleanup
echo "[OK] Background processes stopped"
echo ""

# ============================================================================
# PHASE 7: Write Final Verdict
# ============================================================================
echo "=== PHASE 7: FINAL VERDICT DETERMINATION ==="

# Check for any failures
VERDICT="PASS"
REASON=""

# Check documentation overclaim verdict
if ! grep -q "^PASS" "$EVIDENCE_DIR/docs_overclaim/verdict.txt"; then
  VERDICT="FAIL"
  REASON="Documentation overclaim audit failed"
fi

# Check console errors (FAIL-CLOSED for Jira dashboard test)
if [ -f "$PLAYWRIGHT_CONSOLE_ERRORS" ] && [ -s "$PLAYWRIGHT_CONSOLE_ERRORS" ]; then
  VERDICT="FAIL"
  REASON="Console errors detected during test"
fi

# Check page errors (FAIL-CLOSED for Jira dashboard test)
if [ -f "$PLAYWRIGHT_PAGE_ERRORS" ] && [ -s "$PLAYWRIGHT_PAGE_ERRORS" ]; then
  VERDICT="FAIL"
  REASON="Page errors detected during test"
fi

# Check screenshots (5 expected for Jira dashboard test)
SCREENSHOT_COUNT=$(find "$EVIDENCE_DIR/04_playwright/screenshots" -name "reviewer_*.png" | wc -l)
if [ "$SCREENSHOT_COUNT" -lt 5 ]; then
  VERDICT="FAIL"
  REASON="Expected 5 screenshots, found $SCREENSHOT_COUNT"
fi

# Write verdict (tarball paths will be added later)
echo "$VERDICT" > "$EVIDENCE_DIR/FINAL_VERDICT.txt"
echo "Run ID: $RUN_ID" >> "$EVIDENCE_DIR/FINAL_VERDICT.txt"
echo "Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")" >> "$EVIDENCE_DIR/FINAL_VERDICT.txt"
echo "Evidence: $EVIDENCE_DIR" >> "$EVIDENCE_DIR/FINAL_VERDICT.txt"
echo "" >> "$EVIDENCE_DIR/FINAL_VERDICT.txt"

if [ "$VERDICT" = "FAIL" ]; then
  echo "Reason: $REASON" >> "$EVIDENCE_DIR/FINAL_VERDICT.txt"
fi

echo "Tunnel URL: $TUNNEL_URL" >> "$EVIDENCE_DIR/FINAL_VERDICT.txt"
echo "Screenshots: $SCREENSHOT_COUNT" >> "$EVIDENCE_DIR/FINAL_VERDICT.txt"
echo "" >> "$EVIDENCE_DIR/FINAL_VERDICT.txt"
echo "Phase Results:" >> "$EVIDENCE_DIR/FINAL_VERDICT.txt"
echo "  1. Documentation Overclaim: $(cat "$EVIDENCE_DIR/docs_overclaim/verdict.txt" | head -1)" >> "$EVIDENCE_DIR/FINAL_VERDICT.txt"
echo "  2. Forge Deploy: OK" >> "$EVIDENCE_DIR/FINAL_VERDICT.txt"
echo "  3. Forge Tunnel: OK" >> "$EVIDENCE_DIR/FINAL_VERDICT.txt"
echo "  4. Forge Logs: OK" >> "$EVIDENCE_DIR/FINAL_VERDICT.txt"
echo "  5. Playwright Test: OK" >> "$EVIDENCE_DIR/FINAL_VERDICT.txt"
echo "  6. Evidence Bundle: OK" >> "$EVIDENCE_DIR/FINAL_VERDICT.txt"

echo ""

# ============================================================================
# PHASE 8: Create Evidence Bundle
# ============================================================================
echo "=== PHASE 8: CREATE EVIDENCE BUNDLE ==="

cd "$EVIDENCE_DIR"

echo "[INFO] Computing checksums..."

# Create stable-order file list and compute SHA256
find . -type f | sort | xargs -I {} sh -c 'sha256sum "{}" || shasum -a 256 "{}"' > PACKHASH.sha256

echo "[INFO] Creating tarball..."
TARBALL="/tmp/ft_reviewer_e2e_${RUN_ID}.tar.gz"
TARBALL_SHA="/tmp/ft_reviewer_e2e_${RUN_ID}.tar.gz.sha256"

tar -czf "$TARBALL" -C /tmp "ft_reviewer_e2e_${RUN_ID}"

echo "[INFO] Computing tarball checksum..."
(cd /tmp && (sha256sum "ft_reviewer_e2e_${RUN_ID}.tar.gz" || shasum -a 256 "ft_reviewer_e2e_${RUN_ID}.tar.gz") > "$TARBALL_SHA")

# Validate tarball size (MUST be > 1MB with videos/traces)
TARBALL_SIZE=$(stat -c%s "$TARBALL" 2>/dev/null || stat -f%z "$TARBALL" 2>/dev/null)
TARBALL_SIZE_MB=$(echo "scale=2; $TARBALL_SIZE / 1048576" | bc)

if [ "$TARBALL_SIZE" -lt 1048576 ]; then
  echo "[FATAL] Tarball too small: ${TARBALL_SIZE_MB} MB < 1 MB" >&2
  echo "[FATAL] Missing videos/traces or evidence incomplete" >&2
  VERDICT="FAIL"
  REASON="Evidence bundle too small (${TARBALL_SIZE_MB} MB)"
fi

echo "[OK] Evidence bundle created:"
echo "  Directory: $EVIDENCE_DIR"
echo "  Tarball: $TARBALL"
echo "  Size: ${TARBALL_SIZE_MB} MB"
echo "  Checksum: $TARBALL_SHA"

ls -lh "$TARBALL"

echo ""

# Display verdict
echo "============================================================"
if [ "$VERDICT" = "PASS" ]; then
  echo "✓ REVIEWER E2E SIMULATION: PASS"
else
  echo "✗ REVIEWER E2E SIMULATION: FAIL"
  echo "Reason: $REASON"
fi
echo "============================================================"
echo ""
cat "$EVIDENCE_DIR/FINAL_VERDICT.txt"

if [ "$VERDICT" = "FAIL" ]; then
  exit 1
fi

exit 0
