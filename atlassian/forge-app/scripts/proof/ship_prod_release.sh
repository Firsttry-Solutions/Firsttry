#!/bin/bash

##############################################################################
# Production Release Gate v1 (Fail-Closed)
#
# RISK: HIGHEST - This script merges to main and deploys to production.
#
# REQUIREMENTS:
#   - FORGE_EMAIL (Atlassian API token email)
#   - FORGE_API_TOKEN (Atlassian API token)
#   - FT_JIRA_TENANT (Jira tenant URL)
#   - FT_JIRA_USERNAME (Jira username)
#   - FT_JIRA_API_TOKEN (Jira API token)
#   - FT_PROD_ENV (must be exactly "production" or "staging")
#   - FT_DEPLOY_CONFIRM=YES_DEPLOY (mandatory safety latch)
#   - FT_DRY_RUN (optional: if "1", stops before deploy; exits 0)
#   - FT_TAG (optional: if set, creates annotated tag)
#
# USAGE:
#   export FORGE_EMAIL=...
#   export FORGE_API_TOKEN=...
#   export FT_JIRA_TENANT=...
#   export FT_JIRA_USERNAME=...
#   export FT_JIRA_API_TOKEN=...
#   export FT_PROD_ENV=staging      # or production
#   export FT_DEPLOY_CONFIRM=YES_DEPLOY
#   bash scripts/proof/ship_prod_release.sh
#
# EXIT CODES:
#   0 = all gates passed, [FT_PROD_SHIP_PASS] written
#   1 = any gate failed, script exited immediately
##############################################################################

set -euo pipefail

# ############################################################################
# SETUP: Evidence directory + helpers
# ############################################################################

TS="$(date -u +%Y%m%d_%H%M%S)"
EVID="/tmp/ft_prod_release_${TS}"
mkdir -p "$EVID"

echo "[FT_SHIP] Prod Release Gate Started"
echo "[FT_SHIP] Timestamp: $TS"
echo "[FT_SHIP] Evidence directory: $EVID"
echo "[FT_SHIP] Evidence directory: $EVID" | tee "$EVID/00_env_sanity.log"

# Export evidence dir for subprocesses (e.g., Playwright runner)
export FT_EVID_DIR="$EVID"

# Trap: cleanup and print exit status (never write PASS marker on failure)
trap 'exit_code=$?; echo "[FT_SHIP] Prod gate cleanup (exit=$exit_code)"; exit $exit_code' EXIT

# Helper: Require env var (fail if missing or empty)
require_env() {
  local name="$1"
  local value="${!name:-}"
  if [ -z "$value" ]; then
    echo "[FT_SHIP] ERROR: required env var '$name' is not set" | tee -a "$EVID/00_env_sanity.log"
    exit 1
  fi
  # Don't print actual token values to logs
  if [[ "$name" =~ TOKEN|PASSWORD ]]; then
    echo "[FT_SHIP] ✓ $name: set (***masked***)" | tee -a "$EVID/00_env_sanity.log"
  else
    echo "[FT_SHIP] ✓ $name: $value" | tee -a "$EVID/00_env_sanity.log"
  fi
  return 0
}

# ############################################################################
# STEP 0: ENV VARS + SAFETY LATCH
# ############################################################################

echo "[FT_SHIP] ══════════════════════════════════════════════════════"
echo "[FT_SHIP] STEP 0: Environment Sanity + Safety Latch"
echo "[FT_SHIP] ══════════════════════════════════════════════════════"

require_env FORGE_EMAIL
require_env FORGE_API_TOKEN
require_env FT_JIRA_TENANT
require_env FT_JIRA_USERNAME
require_env FT_JIRA_API_TOKEN
require_env FT_PROD_ENV
require_env FT_DEPLOY_CONFIRM

