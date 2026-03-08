#!/usr/bin/env bash
set -euo pipefail

# Verify no fatal UI bridge markers in dist bundle
# Fail if the bundle contains unconditional top-level fatal errors

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."  # vendor tree root

echo "[verify_no_fatal_ui_bridge_in_dist] Checking dist for fatal markers..."

# Search for the exact error markers that would cause top-level crash
if rg -n "\[FATAL_UI_BRIDGE\]|throw Rn;|throw new Error\\(\"\\[FATAL_UI_BRIDGE\\]" src/gadget-ui/dist >/dev/null 2>&1; then
  echo "FAIL: Fatal UI bridge markers found in dist bundle"
  echo "The bundle must not contain unconditional top-level throws"
  echo ""
  echo "Found markers:"
  rg -n "\[FATAL_UI_BRIDGE\]|throw Rn;|throw new Error\\(\"\\[FATAL_UI_BRIDGE\\]" src/gadget-ui/dist || true
  exit 1
fi

echo "OK: No fatal UI bridge markers in dist bundle"
exit 0
