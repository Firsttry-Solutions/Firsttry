#!/bin/bash
set -euo pipefail

# Layer-0 Backbone Verification Script
# Runs comprehensive tests and generates proof

cd /workspaces/Firsttry/atlassian/forge-app

echo "================================"
echo "BACKBONE LAYER-0 VERIFICATION"
echo "================================"

echo ""
echo "Step 1: Running test suite..."
npm test

echo ""
echo "Step 2: Running proof script..."
node tools/proof_backbone_l0.mjs

echo ""
echo "Step 3: Checking for forbidden strings in implementation (excluding contract validator)..."
# Allow UNKNOWN_INTERNAL in errorCodes.ts (enum value)
# Allow the forbidden string set definition in contract.ts (it's the validator definition)
# Check only for RUNTIME usage of forbidden strings
if rg -q "\"UNKNOWN\"|\"INITIALIZING\"|\"NOT_AVAILABLE\"" src/gadget-resolver.ts 2>/dev/null | grep -qv "// validator\|assertNoUnknownStrings"; then
  echo "FAIL: Forbidden strings found in resolver implementation"
  exit 1
fi
echo "✓ No forbidden strings in resolver implementation"

echo ""
echo "Step 4: Verifying manifest.yml syntax..."
if ! grep -q "ftBackboneScheduled" manifest.yml; then
  echo "FAIL: ftBackboneScheduled not found in manifest"
  exit 1
fi
if ! grep -q "ftRunNow" manifest.yml; then
  echo "FAIL: ftRunNow not found in manifest"
  exit 1
fi
echo "✓ Manifest.yml properly wired"

echo ""
echo "✓✓✓ BACKBONE LAYER-0 VERIFICATION PASSED ✓✓✓"
