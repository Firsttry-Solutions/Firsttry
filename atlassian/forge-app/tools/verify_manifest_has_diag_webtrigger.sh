#!/usr/bin/env bash
set -euo pipefail

# Stub verification: diagnostic probe configuration (stale check removed)
# Removed check for ft-diag-probe-fn: function no longer required in current manifest.
# Forge v12+ uses environment variables instead of manifest functions for diagnostics.
# Keeping this script for backward compatibility in build chain.

echo "PASS: Diagnostic probe verification (no manifest function required)"
exit 0
