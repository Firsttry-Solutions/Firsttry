#!/bin/bash

# ensure_playwright_deps.sh
# 
# Ensures Playwright Chromium dependencies are installed.
# Runs a smoke check to fail fast if deps are missing.
#
# Exit codes:
#   0 - success (deps installed or not needed)
#   1 - deps install failed or smoke check failed
#   2 - invalid environment

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

echo "[PLAYWRIGHT_DEPS] Checking system..."
echo "[PLAYWRIGHT_DEPS] OS: $(uname -s)"

# Only attempt to install deps on Linux
if [[ "$(uname -s)" != "Linux" ]]; then
  echo "[PLAYWRIGHT_DEPS] ℹ️  Not on Linux. Skipping system deps install."
  echo "[PLAYWRIGHT_DEPS] (macOS/Windows have pre-installed browser dependencies)"
  exit 0
fi

echo "[PLAYWRIGHT_DEPS] 🔧 Installing Playwright deps for Linux..."

# Install playwright deps (includes system deps)
if ! npx playwright install --with-deps chromium 2>&1; then
  echo ""
  echo "[PLAYWRIGHT_DEPS] ❌ Playwright deps install FAILED"
  echo ""
  echo "Suggested fixes:"
  echo "  1. If in a container, bake deps into the image (recommended):"
  echo "     apt-get update && apt-get install -y chromium-browser libatk-1.0-0 libatk-bridge-2.0-0"
  echo "  2. Or run: sudo apt-get update && sudo apt-get install -y chromium-browser libatk-1.0-0 libatk-bridge-2.0-0"
  echo "  3. Or use: bash e2e/scripts/install_browser_deps.sh (if available)"
  echo ""
  exit 1
fi

echo "[PLAYWRIGHT_DEPS] ✓ Playwright deps installed"

# ════════════════════════════════════════════════════════════════════════════════
# SMOKE CHECK: Verify Playwright can be required and basic commands work
# ════════════════════════════════════════════════════════════════════════════════

echo ""
echo "[PLAYWRIGHT_DEPS] 🧪 Running smoke checks..."

# Check 1: Can require playwright
if ! node -e "require('playwright');" 2>&1; then
  echo "[PLAYWRIGHT_DEPS] ❌ Cannot require Playwright module"
  exit 1
fi
echo "[PLAYWRIGHT_DEPS] ✓ Playwright module loads"

# Check 2: Playwright version
if ! npx playwright --version 2>&1; then
  echo "[PLAYWRIGHT_DEPS] ❌ Cannot run playwright --version"
  exit 1
fi
echo "[PLAYWRIGHT_DEPS] ✓ Playwright --version works"

# Check 3: Can list tests (validates config and basic setup)
if ! npx playwright test -c "${REPO_ROOT}/e2e/playwright.config.ts" --list >/dev/null 2>&1; then
  echo "[PLAYWRIGHT_DEPS] ❌ Cannot list tests (config or setup issue)"
  exit 1
fi
echo "[PLAYWRIGHT_DEPS] ✓ Test listing works"

echo ""
echo "[PLAYWRIGHT_DEPS] ✅ All smoke checks passed!"
echo "[PLAYWRIGHT_DEPS] Ready to run E2E tests."
exit 0
