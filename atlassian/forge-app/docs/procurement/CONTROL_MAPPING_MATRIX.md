# Control Mapping Matrix

**Version**: 1.0  
**Owner**: FirstTry Solutions  
**Last Updated**: 2026-02-26  
**Review Cycle**: Annual

---

## 🔴 CRITICAL DISCLAIMER

**NO CERTIFICATIONS CLAIMED**: FirstTry is NOT certified for SOC2, ISO27k, CAIQ, or any other framework. This mapping is **informational only** to help customers understand how FirstTry addresses common control frameworks.

Do NOT use this mapping as proof of compliance with any standard. This is a **self-assessment** without third-party audit or certification.

---

## SOC2 Trust Service Criteria (CC) Mapping

| CC ID | Control | FirstTry Implementation | Evidence |
|-------|---------|------------------------|---------| | CC6.1 | Logical access controls | RBAC, MFA, branch protection | ACCESS_CONTROL_POLICY.md |
| CC6.2 | Session management | Jira OAuth2 (Forge-provided) | FORGE_PLATFORM_DEPENDENCY.md |
| CC7.1 | Identifies, evaluates, and manages compliance requirements | Roadmap, change management | CHANGE_MANAGEMENT_POLICY.md |
| CC9.1 | Logical access restrictions | Code review required, no direct deploy | SECURE_SDLC_POLICY.md |
| CC9.2 | Removal/deprovisioning of access | Offboarding via GitHub team removal | ACCESS_CONTROL_POLICY.md |
| A1.1 | Prevents, detects, corrects unauthorized internal access | AppScan via npm audit, trivy | CI_CD_EVIDENCE.md |
| A1.2 | Monitoring for software vulnerabilities | npm audit + trivy in CI/CD | CI_CD_EVIDENCE.md |
| C1.1 | Encryption of data in transit | TLS 1.3 (Forge-provided) | FORGE_PLATFORM_DEPENDENCY.md |
| C1.2 | Encryption of data at rest | Forge Storage AES-256 (Atlassian-managed) | FORGE_PLATFORM_DEPENDENCY.md |

---

## ISO 27001 Annex A Mapping

| Control | Section | FirstTry Approach | Evidence |
|---------|---------|-------------------|----------|
| **Access Control** | A.6 | Least privilege, MFA, quarterly review | ACCESS_CONTROL_POLICY.md, RBAC_MATRIX.md |
| **Supplier Relationships** | A.8 | Single Forge platform vendor managed by Atlassian | SUBPROCESSORS.md, FORGE_PLATFORM_DEPENDENCY.md |
| **Cryptography** | A.10 | TLS 1.3, SHA256 ledger hashing, platform encryption | LEDGER_CRYPTO_SPEC.md, FORGE_PLATFORM_DEPENDENCY.md |
| **Data Security** | A.10.7 | Immutable ledger, deterministic exports | LEDGER_CRYPTO_SPEC.md, EXPORT_SPEC.md |
| **Incident Management** | A.16 | Severity classification, response SLA, escalation | INCIDENT_RESPONSE_PLAN.md |
| **Information Transfer** | A.13.1 | OAuth2 API only (no external egress) | SECURITY_OVERVIEW.md, RESOLVER_INVENTORY.md |
| **Monitoring** | A.12.4 | Winston logs, audit trail, Forge logs | LOGGING_MONITORING.md |
| **Discontinuation** | A.15 | Data deletion on uninstall (30 days) | UNINSTALL_DELETION.md |

---

## CAIQ v4 Mapping (Cloud Security Alliance)

