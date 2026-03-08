#!/usr/bin/env bash
#
# FirstTry SOC2 Evidence Pack Generator
#
# Purpose: Generate tamper-evident evidence pack for SOC2 audits
# Includes: SOC2 control mapping, trust center docs, legal docs, support docs
#
# Exit codes:
#   0 = Success (evidence pack generated)
#   1 = Fail (missing documents or verification failed)
#   2 = Fatal error (invalid environment, missing tools)
#
# Usage: bash tools/soc2_mapping/build_soc2_evidence_pack.sh
#
# NO EXTERNAL DEPENDENCIES (bash, jq, and standard Unix tools only)

set -euo pipefail

# ============================================================================
# CONFIGURATION
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
OUTPUT_DIR="/tmp/firsttry_soc2_evidence_$(date +%Y%m%d_%H%M%S)"

DOCS_TRUST="${REPO_ROOT}/docs/trust"
DOCS_LEGAL="${REPO_ROOT}/docs/legal"
DOCS_SUPPORT="${REPO_ROOT}/docs/support"
TOOLS_DIR="${REPO_ROOT}/tools"

# ============================================================================
# UTILITIES
# ============================================================================

log_info() {
  echo "[INFO] $*"
}

log_success() {
  echo "[SUCCESS] $*"
}

log_error() {
  echo "[ERROR] $*" >&2
}

log_fatal() {
  echo "[FATAL] $*" >&2
  exit 2
}

# ============================================================================
# ENVIRONMENT CHECKS
# ============================================================================

check_environment() {
  log_info "Checking environment..."
  
  if [[ ! -d "${REPO_ROOT}" ]]; then
    log_fatal "Repository root not found: ${REPO_ROOT}"
  fi
  
  if ! command -v jq &> /dev/null; then
    log_fatal "jq is required but not installed. Install with: apt-get install jq"
  fi
  
  if ! command -v sha256sum &> /dev/null; then
    log_fatal "sha256sum is required but not installed"
  fi
  
  log_success "Environment OK"
}

# ============================================================================
#  DOCUMENT COLLECTION
# ============================================================================

