#!/usr/bin/env bash
set -euo pipefail

# XVFB wrapper for headless E2E tests
# Usage: run_xvfb.sh <command> [args...]

# Check if xvfb-run is available, install if not
if ! command -v xvfb-run >/dev/null 2>&1; then
    echo "[XVFB] xvfb-run not found, installing xvfb..."
    sudo apt-get update >/dev/null 2>&1
    sudo apt-get install -y xvfb >/dev/null 2>&1
fi

# Run the command with Xvfb
xvfb-run -a -s "-screen 0 1280x720x24" "$@"
