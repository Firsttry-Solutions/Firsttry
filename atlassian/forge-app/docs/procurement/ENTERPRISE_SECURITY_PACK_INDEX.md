# Enterprise Security Pack Index

**Version**: 4.4.2  
**Owner**: FirstTry Solutions  
**Last Updated**: 2026-02-26  
**Review Cycle**: Annual
**Doc ID**: FT-PROC-001  

---

## Overview

This is the canonical index for FirstTry's enterprise security documentation and evidence. Use this to navigate procurement, diligence, and compliance activities.

---

## Trust Center (Governance & Security Policies)

| Document | Purpose | Audience |
|----------|---------|----------|
| [Security Overview](../trust/SECURITY_OVERVIEW.md) | Shared responsibility model, platform dependencies, security posture | CISO, Procurement |
| [Forge Platform Dependency](../trust/FORGE_PLATFORM_DEPENDENCY.md) | Platform guarantees, encryption, availability | Procurement, Compliance |
| [Architecture](../trust/ARCHITECTURE.md) | System design, components, trust boundaries, no external egress | Technical diligence |
| [Data Flow](../trust/DATA_FLOW.md) | Data read, storage, export, lifecycle | Compliance, Privacy |
| [Data Classification & PII](../trust/DATA_CLASSIFICATION_AND_PII.md) | User data sensitivity, AI training, deletion | Privacy, Legal |
| [Uninstall & Deletion](../trust/UNINSTALL_DELETION.md) | Deletion workflow, SLA, proof | Legal, Compliance |
| [Ledger Crypto Spec](../trust/LEDGER_CRYPTO_SPEC.md) | Audit trail immutability, hash chain, verification | Technical audit |
| [Export Spec](../trust/EXPORT_SPEC.md) | Archive format, deterministic build, verification | Technical audit |
| [Serialization Schema](../trust/SERIALIZATION_SCHEMA.md) | Canonical JSON, encoding rules, reproducibility | Engineering |
| [Subprocessors](../trust/SUBPROCESSORS.md) | Atlassian subprocessor list, policy | Procurement, Compliance |
| [Privacy Policy](../trust/PRIVACY_POLICY.md) | Data usage, user rights, AI policy | Legal, Privacy |
| [Terms of Service](../trust/TERMS_OF_SERVICE.md) | License, liability, acceptable use | Legal |
| [Security Contact](../trust/SECURITY_CONTACT.md) | Incident reporting, response SLA | CISO |
| [Vulnerability Disclosure Policy](../trust/VULNERABILITY_DISCLOSURE_POLICY.md) | Responsible disclosure, embargo, credit | Security team |
| [security.txt](../trust/SECURITY_TXT.md) | RFC 9116 security contact pointers | System admins |
| [Threat Model](../trust/THREAT_MODEL.md) | STRIDE analysis, mitigations, residual risks | Risk assessment, CISO |
| [Customer Responsibilities](../trust/CUSTOMER_RESPONSIBILITIES.md) | What customers must do (region, permissions, exports) | All customers |
| [Resolver Inventory](../trust/RESOLVER_INVENTORY.md) | API endpoints, HTTP methods, mutation proof | Technical audit |

---

## Operations (Processes & Controls)

| Document | Purpose | Audience |
|----------|---------|----------|
| [Incident Response Plan](../operations/INCIDENT_RESPONSE_PLAN.md) | Severity classification, response workflow, timelines | CISO, Ops |
| [Change Management Policy](../operations/CHANGE_MANAGEMENT_POLICY.md) | Release process, evidence regeneration, baseline drift | Engineering, Ops |
| [Access Control Policy](../operations/ACCESS_CONTROL_POLICY.md) | Least privilege, MFA, onboarding, offboarding | InfoSec, CISO |
| [RBAC Matrix](../operations/RBAC_MATRIX.md) | Current roles and access, quarterly review | InfoSec |
| [Secure SDLC Policy](../operations/SECURE_SDLC_POLICY.md) | Code review, testing, threat modeling, dependency mgmt | Engineering, CISO |
| [CI/CD Evidence](../operations/CI_CD_EVIDENCE.md) | Tools (forge lint, npm audit, trivy), commands, SBOM | Engineering, Compliance |
| [Secrets Management](../operations/SECRETS_MANAGEMENT.md) | Token storage, rotation, incident response | Engineering, InfoSec |
| [Logging & Monitoring](../operations/LOGGING_MONITORING.md) | Winston logger, audit trail, error handling | Ops, Engineering |
| [BCP/DRP](../operations/BCP_DRP.md) | Forge dependency, no independent DRP, customer obligations | Business continuity, CISO |
| [Support Policy](../operations/SUPPORT_POLICY.md) | Channels, scope, response times, severity levels | Customer success, CISO |
| [SLA](../operations/SLA.md) | **NO uptime percentage**, support response times only | Customers, Procurement |

---

## Procurement (Diligence & Control Mapping)

