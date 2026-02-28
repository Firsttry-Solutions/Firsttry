#!/usr/bin/env bash
#
# validate_phase05_allowlist.sh
#
# Fail-closed validator for Phase 05 allowlist metadata.
# Ensures all allowlist entries have required fields and valid review status.
#
# Required metadata fields:
#   OWNER=<team>
#   EXPIRY=BATCH<N> where N >= 9
#   EVIDENCE=<file:line>
#   JUSTIFICATION=<reason>
#   REVIEWED-BY=<human-name> (NOT: UNREVIEWED, TBD, or containing "Automation")
#
# Exit codes:
#   0 = All entries valid
#   1 = Invalid entries found (prints line number + content)

set -euo pipefail

ALLOWLIST_FILE="tools/audit/v3_1/allowlists/phase05_storage_constants.txt"
CURRENT_BATCH_FLOOR=9  # Minimum acceptable EXPIRY batch

if [[ ! -f "$ALLOWLIST_FILE" ]]; then
  echo "ERROR: Allowlist file not found: $ALLOWLIST_FILE" >&2
  exit 1
fi

failed=0
line_num=0

while IFS= read -r line; do
  line_num=$((line_num + 1))
  
  # Skip blank lines
  [[ -z "$line" ]] && continue
  
  # Skip comment lines (starting with #)
  [[ "$line" =~ ^[[:space:]]*# ]] && continue
  
  # This is a pattern line - validate metadata
  
  # Check for required fields
  required_fields=("OWNER=" "EXPIRY=" "EVIDENCE=" "JUSTIFICATION=" "REVIEWED-BY=")
  for field in "${required_fields[@]}"; do
    if ! echo "$line" | grep -qF "$field"; then
      echo "ERROR: Line $line_num missing required field '$field':" >&2
      echo "  $line" >&2
      failed=1
    fi
  done
  
  # Extract REVIEWED-BY value
  if echo "$line" | grep -qF "REVIEWED-BY="; then
    reviewed_by=$(echo "$line" | sed -n 's/.*REVIEWED-BY=\([^ ]*\).*/\1/p')
    
    # Fail if REVIEWED-BY is UNREVIEWED, TBD, or contains "Automation"
    if [[ "$reviewed_by" == "UNREVIEWED" ]] || [[ "$reviewed_by" == "TBD" ]] || [[ "$reviewed_by" =~ Automation ]]; then
      echo "ERROR: Line $line_num has invalid REVIEWED-BY='$reviewed_by' (must be human reviewer, not UNREVIEWED/TBD/Automation):" >&2
      echo "  $line" >&2
      failed=1
    fi
  fi
  
  # Extract and validate EXPIRY
  if echo "$line" | grep -qF "EXPIRY="; then
    expiry=$(echo "$line" | sed -n 's/.*EXPIRY=\([^ ]*\).*/\1/p')
    
    # Check format: EXPIRY=BATCH<N>
    if ! echo "$expiry" | grep -qE '^BATCH[0-9]+$'; then
      echo "ERROR: Line $line_num has invalid EXPIRY format '$expiry' (must be BATCH<integer>):" >&2
      echo "  $line" >&2
      failed=1
    else
      # Extract batch number
      batch_num=$(echo "$expiry" | sed 's/BATCH//')
      
      # Check if batch number >= floor
      if [[ "$batch_num" -lt "$CURRENT_BATCH_FLOOR" ]]; then
        echo "ERROR: Line $line_num has expired EXPIRY='$expiry' (must be >= BATCH$CURRENT_BATCH_FLOOR):" >&2
        echo "  $line" >&2
        failed=1
      fi
    fi
  fi
  
done < "$ALLOWLIST_FILE"

if [[ "$failed" -eq 1 ]]; then
  echo "" >&2
  echo "Phase05 allowlist validation FAILED" >&2
  echo "All allowlist entries must have human review (not UNREVIEWED/TBD/Automation)" >&2
  echo "and must not be expired (EXPIRY >= BATCH$CURRENT_BATCH_FLOOR)" >&2
  exit 1
fi

echo "Phase05 allowlist metadata OK (all entries validated)"
exit 0
