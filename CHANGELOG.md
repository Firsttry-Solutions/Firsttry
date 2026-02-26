# Changelog

All notable changes to FirstTry are documented in this file.

## [v1.0-enterprise-docs-v4.2.3] - 2026-02-26

### Added

#### Truth Audit System + GitHub Pages Publishing

**Truth Audit** - Claims Register + Auto-Validation
- `docs/trust/CLAIMS_REGISTER.md` - Central registry of 18 claims with SIG 2.2/CAIQ v4 alignment
  - Columns: ClaimID | ClaimText | ProofType (EVIDENCE|ATLASSIAN) | ProofPointer | ValidationRule
  - Explicit mapping of banned phrases to registered claims
  - Quarterly review schedule with Owner accountability
  
**Truth Claims Gate** - Deterministic validation tool
- `tools/truth_claims_gate.mjs` - Node.js ESM script (no external dependencies)
  - Parses CLAIMS_REGISTER.md table
  - Validates EVIDENCE proofs exist as files in repo
  - Validates ATLASSIAN proofs are https://developer.atlassian.com/ URLs
  - Scans docs/trust/, docs/operations/, docs/procurement/ for banned phrases
  - Fails if banned phrase found but not registered in CLAIMS_REGISTER
  - Deterministic sorted error output; non-zero exit on any error
  - Banned Phrases List: "no pii", "automatically deleted", "no subprocessors", "guaranteed", "certified", "compliant", "cloud fortified"

**Enterprise Documentation Gate Integration**
- Updated `tools/enterprise_docs_gate.sh` (step 2a)
  - Integrated truth_claims_gate.mjs into validation pipeline
  - Fails entire gate if Truth Audit fails
  - Added CLAIMS_REGISTER.md to required docs list

**GitHub Pages Publishing**
- Enhanced `.github/workflows/docs.yml`
  - Node.js v20 pinned
  - New build step: copies docs/trust/, docs/operations/, docs/procurement/ into site/
  - Generates landing page index.html with links to:
    - docs/README.md (role-based navigation)
    - docs/procurement/ENTERPRISE_SECURITY_PACK_INDEX.md (master index)
    - Trust Center section links (SECURITY_OVERVIEW, THREAT_MODEL, RESOLVER_INVENTORY, etc.)
    - Operations section links (INCIDENT_RESPONSE_PLAN, SLA, SECURE_SDLC_POLICY, etc.)
    - Procurement section links (SECURITY_QUESTIONNAIRE_MASTER, CONTROL_MAPPING_MATRIX)
  - Uses official GitHub Pages actions:
    - actions/configure-pages
    - actions/upload-pages-artifact
    - actions/deploy-pages
  - Workflow fails if link checker or enterprise gate fails (fail-closed)
  - Publishes to: https://firsttry-solutions.github.io/Firsttry/

#### Claims Register Content (18 Claims)

**Security & Verification (C001-C012)**
- C001: All API calls read-only (0 POST/PUT/DELETE mutations)
- C002: Zero external network egress
- C003: Data deletion SLA 30 days (Forge platform dependent)
- C004: PII minimized but Jira may contain personal data
- C005: No independent subprocessors (Forge-only)
- C006: Data encrypted in Atlassian Forge Storage
- C007: Threat Model with STRIDE taxonomy (18 scenarios)
- C008: Incident Response SLA (4h-24h, best-effort)
- C009: NO uptime SLA (support response times only)
- C010: Scope enforcement via CI/CD gate
- C011: Build determinism enforced (SHA256 baselines)
- C012: Read-only API verification

**Compliance & Platform Dependency (C013-C018)**
- C013: Platform dependency transparency (Forge handles isolation, residency, uptime)
- C014: Customer responsibilities (RBAC hygiene, export cadence, uninstall)
- C015: Control mapping w/o certification claims
- C016: NOT certified - explicit non-claim (SOC2, compliant, cloud fortified)
- C017: Data retention Forge-dependent (not automatically deleted)
- C018: PII claim is false - we do store personal data

### Key Design Principles

**Truth Audit System**
- Every claim must be registered with evidence (file path or Atlassian docs URL)
- Banned phrases trigger validation gate failure unless claimed in register
- Quarterly review cycle with named owner accountability
- Deterministic output enables CI/CD validation

**No False Claims**
- Explicit disclaimers for "not certified", "not compliant", "no uptime SLA"
- Platform dependencies clearly attributed to Atlassian Forge
- SLA.md reiterates: no uptime percentage guaranteed

**Fail-Closed Architecture**
- Truth Audit gate integrated into enterprise_docs_gate.sh
- All validation checks must pass or entire pipeline fails
- Detailed error messages for debugging

### Verification Status

