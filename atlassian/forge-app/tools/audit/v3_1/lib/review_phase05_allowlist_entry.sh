#!/usr/bin/env bash
#
# review_phase05_allowlist_entry.sh
#
# Helper script for human reviewers to inspect allowlist entries before approval.
# This script DOES NOT auto-edit files. It provides guidance only.
#
# Usage:
#   bash review_phase05_allowlist_entry.sh <allowlist_file> <line_number> <marker_id>
#
# Example:
#   bash review_phase05_allowlist_entry.sh \
#     tools/audit/v3_1/allowlists/phase05_storage_constants.txt \
#     13 \
#     FT-ALW-001
#
# What it does:
#   1. Displays the allowlist entry at specified line
#   2. Extracts EVIDENCE file path
#   3. Shows code snippet around the flagged storage operation
#   4. Provides instructions for manual review and approval
#
# What it DOES NOT do:
#   - Auto-edit allowlist file
#   - Auto-insert markers in source code
#   - Bypass validator requirements

set -euo pipefail

if [[ $# -ne 3 ]]; then
  echo "Usage: $0 <allowlist_file> <line_number> <marker_id>" >&2
  echo "" >&2
  echo "Example:" >&2
  echo "  $0 tools/audit/v3_1/allowlists/phase05_storage_constants.txt 13 FT-ALW-001" >&2
  exit 1
fi

ALLOWLIST_FILE="$1"
LINE_NUM="$2"
MARKER_ID="$3"

if [[ ! -f "$ALLOWLIST_FILE" ]]; then
  echo "ERROR: Allowlist file not found: $ALLOWLIST_FILE" >&2
  exit 1
fi

# Extract the allowlist line
echo "=========================================="
echo "ALLOWLIST ENTRY (line $LINE_NUM):"
echo "=========================================="
ALLOWLIST_LINE=$(sed -n "${LINE_NUM}p" "$ALLOWLIST_FILE")
if [[ -z "$ALLOWLIST_LINE" ]]; then
  echo "ERROR: Line $LINE_NUM is empty or out of range" >&2
  exit 1
fi
echo "$ALLOWLIST_LINE"
echo ""

# Extract EVIDENCE file path
if ! echo "$ALLOWLIST_LINE" | grep -qF "EVIDENCE="; then
  echo "WARNING: No EVIDENCE= field found on this line" >&2
  exit 0
fi

EVIDENCE=$(echo "$ALLOWLIST_LINE" | sed -n 's/.*EVIDENCE=\([^ ]*\).*/\1/p')
EVIDENCE_FILE=$(echo "$EVIDENCE" | cut -d: -f1)
EVIDENCE_LINE=$(echo "$EVIDENCE" | cut -d: -f2 -s)

if [[ ! -f "src/$EVIDENCE_FILE" ]]; then
  echo "ERROR: EVIDENCE file not found: src/$EVIDENCE_FILE" >&2
  exit 1
fi

echo "=========================================="
echo "EVIDENCE FILE: src/$EVIDENCE_FILE"
if [[ -n "$EVIDENCE_LINE" ]]; then
  echo "EVIDENCE LINE: $EVIDENCE_LINE"
fi
echo "=========================================="
echo ""

# Show code snippet around the evidence location
if [[ -n "$EVIDENCE_LINE" ]]; then
  # Show +/- 5 lines around the evidence line
  START_LINE=$((EVIDENCE_LINE - 5))
  END_LINE=$((EVIDENCE_LINE + 5))
  [[ $START_LINE -lt 1 ]] && START_LINE=1
  
  echo "Code snippet (lines $START_LINE-$END_LINE):"
  echo "---"
  sed -n "${START_LINE},${END_LINE}p" "src/$EVIDENCE_FILE" | cat -n
  echo "---"
else
  # No line number specified, show first 20 lines
  echo "Code snippet (first 20 lines):"
  echo "---"
  head -20 "src/$EVIDENCE_FILE" | cat -n
  echo "---"
fi
echo ""

echo "=========================================="
echo "REVIEW INSTRUCTIONS:"
echo "=========================================="
echo ""
echo "1. VERIFY KEY CONSTRUCTION:"
echo "   - Inspect the code at src/$EVIDENCE_FILE"
if [[ -n "$EVIDENCE_LINE" ]]; then
  echo "   - Focus on line $EVIDENCE_LINE and surrounding context"
fi
echo "   - Confirm the storage key uses makeStorageKey() or makeGlobalStorageKey()"
echo "   - Verify tenant binding (first argument should be tenant/org/site ID)"
echo ""
echo "2. ADD MARKER TO SOURCE CODE:"
echo "   - Add this comment ABOVE the flagged line:"
echo "     // AUDIT-ALLOWLIST $MARKER_ID"
echo "   - Example:"
echo "       // AUDIT-ALLOWLIST $MARKER_ID"
echo "       const reviewKey = buildReviewKey(siteId, reviewId);"
echo "       await storage.get(reviewKey);"
echo ""
echo "3. UPDATE ALLOWLIST ENTRY:"
echo "   - Edit line $LINE_NUM in $ALLOWLIST_FILE"
echo "   - Add/update these fields:"
echo "     EVIDENCE-MARKER=$MARKER_ID"
echo "     REVIEWED-BY=Arnab-Poddar"
echo "   - Example format:"
echo "     <PATTERN>  # OWNER=<team> EXPIRY=BATCH9 EVIDENCE=<file:line> EVIDENCE-MARKER=$MARKER_ID JUSTIFICATION=<reason> REVIEWED-BY=Arnab-Poddar"
echo ""
echo "4. COMMIT CHANGES:"
echo "   - git add src/$EVIDENCE_FILE $ALLOWLIST_FILE"
echo "   - git commit -m \"audit: review allowlist entry line $LINE_NUM (marker $MARKER_ID)\""
echo ""
echo "=========================================="
echo "NOTES:"
echo "=========================================="
echo "- This script does NOT auto-edit files (manual review required)"
echo "- Validator will fail if marker not found in source code"
echo "- Only REVIEWED-BY=Arnab-Poddar is accepted by validator"
echo ""
