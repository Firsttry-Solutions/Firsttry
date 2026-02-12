#!/usr/bin/env bash
set -euo pipefail

# Playwright Dashboard Diagnostics Test Runner
# Runs auth setup first (guarantees state.json), then dashboard diagnostics
# Supports Xvfb for headed browsers in Codespaces (no X display)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../" && pwd)"

# === ENV VALIDATION (strict) ===
if [[ -z "${JIRA_BASE_URL:-}" ]]; then
  echo "[PW_DIAG] ERROR: JIRA_BASE_URL not set"
  exit 1
fi

if [[ "${JIRA_BASE_URL}" != "https://firsttry.atlassian.net" ]]; then
  echo "[PW_DIAG] ERROR: JIRA_BASE_URL must be 'https://firsttry.atlassian.net', got '${JIRA_BASE_URL}'"
  exit 1
fi

if [[ -z "${JIRA_DASHBOARD_URL:-}" ]]; then
  echo "[PW_DIAG] ERROR: JIRA_DASHBOARD_URL not set"
  exit 1
fi

DASHBOARD_PREFIX="https://firsttry.atlassian.net/jira/dashboards/"
if [[ ! "${JIRA_DASHBOARD_URL}" =~ ^${DASHBOARD_PREFIX} ]]; then
  echo "[PW_DIAG] ERROR: JIRA_DASHBOARD_URL must start with '${DASHBOARD_PREFIX}', got '${JIRA_DASHBOARD_URL}'"
  exit 1
fi

# === CREATE DETERMINISTIC RUN DIR FOR LOGS ===
RUN_TS=$(date -u +%Y%m%dT%H%M%SZ)
RUN_ROOT="/tmp/pw_run_${RUN_TS}"
mkdir -p "$RUN_ROOT"
echo "[PW_DIAG] RUN_ROOT=${RUN_ROOT}"

# === DETECT IF XVFB IS NEEDED ===
XVFB_NEEDED=false
PW_CMD=""

if [[ -z "${DISPLAY:-}" ]]; then
  XVFB_NEEDED=true
  if ! command -v xvfb-run &> /dev/null; then
    echo "[PW_DIAG] ERROR: DISPLAY not set and xvfb-run not available"
    echo "[PW_DIAG] Install xvfb: apt-get update && apt-get install -y xvfb"
    exit 1
  fi
  PW_CMD="xvfb-run -a"
  echo "[PW_DIAG] Using Xvfb (no X display detected)"
else
  echo "[PW_DIAG] X display detected: DISPLAY=${DISPLAY}"
fi

cd "${REPO_ROOT}"
export JIRA_BASE_URL
export JIRA_DASHBOARD_URL

# === PRINT PLAYWRIGHT VERSION ===
echo "[PW_DIAG] Playwright version:"
npx playwright --version

# === PHASE 1: AUTH SETUP ===
echo "[PW_DIAG] Running auth setup..."
if $PW_CMD npx playwright test --project=setup \
  --reporter=list \
  --workers=1 \
  --retries=0 \
  > "$RUN_ROOT/setup.log" 2>&1; then
  SETUP_EXIT=0
  echo "[PW_DIAG] ✅ Auth setup PASSED"
else
  SETUP_EXIT=$?
  echo "[PW_DIAG] ❌ Auth setup FAILED (exit code: $SETUP_EXIT)"
fi

# === PHASE 2: DASHBOARD DIAGNOSTICS ===
echo "[PW_DIAG] Running dashboard diagnostics..."
if $PW_CMD npx playwright test --project=chromium \
  --reporter=list \
  --workers=1 \
  --retries=0 \
  > "$RUN_ROOT/diagnostics.log" 2>&1; then
  DIAG_EXIT=0
  echo "[PW_DIAG] ✅ Dashboard diagnostics PASSED"
else
  DIAG_EXIT=$?
  echo "[PW_DIAG] ❌ Dashboard diagnostics FAILED (exit code: $DIAG_EXIT)"
fi

# === LOCATE AND PRINT LATEST pw_dash_diag OUTPUT ===
LATEST_OUT="$(ls -td /tmp/pw_dash_diag_* 2>/dev/null | head -1 || true)"
if [[ -n "${LATEST_OUT:-}" ]]; then
  echo "[PW_DIAG] LATEST_OUT_DIR=${LATEST_OUT}"
  echo "[PW_DIAG]"
  echo "[PW_DIAG] === console.log (tail -200) ==="
  tail -200 "$LATEST_OUT/console.log" 2>/dev/null || echo "(no console.log found)"
  echo "[PW_DIAG]"
  echo "[PW_DIAG] === network.log (tail -200) ==="
  tail -200 "$LATEST_OUT/network.log" 2>/dev/null || echo "(no network.log found)"
  echo "[PW_DIAG]"
  echo "[PW_DIAG] === HTTP 4xx/5xx errors (first 50) ==="
  grep -E "\[response\.(4|5)[0-9]{2}\]" "$LATEST_OUT/network.log" 2>/dev/null | head -50 || echo "(no HTTP errors)"
else
  echo "[PW_DIAG] No /tmp/pw_dash_diag_* directories found"
fi

# === PRINT RUN LOGS ===
echo "[PW_DIAG]"
echo "[PW_DIAG] === setup.log (tail -200) ==="
tail -200 "$RUN_ROOT/setup.log"
echo "[PW_DIAG]"
echo "[PW_DIAG] === diagnostics.log (tail -200) ==="
tail -200 "$RUN_ROOT/diagnostics.log"

# === FINAL STATUS ===
OVERALL_EXIT=0
if [[ $SETUP_EXIT -ne 0 ]]; then OVERALL_EXIT=$SETUP_EXIT; fi
if [[ $DIAG_EXIT -ne 0 ]]; then OVERALL_EXIT=$DIAG_EXIT; fi

if [[ $OVERALL_EXIT -eq 0 ]]; then
  echo "[PW_DIAG] ✅ OVERALL: ALL PHASES PASSED"
else
  echo "[PW_DIAG] ❌ OVERALL: SOME PHASES FAILED (exit code: $OVERALL_EXIT)"
fi

echo "[PW_DIAG] RUN_ROOT=${RUN_ROOT}"
exit $OVERALL_EXIT
