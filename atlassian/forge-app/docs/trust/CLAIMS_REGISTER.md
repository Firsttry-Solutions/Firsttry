# Claims Register - Truth Audit System

**Version**: 4.4.2  
**Owner**: FirstTry Security Team  
**Last Updated**: 2026-02-26  
**Review Cycle**: Quarterly (Q2 2026)
**Doc ID**: FT-TRUST-014  

---

## Overview

The Claims Register is a strict audit trail mapping every material security, privacy, and operational claim made in FirstTry documentation to:
1. **Proof Type**: EVIDENCE (file in repo) or ATLASSIAN (Atlassian docs reference)
2. **Proof Pointer**: Exact file path or URL where proof exists
3. **Validation Rule**: How the claim is verified (deterministic, fail-closed)
4. **Owner**: Team responsible for claim accuracy

All claims not in this register that use absolute language ("no", "guaranteed", "always", "never", "certified", etc.) will fail automated Truth Audit validation.

---

## Claims Register Table

| ClaimID | ClaimText | Scope | ProofType | ProofPointer | ValidationRule | Owner | LastReviewed |
|---------|-----------|-------|-----------|--------------|-----------------|-------|--------------|
| C001 | All API calls are read-only (0 POST/PUT/DELETE) | Mutations | EVIDENCE | docs/trust/RESOLVER_INVENTORY.md | Grep resolver_scan.txt for POST/PUT/DELETE; fail if any found | Security | 2026-02-26 |
| C002 | No external network egress (zero outbound HTTPS) | Networking | EVIDENCE | docs/trust/SECURITY_OVERVIEW.md | Enterprise audit: zero_egress_summary.txt must show 0 external URLs | Security | 2026-02-26 |
| C003 | Data deletion workflow SLA is 30 days (Forge platform dependent) | Retention | EVIDENCE | docs/trust/UNINSTALL_DELETION.md | Explicit statement: "30-day SLA applies to Atlassian Forge Storage; FirstTry has no independent hosting" | Operations | 2026-02-26 |
| C004 | Personal data is minimized but Jira may contain PII | PII Handling | EVIDENCE | docs/trust/DATA_CLASSIFICATION_AND_PII.md | Use exact language: "We minimize personal data; Jira may contain personal data; we avoid issue content storage; what is stored is schema-defined" | Privacy | 2026-02-26 |
| C005 | FirstTry has no independent subprocessors | Subprocessors | ATLASSIAN | https://developer.atlassian.com/platform/forge/policies-and-limits/#forge-app-policies | Use exact language: "FirstTry has no independent subprocessors; processing occurs on Atlassian Forge platform" | Operations | 2026-02-26 |
| C006 | All data persists in Atlassian Forge Storage (AES-256 at rest) | Encryption | ATLASSIAN | https://developer.atlassian.com/platform/forge/storage/ | Reference Forge Storage as platform-provided encryption; do not claim FirstTry owns encryption | Operations | 2026-02-26 |
| C007 | Threat Model covers 18 threat scenarios with STRIDE taxonomy | Security Design | EVIDENCE | docs/trust/THREAT_MODEL.md | File must contain STRIDE table with exact 4 columns: Threat \| STRIDE \| Mitigation \| Residual Risk | Security | 2026-02-26 |
| C008 | Incident Response SLA: 4h-24h per severity tier (best-effort only) | Operations | EVIDENCE | docs/operations/INCIDENT_RESPONSE_PLAN.md | Exact table format and CRITICAL caveat: "best-effort and subject to Forge availability" | Operations | 2026-02-26 |
| C009 | NO uptime SLA guaranteed; only support response times | Service Level | EVIDENCE | docs/operations/SLA.md | Must include sections: "What We DONT Guarantee" (no uptime %) and "NO SLA CREDITS" rationale | Operations | 2026-02-26 |
| C010 | Scope enforcement via manifest.yml allowlist with CI/CD gate | Scope Control | EVIDENCE | docs/operations/CI_CD_EVIDENCE.md | Must document forge lint --strict and scope guard in CI pipeline | Engineering | 2026-02-26 |
| C011 | Build determinism enforced: identical inputs = identical outputs | Build Integrity | EVIDENCE | docs/evidence/RETENTION_POLICY.md | Document SHA256 baseline anchors and deterministic build process | Engineering | 2026-02-26 |
| C012 | Read-only verification: RESOLVER_INVENTORY.md shows 0 mutations | API Safety | EVIDENCE | docs/trust/RESOLVER_INVENTORY.md | File must list all API endpoints; grep shows GET-only, 0 POST/PUT/DELETE | Security | 2026-02-26 |
| C013 | Platform dependency: Forge handles tenant isolation, data residency, uptime | Platform Dependency | ATLASSIAN | https://developer.atlassian.com/platform/forge/security/ | Must explicitly state: "Tenant isolation, encryption, uptime SLA provided by Atlassian Forge" | Operations | 2026-02-26 |
| C014 | Customer responsibility: RBAC hygiene, export cadence, uninstall | Shared Responsibility | EVIDENCE | docs/trust/CUSTOMER_RESPONSIBILITIES.md | Document 12 responsibility areas; recommend monthly export cadence | Operations | 2026-02-26 |
| C015 | Control mapping to SOC2, ISO27k, CAIQ without certification claim | Compliance | EVIDENCE | docs/procurement/CONTROL_MAPPING_MATRIX.md | RED DISCLAIMER: "Mapped only; no certification claimed" on every page | Compliance | 2026-02-26 |
| C016 | We are not certified - not SOC2 compliant, not cloud fortified | Compliance | EVIDENCE | docs/procurement/ENTERPRISE_SECURITY_PACK_INDEX.md | Explicit text: "NOT certified, NOT SOC2 compliant, NOT cloud fortified" | Compliance | 2026-02-26 |
| C017 | Uninstall: Data retention governed by Forge storage (not automatically deleted) | Retention | EVIDENCE | docs/trust/UNINSTALL_DELETION.md | Explain that deletion is Forge-dependent, not automatic | Operations | 2026-02-26 |
| C018 | No PII claim is false - Jira and FirstTry may contain personal data | PII | EVIDENCE | docs/trust/DATA_CLASSIFICATION_AND_PII.md | State that no pii claim is inaccurate; we do store some personal data | Privacy | 2026-02-26 |

