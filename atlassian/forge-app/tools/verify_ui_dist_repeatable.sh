#!/bin/bash
#
# tools/verify_ui_dist_repeatable.sh
#
# BACKBONE REPEATABILITY GATE
# Verifies that src/gadget-ui/dist outputs are byte-identical across repeated builds
# on the same commit (determinism verification).
#
# USAGE:
#   bash tools/verify_ui_dist_repeatable.sh
#   Optional: Set RUN_DIR env var to capture artifacts
#
# HARD RULES:
# - All dist files must have identical SHA256 hashes across two builds
# - Uses commit-time-based metadata (no wall-clock time)
# - Cleans dist only (never touches git state)
# - Exits 1 if diff found, 0 if PASS

set -euo pipefail

# Determine output directory (RUN_DIR set by caller, or /tmp)
OUTPUT_DIR="${RUN_DIR:-/tmp}"

# Ensure we're in forge-app root
if [ ! -f "package.json" ] || [ ! -d "src/gadget-ui" ]; then
  echo "❌ ERROR: Not in forge-app root (missing package.json or src/gadget-ui)"
  exit 1
fi

echo "[REPEATABILITY GATE] Starting determinism verification..."
echo "[REPEATABILITY GATE] Output dir: $OUTPUT_DIR"

# Generate deterministic inputs once
echo "[REPEATABILITY GATE] Generating deterministic build metadata..."
node tools/build_meta.mjs > /dev/null
node tools/gen_ui_build_meta.mjs > /dev/null

# ============================================================================
# BUILD 1
# ============================================================================
echo "[REPEATABILITY GATE] BUILD 1: Cleaning dist..."
rm -rf src/gadget-ui/dist

echo "[REPEATABILITY GATE] BUILD 1: Running build..."
(cd src/gadget-ui && npm run build) > /dev/null 2>&1 || {
  echo "❌ BUILD 1 FAILED"
  exit 1
}

echo "[REPEATABILITY GATE] BUILD 1: Computing hashes..."
HASHES_1="$OUTPUT_DIR/ui_dist_hashes_1_$$.txt"
find src/gadget-ui/dist -type f -print0 | sort -z | xargs -0 sha256sum > "$HASHES_1"

HASH_COUNT_1=$(wc -l < "$HASHES_1")
echo "[REPEATABILITY GATE] BUILD 1: Computed $HASH_COUNT_1 file hashes"

# ============================================================================
# BUILD 2
# ============================================================================
echo "[REPEATABILITY GATE] BUILD 2: Cleaning dist..."
rm -rf src/gadget-ui/dist

# DO NOT run build_meta.mjs or gen_ui_build_meta.mjs again (use same metadata)
# This ensures the build uses the exact same timestamps

echo "[REPEATABILITY GATE] BUILD 2: Running build (reusing node_modules)..."
(cd src/gadget-ui && npm run build) > /dev/null 2>&1 || {
  echo "❌ BUILD 2 FAILED"
  exit 1
}

echo "[REPEATABILITY GATE] BUILD 2: Computing hashes..."
HASHES_2="$OUTPUT_DIR/ui_dist_hashes_2_$$.txt"
find src/gadget-ui/dist -type f -print0 | sort -z | xargs -0 sha256sum > "$HASHES_2"

HASH_COUNT_2=$(wc -l < "$HASHES_2")
echo "[REPEATABILITY GATE] BUILD 2: Computed $HASH_COUNT_2 file hashes"

# ============================================================================
# COMPARE
# ============================================================================
echo "[REPEATABILITY GATE] Comparing hashes..."
DIFF_OUTPUT="$OUTPUT_DIR/ui_dist_hashes_diff_$$.txt"

if diff -u "$HASHES_1" "$HASHES_2" > "$DIFF_OUTPUT" 2>&1; then
  # No differences found
  echo ""
  echo "✅ REPEATABILITY VERIFIED"
  echo "   BUILD 1 and BUILD 2 produced byte-identical outputs"
  echo "   Files verified: $HASH_COUNT_1"
  echo ""
  
  # Clean up temp hash files
  rm -f "$HASHES_1" "$HASHES_2" "$DIFF_OUTPUT"
  
  exit 0
else
  # Differences found
  echo ""
  echo "❌ REPEATABILITY FAILED"
  echo "   BUILD 1 and BUILD 2 produced DIFFERENT outputs"
  echo ""
  echo "DIFF OUTPUT:"
  cat "$DIFF_OUTPUT"
  echo ""
  
  # Show which files differ
  echo "DIFFERING FILES:"
  diff -u "$HASHES_1" "$HASHES_2" | grep '^[+-]' | grep -v '^+++\|^---' | sed 's/^[+-]/  /' || true
  echo ""
  
  # Save artifacts for debugging (do NOT clean up)
  echo "Artifacts preserved in $OUTPUT_DIR:"
  echo "  - ui_dist_hashes_1_$$.txt"
  echo "  - ui_dist_hashes_2_$$.txt"
  echo "  - ui_dist_hashes_diff_$$.txt"
  echo ""
  
  exit 1
fi
