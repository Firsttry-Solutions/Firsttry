#!/bin/bash
set -euo pipefail

# gui_stack_start.sh: Deterministically start a fresh GUI stack in Codespaces
# Prerequisites: Xvfb, openbox, x11vnc, websockify, curl
# Automatically calls gui_stack_stop.sh first to ensure clean state

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
RUN_DIR="/tmp/ft_gui_stack_start_${STAMP}"
mkdir -p "$RUN_DIR"
echo "$RUN_DIR" | tee "$RUN_DIR/00_run_dir.txt"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# STEP 0: Stop any existing GUI stack
echo "STEP 0: Stopping any existing GUI stack..." | tee "$RUN_DIR/01_startup_phase.txt"
STOP_OUTPUT=$("$SCRIPT_DIR/gui_stack_stop.sh" 2>&1 || echo "STOP_ERROR")
if echo "$STOP_OUTPUT" | grep -q "STOP_ERROR\|exit 1"; then
  echo "STOP: gui_stack_stop_failed" | tee "$RUN_DIR/99_STOP.txt"
  echo "$STOP_OUTPUT" | tee -a "$RUN_DIR/99_STOP.txt"
  echo "RUN_DIR=$RUN_DIR"
  exit 1
fi
echo "$STOP_OUTPUT" >> "$RUN_DIR/01_startup_phase.txt"

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
  echo "RUN_DIR=$RUN_DIR"
  exit 1
}
echo "✓ noVNC web root verified" | tee -a "$RUN_DIR/01_startup_phase.txt"

mkdir -p /tmp/ft_gui_pids

# STEP 2: Start Xvfb (resolution must be multiple of 4 for VNC compatibility)
echo "STEP 2: Starting Xvfb on :99..." | tee -a "$RUN_DIR/02_xvfb_phase.txt"
export DISPLAY=:99
Xvfb :99 -screen 0 1368x768x24 -nolisten tcp >"$RUN_DIR/10_xvfb.log" 2>&1 &
XVFB_PID=$!
echo $XVFB_PID > /tmp/ft_gui_pids/xvfb.pid
sleep 2

# Verify Xvfb is working
xdpyinfo -display :99 >"$RUN_DIR/11_xdpyinfo.txt" 2>&1 || {
  echo "STOP: XVFB_NOT_WORKING" | tee "$RUN_DIR/99_STOP.txt"
  tail -100 "$RUN_DIR/10_xvfb.log" | tee -a "$RUN_DIR/99_STOP.txt"
  echo "RUN_DIR=$RUN_DIR"
  exit 1
}
echo "✓ Xvfb running (PID=$XVFB_PID)" | tee -a "$RUN_DIR/02_xvfb_phase.txt"

# STEP 3: Start openbox window manager
echo "STEP 3: Starting openbox window manager..." | tee -a "$RUN_DIR/03_openbox_phase.txt"
openbox >"$RUN_DIR/12_openbox.log" 2>&1 &
OPENBOX_PID=$!
echo $OPENBOX_PID > /tmp/ft_gui_pids/openbox.pid
sleep 1
echo "✓ openbox started (PID=$OPENBOX_PID)" | tee -a "$RUN_DIR/03_openbox_phase.txt"

# STEP 4: Start x11vnc as raw VNC server (NOT websocket mode)
echo "STEP 4: Starting x11vnc on localhost:5901..." | tee -a "$RUN_DIR/04_x11vnc_phase.txt"
x11vnc -display :99 -rfbport 5901 -localhost -nopw -forever -shared -noxdamage \
  >"$RUN_DIR/13_x11vnc.log" 2>&1 &
X11VNC_PID=$!
echo $X11VNC_PID > /tmp/ft_gui_pids/x11vnc.pid
sleep 2

# Verify x11vnc is listening on 127.0.0.1:5901
ss -lntp | grep ':5901 ' > /tmp/ss_5901.tmp || {
  echo "STOP: X11VNC_NOT_LISTENING_5901" | tee "$RUN_DIR/99_STOP.txt"
  tail -100 "$RUN_DIR/13_x11vnc.log" | tee -a "$RUN_DIR/99_STOP.txt"
  echo "RUN_DIR=$RUN_DIR"
  exit 1
}
echo "✓ x11vnc listening on 127.0.0.1:5901 (PID=$X11VNC_PID)" | tee -a "$RUN_DIR/04_x11vnc_phase.txt"
cat /tmp/ss_5901.tmp | tee -a "$RUN_DIR/04_x11vnc_phase.txt"

