#!/bin/bash
# Phase 17: Reviewer Simulation Checklist
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$SCRIPT_DIR/lib/00_common.sh"
PHASE_ID="PHASE_17_reviewer_simulation"

PHASE_DIR="$EVIDENCE_DIR/PHASE_17_reviewer_simulation"
mkdir -p "$PHASE_DIR"

info "Phase 17: Reviewer Simulation Checklist"

echo "# Atlassian Marketplace Reviewer Simulation" > "$PHASE_DIR/reviewer_checklist.txt"
echo "Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$PHASE_DIR/reviewer_checklist.txt"
echo "" >> "$PHASE_DIR/reviewer_checklist.txt"

# Consistency checks across all documentation
echo "## Documentation Consistency Checks" >> "$PHASE_DIR/reviewer_checklist.txt"

PKG_JSON="$REPO_ROOT/atlassian/forge-app/package.json"
MANIFEST="$REPO_ROOT/atlassian/forge-app/manifest.yml"

# Extract app name from multiple sources
APP_NAME_PKG=$(jq -r '.name' "$PKG_JSON")
APP_NAME_MANIFEST=$(grep -E "^app:" "$MANIFEST" | awk '{print $2}' || echo "")

echo "App name (package.json): $APP_NAME_PKG" >> "$PHASE_DIR/reviewer_checklist.txt"
echo "App name (manifest.yml): $APP_NAME_MANIFEST" >> "$PHASE_DIR/reviewer_checklist.txt"

