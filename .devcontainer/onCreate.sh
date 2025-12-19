#!/usr/bin/env bash
set -euo pipefail

# This script runs as root during container creation.
# The Python base image already has Python, pip, and venv.
# We only install what's truly needed for building native extensions.

echo "--- [onCreate] Installing minimal OS dependencies ---"

if command -v apt-get >/dev/null 2>&1; then
  echo "--- [onCreate] Detected apt (Debian/Ubuntu) ---"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y
  apt-get install -y --no-install-recommends \
    git curl ca-certificates build-essential
  rm -rf /var/lib/apt/lists/*

elif command -v apk >/dev/null 2>&1; then
  echo "--- [onCreate] Detected apk (Alpine) ---"
  apk add --no-cache \
    git curl ca-certificates build-base

else
  echo "ERROR: [onCreate] No supported package manager (apt-get/apk) found"
  exit 1
fi

echo "--- [onCreate] Done ---"