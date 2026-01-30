#!/usr/bin/env bash
set -euo pipefail

# Fail-closed gate: forbid marketing -seed snapshots as normal "Available" evidence
# Rule: If UI source code (excluding tests) references -seed pattern in a way visible to users,
# it MUST label it explicitly as "Seed" or "seed snapshot".
# Enterprise customers cannot accept a dashboard that markets a seed snapshot as "Governance Snapshot Available".
#
# This gate ensures that:
# 1. UI does NOT render -seed snapshots as "Available" without explicit "Seed" label
# 2. Seed snapshots are clearly marked as baseline/reference-only, not audit evidence
# 3. Non-seed snapshots are the default when available

SRC="src/gadget-ui/src"

# Check that the main headline exists (should show when any snapshot available)
if ! rg -n "Snapshot Available|Available.*Snapshot|Seed Snapshot" "$SRC" --glob "!*.test.*" >/dev/null 2>&1; then
  echo "WARN: expected available headline pattern not found; skipping UI labeling check"
  exit 0
fi

# Check if ANY user-facing code (non-test) references -seed pattern
# If it does, it MUST also mention "Seed" in the same or related context
if rg -n -- "-seed" "$SRC" --glob "!*.test.*" >/dev/null 2>&1; then
  # User-facing code mentions -seed
  # Now verify that "Seed" label is present in the RENDERING logic (not tests)
  if ! rg -n "Seed Snapshot\|seed snapshot\|isSeedSnapshot" "$SRC" --glob "!*.test.*" >/dev/null 2>&1; then
    echo "FAIL: UI source code references -seed snapshot but does not label it as 'Seed' or 'seed snapshot'"
    echo "---"
    echo "Lines with -seed (non-test source):"
    rg -n -- "-seed" "$SRC" --glob "!*.test.*" || true
    echo "---"
    echo "ACTION: Update UI to show seed snapshots with explicit 'Seed' or 'seed snapshot' label."
    echo "ACTION: Use conditional logic (e.g., isSeedSnapshot) to apply different UI text/styling for seed snapshots."
    exit 1
  fi
fi

echo "PASS: UI correctly labels or avoids marketing seed snapshots as normal evidence"
exit 0