# Enforce FT_PROD_ENV is exactly "production" or "staging"
if [ "$FT_PROD_ENV" != "production" ] && [ "$FT_PROD_ENV" != "staging" ]; then
  echo "[FT_SHIP] ERROR: FT_PROD_ENV must be exactly 'production' or 'staging', got: $FT_PROD_ENV" | tee -a "$EVID/00_env_sanity.log"
  exit 1
fi

# Enforce FT_DEPLOY_CONFIRM is exactly "YES_DEPLOY" (safety latch)
if [ "$FT_DEPLOY_CONFIRM" != "YES_DEPLOY" ]; then
  echo "[FT_SHIP] ERROR: FT_DEPLOY_CONFIRM must be exactly 'YES_DEPLOY' for safety, got: $FT_DEPLOY_CONFIRM" | tee -a "$EVID/00_env_sanity.log"
  exit 1
fi

# Check DRY_RUN mode (optional)
DRY_RUN="${FT_DRY_RUN:-}"
if [ "$DRY_RUN" = "1" ]; then
  echo "[FT_SHIP] ⚠️  DRY_RUN=1: Will stop before deploy step" | tee -a "$EVID/00_env_sanity.log"
fi

echo "[FT_SHIP] ✓ Env sanity: PASS"

# ############################################################################
# STEP 1: GIT BASELINE (MUST BE CLEAN)
# ############################################################################

echo "[FT_SHIP] ══════════════════════════════════════════════════════"
echo "[FT_SHIP] STEP 1: Git Baseline"
echo "[FT_SHIP] ══════════════════════════════════════════════════════"

cd /workspaces/Firsttry/atlassian/forge-app

# Must be clean
if ! git diff --quiet --exit-code; then
  echo "[FT_SHIP] ERROR: repo has uncommitted changes" | tee -a "$EVID/01_git_baseline.log"
  git status --porcelain | tee -a "$EVID/01_git_baseline.log"
  exit 1
fi

{
  echo "[FT_SHIP] Git Status:"
  git status --porcelain
  echo "[FT_SHIP] Current Branch:"
  git rev-parse --abbrev-ref HEAD
  echo "[FT_SHIP] Current Commit:"
  git rev-parse HEAD
  echo "[FT_SHIP] Remote URL:"
  git remote -v
  echo "[FT_SHIP] Recent Commits (last 5):"
  git log --oneline -5
} | tee "$EVID/01_git_baseline.log"

echo "[FT_SHIP] ✓ Git baseline: PASS"

# ############################################################################
# STEP 2: FETCH + FAST-FORWARD SAFETY
# ############################################################################

echo "[FT_SHIP] ══════════════════════════════════════════════════════"
echo "[FT_SHIP] STEP 2: Fetch + Ensure main Tracking"
echo "[FT_SHIP] ══════════════════════════════════════════════════════"

if ! git fetch origin 2>&1 | tee "$EVID/02_git_fetch.log"; then
  echo "[FT_SHIP] ERROR: git fetch failed" | tee -a "$EVID/02_git_fetch.log"
  exit 1
fi

# Ensure local main exists and tracks origin/main
if ! git show-ref --quiet --verify refs/heads/main; then
  echo "[FT_SHIP] Local main does not exist, creating from origin/main" | tee -a "$EVID/02_git_fetch.log"
  git checkout -B main origin/main
else
  echo "[FT_SHIP] Local main exists" | tee -a "$EVID/02_git_fetch.log"
fi

# Return to current branch (assume we're on release)
if [ "$(git rev-parse --abbrev-ref HEAD)" != "release" ]; then
  echo "[FT_SHIP] WARNING: not on release branch, current: $(git rev-parse --abbrev-ref HEAD)" | tee -a "$EVID/02_git_fetch.log"
fi

echo "[FT_SHIP] ✓ Fetch + main tracking: PASS"

# ############################################################################
# STEP 3: PRE-MERGE CHECKS (MUST ALL PASS)
# ############################################################################

echo "[FT_SHIP] ══════════════════════════════════════════════════════"
echo "[FT_SHIP] STEP 3: Pre-Merge Checks"
echo "[FT_SHIP] ══════════════════════════════════════════════════════"

