#!/usr/bin/env bash
set -euo pipefail

# This script runs as root during the container creation phase.
# It installs all necessary system packages, handling both Debian/Ubuntu (apt) and Alpine (apk).

echo "--- [onCreate] Starting system package installation ---"

if command -v apt-get >/dev/null 2>&1; then
  echo "--- [onCreate] Detected apt (Debian/Ubuntu) ---"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y
  apt-get install -y --no-install-recommends \
    python3-venv python3-pip python3-dev \
    build-essential git curl ca-certificates
  rm -rf /var/lib/apt/lists/*

elif command -v apk >/dev/null 2>&1; then
  echo "--- [onCreate] Detected apk (Alpine) ---"
  apk add --no-cache \
    python3 py3-pip python3-dev \
    build-base git curl ca-certificates

else
  echo "ERROR: [onCreate] No supported package manager (apt-get/apk) found"
  exit 1
fi

# Ensure python3 is available
if ! command -v python3 >/dev/null 2>&1; then
  echo "ERROR: [onCreate] python3 not available after package installation"
  exit 1
fi

# Speed up pip globally (will be inherited by the vscode user)
echo "--- [onCreate] Configuring pip ---"
python3 -m pip config set global.progress_bar off || true

echo "--- [onCreate] Done ---"