#!/bin/bash
# install_state_from_env.sh
# Purpose: Install state.json from CI secret (FT_AUTH_STATE_JSON_B64) without printing it.
# Used by GitHub Actions to inject cached auth state for state-only mode testing.

set -euo pipefail

# ============================================================================
# Configuration
# ============================================================================
FT_AUTH_STATE_JSON_B64="${FT_AUTH_STATE_JSON_B64:-}"
STATE_FILE="tests/playwright/.auth/state.json"
STATE_DIR="$(dirname "$STATE_FILE")"

# ============================================================================
# Create runner-owned install output directory
# ============================================================================
INSTALL_DIR="/tmp/pw_state_install_$(date -u +"%Y-%m-%dT%H%M%SZ")"
mkdir -p "$INSTALL_DIR"
echo "[STATE_INSTALL] Output directory: $INSTALL_DIR"

# ============================================================================
# Validate preconditions
# ============================================================================
RESULT="OK"
REASON_CODE="STATE_INSTALL_OK"
STATE_BYTES=0

if [ -z "$FT_AUTH_STATE_JSON_B64" ]; then
  RESULT="FAIL"
  REASON_CODE="STATE_ENV_MISSING"
  echo "[STATE_INSTALL] ERROR: FT_AUTH_STATE_JSON_B64 environment variable not set" >&2
else
  # ============================================================================
  # Decode and install state
  # ============================================================================
  mkdir -p "$STATE_DIR"
  
  if echo "$FT_AUTH_STATE_JSON_B64" | base64 -d > "$STATE_FILE" 2>/dev/null; then
    # Set restrictive permissions
    chmod 0600 "$STATE_FILE"
    
    STATE_BYTES=$(stat -f%z "$STATE_FILE" 2>/dev/null || stat -c%s "$STATE_FILE" 2>/dev/null)
    
    if [ "$STATE_BYTES" -lt 200 ]; then
      RESULT="FAIL"
      REASON_CODE="STATE_FILE_TOO_SMALL"
      echo "[STATE_INSTALL] ERROR: Decoded state file too small ($STATE_BYTES bytes, need >= 200)" >&2
    else
      # Validate JSON and check for cookies/origins
      if node -e "const fs = require('fs'); JSON.parse(fs.readFileSync('$STATE_FILE', 'utf-8'))" 2>/dev/null; then
        if node -e "
          const fs = require('fs');
          const s = JSON.parse(fs.readFileSync('$STATE_FILE', 'utf-8'));
          const ok = (Array.isArray(s.cookies) && s.cookies.length > 0) || (Array.isArray(s.origins) && s.origins.length > 0);
          if (!ok) process.exit(2);
        " 2>/dev/null; then
          RESULT="OK"
          REASON_CODE="STATE_INSTALL_OK"
          echo "[STATE_INSTALL] ✓ State installed successfully: $STATE_BYTES bytes, has cookies/origins"
        else
          RESULT="FAIL"
          REASON_CODE="STATE_FILE_EMPTY_SECTIONS"
          echo "[STATE_INSTALL] ERROR: Decoded state file missing cookies/origins sections" >&2
        fi
      else
        RESULT="FAIL"
        REASON_CODE="STATE_FILE_INVALID"
        echo "[STATE_INSTALL] ERROR: Decoded state file is not valid JSON" >&2
      fi
    fi
  else
    RESULT="FAIL"
    REASON_CODE="STATE_DECODE_FAILED"
    echo "[STATE_INSTALL] ERROR: Failed to decode base64 state from environment" >&2
  fi
fi

# ============================================================================
# Write deterministic evidence JSON (no timestamps inside)
# ============================================================================
EVIDENCE_FILE="$INSTALL_DIR/state-install-result.json"
node -e "
const fs = require('fs');
const evidence = {
  result: '$RESULT',
  reasonCode: '$REASON_CODE',
  statePath: '$STATE_FILE',
  stateBytes: $STATE_BYTES
};
fs.writeFileSync('$EVIDENCE_FILE', JSON.stringify(evidence, Object.keys(evidence).sort(), 2) + '\n');
" 2>/dev/null || true

echo "[STATE_INSTALL] Evidence written to $EVIDENCE_FILE"
cat "$EVIDENCE_FILE"

# ============================================================================
# Exit with appropriate code
# ============================================================================
if [ "$RESULT" = "OK" ]; then
  echo "[STATE_INSTALL] ✓ State installation successful"
  exit 0
else
  echo "[STATE_INSTALL] ✗ State installation failed: $REASON_CODE" >&2
  exit 1
fi
