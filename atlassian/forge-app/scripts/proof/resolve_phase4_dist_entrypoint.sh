#!/bin/bash
# FT_PROOF:RESOLVE_PHASE4_DIST_ENTRYPOINT_V1
# Deterministic resolver: Find the phase4Bundle.cli.js entrypoint in dist/
# Fails closed (FAIL if 0 or 2+ paths found, PASS if exactly 1)

set -e

A="dist/src/security/proof/phase4Bundle.cli.js"
B="dist/security/proof/phase4Bundle.cli.js"
C="dist/proof/phase4Bundle.cli.js"

FOUND=()
[ -f "$A" ] && FOUND+=("$A")
[ -f "$B" ] && FOUND+=("$B")
[ -f "$C" ] && FOUND+=("$C")

if [ ${#FOUND[@]} -eq 0 ]; then
  echo "FT_PROOF:RESOLVE_ENTRYPOINT_FAIL=0_paths_found (fail-closed)" >&2
  exit 1
fi

if [ ${#FOUND[@]} -gt 1 ]; then
  echo "FT_PROOF:RESOLVE_ENTRYPOINT_FAIL=multiple_paths: ${FOUND[*]} (fail-closed)" >&2
  exit 1
fi

echo "${FOUND[0]}"
echo "FT_PROOF:RESOLVE_ENTRYPOINT_SUCCESS=${FOUND[0]}" >&2
