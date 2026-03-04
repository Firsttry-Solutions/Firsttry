#!/bin/bash
# Marketplace Screenshot Capture Script
# Generates 3 real screenshots of the running Forge app via Playwright.
# Screenshots are saved to docs/marketplace/screenshots/ and validated.
#
# Supports two modes — set exactly one:
#
# MODE A — Jira Dashboard Gadget (this app):
#   Required:
#     JIRA_DASHBOARD_URL  e.g. https://firsttry.atlassian.net/jira/dashboards/10102
#     JIRA_EMAIL          Atlassian account email
#     JIRA_PASSWORD       Atlassian account password
#   Optional:
#     PLAYWRIGHT_STORAGE_STATE_PATH  path to cached auth state JSON (skips login)
#
# MODE B — Direct URL app (Forge full-page / custom tunnel):
#   Required:
#     FORGE_TUNNEL_URL  direct HTTPS URL that renders app without login
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
FORGE_APP_DIR="$REPO_ROOT/atlassian/forge-app"
OUTPUT_DIR="$REPO_ROOT/docs/marketplace/screenshots"
mkdir -p "$OUTPUT_DIR"

echo "[INFO] Marketplace Screenshot Capture"
echo "[INFO] Repo root:         $REPO_ROOT"
echo "[INFO] Output directory:  $OUTPUT_DIR"

# ── Determine mode ────────────────────────────────────────────────────────────
JIRA_DASHBOARD_URL="${JIRA_DASHBOARD_URL:-}"
FORGE_TUNNEL_URL="${FORGE_TUNNEL_URL:-}"
PLAYWRIGHT_STORAGE_STATE_PATH="${PLAYWRIGHT_STORAGE_STATE_PATH:-}"
JIRA_EMAIL="${JIRA_EMAIL:-}"
JIRA_PASSWORD="${JIRA_PASSWORD:-}"

if [ -n "$JIRA_DASHBOARD_URL" ]; then
  CAPTURE_MODE="jira"
elif [ -n "$FORGE_TUNNEL_URL" ]; then
  CAPTURE_MODE="tunnel"
else
  echo ""
  echo "[FATAL] No URL provided. Set one of:"
  echo ""
  echo "  MODE A — Jira Dashboard Gadget (this app):"
  echo "    export JIRA_DASHBOARD_URL='https://firsttry.atlassian.net/jira/dashboards/10102'"
  echo "    export JIRA_EMAIL='your-email@example.com'"
  echo "    export JIRA_PASSWORD='your-password'"
  echo ""
  echo "  MODE B — Direct URL app (Forge full-page / custom tunnel):"
  echo "    export FORGE_TUNNEL_URL='https://abc123.tunnel.dev.atlassian.io'"
  echo ""
  exit 2
fi

echo "[INFO] Capture mode: $CAPTURE_MODE"

# ── Mode-specific prerequisite validation ────────────────────────────────────
if [ "$CAPTURE_MODE" = "jira" ]; then
  # Validate JIRA_DASHBOARD_URL format
  if ! echo "$JIRA_DASHBOARD_URL" | grep -qE '^https://[A-Za-z0-9.-]+(:[0-9]+)?/'; then
    echo "[FATAL] JIRA_DASHBOARD_URL does not look like a valid HTTPS URL."
    echo "  Received: $JIRA_DASHBOARD_URL"
    echo "  Expected: https://<site>.atlassian.net/jira/dashboards/<id>"
    exit 2
  fi
  echo "[INFO] JIRA_DASHBOARD_URL: $JIRA_DASHBOARD_URL"

  # Check auth: either storage state or email+password
  if [ -z "$PLAYWRIGHT_STORAGE_STATE_PATH" ]; then
    if [ -z "$JIRA_EMAIL" ] || [ -z "$JIRA_PASSWORD" ]; then
      echo ""
      echo "[FATAL] JIRA auth required. Set one of:"
      echo "  Option A — email + password:"
      echo "    export JIRA_EMAIL='your-email@example.com'"
      echo "    export JIRA_PASSWORD='your-password'"
      echo "  Option B — cached auth state:"
      echo "    export PLAYWRIGHT_STORAGE_STATE_PATH='tests/playwright/.auth/state.json'"
      echo ""
      exit 2
    fi
    echo "[INFO] JIRA_EMAIL: $JIRA_EMAIL  [will authenticate]"
  else
    if [ ! -f "$PLAYWRIGHT_STORAGE_STATE_PATH" ]; then
      echo "[FATAL] PLAYWRIGHT_STORAGE_STATE_PATH set but file not found: $PLAYWRIGHT_STORAGE_STATE_PATH"
      exit 2
    fi
    echo "[INFO] Using cached auth state: $PLAYWRIGHT_STORAGE_STATE_PATH"
  fi
