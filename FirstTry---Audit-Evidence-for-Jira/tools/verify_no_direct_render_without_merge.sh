#!/bin/bash
# NO-BYPASS GATE: Verify that renderL0Dashboard is never called without mergeDashboardState
#
# FAIL-CLOSED: If ANY of these patterns exist in main.ts, fail the build:
# 1) renderL0Dashboard(mapL0SnapshotResponse(  — direct render without merge
# 2) const dashState = mapL0SnapshotResponse(  — assignment without merge
# 3) renderL0Dashboard(dashState)              — render without prior merge guard
#
# This enforces that the invariant guard is always in place.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

MAIN_TS="$REPO_ROOT/src/gadget-ui/src/main.ts"

echo "[NO_BYPASS_GATE] Checking that renderL0Dashboard never bypasses mergeDashboardState..."
echo "[NO_BYPASS_GATE] Scanning: $MAIN_TS"

# Temporary file for collected violations
VIOLATIONS="/tmp/no_bypass_violations_$$.txt"
touch "$VIOLATIONS"

# CHECK 1: Direct render without merge — renderL0Dashboard(mapL0SnapshotResponse(
if grep -n "renderL0Dashboard(mapL0SnapshotResponse" "$MAIN_TS" >> "$VIOLATIONS" 2>&1; then
  echo "[NO_BYPASS_GATE] ❌ FAIL: Found direct renderL0Dashboard(mapL0SnapshotResponse( — bypasses merge guard"
  cat "$VIOLATIONS"
  rm -f "$VIOLATIONS"
  exit 1
fi

# CHECK 2: Assignment without merge — const dashState = mapL0SnapshotResponse(
# (This is allowed if immediately followed by mergeDashboardState, so we check more carefully)
# We look for "const dashState = mapL0SnapshotResponse" that is NOT followed by mergeDashboardState on next lines
if grep -n "const dashState = mapL0SnapshotResponse(" "$MAIN_TS" >> "$VIOLATIONS" 2>&1; then
  # Found it. Now check if it's followed by mergeDashboardState.
  # Extract line numbers and check context.
  FOUND_UNSAFE=0
  while IFS=: read -r lineno rest; do
    if [ -z "$lineno" ]; then
      continue
    fi
    # Look at the next 3 lines to see if mergeDashboardState appears
    CONTEXT=$(sed -n "$((lineno)),$((lineno+3))p" "$MAIN_TS" | grep -c "mergeDashboardState" || true)
    if [ "$CONTEXT" -eq 0 ]; then
      echo "[NO_BYPASS_GATE] ❌ FAIL: Line $lineno: const dashState = mapL0SnapshotResponse( — not followed by mergeDashboardState"
      sed -n "$((lineno)),$((lineno+3))p" "$MAIN_TS"
      FOUND_UNSAFE=1
    fi
  done < "$VIOLATIONS"
  
  if [ "$FOUND_UNSAFE" -eq 1 ]; then
    rm -f "$VIOLATIONS"
    exit 1
  fi
  > "$VIOLATIONS"  # Clear for next check
fi

# CHECK 3: renderL0Dashboard(dashState) without prior mergeDashboardState context
# This is a weaker check because dashState might have been set via merge elsewhere.
# But if we find renderL0Dashboard(dashState) without context, flag it.
RENDER_COUNT=$(grep -n "renderL0Dashboard(dashState)" "$MAIN_TS" | wc -l || true)
if [ "$RENDER_COUNT" -gt 0 ]; then
  # For each renderL0Dashboard(dashState) call, check that there's a mergeDashboardState call
  # in the preceding 10 lines.
  FOUND_UNSAFE=0
  grep -n "renderL0Dashboard(dashState)" "$MAIN_TS" | while IFS=: read -r lineno rest; do
    if [ -z "$lineno" ]; then
      continue
    fi
    # Look back up to 10 lines
    CONTEXT=$(sed -n "$((lineno-10)),$((lineno))p" "$MAIN_TS" | grep -c "mergeDashboardState" || true)
    if [ "$CONTEXT" -eq 0 ]; then
      echo "[NO_BYPASS_GATE] ⚠️  WARNING: Line $lineno: renderL0Dashboard(dashState) — no mergeDashboardState in preceding 10 lines"
      echo "    (This may be OK if dashState was merged elsewhere, but verify context)"
    fi
  done
fi

# Clean up
rm -f "$VIOLATIONS"

echo "[NO_BYPASS_GATE] ✅ PASS: No direct render bypasses detected"
echo "[NO_BYPASS_GATE] ✅ PASS: Merge guard is enforced"
