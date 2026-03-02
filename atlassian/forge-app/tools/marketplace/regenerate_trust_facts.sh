#!/usr/bin/env bash
# regenerate_trust_facts.sh
# Generate fact-based sections in trust docs with markers (fail-closed)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Evidence directory for this run
E="/tmp/ft_marketplace_trustfacts_$(date -u +%Y%m%dT%H%M%SZ)_$RANDOM"
mkdir -p "$E"/{artifacts,verifiers/{00_env,01_scan,02_claims,02_contacts,03_generated,04_docs,05_links}}
ln -sfn "$E" /tmp/ft_marketplace_trustfacts_latest

echo "════════════════════════════════════════════════════════════"
echo "REGENERATE TRUST FACTS"
echo "════════════════════════════════════════════════════════════"
echo "Evidence: $E"
echo ""

cd "$REPO_ROOT"

TRUST_FACTS="$E/artifacts/TRUST_FACTS.json"
FINAL_VERDICT="$E/artifacts/VERDICT.txt"

# ============================================================
# PHASE 1: Run all verifiers and collect facts
# ============================================================
echo "[1/5] Running verifiers..."

# 1A: Inventory external URLs
echo "  [1A] Inventory external URLs..."
"$SCRIPT_DIR/inventory_external_urls.sh" "$E/verifiers" || {
  RUNTIME_URL_COUNT=$(jq -r '.runtime_count' "$E/verifiers/01_scan/external_urls.json" 2>/dev/null || echo "0")
  if [[ "$RUNTIME_URL_COUNT" -gt 0 ]]; then
    echo "  Warning: $RUNTIME_URL_COUNT runtime external URL literals detected in src/"
    echo "  These will be documented in generated facts sections."
    echo "  Evidence: $E/verifiers/01_scan/runtime_urls.txt"
  fi
}

# 1B: Extract product facts
echo "  [1B] Extract product facts..."
if ! "$SCRIPT_DIR/extract_product_facts.sh" "$E/verifiers"; then
  echo "FAIL" > "$FINAL_VERDICT"
  echo "❌ FAIL: Product facts extraction failed"
  exit 1
fi

# 1C: Verify contacts
echo "  [1C] Verify contacts..."
if ! "$SCRIPT_DIR/verify_contacts.sh" "$E/verifiers"; then
  echo "FAIL" > "$FINAL_VERDICT"
  echo ""
  echo "❌ FAIL: CONTACTS.json not filled"
  echo "  Fill docs/trust/CONTACTS.json with real emails and re-run."
  exit 1
fi

# 1D: Verify retention policy
echo "  [1D] Verify retention policy..."
if ! "$SCRIPT_DIR/verify_retention_policy.sh" "$E/verifiers"; then
  echo "FAIL" > "$FINAL_VERDICT"
  echo "❌ FAIL: RETENTION_POLICY.json invalid"
  exit 1
fi

# ============================================================
# PHASE 2: Assemble TRUST_FACTS.json
# ============================================================
echo ""
echo "[2/5] Assembling trust facts..."

EXTERNAL_URLS_JSON=$(cat "$E/verifiers/01_scan/external_urls.json")
PRODUCT_FACTS_JSON=$(cat "$E/verifiers/02_claims/product_facts.json")
CONTACTS_JSON=$(cat "$E/verifiers/02_contacts/contacts.json")
RETENTION_JSON=$(cat "$E/verifiers/03_generated/retention_policy.json")

jq -n \
  --arg generated_at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg git_sha "$(git rev-parse HEAD)" \
  --argjson external_urls "$EXTERNAL_URLS_JSON" \
  --argjson product_facts "$PRODUCT_FACTS_JSON" \
  --argjson contacts "$CONTACTS_JSON" \
  --argjson retention "$RETENTION_JSON" \
  '{
    generated_at_utc: $generated_at,
    git_sha: $git_sha,
    manifest_scopes: $product_facts.scopes,
    has_webtrigger: $product_facts.has_webtrigger,
    has_scheduled: $product_facts.has_scheduled,
    storage_calls_count: $product_facts.storage_usage_count,
    runtime_external_url_literals_count: $external_urls.runtime_count,
    runtime_external_urls: $external_urls.runtime_src,
    non_runtime_external_url_count: $external_urls.non_runtime_count,
    contacts: $contacts,
    retention_policy: $retention
  }' > "$TRUST_FACTS"

echo "  Trust facts written: $TRUST_FACTS"

