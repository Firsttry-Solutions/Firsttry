#!/bin/bash
# proof_capture_env.sh: Capture environment baseline
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <EVID_DIR>"
  exit 1
fi

EVID="$1"

{
  echo "=== DATE ==="
  date -u
  echo ""
  
  echo "=== GIT ==="
  cd /workspaces/Firsttry
  git rev-parse HEAD
  git status --porcelain | head -50
  echo ""
  
  echo "=== NODE/NPM ==="
  node --version
  npm --version
  echo ""
  
  echo "=== FORGE ==="
  forge --version || echo "forge command not found"
  echo ""
  
  echo "=== FORGE WHOAMI ==="
  forge whoami 2>&1 || echo "Not authenticated"
  echo ""
  
  echo "=== FORGE INSTALL LIST PRODUCTION ==="
  forge install list --environment production 2>&1 | head -20 || echo "Not connected"
  
} | tee "$EVID/00_env.txt"

echo "✅ Captured to: $EVID/00_env.txt"
