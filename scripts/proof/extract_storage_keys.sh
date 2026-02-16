#!/bin/bash
set -euo pipefail

# Extract Storage Keys Script
# Scans source for storage key patterns and outputs registry

TARGET_PATH="${1:-.}"
STORAGE_KEY_PATTERNS=(
  'storage\.get\('
  'storage\.set\('
  'storage\.delete\('
)

echo "[INFO] Extracting storage keys from: $TARGET_PATH"

KEYS=()
for pattern in "${STORAGE_KEY_PATTERNS[@]}"; do
  if command -v rg >/dev/null 2>&1; then
    MATCHES=$(rg -A 1 "$pattern" "$TARGET_PATH" 2>/dev/null || true)
  else
    MATCHES=$(grep -rn "$pattern" "$TARGET_PATH" 2>/dev/null || true)
  fi
  
  # Extract string literals (simplified)
  echo "$MATCHES" | grep -oE "\"[^\"]+\"" | sort -u || true
done

echo "[FT_STORAGE_KEYS_EXTRACTED]"
