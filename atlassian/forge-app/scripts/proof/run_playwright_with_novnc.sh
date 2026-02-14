#!/usr/bin/env bash
set -euo pipefail

# Playwright Dashboard Diagnostics with noVNC Viewer
# Runs headed Playwright via Xvfb + noVNC for observation in Codespaces
# Guarantees auth setup runs first with project dependencies

# === MANUAL LOGIN MODE DETECTION ===
if [[ "${PW_MANUAL_LOGIN:-}" == "1" ]]; then
  echo "[PW_NOVNC] MANUAL MODE: do NOT run this script under 'timeout' or login will be interrupted."
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../" && pwd)"

# === STRICT ENV VALIDATION ===
if [[ -z "${JIRA_BASE_URL:-}" ]]; then
  echo "[PW_NOVNC] ERROR: JIRA_BASE_URL not set"
  exit 1
fi

EXPECTED_BASE_URL="https://firsttry.atlassian.net"
if [[ "${JIRA_BASE_URL}" != "${EXPECTED_BASE_URL}" ]]; then
  echo "[PW_NOVNC] ERROR: JIRA_BASE_URL must equal exactly '${EXPECTED_BASE_URL}', got '${JIRA_BASE_URL}'"
  exit 1
fi

if [[ -z "${JIRA_DASHBOARD_URL:-}" ]]; then
  echo "[PW_NOVNC] ERROR: JIRA_DASHBOARD_URL not set"
  exit 1
fi

EXPECTED_DASHBOARD_URL="https://firsttry.atlassian.net/jira/dashboards/10102"
if [[ "${JIRA_DASHBOARD_URL}" != "${EXPECTED_DASHBOARD_URL}" ]]; then
  echo "[PW_NOVNC] ERROR: JIRA_DASHBOARD_URL must equal exactly '${EXPECTED_DASHBOARD_URL}', got '${JIRA_DASHBOARD_URL}'"
  exit 1
fi

# === CREATE DETERMINISTIC RUN ROOT ===
RUN_TS=$(date -u +%Y%m%dT%H%M%SZ)
RUN_ROOT="/tmp/pw_novnc_run_${RUN_TS}"
mkdir -p "$RUN_ROOT"
echo "[PW_NOVNC] RUN_ROOT=${RUN_ROOT}"

# === DISPLAY AND XVFB CONFIGURATION ===
export DISPLAY=":99"
XVFB_WHD="${XVFB_WHD:-1920x1080x24}"
VNC_PORT="${VNC_PORT:-5901}"
NOVNC_PORT="${NOVNC_PORT:-6080}"

# === DETERMINISTIC FULL STACK INSTALL ===
echo "[PW_NOVNC] Installing full noVNC display stack (xvfb, fluxbox, x11vnc, novnc, websockify, x11-utils)..."

# Remove problematic repos not needed for proof harness (if they exist)
# Yarn repo not required - remove to avoid signature verification failures
sudo rm -f /etc/apt/sources.list.d/yarn.list 2>/dev/null || true

# === APT SUPPLY CHAIN INTEGRITY GATE (FAIL-CLOSED) ===
# All apt operations logged to single file for reviewable audit
APT_LOG="$RUN_ROOT/apt.log"
echo "[PW_NOVNC] APT_INTEGRITY_LOG=${APT_LOG}"

# Run apt-get update with integrity verification
if ! sudo apt-get update -qq > "$APT_LOG" 2>&1; then
  echo "[PW_NOVNC] ERROR: apt-get update command failed (exit code $?)"
  cat "$APT_LOG" >&2
  exit 1
fi

# Fail-closed: Check for ANY apt signature/trust verification errors
# These patterns indicate supply-chain compromise or key rotation issues
APT_ERROR_PATTERNS=("NO_PUBKEY" "signatures couldn't be verified" "The repository is not updated" "Failed to fetch" "GPG error:")
APT_ERRORS_FOUND=0

for pattern in "${APT_ERROR_PATTERNS[@]}"; do
  if grep -q "$pattern" "$APT_LOG"; then
    echo "[PW_NOVNC] ❌ FAILED: APT_INTEGRITY - Found '$pattern' in apt update output"
    echo "[PW_NOVNC] ERROR: Log: ${APT_LOG}"
    echo "[PW_NOVNC] ERROR: Matching lines:"
    grep -n "$pattern" "$APT_LOG" >&2
    APT_ERRORS_FOUND=1
  fi
done

if [ "$APT_ERRORS_FOUND" -eq 1 ]; then
  exit 1
fi

# Run apt-get install and append to same audit log
echo "" >> "$APT_LOG"
echo "[apt-get install command]" >> "$APT_LOG"
if ! sudo apt-get install -y -qq xvfb fluxbox x11vnc novnc websockify x11-utils >> "$APT_LOG" 2>&1; then
  echo "[PW_NOVNC] ERROR: apt-get install command failed (exit code $?)"
  tail -100 "$APT_LOG" >&2
  exit 1
