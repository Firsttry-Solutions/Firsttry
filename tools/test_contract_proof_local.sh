#!/bin/bash
#
# test_contract_proof_local.sh
#
# Local test harness for contract-proof resolver.
# Compiles and runs the resolver in-process to verify envelope structure.
# This proves the code path locally; actual production uses webtrigger.
#
# Usage:
#   bash /workspaces/Firsttry/tools/test_contract_proof_local.sh
#
# Output:
#   JSON to stdout (saved to /tmp/ft_contract_proof_local_test.json)
#

set -euo pipefail

echo "════════════════════════════════════════════════════════════════" >&2
echo "LOCAL CONTRACT PROOF TEST (In-Process Resolver)" >&2
echo "════════════════════════════════════════════════════════════════" >&2
echo "" >&2

cd /workspaces/Firsttry/atlassian/forge-app

# Create a minimal test file that imports and calls the resolver
TEST_FILE="/tmp/test_contract_proof.mjs"

cat > "$TEST_FILE" << 'TESTEOF'
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { register } from 'esbuild-register';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Register TypeScript support
register();

// Change to the forge-app directory
process.chdir('/workspaces/Firsttry/atlassian/forge-app');

// Import the resolver (will be transpiled by esbuild-register)
import { ft_contractProof_dashEnvelope_v1 } from './dist/src/gadget-resolver.js';

// Call the resolver with minimal request
const request = {
  payload: {},
  context: {}
};

try {
  const result = await ft_contractProof_dashEnvelope_v1(request);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error('ERROR:', error.message);
  process.exit(1);
}
TESTEOF

# Actually, let's use a simpler approach: use the compiled JS directly
# First, verify the build has the TypeScript compiled to dist

if [[ ! -d "dist/src" ]]; then
  echo "[TEST] ERROR: No dist/src directory. Build may not be compiled correctly." >&2
  exit 1
fi

echo "[TEST] Using compiled resolver from dist/src/gadget-resolver.js" >&2

# Create a Node.js script that directly requires the compiled module
cat > /tmp/test_contract_proof_exec.cjs << 'EXECEOF'
#!/usr/bin/env node
const path = require('path');

// Change to forge-app directory for module resolution
process.chdir('/workspaces/Firsttry/atlassian/forge-app');

// Import compiled resolver
const { ft_contractProof_dashEnvelope_v1 } = require('./dist/src/gadget-resolver.js');

const request = {
  payload: {},
  context: {}
};

(async () => {
  try {
    const result = await ft_contractProof_dashEnvelope_v1(request);
    process.stdout.write(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('TEST_ERROR:', error.message);
    process.exit(1);
  }
})();
EXECEOF

chmod +x /tmp/test_contract_proof_exec.cjs

echo "[TEST] Executing local contract proof resolver..." >&2

# Run the test and capture output
OUTPUT_FILE="/tmp/ft_contract_proof_local_test.json"

if node /tmp/test_contract_proof_exec.cjs > "$OUTPUT_FILE" 2>&1; then
  echo "[TEST] ✓ Resolver executed successfully" >&2
  echo "[TEST] Output saved to: $OUTPUT_FILE" >&2
  echo "" >&2
  cat "$OUTPUT_FILE"
else
  echo "[TEST] ERROR: Resolver execution failed" >&2
  cat "$OUTPUT_FILE" >&2
  exit 1
fi
