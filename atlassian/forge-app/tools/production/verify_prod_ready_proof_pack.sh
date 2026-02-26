#!/bin/bash
# verify_prod_ready_proof_pack.sh — fail-closed proof-pack verifier
#
# Usage: bash tools/production/verify_prod_ready_proof_pack.sh /absolute/path/to/proof_pack_dir
#
# Verifies the tamper-evident binding produced by run_prod_ready_audit.sh:
#   1. Required files all exist and are non-empty / correctly formatted
#   2. manifest_files.txt includes the binding artifacts (self-describing check)
#   3. manifest_sha256 corresponds to hash_inputs (manifest_files minus computed outputs)
#   4. packhash == sha256(manifest_sha256.txt)
#
# Design: NEVER prints PASS if any required file is missing (fail-closed).
#         Every error path exits 1 with an explicit FAIL message.

set -uo pipefail

# ==============================================================================
# Argument validation: require exactly one non-empty absolute directory path
# ==============================================================================
if [ $# -ne 1 ] || [ -z "$1" ]; then
  echo "FAIL: usage: $0 /absolute/path/to/proof_pack_dir" >&2
  exit 1
fi

PACK_DIR="$1"

if [ ! -d "$PACK_DIR" ]; then
  echo "FAIL: proof pack directory does not exist or is not a directory: $PACK_DIR" >&2
  exit 1
fi

# ==============================================================================
# Required-file presence check (fail-closed: any missing file => FAIL exit 1)
# ==============================================================================
REQUIRED_FILES=(
  "09_release/prod_ready_manifest_files.txt"
  "09_release/prod_ready_manifest_sha256.txt"
  "09_release/prod_ready_manifest_hash_inputs.txt"
  "09_release/prod_ready_packhash.txt"
  "09_release/prod_ready_manifest_exclusions.txt"
  "PROD_READY_VERDICT.txt"
  "09_release/run_prod_ready_audit.exit_code.txt"
  "09_release/run_prod_ready_audit.full.log"
)

FAILURES=0

for rel in "${REQUIRED_FILES[@]}"; do
  full="$PACK_DIR/$rel"
  if [ ! -f "$full" ]; then
    echo "FAIL: required file missing: $rel" >&2
    FAILURES=$((FAILURES + 1))
  elif [ ! -s "$full" ]; then
    echo "FAIL: required file is empty: $rel" >&2
    FAILURES=$((FAILURES + 1))
  fi
done

if [ "$FAILURES" -ne 0 ]; then
  echo "FAIL: $FAILURES required file(s) missing or empty — aborting (fail-closed)" >&2
  exit 1
fi

MANIFEST_FILES="$PACK_DIR/09_release/prod_ready_manifest_files.txt"
MANIFEST_SHA256="$PACK_DIR/09_release/prod_ready_manifest_sha256.txt"
MANIFEST_HASH_INPUTS="$PACK_DIR/09_release/prod_ready_manifest_hash_inputs.txt"
PACKHASH_FILE="$PACK_DIR/09_release/prod_ready_packhash.txt"

# ==============================================================================
# Format validation: packhash must be exactly 64 lowercase hex characters
# ==============================================================================
STORED_PACKHASH="$(cat "$PACKHASH_FILE")"
if ! echo "$STORED_PACKHASH" | grep -qE '^[0-9a-f]{64}$'; then
  echo "FAIL: packhash is not 64 lowercase hex characters: '$STORED_PACKHASH'" >&2
  exit 1
fi

# ==============================================================================
# Format validation: every line in manifest_sha256 must match sha256sum format
# ==============================================================================
while IFS= read -r line; do
  if ! echo "$line" | grep -qE '^[0-9a-f]{64}  .+'; then
    echo "FAIL: manifest_sha256 line has unexpected format: '$line'" >&2
    exit 1
  fi
done < "$MANIFEST_SHA256"

# ==============================================================================
# Self-describing check: manifest_files MUST include the core binding artifacts
# ==============================================================================
BINDING_ARTIFACTS=(
  "09_release/prod_ready_manifest_files.txt"
  "09_release/prod_ready_manifest_sha256.txt"
  "09_release/prod_ready_manifest_hash_inputs.txt"
  "09_release/prod_ready_packhash.txt"
  "09_release/prod_ready_manifest_exclusions.txt"
)

for artifact in "${BINDING_ARTIFACTS[@]}"; do
  if ! grep -qxF "$artifact" "$MANIFEST_FILES"; then
    echo "FAIL: manifest_files does not include binding artifact: $artifact" >&2
    FAILURES=$((FAILURES + 1))
  fi
done

if [ "$FAILURES" -ne 0 ]; then
  echo "FAIL: manifest is not self-describing — binding artifacts missing from manifest_files" >&2
  exit 1
fi

# Binding artifacts must NOT be in exclusions
for artifact in "${BINDING_ARTIFACTS[@]}"; do
  if grep -qxF "$artifact" "$PACK_DIR/09_release/prod_ready_manifest_exclusions.txt"; then
    echo "FAIL: exclusions incorrectly contains binding artifact: $artifact" >&2
    FAILURES=$((FAILURES + 1))
  fi
done

if [ "$FAILURES" -ne 0 ]; then
  echo "FAIL: binding artifacts appear in exclusions list — violates self-describing contract" >&2
  exit 1
fi

# ==============================================================================
# Verify hash_inputs = manifest_files minus {manifest_sha256, packhash}
# ==============================================================================
RECOMPUTED_HASH_INPUTS="$(mktemp)"
trap 'rm -f "$RECOMPUTED_HASH_INPUTS"' EXIT

grep -v '^09_release/prod_ready_manifest_sha256\.txt$' "$MANIFEST_FILES" \
  | grep -v '^09_release/prod_ready_packhash\.txt$' \
  > "$RECOMPUTED_HASH_INPUTS"

if ! diff -q "$RECOMPUTED_HASH_INPUTS" "$MANIFEST_HASH_INPUTS" > /dev/null 2>&1; then
  echo "FAIL: manifest_hash_inputs does not match the expected derived set (manifest_files minus sha256+packhash)" >&2
  echo "  Expected (recomputed):" >&2
  diff "$RECOMPUTED_HASH_INPUTS" "$MANIFEST_HASH_INPUTS" >&2 || true
  exit 1
fi

# ==============================================================================
# Re-hash all files in hash_inputs and compare to stored manifest_sha256
# ==============================================================================
RECOMPUTED_SHA256="$(mktemp)"
trap 'rm -f "$RECOMPUTED_HASH_INPUTS" "$RECOMPUTED_SHA256"' EXIT

export LC_ALL=C

(
  cd "$PACK_DIR" || { echo "FAIL: cannot cd to pack dir: $PACK_DIR" >&2; exit 1; }

  SHA_FAIL=0

  while IFS= read -r filepath; do
    if [ ! -f "$filepath" ]; then
      echo "FAIL: hash_inputs references missing file: $filepath" >&2
      SHA_FAIL=1
      continue
    fi
    sha256sum "$filepath" 2>/dev/null || {
      echo "FAIL: sha256sum failed for: $filepath" >&2
      SHA_FAIL=1
    }
  done < "$MANIFEST_HASH_INPUTS" > "$RECOMPUTED_SHA256"

  if [ "$SHA_FAIL" -ne 0 ]; then
    echo "FAIL: one or more files in hash_inputs failed to hash" >&2
    exit 1
  fi
) || exit 1

if ! diff -q "$RECOMPUTED_SHA256" "$MANIFEST_SHA256" > /dev/null 2>&1; then
  echo "FAIL: manifest_sha256 does not match recomputed sha256 of hash_inputs" >&2
  diff "$RECOMPUTED_SHA256" "$MANIFEST_SHA256" >&2 || true
  exit 1
fi

# ==============================================================================
# Verify packhash == sha256(manifest_sha256.txt)
# ==============================================================================
RECOMPUTED_PACKHASH="$(
  cd "$PACK_DIR" && sha256sum "09_release/prod_ready_manifest_sha256.txt" | awk '{print $1}'
)"

