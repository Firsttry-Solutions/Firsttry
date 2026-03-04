#!/bin/bash
# Phase 05: Storage and Data Flow Consistency Check
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$SCRIPT_DIR/lib/00_common.sh"
PHASE_ID="PHASE_05_data_flow"

PHASE_DIR="$EVIDENCE_DIR/PHASE_05_data_flow"
mkdir -p "$PHASE_DIR"

info "Phase 05: Storage and Data Flow Consistency"

# Run code facts scanner
CODE_FACTS="$PHASE_DIR/code_facts.json"
bash "$SCRIPT_DIR/lib/code_facts_scan.sh" "$CODE_FACTS" || die "Code facts scanner failed"
ok "Code facts scan complete"

DATA_FLOW_DOC="$REPO_ROOT/docs/marketplace/MARKETPLACE_DATA_FLOW.md"
require_file "$DATA_FLOW_DOC" 1500

# Extract truth from code scan
USES_STORAGE=$(jq -r '.uses_forge_storage' "$CODE_FACTS")
STORAGE_COUNT=$(jq '.storage_calls | length' "$CODE_FACTS")

# Check consistency
echo "# Data Flow Consistency Check" > "$PHASE_DIR/data_flow_consistency.txt"
echo "" >> "$PHASE_DIR/data_flow_consistency.txt"
echo "Storage API usage detected: $STORAGE_COUNT instances" >> "$PHASE_DIR/data_flow_consistency.txt"
echo "Uses Forge Storage: $USES_STORAGE" >> "$PHASE_DIR/data_flow_consistency.txt"

if [ "$USES_STORAGE" = "true" ]; then
  # Storage is used - doc must describe it
  if grep -qi "no data stored\|does not store" "$DATA_FLOW_DOC"; then
    die "Storage APIs detected in code but data flow doc claims no storage"
  fi
  ok "Storage usage detected and documented"
  echo "Status: Storage usage is documented" >> "$PHASE_DIR/data_flow_consistency.txt"
else
  # No storage - doc should reflect this
  ok "No storage usage detected"
  echo "Status: No storage usage (in-memory processing)" >> "$PHASE_DIR/data_flow_consistency.txt"
fi

# Check for data transmission claims vs zero egress
if grep -qi "transmitted\|sent.*external\|third.*party" "$DATA_FLOW_DOC"; then
  # Check if phase 04 found external URLs
  if [ -f "$EVIDENCE_DIR/PHASE_04_security/external_urls.txt" ]; then
    URLS=$(wc -l < "$EVIDENCE_DIR/PHASE_04_security/external_urls.txt" | tr -d ' ')
    if [ "$URLS" -eq 0 ]; then
      warn "Data flow doc mentions transmission but zero egress policy enforced - verify consistency"
    fi
  fi
fi

# Verify required sections
REQUIRED_SECTIONS=(
  "Data categories accessed"
  "Data stored"
  "Data retention"
  "Data deletion"
  "Access controls"
)

for section in "${REQUIRED_SECTIONS[@]}"; do
  if ! grep -qiE "##.*$section" "$DATA_FLOW_DOC"; then
    die "Data flow doc missing required section: $section"
  fi
done
ok "All required sections present in data flow doc"

write_section "$REPORT_PATH" "Phase 05: Storage and Data Flow - PASS"
echo "- Storage usage: $STORAGE_COUNT instances detected" >> "$REPORT_PATH"
echo "- Data flow document: validated ($(stat -c%s "$DATA_FLOW_DOC" 2>/dev/null || stat -f%z "$DATA_FLOW_DOC") bytes)" >> "$REPORT_PATH"
echo "- Consistency: verified" >> "$REPORT_PATH"
echo "- Evidence: \`$PHASE_DIR\`" >> "$REPORT_PATH"

ok "Phase 05: Storage and Data Flow - PASS"
