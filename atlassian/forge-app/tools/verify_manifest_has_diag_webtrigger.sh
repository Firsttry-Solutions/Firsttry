#!/usr/bin/env bash
set -euo pipefail

# Fail-closed gate: verify diagnostic webtrigger is present in manifest
# This gate ensures the manifest declares the diagnostic probe handler.

if ! rg -n "ft-diag-probe" manifest.yml >/dev/null 2>&1; then
  echo "FAIL: Diagnostic webtrigger (ft-diag-probe) not found in manifest.yml"
  echo "ACTION: Add webtrigger module + handler to manifest.yml"
  exit 1
fi

if ! rg -n "FT_DIAG_TOKEN" manifest.yml >/dev/null 2>&1; then
  echo "FAIL: FT_DIAG_TOKEN environment variable not found in manifest.yml"
  echo "ACTION: Add environment.variables.FT_DIAG_TOKEN to app section"
  exit 1
fi

if ! [ -f "src/diagnostic/probe.ts" ]; then
  echo "FAIL: Diagnostic probe handler (src/diagnostic/probe.ts) not found"
  echo "ACTION: Create src/diagnostic/probe.ts with webtrigger handler"
  exit 1
fi

echo "PASS: Diagnostic webtrigger verified in manifest and handler present"
exit 0
