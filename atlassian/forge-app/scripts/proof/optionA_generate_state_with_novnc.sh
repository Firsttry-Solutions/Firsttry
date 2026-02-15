#!/usr/bin/env bash
set -euo pipefail

# Option A: Generate Playwright Storage State for Jira Cloud SSO
# Runs in Codespaces with noVNC interactive login (manual SSO, no passwords)
# Fail-closed: exits 1 if state.json is not created
# No secrets logged to stdout/stderr

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../" && pwd)"

# === CREATE EVIDENCE DIRECTORY ===
TIMESTAMP=$(date -u +%Y%m%dT%H%M%SZ)
EVIDENCE_DIR="/tmp/ft_optionA_state_${TIMESTAMP}"
mkdir -p "$EVIDENCE_DIR"
echo "EVIDENCE_DIR=${EVIDENCE_DIR}"

# === HELPER: Fail-closed on error ===
fail_closed() {
  local msg="$1"
  echo "[OPTION_A] ❌ FATAL: $msg" >&2
  echo "[OPTION_A] Evidence preserved at: ${EVIDENCE_DIR}" >&2
  exit 1
}

# === VALIDATE ENVIRONMENT ===
if [[ -z "${JIRA_BASE_URL:-}" ]]; then
  fail_closed "JIRA_BASE_URL not set"
fi

if [[ "${JIRA_BASE_URL}" != "https://firsttry.atlassian.net" ]]; then
  fail_closed "JIRA_BASE_URL must equal 'https://firsttry.atlassian.net', got '${JIRA_BASE_URL}'"
fi

echo "[OPTION_A] ✓ Environment validated"

# === START NOVNC DISPLAY STACK (MANUAL MODE) ===
echo "[OPTION_A] Starting noVNC display stack in manual mode..."

# Export environment for run_playwright_with_novnc.sh
export DISPLAY=":99"
export FT_PW_AUTH_MODE="manual"
export FT_AUTH_GENERATE_STATE="1"
export FT_PLAYWRIGHT_MODE="headed"
export JIRA_BASE_URL

# Call the display stack starter script; capture PID/logs
if bash "${SCRIPT_DIR}/run_playwright_with_novnc.sh" \
  > "$EVIDENCE_DIR/01_novnc_start.log" 2>&1 &
then
  NOVNC_PID=$!
  echo "[OPTION_A] noVNC stack started (PID: $NOVNC_PID)"
else
  fail_closed "Failed to start noVNC display stack"
fi

# === CLEANUP TRAP ===
cleanup() {
  echo "[OPTION_A] Cleaning up..."
  if kill $NOVNC_PID 2>/dev/null; then
    wait $NOVNC_PID 2>/dev/null || true
    echo "[OPTION_A] noVNC stack terminated"
  fi
}
trap cleanup EXIT

# === WAIT FOR DISPLAY TO BECOME READY ===
echo "[OPTION_A] Waiting for DISPLAY=:99 to be ready (max 30s)..."
DISPLAY_READY=0
for i in {1..30}; do
  if xdpyinfo -display ":99" > /dev/null 2>&1; then
    DISPLAY_READY=1
    echo "[OPTION_A] ✓ DISPLAY=:99 ready"
    break
  fi
  sleep 1
done

if [[ $DISPLAY_READY -eq 0 ]]; then
  fail_closed "DISPLAY=:99 did not become ready after 30s"
fi

# === RUN STATE GENERATION ===
echo "[OPTION_A] Running Playwright state generation..."
cd "${REPO_ROOT}"

if bash scripts/proof/generate_playwright_state.sh \
  > "$EVIDENCE_DIR/02_generate_state.log" 2>&1
then
  echo "[OPTION_A] ✓ State generation completed"
else
  GEN_EXIT=$?
  echo "[OPTION_A] ❌ State generation failed (exit code: $GEN_EXIT)"
  echo "[OPTION_A] Log:" >&2
  cat "$EVIDENCE_DIR/02_generate_state.log" | tail -50 >&2
  fail_closed "generate_playwright_state.sh failed"
fi

# === VERIFY STATE FILE EXISTS AND IS NON-EMPTY ===
STATE_FILE="tests/playwright/.auth/state.json"

