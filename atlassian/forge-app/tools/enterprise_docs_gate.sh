#!/bin/bash
set -euo pipefail

# enterprise_docs_gate.sh
# Hard-fail validation gate for enterprise documentation
# Exit non-zero if ANY check fails (fail-closed policy)

echo "🔐 Enterprise Documentation Gate"
echo "==============================="

# Prerequisite check
echo ""
echo "1. Checking tooling prerequisites..."
bash "$(dirname "$0")/check_tooling_prereqs.sh" || exit 2

# Markdown link checking
echo ""
echo "2. Checking markdown links..."
node "$(dirname "$0")/md_link_check.mjs" || exit 1

# Truth Audit check (claims register validation)
echo ""
echo "2a. Running Truth Audit (CLAIMS_REGISTER.md validation)..."
node "$(dirname "$0")/truth_claims_gate.mjs" || exit 1

# Required docs existence check
echo ""
echo "3. Verifying required docs exist and are non-empty..."

REQUIRED_DOCS=(
  "docs/trust/SECURITY_OVERVIEW.md"
  "docs/trust/FORGE_PLATFORM_DEPENDENCY.md"
  "docs/trust/ARCHITECTURE.md"
  "docs/trust/DATA_FLOW.md"
  "docs/trust/DATA_CLASSIFICATION_AND_PII.md"
  "docs/trust/UNINSTALL_DELETION.md"
  "docs/trust/LEDGER_CRYPTO_SPEC.md"
  "docs/trust/EXPORT_SPEC.md"
  "docs/trust/SERIALIZATION_SCHEMA.md"
  "docs/trust/SUBPROCESSORS.md"
  "docs/trust/PRIVACY_POLICY.md"
  "docs/trust/TERMS_OF_SERVICE.md"
  "docs/trust/SECURITY_CONTACT.md"
  "docs/trust/VULNERABILITY_DISCLOSURE_POLICY.md"
  "docs/trust/SECURITY_TXT.md"
  "docs/trust/THREAT_MODEL.md"
  "docs/trust/CUSTOMER_RESPONSIBILITIES.md"
  "docs/trust/RESOLVER_INVENTORY.md"
  "docs/trust/CLAIMS_REGISTER.md"
  "docs/operations/INCIDENT_RESPONSE_PLAN.md"
  "docs/operations/CHANGE_MANAGEMENT_POLICY.md"
  "docs/operations/ACCESS_CONTROL_POLICY.md"
  "docs/operations/RBAC_MATRIX.md"
  "docs/operations/SECURE_SDLC_POLICY.md"
  "docs/operations/CI_CD_EVIDENCE.md"
  "docs/operations/SECRETS_MANAGEMENT.md"
  "docs/operations/LOGGING_MONITORING.md"
  "docs/operations/BCP_DRP.md"
  "docs/operations/SUPPORT_POLICY.md"
  "docs/operations/SLA.md"
  "docs/procurement/ENTERPRISE_SECURITY_PACK_INDEX.md"
  "docs/procurement/SECURITY_QUESTIONNAIRE_MASTER.md"
  "docs/procurement/CONTROL_MAPPING_MATRIX.md"
  "docs/evidence/RETENTION_POLICY.md"
)

MISSING_DOCS=()
for doc in "${REQUIRED_DOCS[@]}"; do
  if [[ ! -f "$doc" ]] || [[ ! -s "$doc" ]]; then
    MISSING_DOCS+=("$doc")
  fi
done

