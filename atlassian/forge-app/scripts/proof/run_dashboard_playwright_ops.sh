#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'
umask 077

# FT_PROOF:PW_OPS_STATE_ONLY=1
# Ops runner: state-only, headless, fail-closed if state.json missing.
# Never falls back to interactive login.
# Preserves state.json across the underlying runner's mandatory cleanup trap.

STATE="tests/playwright/.auth/state.json"
STATE_BACKUP="/tmp/ft_pw_ops_state_backup_$$.json"

bash scripts/proof/pw_auth_cleanup_guard.sh
test -f "$STATE" || { echo "FAIL-CLOSED: missing $STATE (run generate_playwright_state_novnc.sh first)"; exit 1; }

echo "FT_PROOF:PW_OPS_STATE_ONLY=1"

# Back up state.json before run (underlying runner deletes it on exit via trap)
cp "$STATE" "$STATE_BACKUP"
trap 'cp "$STATE_BACKUP" "$STATE" 2>/dev/null || true; rm -f "$STATE_BACKUP"' EXIT

bash scripts/proof/run_dashboard_playwright_stateonly.sh "$@"
