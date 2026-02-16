#!/bin/bash
set -euo pipefail

# Scan Outbound Candidates
# Identifies potential outbound network call patterns in source code

TARGET_PATH="${1:-.}"
PATTERNS=(
  "fetch("
  "axios"
  "node-fetch"
  "request\\b"
  "undici"
  "https\\."
  "http\\."
  "net\\."
  "tls\\."
  "WebSocket"
  "XMLHttpRequest"
  "invokeRemote"
)

echo "[INFO] Scanning for outbound patterns in: $TARGET_PATH"

FOUND=0
for pattern in "${PATTERNS[@]}"; do
  if command -v rg >/dev/null 2>&1; then
    rg "$pattern" "$TARGET_PATH" 2>/dev/null | sort || true
  else
    grep -rn "$pattern" "$TARGET_PATH" 2>/dev/null | sort || true
  fi
done | sort -u

echo "[FT_STORAGE_KEYS_EXTRACTED]"