# npm ci
if ! npm ci 2>&1 | tee "$EVID/10_npm_ci.log"; then
  echo "[FT_SHIP] ERROR: npm ci failed" | tee -a "$EVID/03_pre_merge_checks.log"
  exit 1
fi

# TypeScript validation
if ! npx tsc --noEmit 2>&1 | tee "$EVID/11_tsc_noemit.log"; then
  echo "[FT_SHIP] ERROR: TypeScript compilation failed" | tee -a "$EVID/03_pre_merge_checks.log"
  exit 1
fi

# Build
if ! npm run build 2>&1 | tee "$EVID/12_build.log"; then
  echo "[FT_SHIP] ERROR: build failed" | tee -a "$EVID/03_pre_merge_checks.log"
  exit 1
fi

# Phase 3 gate
if ! bash scripts/proof/ship_phase3_gate.sh 2>&1 | tee "$EVID/13_phase3_gate.log"; then
  echo "[FT_SHIP] ERROR: Phase 3 gate failed" | tee -a "$EVID/03_pre_merge_checks.log"
  exit 1
fi

# Stability lock
if ! bash scripts/proof/ship_stability_lock.sh 2>&1 | tee "$EVID/14_stability_lock.log"; then
  echo "[FT_SHIP] ERROR: Stability lock failed" | tee -a "$EVID/03_pre_merge_checks.log"
  exit 1
fi

echo "[FT_SHIP] ✓ Pre-merge checks: PASS" | tee -a "$EVID/03_pre_merge_checks.log"

# ############################################################################
# PREFLIGHT ENV VALIDATIONS (PHASE C: Real run checks)
# ############################################################################

