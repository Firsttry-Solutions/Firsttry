#!/usr/bin/env bash
# extract_trust_doc_claims.sh
# Parse trust docs and extract explicit claims (offline)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Evidence directory
E="${1:-/tmp/ft_marketplace_gap_closure_latest}"
if [[ ! -d "$E" ]]; then
  E="/tmp/ft_marketplace_gap_closure_latest"
fi
E=$(readlink -f "$E" 2>/dev/null || echo "$E")

OUTPUT="$E/02_claims/trust_doc_claims.json"

echo "[TRUST DOC CLAIMS] Extracting claims from documentation..."

cd "$REPO_ROOT"

# Helper function to extract claim
extract_claim() {
  local file="$1"
  local pattern="$2"
  local default="${3:-null}"
  
  if [[ ! -f "$file" ]]; then
    echo "$default"
    return
  fi
  
  local result=$(grep -iP "$pattern" "$file" | head -1 || echo "")
  if [[ -n "$result" ]]; then
    echo "\"$result\""
  else
    echo "$default"
  fi
}

# Extract claims from each doc
NO_EGRESS_CLAIM=$(extract_claim "docs/trust/security.md" "(no external|zero external|no network|zero network)" "null")
NO_EGRESS_CLAIM2=$(extract_claim "docs/trust/access-scope-and-permissions.md" "(no external|zero external)" "null")

# Check for retention policy (numeric OR policy-based)
RETENTION_PERIOD=$(extract_claim "docs/trust/data-retention-deletion.md" "retention.*(\d+\s*(day|month|year))" "null")
if [[ "$RETENTION_PERIOD" == "null" ]]; then
  # Check for policy-based retention (until_uninstall, customer_request, etc.)
  RETENTION_PERIOD=$(extract_claim "docs/trust/data-retention-deletion.md" "retention\s*policy|retention\s*period" "null")
fi

# Check for deletion timeline (numeric OR policy-based)
DELETION_TIMELINE=$(extract_claim "docs/trust/data-retention-deletion.md" "(delete|removal).*(\d+\s*(hour|day))" "null")
if [[ "$DELETION_TIMELINE" == "null" ]]; then
  # Check for deletion mentions (SLA, request, process, etc.)
  DELETION_TIMELINE=$(extract_claim "docs/trust/data-retention-deletion.md" "deletion\s*(SLA|request|process|typically|upon)" "null")
fi

SUPPORT_EMAIL=$(extract_claim "docs/trust/support-sla.md" "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}" "null")
SECURITY_EMAIL=$(extract_claim "docs/trust/security.md" "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}" "null")
DISCLOSURE_EMAIL=$(extract_claim "docs/trust/vulnerability-disclosure.md" "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}" "null")

DISCLOSURE_TIMELINE=$(extract_claim "docs/trust/vulnerability-disclosure.md" "(\d+\s*day)" "null")

RESPONSE_TIMES=$(extract_claim "docs/trust/support-sla.md" "response.*(\d+\s*(hour|day))" "null")

ENCRYPTION_CLAIM=$(extract_claim "docs/trust/security.md" "(encryption|encrypted|TLS|AES)" "null")

# Check for "handled by Forge" or "handled by Atlassian" disclaimer
# Check for "handled by Forge" or "handled by Atlassian" disclaimer
if [[ -f "docs/trust/security.md" ]] && grep -iq "forge.*platform\|atlassian" "docs/trust/security.md"; then
  ENCRYPTION_DISCLAIMER="true"
else
  ENCRYPTION_DISCLAIMER="false"
fi

# Check for read-only claims
READ_ONLY_CLAIM=$(extract_claim "docs/trust/access-scope-and-permissions.md" "read.only" "null")

# Generate JSON
jq -n \
  --argjson no_egress "$NO_EGRESS_CLAIM" \
  --argjson no_egress2 "$NO_EGRESS_CLAIM2" \
  --argjson retention "$RETENTION_PERIOD" \
  --argjson deletion "$DELETION_TIMELINE" \
  --argjson support_email "$SUPPORT_EMAIL" \
  --argjson security_email "$SECURITY_EMAIL" \
  --argjson disclosure_email "$DISCLOSURE_EMAIL" \
  --argjson disclosure_timeline "$DISCLOSURE_TIMELINE" \
  --argjson response_times "$RESPONSE_TIMES" \
  --argjson encryption "$ENCRYPTION_CLAIM" \
  --argjson encryption_disclaimer "$ENCRYPTION_DISCLAIMER" \
  --argjson read_only "$READ_ONLY_CLAIM" \
  '{
    no_egress_security_md: $no_egress,
    no_egress_permissions_md: $no_egress2,
    retention_period: $retention,
    deletion_timeline: $deletion,
    support_email: $support_email,
    security_email: $security_email,
    disclosure_email: $disclosure_email,
    disclosure_timeline: $disclosure_timeline,
    support_response_times: $response_times,
    encryption_claim: $encryption,
    encryption_properly_scoped: $encryption_disclaimer,
    read_only_claim: $read_only
  }' > "$OUTPUT"

echo "  Output: $OUTPUT"