# STEP 5: Start websockify proxy
echo "STEP 5: Starting websockify on 0.0.0.0:6081..." | tee -a "$RUN_DIR/05_websockify_phase.txt"
websockify --verbose --web /usr/share/novnc 0.0.0.0:6081 127.0.0.1:5901 \
  >"$RUN_DIR/14_websockify.log" 2>&1 &
WEBSOCKIFY_PID=$!
echo $WEBSOCKIFY_PID > /tmp/ft_gui_pids/websockify.pid
sleep 2

# Verify websockify is listening
ss -lntp | grep ':6081 ' > /tmp/ss_6081.tmp || {
  echo "STOP: WEBSOCKIFY_NOT_LISTENING_6081" | tee "$RUN_DIR/99_STOP.txt"
  tail -100 "$RUN_DIR/14_websockify.log" | tee -a "$RUN_DIR/99_STOP.txt"
  echo "RUN_DIR=$RUN_DIR"
  exit 1
}
echo "✓ websockify listening on 0.0.0.0:6081 (PID=$WEBSOCKIFY_PID)" | tee -a "$RUN_DIR/05_websockify_phase.txt"
cat /tmp/ss_6081.tmp | tee -a "$RUN_DIR/05_websockify_phase.txt"

# STEP 6: Verify HTTP page exists
echo "STEP 6: Verifying HTTP/noVNC page..." | tee -a "$RUN_DIR/06_http_phase.txt"
curl -fsSIL http://127.0.0.1:6081/vnc.html >"$RUN_DIR/20_http_headers.txt" 2>&1 || {
  echo "STOP: HTTP_CURL_FAILED" | tee "$RUN_DIR/99_STOP.txt"
  cat "$RUN_DIR/20_http_headers.txt" | tee -a "$RUN_DIR/99_STOP.txt"
  echo "RUN_DIR=$RUN_DIR"
  exit 1
}
grep -q '^HTTP/1.1 200' "$RUN_DIR/20_http_headers.txt" || {
  echo "STOP: HTTP_NOT_200" | tee "$RUN_DIR/99_STOP.txt"
  cat "$RUN_DIR/20_http_headers.txt" | tee -a "$RUN_DIR/99_STOP.txt"
  echo "RUN_DIR=$RUN_DIR"
  exit 1
}
echo "✓ HTTP 200 OK on /vnc.html" | tee -a "$RUN_DIR/06_http_phase.txt"
cat "$RUN_DIR/20_http_headers.txt" | tee -a "$RUN_DIR/06_http_phase.txt"

# STEP 7: Verify websockify PID is still alive (did not crash)
echo "STEP 7: Verifying websockify process is still alive..." | tee -a "$RUN_DIR/07_alive_phase.txt"
sleep 3
if ! kill -0 "$WEBSOCKIFY_PID" 2>/dev/null; then
  echo "STOP: WEBSOCKIFY_PID_DEAD_AFTER_VERIFICATION" | tee "$RUN_DIR/99_STOP.txt"
  tail -200 "$RUN_DIR/14_websockify.log" | tee -a "$RUN_DIR/99_STOP.txt"
  echo "RUN_DIR=$RUN_DIR"
  exit 1
fi
echo "✓ websockify process alive and ready" | tee -a "$RUN_DIR/07_alive_phase.txt"

# STEP 8: Final summary
echo "STEP 8: GUI stack startup complete!" | tee -a "$RUN_DIR/08_complete.txt"
echo "" | tee -a "$RUN_DIR/08_complete.txt"
echo "Summary:" | tee -a "$RUN_DIR/08_complete.txt"
echo "  Xvfb:99              PID=$XVFB_PID" | tee -a "$RUN_DIR/08_complete.txt"
echo "  openbox              PID=$OPENBOX_PID" | tee -a "$RUN_DIR/08_complete.txt"
echo "  x11vnc:5901          PID=$X11VNC_PID" | tee -a "$RUN_DIR/08_complete.txt"
echo "  websockify:6081      PID=$WEBSOCKIFY_PID" | tee -a "$RUN_DIR/08_complete.txt"
echo "" | tee -a "$RUN_DIR/08_complete.txt"

echo "RUN_DIR=$RUN_DIR"
echo "OPEN_URL=/vnc.html"
echo "OPEN_URL=/vnc_lite.html"
exit 0
