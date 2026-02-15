#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# Forge CLI Auth Guard — FAIL CLOSED
# ============================================================================
# Verifies:
#   1. forge binary exists
#   2. forge whoami succeeds
# Produces:
#   - 01_forge_version.log
#   - 02_forge_whoami.log
# Fails closed if not authenticated.
# ============================================================================

require_forge_auth() {
  local EVID_DIR="$1"

  if [[ -z "${EVID_DIR:-}" ]]; then
    echo "[FT_PROOF] ERROR: require_forge_auth requires EVID_DIR arg"
    exit 1
  fi

  mkdir -p "$EVID_DIR"

  echo "[FT_PROOF] ═══════════════════════════════════════════════"
  echo "[FT_PROOF] STEP: Forge CLI Auth Precheck"
  echo "[FT_PROOF] ═══════════════════════════════════════════════"

  # --- 1. Binary Check ---
  if ! command -v forge >/dev/null 2>&1; then
    echo "[FT_PROOF] ERROR: forge CLI not found in PATH"
    echo "[FT_PROOF] REMEDIATION:"
    echo "  npm i -g @forge/cli"
    exit 1
  fi

  forge --version > "$EVID_DIR/01_forge_version.log" 2>&1
  echo "[FT_PROOF] Forge binary present"

  # --- 2. Auth Check ---
  if ! forge whoami > "$EVID_DIR/02_forge_whoami.log" 2>&1; then
    echo "[FT_PROOF] ERROR: Forge CLI not authenticated"
    echo "[FT_PROOF] REMEDIATION OPTIONS:"
    echo "  Option A: forge login"
    echo "  Option B:"
    echo "    export FORGE_EMAIL=\"your-email\""
    echo "    export FORGE_API_TOKEN=\"your-api-token\""
    echo "[FT_PROOF] See Atlassian docs:"
    echo "  https://go.atlassian.com/dac/platform/forge/getting-started/#log-in-with-an-atlassian-api-token"
    exit 1
  fi

  echo "[FT_PROOF] Forge authentication OK"
  echo "[FT_PROOF] AUTH_GUARD_PASS"
}
