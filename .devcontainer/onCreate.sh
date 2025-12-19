#!/usr/bin/env bash
set -euo pipefail

if command -v apt-get >/dev/null 2>&1; then
  if [ "$(id -u)" -ne 0 ]; then
    echo "[onCreate] Not root; skipping apt installs."
    exit 0
  fi
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y
  apt-get install -y --no-install-recommends git curl ca-certificates
  rm -rf /var/lib/apt/lists/*
fi
