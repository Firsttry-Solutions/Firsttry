#!/usr/bin/env bash
# verify_privacy_security_pack.sh
# Marketplace Privacy & Security + Trust Pack Verifier
# Deterministic, fail-closed, offline validation
# Exit 0 = PASS, Exit 1 = FAIL

set -euo pipefail

# ============================================================================
# CONFIGURATION
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Must run from atlassian/forge-app
if [[ "$(basename "$REPO_ROOT")" != "forge-app" ]]; then
  echo "ERROR: Must run from atlassian/forge-app directory"
  echo "Current: $REPO_ROOT"
  exit 1
fi

# Evidence directory
TIMESTAMP=$(date -u +%Y%m%dT%H%M%SZ)
E="/tmp/ft_marketplace_pack_${TIMESTAMP}_$$"
mkdir -p "$E"/{00_inputs,01_presence,02_pages,03_links,04_content,05_verdict,artifacts,02_contacts,03_generated}
ln -sfn "$E" /tmp/ft_marketplace_pack_latest

echo "[MARKETPLACE PACK] Privacy & Security + Trust Pack Verifier"
echo "Evidence: $E"
echo ""

# Required Marketplace docs (lowercase with hyphens per spec)
declare -a REQUIRED_DOCS=(
  "docs/trust/README.md"
  "docs/trust/privacy-policy.md"
  "docs/trust/security.md"
  "docs/trust/data-retention-deletion.md"
  "docs/trust/subprocessors.md"
  "docs/trust/vulnerability-disclosure.md"
  "docs/trust/support-sla.md"
  "docs/trust/incident-response.md"
  "docs/trust/data-processing.md"
  "docs/trust/access-scope-and-permissions.md"
)

declare -a REQUIRED_OPS_DOCS=(
  "docs/ops/README.md"
  "docs/ops/05_audit_runbook.md"
)

# ============================================================================
# PHASE 00: REALWORLD GATES DEPENDENCY CHECK
# ============================================================================

echo "[00] Checking REALWORLD gates prerequisite..."

RWORLD=$(readlink /tmp/ft_realworld_latest 2>/dev/null || true)
if [[ -z "$RWORLD" ]]; then
  echo "FAIL: /tmp/ft_realworld_latest symlink not found"
  echo "Must run realworld gates first: bash tools/realworld/run_realworld_gates.sh"
  echo "REJECT" > "$E/05_verdict/VERDICT.txt"
  echo "Missing prerequisite: REALWORLD gates not run" >> "$E/05_verdict/VERDICT.txt"
  exit 1
fi

RWORLD_SUMMARY="$RWORLD/artifacts/REALWORLD_SUMMARY.json"
if [[ ! -f "$RWORLD_SUMMARY" ]]; then
  echo "FAIL: $RWORLD_SUMMARY not found"
  echo "REALWORLD gates did not produce summary"
  echo "REJECT" > "$E/05_verdict/VERDICT.txt"
  echo "Missing: REALWORLD_SUMMARY.json" >> "$E/05_verdict/VERDICT.txt"
  exit 1
fi

RWORLD_STATUS=$(jq -r '.final.status' "$RWORLD_SUMMARY" 2>/dev/null || echo "UNKNOWN")
if [[ "$RWORLD_STATUS" != "PASS" ]]; then
  echo "FAIL: REALWORLD gates status = $RWORLD_STATUS (expected PASS)"
  echo "Fix REALWORLD gates first before running marketplace pack verification"
  echo "REJECT" > "$E/05_verdict/VERDICT.txt"
  echo "Prerequisite failed: REALWORLD gates = $RWORLD_STATUS" >> "$E/05_verdict/VERDICT.txt"
  exit 1
fi

echo "  REALWORLD gates: PASS"
cp "$RWORLD_SUMMARY" "$E/00_inputs/"

# ============================================================================
# PHASE 01: PRESENCE CHECKS
# ============================================================================

