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
#   EVIDENCE-MARKER=<ID> (e.g., FT-ALW-abc123)
#   JUSTIFICATION=<reason>
#   REVIEWED-BY=Arnab-Poddar (ONLY this value accepted)
#
# Marker validation:
#   - Extracts EVIDENCE file path (e.g., src/storage.ts from "storage.ts:27")
#   - Searches for "// AUDIT-ALLOWLIST <marker>" in that file
#   - Fails if marker not found
#
# Exit codes:
#   0 = All entries valid
#   1 = Invalid entries found (prints line number + content)

set -euo pipefail

ALLOWLIST_FILE="tools/audit/v3_1/allowlists/phase05_storage_constants.txt"
CURRENT_BATCH_FLOOR=9  # Minimum acceptable EXPIRY batch
ALLOWED_REVIEWER="Arnab-Poddar"  # Only accepted REVIEWED-BY value

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
  
  # Check for required fields (including new EVIDENCE-MARKER)
  required_fields=("OWNER=" "EXPIRY=" "EVIDENCE=" "EVIDENCE-MARKER=" "JUSTIFICATION=" "REVIEWED-BY=")
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
    
    # Fail if REVIEWED-BY is not exactly the allowed reviewer
    if [[ "$reviewed_by" != "$ALLOWED_REVIEWER" ]]; then
      echo "ERROR: Line $line_num has invalid REVIEWED-BY='$reviewed_by' (must be exactly '$ALLOWED_REVIEWER'):" >&2
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
  
  # Extract and validate EVIDENCE file existence
  if echo "$line" | grep -qF "EVIDENCE="; then
    evidence=$(echo "$line" | sed -n 's/.*EVIDENCE=\([^ ]*\).*/\1/p')
    
    # Extract file path (before optional :line)
    evidence_file=$(echo "$evidence" | cut -d: -f1)
    
    # Check if file exists under src/
    if [[ ! -f "src/$evidence_file" ]]; then
      echo "ERROR: Line $line_num EVIDENCE file not found: src/$evidence_file" >&2
      echo "  $line" >&2
      failed=1
    fi
  fi
  
  # Extract and validate EVIDENCE-MARKER
  if echo "$line" | grep -qF "EVIDENCE-MARKER="; then
    marker=$(echo "$line" | sed -n 's/.*EVIDENCE-MARKER=\([^ ]*\).*/\1/p')
    
    # Skip validation if marker is UNASSIGNED (work-in-progress)
    if [[ "$marker" == "UNASSIGNED" ]]; then
      echo "ERROR: Line $line_num has EVIDENCE-MARKER=UNASSIGNED (must assign unique marker ID):" >&2
      echo "  $line" >&2
      failed=1
      continue
    fi
    
    # Validate marker is in source file
    if echo "$line" | grep -qF "EVIDENCE="; then
      evidence=$(echo "$line" | sed -n 's/.*EVIDENCE=\([^ ]*\).*/\1/p')
      evidence_file=$(echo "$evidence" | cut -d: -f1)
      
      if [[ -f "src/$evidence_file" ]]; then
        # Search for marker in source file (case-sensitive, word boundary)
        # Pattern: // AUDIT-ALLOWLIST <marker>
        if ! grep -q "AUDIT-ALLOWLIST[[:space:]]\+${marker}" "src/$evidence_file" 2>/dev/null; then
          echo "ERROR: Line $line_num EVIDENCE-MARKER='$marker' not found in src/$evidence_file" >&2
          echo "  Expected comment: // AUDIT-ALLOWLIST $marker" >&2
          echo "  $line" >&2
          failed=1
        fi
      fi
    fi
  fi
  
done < "$ALLOWLIST_FILE"

if [[ "$failed" -eq 1 ]]; then
  echo "" >&2
  echo "Phase05 allowlist validation FAILED" >&2
  echo "All allowlist entries must:" >&2
  echo "  - Have REVIEWED-BY=$ALLOWED_REVIEWER (only accepted reviewer)" >&2
  echo "  - Have EVIDENCE-MARKER=<ID> (not UNASSIGNED)" >&2
  echo "  - Have marker comment in source code: // AUDIT-ALLOWLIST <ID>" >&2
  echo "  - Have valid EXPIRY >= BATCH$CURRENT_BATCH_FLOOR" >&2
  exit 1
fi

echo "Phase05 allowlist metadata OK (all entries validated, markers verified in source)"
exit 0
