#!/bin/bash
set -euo pipefail

# gui_stack_start.sh: Deterministically start GUI stack in Codespaces
# Validates every component. Prints correct noVNC OPEN_URL targeting websockify endpoint.

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
RUN_DIR="/tmp/ft_gui_stack_start_${STAMP}"
mkdir -p "$RUN_DIR"
echo "$RUN_DIR" | tee "$RUN_DIR/00_RUN_DIR.txt"

# Verify CODESPACE_NAME early (needed for OPEN_URL)
if [ -z "${CODESPACE_NAME:-}" ]; then
  echo "STOP: CODESPACE_NAME_NOT_SET" | tee "$RUN_DIR/99_STOP.txt"
  echo "This script must run in GitHub Codespaces" | tee -a "$RUN_DIR/99_STOP.txt"
  echo "RUN_DIR=$RUN_DIR"
  exit 1
fi
echo "CODESPACE_NAME=$CODESPACE_NAME" | tee "$RUN_DIR/01_startup_phase.txt"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# STEP 0: Stop any existing GUI stack
echo "STEP 0: Stopping any existing GUI stack..." | tee -a "$RUN_DIR/01_startup_phase.txt"
set +e
STOP_OUTPUT=$("$SCRIPT_DIR/gui_stack_stop.sh" 2>&1)
STOP_RC=$?
set -e
echo "$STOP_OUTPUT" | tee -a "$RUN_DIR/01_startup_phase.txt"
if [ $STOP_RC -ne 0 ]; then
  echo "STOP: STOP_SCRIPT_FAILED" | tee "$RUN_DIR/99_STOP.txt"
  echo "$STOP_OUTPUT" | tee -a "$RUN_DIR/99_STOP.txt"
  echo "RUN_DIR=$RUN_DIR"
  exit 1
fi

# STEP 1: Verify required binaries
echo "STEP 1: Verifying required binaries..." | tee -a "$RUN_DIR/01_startup_phase.txt"
for cmd in Xvfb openbox x11vnc websockify curl xdpyinfo; do
  command -v "$cmd" >/dev/null 2>&1 || {
    echo "STOP: MISSING_BINARY_$cmd" | tee "$RUN_DIR/99_STOP.txt"
    echo "RUN_DIR=$RUN_DIR"
    exit 1
  }
done
echo "✓ All required binaries present" | tee -a "$RUN_DIR/01_startup_phase.txt"

# Verify noVNC web root
[ -f /usr/share/novnc/vnc.html ] || {
  echo "STOP: NOVNC_WEB_ROOT_MISSING" | tee "$RUN_DIR/99_STOP.txt"
  echo "Expected: /usr/share/novnc/vnc.html" | tee -a "$RUN_DIR/99_STOP.txt"
  echo "RUN_DIR=$RUN_DIR"
  exit 1
}
echo "✓ noVNC web root verified" | tee -a "$RUN_DIR/01_startup_phase.txt"

mkdir -p /tmp/ft_gui_pids

# STEP 2: Start Xvfb (1368x768 is multiple of 4 for VNC safety)
echo "STEP 2: Starting Xvfb on :99..." | tee -a "$RUN_DIR/02_startup_phase.txt"
export DISPLAY=:99
Xvfb :99 -screen 0 1368x768x24 -nolisten tcp >"$RUN_DIR/20_xvfb.log" 2>&1 &
XVFB_PID=$!
echo $XVFB_PID > /tmp/ft_gui_pids/xvfb.pid
echo "Xvfb PID=$XVFB_PID" | tee -a "$RUN_DIR/02_startup_phase.txt"
sleep 2

# STEP 3: Verify Xvfb works
echo "STEP 3: Verifying Xvfb display :99..." | tee -a "$RUN_DIR/02_startup_phase.txt"
xdpyinfo -display :99 >"$RUN_DIR/21_xdpyinfo.txt" 2>&1 || {
  echo "STOP: XVFB_FAIL" | tee "$RUN_DIR/99_STOP.txt"
  tail -100 "$RUN_DIR/20_xvfb.log" | tee -a "$RUN_DIR/99_STOP.txt"
  echo "RUN_DIR=$RUN_DIR"
  exit 1
}
echo "✓ Xvfb display :99 functional" | tee -a "$RUN_DIR/02_startup_phase.txt"

# STEP 4: Start openbox
echo "STEP 4: Starting openbox..." | tee -a "$RUN_DIR/02_startup_phase.txt"
openbox >"$RUN_DIR/22_openbox.log" 2>&1 &
OPENBOX_PID=$!
echo $OPENBOX_PID > /tmp/ft_gui_pids/openbox.pid
sleep 1
echo "openbox PID=$OPENBOX_PID" | tee -a "$RUN_DIR/02_startup_phase.txt"