---

## Banned Absolute Phrases

The following phrases are forbidden unless the exact claim is registered above:

- "**no pii**" (use: "minimize PII; Jira may contain PII")
- "**automatically deleted**" (use: "deletion workflow; 30-day SLA; Forge platform dependent")
- "**no subprocessors**" (use: "no independent subprocessors; Atlassian Forge is the processor")
- "**guaranteed**" (use: "best-effort", "SLA", "support response times")
- "**certified**" (use: "control mapping", "claims register", "evidence documentation")
- "**compliant**" (use: "aligned with", "control mapping")
- "**cloud fortified**" (banned term; do not use)

Any banned phrase found in `docs/**/*.md` must correspond to a registered claim in this table, or Truth Audit will fail.

---

## Truth Audit Procedure

1. **Parse**: truth_claims_gate.mjs reads this table
2. **Validate EVIDENCE proofs**: File must exist at ProofPointer and contain keyword validations
3. **Validate ATLASSIAN proofs**: ProofPointer must be https://developer.atlassian.com/ URL
4. **Scan docs**: Search all `docs/**/*.md` for banned phrases
5. **Cross-reference**: Every banned phrase must map to a registered claim
6. **Fail-closed**: Non-zero exit if any error; detailed error messages logged
7. **Deterministic**: Same input always yields same output

---

## Proof Inventory

### EVIDENCE Proofs (Must Exist in Repo)

| ProofPointer | File Status | Last Verified |
|--------------|-------------|----------------|
| docs/trust/SECURITY_OVERVIEW.md | ✅ Present | 2026-02-26 |
| docs/trust/RESOLVER_INVENTORY.md | ✅ Present | 2026-02-26 |
| docs/trust/THREAT_MODEL.md | ✅ Present | 2026-02-26 |
| docs/trust/DATA_CLASSIFICATION_AND_PII.md | ✅ Present | 2026-02-26 |
| docs/trust/UNINSTALL_DELETION.md | ✅ Present | 2026-02-26 |
| docs/operations/INCIDENT_RESPONSE_PLAN.md | ✅ Present | 2026-02-26 |
| docs/operations/SLA.md | ✅ Present | 2026-02-26 |
| docs/operations/CI_CD_EVIDENCE.md | ✅ Present | 2026-02-26 |
| docs/trust/CUSTOMER_RESPONSIBILITIES.md | ✅ Present | 2026-02-26 |
| docs/procurement/CONTROL_MAPPING_MATRIX.md | ✅ Present | 2026-02-26 |
| docs/evidence/RETENTION_POLICY.md | ✅ Present | 2026-02-26 |
| docs/procurement/ENTERPRISE_SECURITY_PACK_INDEX.md | ✅ Present | 2026-02-26 |

### ATLASSIAN Proofs (External References)

| ProofPointer | Status | Last Checked |
|--------------|--------|--------------|
| https://developer.atlassian.com/platform/forge/policies-and-limits/#forge-app-policies | ✅ Valid | 2026-02-26 |
| https://developer.atlassian.com/platform/forge/storage/ | ✅ Valid | 2026-02-26 |
| https://developer.atlassian.com/platform/forge/security/ | ✅ Valid | 2026-02-26 |

---

## Claim Review Schedule

| Review Quarter | Owner | Status |
|----------------|-------|--------|
| Q1 2026 | Security | Initial audit (this file) |
| Q2 2026 (due 2026-05-26) | Security + Operations | Scheduled |
| Q3 2026 | Privacy + Compliance | Scheduled |
| Q4 2026 | Engineering | Scheduled |

---

## Version History

| Version | Date | Changes | Reviewed By |
|---------|------|---------|-------------|
| 1.0 | 2026-02-26 | Initial Claims Register with 15 claims and banned phrases | Security Team |

---

## Amendment Procedure

To add a new claim:
1. Gather evidence (file path or Atlassian docs URL)
2. Define ValidationRule (what determines if claim is true)
3. Add row to Claims Register Table
4. Run truth_claims_gate.mjs to validate
5. Commit with message: "Truth Audit: add claim CXxx - [description]"

To modify existing claim:
1. Update ClaimText, ProofPointer, or ValidationRule
2. Re-run truth_claims_gate.mjs
3. Update LastReviewed with today's date
4. Commit with message: "Truth Audit: update claim CXxx - [reason]"
