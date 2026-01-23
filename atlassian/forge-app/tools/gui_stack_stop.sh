#!/bin/bash
set -euo pipefail

# gui_stack_stop.sh: STRICT stop - only kills processes whose PIDs are in /tmp/ft_gui_pids/*.pid
# Validates cmdline before killing. Proves ports are free afterwards.

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
RUN_DIR="/tmp/ft_gui_stack_stop_${STAMP}"
mkdir -p "$RUN_DIR"
echo "$RUN_DIR" | tee "$RUN_DIR/00_RUN_DIR.txt"

# STEP 1: Identify PIDs from /tmp/ft_gui_pids only
echo "STEP 1: Reading PIDs from /tmp/ft_gui_pids/*.pid only..." | tee "$RUN_DIR/10_stop_actions.txt"
PIDS_TO_KILL=()

if [ -d /tmp/ft_gui_pids ]; then
  for pidfile in /tmp/ft_gui_pids/*.pid; do
    [ -f "$pidfile" ] || continue
    pid="$(cat "$pidfile" 2>/dev/null || true)"
    if [ -n "$pid" ] && [ "$pid" -gt 0 ] 2>/dev/null; then
      echo "Found pidfile=$pidfile PID=$pid" | tee -a "$RUN_DIR/10_stop_actions.txt"
      # Strict validation: cmdline MUST contain one of our allowed processes
      if [ -f "/proc/$pid/cmdline" ]; then
        cmdline="$(tr '\0' ' ' < /proc/$pid/cmdline 2>/dev/null || true)"
        if echo "$cmdline" | grep -qE '(Xvfb|openbox|x11vnc|websockify)'; then
          PIDS_TO_KILL+=("$pid")
          echo "  ✓ Validated: $cmdline" | tee -a "$RUN_DIR/10_stop_actions.txt"
        else
          echo "  ✗ REJECTED: not in whitelist: $cmdline" | tee -a "$RUN_DIR/10_stop_actions.txt"
        fi
      else
        echo "  ✗ REJECTED: /proc/$pid/cmdline does not exist" | tee -a "$RUN_DIR/10_stop_actions.txt"
      fi
    fi
  done
else
  echo "No /tmp/ft_gui_pids directory; nothing to stop" | tee -a "$RUN_DIR/10_stop_actions.txt"
fi

# STEP 2: Kill each validated PID (TERM then KILL)
echo "" | tee -a "$RUN_DIR/10_stop_actions.txt"
echo "STEP 2: Terminating PIDs..." | tee -a "$RUN_DIR/10_stop_actions.txt"
for pid in "${PIDS_TO_KILL[@]}"; do
  if kill -0 "$pid" 2>/dev/null; then
    echo "TERM PID=$pid" | tee -a "$RUN_DIR/10_stop_actions.txt"
    kill "$pid" 2>/dev/null || true
    sleep 1
    if kill -0 "$pid" 2>/dev/null; then
      echo "KILL PID=$pid" | tee -a "$RUN_DIR/10_stop_actions.txt"
      kill -9 "$pid" 2>/dev/null || true
      sleep 1
    fi
  else
    echo "PID=$pid already dead" | tee -a "$RUN_DIR/10_stop_actions.txt"
  fi
done

# STEP 3: Clean up PID files
rm -f /tmp/ft_gui_pids/*.pid 2>/dev/null || true

# STEP 4: Prove ports are free
echo "" | tee -a "$RUN_DIR/10_stop_actions.txt"
echo "STEP 3: Proving ports 5901 and 6081 are free..." | tee -a "$RUN_DIR/10_stop_actions.txt"
sleep 2
ss -lntp 2>/dev/null | tee "$RUN_DIR/11_ss_after_stop.txt" > /tmp/ss_after.tmp || true

if grep -E ':(6081|5901)\s' /tmp/ss_after.tmp >/dev/null 2>&1; then
  echo "STOP: PORTS_STILL_IN_USE" | tee "$RUN_DIR/99_STOP.txt"
  echo "Listeners still present:" | tee -a "$RUN_DIR/99_STOP.txt"
  grep -E ':(6081|5901)\s' /tmp/ss_after.tmp | tee -a "$RUN_DIR/99_STOP.txt"
  echo "RUN_DIR=$RUN_DIR"
  exit 1
fi

echo "✓ Ports 5901 and 6081 are free" | tee -a "$RUN_DIR/10_stop_actions.txt"
echo "RUN_DIR=$RUN_DIR"
exit 0