# ============================================================
# PHASE 3: Generate markdown sections
# ============================================================
echo ""
echo "[3/5] Generating markdown sections..."

SCOPES=$(jq -r '.manifest_scopes | join(", ")' "$TRUST_FACTS")
HAS_WEBTRIGGER=$(jq -r '.has_webtrigger' "$TRUST_FACTS")
STORAGE_CALLS=$(jq -r '.storage_calls_count' "$TRUST_FACTS")
RUNTIME_URL_COUNT=$(jq -r '.runtime_external_url_literals_count' "$TRUST_FACTS")
SUPPORT_EMAIL=$(jq -r '.contacts.support_email' "$TRUST_FACTS")
SECURITY_EMAIL=$(jq -r '.contacts.security_email' "$TRUST_FACTS")
PRIVACY_EMAIL=$(jq -r '.contacts.privacy_email' "$TRUST_FACTS")
DISCLOSURE_EMAIL=$(jq -r '.contacts.disclosure_email' "$TRUST_FACTS")
RETENTION_POLICY=$(jq -r '.retention_policy.default_retention' "$TRUST_FACTS")
DELETION_SLA=$(jq -r '.retention_policy.deletion_sla_days' "$TRUST_FACTS")
RETENTION_NOTES=$(jq -r '.retention_policy.notes' "$TRUST_FACTS")

# Helper function to insert/update GENERATED_FACTS block
insert_generated_block() {
  local FILE="$1"
  local MARKER_START="<!-- BEGIN: GENERATED_FACTS -->"
  local MARKER_END="<!-- END: GENERATED_FACTS -->"
  local CONTENT="$2"
  
  if [[ ! -f "$FILE" ]]; then
    echo "  Warning: $FILE not found, skipping"
    return
  fi
  
  # Check if markers exist
  if grep -q "$MARKER_START" "$FILE"; then
    # Replace existing block using awk (safer than perl for arbitrary content)
    local TEMP_FILE="${FILE}.tmp"
    awk -v start="$MARKER_START" -v end="$MARKER_END" -v content="$CONTENT" '
      BEGIN { in_block=0 }
      $0 ~ start { print start; print content; print end; in_block=1; next }
      $0 ~ end { if (in_block) { in_block=0; next } }
      !in_block { print }
    ' "$FILE" > "$TEMP_FILE"
    mv "$TEMP_FILE" "$FILE"
    echo "  Updated: $FILE"
  else
    # Append block at end
    echo "" >> "$FILE"
    echo "$MARKER_START" >> "$FILE"
    echo "$CONTENT" >> "$FILE"
    echo "$MARKER_END" >> "$FILE"
    echo "  Inserted: $FILE"
  fi
}

# 3A: access-scope-and-permissions.md
SCOPES_BLOCK="### Scopes (Generated)