else
  # TUNNEL mode — validate FORGE_TUNNEL_URL
  _TUNNEL_URL_VAL="$FORGE_TUNNEL_URL"

  # Reject template / placeholder values
  if echo "$_TUNNEL_URL_VAL" | grep -qE '[<>]|your-tunnel-id|<tunnel-host>'; then
    echo ""
    echo "[FATAL] FORGE_TUNNEL_URL looks like a template placeholder, not a real URL."
    echo "  Received: $_TUNNEL_URL_VAL"
    echo "  Paste the EXACT URL printed by 'forge tunnel'."
    exit 2
  fi

  # Reject inline whitespace
  if echo "$_TUNNEL_URL_VAL" | grep -qP '\s'; then
    echo "[FATAL] FORGE_TUNNEL_URL contains whitespace. Received: '$_TUNNEL_URL_VAL'"
    exit 2
  fi

  # Require https:// with valid host
  if ! echo "$_TUNNEL_URL_VAL" | grep -qE '^https://[A-Za-z0-9.-]+(:[0-9]+)?(/.*)?$'; then
    echo ""
    echo "[FATAL] FORGE_TUNNEL_URL does not match required format."
    echo "  Received:  $_TUNNEL_URL_VAL"
    echo "  Expected:  https://<hostname>[:<port>][/<path>]"
    exit 2
  fi

  # Node-level URL parse
  if ! node -e 'new URL(process.env.FORGE_TUNNEL_URL); console.log("URL_OK")' 2>/dev/null | grep -q 'URL_OK'; then
    echo "[FATAL] Invalid FORGE_TUNNEL_URL — Node.js URL parser rejected it."
    echo "  Received: $_TUNNEL_URL_VAL"
    exit 2
  fi

  echo "[INFO] FORGE_TUNNEL_URL: $_TUNNEL_URL_VAL  [validated]"
fi

# ── Prerequisite: Node / npx ──────────────────────────────────────────────
if ! command -v npx >/dev/null 2>&1; then
  echo "[FATAL] npx not found. Install Node.js >= 18 and re-run."
  exit 2
fi

# ── Prerequisite: Forge CLI (tunnel mode only) ────────────────────────────
# Only needed when using FORGE_TUNNEL_URL; not required for JIRA_DASHBOARD_URL mode.
if [ "$CAPTURE_MODE" = "tunnel" ] && ! command -v forge >/dev/null 2>&1; then
  echo ""
  echo "[FATAL] Forge CLI not found (required for tunnel mode)."
  echo ""
  echo "Install:"
  echo "  npm install -g @forge/cli"
  echo "Verify:"
  echo "  forge --version"
  echo "Then start the tunnel and capture screenshots:"
  echo "  cd atlassian/forge-app && forge tunnel"
  echo "  export FORGE_TUNNEL_URL='https://<printed-tunnel-url>'"
  echo "  bash tools/marketplace/readiness/capture_marketplace_screenshots.sh"
  echo ""
  exit 2
fi

# ── Install / update npm dependencies ────────────────────────────────────────
echo "[INFO] Installing npm dependencies in atlassian/forge-app..."
cd "$FORGE_APP_DIR"
npm ci --prefer-offline 2>&1 | tail -5

