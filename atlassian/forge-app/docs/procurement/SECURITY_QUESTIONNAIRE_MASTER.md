# Security Questionnaire Master

**Version**: 1.0  
**Owner**: FirstTry Solutions  
**Last Updated**: 2026-02-26  
**Review Cycle**: Annual

---

## How to Use

This document contains pre-answered security questionnaire items for vendor diligence. Copy relevant Q&A into your vendor assessment tool or procurement system.

Each answer references supporting documentation. For details, follow the links.

---

## General Information

**Q: What is FirstTry?**  
A: FirstTry is an Atlassian Forge application providing Jira governance and compliance reporting. See [SECURITY_OVERVIEW.md](../trust/SECURITY_OVERVIEW.md).

**Q: Who develops FirstTry?**  
A: FirstTry Solutions.

**Q: What is the current version?**  
A: 0.4.1 (specified in manifest.yml). See [CHANGELOG.md](../CHANGELOG.md) for release history.

**Q: Is FirstTry certified (SOC2, ISO27k, etc.)?**  
A: **No**. FirstTry is NOT certified. We provide documentation and evidence of security practices. See disclaimer in [ENTERPRISE_SECURITY_PACK_INDEX.md](ENTERPRISE_SECURITY_PACK_INDEX.md).

---

## Scope and Data

**Q: What data does FirstTry access?**  
A: User names, emails, user IDs, project metadata, and permission assignments from Jira Cloud API (read-only). See [DATA_FLOW.md](../trust/DATA_FLOW.md).

**Q: What scopes does FirstTry request?**  
A: `read:jira-user`, `read:jira-work`, and `storage:app` (read-only scopes). See [RESOLVER_INVENTORY.md](../trust/RESOLVER_INVENTORY.md).

**Q: Does FirstTry perform any WRITE operations?**  
A: **No**. All API calls are GET (read-only). Verified by mutation detection testing. See [RESOLVER_INVENTORY.md](../trust/RESOLVER_INVENTORY.md) and [CI_CD_EVIDENCE.md](../operations/CI_CD_EVIDENCE.md).

**Q: Does FirstTry make external network calls outside of Jira API?**  
A: **No**. Zero external egress. All data transits authenticated Jira requestJira() API only. See [SECURITY_OVERVIEW.md](../trust/SECURITY_OVERVIEW.md).

---

## Data Protection

**Q: How is data encrypted?**  
A: Encryption in transit: TLS 1.3 (Forge platform). At rest: AES-256 by Forge Storage (Atlassian-managed). FirstTry does not manage keys. See [FORGE_PLATFORM_DEPENDENCY.md](../trust/FORGE_PLATFORM_DEPENDENCY.md).

**Q: How long is data retained?**  
A: Default 90 days per snapshot policy. Configurable via uninstall or manual cleanup. See [DATA_FLOW.md](../trust/DATA_FLOW.md).

**Q: What happens when FirstTry is uninstalled?**  
A: Forge Storage is cleared immediately. Atlassian deletes backups within 30 days. See [UNINSTALL_DELETION.md](../trust/UNINSTALL_DELETION.md).

**Q: Does FirstTry use data for AI training or analytics?**  
A: **No**. User data is not trained on, analyzed, or sold. See [DATA_CLASSIFICATION_AND_PII.md](../trust/DATA_CLASSIFICATION_AND_PII.md).

---

## Compliance and Standards

**Q: Which compliance frameworks does FirstTry address?**  
A: GDPR, SOC2, ISO27k, CAIQ v4 (mapping only; no certifications). See [CONTROL_MAPPING_MATRIX.md](CONTROL_MAPPING_MATRIX.md).

**Q: How does FirstTry handle GDPR rights?**  
A: Data subject access via export. Deletion via uninstall. See [PRIVACY_POLICY.md](../trust/PRIVACY_POLICY.md) and [DATA_CLASSIFICATION_AND_PII.md](../trust/DATA_CLASSIFICATION_AND_PII.md).

**Q: What is the data residency policy?**  
A: Follows Jira Cloud region selection (no override). Customer chooses region at Jira setup. See [FORGE_PLATFORM_DEPENDENCY.md](../trust/FORGE_PLATFORM_DEPENDENCY.md) and [CUSTOMER_RESPONSIBILITIES.md](../trust/CUSTOMER_RESPONSIBILITIES.md).

