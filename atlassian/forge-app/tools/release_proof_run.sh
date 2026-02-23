#!/usr/bin/env bash
# =============================================================================
# release_proof_run.sh — Non-Bypassable Operator Release Proof Runner
#
# Creates a tamper-evident evidence directory and runs the full proof mode
# with Playwright UI smoke gate enabled. Fails closed on any violation.
#
# Required env vars:
#   FT_E2E_ISSUE_URL      — Must match ^https://firsttry\.atlassian\.net/browse/
#   FT_E2E_STORAGE_STATE  — Path to Playwright storageState JSON (operator session)
#
# Usage:
#   FT_E2E_ISSUE_URL=https://firsttry.atlassian.net/browse/DEMO-1 \
#   FT_E2E_STORAGE_STATE=/tmp/ft_storage_state.json \
#   tools/release_proof_run.sh
#
# Note: FT_UI_SMOKE=1 is forced unconditionally — cannot be disabled.
# Marker: FT_RELEASE_PROOF_RUNNER_V1
# =============================================================================
set -euo pipefail

cd /workspaces/Firsttry/atlassian/forge-app

R="/tmp/ft_release_proof_$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$R"

echo "[FT_RELEASE_PROOF_RUNNER_V1] Evidence dir: $R"

# ─── Force non-bypassable env vars ──────────────────────────────────────────
export FT_UI_SMOKE=1

# ─── Validation: FT_E2E_ISSUE_URL ───────────────────────────────────────────
if [ -z "${FT_E2E_ISSUE_URL:-}" ]; then
  echo "FAIL: FT_E2E_ISSUE_URL is not set." | tee "$R/FAIL_REASON.txt"
  echo "  Required: https://firsttry.atlassian.net/browse/<ISSUE>" | tee -a "$R/FAIL_REASON.txt"
  exit 1
fi

if ! echo "$FT_E2E_ISSUE_URL" | grep -qE '^https://firsttry\.atlassian\.net/browse/'; then
  echo "FAIL: FT_E2E_ISSUE_URL must match ^https://firsttry.atlassian.net/browse/" \
    | tee "$R/FAIL_REASON.txt"
  echo "  Got: $FT_E2E_ISSUE_URL" | tee -a "$R/FAIL_REASON.txt"
  echo "  Non-production URLs are not accepted; operator must use firsttry.atlassian.net." \
    | tee -a "$R/FAIL_REASON.txt"
  exit 1
fi

# ─── Validation: FT_E2E_STORAGE_STATE ───────────────────────────────────────
if [ -z "${FT_E2E_STORAGE_STATE:-}" ]; then
  echo "FAIL: FT_E2E_STORAGE_STATE is not set." | tee "$R/FAIL_REASON.txt"
  echo "  Run: node tools/e2e_save_storage_state.mjs" | tee -a "$R/FAIL_REASON.txt"
  exit 1
fi

if [ ! -f "$FT_E2E_STORAGE_STATE" ]; then
  echo "FAIL: FT_E2E_STORAGE_STATE file not found: $FT_E2E_STORAGE_STATE" | tee "$R/FAIL_REASON.txt"
  exit 1
fi

if [ ! -r "$FT_E2E_STORAGE_STATE" ]; then
  echo "FAIL: FT_E2E_STORAGE_STATE is not readable: $FT_E2E_STORAGE_STATE" | tee "$R/FAIL_REASON.txt"
  exit 1
fi

# Basic sanity: must contain "cookies" somewhere in the JSON
if ! grep -q '"cookies"' "$FT_E2E_STORAGE_STATE"; then
  echo "FAIL: FT_E2E_STORAGE_STATE does not contain \"cookies\" key — invalid storageState." \
    | tee "$R/FAIL_REASON.txt"
  exit 1
fi

# ─── Write context ───────────────────────────────────────────────────────────
{
  echo "utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "git_sha=$(git rev-parse HEAD)"
  echo "node=$(node -v 2>/dev/null || echo UNKNOWN)"
  echo "forge_version=$(npx forge --version 2>/dev/null || echo UNKNOWN)"
  echo "FT_UI_SMOKE=1 (forced)"
  echo "FT_E2E_ISSUE_URL=$FT_E2E_ISSUE_URL"
  echo "FT_E2E_STORAGE_STATE=$FT_E2E_STORAGE_STATE"
  echo "evidence_dir=$R"
} | tee "$R/00_context.txt"

# ─── Run npm run proof (non-bypassable: FT_UI_SMOKE=1 already set) ───────────
echo ""
echo "[FT_RELEASE_PROOF_RUNNER_V1] Running npm run proof (FT_UI_SMOKE=1 forced)..."
echo ""

PROOF_EXIT=0
npm run proof 2>&1 | tee "$R/01_proof_stdout_stderr.txt" || PROOF_EXIT=$?

# ─── Collect post-run evidence ───────────────────────────────────────────────

# Locate latest proof mode dir
LATEST_PROOF_DIR=$(ls -dt /tmp/ft_proof_mode_* 2>/dev/null | head -1 || true)
if [ -n "$LATEST_PROOF_DIR" ]; then
  echo "$LATEST_PROOF_DIR" | tee "$R/02_proof_mode_dir.txt"
else
  echo "NOT_FOUND" | tee "$R/02_proof_mode_dir.txt"
fi

# Locate latest UI smoke dir
LATEST_SMOKE_DIR=$(ls -dt /tmp/ft_ui_smoke_* 2>/dev/null | head -1 || true)
if [ -n "$LATEST_SMOKE_DIR" ]; then
  echo "$LATEST_SMOKE_DIR" | tee "$R/03_ui_smoke_dir.txt"
else
  echo "NOT_FOUND" | tee "$R/03_ui_smoke_dir.txt"
fi

# ─── SHA256 sums (always written, even on failure) ───────────────────────────
(
  cd "$R"
  find . -maxdepth 1 -type f -not -name "99_SHA256SUMS.txt" | sort | \
    while IFS= read -r f; do sha256sum "$f"; done
) | tee "$R/99_SHA256SUMS.txt"

# ─── Fail path ──────────────────────────────────────────────────────────────
if [ "$PROOF_EXIT" -ne 0 ]; then
  echo ""
  echo "FAIL: npm run proof exited with code $PROOF_EXIT" | tee "$R/FAIL_REASON.txt"
  echo "  Evidence: $R"
  exit 1
fi

# ─── Receipt ────────────────────────────────────────────────────────────────
{
  echo "RELEASE_PROOF_PASS"
  echo "utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "git_sha=$(git rev-parse HEAD)"
  echo "proof_mode_dir=$LATEST_PROOF_DIR"
  echo "ui_smoke_dir=$LATEST_SMOKE_DIR"
  echo "evidence_dir=$R"
  echo "FT_UI_SMOKE=1 (forced)"
  echo "FT_E2E_ISSUE_URL=$FT_E2E_ISSUE_URL"
} | tee "$R/RELEASE_PROOF_RECEIPT.txt"

echo ""
echo "=== FT_RELEASE_PROOF_RUNNER_V1 PASS ==="
echo "EVIDENCE_DIR=$R"