if [ -z "$RECOMPUTED_PACKHASH" ]; then
  echo "FAIL: failed to recompute packhash" >&2
  exit 1
fi

if [ "$RECOMPUTED_PACKHASH" != "$STORED_PACKHASH" ]; then
  echo "FAIL: packhash mismatch" >&2
  echo "  stored  : $STORED_PACKHASH" >&2
  echo "  computed: $RECOMPUTED_PACKHASH" >&2
  exit 1
fi

# ==============================================================================
# Cross-check: FULL_LOG must contain PROOF_PACK_PACKHASH label (reviewer aid)
# The label is written by run_prod_ready_audit.sh after pass-1 binding; its
# presence confirms the pack was generated by the audit script (not hand-crafted)
# and gives a reviewer a human-readable hash to verify chain of custody.
# ==============================================================================
FULL_LOG_FILE="$PACK_DIR/09_release/run_prod_ready_audit.full.log"
FULLLOG_PACKHASH_LINE="$(grep -m1 '^PROOF_PACK_PACKHASH: ' "$FULL_LOG_FILE" || true)"
if [ -z "$FULLLOG_PACKHASH_LINE" ]; then
  echo "FAIL: full.log missing PROOF_PACK_PACKHASH: label — pack is not buyer-ready" >&2
  exit 1
fi
FULLLOG_PACKHASH_VAL="${FULLLOG_PACKHASH_LINE#PROOF_PACK_PACKHASH: }"
if ! echo "$FULLLOG_PACKHASH_VAL" | grep -qE '^[0-9a-f]{64}$'; then
  echo "FAIL: full.log PROOF_PACK_PACKHASH value is not a valid 64-hex hash: '$FULLLOG_PACKHASH_VAL'" >&2
  exit 1
fi

# ==============================================================================
# All checks passed
# ==============================================================================
PACK_VER="$(cat "$PACK_DIR/PROD_READY_VERDICT.txt")"
EXIT_CODE_VAL="$(cat "$PACK_DIR/09_release/run_prod_ready_audit.exit_code.txt")"

echo ""
echo "========================================================"
echo "  verify_prod_ready_proof_pack.sh"
echo "  Pack dir    : $PACK_DIR"
echo "  Verdict     : $PACK_VER"
echo "  Exit code   : $EXIT_CODE_VAL"
echo "  Packhash    : $STORED_PACKHASH"
echo "  Manifest    : $(wc -l < "$MANIFEST_FILES") files listed"
echo "  Hash inputs : $(wc -l < "$MANIFEST_HASH_INPUTS") files hashed"
echo "  STATUS      : PASS"
echo "========================================================"
echo ""
exit 0
