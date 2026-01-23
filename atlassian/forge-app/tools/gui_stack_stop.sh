#!/bin/bash
set -euo pipefail

# gui_stack_stop.sh: Deterministically stop GUI stack on ports 6081 and 5901
# Only kills processes we explicitly started (Xvfb, openbox, x11vnc, websockify)
# Never uses broad pkill/killall

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
RUN_DIR="/tmp/ft_gui_stack_stop_${STAMP}"
mkdir -p "$RUN_DIR"
echo "$RUN_DIR" | tee "$RUN_DIR/00_run_dir.txt"

# STEP 1: Identify PIDs listening on 6081 and 5901 using ss
echo "STEP 1: Finding PIDs on ports 6081 and 5901..." | tee "$RUN_DIR/01_stop_phase.txt"
ss -lntp | tee "$RUN_DIR/01_ss_before.txt" > /tmp/ss_before.tmp 2>&1 || true

PIDS_TO_KILL=()

# Parse ss output for port 6081
if grep -E ':(6081|5901)\s' /tmp/ss_before.tmp >/dev/null 2>&1; then
  while IFS= read -r line; do
    if [[ "$line" =~ pid=([0-9]+) ]]; then
      PID="${BASH_REMATCH[1]}"
      echo "Found listener PID=$PID" | tee -a "$RUN_DIR/01_stop_phase.txt"
      PIDS_TO_KILL+=("$PID")
    fi
  done < <(grep -E ':(6081|5901)\s' /tmp/ss_before.tmp || true)
fi

# STEP 2: Also check /tmp/ft_gui_pids for any PID files we created
echo "STEP 2: Checking /tmp/ft_gui_pids for stored PIDs..." | tee -a "$RUN_DIR/01_stop_phase.txt"
if [ -d /tmp/ft_gui_pids ]; then
  for pidfile in /tmp/ft_gui_pids/*.pid; do
    [ -f "$pidfile" ] || continue
    pid="$(cat "$pidfile" 2>/dev/null || true)"
    if [ -n "$pid" ]; then
      echo "Found pidfile=$pidfile PID=$pid" | tee -a "$RUN_DIR/01_stop_phase.txt"
      # Validate it's one of our allowed processes before adding
      if [ -f "/proc/$pid/cmdline" ]; then
        cmdline="$(tr '\0' ' ' < /proc/$pid/cmdline)"
        if echo "$cmdline" | grep -qE '(Xvfb|openbox|x11vnc|websockify)'; then
          PIDS_TO_KILL+=("$pid")
        else
          echo "WARN: PID=$pid cmdline does not match allowed processes, skipping" | tee -a "$RUN_DIR/01_stop_phase.txt"
        fi
      fi
    fi
  done
fi

# Deduplicate PIDs
PIDS_TO_KILL=($(echo "${PIDS_TO_KILL[@]}" | tr ' ' '\n' | sort -u))

# STEP 3: Kill each PID (TERM then KILL)
echo "STEP 3: Terminating PIDs..." | tee -a "$RUN_DIR/02_kill_phase.txt"
for pid in "${PIDS_TO_KILL[@]}"; do
  if kill -0 "$pid" 2>/dev/null; then
    echo "TERM PID=$pid" | tee -a "$RUN_DIR/02_kill_phase.txt"
    kill "$pid" 2>/dev/null || true
    sleep 1
    if kill -0 "$pid" 2>/dev/null; then
      echo "KILL PID=$pid" | tee -a "$RUN_DIR/02_kill_phase.txt"
      kill -9 "$pid" 2>/dev/null || true
      sleep 1
    fi
  fi
done

# Clean up PID files
rm -f /tmp/ft_gui_pids/*.pid 2>/dev/null || true

# STEP 4: Verify ports are free
echo "STEP 4: Verifying ports are free..." | tee -a "$RUN_DIR/03_verify_phase.txt"
sleep 2
ss -lntp | tee "$RUN_DIR/03_ss_after.txt" > /tmp/ss_after.tmp 2>&1 || true

if grep -E ':(6081|5901)\s' /tmp/ss_after.tmp >/dev/null 2>&1; then
  echo "STOP: PORTS_STILL_LISTENING" | tee "$RUN_DIR/99_STOP.txt"
  grep -E ':(6081|5901)\s' /tmp/ss_after.tmp | tee -a "$RUN_DIR/99_STOP.txt"
  echo "RUN_DIR=$RUN_DIR"
  exit 1
fi

echo "✓ All ports free" | tee -a "$RUN_DIR/03_verify_phase.txt"
echo "RUN_DIR=$RUN_DIR"
exit 0