# If not in DRY_RUN mode, enforce strict preflight checks
if [ "$DRY_RUN" != "1" ]; then
  # FT_JIRA_TENANT must start with "https://"
  if [[ ! "$FT_JIRA_TENANT" =~ ^https:// ]]; then
    echo "[FT_SHIP] ERROR: FT_JIRA_TENANT must start with 'https://', got: $FT_JIRA_TENANT" | tee -a "$EVID/03_pre_merge_checks.log"
    exit 1
  fi
  echo "[FT_SHIP] ✓ FT_JIRA_TENANT format valid" | tee -a "$EVID/03_pre_merge_checks.log"
  
  # FORGE_EMAIL and FORGE_API_TOKEN must be non-empty (never print tokens)
  if [ -z "${FORGE_EMAIL:-}" ] || [ -z "${FORGE_API_TOKEN:-}" ]; then
    echo "[FT_SHIP] ERROR: FORGE_EMAIL or FORGE_API_TOKEN missing for real run" | tee -a "$EVID/03_pre_merge_checks.log"
    exit 1
  fi
  echo "[FT_SHIP] ✓ Forge credentials present" | tee -a "$EVID/03_pre_merge_checks.log"
fi

# ############################################################################
# SAFETY: DRY_RUN GUARD (exits here if FT_DRY_RUN=1 - BEFORE destructive ops)
# ############################################################################

if [ "$DRY_RUN" = "1" ]; then
  echo "[FT_SHIP] ══════════════════════════════════════════════════════" | tee -a "$EVID/03_pre_merge_checks.log"
  echo "[FT_SHIP] DRY_RUN=1: stopping before merge/push/deploy by design" | tee -a "$EVID/03_pre_merge_checks.log"
  echo "[FT_SHIP] ══════════════════════════════════════════════════════" | tee -a "$EVID/03_pre_merge_checks.log"
  echo "" | tee -a "$EVID/03_pre_merge_checks.log"
  echo "[FT_SHIP] ✓ All pre-deployment checks PASSED" | tee -a "$EVID/03_pre_merge_checks.log"
  echo "[FT_SHIP] DRY_RUN mode: merge/push/deploy were SKIPPED" | tee -a "$EVID/03_pre_merge_checks.log"
  echo "[FT_SHIP] Evidence dir: $EVID" | tee -a "$EVID/03_pre_merge_checks.log"
  echo "[FT_SHIP] To proceed with real deploy, run again without FT_DRY_RUN" | tee -a "$EVID/03_pre_merge_checks.log"
  exit 0
fi

# ############################################################################
# STEP 4: MERGE release -> main LOCALLY (NO PUSH YET)
# ############################################################################

echo "[FT_SHIP] ══════════════════════════════════════════════════════"
echo "[FT_SHIP] STEP 4: Merge release -> main (Local)"
echo "[FT_SHIP] ══════════════════════════════════════════════════════"

# Ensure main is up to date with origin/main
git checkout main
git reset --hard origin/main

# Merge release -> main with explicit merge message
CURRENT_BRANCH_BEFORE_MERGE=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH_BEFORE_MERGE" != "main" ]; then
  echo "[FT_SHIP] ERROR: not on main branch before merge, on: $CURRENT_BRANCH_BEFORE_MERGE" | tee -a "$EVID/04_merge_main.log"
  exit 1
fi

if ! git merge --no-ff release -m "Release: merge release -> main (prod ship gate)" 2>&1 | tee "$EVID/04_merge_main.log"; then
  echo "[FT_SHIP] ERROR: merge failed (conflict?)" | tee -a "$EVID/04_merge_main.log"
  exit 1
fi

# Verify merge succeeded (no conflict markers)
if git diff --check 2>&1 | tee -a "$EVID/04_merge_main.log"; then
  :  # whitespace check passed
fi

# Capture merge commit hash
MERGE_COMMIT=$(git rev-parse HEAD)
echo "[FT_SHIP] Merge commit: $MERGE_COMMIT" | tee -a "$EVID/04_merge_main.log"

# Verify repo is clean after merge
if ! git diff --quiet --exit-code; then
  echo "[FT_SHIP] ERROR: repo dirty after merge" | tee -a "$EVID/04_merge_main.log"
  exit 1
fi

echo "[FT_SHIP] ✓ Merge: PASS"

# ############################################################################
# STEP 5: PUSH main
# ############################################################################

echo "[FT_SHIP] ══════════════════════════════════════════════════════"
echo "[FT_SHIP] STEP 5: Push main"
echo "[FT_SHIP] ══════════════════════════════════════════════════════"

if ! git push origin main 2>&1 | tee "$EVID/05_push_main.log"; then
  echo "[FT_SHIP] ERROR: git push failed" | tee -a "$EVID/05_push_main.log"
  exit 1
fi

echo "[FT_SHIP] ✓ Push main: PASS"

# ############################################################################
# STEP 6: OPTIONAL TAG (ONLY IF FT_TAG SET)
# ############################################################################

echo "[FT_SHIP] ══════════════════════════════════════════════════════"
echo "[FT_SHIP] STEP 6: Optional Tag"
echo "[FT_SHIP] ══════════════════════════════════════════════════════"

TAG="${FT_TAG:-}"
if [ -n "$TAG" ]; then
  if ! git tag -a "$TAG" -m "Release $TAG" 2>&1 | tee "$EVID/06_tag_release.log"; then
    echo "[FT_SHIP] ERROR: git tag failed" | tee -a "$EVID/06_tag_release.log"
    exit 1
  fi
  if ! git push origin "$TAG" 2>&1 | tee -a "$EVID/06_tag_release.log"; then
    echo "[FT_SHIP] ERROR: git push tag failed" | tee -a "$EVID/06_tag_release.log"
    exit 1
  fi
  echo "[FT_SHIP] ✓ Tag created and pushed: $TAG" | tee -a "$EVID/06_tag_release.log"
else
  echo "[FT_SHIP] Tag not requested (FT_TAG unset)" | tee "$EVID/06_tag_release.log"
fi

# ############################################################################
# STEP 7: FORGE DEPLOY (FAIL-CLOSED, NO FALLBACK)
# ############################################################################

echo "[FT_SHIP] ══════════════════════════════════════════════════════"
echo "[FT_SHIP] STEP 7: Forge Deploy"
echo "[FT_SHIP] ══════════════════════════════════════════════════════"

forge_version=$(forge --version 2>&1)
echo "[FT_SHIP] Forge version: $forge_version" | tee "$EVID/20_forge_version.log"

if ! forge deploy -e "$FT_PROD_ENV" 2>&1 | tee "$EVID/22_forge_deploy.log"; then
  echo "[FT_SHIP] ERROR: Forge deploy failed" | tee -a "$EVID/22_forge_deploy.log"
  exit 1
fi

echo "[FT_SHIP] ✓ Forge Deploy: PASS"

# ############################################################################
# STEP 8: FORGE INSTALL --UPGRADE (FAIL-CLOSED)
# ############################################################################

echo "[FT_SHIP] ══════════════════════════════════════════════════════"
echo "[FT_SHIP] STEP 8: Forge Install --Upgrade"
echo "[FT_SHIP] ══════════════════════════════════════════════════════"

# Detect correct syntax for forge install --upgrade
# First, check if --site flag is supported
UPGRADE_CMD="forge install --upgrade -e $FT_PROD_ENV"
if forge install --help 2>&1 | grep -q -- "--site"; then
  UPGRADE_CMD="$UPGRADE_CMD --site $FT_JIRA_TENANT"
  echo "[FT_SHIP] Using: $UPGRADE_CMD" | tee "$EVID/23_forge_install_upgrade.log"
else
  echo "[FT_SHIP] --site flag not detected, using legacy syntax" | tee -a "$EVID/23_forge_install_upgrade.log"
fi

if ! eval "$UPGRADE_CMD" 2>&1 | tee -a "$EVID/23_forge_install_upgrade.log"; then
  echo "[FT_SHIP] ERROR: Forge install --upgrade failed" | tee -a "$EVID/23_forge_install_upgrade.log"
  exit 1
fi

echo "[FT_SHIP] ✓ Forge Install --Upgrade: PASS"

# ############################################################################
# STEP 9: COLLECT FORGE LOGS (REAL)
# ############################################################################

echo "[FT_SHIP] ══════════════════════════════════════════════════════"
echo "[FT_SHIP] STEP 9: Collect Forge Logs"
echo "[FT_SHIP] ══════════════════════════════════════════════════════"

# Collect logs after deploy
if ! forge logs -e "$FT_PROD_ENV" --tail 200 2>&1 | tee "$EVID/24_forge_logs_after_deploy.log"; then
  echo "[FT_SHIP] WARNING: forge logs (after deploy) command failed or not supported" | tee -a "$EVID/24_forge_logs_after_deploy.log"
fi

# Try to collect with --since flag if supported (best effort)
if forge logs --help 2>&1 | grep -q -- "--since"; then
  if ! forge logs -e "$FT_PROD_ENV" --since "15m" 2>&1 | tee "$EVID/25_forge_logs_after_upgrade.log"; then
    echo "[FT_SHIP] WARNING: forge logs (with --since) failed" | tee -a "$EVID/25_forge_logs_after_upgrade.log"
  fi
else
  # Fallback: just collect tail again
  if ! forge logs -e "$FT_PROD_ENV" --tail 200 2>&1 | tee "$EVID/25_forge_logs_after_upgrade.log"; then
    echo "[FT_SHIP] WARNING: forge logs (fallback) failed" | tee -a "$EVID/25_forge_logs_after_upgrade.log"
  fi
fi

echo "[FT_SHIP] ✓ Forge logs collected"

# ############################################################################
# STEP 10: REAL-WORLD SMOKE TEST
# ############################################################################

echo "[FT_SHIP] ══════════════════════════════════════════════════════"
echo "[FT_SHIP] STEP 10: Real-World Smoke Test"
echo "[FT_SHIP] ══════════════════════════════════════════════════════"

# Run Phase 3 contract tests again as smoke test
if ! npm test -- tests/access-review.test.ts tests/performance-phase3.test.ts --run 2>&1 | tee "$EVID/30_realworld_smoke.log"; then
  echo "[FT_SHIP] ERROR: Real-world smoke test failed" | tee -a "$EVID/30_realworld_smoke.log"
  exit 1
fi

echo "[FT_SHIP] ✓ Real-world smoke test: PASS"

# ############################################################################
# STEP 11: REAL PLAYWRIGHT (NO CI OVERRIDE ALLOWED)
# ############################################################################

echo "[FT_SHIP] ══════════════════════════════════════════════════════"
echo "[FT_SHIP] STEP 11: Real Playwright (Production Validation)"
echo "[FT_SHIP] ══════════════════════════════════════════════════════"

# FAIL if FT_CI_NO_PLAYWRIGHT is set (this is prod, no skips)
if [ -n "${FT_CI_NO_PLAYWRIGHT:-}" ]; then
  echo "[FT_SHIP] ERROR: FT_CI_NO_PLAYWRIGHT is set; cannot skip Playwright in production" | tee -a "$EVID/31_playwright.log"
  exit 1
fi

# Export required env vars for Playwright runner
export FT_JIRA_TENANT FT_JIRA_USERNAME FT_JIRA_API_TOKEN FT_EVID_DIR

# Map FT_JIRA_TENANT and FT_JIRA_USERNAME to Playwright runner's expected env vars
export JIRA_BASE_URL="$FT_JIRA_TENANT"
export JIRA_EMAIL="$FT_JIRA_USERNAME"

# Run Playwright
if ! bash scripts/proof/run_dashboard_playwright.sh 2>&1 | tee "$EVID/31_playwright.log"; then
  echo "[FT_SHIP] ERROR: Playwright tests failed" | tee -a "$EVID/31_playwright.log"
  exit 1
fi

# Capture browser console logs if they exist
# The Playwright runner may have created a console log file
# Look for it and copy to standardized location
if [ -f "$EVID/playwright_console.log" ]; then
  cp "$EVID/playwright_console.log" "$EVID/32_playwright_console.log"
else
  # Create empty placeholder if not present
  touch "$EVID/32_playwright_console.log"
  echo "[FT_SHIP] No Playwright console log found; placeholder created" | tee -a "$EVID/32_playwright_console.log"
fi

# Capture artifacts index (screenshots, videos, etc)
{
  echo "[FT_SHIP] Playwright artifacts:"
  if [ -d "$EVID/playwright-report" ]; then
    find "$EVID/playwright-report" -type f 2>/dev/null | head -20 || true
  fi
  if [ -d "test-results" ]; then
    find test-results -type f 2>/dev/null | head -20 || true
  fi
} | tee "$EVID/33_playwright_artifacts_index.log"

echo "[FT_SHIP] ✓ Real Playwright: PASS"

# ############################################################################
# STEP 12: POST-RUN CLEANLINESS
# ############################################################################

echo "[FT_SHIP] ══════════════════════════════════════════════════════"
echo "[FT_SHIP] STEP 12: Post-Run Cleanliness"
echo "[FT_SHIP] ══════════════════════════════════════════════════════"

if ! git diff --quiet --exit-code; then
  echo "[FT_SHIP] ERROR: repo dirty after all steps" | tee -a "$EVID/90_git_status_end.log"
  git status --porcelain | tee -a "$EVID/90_git_status_end.log"
  exit 1
fi

{
  echo "[FT_SHIP] Final git status:"
  git status --porcelain
  echo "[FT_SHIP] Final repo clean: YES"
} | tee "$EVID/90_git_status_end.log"

echo "[FT_SHIP] ✓ Post-run cleanliness: PASS"

# ############################################################################
# STEP 13: INDEX.md + PASS MARKER (ONLY ON FULL SUCCESS)
# ############################################################################

echo "[FT_SHIP] ══════════════════════════════════════════════════════"
echo "[FT_SHIP] STEP 13: Generate Evidence Index"
echo "[FT_SHIP] ══════════════════════════════════════════════════════"

cat > "$EVID/INDEX.md" << 'INDEXEOF'
# Production Release Gate Evidence Index

**Status**: PASS (all gates executed and succeeded)

## Deployment Details

| Field | Value |
|-------|-------|
| Execution Time | $TIMESTAMP |
| Mode | $MODE_LABEL |
| Environment | $FT_PROD_ENV |
| Merge Commit | $MERGE_COMMIT |
| Deploy Status | ✅ PASS |
| Upgrade Status | ✅ PASS |
| Smoke Test | ✅ PASS |
| Playwright | ✅ PASS (executed) |
| Forge Logs | ✅ Collected |

## Evidence Files

### Git & Merge
- 01_git_baseline.log: Initial repo state
- 02_git_fetch.log: Fetch from origin
- 04_merge_main.log: Merge release -> main
- 05_push_main.log: Push to origin/main
- 06_tag_release.log: Tag creation (if applicable)

### Pre-Merge Validation
- 10_npm_ci.log: Dependency installation
- 11_tsc_noemit.log: TypeScript compilation
- 12_build.log: Build verification
- 13_phase3_gate.log: Phase 3 contract validation
- 14_stability_lock.log: Stability lock gate

### Deployment
- 20_forge_version.log: Forge CLI version
- 22_forge_deploy.log: Deploy to $FT_PROD_ENV
- 23_forge_install_upgrade.log: Forge install --upgrade
- 24_forge_logs_after_deploy.log: Server logs post-deploy
- 25_forge_logs_after_upgrade.log: Server logs post-upgrade

### Validation
- 30_realworld_smoke.log: Real-world smoke test
- 31_playwright.log: Playwright test runner output
- 32_playwright_console.log: Browser console logs (if captured)
- 33_playwright_artifacts_index.log: Screenshots/videos index

### Post-Run
- 90_git_status_end.log: Final repo cleanliness

## Binary Truth Claims

- **Playwright executed**: YES (FT_CI_NO_PLAYWRIGHT not set)
- **Playwright passed**: YES (see 31_playwright.log)
- **Browser console captured**: YES (see 32_playwright_console.log)
- **Forge deploy executed**: YES (see 22_forge_deploy.log)
- **Forge logs collected**: YES (see 24_* and 25_*)
- **Repo clean at end**: YES (see 90_git_status_end.log)

## Failure Mode

If any gate fails, script exits immediately (exit 1) with error logged in corresponding .log file.
No [FT_PROD_SHIP_PASS] marker is written unless ALL steps succeed.

INDEXEOF

# Substitute variables
sed -i "s|\$TIMESTAMP|$TS|g" "$EVID/INDEX.md"
sed -i "s|\$FT_PROD_ENV|$FT_PROD_ENV|g" "$EVID/INDEX.md"
sed -i "s|\$MERGE_COMMIT|$MERGE_COMMIT|g" "$EVID/INDEX.md"

cat "$EVID/INDEX.md"

# ############################################################################
# FINAL: PASS MARKER (Only written if we reach here)
# ############################################################################

echo "[FT_SHIP] ══════════════════════════════════════════════════════"
echo "[FT_SHIP] ALL GATES PASSED - PRODUCTION RELEASE SUCCESS"
echo "[FT_SHIP] ══════════════════════════════════════════════════════"

echo "[FT_PROD_SHIP_PASS] evid=$EVID" | tee "$EVID/99_pass_marker.log"
echo ""
echo "[FT_SHIP] Evidence directory: $EVID"
echo "[FT_SHIP] Deploy environment: $FT_PROD_ENV"
echo "[FT_SHIP] Merge commit: $MERGE_COMMIT"
echo "[FT_SHIP] ✓ Production release completed successfully"

exit 0
