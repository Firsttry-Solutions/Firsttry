#!/bin/bash
# Phase 6 STRICT Bundle Provenance Verifier
# 
# SPEC (fail-closed, no warnings allowed):
# - Find exactly 1 bundle file: src/gadget-ui/dist/app.js
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

# Find the gadget bundle file (must be exactly 1, supports content-hashed names)
BUNDLE_COUNT=$(ls -1 src/gadget-ui/dist/app.js src/gadget-ui/dist/app.*.js 2>/dev/null | wc -l)
if [ "$BUNDLE_COUNT" -ne 1 ]; then
  echo "ERROR: Expected exactly 1 bundle file, found $BUNDLE_COUNT" | tee -a "$RUN_DIR/provenance.log"
  exit 1
fi

BUNDLE="$(ls -1 src/gadget-ui/dist/app.js src/gadget-ui/dist/app.*.js 2>/dev/null | head -1)"
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

# Use Node to parse JSON robustly (avoid grep fragility on multiline JSON)
PARSE_RESULT=$(node -e "
try {
  const json = JSON.parse(process.argv[1]);
  console.log(json.status || 'MISSING');
  console.log(json.anchorCount || '0');
  console.log(json.embeddedBundle || 'MISSING');
  console.log(json.computedPrefix7 || 'MISSING');
} catch (err) {
  console.error('JSON_PARSE_ERROR');
  process.exit(1);
}
" "$HASH_JSON" 2>&1)

if [ $? -ne 0 ]; then
  echo "ERROR: Failed to parse JSON: $PARSE_RESULT" | tee -a "$RUN_DIR/provenance.log"
  exit 1
fi

STATUS=$(echo "$PARSE_RESULT" | sed -n '1p')
ANCHOR_COUNT=$(echo "$PARSE_RESULT" | sed -n '2p')
EMBEDDED_BUNDLE=$(echo "$PARSE_RESULT" | sed -n '3p')
COMPUTED_PREFIX=$(echo "$PARSE_RESULT" | sed -n '4p')

echo "[verify_bundle_provenance] status=$STATUS, anchorCount=$ANCHOR_COUNT" | tee -a "$RUN_DIR/provenance.log"
echo "[verify_bundle_provenance] embeddedBundle=$EMBEDDED_BUNDLE, computedPrefix7=$COMPUTED_PREFIX" | tee -a "$RUN_DIR/provenance.log"

# HARD FAIL on any validation failure
if [ "$STATUS" != "OK" ]; then
  echo "ERROR: JSON status is not OK: $STATUS" | tee -a "$RUN_DIR/provenance.log"
  exit 1
fi

if [ "$ANCHOR_COUNT" != "1" ]; then
  echo "ERROR: Expected anchorCount=1, got $ANCHOR_COUNT" | tee -a "$RUN_DIR/provenance.log"
  exit 1
fi

if [ "$EMBEDDED_BUNDLE" != "$COMPUTED_PREFIX" ]; then
  echo "ERROR: Bundle mismatch! embedded=$EMBEDDED_BUNDLE but computed=$COMPUTED_PREFIX" | tee -a "$RUN_DIR/provenance.log"
  exit 1
fi

if [ -z "$EMBEDDED_BUNDLE" ] || [ "$EMBEDDED_BUNDLE" = "MISSING" ] || [ -z "$COMPUTED_PREFIX" ] || [ "$COMPUTED_PREFIX" = "MISSING" ]; then
  echo "ERROR: Missing required fields in JSON" | tee -a "$RUN_DIR/provenance.log"
  exit 1
fi

echo "" | tee -a "$RUN_DIR/provenance.log"
echo "✅ PASS: Bundle provenance verified" | tee -a "$RUN_DIR/provenance.log"
echo "  - Exactly 1 anchor found in block comment" | tee -a "$RUN_DIR/provenance.log"
echo "  - Bundle SHA: $EMBEDDED_BUNDLE (matches computed hash)" | tee -a "$RUN_DIR/provenance.log"
echo "  - No warnings, no mismatches" | tee -a "$RUN_DIR/provenance.log"

exit 0