✅ Truth Audit Gate: PASS
  - 18 claims registered
  - 15 EVIDENCE proofs validated (files exist)
  - 3 ATLASSIAN proofs validated (https://developer.atlassian.com/ URLs)
  - 4 banned phrases found and claimed
  - 0 unregistered banned phrases

✅ Markdown Link Checker: Enterprise docs have valid links

✅ Enterprise Documentation Gate: All 14 validation points pass

✅ Git Diff: Only allowed paths changed
  - atlassian/forge-app/.github/workflows/docs.yml
  - atlassian/forge-app/docs/trust/CLAIMS_REGISTER.md
  - atlassian/forge-app/tools/enterprise_docs_gate.sh
  - atlassian/forge-app/tools/truth_claims_gate.mjs

✅ No Runtime Changes
  - Zero app code modifications
  - Zero Forge scope additions
  - Zero external egress added
  - Zero npm dependency additions

### Next Steps (When GitHub Pages Configured)

1. Configure GitHub repo settings: Settings → Pages → Source = "GitHub Actions"
2. Push tag v1.0-enterprise-docs-v4.2.3
3. Workflow automatically builds site/ and deploys to GitHub Pages
4. Access documentation at: https://firsttry-solutions.github.io/Firsttry/

---

## [v1.0-enterprise-docs-v4.2.2] - 2026-02-26

### Added

#### Enterprise Security Documentation Package

Comprehensive documentation and evidence infrastructure for Atlassian Marketplace diligence and enterprise procurement:

**Trust Center (18 documents)**
- `SECURITY_OVERVIEW.md` - Shared responsibility model, scopes justification, security claims
- `FORGE_PLATFORM_DEPENDENCY.md` - Platform guarantees, encryption, data residency, subprocessor policy  
- `ARCHITECTURE.md` - System design with ASCII component diagram and trust boundaries
- `DATA_FLOW.md` - Inventory of read operations, data storage, exports
- `DATA_CLASSIFICATION_AND_PII.md` - PII acknowledgement, GDPR/CCPA context, retention policies
- `UNINSTALL_DELETION.md` - Data deletion workflow and SLA (30-day platform dependency)
- `LEDGER_CRYPTO_SPEC.md` - Audit trail cryptographic hash chain formula and immutability proofs
- `EXPORT_SPEC.md` - Deterministic ZIP format, canonical ordering, verification steps
- `SERIALIZATION_SCHEMA.md` - Canonical JSON encoding rules, timestamp specifications, type primitives
- `SUBPROCESSORS.md` - Atlassian-only subprocessors (public list policy)
- `PRIVACY_POLICY.md` - Data usage, user rights, AI training policy (none)
- `TERMS_OF_SERVICE.md` - License, liability limits, acceptable use
- `SECURITY_CONTACT.md` - RFC 9116 compliant security.txt contact information
- `VULNERABILITY_DISCLOSURE_POLICY.md` - Responsible disclosure, 90-day embargo, safe harbor
- `SECURITY_TXT.md` - Security contact pointers
- `THREAT_MODEL.md` - STRIDE-based threat inventory (exact table format: Threat | STRIDE | Mitigation | Residual Risk)
- `CUSTOMER_RESPONSIBILITIES.md` - Required customer actions (RBAC hygiene, export cadence, uninstall workflow)
- `RESOLVER_INVENTORY.md` - API endpoint inventory proving read-only operations (0 POST/PUT/DELETE)

**Operations (11 documents)**
- `INCIDENT_RESPONSE_PLAN.md` - Severity classification with response and acknowledgment SLAs (exact table format: Severity | CVSS | Example | Notify SLA | Ack SLA)
- `CHANGE_MANAGEMENT_POLICY.md` - Release process, baseline drift monitoring, evidence regeneration triggers
- `ACCESS_CONTROL_POLICY.md` - Least privilege, MFA enforcement, quarterly access review
- `RBAC_MATRIX.md` - Current role definitions with quarterly review schedule
- `SECURE_SDLC_POLICY.md` - Code review, testing procedures, threat modeling, scope allowlist enforcement
- `CI_CD_EVIDENCE.md` - Exact evidence generation commands (forge lint, npm audit, trivy, CycloneDX SBOM, dependency tree, resolver mutation scan)
- `SECRETS_MANAGEMENT.md` - Token rotation procedures, pre-commit hooks
- `LOGGING_MONITORING.md` - Winston logger audit trail, error handling, monitoring
- `BCP_DRP.md` - Disaster recovery (Forge platform dependent, 99.5% typical SLA)
- `SUPPORT_POLICY.md` - Email channels, response times by severity (4h-5d)
- `SLA.md` - **CRITICAL**: NO uptime percentage guaranteed (only support response times, best-effort)

**Procurement (3 documents)**
- `ENTERPRISE_SECURITY_PACK_INDEX.md` - Master index navigating all 32 docs by role (CISO, Reviewer, Jira Admin, Compliance)
- `SECURITY_QUESTIONNAIRE_MASTER.md` - Pre-filled vendor diligence Q&A with doc references and "NO certifications claimed" disclaimer
- `CONTROL_MAPPING_MATRIX.md` - SOC2 CC, ISO 27001 Annex A, CAIQ v4, GDPR, NIST mappings with "Mapped only; no certification" disclaimer

**Evidence Infrastructure**
- `docs/evidence/RETENTION_POLICY.md` - 12-month minimum retention policy with archival and legal hold procedures
- `docs/evidence/baselines/manifest.yml.sha256` - Immutable baseline anchor for drift detection
- `docs/evidence/baselines/package-lock.json.sha256` - Package lock baseline for dependency verification
- `docs/evidence/baselines/README.md` - Baseline immutability policy and update procedures

#### Tooling & Validation

**Fail-Closed Gates & Automation**
- `tools/check_tooling_prereqs.sh` - Prerequisite checker (requires Node v20, forge, trivy)
- `tools/enterprise_docs_gate.sh` - 14-point hard-fail validation gate checking:
  - Required docs presence and non-empty
  - Document headers (Version, Owner, Last Updated, Review Cycle)
  - THREAT_MODEL.md STRIDE table format (exact column count: 4)
  - INCIDENT_RESPONSE_PLAN.md severity table format (exact column count: 5)
  - SLA.md no-uptime-percentage requirement (regex check prevents 99.%, 99%, 100%)
  - Overclaim detection (denylist: "SOC2 compliant", "ISO certified", "Cloud Fortified", etc.)
  - Baseline drift detection (manifest.yml, package-lock.json)
  - Mutation detection (no POST/PUT/DELETE in resolvers)
  - Evidence artifacts presence and integrity
  - Documentation file size caps (max 100KB per file)
  - File path integrity (no staged dist/ artifacts)

- `tools/generate_enterprise_evidence.sh` - Deterministic evidence generation pipeline:
  - `forge lint --strict` → forge_lint_strict.txt
  - `npm audit --audit-level=high` → npm_audit_high.txt
  - `npm ls --json` → dependency_tree.json
  - `npx @cyclonedx/bom` → cyclonedx_sbom.json (with FT_ALLOW_FALLBACK_SBOM fallback policy)
  - `trivy fs` → trivy_scan.txt
  - Mutation detection → resolver_scan.txt
  - Manifest scopes snapshot
  - Deterministic SHA256 hashing for all artifacts
  - Evidence manifest with timestamps and hash chain

- `tools/md_link_check.mjs` - Node.js ESM script validating relative markdown links with deterministic sorted output

**GitHub Actions**
- `.github/workflows/docs.yml` - Automated validation workflow:
  - Trigger: version tags matching `v*` pattern
  - Environment: Node.js v20 pinned
  - Pipeline: Prerequisite check → Link check → Gate validation → Evidence generation → Final gate verification
  - Fail-closed: Non-zero exit on any failure

#### Documentation Navigation

- Updated `README.md` - Added enterprise security package section pointing to procurement/ENTERPRISE_SECURITY_PACK_INDEX.md
- Updated `docs/README.md` - Reorganized START HERE section with role-based navigation (CISO, Reviewer, Jira Admin, Compliance Officer)

### Key Design Principles

**No Certifications Claimed**
All documentation includes explicit disclaimers:
- "Mapped only; no certification claimed" (control mapping matrix)
- "NO CERTIFICATIONS CLAIMED" (enterprise security pack index)
- Evidence and documentation provided for diligence only

**Fail-Closed Architecture**
- All validation gates exit non-zero on any failure
- Missing tools trigger immediate exit (exit code 2)
- Broken links cause gate failure (exit code 1)
- Baseline drift detected and rejected

**Immutable Baselines**
- SHA256 anchors for manifest.yml and package-lock.json committed to git
- Drift detection prevents undocumented scope or dependency changes
- Evidence artifacts stored with deterministic ordering for reproducibility

**Platform Dependency Transparency**
- All Forge platform guarantees documented with explicit caveats
- Data residency, encryption, deletion SLAs attributed to Atlassian
- Customer responsibilities clearly articulated

### Files Changed

- **Documentation**: 35+ new markdown files (trust/, operations/, procurement/, evidence/)
- **Tooling**: 4 new scripts (bash/Node.js)
- **Workflow**: GitHub Actions documentation validation pipeline
- **Configuration**: Baseline hashes for drift detection
- **Navigation**: Updated README files with enterprise docs pointers

### Verification

```bash
# Run documentation validation gate
bash tools/enterprise_docs_gate.sh

# Generate evidence artifacts
bash tools/generate_enterprise_evidence.sh 2026-02-26

# Validate markdown links
node tools/md_link_check.mjs

# Verify git status
git diff --stat  # Should show ONLY docs/, tools/, workflows, README changes
git status       # Should show no uncommitted app code or dist artifacts
```

### No Runtime Changes

- ✅ Zero app code modifications
- ✅ Zero Forge scope additions
- ✅ Zero external egress added
- ✅ Zero dist artifact commits
- ✅ Backward compatible with all previous versions

---

## Previous Versions

Documentation for prior releases available in git history.
