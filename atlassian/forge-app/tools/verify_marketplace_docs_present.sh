#!/bin/bash
# Gate: Verify marketplace docs are present and non-empty
# Fails if any of the 5 required marketplace policy docs are missing or < 200 bytes

set -e

DOCS_DIR="./docs"
MIN_SIZE=200

echo "Gate: verify:marketplace-docs"
echo "==============================="

# Check each required doc
DOCS=(
  "PRIVACY_POLICY.md"
  "TERMS_OF_SERVICE.md"
  "SUPPORT.md"
  "SECURITY.md"
  "DATA_HANDLING.md"
)

FAILED=0

for doc in "${DOCS[@]}"; do
  PATH_TO_DOC="$DOCS_DIR/$doc"
  
  if [ ! -f "$PATH_TO_DOC" ]; then
    echo "✗ MISSING: $PATH_TO_DOC"
    FAILED=1
  else
    SIZE=$(wc -c < "$PATH_TO_DOC")
    if [ "$SIZE" -lt "$MIN_SIZE" ]; then
      echo "✗ TOO SMALL ($SIZE bytes, need $MIN_SIZE): $PATH_TO_DOC"
      FAILED=1
    else
      echo "✓ OK ($SIZE bytes): $doc"
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