# ── Install Playwright browser (Chromium) ────────────────────────────────────
if [ -z "${PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD:-}" ]; then
  echo "[INFO] Installing Playwright Chromium browser..."
  npx playwright install --with-deps chromium 2>&1 | tail -10
else
  echo "[INFO] PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD set — skipping browser install."
  # Verify Chromium is actually available; fail with guidance if not.
  if ! npx playwright install --dry-run chromium 2>&1 | grep -qi "chromium"; then
    if ! ls "$HOME/.cache/ms-playwright/chromium-"* >/dev/null 2>&1; then
      echo "[FATAL] Chromium browser not found and PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD is set."
      echo "Either unset PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD or pre-install Chromium with:"
      echo "  npx playwright install chromium"
      exit 2
    fi
  fi
fi

# ── Run the Playwright test ──────────────────────────────────────────────────
echo "[INFO] Launching Playwright to capture screenshots..."
export REPO_ROOT
export JIRA_DASHBOARD_URL
export FORGE_TUNNEL_URL
export JIRA_EMAIL
export JIRA_PASSWORD
export PLAYWRIGHT_STORAGE_STATE_PATH

if ! npx playwright test \
      --config playwright.marketplace.config.ts \
      tests/playwright/marketplace_screenshots.spec.ts \
      2>&1; then
  echo ""
  echo "[FATAL] Playwright screenshot test failed."
  if [ "$CAPTURE_MODE" = "jira" ]; then
    echo "Debug checklist:"
    echo "  1. Is your Jira site reachable?  curl -I $JIRA_DASHBOARD_URL"
    echo "  2. Are credentials correct?  JIRA_EMAIL=$JIRA_EMAIL"
    echo "  3. Is the gadget installed on dashboard $JIRA_DASHBOARD_URL ?"
  else
    echo "Check browser install with: npx playwright install --with-deps chromium"
  fi
  exit 1
fi

# ── Validate the 3 required output files ─────────────────────────────────────
echo "[INFO] Validating captured screenshots..."

REQUIRED_FILES=(
  "marketplace_01_main.png"
  "marketplace_02_evidence.png"
  "marketplace_03_about.png"
)
VALID_COUNT=0

for NAME in "${REQUIRED_FILES[@]}"; do
  IMG="$OUTPUT_DIR/$NAME"

  if [ ! -f "$IMG" ]; then
    echo "[FATAL] Required screenshot missing: $NAME"
    echo "  Expected path: $IMG"
    exit 1
  fi

  # Size check (>= 30 KB = 30720 bytes)
  SIZE=$(stat -c%s "$IMG" 2>/dev/null || stat -f%z "$IMG" 2>/dev/null || echo "0")
  if [ "$SIZE" -lt 30720 ]; then
    echo "[FATAL] Screenshot too small: $NAME ($SIZE bytes, need >= 30720)"
    exit 1
  fi

  # file(1) type check
  FILE_TYPE=$(file -b "$IMG")
  if ! echo "$FILE_TYPE" | grep -qi "PNG image data"; then
    echo "[FATAL] $NAME is not a PNG image. file(1) says: $FILE_TYPE"
    exit 1
  fi

  # xxd magic-byte check (PNG: 89 50 4e 47 0d 0a 1a 0a)
  MAGIC=$(xxd -p -l 8 "$IMG" | tr -d '\n')
  if [ "$MAGIC" != "89504e470d0a1a0a" ]; then
    echo "[FATAL] $NAME has invalid PNG magic bytes (got: $MAGIC)"
    exit 1
  fi

  SIZE_KB=$((SIZE / 1024))
  echo "[OK] $NAME — ${SIZE_KB} KB, valid PNG signature"
  VALID_COUNT=$((VALID_COUNT + 1))
done

if [ "$VALID_COUNT" -lt 3 ]; then
  echo "[FATAL] Only $VALID_COUNT of 3 required screenshots passed validation."
  exit 1
fi

echo ""
echo "[OK] All 3 marketplace screenshots captured and validated."
echo "[OK] Output: $OUTPUT_DIR"
exit 0