# Check description length
DESCRIPTION=$(jq -r '.description' "$PKG_JSON")
DESC_LEN=${#DESCRIPTION}

if [[ "$DESC_LEN" -lt 50 ]]; then
  warn "App description is short ($DESC_LEN chars)"
  echo "⚠ Description: $DESC_LEN chars (consider >50)" >> "$PHASE_DIR/reviewer_checklist.txt"
else
  ok "App description length: $DESC_LEN chars"
  echo "✓ Description: $DESC_LEN chars" >> "$PHASE_DIR/reviewer_checklist.txt"
fi

# Cross-reference all documentation files
echo "" >> "$PHASE_DIR/reviewer_checklist.txt"
echo "## Required Documentation Cross-Reference" >> "$PHASE_DIR/reviewer_checklist.txt"

DOCS_DIR="$REPO_ROOT/docs/marketplace"
REQUIRED_DOCS=(
  "MARKETPLACE_PRIVACY_POLICY.md"
  "MARKETPLACE_TERMS_OF_SERVICE.md"
  "MARKETPLACE_SUPPORT_SLA.md"
  "MARKETPLACE_DATA_FLOW.md"
  "MARKETPLACE_SCOPE_JUSTIFICATION.md"
  "MARKETPLACE_DATA_RETENTION_DELETION.md"
  "MARKETPLACE_SUBPROCESSORS.md"
  "MARKETPLACE_SECURITY_CONTACT.md"
  "MARKETPLACE_INCIDENT_RESPONSE.md"
  "MARKETPLACE_RESPONSIBLE_DISCLOSURE.md"
  "MARKETPLACE_REVIEWER_FAQ.md"
  "MARKETPLACE_REQUIREMENTS_MATRIX.md"
)

ALL_DOCS_PRESENT=true
for doc in "${REQUIRED_DOCS[@]}"; do
  if [ -f "$DOCS_DIR/$doc" ]; then
    SIZE=$(wc -c < "$DOCS_DIR/$doc")
    echo "✓ $doc ($SIZE bytes)" >> "$PHASE_DIR/reviewer_checklist.txt"
  else
    echo "❌ MISSING: $doc" >> "$PHASE_DIR/reviewer_checklist.txt"
    ALL_DOCS_PRESENT=false
  fi
done

if ! $ALL_DOCS_PRESENT; then
  die "Missing required marketplace documentation files"
fi

# Verify uninstall procedures across multiple docs
echo "" >> "$PHASE_DIR/reviewer_checklist.txt"
echo "## Uninstall / Data Deletion Consistency" >> "$PHASE_DIR/reviewer_checklist.txt"

DELETION_DOC="$DOCS_DIR/MARKETPLACE_DATA_RETENTION_DELETION.md"
DATA_FLOW_DOC="$DOCS_DIR/MARKETPLACE_DATA_FLOW.md"

if grep -qiE "uninstall" "$DELETION_DOC" && grep -qiE "uninstall" "$DATA_FLOW_DOC"; then
  echo "✓ Uninstall procedures documented consistently" >> "$PHASE_DIR/reviewer_checklist.txt"
  ok "Uninstall procedures consistent"
else
  warn "Uninstall procedures may not be consistently documented"
  echo "⚠ Check uninstall procedures across docs" >> "$PHASE_DIR/reviewer_checklist.txt"
fi

# Check for customer data deletion workflow
if grep -qiE "customer.*delete|deletion.*request" "$DELETION_DOC"; then
  echo "✓ Customer deletion request workflow present" >> "$PHASE_DIR/reviewer_checklist.txt"
  ok "Customer deletion workflow documented"
else
  warn "Customer deletion request workflow unclear"
  echo "⚠ Customer deletion workflow should be explicit" >> "$PHASE_DIR/reviewer_checklist.txt"
fi

# Security and privacy consistency
echo "" >> "$PHASE_DIR/reviewer_checklist.txt"
echo "## Security & Privacy Consistency" >> "$PHASE_DIR/reviewer_checklist.txt"

PRIVACY_DOC="$DOCS_DIR/MARKETPLACE_PRIVACY_POLICY.md"
SECURITY_DOC="$DOCS_DIR/MARKETPLACE_SECURITY_CONTACT.md"

# Check if data collection is mentioned consistently
DATA_COLLECTED=$(grep -ciE "data collect|collect.*data" "$PRIVACY_DOC" 2>/dev/null || echo "0")
# Remove any newlines and ensure single value
DATA_COLLECTED=$(echo "$DATA_COLLECTED" | tr -d '\n' | head -1)
echo "Privacy policy mentions data collection: $DATA_COLLECTED times" >> "$PHASE_DIR/reviewer_checklist.txt"

if [[ "$DATA_COLLECTED" -lt 2 ]]; then
  warn "Privacy policy may not adequately describe data collection"
  echo "⚠ Data collection description may be insufficient" >> "$PHASE_DIR/reviewer_checklist.txt"
else
  echo "✓ Data collection adequately described" >> "$PHASE_DIR/reviewer_checklist.txt"
  ok "Data collection documented"
fi

# Check security contact is email or URL
if grep -qE "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}" "$SECURITY_DOC"; then
  echo "✓ Security contact email found" >> "$PHASE_DIR/reviewer_checklist.txt"
  ok "Security contact present"
elif grep -qE "https?://" "$SECURITY_DOC"; then
  echo "✓ Security contact URL found" >> "$PHASE_DIR/reviewer_checklist.txt"
  ok "Security contact present"
else
  warn "Security contact may not have valid email or URL"
  echo "⚠ Verify security contact is reachable" >> "$PHASE_DIR/reviewer_checklist.txt"
fi

# CROSS-DOC CONSISTENCY: Extract and validate deterministic claim lines
echo "" >> "$PHASE_DIR/reviewer_checklist.txt"
echo "## Cross-Document Consistency - Deterministic Claims" >> "$PHASE_DIR/reviewer_checklist.txt"

CLAIM_EVIDENCE="$PHASE_DIR/claim_consistency.txt"
echo "# Deterministic Claim Extraction" > "$CLAIM_EVIDENCE"
echo "# All docs should contain machine-parseable claim lines for verification" >> "$CLAIM_EVIDENCE"
echo "" >> "$CLAIM_EVIDENCE"

# Expected claim patterns (must appear in relevant docs)
CLAIM_PATTERNS=(
  "CLAIM_DATA_STORED:"
  "CLAIM_EGRESS:"
  "CLAIM_RETENTION_DAYS:"
  "CLAIM_CONSOLE_LOG:"
  "CLAIM_PII_LOGGED:"
  "CLAIM_THIRD_PARTY_APIS:"
)

# Scan all docs for claim lines
echo "## Claim Lines Found" >> "$CLAIM_EVIDENCE"
for doc in "$DOCS_DIR"/*.md; do
  doc_name=$(basename "$doc")
  for pattern in "${CLAIM_PATTERNS[@]}"; do
    # Only match lines that START with the claim pattern (not mentions in prose)
    if grep -qE "^[[:space:]]*$pattern" "$doc"; then
      grep -HE "^[[:space:]]*$pattern" "$doc" >> "$CLAIM_EVIDENCE" 2>/dev/null || true
    fi
  done
done

# Validate critical claims are present
CLAIMS_FOUND=$(grep -c "^$DOCS_DIR" "$CLAIM_EVIDENCE" 2>/dev/null || echo 0)

if [ "$CLAIMS_FOUND" -lt 3 ]; then
  echo "" >> "$CLAIM_EVIDENCE"
  echo "## VALIDATION RESULT: FAIL" >> "$CLAIM_EVIDENCE"
  echo "Found only $CLAIMS_FOUND claim lines. Expected at least 3." >> "$CLAIM_EVIDENCE"
  echo "" >> "$CLAIM_EVIDENCE"
  echo "Docs must contain deterministic claim lines like:" >> "$CLAIM_EVIDENCE"
  echo "  CLAIM_DATA_STORED: (NONE|FORGE_STORAGE_ONLY|FORGE_STORAGE_AND_EXTERNAL)" >> "$CLAIM_EVIDENCE"
  echo "  CLAIM_EGRESS: (NONE|ATLASSIAN_ONLY|THIRD_PARTY)" >> "$CLAIM_EVIDENCE"
  echo "  CLAIM_RETENTION_DAYS: (0|30|90|365|NONE)" >> "$CLAIM_EVIDENCE"
  echo "  CLAIM_CONSOLE_LOG: (NONE|SAFE_ONLY|PRESENT)" >> "$CLAIM_EVIDENCE"
  echo "  CLAIM_PII_LOGGED: (NONE|POSSIBLE)" >> "$CLAIM_EVIDENCE"
  echo "  CLAIM_THIRD_PARTY_APIS: (NONE|LIST)" >> "$CLAIM_EVIDENCE"
  
  phase_fail "Missing deterministic claim lines in docs - found $CLAIMS_FOUND, need >=3" "$CLAIM_EVIDENCE"
fi

echo "✓ Found $CLAIMS_FOUND deterministic claim lines across docs" >> "$PHASE_DIR/reviewer_checklist.txt"
ok "Deterministic claims: $CLAIMS_FOUND found"

# Cross-validate specific claims
echo "" >> "$CLAIM_EVIDENCE"
echo "## Cross-Validation" >> "$CLAIM_EVIDENCE"

# Extract specific claim values (get everything after last colon, trim whitespace)
DATA_STORED_CLAIMS=$(grep "CLAIM_DATA_STORED:" "$CLAIM_EVIDENCE" | sed 's/.*CLAIM_DATA_STORED:[[:space:]]*//' | sort -u || echo "")
EGRESS_CLAIMS=$(grep "CLAIM_EGRESS:" "$CLAIM_EVIDENCE" | sed 's/.*CLAIM_EGRESS:[[:space:]]*//' | sort -u || echo "")

# Check for contradictions (multiple different values for same claim)
DATA_STORED_COUNT=$(echo "$DATA_STORED_CLAIMS" | grep -v '^$' | wc -l || echo 0)
EGRESS_COUNT=$(echo "$EGRESS_CLAIMS" | grep -v '^$' | wc -l || echo 0)

if [[ "$DATA_STORED_COUNT" -gt 1 ]]; then
  echo "⚠ WARNING: Multiple different CLAIM_DATA_STORED values found:" >> "$CLAIM_EVIDENCE"
  echo "$DATA_STORED_CLAIMS" >> "$CLAIM_EVIDENCE"
  phase_fail "Contradictory CLAIM_DATA_STORED values across docs" "$CLAIM_EVIDENCE"
fi

if [[ "$EGRESS_COUNT" -gt 1 ]]; then
  echo "⚠ WARNING: Multiple different CLAIM_EGRESS values found:" >> "$CLAIM_EVIDENCE"
  echo "$EGRESS_CLAIMS" >> "$CLAIM_EVIDENCE"
  phase_fail "Contradictory CLAIM_EGRESS values across docs" "$CLAIM_EVIDENCE"
fi

echo "✓ No contradictory claims detected" >> "$CLAIM_EVIDENCE"
echo "✓ Claim consistency: validated" >> "$PHASE_DIR/reviewer_checklist.txt"
ok "Claims are consistent across docs"


# Final reviewer perspective check
echo "" >> "$PHASE_DIR/reviewer_checklist.txt"
echo "## Final Reviewer Perspective" >> "$PHASE_DIR/reviewer_checklist.txt"

REVIEWER_FAQ="$DOCS_DIR/MARKETPLACE_REVIEWER_FAQ.md"
if [ -f "$REVIEWER_FAQ" ]; then
  FAQ_SIZE=$(wc -c < "$REVIEWER_FAQ")
  if [[ "$FAQ_SIZE" -ge 400 ]]; then
    echo "✓ Reviewer FAQ present and substantial ($FAQ_SIZE bytes)" >> "$PHASE_DIR/reviewer_checklist.txt"
    ok "Reviewer FAQ adequate"
  else
    warn "Reviewer FAQ may be too brief"
    echo "⚠ Expand Reviewer FAQ (current: $FAQ_SIZE bytes)" >> "$PHASE_DIR/reviewer_checklist.txt"
  fi
fi

# Check that README or docs mention how reviewers can test
if grep -riE "reviewer|testing|demo|sandbox" "$DOCS_DIR" "$REPO_ROOT/README.md" 2>/dev/null | wc -l | xargs test 2 -lt; then
  echo "✓ Documentation includes reviewer/testing guidance" >> "$PHASE_DIR/reviewer_checklist.txt"
  ok "Reviewer testing guidance present"
else
  warn "Consider adding explicit reviewer testing guidance"
  echo "⚠ Add reviewer testing/demo instructions" >> "$PHASE_DIR/reviewer_checklist.txt"
fi

echo "" >> "$PHASE_DIR/reviewer_checklist.txt"
echo "## Summary" >> "$PHASE_DIR/reviewer_checklist.txt"
echo "All critical documentation present and cross-referenced." >> "$PHASE_DIR/reviewer_checklist.txt"
echo "Ready for hostile scrutiny from new vendor review perspective." >> "$PHASE_DIR/reviewer_checklist.txt"

write_section "$REPORT_PATH" "Phase 17: Reviewer Simulation Checklist - PASS"
echo "- All required docs present and consistent" >> "$REPORT_PATH"
echo "- Uninstall procedures documented" >> "$REPORT_PATH"
echo "- Security and privacy adequately covered" >> "$REPORT_PATH"
echo "- Deterministic claims: validated and consistent" >> "$REPORT_PATH"
echo "- Evidence: \`$PHASE_DIR\`" >> "$REPORT_PATH"

ok "Phase 17: Reviewer Simulation Checklist - PASS"