# STEP 5: Start x11vnc (IPv4 loopback only, no IPv6, no port 5900)
echo "STEP 5: Starting x11vnc on 127.0.0.1:5901..." | tee -a "$RUN_DIR/02_startup_phase.txt"
x11vnc -display :99 -rfbport 5901 -rfbportv6 0 -listen 127.0.0.1 -localhost -nopw -forever -shared -noxdamage -nolookup -no6 \
  >"$RUN_DIR/23_x11vnc.log" 2>&1 &
X11VNC_PID=$!
echo $X11VNC_PID > /tmp/ft_gui_pids/x11vnc.pid
sleep 2
echo "x11vnc PID=$X11VNC_PID" | tee -a "$RUN_DIR/02_startup_phase.txt"

# STEP 6: Verify x11vnc TCP reachability
echo "STEP 6: Verifying x11vnc TCP 127.0.0.1:5901..." | tee -a "$RUN_DIR/02_startup_phase.txt"
timeout 2 bash -c '</dev/tcp/127.0.0.1/5901' >"$RUN_DIR/22_tcp_5901.txt" 2>&1 || {
  echo "STOP: X11VNC_FAIL" | tee "$RUN_DIR/99_STOP.txt"
  tail -100 "$RUN_DIR/23_x11vnc.log" | tee -a "$RUN_DIR/99_STOP.txt"
  echo "RUN_DIR=$RUN_DIR"
  exit 1
}
echo "✓ x11vnc TCP reachable on 127.0.0.1:5901" | tee -a "$RUN_DIR/02_startup_phase.txt"

# STEP 7: Start websockify
echo "STEP 7: Starting websockify on 0.0.0.0:6081..." | tee -a "$RUN_DIR/02_startup_phase.txt"
websockify --verbose --web /usr/share/novnc 0.0.0.0:6081 127.0.0.1:5901 \
  >"$RUN_DIR/24_websockify.log" 2>&1 &
WEBSOCKIFY_PID=$!
echo $WEBSOCKIFY_PID > /tmp/ft_gui_pids/websockify.pid
sleep 2
echo "websockify PID=$WEBSOCKIFY_PID" | tee -a "$RUN_DIR/02_startup_phase.txt"

# STEP 8: Verify HTTP 200 on 6081 (test vnc_auto.html)
echo "STEP 8: Verifying HTTP 200 on 0.0.0.0:6081..." | tee -a "$RUN_DIR/02_startup_phase.txt"
curl -fsS http://127.0.0.1:6081/vnc_auto.html >"$RUN_DIR/25_http_6081.txt" 2>&1 || {
  echo "STOP: HTTP_CURL_FAIL" | tee "$RUN_DIR/99_STOP.txt"
  cat "$RUN_DIR/25_http_6081.txt" | tee -a "$RUN_DIR/99_STOP.txt"
  echo "RUN_DIR=$RUN_DIR"
  exit 1
}
# Verify HTTP 200 response
if grep -q '^HTTP/1.1 200' "$RUN_DIR/25_http_6081.txt" || [ -s "$RUN_DIR/25_http_6081.txt" ]; then
  echo "✓ HTTP 200 OK on /vnc_auto.html" | tee -a "$RUN_DIR/02_startup_phase.txt"
else
  echo "STOP: HTTP_6081_FAIL" | tee "$RUN_DIR/99_STOP.txt"
  cat "$RUN_DIR/25_http_6081.txt" | tee -a "$RUN_DIR/99_STOP.txt"
  echo "RUN_DIR=$RUN_DIR"
  exit 1
fi

# STEP 9: Verify ss listeners (IPv4 only, no IPv6, no port 5900)
echo "STEP 9: Verifying listener ports..." | tee -a "$RUN_DIR/02_startup_phase.txt"
ss -lntp | egrep ':(5901|6081)\s' >"$RUN_DIR/26_ss_listeners.txt" 2>&1 || {
  echo "STOP: LISTENERS_NOT_FOUND" | tee "$RUN_DIR/99_STOP.txt"
  ss -lntp | tee -a "$RUN_DIR/99_STOP.txt"
  echo "RUN_DIR=$RUN_DIR"
  exit 1
}
echo "✓ Listeners verified on 5901 and 6081" | tee -a "$RUN_DIR/02_startup_phase.txt"
cat "$RUN_DIR/26_ss_listeners.txt" | tee -a "$RUN_DIR/02_startup_phase.txt"

# STEP 9a: ENFORCE IPv4-only x11vnc (no IPv6 listening)
echo "STEP 9a: Enforcing IPv4-only x11vnc (no IPv6)..." | tee -a "$RUN_DIR/02_startup_phase.txt"
if ss -lntp | grep -q ':::5901'; then
  echo "STOP: X11VNC_LISTENING_ON_IPV6" | tee "$RUN_DIR/99_STOP.txt"
  echo "x11vnc should NOT listen on :::5901 (IPv6)" | tee -a "$RUN_DIR/99_STOP.txt"
  ss -lntp | tee -a "$RUN_DIR/99_STOP.txt"
  echo "RUN_DIR=$RUN_DIR"
  exit 1
