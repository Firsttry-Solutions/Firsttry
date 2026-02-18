#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'
umask 077

STATE="tests/playwright/.auth/state.json"
bash scripts/proof/pw_auth_cleanup_guard.sh
test -f "$STATE" || { echo "FAIL-CLOSED: missing $STATE (run generate_playwright_state_novnc.sh first)"; exit 1; }
exec bash scripts/proof/run_dashboard_playwright_stateonly.sh "$@"