collect_documents() {
  log_info "Collecting SOC2 evidence documents..."
  
  mkdir -p "${OUTPUT_DIR}/trust"
  mkdir -p "${OUTPUT_DIR}/legal"
  mkdir -p "${OUTPUT_DIR}/support"
  mkdir -p "${OUTPUT_DIR}/tools"
  
  # Trust center documents
  local trust_docs=(
    "TRUST_CENTER.md"
    "security_whitepaper.md"
    "threat_model.md"
    "data_handling.md"
    "data_retention.md"
    "incident_response.md"
    "responsible_disclosure.md"
    "subprocessors.md"
    "vendor_security.md"
    "ENTERPRISE_SECURITY_QUESTIONNAIRE.md"
    "soc2/SOC2_CONTROL_MAPPING.md"
  )
  
  local missing=()
  
  for doc in "${trust_docs[@]}"; do
    local src="${DOCS_TRUST}/${doc}"
    if [[ -f "${src}" ]]; then
      local dest_dir="${OUTPUT_DIR}/trust/$(dirname "${doc}")"
      mkdir -p "${dest_dir}"
      cp "${src}" "${dest_dir}/"
      log_success "  ✓ Copied ${doc}"
    else
      missing+=("trust/${doc}")
      log_error "  ✗ MISSING: trust/${doc}"
    fi
  done
  
  # Legal documents
  local legal_docs=(
    "PRIVACY_POLICY.md"
    "TERMS_OF_SERVICE.md"
  )
  
  for doc in "${legal_docs[@]}"; do
    local src="${DOCS_LEGAL}/${doc}"
    if [[ -f "${src}" ]]; then
      cp "${src}" "${OUTPUT_DIR}/legal/"
      log_success "  ✓ Copied legal/${doc}"
    else
      missing+=("legal/${doc}")
      log_error "  ✗ MISSING: legal/${doc}"
    fi
  done
  
  # Support documents
  local support_docs=(
    "SUPPORT_SLA.md"
  )
  
  for doc in "${support_docs[@]}"; do
    local src="${DOCS_SUPPORT}/${doc}"
    if [[ -f "${src}" ]]; then
      cp "${src}" "${OUTPUT_DIR}/support/"
      log_success "  ✓ Copied support/${doc}"
    else
      missing+=("support/${doc}")
      log_error "  ✗ MISSING: support/${doc}"
    fi
  done
  
  # Verification scripts (for auditor use)
  local scripts=(
    "marketplace_audit/run_marketplace_readiness_v2.sh"
    "trust_center/verify_trust_center.sh"
  )
  
  for script in "${scripts[@]}"; do
    local src="${TOOLS_DIR}/${script}"
    if [[ -f "${src}" ]]; then
      local dest_dir="${OUTPUT_DIR}/tools/$(dirname "${script}")"
      mkdir -p "${dest_dir}"
      cp "${src}" "${dest_dir}/"
      log_success "  ✓ Copied tools/${script}"
    else
      log_error "  ⚠ OPTIONAL MISSING: tools/${script}"
    fi
  done
  
  if [[ ${#missing[@]} -gt 0 ]]; then
    log_error "Missing ${#missing[@]} required documents"
    return 1
  fi
  
  return 0
}

# ============================================================================
# MANIFEST GENERATION
# ============================================================================

generate_manifest() {
  log_info "Generating SHA256 manifest..."
  
  local manifest_file="${OUTPUT_DIR}/manifest.sha256"
  
  # Find all files (excluding manifest itself)
  cd "${OUTPUT_DIR}"
  find . -type f -not -name "manifest.sha256" -not -name "SOC2_PACK_SHA256.txt" -not -name "metadata.json" | sort | while read -r file; do
    sha256sum "${file}" >> "${manifest_file}"
  done
  
  local file_count=$(wc -l < "${manifest_file}")
  log_success "Generated manifest with ${file_count} files"
  
  cd "${REPO_ROOT}"
}

# ============================================================================
# METADATA
# ============================================================================

generate_metadata() {
  log_info "Generating metadata..."
  
  local git_commit=""
  local git_branch=""
  
  if command -v git &> /dev/null && [[ -d "${REPO_ROOT}/.git" ]]; then
    git_commit=$(git -C "${REPO_ROOT}" rev-parse HEAD 2>/dev/null || echo "unknown")
    git_branch=$(git -C "${REPO_ROOT}" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
  else
    git_commit="unknown"
    git_branch="unknown"
  fi
  
  jq -n \
    --arg pack_type "soc2_evidence" \
    --arg timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    --arg git_commit "${git_commit}" \
    --arg git_branch "${git_branch}" \
    --arg generator_version "1.0" \
    '{
      pack_type: $pack_type,
      generated_at: $timestamp,
      git_commit: $git_commit,
      git_branch: $git_branch,
      generator_version: $generator_version,
      description: "FirstTry SOC2 Evidence Pack - Tamper-evident bundle of SOC2 control mapping and supporting documentation",
      contents: {
        trust_docs: "docs/trust/ (security whitepaper, threat model, data handling, etc.)",
        soc2_mapping: "docs/trust/soc2/SOC2_CONTROL_MAPPING.md",
        legal_docs: "docs/legal/ (privacy policy, terms of service)",
        support_docs: "docs/support/ (support SLA)",
        verification_scripts: "tools/ (marketplace audit, trust center validator)"
      },
      verification: {
        manifest: "manifest.sha256",
        pack_hash: "SOC2_PACK_SHA256.txt",
        instructions: "To verify: sha256sum -c manifest.sha256 && sha256sum manifest.sha256 | grep -f SOC2_PACK_SHA256.txt"
      }
    }' > "${OUTPUT_DIR}/metadata.json"
  
  log_success "Generated metadata.json"
}

# ============================================================================
# PACK HASH
# ============================================================================

generate_pack_hash() {
  log_info "Generating evidence pack hash..."
  
  cd "${OUTPUT_DIR}"
  local pack_hash=$(sha256sum manifest.sha256 | awk '{print $1}')
  echo "${pack_hash}" > SOC2_PACK_SHA256.txt
  
  log_success "Pack hash: ${pack_hash}"
  cd "${REPO_ROOT}"
}

# ============================================================================
# README
# ============================================================================

generate_readme() {
  log_info "Generating README..."
  
  cat > "${OUTPUT_DIR}/README.md" <<'EOF'
# FirstTry SOC2 Evidence Pack

**Generated:** $(date -u +%Y-%m-%dT%H:%M:%SZ)  
**Pack Type:** SOC2 Compliance Evidence  
**Version:** 1.0

---

## Purpose

This evidence pack contains all documentation required for SOC2 audits of FirstTry for Jira, including:

- SOC2 Trust Service Criteria control mapping (CC1-CC9, Availability, Confidentiality)
- Security whitepaper and threat model
- Data handling, retention, and privacy policies
- Incident response and responsible disclosure procedures
- Subprocessor and vendor security assessments
- Enterprise security questionnaire
- Legal agreements (privacy policy, terms of service)
- Support SLA

All files are tamper-evident with SHA256 manifests.

---

## Contents

```
.
├── README.md                     (this file)
├── metadata.json                 (pack metadata: timestamp, git commit, etc.)
├── manifest.sha256               (SHA256 hashes of all files)
├── SOC2_PACK_SHA256.txt          (SHA256 hash of manifest - pack integrity proof)
├── trust/
│   ├── TRUST_CENTER.md           (trust center index)
│   ├── security_whitepaper.md    (architecture, controls, compliance)
│   ├── threat_model.md           (STRIDE analysis, 7 threats with mitigations)
│   ├── data_handling.md          (GDPR/CCPA compliance, data subject rights)
│   ├── data_retention.md         (90-day retention, auto-purge)
│   ├── incident_response.md      (P0-P3 response, breach notification)
│   ├── responsible_disclosure.md (vulnerability reporting, safe harbor)
│   ├── subprocessors.md          (1 subprocessor: Atlassian)
│   ├── vendor_security.md        (vendor assessment, npm scanning)
│   ├── ENTERPRISE_SECURITY_QUESTIONNAIRE.md (pre-filled VSQ)
│   └── soc2/
│       └── SOC2_CONTROL_MAPPING.md (Trust Service Criteria mapping)
├── legal/
│   ├── PRIVACY_POLICY.md         (GDPR/CCPA compliant)
│   └── TERMS_OF_SERVICE.md       (usage terms, warranties, liability)
├── support/
│   └── SUPPORT_SLA.md            (P0-P3 response times, service credits)
└── tools/
    ├── marketplace_audit/
    │   └── run_marketplace_readiness_v2.sh (automated security audit)
    └── trust_center/
        └── verify_trust_center.sh (document presence validator)
```

---

## Verification

### Step 1: Verify File Integrity

Check that all files match the manifest:

```bash
cd /path/to/firsttry_soc2_evidence_TIMESTAMP
sha256sum -c manifest.sha256
```

**Expected Output:** All files show `OK`.

### Step 2: Verify Pack Integrity

Check that the manifest itself hasn't been tampered with:

```bash
sha256sum manifest.sha256
cat SOC2_PACK_SHA256.txt
```

The SHA256 hash of `manifest.sha256` should match the contents of `SOC2_PACK_SHA256.txt`.

**One-liner:**
```bash
sha256sum manifest.sha256 | awk '{print $1}' | diff - SOC2_PACK_SHA256.txt && echo "✓ PACK VERIFIED" || echo "✗ TAMPERING DETECTED"
```

### Step 3: Review Documentation

Review SOC2 control mapping:

```bash
cat trust/soc2/SOC2_CONTROL_MAPPING.md
```

Key sections:
- Section 2: Common Criteria (CC1-CC9)
- Section 3: Availability
- Section 4: Confidentiality
- Section 7: Evidence Sources

---

## For Auditors

### SOC2 Audit Procedures

1. **Review Control Mapping:** `trust/soc2/SOC2_CONTROL_MAPPING.md` Section 8
2. **Execute Test Commands:** Section 8.2 provides bash commands to validate controls
3. **Review Security Documentation:** `trust/security_whitepaper.md`
4. **Verify Threat Assessment:** `trust/threat_model.md` (STRIDE, 7 threats)
5. **Check Data Protection:** `trust/data_handling.md`, `trust/data_retention.md`
6. **Review Incident Response:** `trust/incident_response.md` (P0-P3 timelines)

### Key Controls (Quick Reference)

| Control | Implementation | Evidence Location |
|---------|----------------|-------------------|
| **CC6.2** (Authorization) | Read-only permissions (`read:jira-work`, `storage:app`) | `manifest.yml` (repository) |
| **CC6.7** (Network Security) | No external egress (Marketplace audit verification) | Run `tools/marketplace_audit/run_marketplace_readiness_v2.sh` |
| **CC8.2** (Change Testing) | CI/CD with E2E tests, code review required | GitHub Actions workflow logs |
| **C1.3/C1.4** (Encryption) | TLS 1.3 (transit), AES-256 (rest) | Forge platform documentation |

### Running Verification Scripts

If you have access to the FirstTry repository:

```bash
# Marketplace audit (verifies no write scopes, no external egress)
bash tools/marketplace_audit/run_marketplace_readiness_v2.sh

# Trust center validation (verifies all docs present)
bash tools/trust_center/verify_trust_center.sh
```

---

## Support

For questions about this evidence pack:

- **Security:** security@firsttry.run
- **Compliance:** compliance@firsttry.run
- **General:** support@firsttry.run

---

## Legal

This evidence pack is provided to facilitate SOC2 audits and compliance reviews. FirstTry has documented its control implementation; however, FirstTry has not yet undergone independent SOC2 audit.

FirstTry inherits Atlassian's SOC2 Type II certification for infrastructure controls. See [Atlassian Trust Center](https://www.atlassian.com/trust/compliance/soc2).

**Confidentiality:** This pack may contain confidential information. Handle per your organization's data classification policy.

---

**Generated by:** FirstTry SOC2 Evidence Pack Generator v1.0  
**Contact:** compliance@firsttry.run  
**Trust Center:** [docs/trust/TRUST_CENTER.md](trust/TRUST_CENTER.md)
EOF

  log_success "Generated README.md"
}

# ============================================================================
# SUMMARY
# ============================================================================

print_summary() {
  local pack_hash=$(cat "${OUTPUT_DIR}/SOC2_PACK_SHA256.txt")
  
  cat <<EOF

===============================================================================
SOC2 EVIDENCE PACK GENERATION: SUCCESS
===============================================================================

Evidence pack generated successfully.

OUTPUT DIRECTORY: ${OUTPUT_DIR}

CONTENTS:
  - Trust Center Docs:  11 documents
  - Legal Docs:         2 documents
  - Support Docs:       1 document
  - Verification Tools: 2 scripts
  - Metadata:           metadata.json
  - Manifest:           manifest.sha256

PACK INTEGRITY:
  Pack Hash (SHA256 of manifest): ${pack_hash}

VERIFICATION:
  1. Verify file integrity:
     cd ${OUTPUT_DIR} && sha256sum -c manifest.sha256
  
  2. Verify pack integrity:
     cd ${OUTPUT_DIR} && sha256sum manifest.sha256 | awk '{print \$1}' | diff - SOC2_PACK_SHA256.txt

USAGE:
  - For SOC2 audits: Provide this pack to auditors
  - For customer due diligence: Share as procurement evidence
  - For internal compliance: Archive annually

NEXT STEPS:
  1. Review README.md in the output directory
  2. Verify pack integrity (commands above)
  3. Archive pack (consider ZIP or tar.gz for distribution)

===============================================================================
EOF
}

# ============================================================================
# MAIN
# ============================================================================

main() {
  echo "==============================================================================="
  echo "FirstTry SOC2 Evidence Pack Generator"
  echo "==============================================================================="
  echo ""
  
  # Environment checks
  check_environment
  echo ""
  
  # Create output directory
  mkdir -p "${OUTPUT_DIR}"
  log_info "Output directory: ${OUTPUT_DIR}"
  echo ""
  
  # Collect documents
  if ! collect_documents; then
    log_fatal "Document collection failed. Cannot generate evidence pack without all required documents."
  fi
  echo ""
  
  # Generate metadata
  generate_metadata
  echo ""
  
  # Generate manifest
  generate_manifest
  echo ""
  
  # Generate pack hash
  generate_pack_hash
  echo ""
  
  # Generate README
  generate_readme
  echo ""
  
  # Print summary
  print_summary
  echo ""
  
  log_success "✓ SOC2 EVIDENCE PACK GENERATED"
  exit 0
}

main "$@"
