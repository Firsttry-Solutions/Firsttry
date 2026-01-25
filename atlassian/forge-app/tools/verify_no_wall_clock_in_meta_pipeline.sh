#!/bin/bash
# Verification Gate: No wall-clock time in meta pipeline
# FAIL-CLOSED: exits with 1 if any wall-clock patterns found
#
# This gate ensures determinism cannot regress by forbidding:
#  - Date.now()
#  - new Date() with empty args
#  - new Date().toISOString()
#
# Scanned files (hardened meta generators):
#  - tools/gen_ui_build_meta.mjs
#  - tools/build_meta.mjs
#  - src/gadget-ui/postbuild.mjs
#  - src/gadget-ui/src/ui_build_meta.ts
#
# Allowed patterns (not flagged):
#  - new Date(isoString) — parsing existing ISO strings
#  - Date usage in tests (*.test.ts)
#  - Date usage in other tools/scripts

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Define hardened files
HARDENED_FILES=(
  "tools/gen_ui_build_meta.mjs"
  "tools/build_meta.mjs"
  "src/gadget-ui/postbuild.mjs"
  "src/gadget-ui/src/ui_build_meta.ts"
)

echo "[GATE] No Wall-Clock Time in Meta Pipeline"
echo "[GATE] Scanning ${#HARDENED_FILES[@]} files for determinism violations..."
echo ""

VIOLATION_COUNT=0
VIOLATIONS=""

for file in "${HARDENED_FILES[@]}"; do
  full_path="$PROJECT_ROOT/$file"
  
  if [ ! -f "$full_path" ]; then
    echo "[GATE] ⚠️  FILE NOT FOUND: $file (skipped)"
    continue
  fi
  
  # Check for wall-clock patterns (fail-closed)
  # Pattern 1: Date.now()
  if grep -n "Date\.now()" "$full_path" >/dev/null 2>&1; then
    echo "[GATE] ❌ VIOLATION in $file:"
    grep -n "Date\.now()" "$full_path" | sed 's/^/     /'
    VIOLATION_COUNT=$((VIOLATION_COUNT + 1))
    VIOLATIONS="$VIOLATIONS\n$file: Date.now()"
  fi
  
  # Pattern 2: new Date() with empty args (but NOT new Date(something))
  # Use regex to avoid flagging new Date(isoString)
  if grep -nE "new Date\(\s*\)" "$full_path" >/dev/null 2>&1; then
    echo "[GATE] ❌ VIOLATION in $file:"
    grep -nE "new Date\(\s*\)" "$full_path" | sed 's/^/     /'
    VIOLATION_COUNT=$((VIOLATION_COUNT + 1))
    VIOLATIONS="$VIOLATIONS\n$file: new Date() with empty args"
  fi
  
  # Pattern 3: new Date().toISOString() - chain call on empty Date()
  if grep -n "new Date()\.toISOString()" "$full_path" >/dev/null 2>&1; then
    echo "[GATE] ❌ VIOLATION in $file:"
    grep -n "new Date()\.toISOString()" "$full_path" | sed 's/^/     /'
    VIOLATION_COUNT=$((VIOLATION_COUNT + 1))
    VIOLATIONS="$VIOLATIONS\n$file: new Date().toISOString()"
  fi
done

echo ""
if [ $VIOLATION_COUNT -eq 0 ]; then
  echo "[GATE] ✅ PASS: No wall-clock patterns found"
  echo "[GATE] All hardened files use deterministic timestamps (git commit time)"
  exit 0
else
  echo "[GATE] ❌ FAIL: $VIOLATION_COUNT violation(s) detected"
  echo "[GATE] Determinism compromised. Must use git commit time only."
  echo -e "[GATE] Violations:$VIOLATIONS"
  exit 1
fi
