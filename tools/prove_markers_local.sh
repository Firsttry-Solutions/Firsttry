#!/bin/bash
# tools/prove_markers_local.sh
# 
# Local validator: Confirm FT_PROOF_MARKER is emitted in getBuildInfo resolver code.
# This is a deterministic check that can run locally without Forge deployment.
#
# Usage:
#   bash tools/prove_markers_local.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FORGE_APP_DIR="$REPO_ROOT/atlassian/forge-app"

echo "=== FT_PROOF_MARKER Proof Validator ==="
echo ""

# Check 1: FT_PROOF_MARKER exists in getBuildInfo resolver code
echo "[1] Checking getBuildInfo resolver for FT_PROOF_MARKER..."
if grep -q "FT_PROOF_MARKER" "$FORGE_APP_DIR/src/resolvers/getBuildInfo.ts"; then
  echo "✅ FT_PROOF_MARKER found in getBuildInfo resolver"
else
  echo "❌ FT_PROOF_MARKER NOT found in getBuildInfo resolver"
  exit 1
fi

# Check 2: FT_PROOF_MARKER emitted on success path (console.log)
echo "[2] Checking for console.log of FT_PROOF_MARKER..."
if grep -q "console.log.*FT_PROOF_MARKER" "$FORGE_APP_DIR/src/resolvers/getBuildInfo.ts"; then
  echo "✅ FT_PROOF_MARKER is logged via console.log"
else
  echo "❌ FT_PROOF_MARKER is not logged via console.log"
  exit 1
fi

# Check 3: FT_PROOF_MARKER includes required fields (ok=true on success path)
echo "[3] Checking for success marker with ok=true..."
if grep -q "FT_PROOF_MARKER.*ok=true" "$FORGE_APP_DIR/src/resolvers/getBuildInfo.ts"; then
  echo "✅ Success marker includes ok=true"
else
  echo "❌ Success marker missing ok=true"
  exit 1
fi

# Check 4: FT_PROOF_MARKER_ERROR exists on error path
echo "[4] Checking for error marker..."
if grep -q "FT_PROOF_MARKER_ERROR" "$FORGE_APP_DIR/src/resolvers/getBuildInfo.ts"; then
  echo "✅ Error marker FT_PROOF_MARKER_ERROR found"
else
  echo "❌ Error marker FT_PROOF_MARKER_ERROR NOT found"
  exit 1
fi

# Check 5: Proof-loop Step 8 searches for FT_PROOF_MARKER
echo "[5] Checking proof-loop Step 8 grep pattern..."
if grep -q "FT_PROOF_MARKER" "$REPO_ROOT/tools/prod_buildinfo_proof_loop.sh"; then
  echo "✅ Proof-loop Step 8 searches for FT_PROOF_MARKER"
else
  echo "❌ Proof-loop does not search for FT_PROOF_MARKER"
  exit 1
fi

# Check 6: Verify no contradictory marker strings
echo "[6] Checking for grep anchoring (to avoid partial matches)..."
if grep -q 'grep -F "FT_PROOF_MARKER "' "$REPO_ROOT/tools/prod_buildinfo_proof_loop.sh"; then
  echo "✅ Proof-loop uses -F (fixed string) and anchors marker with space"
else
  echo "⚠️  Proof-loop grep may not be anchored (check manually)"
fi

echo ""
echo "=== All Proof Marker Checks Passed ✅ ==="
echo ""
echo "Next: Run proof-loop in production to verify markers are emitted:"
echo "  export JIRA_SITE=firsttry.atlassian.net"
echo "  export FORGE_EMAIL=..."
echo "  export FORGE_API_TOKEN=..."
echo "  bash tools/prod_buildinfo_proof_loop.sh"