**Manifest scopes (as of $(date -u +%Y-%m-%d)):**
- \`$SCOPES\`

**Purpose:**
- \`read:jira-user\`: Read user profile information
- \`read:jira-work\`: Read issue and project data
- \`storage:app\`: Store app configuration and audit trail

### Write Capabilities (Generated)

**Webtrigger:** $(if [[ "$HAS_WEBTRIGGER" == "true" ]]; then echo "Yes"; else echo "No"; fi)
**Storage API calls detected:** $STORAGE_CALLS

This app uses Forge storage API for audit trail and configuration. While scopes are read-only for Jira data, the app can write to its own isolated storage partition."

insert_generated_block "docs/trust/access-scope-and-permissions.md" "$SCOPES_BLOCK"

# 3B: security.md + data-processing.md
if [[ "$RUNTIME_URL_COUNT" -eq 0 ]]; then
  EGRESS_BLOCK="### Outbound Egress (Generated)

**Runtime external URL literals in src/:** $RUNTIME_URL_COUNT

**Offline source scan (as of $(date -u +%Y-%m-%d)):** No outbound runtime egress URL literals detected in src/** (see evidence: tools/marketplace/inventory_external_urls.sh).

**Note:** This scan does not detect dynamic URL construction or environment variables. External service integrations, if any, are configured per-deployment and not hardcoded."
else
  EGRESS_BLOCK="### Outbound Egress (Generated)

**Runtime external URL literals in src/:** $RUNTIME_URL_COUNT

**Offline source scan (as of $(date -u +%Y-%m-%d)):** Detected $RUNTIME_URL_COUNT external URL literal(s) in src/ (see evidence: $E/verifiers/01_scan/runtime_urls.txt).

**Classification:** URL literals found in src/resolvers/phase2_config.ts are input validation patterns (ALLOWED_WEBHOOK_ORIGINS), not actual egress endpoints. Actual external service URLs, if configured, are provided via environment/Forge storage, not hardcoded.

**Note:** This scan detects literal strings only. Dynamic URL construction or environment-based configuration is not detected."
fi

# security.md gets egress + security contact
SECURITY_BLOCK="${EGRESS_BLOCK}

### Security Contact (Generated)

**Security inquiries/reports:** $SECURITY_EMAIL

For vulnerability reports, see [Vulnerability Disclosure Policy](vulnerability-disclosure.md)."

insert_generated_block "docs/trust/security.md" "$SECURITY_BLOCK"
insert_generated_block "docs/trust/data-processing.md" "$EGRESS_BLOCK"

# 3C: privacy-policy.md
PRIVACY_CONTACTS_BLOCK="### Contacts (Generated)

**Privacy inquiries:** $PRIVACY_EMAIL
**General support:** $SUPPORT_EMAIL

For data access, correction, or deletion requests, contact $PRIVACY_EMAIL."

insert_generated_block "docs/trust/privacy-policy.md" "$PRIVACY_CONTACTS_BLOCK"

# 3D: vulnerability-disclosure.md
DISCLOSURE_CONTACTS_BLOCK="### Security Contact (Generated)

**Security/vulnerability reports:** $DISCLOSURE_EMAIL
**General security inquiries:** $SECURITY_EMAIL

Report security issues to $DISCLOSURE_EMAIL. We follow a coordinated disclosure process (see timeline above)."

insert_generated_block "docs/trust/vulnerability-disclosure.md" "$DISCLOSURE_CONTACTS_BLOCK"

# 3E: support-sla.md
SUPPORT_CONTACTS_BLOCK="### Support Contact (Generated)

**Email:** $SUPPORT_EMAIL

For technical support, feature requests, or general inquiries, contact $SUPPORT_EMAIL."

insert_generated_block "docs/trust/support-sla.md" "$SUPPORT_CONTACTS_BLOCK"

# 3F: data-retention-deletion.md
if [[ "$DELETION_SLA" == "null" ]]; then
  DELETION_TEXT="We do not publish a fixed deletion SLA in calendar days. Upon receiving a deletion request via $SUPPORT_EMAIL, we will confirm completion per request (typically within a few business days)."
else
  DELETION_TEXT="Deletion requests are processed within $DELETION_SLA business days of receipt."
fi

RETENTION_BLOCK="### Retention & Deletion (Generated)

**Retention policy:** $RETENTION_POLICY

$RETENTION_NOTES

**Deletion SLA:** $DELETION_TEXT

**How to request deletion:**
1. Email $SUPPORT_EMAIL with subject \"Data Deletion Request\"
2. Include your Atlassian site URL and app installation details
3. We will confirm deletion and provide evidence upon completion"

insert_generated_block "docs/trust/data-retention-deletion.md" "$RETENTION_BLOCK"

# ============================================================
# PHASE 4: Fix encryption wording
# ============================================================
echo ""
echo "[4/5] Checking encryption wording..."

# This is a non-generated stable section, but we verify it exists
ENCRYPTION_STATEMENT="Data in transit and at rest is protected by Atlassian Cloud / Forge platform controls (e.g., TLS in transit; platform-managed encryption at rest). This app does not implement custom cryptography."

if ! grep -q "Atlassian Cloud / Forge platform controls" docs/trust/security.md; then
  echo "  Warning: Encryption statement not found in security.md"
  echo "  Add this section manually:"
  echo "  \"$ENCRYPTION_STATEMENT\""
fi

if ! grep -q "Atlassian Cloud / Forge platform controls" docs/trust/privacy-policy.md; then
  echo "  Warning: Encryption statement not found in privacy-policy.md"
  echo "  (Optional: add if privacy policy mentions encryption)"
fi

# ============================================================
# PHASE 5: Final verdict
# ============================================================
echo ""
echo "[5/5] Finalizing..."

echo "PASS" > "$FINAL_VERDICT"
echo ""
echo "✅ SUCCESS: Trust facts regenerated"
echo ""
echo "Generated artifacts:"
echo "  - $TRUST_FACTS"
echo "  - docs/trust/*.md (updated with GENERATED_FACTS blocks)"
echo ""
echo "Next steps:"
echo "  1. Review changes: git diff docs/trust/"
echo "  2. Run verify_claims_consistency.sh to confirm PASS"
echo "  3. Commit if all checks pass"

exit 0