if [[ ! -f "$STATE_FILE" ]]; then
  fail_closed "state.json not found at ${STATE_FILE}"
fi

# Log file stats (no content)
ls -lh "$STATE_FILE" > "$EVIDENCE_DIR/03_state_file_stat.log"
STATE_SIZE=$(stat -c%s "$STATE_FILE" 2>/dev/null || stat -f%z "$STATE_FILE" 2>/dev/null || echo "0")

if [[ "$STATE_SIZE" -lt 200 ]]; then
  fail_closed "state.json too small (${STATE_SIZE} bytes, expected >= 200)"
fi

echo "[OPTION_A] ✓ state.json exists and is valid ($(stat -c%s "$STATE_FILE" 2>/dev/null || stat -f%z "$STATE_FILE" 2>/dev/null) bytes)"

# Validate JSON structure
if node -e "const fs = require('fs'); JSON.parse(fs.readFileSync('$STATE_FILE', 'utf-8')); console.log('JSON_VALID')" > /dev/null 2>&1; then
  echo "[OPTION_A] ✓ state.json is valid JSON"
else
  fail_closed "state.json is not valid JSON"
fi

# === BASE64 ENCODE STATE (TO FILE ONLY) ===
echo "[OPTION_A] Encoding state.json to base64..."
base64 -w 0 "$STATE_FILE" > /tmp/state.b64

# Verify base64 file
B64_SIZE=$(stat -c%s /tmp/state.b64 2>/dev/null || stat -f%z /tmp/state.b64 2>/dev/null)
B64_SHA=$(sha256sum /tmp/state.b64 2>/dev/null || shasum -a 256 /tmp/state.b64 2>/dev/null | awk '{print $1}')

echo "[OPTION_A] Base64 encoding: ${B64_SIZE} bytes, SHA256=${B64_SHA}" | tee "$EVIDENCE_DIR/04_state_b64_stat.log"
echo "[OPTION_A] ✓ Base64 file written to /tmp/state.b64 (NOT ECHOED TO STDOUT)"

# === INSTRUCTIONS ===
echo ""
echo "╔═════════════════════════════════════════════════════════════════════════╗"
echo "║ ✅ PLAYWRIGHT STATE GENERATION COMPLETE                                 ║"
echo "╚═════════════════════════════════════════════════════════════════════════╝"
echo ""
echo "State file: ${STATE_FILE}"
echo "File size: ${STATE_SIZE} bytes"
echo "Base64 file: /tmp/state.b64"
echo "Evidence directory: ${EVIDENCE_DIR}"
echo ""
echo "NEXT STEPS:"
echo ""
echo "1️⃣  For LOCAL TESTING (Codespaces):"
echo "   export FT_PLAYWRIGHT_STATE_B64=\"\$(cat /tmp/state.b64)\""
echo ""
echo "2️⃣  For GITHUB ACTIONS (permanent):"
echo "   Go to: https://github.com/Firsttry-Solutions/Firsttry/settings/secrets/actions"
echo "   Create secret: FT_PLAYWRIGHT_STATE_B64"
echo "   Value: (contents of /tmp/state.b64 — do NOT paste here; copy from file)"
echo ""
echo "⚠️  SECURITY REMINDERS:"
echo "   - Never echo /tmp/state.b64 to terminal or logs"
echo "   - Never commit state.json to git (verify .gitignore)"
echo "   - If state is leaked, regenerate using this script"
echo "   - Rotate state annually or after new Jira login changes"
echo ""
echo "For detailed docs, see: docs/PLAYWRIGHT_SSO_AUTH_STATE.md (Option A section)"
echo ""

# === VERIFY NOT TRACKED ===
echo "[OPTION_A] Verifying state.json is not git-tracked..."
if git ls-files --error-unmatch "$STATE_FILE" > /dev/null 2>&1; then
  echo "[OPTION_A] ⚠️  WARNING: state.json appears to be git-tracked" >&2
  echo "[OPTION_A] Run: git rm --cached $STATE_FILE" >&2
else
  echo "[OPTION_A] ✓ state.json is not git-tracked"
fi

echo ""
echo "[OPTION_A] ✅ SUCCESS: State generation complete"
exit 0
