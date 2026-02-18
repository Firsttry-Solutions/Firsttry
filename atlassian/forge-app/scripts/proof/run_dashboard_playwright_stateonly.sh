#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'
umask 077

# FT_PROOF:STATE_ONLY_RUNNER
# Fail-closed state-only Playwright runner.
# Requires state.json to exist — never attempts interactive login.
# Delegates to run_dashboard_playwright.sh with FT_AUTH_MODE=state-only.

STATE_PATH="tests/playwright/.auth/state.json"
test -f "$STATE_PATH" || { echo "FAIL-CLOSED: missing $STATE_PATH"; exit 1; }

export FT_AUTH_MODE="state-only"
export FT_PLAYWRIGHT_MODE="${FT_PLAYWRIGHT_MODE:-headless}"

exec bash scripts/proof/run_dashboard_playwright.sh "$@"