fi
echo "✓ No IPv6 listener on :::5901" | tee -a "$RUN_DIR/02_startup_phase.txt"

# STEP 9b: ENFORCE no port 5900 listener
echo "STEP 9b: Enforcing no port 5900 listener..." | tee -a "$RUN_DIR/02_startup_phase.txt"
if ss -lntp | grep -q ':5900\s'; then
  echo "STOP: PORT_5900_LISTENER_FOUND" | tee "$RUN_DIR/99_STOP.txt"
  echo "x11vnc should NOT listen on port 5900" | tee -a "$RUN_DIR/99_STOP.txt"
  ss -lntp | tee -a "$RUN_DIR/99_STOP.txt"
  echo "RUN_DIR=$RUN_DIR"
  exit 1
fi
echo "✓ No listener on port 5900" | tee -a "$RUN_DIR/02_startup_phase.txt"

# STEP 9c: ENFORCE 127.0.0.1:5901 specifically (IPv4 loopback)
echo "STEP 9c: Enforcing 127.0.0.1:5901 specifically..." | tee -a "$RUN_DIR/02_startup_phase.txt"
if ! ss -lntp | grep -q '127.0.0.1:5901'; then
  echo "STOP: X11VNC_NOT_ON_LOOPBACK_5901" | tee "$RUN_DIR/99_STOP.txt"
  echo "x11vnc MUST listen on 127.0.0.1:5901" | tee -a "$RUN_DIR/99_STOP.txt"
  ss -lntp | tee -a "$RUN_DIR/99_STOP.txt"
  echo "RUN_DIR=$RUN_DIR"
  exit 1
fi
echo "✓ x11vnc listening on 127.0.0.1:5901" | tee -a "$RUN_DIR/02_startup_phase.txt"

# STEP 11: Verify websockify PID is still alive
echo "STEP 11: Verifying websockify process alive..." | tee -a "$RUN_DIR/02_startup_phase.txt"
sleep 3
if ! kill -0 "$WEBSOCKIFY_PID" 2>/dev/null; then
  echo "STOP: WEBSOCKIFY_PID_DEAD" | tee "$RUN_DIR/99_STOP.txt"
  tail -200 "$RUN_DIR/24_websockify.log" | tee -a "$RUN_DIR/99_STOP.txt"
  echo "RUN_DIR=$RUN_DIR"
  exit 1
fi
echo "✓ websockify process alive and stable" | tee -a "$RUN_DIR/02_startup_phase.txt"

# STEP 12: Tail logs for diagnostics
echo "" | tee -a "$RUN_DIR/02_startup_phase.txt"
echo "=== Tail websockify log ===" | tee -a "$RUN_DIR/02_startup_phase.txt"
tail -200 "$RUN_DIR/24_websockify.log" | tee "$RUN_DIR/27_websockify_tail.txt"
echo "" | tee -a "$RUN_DIR/02_startup_phase.txt"
echo "=== Tail x11vnc log ===" | tee -a "$RUN_DIR/02_startup_phase.txt"
tail -200 "$RUN_DIR/23_x11vnc.log" | tee "$RUN_DIR/28_x11vnc_tail.txt"

# STEP 13: Print summary
echo "" | tee -a "$RUN_DIR/02_startup_phase.txt"
echo "✓ GUI stack startup complete!" | tee -a "$RUN_DIR/02_startup_phase.txt"
echo "" | tee -a "$RUN_DIR/02_startup_phase.txt"
echo "Summary:" | tee -a "$RUN_DIR/02_startup_phase.txt"
echo "  Xvfb:99              PID=$XVFB_PID" | tee -a "$RUN_DIR/02_startup_phase.txt"
echo "  openbox              PID=$OPENBOX_PID" | tee -a "$RUN_DIR/02_startup_phase.txt"
echo "  x11vnc:5901          PID=$X11VNC_PID" | tee -a "$RUN_DIR/02_startup_phase.txt"
echo "  websockify:6081      PID=$WEBSOCKIFY_PID" | tee -a "$RUN_DIR/02_startup_phase.txt"
echo "" | tee -a "$RUN_DIR/02_startup_phase.txt"

# FINAL OUTPUT: Print the correct OPEN_URL with Codespaces hostname and websockify path
echo "RUN_DIR=$RUN_DIR"
OPEN_URL="https://${CODESPACE_NAME}-6081.app.github.dev/vnc_auto.html?autoconnect=1&resize=remote&path=websockify&encrypt=1&host=${CODESPACE_NAME}-6081.app.github.dev&port=443"
echo "OPEN_URL=$OPEN_URL"
echo "CLEAR_CACHE_INSTRUCTION=Open this URL in an INCOGNITO/PRIVATE window to avoid noVNC cached host/port/path"
exit 0
