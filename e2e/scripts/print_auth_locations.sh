#!/bin/bash
#
# E2E: Print Auth Locations
#
# Prints where storageState files should be placed and their current status.
# Does NOT print file contents (secrets).
# Only prints paths, sizes, and modification times.
#

set -euo pipefail

AUTH_DIR="${1:-.}/e2e/.auth"

echo "================================================================================"
echo "Auth Storage Locations & Status"
echo "================================================================================"
echo ""

# Accepted storageState file names
echo "Accepted storageState file names:"
echo "  • storageState.json"
echo "  • storageState.persistent.json"
echo ""

# Primary location
echo "Primary storage location:"
STORAGE_STATE="${STORAGE_STATE:-$AUTH_DIR/storageState.persistent.json}"
echo "  Location: $STORAGE_STATE"
echo ""

# Current status
echo "File status:"
if [ -f "$STORAGE_STATE" ]; then
  size=$(wc -c < "$STORAGE_STATE")
  mtime=$(stat -c %y "$STORAGE_STATE" 2>/dev/null || stat -f "%Sm" "$STORAGE_STATE" 2>/dev/null || echo "unknown")
  echo "  ✅ EXISTS"
  echo "     Path: $STORAGE_STATE"
  echo "     Size: $size bytes"
  echo "     Modified: $mtime"
else
  echo "  ❌ NOT FOUND"
  echo "     Expected: $STORAGE_STATE"
fi

echo ""

# Fallback locations
FALLBACK_1="$AUTH_DIR/storageState.json"
if [ -f "$FALLBACK_1" ]; then
  size=$(wc -c < "$FALLBACK_1")
  mtime=$(stat -c %y "$FALLBACK_1" 2>/dev/null || stat -f "%Sm" "$FALLBACK_1" 2>/dev/null || echo "unknown")
  echo "Fallback location:"
  echo "  ✅ EXISTS"
  echo "     Path: $FALLBACK_1"
  echo "     Size: $size bytes"
  echo "     Modified: $mtime"
else
  echo "Fallback location:"
  echo "  ❌ NOT FOUND"
  echo "     Path: $FALLBACK_1"
fi

echo ""

# Directory status
echo "Auth directory:"
if [ -d "$AUTH_DIR" ]; then
  echo "  ✅ EXISTS: $AUTH_DIR"
  echo ""
  echo "  Contents (non-secret files only):"
  ls -lh "$AUTH_DIR" 2>/dev/null | grep -v "storageState" | tail -n +2 | awk '{print "    "$9" ("$5")"}' || echo "    (no non-secret files)"
else
  echo "  ❌ NOT FOUND: $AUTH_DIR"
fi

echo ""
echo "================================================================================"
echo "To refresh auth:"
echo "  1. On a machine with GUI display:"
echo "     npm run dashboard:auth"
echo "  2. Copy the resulting storageState.json or storageState.persistent.json"
echo "  3. Place it in: $STORAGE_STATE"
echo "  4. Re-run: npm run dashboard:playwright"
echo "================================================================================"
echo ""

exit 0
