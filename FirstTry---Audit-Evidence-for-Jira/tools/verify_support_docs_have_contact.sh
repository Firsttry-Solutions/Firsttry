#!/bin/bash
# Gate: Verify support docs have contact info
# Fails if docs/SUPPORT.md does not contain @ or mailto: (basic contact presence)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SUPPORT_DOC="$APP_ROOT/SUPPORT.md"

echo "Gate: verify:support-docs"
echo "=========================="

if [ ! -f "$SUPPORT_DOC" ]; then
  echo "✗ MISSING: $SUPPORT_DOC"
  exit 1
fi

# Check for @ or mailto: (basic contact presence)
if grep -q '@\|mailto:' "$SUPPORT_DOC"; then
  echo "✓ OK: $SUPPORT_DOC contains contact info (@ or mailto:)"
  exit 0
else
  echo "✗ FAILED: $SUPPORT_DOC does not contain contact info (@ or mailto:)"
  echo "  Please add support email or contact method"
  exit 1
fi
