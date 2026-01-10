#!/bin/bash
# proof_lib.sh — Common utilities for proof run harness

################################################################################
# UTILITY: Write a marker file with optional content
################################################################################
write_marker() {
  local marker_file="$1"
  local content="$2"
  if [[ -z "$content" ]]; then
    date -u '+%Y-%m-%d %H:%M:%S UTC' > "$marker_file"
  else
    echo "$content" > "$marker_file"
  fi
}

################################################################################
# UTILITY: Capture process tree for debugging stuck commands
################################################################################
capture_process_tree() {
  local output_file="$1"
  (
    echo "=== Process Tree (ps auxww) ==="
    ps auxww || true
    echo ""
    echo "=== Process Tree (pstree -p) ==="
    pstree -p 2>/dev/null || echo "pstree not available"
  ) >> "$output_file" 2>&1
}

################################################################################
# UTILITY: Capture open file descriptors for a PID
################################################################################
capture_lsof() {
  local pid="$1"
  local output_file="$2"
  (
    echo "=== Open File Descriptors for PID $pid ==="
    lsof -p "$pid" 2>/dev/null || echo "lsof not available or PID dead"
  ) >> "$output_file" 2>&1
}

################################################################################
# UTILITY: Capture tail of a log file
################################################################################
capture_log_tail() {
  local log_file="$1"
  local output_file="$2"
  local lines="${3:-200}"
  if [[ -f "$log_file" ]]; then
    (
      echo "=== Last $lines lines of $log_file ==="
      tail -n "$lines" "$log_file" || cat "$log_file"
    ) >> "$output_file" 2>&1
  fi
}

################################################################################
# UTILITY: Attempt to capture forge logs (best-effort)
################################################################################
capture_forge_logs() {
  local output_file="$1"
  (
    echo "=== Forge Logs (best-effort) ==="
    forge logs -e production --limit 100 2>&1 || echo "forge logs not available"
  ) >> "$output_file" 2>&1
}

################################################################################
# UTILITY: Normalize SITE_URL to https://
################################################################################
normalize_site_url() {
  local url="$1"
  if [[ ! "$url" =~ ^https?:// ]]; then
    echo "https://${url}"
  else
    echo "$url"
  fi
}

################################################################################
# UTILITY: Check if a command exists
################################################################################
cmd_exists() {
  command -v "$1" >/dev/null 2>&1
}
