#!/usr/bin/env bash
# ensure_playwright_browsers.sh
# Fail-closed Playwright browser prerequisite check for marketplace release runner
# Usage: ensure_playwright_browsers.sh <evidence_dir>
# Exit 0 = browsers present or successfully installed, Exit 1 = FAIL

set -euo pipefail

# ============================================================================
# CONFIGURATION
# ============================================================================

if [ $# -ne 1 ]; then
  echo "ERROR: Usage: $0 <evidence_dir>" >&2
  exit 1
fi

E="$1"

# Ensure 06_e2e directory exists
mkdir -p "$E/06_e2e"

LOG_FILE="$E/06_e2e/playwright_install.log"
STATUS_FILE="$E/06_e2e/playwright_browsers_status.txt"

# Start logging
exec > >(tee -a "$LOG_FILE") 2>&1

echo "================================================================================"
echo "Playwright Browser Prerequisite Check"
echo "Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "================================================================================"
echo ""

# ============================================================================
# PHASE 1: VERIFY NODE TOOLING
# ============================================================================

echo "[1/4] Checking node tooling..."

if ! command -v node >/dev/null 2>&1; then
  echo "FAIL: node not found in PATH"
  echo "Install Node.js: https://nodejs.org/"
  echo "FAIL: node tooling missing" > "$STATUS_FILE"
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "FAIL: npm not found in PATH"
  echo "Install npm (usually comes with Node.js)"
  echo "FAIL: npm tooling missing" > "$STATUS_FILE"
  exit 1
fi

NODE_VERSION=$(node -v)
NPM_VERSION=$(npm -v)

echo "  ✓ node: $NODE_VERSION"
echo "  ✓ npm: $NPM_VERSION"
echo ""

# ============================================================================
# PHASE 2: VERIFY PLAYWRIGHT AVAILABLE
# ============================================================================

echo "[2/4] Checking Playwright availability..."

cd /workspaces/Firsttry/atlassian/forge-app

if ! npx --no-install playwright --version >/dev/null 2>&1; then
  echo "FAIL: Playwright not available via npx --no-install"
  echo "Install Playwright: npm install playwright"
  echo "FAIL: Playwright not in local dependencies" > "$STATUS_FILE"
  exit 1
fi

PW_VERSION=$(npx --no-install playwright --version 2>/dev/null || echo "unknown")

echo "  ✓ Playwright version: $PW_VERSION"
echo ""

# ============================================================================
# PHASE 3: CHECK CHROMIUM BROWSER EXECUTABLE
# ============================================================================

echo "[3/4] Checking Chromium browser executable..."

# Get chromium executable path from Playwright
PW_CHROME=""
if PW_CHROME=$(node -e "const {chromium}=require('playwright'); console.log(chromium.executablePath())" 2>/dev/null); then
  echo "  Chromium executable path: $PW_CHROME"
  
  if [ -f "$PW_CHROME" ] && [ -x "$PW_CHROME" ]; then
    echo "  ✓ Chromium browser present"
    echo ""
    echo "================================================================================"
    echo "Result: Browsers present"
    echo "================================================================================"
    echo "OK: browsers present" > "$STATUS_FILE"
    exit 0
  else
    echo "  ✗ Chromium executable not found at expected path"
  fi
else
  echo "  ✗ Failed to determine Chromium executable path"
fi

echo "  Chromium browser needs installation"
echo ""

# ============================================================================
# PHASE 4: INSTALL CHROMIUM (IF PERMITTED)
# ============================================================================

echo "[4/4] Installing Chromium browser..."

if [ "${FT_NO_PW_INSTALL:-0}" = "1" ]; then
  echo "FAIL: FT_NO_PW_INSTALL=1 blocks browser installation"
  echo "Remediation:"
  echo "  1. Unset FT_NO_PW_INSTALL to allow installation, or"
  echo "  2. Manually run: npx playwright install chromium"
  echo ""
  echo "================================================================================"
  echo "Result: Install required but not permitted"
  echo "================================================================================"
  echo "FAIL: install required but not permitted" > "$STATUS_FILE"
  exit 1
fi

echo "  Running: npx playwright install chromium"
echo ""

if npx playwright install chromium; then
  echo ""
  echo "  ✓ Installation completed"
  
  # Re-check executable path
  if PW_CHROME=$(node -e "const {chromium}=require('playwright'); console.log(chromium.executablePath())" 2>/dev/null); then
    echo "  Re-verified Chromium path: $PW_CHROME"
    
    if [ -f "$PW_CHROME" ] && [ -x "$PW_CHROME" ]; then
      echo "  ✓ Chromium browser verified"
      echo ""
      echo "================================================================================"
      echo "Result: Browsers installed successfully"
      echo "================================================================================"
      echo "OK: browsers installed" > "$STATUS_FILE"
      exit 0
    fi
  fi
  
  echo "  ✗ Installation succeeded but executable verification failed"
  echo "  This should not happen - please report as bug"
fi

echo ""
echo "================================================================================"
echo "Result: Installation failed"
echo "================================================================================"
echo "FAIL: install attempted but failed" > "$STATUS_FILE"
exit 1