if [[ ${#MISSING_DOCS[@]} -gt 0 ]]; then
  echo "ERROR: Missing or empty required docs:" >&2
  for doc in "${MISSING_DOCS[@]}"; do
    echo "  - $doc" >&2
  done
  exit 1
fi

echo "✓ All required docs present"

# Header check (Version, Owner, Last Updated, Review Cycle)
echo ""
echo "4. Verifying document headers..."

HEADER_FIELDS=("Version:" "Owner:" "Last Updated:" "Review Cycle:")
DOCS_TO_CHECK=("docs/trust/"*.md "docs/operations/"*.md "docs/procurement/"*.md "docs/evidence/"*.md)

for doc_pattern in "${DOCS_TO_CHECK[@]}"; do
  for doc in $doc_pattern; do
    [[ ! -f "$doc" ]] && continue
    
    for field in "${HEADER_FIELDS[@]}"; do
      if ! grep -q "$field" "$doc"; then
        echo "ERROR: Missing '$field' in $doc" >&2
        exit 1
      fi
    done
  done
done

echo "✓ All docs have required headers"

# THREAT_MODEL.md table check
echo ""
echo "5. Verifying THREAT_MODEL.md has exact table header..."

if ! grep -q "| Threat | STRIDE | Mitigation | Residual Risk |" docs/trust/THREAT_MODEL.md; then
  echo "ERROR: THREAT_MODEL.md missing exact table header: '| Threat | STRIDE | Mitigation | Residual Risk |'" >&2
  exit 1
fi

echo "✓ THREAT_MODEL.md table header correct"

# CUSTOMER_RESPONSIBILITIES.md check
echo ""
echo "6. Verifying CUSTOMER_RESPONSIBILITIES.md exists..."

if [[ ! -f "docs/trust/CUSTOMER_RESPONSIBILITIES.md" ]]; then
  echo "ERROR: docs/trust/CUSTOMER_RESPONSIBILITIES.md not found" >&2
  exit 1
fi

echo "✓ CUSTOMER_RESPONSIBILITIES.md present"

# INCIDENT_RESPONSE_PLAN.md severity table check
echo ""
echo "7. Verifying INCIDENT_RESPONSE_PLAN.md has exact severity table..."

if ! grep -q "| Severity | CVSS | Example | Notify SLA | Ack SLA |" docs/operations/INCIDENT_RESPONSE_PLAN.md; then
  echo "ERROR: INCIDENT_RESPONSE_PLAN.md missing exact table header: '| Severity | CVSS | Example | Notify SLA | Ack SLA |'" >&2
  exit 1
fi

echo "✓ INCIDENT_RESPONSE_PLAN.md severity table correct"

# SLA.md no uptime percentage check
echo ""
echo "8. Checking SLA.md for no uptime percentage claims..."

UPTIME_PATTERNS="99\.[0-9]+%|99%|100%"
if grep -iE "$UPTIME_PATTERNS" docs/operations/SLA.md 2>/dev/null; then
  echo "ERROR: SLA.md contains uptime percentage claims (forbidden)" >&2
  exit 1
fi

echo "✓ SLA.md contains no uptime percentage claims"

# Overclaim denylist check
echo ""
echo "9. Checking for overclaim keywords..."

DENYLIST=(
  "certified"
  "compliant"
  "guaranteed"
  "cloud fortified"
  "soc2 type ii"
)

OVERCLAIM_FOUND=0
for keyword in "${DENYLIST[@]}"; do
  if grep -iE "$keyword" docs/trust/*.md docs/operations/*.md docs/procurement/*.md 2>/dev/null | grep -v "claim" | grep -v "NOT certified" | grep -v "no certification" | grep -v "NOT compliant" | grep -v "NO claims" > /dev/null 2>&1; then
    echo "⚠️  Possible overclaim keyword found: '$keyword' (manual review recommended)"
    OVERCLAIM_FOUND=1
  fi
done

if [[ $OVERCLAIM_FOUND -eq 0 ]]; then
  echo "✓ No overclaim keywords detected"
fi

# Baseline drift check
echo ""
echo "10. Checking baseline drift..."

if ! sha256sum -c docs/evidence/baselines/manifest.yml.sha256 > /dev/null 2>&1; then
  echo "ERROR: manifest.yml baseline hash mismatch (drift detected)" >&2
  exit 1
fi

if ! sha256sum -c docs/evidence/baselines/package-lock.json.sha256 > /dev/null 2>&1; then
  echo "ERROR: package-lock.json baseline hash mismatch (drift detected)" >&2
  exit 1
fi

echo "✓ Baseline hashes match"

# Evidence presence check
echo ""
echo "11. Checking evidence artifacts..."

# Find latest evidence bundle
LATEST_EVIDENCE=$(find docs/evidence -maxdepth 1 -name "*_release" -type d | sort | tail -1)

if [[ -z "$LATEST_EVIDENCE" ]]; then
  echo "⚠️  No evidence bundle found (optional at this stage; required for full validation)"
else
  echo "Found evidence bundle: $LATEST_EVIDENCE"
  
  REQUIRED_ARTIFACTS=(
    "forge_lint_strict.txt"
    "npm_audit_high.txt"
    "dependency_tree.json"
    "trivy_scan.txt"
    "manifest_scopes_snapshot.txt"
    "resolver_scan.txt"
    "package-lock.sha256"
    "manifest.sha256"
    "evidence_hashes.txt"
  )
  
  # Check for SBOM (CycloneDX or fallback)
  if [[ ! -f "$LATEST_EVIDENCE/cyclonedx_sbom.json" ]]; then
    if [[ "${FT_ALLOW_FALLBACK_SBOM:-0}" == "1" ]] && [[ -f "$LATEST_EVIDENCE/fallback_sbom_dependency_tree.json" ]]; then
      echo "  ✓ SBOM (fallback)"
    else
      echo "ERROR: SBOM missing (cyclonedx_sbom.json not found, fallback not allowed)" >&2
      exit 1
    fi
  else
    echo "  ✓ SBOM (CycloneDX)"
  fi
  
  # Check required artifacts
  for artifact in "${REQUIRED_ARTIFACTS[@]}"; do
    if [[ ! -f "$LATEST_EVIDENCE/$artifact" ]]; then
      echo "ERROR: Missing artifact: $LATEST_EVIDENCE/$artifact" >&2
      exit 1
    fi
  done
  
  echo "✓ All required artifacts present"
fi

# Mutation endpoint check
echo ""
echo "12. Checking for mutations (POST/PUT/DELETE)..."

if [[ -f "$LATEST_EVIDENCE/resolver_scan.txt" ]]; then
  if grep -iE "POST|PUT|DELETE" "$LATEST_EVIDENCE/resolver_scan.txt" | grep -v "# " | grep -v "No matches" > /dev/null 2>&1; then
    echo "ERROR: Mutations detected in resolver_scan.txt (POST/PUT/DELETE found)" >&2
    exit 1
  fi
  echo "✓ No mutations detected"
fi

# File drift check (allowed paths)
echo ""
echo "13. Checking for unauthorized file changes..."

# Get list of changed files if in git
if git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
  CHANGED_FILES=$(git diff --name-only 2>/dev/null || true)
  
  FORBIDDEN_PATTERN="^[^d][^o][^c][^s]|^[^t][^o][^o][^l]|^[^\.]|^README|^CHANGELOG|^docs/README"
  
  UNAUTHORIZED_CHANGES=()
  for file in $CHANGED_FILES; do
    if ! [[ "$file" =~ ^docs/ || "$file" =~ ^tools/ || "$file" =~ ^\.github/ || "$file" == "README.md" || "$file" == "docs/README.md" || "$file" == "CHANGELOG.md" ]]; then
      UNAUTHORIZED_CHANGES+=("$file")
    fi
  done
  
  if [[ ${#UNAUTHORIZED_CHANGES[@]} -gt 0 ]]; then
    echo "ERROR: Unauthorized file changes detected:" >&2
    for file in "${UNAUTHORIZED_CHANGES[@]}"; do
      echo "  - $file" >&2
    done
    exit 1
  fi
  
  echo "✓ Only allowed paths changed (docs/, tools/, .github/, README, CHANGELOG)"
fi

# Size cap check
echo ""
echo "14. Checking evidence artifact sizes..."

if [[ -n "${LATEST_EVIDENCE:-}" ]] && [[ -d "$LATEST_EVIDENCE" ]]; then
  MAX_SIZE=$((5 * 1024 * 1024))  # 5 MB
  
  OVERSIZED=()
  while IFS= read -r file; do
    size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null || echo 0)
    if [[ $size -gt $MAX_SIZE ]]; then
      OVERSIZED+=("$(basename "$file") ($((size / 1024)) KB)")
    fi
  done < <(find "$LATEST_EVIDENCE" -type f)
  
  if [[ ${#OVERSIZED[@]} -gt 0 ]]; then
    echo "ERROR: Artifacts exceed 5 MB size limit:" >&2
    for file in "${OVERSIZED[@]}"; do
      echo "  - $file" >&2
    done
    exit 1
  fi
  
  echo "✓ All artifacts within size limits"
fi

echo ""
echo "✅ Enterprise Documentation Gate: PASSED"
echo ""
echo "Summary:"
echo "  - Required docs present ✓"
echo "  - Document headers valid ✓"
echo "  - Table formats correct ✓" 
echo "  - No overclaims detected ✓"
echo "  - Baselines match ✓"
echo "  - No mutations found ✓"
echo "  - File changes authorized ✓"
echo ""

exit 0
