#!/bin/bash
# Gate: Verify no timers/polling/retries in L0 dashboard renderer
set -euo pipefail

echo "Gate: verify:no-timers-in-l0-dashboard"
echo "======================================"

# Check L0 dashboard renderer specifically (exclude animation timers in main.ts)
if grep "setInterval\|setTimeout\|requestAnimationFrame" src/gadget-ui/src/l0_snapshot_mapper.ts 2>/dev/null; then
  echo "✗ GATE FAILED: Timer primitives detected in l0_snapshot_mapper.ts"
  exit 1
fi

echo "✓ OK: No timer primitives in l0_snapshot_mapper"
exit 0
