#!/bin/bash
# Gate: Verify aria-live region is present in source (checked before build)
set -euo pipefail

echo "Gate: verify:ui-aria-live"
echo "============================"

# Check source has aria-live marker
if ! grep -r "aria-live" src/gadget-ui/src > /dev/null 2>&1; then
  echo "✗ GATE FAILED: No aria-live found in UI source"
  exit 1
fi
echo "✓ Source has aria-live marker"

# Check source has role attribute
if ! grep -r 'role' src/gadget-ui/src > /dev/null 2>&1; then
  echo "✗ GATE FAILED: No role attribute in UI source"
  exit 1
fi
echo "✓ Source has role attribute"

echo "✓ OK: aria-live region present in source"
exit 0
