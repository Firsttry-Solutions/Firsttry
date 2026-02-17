#!/bin/bash
# FT_PROOF:RESOLVE_PHASE4_DIST_ENTRYPOINT_V1
# Deterministic resolver: Find the phase4Bundle.cli.js entrypoint in dist/
# Fails closed (FAIL if 0 or 2+ paths found, PASS if exactly 1)

set -e

CANDIDATES=(
  "dist/security/proof/phase4Bundle.cli.js"
  "dist/proof/phase4Bundle.cli.js"
)

FOUND=()
for c in "${CANDIDATES[@]}"; do
  if [ -f "$c" ]; then
    FOUND+=("$c")
  fi
done

if [ ${#FOUND[@]} -eq 0 ]; then
  echo "FT_PROOF:RESOLVE_ENTRYPOINT_AMBIGUOUS=0_paths_found (fail-closed)" >&2
  exit 1
fi

if [ ${#FOUND[@]} -gt 1 ]; then
  echo "FT_PROOF:RESOLVE_ENTRYPOINT_AMBIGUOUS=multiple_paths: ${FOUND[*]} (fail-closed)" >&2
  exit 1
fi

echo "${FOUND[0]}"
echo "FT_PROOF:RESOLVE_ENTRYPOINT_SUCCESS=${FOUND[0]}" >&2
