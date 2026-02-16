#!/bin/bash
# Extract and sort scopes from manifest.yml
# Usage: bash scripts/proof/extract_manifest_scopes.sh <manifest-path>
# Output: sorted scope list, one per line

set -euo pipefail

MANIFEST_PATH="${1:-.}"
if [ ! -f "$MANIFEST_PATH" ]; then
  echo "ERROR: manifest not found: $MANIFEST_PATH" >&2
  exit 1
fi

# Extract scopes section and parse (no deps - just grep/sed)
grep -A 20 "^  scopes:" "$MANIFEST_PATH" \
  | grep "^    - " \
  | sed 's/^    - //' \
  | sort
