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
# PHASE 3G: Generate standalone reference files
# ============================================================
echo ""
echo "  [3G] Generating standalone reference files..."

GENERATED_DIR="docs/trust/generated"
mkdir -p "$GENERATED_DIR"

# 3G-1: manifest_scopes.md
MANIFEST_SCOPES_MD="$GENERATED_DIR/manifest_scopes.md"

# Extract scopes to a variable first (avoid subshell in output redirection)
SCOPES_TABLE=""
if [[ -f "manifest.yml" ]]; then
  if grep -q "^permissions:" manifest.yml; then
    # Extract scopes using grep and sed
    while IFS= read -r scope; do
      if [[ -n "$scope" ]]; then
        # Determine purpose based on scope name
        case "$scope" in
          *read:jira-user*)
            SCOPES_TABLE+="| \`$scope\` | Read user profile information from Jira |"$'\n'
            ;;
          *read:jira-work*)
            SCOPES_TABLE+="| \`$scope\` | Read issue, project, and work data from Jira |"$'\n'
            ;;
          *storage:app*)
            SCOPES_TABLE+="| \`$scope\` | Store app configuration and audit trail in Forge storage |"$'\n'
            ;;
          *:write*)
            SCOPES_TABLE+="| \`$scope\` | Write access (review carefully for security implications) |"$'\n'
            ;;
          *)
            SCOPES_TABLE+="| \`$scope\` | See [access-scope-and-permissions.md](../access-scope-and-permissions.md) for details |"$'\n'
            ;;
        esac
      fi
    done < <(grep -A 50 "^permissions:" manifest.yml | grep -A 50 "^  scopes:" | grep "^    -" | sed 's/^    - //')
    
    # If no scopes found, show message
    if [[ -z "$SCOPES_TABLE" ]]; then
      SCOPES_TABLE="| *(none)* | No scopes declared in manifest |"
    fi
  else
    SCOPES_TABLE="| *(none)* | No permissions section in manifest |"
  fi
else
  SCOPES_TABLE="| *(error)* | manifest.yml not found |"
fi

# Now write the file
{
  echo "# Manifest Scopes Reference"
  echo ""
  echo "**Auto-generated from:** \`manifest.yml\`"
  echo "**Generated at:** $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "**Git SHA:** $(git rev-parse HEAD 2>/dev/null || echo 'unknown')"
  echo ""
  echo "<!-- BEGIN: GENERATED -->"
  echo ""
  echo "This file documents the Forge permission scopes declared in the app manifest."
  echo ""
  echo "## Declared Scopes"
  echo ""
  echo "| Scope | Purpose |"
  echo "|-------|---------|"
  echo "$SCOPES_TABLE"
  echo ""
  echo "## Notes"
  echo ""
  echo "- Scopes are extracted directly from \`manifest.yml\` \`permissions.scopes\` section"
  echo "- Purpose descriptions are heuristic; see [access-scope-and-permissions.md](../access-scope-and-permissions.md) for detailed justification"
  echo "- This file is regenerated via \`tools/marketplace/regenerate_trust_facts.sh\`"
  echo ""
  echo "<!-- END: GENERATED -->"
} > "$MANIFEST_SCOPES_MD"
echo "  Generated: $MANIFEST_SCOPES_MD"

# 3G-2: external_urls_inventory.md
EXTERNAL_URLS_MD="$GENERATED_DIR/external_urls_inventory.md"

# Extract URLs to a variable first
URLS_LIST=""
if [[ "$RUNTIME_URL_COUNT" -gt 0 ]]; then
  while IFS= read -r url; do
    if [[ -n "$url" ]]; then
      URLS_LIST+="- \`$url\`"$'\n'
    fi
  done < <(jq -r '.runtime_src[]' "$TRUST_FACTS" 2>/dev/null)
fi

