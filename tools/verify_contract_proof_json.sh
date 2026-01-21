#!/bin/bash
#
# verify_contract_proof_json.sh
#
# Deterministic assertion script for production envelope contract proof.
# Validates that the production backend returns the strict DashEnvelopeV1 format.
#
# Usage:
#   bash /workspaces/Firsttry/tools/verify_contract_proof_json.sh /path/to/proof.json
#
# Exit codes:
#   0 = All assertions PASS ✅
#   1 = Assertion failed (details printed)
#

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <proof-json-file>" >&2
  exit 1
fi

PROOF_FILE="$1"

if [[ ! -f "$PROOF_FILE" ]]; then
  echo "ERROR: Proof file not found: $PROOF_FILE" >&2
  exit 1
fi

echo "════════════════════════════════════════════════════════════════"
echo "PRODUCTION ENVELOPE CONTRACT VERIFICATION"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "Proof JSON: $PROOF_FILE"
echo ""

# Helper: assert equality
assert_eq() {
  local path="$1"
  local expected="$2"
  local label="$3"
  
  local actual
  actual=$(jq -r "$path" "$PROOF_FILE" 2>/dev/null || echo "NULL")
  
  if [[ "$actual" != "$expected" ]]; then
    echo "❌ FAILED: $label"
    echo "   Path: $path"
    echo "   Expected: $expected"
    echo "   Actual: $actual"
    echo ""
    echo "Raw JSON:"
    jq . "$PROOF_FILE" 2>/dev/null || cat "$PROOF_FILE"
    exit 1
  fi
  
  echo "✓ $label: $actual"
}

# Helper: assert exists
assert_exists() {
  local path="$1"
  local label="$2"
  
  local actual
  actual=$(jq "$path" "$PROOF_FILE" 2>/dev/null || echo "null")
  
  if [[ "$actual" == "null" ]] || [[ -z "$actual" ]]; then
    echo "❌ FAILED: $label (field missing or null)"
    echo "   Path: $path"
    echo ""
    echo "Raw JSON:"
    jq . "$PROOF_FILE" 2>/dev/null || cat "$PROOF_FILE"
    exit 1
  fi
  
  echo "✓ $label exists"
}

# Helper: assert is boolean
assert_is_boolean() {
  local path="$1"
  local label="$2"
  
  local actual
  actual=$(jq "$path | type" "$PROOF_FILE" 2>/dev/null || echo "\"UNKNOWN\"")
  
  if [[ "$actual" != "\"boolean\"" ]]; then
    echo "❌ FAILED: $label (must be boolean)"
    echo "   Path: $path"
    echo "   Expected type: boolean"
    echo "   Actual type: $actual"
    echo ""
    echo "Raw JSON:"
    jq . "$PROOF_FILE" 2>/dev/null || cat "$PROOF_FILE"
    exit 1
  fi
  
  echo "✓ $label is boolean"
}

# Helper: assert conditional (data exists if ok=true, error exists if ok=false)
assert_envelope_consistency() {
  local ok_val
  ok_val=$(jq -r ".ok" "$PROOF_FILE" 2>/dev/null || echo "NULL")
  
  if [[ "$ok_val" == "true" ]]; then
    local has_data
    has_data=$(jq "has(\"data\") and .data != null" "$PROOF_FILE" 2>/dev/null || echo "false")
    if [[ "$has_data" != "true" ]]; then
      echo "❌ FAILED: ok=true but data is missing or null"
      jq . "$PROOF_FILE"
      exit 1
    fi
    echo "✓ ok=true and data exists"
  elif [[ "$ok_val" == "false" ]]; then
    local has_error
    has_error=$(jq "has(\"error\") and .error != null" "$PROOF_FILE" 2>/dev/null || echo "false")
    if [[ "$has_error" != "true" ]]; then
      echo "❌ FAILED: ok=false but error is missing or null"
      jq . "$PROOF_FILE"
      exit 1
    fi
    echo "✓ ok=false and error exists"
  fi
}

# ════════════════════════════════════════════════════════════════
# ASSERTIONS
# ════════════════════════════════════════════════════════════════

echo "Validating envelope structure..."
echo ""

# Required fields
assert_eq ".envelopeKind" "FT_DASH_ENVELOPE_V1" "Marker envelopeKind"
assert_eq ".envelopeVersion" "1" "Envelope version"

# Schema version check - it's a string "v1" in JSON, so we check raw value
SCHEMA_VER=$(jq -r ".schemaVersion" "$PROOF_FILE" 2>/dev/null || echo "NULL")
if [[ "$SCHEMA_VER" != "v1" ]]; then
  echo "❌ FAILED: Schema version (must be string 'v1')"
  echo "   Expected: v1"
  echo "   Actual: $SCHEMA_VER"
  echo ""
  jq . "$PROOF_FILE"
  exit 1
fi
echo "✓ Schema version (must be string 'v1'): $SCHEMA_VER"

assert_is_boolean ".ok" "ok field"
assert_envelope_consistency
assert_exists ".meta" "meta field"

# Meta structure
echo ""
echo "Validating meta structure..."
assert_exists ".meta.ts_utc" "meta.ts_utc (timestamp)"

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "✅ ALL ASSERTIONS PASSED"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "Full proof JSON:"
jq . "$PROOF_FILE"
