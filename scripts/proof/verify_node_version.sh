#!/bin/bash
set -euo pipefail

# Verify Node Version Script
# Ensures Node and npm match expected versions for deterministic builds

EXPECTED_NODE_MAJOR=20
EXPECTED_NODE_MINOR=20
EXPECTED_NODE_PATCH=0

ACTUAL_NODE=$(node -v)
ACTUAL_NODE_VERSION="${ACTUAL_NODE:1}"  # Remove 'v' prefix

# Parse version
IFS='.' read -r MAJOR MINOR PATCH <<< "$ACTUAL_NODE_VERSION"

if [[ "$MAJOR" != "$EXPECTED_NODE_MAJOR" ]] || [[ "$MINOR" != "$EXPECTED_NODE_MINOR" ]]; then
  echo "[FAIL] Node version mismatch"
  echo "Expected: ${EXPECTED_NODE_MAJOR}.${EXPECTED_NODE_MINOR}.${EXPECTED_NODE_PATCH}"
  echo "Actual: ${ACTUAL_NODE_VERSION}"
  exit 1
fi

echo "[PASS] Node version verified: ${ACTUAL_NODE_VERSION}"
echo "[FT_NODE_VERSION_GUARD_PASS]"