| Document | Purpose | Audience |
|----------|---------|----------|
| **This index** | Navigation for all compliance docs | Procurement, CISO |
| [Security Questionnaire Master](SECURITY_QUESTIONNAIRE_MASTER.md) | Q&A responses with doc references | Compliance, Procurement |
| [Control Mapping Matrix](CONTROL_MAPPING_MATRIX.md) | Maps to SOC2 CC, ISO 27001, CAIQ; disclaimer: no certification claimed | Audit, Compliance |

---

## Evidence Repository

Location: `docs/evidence/baselines/` and `docs/evidence/{DATE}_release/`

| Artifact | Purpose | Audience |
|----------|---------|----------|
| baseline/manifest.yml.sha256 | Scope immutability anchor | Drift detection |
| baseline/package-lock.json.sha256 | Dependency immutability anchor | Drift detection |
| {DATE}_release/forge_lint_strict.txt | Forge manifest validation | Technical audit |
| {DATE}_release/npm_audit_high.txt | Dependency CVE scan | Vulnerability audit |
| {DATE}_release/cyclonedx_sbom.json | Software bill of materials | Supply chain audit |
| {DATE}_release/trivy_scan.txt | Code/filesystem security scan | Technical audit |
| {DATE}_release/resolver_scan.txt | No mutation (POST/PUT/DELETE) proof | Technical audit |
| {DATE}_release/manifest_scopes_snapshot.txt | Scope snapshot | Scope audit |
| {DATE}_release/evidence_hashes.txt | Hash manifest | Integrity check |

---

## Document Navigation

### By Role

**CISO**:
1. Threat Model
2. Security Overview
3. Incident Response Plan
4. Control Mapping Matrix

**Procurement/Compliance**:
1. This index (you are here)
2. Security Questionnaire Master
3. Control Mapping Matrix
4. Data Classification & PII

**Technical Auditor**:
1. Architecture
2. Resolver Inventory
3. CI/CD Evidence
4. Export Spec & Ledger Crypto

**Privacy Officer**:
1. Data Flow
2. Data Classification & PII
3. Privacy Policy
4. Uninstall & Deletion

**Customer Success**:
1. Customer Responsibilities
2. Support Policy
3. SLA
4. Data Flow

### By Compliance Framework

**SOC2 Type II**:
- See Control Mapping Matrix for CC (Common Criteria) alignment
- Evidence: CI/CD Evidence, Incident Response Plan, Access Control Policy

**ISO 27001**:
- See Control Mapping Matrix for Annex A control alignment
- Evidence: All docs (comprehensive coverage)

**CAIQ v4** (Cloud Security Alliance):
- See Control Mapping Matrix for CAIQ section ID alignment
- Key: Data Classification & PII, Subprocessors, BCP/DRP

**GDPR**:
- Data Classification & PII
- Privacy Policy
- Uninstall & Deletion (right to deletion)
- Customer Responsibilities (data minimization)

**Atlassian Marketplace**:
- Security Overview (required)
- Resolver Inventory (no mutations)
- Threat Model (enterprise risks)
- Evidence bundle (drift anchors, scanner output)

---

## Evidence Regeneration

To regenerate evidence bundle for current date:
```bash
bash tools/generate_enterprise_evidence.sh
```

Output: `docs/evidence/{TODAY}_release/`

For specific date:
```bash
bash tools/generate_enterprise_evidence.sh 2026-02-26
```

See CI_CD_EVIDENCE.md for detailed artifact descriptions.

---

## How to Use This Index

**For procurement questionnaire**:
1. Open SECURITY_QUESTIONNAIRE_MASTER.md
2. Each Q/A is pre-populated with doc references
3. Copy responses into vendor diligence system

**For compliance mapping**:
1. Open CONTROL_MAPPING_MATRIX.md
2. Find relevant framework (SOC2, ISO27k, CAIQ)
3. Navigate to linked doc for details
4. **Note disclaimer**: No certification claimed, mapping only

**For technical deep-dive**:
1. Start with Architecture.md
2. Follow references to lower-level docs (Ledger Crypto, Export Spec, etc.)
3. Review evidence bundle (docs/evidence/) for proof

**For risk assessment**:
1. Read Threat Model.md
2. Identify residual risks you accept
3. Review Customer Responsibilities.md for your obligations
4. Review FORGE_PLATFORM_DEPENDENCY.md for vendor risk

---

## Disclaimer

🔴 **IMPORTANT**: FirstTry makes NO claims of:
- "SOC2 Type II compliant" (not certified)
- "ISO 27001 certified" (not certified)
- "Cloud Fortified" (Atlassian trademark)
- "Guaranteed uptime" (see SLA.md)

This documentation and evidence demonstrates our security practices, governance, and threat mitigations. Control mapping is informational only; no third-party certification exists.

---

## Contacts

- **Security**: security.contact@firsttry.run
- **General Inquiries**: contact@firsttry.run
- **Support**: support@firsttry.run
- **Privacy**: privacy@firsttry.run

---

## Document Storage and Updates

- All docs committed to git (version controlled)
- Updated via change management (CHANGE_MANAGEMENT_POLICY.md)
- Evidence regenerated on baseline changes (tools/generate_enterprise_evidence.sh)
- Annual review cycle (Review Cycle in each doc header)
- Interim updates triggered by security events or platform changes