---

## Supply Chain and Dependencies

**Q: What are FirstTry's dependencies?**  
A: Node.js (runtime), npm (package manager), and Atlassian Forge (platform). See [CI_CD_EVIDENCE.md](../operations/CI_CD_EVIDENCE.md) for dependency tree.

**Q: Does FirstTry have high-severity dependencies?**  
A: **No**. npm audit enforces zero high-severity findings. See [CI_CD_EVIDENCE.md](../operations/CI_CD_EVIDENCE.md).

**Q: Who are FirstTry's subprocessors?**  
A: Atlassian Forge and Jira Cloud only. See [SUBPROCESSORS.md](../trust/SUBPROCESSORS.md).

**Q: Which Atlassian subprocessors does FirstTry depend on?**  
A: See Atlassian's public subprocessor list: https://www.atlassian.com/legal/subprocessors

---

## Security Practices

**Q: How does FirstTry handle vulnerabilities?**  
A: Responsible disclosure policy with 90-day embargo. See [VULNERABILITY_DISCLOSURE_POLICY.md](../trust/VULNERABILITY_DISCLOSURE_POLICY.md).

**Q: What is the incident response process?**  
A: Severity classification, investigation, patch, and communication. See [INCIDENT_RESPONSE_PLAN.md](../operations/INCIDENT_RESPONSE_PLAN.md).

**Q: Does FirstTry perform static code analysis?**  
A: Yes. Forge lint, ESLint, TypeScript strict mode, and dependency scanning (npm audit, trivy). See [SECURE_SDLC_POLICY.md](../operations/SECURE_SDLC_POLICY.md).

**Q: How is access to FirstTry's code controlled?**  
A: MFA required for maintainers. Code review enforced on all PRs. See [ACCESS_CONTROL_POLICY.md](../operations/ACCESS_CONTROL_POLICY.md) and [RBAC_MATRIX.md](../operations/RBAC_MATRIX.md).

---

## Availability and Support

**Q: What is FirstTry's uptime SLA?**  
A: **NO uptime SLA**. FirstTry depends on Atlassian Forge (typically 99.5%). See [SLA.md](../operations/SLA.md).

**Q: What support channels are available?**  
A: Email (support@firsttry.run, security.contact@firsttry.run). See [SUPPORT_POLICY.md](../operations/SUPPORT_POLICY.md).

**Q: What is the breach notification timeline?**  
A: 24 hours for critical incidents (best-effort). See [INCIDENT_RESPONSE_PLAN.md](../operations/INCIDENT_RESPONSE_PLAN.md).

---

## Legal and Contractual

**Q: What is the license?**  
A: See [TERMS_OF_SERVICE.md](../trust/TERMS_OF_SERVICE.md) (proprietary Forge app).

**Q: Is there a liability limit?**  
A: Yes. Liability is disclaimed as-is. See [TERMS_OF_SERVICE.md](../trust/TERMS_OF_SERVICE.md) and [SLA.md](../operations/SLA.md).

**Q: What happens if FirstTry is discontinued?**  
A: 6 months notice (if possible) in CHANGELOG.md. 3-month sunset support. See [SUPPORT_POLICY.md](../operations/SUPPORT_POLICY.md).

---

## Threat and Risk

**Q: What are the known threats?**  
A: See [THREAT_MODEL.md](../trust/THREAT_MODEL.md) (STRIDE analysis with mitigations).

**Q: What are the residual risks?**  
A: Primary: Forge platform dependency. Secondary: Dependency vulnerabilities. See [THREAT_MODEL.md](../trust/THREAT_MODEL.md).

**Q: Can FirstTry access other customers' data?**  
A: **No**. Forge per-tenant isolation prevents cross-tenant access. See [ARCHITECTURE.md](../trust/ARCHITECTURE.md).

---

## End of Questionnaire

For more details, see [ENTERPRISE_SECURITY_PACK_INDEX.md](ENTERPRISE_SECURITY_PACK_INDEX.md) for full documentation navigation.

---

## Contact

Questions? Email contact@firsttry.run or security.contact@firsttry.run.
