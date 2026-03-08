#!/usr/bin/env bash
set -euo pipefail

# Verify no top-level throw in entry bundle
# The entry point app*.js must not start with a throw statement

cd /workspaces/Firsttry/atlassian/forge-app

echo "[verify_no_top_level_throw_in_entry] Checking entry bundle for top-level throw..."

# Find the entry bundle (app.js)
ENTRY=$(ls -1 src/gadget-ui/dist/app.js 2>/dev/null | head -1)

if [ -z "$ENTRY" ]; then
  echo "ERROR: No app.js found in dist"
  exit 1
fi

echo "Checking: $ENTRY"

# Get first 3000 characters and look for "throw" at start (after comments)
HEAD=$(head -c 3000 "$ENTRY")

# Check if the bundle starts with throw (ignoring leading comments/whitespace)
if echo "$HEAD" | rg -q "^[^/]*throw\s+(new\s+)?Error\|^[^/]*throw\s+[A-Za-z_]"; then
  echo "FAIL: Top-level throw detected in entry bundle"
  echo "The bundle must not throw unconditionally at module load"
  echo ""
  echo "First 500 characters:"
  head -c 500 "$ENTRY"
  echo ""
  exit 1
fi

echo "OK: No top-level throw in entry bundle"
exit 0
