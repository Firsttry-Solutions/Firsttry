#!/bin/bash
# Gate: Verify aria-live region is present in source (checked before build)
set -euo pipefail

echo "Gate: verify:ui:aria-live"
echo "============================"

# Check source has setAttribute call for aria-live with polite value
if ! grep 'setAttribute.*"aria-live".*"polite"' src/gadget-ui/src/l0_snapshot_mapper.ts > /dev/null 2>&1; then
  echo "✗ GATE FAILED: No setAttribute for aria-live found in l0_snapshot_mapper"
  exit 1
fi
echo "✓ Source has aria-live setAttribute call"

# Check source has role attribute or setAttribute
if ! grep -r 'setAttribute.*"role"' src/gadget-ui/src/l0_snapshot_mapper.ts > /dev/null 2>&1; then
  echo "✗ GATE FAILED: No setAttribute for role attribute in UI source"
  exit 1
fi
echo "✓ Source has role setAttribute call"

echo "✓ OK: aria-live region present in source"
exit 0