| CAIQ Section | Topic | FirstTry Control | Evidence |
|------------|-------|-------------------|----------|
| **APP** Application & Interface Security | API usage | GET only; no POST/PUT/DELETE | RESOLVER_INVENTORY.md |
| **APP-01** Encryption | Data protection | TLS 1.3 in transit, AES-256 at rest | FORGE_PLATFORM_DEPENDENCY.md |
| **APP-02** Logging & Monitoring | Audit trail | Winston + immutable ledger | LOGGING_MONITORING.md |
| **APP-03** Authentication | Identity verification | Jira OAuth2 (Forge-managed) | FORGE_PLATFORM_DEPENDENCY.md |
| **APP-04** Access Control | Authorization | Scope allowlist + read-only scopes | RESOLVER_INVENTORY.md |
| **AUD** Auditing | Compliance | Evidence bundle regeneration, change mgt | CI_CD_EVIDENCE.md, CHANGE_MANAGEMENT_POLICY.md |
| **IVS** Infrastructure | Availability | Forge SLA dependent (99.5% typical) | FORGE_PLATFORM_DEPENDENCY.md, SLA.md |
| **GRM** Governance & Risk | Risk mgmt | Threat model, STRIDE analysis | THREAT_MODEL.md |
| **BCR** Business Continuity & DR | Disaster recovery | Forge-dependent; customer export strategy | BCP_DRP.md |
| **OPS** Operations | Incident response | Severity tiers, SLA, communication | INCIDENT_RESPONSE_PLAN.md |
| **SEC** Security | Vulnerability management | Disclosure policy, patching | VULNERABILITY_DISCLOSURE_POLICY.md |

---

## GDPR Alignment

| GDPR Article | Obligation | FirstTry Approach |
|------------|-----------|-------------------|
| **5** Data minimization | Read-only access; no unnecessary data collection | DATA_FLOW.md |
| **13** Transparency | Privacy policy, data handling documented | PRIVACY_POLICY.md |
| **32** Security measures | Encryption, access control, incident response | SECURITY_OVERVIEW.md + all security policies |
| **33** Breach notification | 24-hour notification for critical incidents | INCIDENT_RESPONSE_PLAN.md |
| **17** Right to erasure | Data deletion via uninstall workflow | UNINSTALL_DELETION.md |
| **20** Data portability | Export ZIP archives (machine-readable format) | EXPORT_SPEC.md |

---

## NIST Cybersecurity Framework Mapping

| NIST Function | Processes | FirstTry Implementation | Evidence |
|-----------|-----------|----------------------|----------|
| **Identify** | Asset management, risk assessment | Threat model, dependency inventory | THREAT_MODEL.md, CI_CD_EVIDENCE.md |
| **Protect** | Access control, encryption | Scope allowlist, TLS, at-rest encryption | RESOLVER_INVENTORY.md, FORGE_PLATFORM_DEPENDENCY.md |
| **Detect** | Monitoring, anomaly detection | Logs, audit trail, scanner alerts | LOGGING_MONITORING.md |
| **Respond** | Incident response | Severity tiers, SLA, escalation | INCIDENT_RESPONSE_PLAN.md |
| **Recover** | Restoration, backups | Forge platform recovery; customer exports | BCP_DRP.md |

---

## Attestation of Mapping Accuracy

**Prepared by**: FirstTry Security Team  
**Date**: 2026-02-26  
**Status**: Self-assessment (not third-party audited)

**Confirmation**: Mapping reflects current FirstTry implementation and documented controls. No claims of certification or compliance are made. This mapping is provided as-is without warranty.

---

## How to Use This Matrix

1. **For procurement**: Reference relevant framework rows when responding to RFP questions
2. **For compliance**: Map your requirements to FirstTry controls
3. **For audit prep**: Use as audit evidence index (link to detailed docs)
4. **Limitations**: This is informational; not a certification. Verify with FirstTry docs directly.

---

## Disclaimer Reiteration

This matrix is a **self-assessment** and does **NOT** constitute:
- ❌ Compliance certification (SOC2, ISO27k, etc.)
- ❌ Third-party audit evidence
- ❌ Guarantee of control effectiveness
- ❌ Warranty of regulatory compliance

FirstTry provides documentation and evidence. **Your organization is responsible for assessing if FirstTry meets your compliance requirements.**

---

## References

For detailed control documentation, see [ENTERPRISE_SECURITY_PACK_INDEX.md](ENTERPRISE_SECURITY_PACK_INDEX.md).

---

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2026-02-26 | 1.0 | Initial release |
