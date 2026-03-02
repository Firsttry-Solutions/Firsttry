#!/usr/bin/env bash
# verify_retention_policy.sh
# Verify RETENTION_POLICY.json is valid (fail-closed)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Evidence directory
E="${1:-/tmp/ft_marketplace_phase3_5_latest}"
if [[ ! -d "$E" ]]; then
  E="/tmp/ft_marketplace_phase3_5_latest"
fi
E=$(readlink -f "$E" 2>/dev/null || echo "$E")

POLICY_FILE="$REPO_ROOT/docs/trust/RETENTION_POLICY.json"
OUTPUT="$E/03_generated/retention_policy.json"
VERDICT="$E/03_generated/retention_verdict.txt"

echo "[RETENTION] Verifying retention policy..."

if [[ ! -f "$POLICY_FILE" ]]; then
  echo "FAIL" > "$VERDICT"
  echo "❌ FAIL: RETENTION_POLICY.json not found"
  echo ""
  echo "Remediation: Create docs/trust/RETENTION_POLICY.json"
  exit 1
fi

# Read policy
DEFAULT_RETENTION=$(jq -r '.default_retention // ""' "$POLICY_FILE")
DELETION_SLA=$(jq -r '.deletion_sla_days // "null"' "$POLICY_FILE")
NOTES=$(jq -r '.notes // ""' "$POLICY_FILE")

FAILURES=()

# Validate default_retention
ALLOWED_RETENTION=("until_uninstall_or_customer_request" "fixed_days")
if [[ ! " ${ALLOWED_RETENTION[@]} " =~ " ${DEFAULT_RETENTION} " ]]; then
  FAILURES+=("default_retention must be one of: ${ALLOWED_RETENTION[*]}")
fi

# If fixed_days, require retention_days
if [[ "$DEFAULT_RETENTION" == "fixed_days" ]]; then
  RETENTION_DAYS=$(jq -r '.retention_days // "null"' "$POLICY_FILE")
  if [[ "$RETENTION_DAYS" == "null" ]]; then
    FAILURES+=("default_retention=fixed_days requires retention_days field")
  elif ! [[ "$RETENTION_DAYS" =~ ^[0-9]+$ ]] || [[ "$RETENTION_DAYS" -lt 1 ]] || [[ "$RETENTION_DAYS" -gt 3650 ]]; then
    FAILURES+=("retention_days must be integer 1-3650")
  fi
fi

# Validate deletion_sla_days (optional)
if [[ "$DELETION_SLA" != "null" ]]; then
  if ! [[ "$DELETION_SLA" =~ ^[0-9]+$ ]] || [[ "$DELETION_SLA" -lt 1 ]] || [[ "$DELETION_SLA" -gt 365 ]]; then
    FAILURES+=("deletion_sla_days must be null OR integer 1-365")
  fi
fi

# Validate notes
if [[ "$NOTES" =~ (TODO|TBD|FIXME) ]]; then
  FAILURES+=("notes contains placeholder: $(echo "$NOTES" | grep -oE 'TODO|TBD|FIXME')")
fi

# Copy to evidence
cp "$POLICY_FILE" "$OUTPUT"

if [[ ${#FAILURES[@]} -gt 0 ]]; then
  echo "FAIL" > "$VERDICT"
  echo "❌ FAIL: Retention policy validation errors"
  echo ""
  for failure in "${FAILURES[@]}"; do
    echo "  - $failure"
  done
  exit 1
fi

echo "PASS" > "$VERDICT"
echo "✅ PASS: Retention policy valid"
echo "  - Policy: $DEFAULT_RETENTION"
if [[ "$DELETION_SLA" != "null" ]]; then
  echo "  - Deletion SLA: $DELETION_SLA days"
else
  echo "  - Deletion SLA: On request (no fixed SLA)"
fi
exit 0
