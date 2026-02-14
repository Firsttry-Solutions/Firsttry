#!/bin/bash

###############################################################################
# GUARD: Runtime Version Verification
#
# Ensures Node and npm versions match locked versions before build/test.
# Fail-closed: version mismatch exits 1.
#
# Locked versions (from .nvmrc and package.json engines):
# - Node: 20.20.0
# - npm: 10.8.2
#
###############################################################################

set -euo pipefail

trap 'exit_code=$?; echo "[FT_PROOF] Runtime guard cleanup (exit=$exit_code)"; exit $exit_code' EXIT

WORKSPACE="${1:-.}"
REQUIRED_NODE="20.20.0"
REQUIRED_NPM="10.8.2"

echo "[FT_PROOF] Runtime Version Guard"
echo "[FT_PROOF] ═══════════════════════════════════════════════════════"

# Check Node version
CURRENT_NODE=$(node -v | sed 's/^v//')
echo "[FT_PROOF] Node required: $REQUIRED_NODE"
echo "[FT_PROOF] Node current:  $CURRENT_NODE"

if [ "$CURRENT_NODE" != "$REQUIRED_NODE" ]; then
  echo "[FT_PROOF] ERROR: Node version mismatch"
  echo "[FT_PROOF] Fix with: nvm use 20.20.0"
  exit 1
fi

# Check npm version
CURRENT_NPM=$(npm -v)
echo "[FT_PROOF] npm required: $REQUIRED_NPM"
echo "[FT_PROOF] npm current:  $CURRENT_NPM"

if [ "$CURRENT_NPM" != "$REQUIRED_NPM" ]; then
  echo "[FT_PROOF] ERROR: npm version mismatch"
  echo "[FT_PROOF] Fix with: npm install -g npm@10.8.2"
  exit 1
fi

echo "[FT_PROOF] ═══════════════════════════════════════════════════════"
echo "[FT_PROOF] RUNTIME_OK node=$CURRENT_NODE npm=$CURRENT_NPM"
echo "[FT_PROOF] ═══════════════════════════════════════════════════════"

exit 0
