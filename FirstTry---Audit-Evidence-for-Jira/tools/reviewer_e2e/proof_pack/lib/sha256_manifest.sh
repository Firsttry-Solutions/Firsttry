#!/usr/bin/env bash
#
# sha256_manifest.sh
# 
# Generates a deterministic SHA256 manifest for all files in a directory.
# 
# Features:
# - Stable sort order (alphabetical)
# - Excludes manifest file itself
# - Excludes PROOF_PACK_SHA256.txt
# - Excludes FINAL_VERDICT.txt
# - Outputs sha256sum format (hash + filename)
# 
# Usage:
#   cd /path/to/evidence/dir
#   ./sha256_manifest.sh > manifest.sha256
# 
# Exit codes:
#   0 - Success
#   1 - Error
#

set -euo pipefail

# Check we're in a directory
if [[ ! -d "." ]]; then
  echo "ERROR: Current directory not found" >&2
  exit 1
fi

# Find all files, excluding manifest and pack hash
# Stable sort order ensures deterministic output
find . -type f \
  ! -name "manifest.sha256" \
  ! -name "PROOF_PACK_SHA256.txt" \
  ! -name "FINAL_VERDICT.txt" \
  | sort \
  | xargs sha256sum

exit 0
