#!/usr/bin/env bash
set -euo pipefail

# FT_PROOF:STEP6_ALIAS=run_dashboard_playwright_novnc.sh
# Thin wrapper required by ops deploy protocol.
# Delegates to the canonical script; no behavior changes here.

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "${DIR}/run_playwright_with_novnc.sh" "$@"