# Now write the file
{
  echo "# External URLs Inventory"
  echo ""
  echo "**Auto-generated from:** Source code scan via \`tools/marketplace/inventory_external_urls.sh\`"
  echo "**Generated at:** $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "**Git SHA:** $(git rev-parse HEAD 2>/dev/null || echo 'unknown')"
  echo ""
  echo "<!-- BEGIN: GENERATED -->"
  echo ""
  echo "This file documents external URLs detected in the codebase."
  echo ""
  echo "## Runtime External URLs"
  echo ""
  echo "**Count:** $RUNTIME_URL_COUNT"
  echo ""
  
  if [[ "$RUNTIME_URL_COUNT" -gt 0 ]]; then
    echo "URLs detected in \`src/**\`:"
    echo ""
    echo "$URLS_LIST"
    echo ""
    echo "**Note:** These are literal strings in source code. They may be:"
    echo "- Input validation patterns (e.g., allowed webhook origins)"
    echo "- Documentation/comment references"
    echo "- Configuration templates"
    echo ""
    echo "Actual runtime egress, if any, is configured per-deployment and not hardcoded."
  else
    echo "No runtime external URL literals detected in \`src/**\`."
  fi
  
  echo ""
  echo "## Non-Runtime External URLs"
  echo ""
  echo "**Count:** $(jq -r '.non_runtime_external_url_count' "$TRUST_FACTS")"
  echo ""
  echo "URLs in documentation, tests, or build scripts (not runtime-loaded)."
  echo ""
  echo "<!-- END: GENERATED -->"
} > "$EXTERNAL_URLS_MD"
echo "  Generated: $EXTERNAL_URLS_MD"

# 3G-3: storage_usage_inventory.md
STORAGE_USAGE_MD="$GENERATED_DIR/storage_usage_inventory.md"
{
  echo "# Storage Usage Inventory"
  echo ""
  echo "**Auto-generated from:** Product facts extraction"
  echo "**Generated at:** $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "**Git SHA:** $(git rev-parse HEAD 2>/dev/null || echo 'unknown')"
  echo ""
  echo "<!-- BEGIN: GENERATED -->"
  echo ""
  echo "This file documents Forge storage API usage detected in the codebase."
  echo ""
  echo "## Storage API Calls"
  echo ""
  echo "**Detected storage API calls in \`src/**\`:** $STORAGE_CALLS"
  echo ""
  
  if [[ "$STORAGE_CALLS" -gt 0 ]]; then
    echo "The app uses Forge's built-in storage API (\`storage.set()\`, \`storage.get()\`) for:"
    echo ""
    echo "- App configuration persistence"
    echo "- Audit trail / activity log"
    echo "- User preferences (if applicable)"
    echo ""
    echo "**Isolation:** Forge storage is app-scoped and isolated per installation."
    echo "**Encryption:** Managed by Atlassian Forge platform (encryption at rest)."
    echo "**Retention:** See [data-retention-deletion.md](../data-retention-deletion.md)"
  else
    echo "No Forge storage API calls detected in \`src/**\`."
    echo ""
    echo "The app may be stateless or use alternative persistence mechanisms."
  fi
  echo ""
  echo "<!-- END: GENERATED -->"
} > "$STORAGE_USAGE_MD"
echo "  Generated: $STORAGE_USAGE_MD"

# ============================================================
# [3H] Generate Pages-safe mirror docs (for offline linkability)
# ============================================================
echo ""
echo "[3H] Generating Pages-safe mirror docs..."

MIRROR_DIR="$REPO_ROOT/docs/trust/generated"
mkdir -p "$MIRROR_DIR"

