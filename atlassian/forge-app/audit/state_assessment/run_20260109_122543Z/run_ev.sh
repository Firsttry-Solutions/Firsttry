#!/usr/bin/env bash
set -euo pipefail
evfile="$1"; shift
cmd="$*"
ts_start="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
{
  echo "TIMESTAMP_START: $ts_start"
  echo
  echo "COMMAND:"
  echo "$cmd"
  echo
  echo "OUTPUT:"
  set +e
  bash -lc "$cmd" 2>&1
  ec=$?
  set -e
  echo
  echo "EXIT_CODE: $ec"
  echo "TIMESTAMP_END: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  exit $ec
} > "$evfile"
