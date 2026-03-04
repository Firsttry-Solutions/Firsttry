#!/bin/bash
# Phase 12: Documentation and Listing Artifacts Check
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$SCRIPT_DIR/lib/00_common.sh"
PHASE_ID="PHASE_12_docs"

PHASE_DIR="$EVIDENCE_DIR/PHASE_12_docs"
mkdir -p "$PHASE_DIR"

info "Phase 12: Documentation and Listing Artifacts"

DOCS_DIR="$REPO_ROOT/docs/marketplace"

# Required documents with minimum sizes and sections
require_file "$DOCS_DIR/MARKETPLACE_PRIVACY_POLICY.md" 1500
require_file "$DOCS_DIR/MARKETPLACE_TERMS_OF_SERVICE.md" 1200
require_file "$DOCS_DIR/MARKETPLACE_SUPPORT_SLA.md" 1200
require_file "$DOCS_DIR/MARKETPLACE_SUBPROCESSORS.md" 800
require_file "$DOCS_DIR/MARKETPLACE_INCIDENT_RESPONSE.md" 1200
require_file "$DOCS_DIR/MARKETPLACE_SECURITY_CONTACT.md" 400
require_file "$DOCS_DIR/MARKETPLACE_RESPONSIBLE_DISCLOSURE.md" 800
require_file "$DOCS_DIR/MARKETPLACE_REVIEWER_FAQ.md" 1200
require_file "$DOCS_DIR/MARKETPLACE_REQUIREMENTS_MATRIX.md" 1500

echo "# Documentation Checks" > "$PHASE_DIR/docs_checks.txt"

# Check Privacy Policy sections
PRIVACY_DOC="$DOCS_DIR/MARKETPLACE_PRIVACY_POLICY.md"
for section in "data collected" "data stored" "data shared" "retention" "security" "contact"; do
  if ! grep -qiE "$section" "$PRIVACY_DOC"; then
    die "Privacy Policy missing required section: $section"
  fi
done
ok "Privacy Policy has all required sections"
echo "✓ Privacy Policy: all sections present" >> "$PHASE_DIR/docs_checks.txt"

# Check Support SLA sections
SUPPORT_DOC="$DOCS_DIR/MARKETPLACE_SUPPORT_SLA.md"
if ! grep -qiE "(response.*time|hours|business.*day)" "$SUPPORT_DOC"; then
  die "Support SLA missing response time information"
fi
if ! grep -qiE "(email|contact|support)" "$SUPPORT_DOC"; then
  die "Support SLA missing contact channels"
fi
ok "Support SLA complete"
echo "✓ Support SLA: response times and channels documented" >> "$PHASE_DIR/docs_checks.txt"

# Check Requirements Matrix
MATRIX_DOC="$DOCS_DIR/MARKETPLACE_REQUIREMENTS_MATRIX.md"
if ! grep -qiE "(requirement|evidence|location)" "$MATRIX_DOC"; then
  die "Requirements Matrix missing requirement-to-evidence mapping"
fi
head -50 "$MATRIX_DOC" > "$PHASE_DIR/matrix_excerpt.txt"
ok "Requirements Matrix present"
echo "✓ Requirements Matrix: requirement mapping present" >> "$PHASE_DIR/docs_checks.txt"

# Check all other docs exist and are non-trivial
for doc in MARKETPLACE_TERMS_OF_SERVICE.md MARKETPLACE_SUBPROCESSORS.md \
           MARKETPLACE_INCIDENT_RESPONSE.md MARKETPLACE_SECURITY_CONTACT.md \
           MARKETPLACE_RESPONSIBLE_DISCLOSURE.md MARKETPLACE_REVIEWER_FAQ.md; do
  doc_path="$DOCS_DIR/$doc"
  size=$(stat -c%s "$doc_path" 2>/dev/null || stat -f%z "$doc_path" 2>/dev/null)
  echo "✓ $doc: $size bytes" >> "$PHASE_DIR/docs_checks.txt"
done