echo ""
echo "[01] Checking presence of required docs..."

declare -a PRESENT=()
declare -a MISSING=()
PRESENCE_REPORT="$E/01_presence/presence_report.txt"

for doc in "${REQUIRED_DOCS[@]}" "${REQUIRED_OPS_DOCS[@]}"; do
  DOC_PATH="$REPO_ROOT/$doc"
  if [[ -f "$DOC_PATH" ]]; then
    echo "PASS $doc exists" >> "$PRESENCE_REPORT"
    PRESENT+=("$doc")
  else
    echo "FAIL $doc missing" >> "$PRESENCE_REPORT"
    MISSING+=("$doc")
  fi
done

# Generate JSON
PRESENT_JSON='[]'
if [[ ${#PRESENT[@]} -gt 0 ]]; then
  PRESENT_JSON=$(printf '%s\n' "${PRESENT[@]}" | jq -R . | jq -s .)
fi
MISSING_JSON='[]'
if [[ ${#MISSING[@]} -gt 0 ]]; then
  MISSING_JSON=$(printf '%s\n' "${MISSING[@]}" | jq -R . | jq -s .)
fi
jq -n \
  --argjson present "$PRESENT_JSON" \
  --argjson missing "$MISSING_JSON" \
  '{present: $present, missing: $missing, total: ($present | length), missing_count: ($missing | length)}' \
  > "$E/artifacts/PACK_PRESENCE.json"

echo "  Present: ${#PRESENT[@]}"
echo "  Missing: ${#MISSING[@]}"

if [[ ${#MISSING[@]} -gt 0 ]]; then
  echo "  FAIL: Missing required docs"
fi

# ============================================================================
# PHASE 02: GITHUB PAGES LINKABILITY
# ============================================================================

echo ""
echo "[02] Checking GitHub Pages linkability..."

PAGES_REPORT="$E/02_pages/pages_linkability_report.txt"
declare -a NAV_FILES_FOUND=()
declare -a PAGES_ISSUES=()

# Detect navigation files
for nav_candidate in "mkdocs.yml" "docs/_sidebar.md" "docs/index.md" "docs/README.md" "docs/trust/README.md"; do
  if [[ -f "$REPO_ROOT/$nav_candidate" ]]; then
    NAV_FILES_FOUND+=("$nav_candidate")
    echo "Found nav file: $nav_candidate" >> "$PAGES_REPORT"
  fi
done

if [[ ${#NAV_FILES_FOUND[@]} -eq 0 ]]; then
  echo "FAIL: No navigation files found (mkdocs.yml, docs/**/README.md, etc.)" >> "$PAGES_REPORT"
  PAGES_ISSUES+=("No navigation files detected")
else
  # For each required doc, check if it's linked
  for doc in "${REQUIRED_DOCS[@]}"; do
    LINKED=false
    LINKING_LOCATIONS=()
    
    for nav_file in "${NAV_FILES_FOUND[@]}"; do
      NAV_PATH="$REPO_ROOT/$nav_file"
      if grep -q "$(basename "$doc")" "$NAV_PATH" 2>/dev/null || \
         grep -q "${doc#docs/}" "$NAV_PATH" 2>/dev/null || \
         grep -q "$doc" "$NAV_PATH" 2>/dev/null; then
        LINKED=true
        LINKING_LOCATIONS+=("$nav_file")
      fi
    done
    
    if [[ "$LINKED" == "true" ]]; then
      echo "PASS $doc linked from: ${LINKING_LOCATIONS[*]}" >> "$PAGES_REPORT"
    else
      echo "FAIL $doc not linked in any nav file" >> "$PAGES_REPORT"
      PAGES_ISSUES+=("$doc not linked - add to ${NAV_FILES_FOUND[0]}")
    fi
  done
fi

# Generate JSON
NAV_FILES_JSON='[]'
if [[ ${#NAV_FILES_FOUND[@]} -gt 0 ]]; then
  NAV_FILES_JSON=$(printf '%s\n' "${NAV_FILES_FOUND[@]}" | jq -R . | jq -s .)
fi
PAGES_ISSUES_JSON='[]'
if [[ ${#PAGES_ISSUES[@]} -gt 0 ]]; then
  PAGES_ISSUES_JSON=$(printf '%s\n' "${PAGES_ISSUES[@]}" | jq -R . | jq -s .)
fi
jq -n \
  --argjson nav_files "$NAV_FILES_JSON" \
  --argjson issues "$PAGES_ISSUES_JSON" \
  '{nav_files_found: $nav_files, issues: $issues, linkability_pass: ($issues | length == 0)}' \
  > "$E/artifacts/PACK_PAGES.json"

echo "  Nav files found: ${#NAV_FILES_FOUND[@]}"
echo "  Linkability issues: ${#PAGES_ISSUES[@]}"

# ============================================================================
# PHASE 03: INTERNAL LINK INTEGRITY
# ============================================================================

echo ""
echo " [03] Checking offline linkability (Pages-safe)..."

# First, regenerate trust facts to ensure mirror docs are up-to-date
echo "  Regenerating trust facts..."
if ! timeout 120 bash "$SCRIPT_DIR/regenerate_trust_facts.sh" > "$E/03_links/regenerate_trust_facts.log" 2>&1; then
  TIMEOUT_EXIT=$?
  if [ $TIMEOUT_EXIT -eq 124 ]; then
    echo "FAIL: Trust facts regeneration timed out after 120 seconds"
    echo "This typically indicates the code_refs_inventory.md generation is scanning too many files."
    echo "Check $E/03_links/regenerate_trust_facts.log for details."
  else
    echo "FAIL: Trust facts regeneration failed"
    cat "$E/03_links/regenerate_trust_facts.log"
  fi
  echo "REJECT" > "$E/05_verdict/VERDICT.txt"
  echo "Trust facts regeneration failed or timed out" >> "$E/05_verdict/VERDICT.txt"
  exit 1
fi

# Run comprehensive offline linkability check
echo "  Running offline link checker..."
LINKCHECK_DIR="$E/03_links"
if ! bash "$SCRIPT_DIR/build_docs_site_offline.sh" "$LINKCHECK_DIR" > "$E/03_links/linkability_check.log" 2>&1; then
  echo "FAIL: Linkability check failed"
  cat "$E/03_links/linkability_check.log"
  echo "REJECT" > "$E/05_verdict/VERDICT.txt"
  echo "Linkability check failed - see $LINKCHECK_DIR/05_links/link_report.txt" >> "$E/05_verdict/VERDICT.txt"
  exit 1
fi

# Check verdict
LINK_VERDICT="$LINKCHECK_DIR/05_links/VERDICT.txt"
if [[ ! -f "$LINK_VERDICT" ]]; then
  echo "FAIL: Link checker did not produce VERDICT.txt"
  echo "REJECT" > "$E/05_verdict/VERDICT.txt"
  echo "Missing VERDICT.txt from linkability check" >> "$E/05_verdict/VERDICT.txt"
  exit 1
fi

LINK_STATUS=$(cat "$LINK_VERDICT")
if [[ "$LINK_STATUS" != "PASS" ]]; then
  echo "FAIL: Linkability check status = $LINK_STATUS (expected PASS)"
  echo "Broken links detected - see $LINKCHECK_DIR/05_links/link_report.txt"
  
  # Show first 30 broken links for diagnosis
  echo ""
  echo "First 30 broken links:"
  head -40 "$LINKCHECK_DIR/05_links/link_report.txt" | tail -30
  
  echo "REJECT" > "$E/05_verdict/VERDICT.txt"
  echo "Linkability check failed: $LINK_STATUS" >> "$E/05_verdict/VERDICT.txt"
  echo "See: $LINKCHECK_DIR/05_links/link_report.txt" >> "$E/05_verdict/VERDICT.txt"
  exit 1
fi

LINK_REPORT="$LINKCHECK_DIR/05_links/link_report.txt"
BROKEN_COUNT=$(grep "^Broken links:" "$LINK_REPORT" 2>/dev/null | awk '{print $3}' || echo "unknown")
ANCHOR_WARNINGS=$(grep "^Anchor warnings:" "$LINK_REPORT" 2>/dev/null | awk '{print $3}' || echo "0")

echo "  ✓ Linkability: PASS"
echo "    - Broken links: $BROKEN_COUNT"
echo "    - Anchor warnings: $ANCHOR_WARNINGS (non-fatal)"
echo "    - Report: $LINK_REPORT"

# Ensure counts are single-line numeric values

# ============================================================================
# PHASE 04: CONTENT COMPLETENESS
# ============================================================================

echo ""
echo "[04] Checking content completeness..."

CONTENT_REPORT="$E/04_content/content_report.txt"
declare -a CONTENT_ISSUES=()

# Required headings per doc type
declare -A REQUIRED_HEADINGS=(
  ["privacy-policy.md"]="Data we access|Why we access it|Data retention|Data deletion|Contact"
  ["security.md"]="Security controls|Data isolation|Encryption|Logging|Responsible disclosure"
  ["vulnerability-disclosure.md"]="How to report|Response timeline|Safe harbor"
  ["subprocessors.md"]="Subprocessors|Purpose|Location|Updates"
  ["data-retention-deletion.md"]="Retention periods|Deletion process|Customer request"
  ["support-sla.md"]="Support channels|Response times|Escalation"
  ["incident-response.md"]="Incident classification|Customer notification|Post-incident review"
  ["data-processing.md"]="Data flow|Storage locations|Processing purposes"
  ["access-scope-and-permissions.md"]="Forge scopes|Read-only guarantees|network|external"
)

# Forbidden tokens
FORBIDDEN_TOKENS=("TODO" "TBD" "PLACEHOLDER" "FILL_ME" "XXX" "coming soon")

for doc in "${REQUIRED_DOCS[@]}"; do
  DOC_PATH="$REPO_ROOT/$doc"
  [[ ! -f "$DOC_PATH" ]] && continue
  
  DOC_NAME="$(basename "$doc")"
  echo "Checking $doc..." >> "$CONTENT_REPORT"
  
  # Check H1 heading
  if ! grep -qP '^#\s+' "$DOC_PATH"; then
    echo "  FAIL: No H1 heading found" >> "$CONTENT_REPORT"
    CONTENT_ISSUES+=("$doc: missing H1 heading")
  fi
  
  # Check "Last updated:" line
  if ! grep -qiP 'last updated:?\s*\d{4}-\d{2}-\d{2}' "$DOC_PATH"; then
    echo "  FAIL: No 'Last updated: YYYY-MM-DD' found" >> "$CONTENT_REPORT"
    CONTENT_ISSUES+=("$doc: missing 'Last updated: YYYY-MM-DD'")
  fi
  
  # Check forbidden tokens
  for token in "${FORBIDDEN_TOKENS[@]}"; do
    if grep -qi "$token" "$DOC_PATH"; then
      echo "  FAIL: Found forbidden token: $token" >> "$CONTENT_REPORT"
      CONTENT_ISSUES+=("$doc: contains '$token'")
    fi
  done
  
  # Check required headings
  if [[ -n "${REQUIRED_HEADINGS[$DOC_NAME]:-}" ]]; then
    IFS='|' read -ra HEADINGS <<< "${REQUIRED_HEADINGS[$DOC_NAME]}"
    for heading in "${HEADINGS[@]}"; do
      if ! grep -qiP "^#+\s+.*$heading" "$DOC_PATH"; then
        echo "  FAIL: Missing required heading: $heading" >> "$CONTENT_REPORT"
        CONTENT_ISSUES+=("$doc: missing heading '$heading'")
      fi
    done
  fi
  
  echo "  Done" >> "$CONTENT_REPORT"
done

# Generate JSON
CONTENT_ISSUES_JSON='[]'
if [[ ${#CONTENT_ISSUES[@]} -gt 0 ]]; then
  CONTENT_ISSUES_JSON=$(printf '%s\n' "${CONTENT_ISSUES[@]}" | jq -R . | jq -s .)
fi
jq -n \
  --argjson issues "$CONTENT_ISSUES_JSON" \
  '{issues: $issues, content_completeness_pass: ($issues | length == 0)}' \
  > "$E/artifacts/PACK_CONTENT.json"

echo "  Content issues: ${#CONTENT_ISSUES[@]}"

# ============================================================================
# PHASE 04B: CONFIG & GENERATED FACTS VALIDATION
# ============================================================================

echo ""
echo "[04B] Checking required config files and generated facts..."

CONFIG_REPORT="$E/04_content/config_report.txt"
declare -a CONFIG_ISSUES=()

# Check CONTACTS.json
CONTACTS_FILE="$REPO_ROOT/docs/trust/CONTACTS.json"
if [[ ! -f "$CONTACTS_FILE" ]]; then
  echo "FAIL: CONTACTS.json missing" >> "$CONFIG_REPORT"
  CONFIG_ISSUES+=("CONTACTS.json not found - run regenerate_trust_facts.sh")
else
  # Verify contacts pass validation
  if ! bash "$SCRIPT_DIR/verify_contacts.sh" "$E" >> "$CONFIG_REPORT" 2>&1; then
    CONFIG_ISSUES+=("CONTACTS.json validation failed - fill with real emails")
  else
    echo "PASS: CONTACTS.json valid" >> "$CONFIG_REPORT"
  fi
fi

# Check RETENTION_POLICY.json
RETENTION_FILE="$REPO_ROOT/docs/trust/RETENTION_POLICY.json"
if [[ ! -f "$RETENTION_FILE" ]]; then
  echo "FAIL: RETENTION_POLICY.json missing" >> "$CONFIG_REPORT"
  CONFIG_ISSUES+=("RETENTION_POLICY.json not found")
else
  # Verify retention policy
  if ! bash "$SCRIPT_DIR/verify_retention_policy.sh" "$E" >> "$CONFIG_REPORT" 2>&1; then
    CONFIG_ISSUES+=("RETENTION_POLICY.json validation failed")
  else
    echo "PASS: RETENTION_POLICY.json valid" >> "$CONFIG_REPORT"
  fi
fi

# Check for GENERATED_FACTS markers in required docs
MARKER_START="<!-- BEGIN: GENERATED_FACTS -->"
MARKER_END="<!-- END: GENERATED_FACTS -->"

for doc in "docs/trust/access-scope-and-permissions.md" \
           "docs/trust/security.md" \
           "docs/trust/privacy-policy.md" \
           "docs/trust/vulnerability-disclosure.md" \
           "docs/trust/support-sla.md" \
           "docs/trust/data-retention-deletion.md" \
           "docs/trust/data-processing.md"; do
  DOC_PATH="$REPO_ROOT/$doc"
  [[ ! -f "$DOC_PATH" ]] && continue
  
  if ! grep -q "$MARKER_START" "$DOC_PATH"; then
    echo "FAIL: $doc missing GENERATED_FACTS markers" >> "$CONFIG_REPORT"
    CONFIG_ISSUES+=("$doc: missing GENERATED_FACTS markers - run regenerate_trust_facts.sh")
  else
    echo "PASS: $doc has GENERATED_FACTS markers" >> "$CONFIG_REPORT"
  fi
done

# Forbid placeholders in trust docs
TRUST_PLACEHOLDER_PATTERNS=("example\.com" "hooks\.slack\.com" "TODO" "TBD" "FIXME" "coming soon")
for doc in "${REQUIRED_DOCS[@]}"; do
  DOC_PATH="$REPO_ROOT/$doc"
  [[ ! -f "$DOC_PATH" ]] && continue
  
  # Skip GENERATED_FACTS blocks (they may contain evidence references)
  TEMP_DOC=$(mktemp)
  # Remove GENERATED_FACTS blocks before checking
  perl -0pe "s/\Q$MARKER_START\E.*?\Q$MARKER_END\E//gs" "$DOC_PATH" > "$TEMP_DOC"
  
  for pattern in "${TRUST_PLACEHOLDER_PATTERNS[@]}"; do
    if grep -qE "$pattern" "$TEMP_DOC"; then
      echo "FAIL: $doc contains placeholder: $pattern" >> "$CONFIG_REPORT"
      CONFIG_ISSUES+=("$doc: contains '$pattern' outside GENERATED_FACTS")
    fi
  done
  
  rm "$TEMP_DOC"
done

# Generate JSON
CONFIG_ISSUES_JSON='[]'
if [[ ${#CONFIG_ISSUES[@]} -gt 0 ]]; then
  CONFIG_ISSUES_JSON=$(printf '%s\n' "${CONFIG_ISSUES[@]}" | jq -R . | jq -s .)
fi
jq -n \
  --argjson issues "$CONFIG_ISSUES_JSON" \
  '{issues: $issues, config_pass: ($issues | length == 0)}' \
  > "$E/artifacts/PACK_CONFIG.json"

echo "  Config issues: ${#CONFIG_ISSUES[@]}"

# ============================================================================
# PHASE 05: FINAL VERDICT
# ============================================================================

echo ""
echo "[05] Generating final verdict..."

TOTAL_FAILURES=0
VERDICT_FILE="$E/05_verdict/VERDICT.txt"

# Count failures
if [[ ${#MISSING[@]} -gt 0 ]]; then
  ((TOTAL_FAILURES+=1))
fi
if [[ ${#PAGES_ISSUES[@]} -gt 0 ]]; then
  ((TOTAL_FAILURES+=1))
fi
if [[ $BROKEN_COUNT -gt 0 ]] || [[ $INSECURE_COUNT -gt 0 ]]; then
  ((TOTAL_FAILURES+=1))
fi
if [[ ${#CONTENT_ISSUES[@]} -gt 0 ]]; then
  ((TOTAL_FAILURES+=1))
fi
if [[ ${#CONFIG_ISSUES[@]} -gt 0 ]]; then
  ((TOTAL_FAILURES+=1))
fi

if [[ $TOTAL_FAILURES -gt 0 ]]; then
  echo "REJECT" > "$VERDICT_FILE"
  echo "" >> "$VERDICT_FILE"
  echo "Marketplace Pack Verification: REJECT" >> "$VERDICT_FILE"
  echo "Total failure categories: $TOTAL_FAILURES" >> "$VERDICT_FILE"
  echo "" >> "$VERDICT_FILE"
  
  if [[ ${#MISSING[@]} -gt 0 ]]; then
    echo "MISSING DOCS (${#MISSING[@]}):" >> "$VERDICT_FILE"
    printf '  - %s\n' "${MISSING[@]}" >> "$VERDICT_FILE"
    echo "" >> "$VERDICT_FILE"
  fi
  
  if [[ ${#PAGES_ISSUES[@]} -gt 0 ]]; then
    echo "PAGES ISSUES (${#PAGES_ISSUES[@]}):" >> "$VERDICT_FILE"
    printf '  - %s\n' "${PAGES_ISSUES[@]}" >> "$VERDICT_FILE"
    echo "" >> "$VERDICT_FILE"
  fi
  
  if [[ $BROKEN_COUNT -gt 0 ]] || [[ $INSECURE_COUNT -gt 0 ]]; then
    echo "LINK ISSUES ($((BROKEN_COUNT + INSECURE_COUNT))):" >> "$VERDICT_FILE"
    echo "  See: $E/03_links/link_report.txt" >> "$VERDICT_FILE"
    echo "" >> "$VERDICT_FILE"
  fi
  
  if [[ ${#CONTENT_ISSUES[@]} -gt 0 ]]; then
    echo "CONTENT ISSUES (${#CONTENT_ISSUES[@]}):" >> "$VERDICT_FILE"
    printf '  - %s\n' "${CONTENT_ISSUES[@]}" >> "$VERDICT_FILE"
    echo "" >> "$VERDICT_FILE"
  fi
  
  if [[ ${#CONFIG_ISSUES[@]} -gt 0 ]]; then
    echo "CONFIG ISSUES (${#CONFIG_ISSUES[@]}):" >> "$VERDICT_FILE"
    printf '  - %s\n' "${CONFIG_ISSUES[@]}" >> "$VERDICT_FILE"
    echo "" >> "$VERDICT_FILE"
  fi
  
  echo "REMEDIATION:" >> "$VERDICT_FILE"
  echo "1. Create missing docs in docs/trust/ with required structure" >> "$VERDICT_FILE"
  echo "2. Add links to navigation files (mkdocs.yml or docs/README.md)" >> "$VERDICT_FILE"
  echo "3. Fix broken internal links (see link_report.txt)" >> "$VERDICT_FILE"
  echo "4. Remove TODO/PLACEHOLDER/XXX tokens from docs" >> "$VERDICT_FILE"
  echo "5. Add missing required headings (see content_report.txt)" >> "$VERDICT_FILE"
  
  cat "$VERDICT_FILE"
  echo ""
  echo "Evidence: $E"
  echo "Stable symlink: /tmp/ft_marketplace_pack_latest"
  exit 1
else
  echo "PASS" > "$VERDICT_FILE"
  echo "" >> "$VERDICT_FILE"
  echo "✓ All required docs present (${#PRESENT[@]})" >> "$VERDICT_FILE"
  echo "✓ Navigation linkability verified" >> "$VERDICT_FILE"
  echo "✓ Internal links integrity verified" >> "$VERDICT_FILE"
  echo "✓ Content completeness verified" >> "$VERDICT_FILE"
  echo "✓ Config & generated facts verified" >> "$VERDICT_FILE"
  echo "" >> "$VERDICT_FILE"
  
  # Detect GitHub Pages base URL
  PAGES_BASE_URL=""
  if [[ -f "$REPO_ROOT/mkdocs.yml" ]]; then
    PAGES_BASE_URL=$(grep -oP 'site_url:\s*\K\S+' "$REPO_ROOT/mkdocs.yml" 2>/dev/null || echo "")
  fi
  
  if [[ -n "$PAGES_BASE_URL" ]]; then
    echo "MARKETPLACE URLS (pasteable):" >> "$VERDICT_FILE"
    for doc in "${REQUIRED_DOCS[@]}"; do
      REL_PATH="${doc#docs/}"
      DOC_URL="$PAGES_BASE_URL/$REL_PATH"
      echo "  - $(basename "$doc"): $DOC_URL" >> "$VERDICT_FILE"
    done
  else
    echo "RELATIVE PATHS (GitHub Pages base URL not detected):" >> "$VERDICT_FILE"
    echo "Set site_url in mkdocs.yml or docs config for absolute URLs" >> "$VERDICT_FILE"
    for doc in "${REQUIRED_DOCS[@]}"; do
      echo "  - $doc" >> "$VERDICT_FILE"
    done
  fi
  
  cat "$VERDICT_FILE"
  echo ""
  echo "Evidence: $E"
  echo "Stable symlink: /tmp/ft_marketplace_pack_latest"
  echo ""
  echo "✓ MARKETPLACE PACK VERIFICATION: PASS"
  exit 0
fi