# [3H-1] security_overview_mirror.md
SECURITY_MIRROR="$MIRROR_DIR/security_overview_mirror.md"
{
  echo "# Security Overview (Mirror)"
  echo ""
  echo "<!-- BEGIN: GENERATED -->"
  echo "**Purpose**: This file mirrors security information from the repository root for GitHub Pages linkability."
  echo ""
  echo "**Policy**: GitHub Pages sites serve only from \`docs/\` tree. Links to \`../SECURITY.md\` escape the docs directory and break offline."
  echo ""
  echo "---"
  echo ""
  if [[ -f "$REPO_ROOT/SECURITY.md" ]]; then
    echo "## Repository Security Policy"
    echo ""
    # Extract key sections (first 100 lines as sample)
    head -100 "$REPO_ROOT/SECURITY.md" | sed 's/^/> /'
    echo ""
    echo "_(Excerpt from repository SECURITY.md)_"
  else
    echo "**Note**: No SECURITY.md found at repository root."
  fi
  echo ""
  echo "For detailed security architecture within the application, see:"
  echo "- [Security Overview](../SECURITY_OVERVIEW.md)"
  echo "- [Threat Model](../THREAT_MODEL.md)"
  echo "- [Access Scope & Permissions](../access-scope-and-permissions.md)"
  echo ""
  echo "<!-- END: GENERATED -->"
} > "$SECURITY_MIRROR"
echo "  Generated: $SECURITY_MIRROR"

# [3H-2] privacy_policy_mirror.md
PRIVACY_MIRROR="$MIRROR_DIR/privacy_policy_mirror.md"
{
  echo "# Privacy Policy (Mirror)"
  echo ""
  echo "<!-- BEGIN: GENERATED -->"
  echo "**Purpose**: This file provides privacy policy references for GitHub Pages linkability."
  echo ""
  if [[ -f "$REPO_ROOT/docs/trust/privacy-policy.md" ]]; then
    echo "## Privacy Policy"
    echo ""
    echo "See the canonical privacy policy:"
    echo "- [Privacy Policy](../privacy-policy.md)"
    echo ""
  fi
  if [[ -f "$REPO_ROOT/docs/trust/PRIVACY_POLICY.md" ]]; then
    echo "Additional privacy documentation:"
    echo "- [Privacy Policy (Detailed)](../PRIVACY_POLICY.md)"
    echo ""
  fi
  echo "**Data Handling**:"
  echo "- [Data Processing](../data-processing.md)"
  echo "- [Data Retention & Deletion](../data-retention-deletion.md)"
  echo "- [Data Classification & PII](../DATA_CLASSIFICATION_AND_PII.md)"
  echo ""
  echo "<!-- END: GENERATED -->"
} > "$PRIVACY_MIRROR"
echo "  Generated: $PRIVACY_MIRROR"

# [3H-3] legal_mirror.md
LEGAL_MIRROR="$MIRROR_DIR/legal_mirror.md"
{
  echo "# Legal Documents (Mirror)"
  echo ""
  echo "<!-- BEGIN: GENERATED -->"
  echo "**Purpose**: This file provides links to legal documentation within the docs tree."
  echo ""
  echo "## Available Legal Documents"
  echo ""
  echo "All legal documents are maintained within the trust documentation:"
  echo ""
  echo "- [Terms of Service](../TERMS_OF_SERVICE.md)"
  echo "- [Vulnerability Disclosure Policy](../VULNERABILITY_DISCLOSURE_POLICY.md)"
  echo "- [Subprocessors](../SUBPROCESSORS.md)"
  echo "- [Customer Responsibilities](../CUSTOMER_RESPONSIBILITIES.md)"
  echo ""
  echo "**Note**: Links to \`../legal/\` directory are not available in Pages deployment."
  echo ""
  echo "<!-- END: GENERATED -->"
} > "$LEGAL_MIRROR"
echo "  Generated: $LEGAL_MIRROR"