# Detect placeholders in required marketplace docs - FAIL if found (strict deterministic)
# Only scan docs that are required for marketplace submission (exclude internal docs like screenshots-checklist.md)
REQUIRED_DOCS=(
  "$DOCS_DIR/MARKETPLACE_PRIVACY_POLICY.md"
  "$DOCS_DIR/MARKETPLACE_TERMS_OF_SERVICE.md"
  "$DOCS_DIR/MARKETPLACE_SUPPORT_SLA.md"
  "$DOCS_DIR/MARKETPLACE_SUBPROCESSORS.md"
  "$DOCS_DIR/MARKETPLACE_INCIDENT_RESPONSE.md"
  "$DOCS_DIR/MARKETPLACE_SECURITY_CONTACT.md"
  "$DOCS_DIR/MARKETPLACE_RESPONSIBLE_DISCLOSURE.md"
  "$DOCS_DIR/MARKETPLACE_REVIEWER_FAQ.md"
  "$DOCS_DIR/MARKETPLACE_REQUIREMENTS_MATRIX.md"
  "$DOCS_DIR/MARKETPLACE_DATA_FLOW.md"
  "$DOCS_DIR/MARKETPLACE_DATA_RETENTION_DELETION.md"
)

PLACEHOLDER_EVIDENCE="$PHASE_DIR/placeholder_violations.txt"
echo "# Placeholder Detection - Required marketplace docs must be complete (no TODO/TBD/example.com/etc)" > "$PLACEHOLDER_EVIDENCE"
echo "" >> "$PLACEHOLDER_EVIDENCE"

# Pattern 1: Domain placeholders
echo "## Pattern 1: Domain placeholders (example.com, yourcompany.com, acme.com)" >> "$PLACEHOLDER_EVIDENCE"
for doc in "${REQUIRED_DOCS[@]}"; do
  [ -f "$doc" ] && grep -HnE -i "(example\.com|yourcompany\.com|acme\.com|yourdomain\.com|mydomain\.com)" "$doc" 2>/dev/null >> "$PLACEHOLDER_EVIDENCE" || true
done

# Pattern 2: TODO/TBD/FIXME markers
echo "" >> "$PLACEHOLDER_EVIDENCE"
echo "## Pattern 2: TODO/TBD/FIXME markers" >> "$PLACEHOLDER_EVIDENCE"
for doc in "${REQUIRED_DOCS[@]}"; do
  [ -f "$doc" ] && grep -HnE -i "(TODO|TBD|FIXME|XXX)" "$doc" 2>/dev/null >> "$PLACEHOLDER_EVIDENCE" || true
done

# Pattern 3: Placeholder/dummy/sample text
echo "" >> "$PLACEHOLDER_EVIDENCE"
echo "## Pattern 3: Placeholder/dummy/sample keywords" >> "$PLACEHOLDER_EVIDENCE"
for doc in "${REQUIRED_DOCS[@]}"; do
  [ -f "$doc" ] && grep -HnE -i "(placeholder|dummy|sample|lorem ipsum|changeme|replace.this|edit.this)" "$doc" 2>/dev/null >> "$PLACEHOLDER_EVIDENCE" || true
done

# Pattern 4: Template variables (YOUR_, REPLACE_, [EDIT], {{variable}})
echo "" >> "$PLACEHOLDER_EVIDENCE"
echo "## Pattern 4: Template variables" >> "$PLACEHOLDER_EVIDENCE"
for doc in "${REQUIRED_DOCS[@]}"; do
  [ -f "$doc" ] && grep -HnE "(YOUR_[A-Z_]+|REPLACE_[A-Z_]+|\[EDIT\]|\{\{[^}]+\}\})" "$doc" 2>/dev/null >> "$PLACEHOLDER_EVIDENCE" || true
done

# Count violations (exclude header lines starting with #)
PLACEHOLDER_COUNT=$(grep -c '^/' "$PLACEHOLDER_EVIDENCE" 2>/dev/null || echo 0)

if [ "$PLACEHOLDER_COUNT" -gt 0 ]; then
  phase_fail "Found $PLACEHOLDER_COUNT placeholder/incomplete markers in docs - docs must be production-ready" "$PLACEHOLDER_EVIDENCE"
fi

ok "No placeholders detected in docs"
echo "✓ Placeholder scan: PASS (0 violations)" >> "$PHASE_DIR/docs_checks.txt"

write_section "$REPORT_PATH" "Phase 12: Documentation and Listing Artifacts - PASS"
echo "- All required documents: present and sized correctly" >> "$REPORT_PATH"
echo "- Privacy Policy: complete" >> "$REPORT_PATH"
echo "- Support SLA: complete" >> "$REPORT_PATH"
echo "- Requirements Matrix: validated" >> "$REPORT_PATH"
echo "- Placeholder scan: 0 violations (production-ready)" >> "$REPORT_PATH"
echo "- Evidence: \`$PHASE_DIR\`" >> "$REPORT_PATH"

ok "Phase 12: Documentation and Listing Artifacts - PASS"
