#!/usr/bin/env bash
set -euo pipefail
export LC_ALL=C

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UI_DIR="$ROOT/src/gadget-ui"

echo "[build_gadget_ui] ui_dir=$UI_DIR"
cd "$UI_DIR"

echo "[build_gadget_ui] node=$(node -v 2>/dev/null || echo UNKNOWN) npm=$(npm -v 2>/dev/null || echo UNKNOWN)"

if [ -f package-lock.json ]; then
  echo "[build_gadget_ui] npm ci"
  npm ci
else
  echo "[build_gadget_ui] npm install"
  npm install
fi

echo "[build_gadget_ui] npm run build"
npm run build

cd "$ROOT"

echo "[build_gadget_ui] verifying proof markers exist in dist..."
rg -n "UI_BUILD_PROOF|\[✓ BUILD PROOF\]|UI\+Backend versions verified in real-time" src/gadget-ui/dist -S >/dev/null || {
  echo "FAIL: proof markers not found in dist after build"
  echo "DEBUG: printing dist hits (first 50 lines):"
  rg -n "UI_BUILD_PROOF|\[✓ BUILD PROOF\]|UI\+Backend versions verified in real-time" src/gadget-ui/dist -S | head -50 || true
  exit 1
}
echo "[build_gadget_ui] OK: proof markers present in dist"