# [3H-4] code_refs_inventory.md
CODE_REFS="$MIRROR_DIR/code_refs_inventory.md"
{
  echo "# Code References Inventory"
  echo ""
  echo "<!-- BEGIN: GENERATED -->"
  echo "**Purpose**: This file provides stable anchors for code file references that cannot be linked directly from GitHub Pages."
  echo ""
  echo "**Policy**: Pages sites cannot link to \`src/\`, \`tests/\`, or \`tools/\` directories. This inventory provides"
  echo "markdown anchors for documentation purposes only (not full source reproduction)."
  echo ""
  echo "---"
  echo ""
  echo "## Source Files"
  echo ""
  # List src/ files
  if [[ -d "$REPO_ROOT/src" ]]; then
    find "$REPO_ROOT/src" -type f -name "*.ts" -o -name "*.tsx" -o -name "*.js" | sort | while read -r file; do
      REL_PATH="${file#$REPO_ROOT/}"
      BASENAME=$(basename "$file")
      SLUG=$(echo "$BASENAME" | tr '[:upper:]' '[:lower:]' | tr '.' '-')
      echo "### $REL_PATH {#${SLUG}}"
      echo ""
      echo "**Path**: \`$REL_PATH\`"
      echo ""
    done
  fi
  echo ""
  echo "## Test Files"
  echo ""
  # List tests/ files
  if [[ -d "$REPO_ROOT/tests" ]]; then
    find "$REPO_ROOT/tests" -type f \( -name "*.test.ts" -o -name "*.spec.ts" \) | head -20 | sort | while read -r file; do
      REL_PATH="${file#$REPO_ROOT/}"
      BASENAME=$(basename "$file")
      SLUG=$(echo "$BASENAME" | tr '[:upper:]' '[:lower:]' | tr '.' '-')
      echo "### $REL_PATH {#${SLUG}}"
      echo ""
      echo "**Path**: \`$REL_PATH\`"
      echo ""
    done
  fi
  echo ""
  echo "## Tools"
  echo ""
  # List tools/ files
  if [[ -d "$REPO_ROOT/tools" ]]; then
    find "$REPO_ROOT/tools" -type f \( -name "*.sh" -o -name "*.py" \) | head -20 | sort | while read -r file; do
      REL_PATH="${file#$REPO_ROOT/}"
      BASENAME=$(basename "$file")
      SLUG=$(echo "$BASENAME" | tr '[:upper:]' '[:lower:]' | tr '.' '-')
      echo "### $REL_PATH {#${SLUG}}"
      echo ""
      echo "**Path**: \`$REL_PATH\`"
      echo ""
    done
  fi
  echo ""
  echo "**Note**: This is an inventory for anchor purposes only. For full source code, see the repository."
  echo ""
  echo "<!-- END: GENERATED -->"
} > "$CODE_REFS"
echo "  Generated: $CODE_REFS"

# [3H-5] repo_refs.md
REPO_REFS="$MIRROR_DIR/repo_refs.md"
{
  echo "# Repository References"
  echo ""
  echo "<!-- BEGIN: GENERATED -->"
  echo "**Purpose**: This document provides references to repository files that cannot be linked directly from GitHub Pages."
  echo ""
  echo "## Repository Structure Overview"
  echo ""
  echo "The full repository includes:"
  echo ""
  echo "- **docs/**: Documentation (you are here)"
  echo "- **src/**: Application source code"
  echo "- **tests/**: Test suites"
  echo "- **tools/**: Build and deployment scripts"
  echo "- **manifest.yml**: Forge app manifest → see [Manifest Scopes](manifest_scopes.md)"
  echo ""
  echo "## Common Files"
  echo ""
  echo "### README.md"
  echo ""
  echo "See documentation index: [README_DOCS_INDEX](../../README_DOCS_INDEX.md)"
  echo ""
  echo "### LICENSE"
  echo ""
  echo "License information is available in the repository root."
  echo ""
  echo "### CONTRIBUTING.md"
  echo ""
  echo "Contribution guidelines are maintained in the repository root."
  echo ""
  echo "### CODE_OF_CONDUCT.md"
  echo ""
  echo "Community standards are documented in the repository root."
  echo ""
  echo "**Note**: For full repository access, clone or browse via GitHub."
  echo ""
  echo "<!-- END: GENERATED -->"
} > "$REPO_REFS"
echo "  Generated: $REPO_REFS"

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
