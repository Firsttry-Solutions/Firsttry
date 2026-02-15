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
  local EVIDENCE_DIR="$1"

  if [[ -z "${EVIDENCE_DIR:-}" ]]; then
    echo "[FT_PROOF] ERROR: require_forge_auth requires EVIDENCE_DIR arg"
    exit 1
  fi

  mkdir -p "$EVIDENCE_DIR"

  echo "[FT_PROOF] ═══════════════════════════════════════════════"
  echo "[FT_PROOF] STEP: Forge CLI Auth Precheck"
  echo "[FT_PROOF] ═══════════════════════════════════════════════"

  # --- 1. Binary Check ---
  if ! command -v forge >/dev/null 2>&1; then
    echo "[FT_PROOF] ERROR: forge CLI not found in PATH"
    echo "[FT_PROOF] REMEDIATION:"
    echo "[FT_PROOF] 1. Install @forge/cli globally:"
    echo "[FT_PROOF]    npm i -g @forge/cli"
    echo "[FT_PROOF] 2. Find npm's global bin directory:"
    echo "[FT_PROOF]    npm config get prefix"
    echo "[FT_PROOF]    (This will print a path like /usr/local or /home/user/.nvm/versions/node/vX.Y.Z)"
    echo "[FT_PROOF] 3. Ensure that path's bin/ is in your PATH:"
    echo "[FT_PROOF]    export PATH=\"\$(npm config get prefix)/bin:\$PATH\""
    echo "[FT_PROOF] 4. Verify:"
    echo "[FT_PROOF]    which forge"
    echo "[FT_PROOF]    forge --version"
    exit 1
  fi

  forge --version > "$EVIDENCE_DIR/01_forge_version.log" 2>&1
  FORGE_VER=$(cat "$EVIDENCE_DIR/01_forge_version.log")
  echo "[FT_PROOF] FORGE_VERSION=$FORGE_VER" | tee -a "$EVIDENCE_DIR/01_forge_version.log"
  echo "[FT_PROOF] Forge binary present"

  # --- 2. Auth Check ---
  if ! forge whoami > "$EVIDENCE_DIR/02_forge_whoami.log" 2>&1; then
    echo "[FT_PROOF] ERROR: Forge CLI not authenticated"
    echo "[FT_PROOF] REMEDIATION OPTIONS:"
    echo "[FT_PROOF] Option A: Interactive login (if keychain available):"
    echo "[FT_PROOF]   forge login"
    echo "[FT_PROOF] Option B: Environment variable auth (Codespaces-safe):"
    echo "[FT_PROOF]   export FORGE_EMAIL=\"your-atlassian-email@example.com\""
    echo "[FT_PROOF]   export FORGE_API_TOKEN=\"your-api-token\""
    echo "[FT_PROOF]   (See: https://go.atlassian.com/dac/platform/forge/getting-started/#log-in-with-an-atlassian-api-token)"
    echo "[FT_PROOF] CRITICAL: Never echo, log, or commit FORGE_API_TOKEN"
    echo "[FT_PROOF] CRITICAL: Never paste token into terminal or CI logs"
    echo "[FT_PROOF] After setting env vars, verify:"
    echo "[FT_PROOF]   forge whoami"
    exit 1
  fi

  echo "[FT_PROOF] Forge authentication OK"
  echo "[FT_PROOF] AUTH_GUARD_PASS"
  echo "[FT_PROOF] FORGE_AUTH_VERIFIED=true" >> "$EVIDENCE_DIR/02_forge_whoami.log"
}

