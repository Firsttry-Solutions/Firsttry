#!/bin/bash
# Phase 06: Uninstall and Data Deletion Check
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$SCRIPT_DIR/lib/00_common.sh"
PHASE_ID="PHASE_06_deletion"

PHASE_DIR="$EVIDENCE_DIR/PHASE_06_deletion"
mkdir -p "$PHASE_DIR"

info "Phase 06: Uninstall and Data Deletion"

DELETION_DOC="$REPO_ROOT/docs/marketplace/MARKETPLACE_DATA_RETENTION_DELETION.md"
require_file "$DELETION_DOC" 1200

echo "# Uninstall and Deletion Policy Check" > "$PHASE_DIR/deletion_doc_checks.txt"

# Check required sections
REQUIRED_SECTIONS=(
  "Retention periods"
  "Customer deletion requests"
  "Uninstall behavior"
  "Deletion workflow"
)

for section in "${REQUIRED_SECTIONS[@]}"; do
  if ! grep -qiE "##.*$section" "$DELETION_DOC"; then
    die "Data retention/deletion doc missing required section: $section"
  fi
done
ok "Required sections found in deletion doc"

# Check for explicit numeric timeframe (e.g., "7 days", "30 days", "90 days")
if ! grep -qE "[0-9]+ days?" "$DELETION_DOC"; then
  die "Data retention/deletion doc missing required content: timeframe (must include explicit numeric retention period like '7 days')"
fi
ok "Explicit retention timeframe found"

# Check for customer request procedure
if ! grep -qiE "(customer.*request|request.*deletion|how to.*delete|support@firsttry)" "$DELETION_DOC"; then
  die "Deletion doc must describe how customers request data deletion (email address required)"
fi
ok "Customer deletion request procedure documented"

# Check storage vs deletion consistency
CODE_FACTS="$EVIDENCE_DIR/PHASE_05_data_flow/code_facts.json"
if [ -f "$CODE_FACTS" ]; then
  USES_STORAGE=$(jq -r '.uses_forge_storage' "$CODE_FACTS" 2>/dev/null || echo "false")
  if [ "$USES_STORAGE" = "true" ]; then
    # Storage is used - must have deletion procedure
    if ! grep -qiE "(delete.*storage|remove.*data|purge|uninstall.*delete)" "$DELETION_DOC"; then
      die "Storage is used but deletion doc doesn't describe deletion procedure"
    fi
    ok "Storage deletion procedure documented"
  fi
fi

write_section "$REPORT_PATH" "Phase 06: Uninstall and Data Deletion - PASS"
echo "- Deletion document: validated ($(stat -c%s "$DELETION_DOC" 2>/dev/null || stat -f%z "$DELETION_DOC") bytes)" >> "$REPORT_PATH"
echo "- Required sections: present" >> "$REPORT_PATH"
echo "- Customer procedures: documented" >> "$REPORT_PATH"
echo "- Evidence: \`$PHASE_DIR\`" >> "$REPORT_PATH"

ok "Phase 06: Uninstall and Data Deletion - PASS"
