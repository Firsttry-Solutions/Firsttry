#!/bin/bash
# Phase 6 STRICT Bundle Provenance Verifier
# 
# SPEC (fail-closed, no warnings allowed):
# - Find exactly 1 bundle file: src/gadget-ui/dist/app.*.js
# - Extract anchor from block comment: /* FT_IDENTITY_ANCHOR_V1|git=...|bundle=...|time=... */
# - Call strip_and_hash.js to:
#   * Verify exactly 1 block comment with anchor
#   * Strip it and compute sha256 of stripped bytes
#   * Verify computed prefix7 == embedded bundle (HARD FAIL if not)
# - Output JSON with all fields
# - HARD FAIL if: any file missing, format invalid, hash mismatch, warnings
# - Only then print "✅ PASS: Bundle provenance verified"

set -e

RUN_DIR="${RUN_DIR:-.}"

# Find the gadget bundle file (must be exactly 1)
BUNDLE_COUNT=$(ls -1 src/gadget-ui/dist/app.*.js 2>/dev/null | wc -l)
if [ "$BUNDLE_COUNT" -ne 1 ]; then
  echo "ERROR: Expected exactly 1 bundle file, found $BUNDLE_COUNT" | tee -a "$RUN_DIR/provenance.log"
  exit 1
fi

BUNDLE="$(ls -1 src/gadget-ui/dist/app.*.js | head -1)"
echo "[verify_bundle_provenance] Bundle: $BUNDLE" | tee -a "$RUN_DIR/provenance.log"

# Call strict hash verifier (will exit 1 on any error)
HASH_JSON=$(node tools/strip_and_hash.js "$BUNDLE" 2>&1)
HASH_EXIT=$?

echo "[verify_bundle_provenance] strip_and_hash.js exit code: $HASH_EXIT" | tee -a "$RUN_DIR/provenance.log"
echo "[verify_bundle_provenance] JSON output:" | tee -a "$RUN_DIR/provenance.log"
echo "$HASH_JSON" | tee -a "$RUN_DIR/provenance.log"

if [ $HASH_EXIT -ne 0 ]; then
  echo "ERROR: strip_and_hash.js failed with exit code $HASH_EXIT" | tee -a "$RUN_DIR/provenance.log"
  exit 1
fi

# Verify JSON structure (must have status=OK and all required fields)
echo "[verify_bundle_provenance] Validating JSON structure..." | tee -a "$RUN_DIR/provenance.log"

STATUS=$(echo "$HASH_JSON" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
ANCHOR_COUNT=$(echo "$HASH_JSON" | grep -o '"anchorCount":[0-9]*' | cut -d':' -f2)
EMBEDDED_BUNDLE=$(echo "$HASH_JSON" | grep -o '"embeddedBundle":"[^"]*"' | cut -d'"' -f4)
COMPUTED_PREFIX=$(echo "$HASH_JSON" | grep -o '"computedPrefix7":"[^"]*"' | cut -d'"' -f4)

echo "[verify_bundle_provenance] status=$STATUS, anchorCount=$ANCHOR_COUNT" | tee -a "$RUN_DIR/provenance.log"
echo "[verify_bundle_provenance] embeddedBundle=$EMBEDDED_BUNDLE, computedPrefix7=$COMPUTED_PREFIX" | tee -a "$RUN_DIR/provenance.log"

# HARD FAIL on any validation failure
if [ "$STATUS" != "OK" ]; then
  echo "ERROR: JSON status is not OK: $STATUS" | tee -a "$RUN_DIR/provenance.log"
  exit 1
fi

if [ "$ANCHOR_COUNT" -ne 1 ]; then
  echo "ERROR: Expected anchorCount=1, got $ANCHOR_COUNT" | tee -a "$RUN_DIR/provenance.log"
  exit 1
fi

if [ "$EMBEDDED_BUNDLE" != "$COMPUTED_PREFIX" ]; then
  echo "ERROR: Bundle mismatch! embedded=$EMBEDDED_BUNDLE but computed=$COMPUTED_PREFIX" | tee -a "$RUN_DIR/provenance.log"
  exit 1
fi

if [ -z "$EMBEDDED_BUNDLE" ] || [ -z "$COMPUTED_PREFIX" ]; then
  echo "ERROR: Missing required fields in JSON" | tee -a "$RUN_DIR/provenance.log"
  exit 1
fi

echo "" | tee -a "$RUN_DIR/provenance.log"
echo "✅ PASS: Bundle provenance verified" | tee -a "$RUN_DIR/provenance.log"
echo "  - Exactly 1 anchor found in block comment" | tee -a "$RUN_DIR/provenance.log"
echo "  - Bundle SHA: $EMBEDDED_BUNDLE (matches computed hash)" | tee -a "$RUN_DIR/provenance.log"
echo "  - No warnings, no mismatches" | tee -a "$RUN_DIR/provenance.log"

exit 0
