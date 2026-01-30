#!/usr/bin/env bash
set -euo pipefail

# Fail-closed gate: verify diagnostic probe is properly configured
# In Forge v12+, webhooks module is not supported; FT_DIAG_TOKEN is set via Forge variables

if ! rg -n "ft-diag-probe-fn" manifest.yml >/dev/null 2>&1; then
  echo "FAIL: Diagnostic probe function (ft-diag-probe-fn) not found in manifest.yml"
  echo "ACTION: Verify function definitions include ft-diag-probe-fn"
  exit 1
fi

if ! [ -f "src/diagnostic/probe.ts" ]; then
  echo "FAIL: Diagnostic probe handler (src/diagnostic/probe.ts) not found"
  echo "ACTION: Create src/diagnostic/probe.ts with probe handler"
  exit 1
fi

# Note: webhooks module removed in Forge v12 compatibility fix
# FT_DIAG_TOKEN is now managed via Forge variables (set during deployment)
# Previously checked in app.environment, now managed via forge variables set

echo "PASS: Diagnostic probe handler verified (Forge v12 compatible)"
exit 0
