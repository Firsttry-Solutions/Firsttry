#!/bin/bash
#
# invoke_contract_proof_prod.sh
#
# Non-interactive CLI script to invoke production contract-proof resolver.
# Returns raw JSON to stdout, exits 0 on success, 1 on failure.
#
# Usage:
#   bash /workspaces/Firsttry/tools/invoke_contract_proof_prod.sh
#
# Output:
#   Raw JSON (DashEnvelopeV1 format) from production backend
#

set -euo pipefail

echo "[INVOKE_CONTRACT_PROOF] Invoking ft_contractProof_dashEnvelope_v1..." >&2

cd /workspaces/Firsttry/atlassian/forge-app

# The gadget-handlers dispatcher accepts a payload with resolverName field
# We invoke it via the gadget-handlers.handler which routes to ft_contractProof_dashEnvelope_v1
PAYLOAD='{
  "resolverName": "ft_contractProof_dashEnvelope_v1",
  "payload": {}
}'

# For now, we'll simulate the output since we don't have Forge CLI invoke
# In a real scenario, this would be:
# forge invoke --environment production --function contract-proof-fn --payload "$PAYLOAD"

# But since we can't use forge invoke on gadget UI functions, we'll create
# a temporary CLI entry point that calls the handler directly
# This is done via the webtrigger approach in the next script
echo "[INVOKE_CONTRACT_PROOF] Webtrigger method needed (see invoke_contract_proof_via_webtrigger.sh)" >&2
exit 1
