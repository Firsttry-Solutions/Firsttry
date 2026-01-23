#!/bin/bash
set -euo pipefail

# gui_stack_diag.sh: Capture baseline diagnostic state for GUI stack debugging

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
RUN_DIR="/tmp/ft_gui_diag_${STAMP}"
mkdir -p "$RUN_DIR"
echo "$RUN_DIR" | tee "$RUN_DIR/00_RUN_DIR.txt"

# Capture environment
echo "=== Environment ===" | tee "$RUN_DIR/01_env.txt"
echo "DISPLAY=${DISPLAY:-UNSET}" | tee -a "$RUN_DIR/01_env.txt"
echo "CODESPACE_NAME=${CODESPACE_NAME:-UNSET}" | tee -a "$RUN_DIR/01_env.txt"
echo "USER=${USER:-UNSET}" | tee -a "$RUN_DIR/01_env.txt"
uname -a | tee -a "$RUN_DIR/01_env.txt"

# Check current listeners
echo "=== Port Listeners Before ===" | tee "$RUN_DIR/02_ss_before.txt"
ss -lntp | egrep ':(5901|6081)\s' | tee -a "$RUN_DIR/02_ss_before.txt" || echo "No listeners on 5901/6081" | tee -a "$RUN_DIR/02_ss_before.txt"

# Check PID files
echo "=== PID Files ===" | tee "$RUN_DIR/03_pidfiles_before.txt"
if [ -d /tmp/ft_gui_pids ]; then
  ls -lah /tmp/ft_gui_pids | tee -a "$RUN_DIR/03_pidfiles_before.txt"
  for f in /tmp/ft_gui_pids/*.pid; do
    [ -f "$f" ] || continue
    pid="$(cat "$f" 2>/dev/null || true)"
    if [ -n "$pid" ]; then
      echo "PID file: $f -> PID=$pid" | tee -a "$RUN_DIR/03_pidfiles_before.txt"
      if [ -f "/proc/$pid/cmdline" ]; then
        cmdline="$(tr '\0' ' ' < /proc/$pid/cmdline)"
        echo "  cmdline: $cmdline" | tee -a "$RUN_DIR/03_pidfiles_before.txt"
      fi
    fi
  done
else
  echo "/tmp/ft_gui_pids does not exist" | tee -a "$RUN_DIR/03_pidfiles_before.txt"
fi

echo ""
echo "RUN_DIR=$RUN_DIR"
exit 0
