#!/bin/bash
# Gate: Verify UI support link is present in source (checked before build)
set -euo pipefail

echo "Gate: verify:ui-support-link"
echo "==============================="

# Check source has mailto: marker
if ! grep -r "mailto:" src/gadget-ui/src > /dev/null 2>&1; then
  echo "✗ GATE FAILED: No mailto: found in UI source"
  exit 1
fi
echo "✓ Source has mailto: marker"

echo "✓ OK: Support link present in source"
exit 0