fi

# Fail-closed: Check install output for same error patterns
APT_ERRORS_FOUND=0
for pattern in "${APT_ERROR_PATTERNS[@]}"; do
  if grep -q "$pattern" "$APT_LOG"; then
    echo "[PW_NOVNC] ❌ FAILED: APT_INTEGRITY - Found '$pattern' in apt install output"
    echo "[PW_NOVNC] ERROR: Log: ${APT_LOG}"
    echo "[PW_NOVNC] ERROR: Matching lines:"
    grep -n "$pattern" "$APT_LOG" >&2
    APT_ERRORS_FOUND=1
  fi
done

if [ "$APT_ERRORS_FOUND" -eq 1 ]; then
  exit 1
fi

echo "[PW_NOVNC] ✅ APT_INTEGRITY: apt tools installed with verified signatures"


# === VERIFY REQUIRED BINARIES AFTER INSTALL ===
echo "[PW_NOVNC] Verifying required binaries..."
declare -A REQUIRED=([Xvfb]=1 [fluxbox]=1 [x11vnc]=1 [websockify]=1 [xdpyinfo]=1)
for cmd in "${!REQUIRED[@]}"; do
  if ! command -v "$cmd" &> /dev/null; then
    echo "[PW_NOVNC] ERROR: Required command '$cmd' not found after install attempt"
    exit 1
  fi
done
echo "[PW_NOVNC] ✓ All required binaries present"

# === START XVFB ===
echo "[PW_NOVNC] Starting Xvfb on DISPLAY=${DISPLAY} with resolution ${XVFB_WHD}..."
Xvfb "$DISPLAY" -screen 0 "$XVFB_WHD" > "$RUN_ROOT/xvfb.log" 2>&1 &
XVFB_PID=$!
echo "[PW_NOVNC] Xvfb PID: $XVFB_PID"

# Wait for Xvfb to start
sleep 2
if ! xdpyinfo -display "${DISPLAY}" > /dev/null 2>&1; then
  echo "[PW_NOVNC] ERROR: Xvfb failed to start. Check ${RUN_ROOT}/xvfb.log"
  exit 1
fi
echo "[PW_NOVNC] ✓ Xvfb ready"

# === START FLUXBOX WINDOW MANAGER ===
echo "[PW_NOVNC] Starting fluxbox window manager..."
fluxbox -display "${DISPLAY}" > "$RUN_ROOT/fluxbox.log" 2>&1 &
FLUXBOX_PID=$!
echo "[PW_NOVNC] Fluxbox PID: $FLUXBOX_PID"
sleep 1

# === START X11VNC ===
echo "[PW_NOVNC] Starting x11vnc on port ${VNC_PORT}..."
X11VNC_OPTS=(
  "-display" "$DISPLAY"
  "-rfbport" "$VNC_PORT"
  "-localhost"
  "-forever"
  "-shared"
  "-noxrecord"
  "-nodragging"
)

echo "[PW_NOVNC] ✓ VNC running on localhost without password"

x11vnc "${X11VNC_OPTS[@]}" > "$RUN_ROOT/x11vnc.log" 2>&1 &
X11VNC_PID=$!
echo "[PW_NOVNC] x11vnc PID: $X11VNC_PID"
sleep 1

# === START WEBSOCKIFY + noVNC ===
echo "[PW_NOVNC] Starting websockify + noVNC on port ${NOVNC_PORT}..."
NOVNC_DIR="${NOVNC_DIR:-/usr/share/novnc}"

# Fallback if standard dir doesn't exist
if [[ ! -d "$NOVNC_DIR" ]]; then
  if command -v python3 &> /dev/null; then
    NOVNC_DIR=$(python3 -c "import novnc; print(novnc.__path__[0])" 2>/dev/null || echo "/usr/share/novnc")
  fi
fi

websockify \
  --web "$NOVNC_DIR" \
  "$NOVNC_PORT" \
  "localhost:${VNC_PORT}" \
  > "$RUN_ROOT/novnc.log" 2>&1 &
WEBSOCKIFY_PID=$!
echo "[PW_NOVNC] Websockify PID: $WEBSOCKIFY_PID"
sleep 1

echo "[PW_NOVNC]"
echo "[PW_NOVNC] ✅ DISPLAY STACK READY"
echo "[PW_NOVNC] noVNC_URL=http://localhost:${NOVNC_PORT}/vnc.html"
echo "[PW_NOVNC] ⚠️  Forward port ${NOVNC_PORT} as PRIVATE in Codespaces to access from browser"
echo "[PW_NOVNC]"

