#!/bin/bash
# Gate: Verify marketplace docs are present and non-empty
# Fails if any of the 5 required marketplace policy docs are missing or < 200 bytes

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MIN_SIZE=200

echo "Gate: verify:marketplace-docs"
echo "==============================="

# Check each required doc — paths are relative to APP_ROOT (vendor tree root)
declare -A DOCS
DOCS["PRIVACY_POLICY.md"]="docs/legal/PRIVACY_POLICY.md"
DOCS["TERMS_OF_SERVICE.md"]="docs/legal/TERMS_OF_SERVICE.md"
DOCS["SUPPORT.md"]="SUPPORT.md"
DOCS["SECURITY.md"]="SECURITY.md"
DOCS["DATA_HANDLING.md"]="docs/trust/data_handling.md"

FAILED=0

for doc in "${!DOCS[@]}"; do
  PATH_TO_DOC="$APP_ROOT/${DOCS[$doc]}"

  if [ ! -f "$PATH_TO_DOC" ]; then
    echo "✗ MISSING: ${DOCS[$doc]}"
    FAILED=1
  else
    SIZE=$(wc -c < "$PATH_TO_DOC")
    if [ "$SIZE" -lt "$MIN_SIZE" ]; then
      echo "✗ TOO SMALL ($SIZE bytes, need $MIN_SIZE): ${DOCS[$doc]}"
      FAILED=1
    else
      echo "✓ OK ($SIZE bytes): $doc -> ${DOCS[$doc]}"
    fi
  fi
done

if [ "$FAILED" -eq 1 ]; then
  echo ""
  echo "GATE FAILED: One or more marketplace docs are missing or empty"
  exit 1
fi

echo ""
echo "✓ All marketplace docs present and complete"
exit 0
