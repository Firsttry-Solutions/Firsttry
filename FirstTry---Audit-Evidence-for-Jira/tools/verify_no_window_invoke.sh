#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."  # vendor tree root
if rg -n "window\.invoke" src/gadget-ui/src >/dev/null; then
  echo "FAIL: window.invoke still present in UI source"
  rg -n "window\.invoke" src/gadget-ui/src || true
  exit 1
fi
echo "OK: window.invoke not present in UI source"