# === CLEANUP ON EXIT ===
cleanup() {
  echo "[PW_NOVNC] Cleaning up display stack..."
  kill $WEBSOCKIFY_PID 2>/dev/null || true
  kill $X11VNC_PID 2>/dev/null || true
  kill $FLUXBOX_PID 2>/dev/null || true
  kill $XVFB_PID 2>/dev/null || true
  wait $WEBSOCKIFY_PID 2>/dev/null || true
  wait $X11VNC_PID 2>/dev/null || true
  wait $FLUXBOX_PID 2>/dev/null || true
  wait $XVFB_PID 2>/dev/null || true
  echo "[PW_NOVNC] Cleanup complete"
}
trap cleanup EXIT

# === RUN PLAYWRIGHT ===
cd "${REPO_ROOT}"
export JIRA_BASE_URL
export JIRA_DASHBOARD_URL

echo "[PW_NOVNC] Playwright version:"
npx playwright --version | tee "$RUN_ROOT/playwright-version.log"

echo "[PW_NOVNC]"
echo "[PW_NOVNC] === PHASE 1: AUTH SETUP (headed) ==="
if npx playwright test --project=setup --headed \
  --reporter=list \
  --workers=1 \
  --retries=0 \
  2>&1 | tee "$RUN_ROOT/setup.log"; then
  SETUP_EXIT=0
  echo "[PW_NOVNC] ✅ Auth setup PASSED"
else
  SETUP_EXIT=$?
  echo "[PW_NOVNC] ❌ Auth setup FAILED (exit code: $SETUP_EXIT)"
  echo "[PW_NOVNC] EXITING: chromium project depends on setup; no point running Phase 2"
  echo "[PW_NOVNC] RUN_ROOT=${RUN_ROOT}"
  exit $SETUP_EXIT
fi

echo "[PW_NOVNC]"
echo "[PW_NOVNC] === PHASE 2: DASHBOARD DIAGNOSTICS (headed) ==="
if npx playwright test --project=chromium --headed \
  --reporter=list \
  --workers=1 \
  --retries=0 \
  2>&1 | tee "$RUN_ROOT/diagnostics.log"; then
  DIAG_EXIT=0
  echo "[PW_NOVNC] ✅ Dashboard diagnostics PASSED"
else
  DIAG_EXIT=$?
  echo "[PW_NOVNC] ❌ Dashboard diagnostics FAILED (exit code: $DIAG_EXIT)"
fi

# === POST-RUN EVIDENCE ===
echo "[PW_NOVNC]"
echo "[PW_NOVNC] === POST-RUN EVIDENCE ==="

LATEST_OUT="$(ls -td /tmp/pw_dash_diag_* 2>/dev/null | head -1 || true)"
if [[ -n "${LATEST_OUT:-}" ]]; then
  echo "[PW_NOVNC] LATEST_OUT_DIR=${LATEST_OUT}"
  echo "[PW_NOVNC]"
  echo "[PW_NOVNC] === OUT_DIR files ===" 
  ls -lah "$LATEST_OUT"
  echo "[PW_NOVNC]"
  echo "[PW_NOVNC] === console.log (tail -200) ==="
  tail -200 "$LATEST_OUT/console.log" 2>/dev/null || echo "(no console.log)"
  echo "[PW_NOVNC]"
  echo "[PW_NOVNC] === network.log (tail -200) ==="
  tail -200 "$LATEST_OUT/network.log" 2>/dev/null || echo "(no network.log)"
  echo "[PW_NOVNC]"
  echo "[PW_NOVNC] === HTTP 4xx/5xx errors (first 50) ==="
  grep -E "\[response\.(4|5)[0-9]{2}\]" "$LATEST_OUT/network.log" 2>/dev/null | head -50 || echo "(none)"
else
  echo "[PW_NOVNC] No /tmp/pw_dash_diag_* directories found"
fi

echo "[PW_NOVNC]"
echo "[PW_NOVNC] === RUN LOGS ==="
echo "[PW_NOVNC]"
echo "[PW_NOVNC] === setup.log (tail -200) ==="
tail -200 "$RUN_ROOT/setup.log"
echo "[PW_NOVNC]"
echo "[PW_NOVNC] === diagnostics.log (tail -200) ==="
tail -200 "$RUN_ROOT/diagnostics.log"

# === FINAL STATUS ===
OVERALL_EXIT=${DIAG_EXIT:-0}

echo "[PW_NOVNC]"
if [[ $OVERALL_EXIT -eq 0 ]]; then
  echo "[PW_NOVNC] ✅ OVERALL: ALL PHASES PASSED"
else
  echo "[PW_NOVNC] ❌ OVERALL: SOME PHASES FAILED (exit code: $OVERALL_EXIT)"
fi
echo "[PW_NOVNC] RUN_ROOT=${RUN_ROOT}"

exit $OVERALL_EXIT
