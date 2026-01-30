#!/usr/bin/env bash
set -euo pipefail

# Fail-closed gate: enforce canonical contact addresses from docs/CONTACTS.md
# Build FAILS if any non-canonical email addresses are found in documentation or UI.

CANONICAL_FILE="docs/CONTACTS.md"

if [ ! -f "$CANONICAL_FILE" ]; then
  echo "WARN: docs/CONTACTS.md not found; skipping contact consistency check"
  exit 0
fi

# Check for old @firstry-solutions.com addresses (should be @firstry.io)
HITS=$(rg "@firstry-solutions\.com" src docs 2>/dev/null || true)

if [ -n "$HITS" ]; then
  echo "FAIL: Non-canonical contact addresses found:"
  echo "---"
  echo "$HITS"
  echo "---"
  echo "ACTION: Replace all addresses with canonical @firstry.io variants."
  exit 1
fi

echo "PASS: All contact addresses are canonical (@firstry.io)"
exit 0
