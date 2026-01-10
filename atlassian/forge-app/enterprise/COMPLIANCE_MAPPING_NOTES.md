# Compliance Mapping Notes

**Last Updated**: 2026-01-10

FirstTry is not independently certified for compliance standards. This document explains how FirstTry **aligns with** common compliance requirements.

---

## GDPR (General Data Protection Regulation)

### Data Processing

| GDPR Requirement | FirstTry Implementation |
|------------------|----------------------|
| Lawful basis | Legitimate interest (governance & compliance) |
| Data minimization | Only reads project/issue metadata (no PII) |
| Purpose limitation | Governance evidence only (documented in terms) |
| Storage limitation | 90-day retention (automatic cleanup) |
| Integrity & confidentiality | Stored in Jira's encrypted Forge Storage |
| Right to access | Jira admin can view all evidence via dashboard |
| Right to delete | Manual deletion + automatic 90-day cleanup |
| Data processors | No third-party subprocessors (all data in Jira Cloud) |

**Status**: ✅ **Aligned** (not independently audited)

---

## SOC 2 Type II

### Controls Relevant to FirstTry

| SOC 2 Domain | Control | FirstTry Status |
|-------------|---------|-----------------|
| **Security** | Access controls | ✅ Jira auth required; FirstTry inherits permissions |
| **Security** | Encryption | ✅ Data encrypted at rest (Atlassian-managed) |
| **Availability** | System monitoring | ✅ Forge runtime health monitoring |
| **Processing Integrity** | Input validation | ✅ TypeScript contracts + API response validation |
| **Confidentiality** | Unauthorized access | ✅ No external egress; data stays in Jira Cloud |

**Status**: ⚠️ **NOT independently certified** (relies on Jira Cloud SOC 2 cert)

---

## ISO 27001 (Information Security)

### Alignment Areas

| ISO 27001 Area | FirstTry Implementation |
|---|---|
| Access control | Jira admin-only access; Forge sandbox isolation |
| Cryptography | SHA-256 hashing for evidence integrity; HTTPS for API calls |
| Physical security | Data in Jira Cloud (Atlassian data centers) |
| Incident management | Documented incident response procedure (legal/INCIDENT_RESPONSE_OVERVIEW.md) |
| Vulnerability management | Regular code reviews, npm audit (0 vulnerabilities), security.txt |

**Status**: ⚠️ **NOT independently certified** (aligns with Jira Cloud ISO 27001 cert)

---

## HIPAA (Health Insurance Portability and Accountability Act)

### Relevance to FirstTry

**Status**: ⚠️ **NOT HIPAA-eligible**

**Reason**: FirstTry is not a Business Associate Agreement (BAA)-eligible app because:
- No explicit BAA in place
- Designed for general governance (not healthcare-specific)
- No specialized healthcare encryption or audit controls

**For healthcare organizations**: Consult your Jira compliance team about HIPAA-eligible alternatives.

---

## FedRAMP (Federal Risk and Authorization Management Program)

### Relevance to FirstTry

**Status**: ❌ **NOT FedRAMP-authorized**

FirstTry is not suitable for US federal government use without explicit FedRAMP authorization. Contact `contact@firsttry.run` for authorization status.

---

## PCI-DSS (Payment Card Industry Data Security Standard)

### Relevance to FirstTry

**Status**: ✅ **Compliant with PCI-DSS principles** (but not subject to full audit)

FirstTry:
- Does NOT store payment card data
- Does NOT process credit cards
- Does NOT access sensitive payment information

**Recommendation**: FirstTry may be used in PCI-DSS-compliant environments, but is not subject to PCI-DSS certification.

---

## CCPA (California Consumer Privacy Act)

### Alignment

| CCPA Requirement | FirstTry Status |
|---|---|
| Right to know | ✅ Admins can view all stored evidence |
| Right to delete | ✅ Manual deletion + 90-day auto-cleanup |
| Right to opt-out | ✅ Uninstall app anytime |
| No sale of data | ✅ FirstTry never sells or shares data |

**Status**: ✅ **Aligned** (not independently audited)

---

## Recommendations for Compliance Use

### If your organization requires certification:

1. **Contact us**: `contact@firsttry.run` (mention your compliance requirement)
2. **Custom audit**: We can arrange a third-party security audit
3. **BAA**: We can negotiate a Business Associate Agreement if needed
4. **Alternatives**: Ask about compliance-certified alternatives

### For now:

FirstTry is suitable for:
- ✅ Internal governance and compliance tracking
- ✅ Evidence collection for audits (with human review)
- ✅ Compliance monitoring in non-regulated industries

FirstTry is NOT suitable for:
- ❌ HIPAA-protected health information
- ❌ PCI payment data
- ❌ FedRAMP-required government systems
- ❌ Industries with third-party audit requirements

---

## Contact

For compliance questions or custom audit requests: `contact@firsttry.run`

