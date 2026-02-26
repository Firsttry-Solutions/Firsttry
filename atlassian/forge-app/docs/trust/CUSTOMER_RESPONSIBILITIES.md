# Customer Responsibilities

**Version**: 1.0  
**Owner**: FirstTry Solutions  
**Last Updated**: 2026-02-26  
**Review Cycle**: Annual

---

## Overview

This document defines responsibilities of Jira Cloud customers for secure and compliant use of FirstTry.

Responsibility is shared between:
- **Atlassian** (platform provider; see FORGE_PLATFORM_DEPENDENCY.md)
- **FirstTry** (application provider; see SECURITY_OVERVIEW.md)
- **Customer** (end user organization; this document)

---

## 1. Atlassian Site Configuration

**Your responsibility**:
- Select appropriate data residency region during Jira Cloud setup
- FirstTry inherits this region; app provides no override capability
- Enable multi-factor authentication (MFA) for admin accounts
- Maintain Jira Cloud subscription and support agreements

**We provide**: Documentation (FORGE_PLATFORM_DEPENDENCY.md) explaining residency guarantees.

---

## 2. Jira Permission Hygiene

**Your responsibility**:
- Define appropriate Jira permission roles (project lead, admin, viewer)
- Assign users to roles based on least-privilege principle
- Review user access quarterly (see RBAC_MATRIX in docs/operations/)
- Remove unused users or revoke elevated permissions

**Scope**: FirstTry reads these permissions and generates compliance reports. Jira permission configuration is entirely under your control.

**We provide**: Compliance reporting tool to audit permissions; does not enforce policies.

---

## 3. Export and Backup Management

**Your responsibility**:
- Export compliance evidence regularly (recommended: monthly)
- Store export ZIPs securely (encrypted storage, access controls)
- Retain exports for regulatory compliance duration (industry-dependent)
- Delete exports when retention period expires
- Never share exports with unauthorized parties

**We provide**: Deterministic, signed export archives with integrity markers for secure storage.

---

## 4. Uninstall and Data Deletion

**Your responsibility**:
- Initiate app uninstallation if you no longer need FirstTry
- Understand that uninstallation triggers data deletion workflow
- Request deletion from Atlassian support if you want faster backlog cleanup (30-day SLA is platform limit)

**Caveat**: FirstTry cannot independently verify deletion from Atlassian backups. Trust Atlassian SLA.

**We provide**: Clear deletion workflow (docs/trust/UNINSTALL_DELETION.md) and uninstall handlers.

---

## 5. Security Contact Management

**Your responsibility**:
- Maintain current security contact email in Jira admin settings (if applicable)
- Ensure security@firsttry.run can reach you for critical security incidents
- Nominate a security officer or point-of-contact for incident notifications

**We provide**: SECURITY_CONTACT.md with response SLAs and severity definitions.

---

## 6. Incident Response and Reporting

**Your responsibility**:
- Monitor FirstTry dashboard for exporting errors or audit anomalies
- Report security concerns or suspected breaches to security@firsttry.run
- Cooperate in incident investigation (provide logs, reproduce steps)
- Communicate findings to your stakeholders and regulators as required

**We provide**: INCIDENT_RESPONSE_PLAN.md with severity classification and SLA response times.

---

## 7. Compliance and Regulatory Obligations

**Your responsibility**:
- Understand your industry's compliance requirements (GDPR, SOC2, ISO27k, etc.)
- Use ENTERPRISE_SECURITY_PACK_INDEX.md to map FirstTry capabilities to your compliance framework
- Maintain records of exports and audit logs per your policy
- Document how FirstTry supports your compliance posture
- Consult legal counsel on compliance obligations

**Limitation**: FirstTry provides documentation and tools; you are responsible for compliance decisions.

**We provide**: Control mapping matrix (docs/procurement/CONTROL_MAPPING_MATRIX.md) and threat model reference.

---

## 8. Regional and Data Residency Responsibility

**Your responsibility**:
- Select Jira Cloud region aligned with your data residency requirements
- Ensure selected region meets regulatory requirements (GDPR EU, CCPA California, etc.)
- No override available; region is set at Jira Cloud account level

**We provide**: Documentation confirming app respects Jira's residency selection.

---

## 9. Dependency and Supply Chain Management

**Your responsibility**:
- Review SBOM (docs/evidence/*/cyclonedx_sbom.json) for dependency transparency
- Conduct your own dependency risk assessment if required
- Report supply chain concerns to security@firsttry.run
- Include FirstTry in your vendor assessment program if applicable

**We provide**: CycloneDX SBOM, npm audit results, and trivy scan logs in evidence bundles.

---

## 10. Residency and Subprocessor Awareness

**Your responsibility**:
- Review Atlassian's published subprocessor list (atlassian.com/legal/subprocessors)
- Ensure Atlassian's subprocessors align with your compliance requirements
- Notify Atlassian if you object to subprocessor use
- Escalate subprocessor concerns to Atlassian support, not FirstTry

**We provide**: Link to Atlassian's subprocessor list and explanation that FirstTry does not control subprocessors.

---

## 11. Support and Escalation

**Your responsibility**:
- Report functional bugs and feature requests through appropriate channels
- Provide clear reproduction steps for issues
- Understand that FirstTry may be discontinued with notice in CHANGELOG.md

**We provide**: SUPPORT_POLICY.md with contact channels and expected response times.

---

## 12. Documentation Review

**Your responsibility**:
- Read and understand relevant sections of this documentation
- Review THREAT_MODEL.md to understand residual risks you are accepting
- Validate that FirstTry's capabilities meet your audit and compliance needs before installing

**We provide**: Complete and transparent documentation with no hidden limitations.

---

## Summary: Shared Responsibility Matrix

| Area | Atlassian | FirstTry | Customer |
|------|-----------|----------|----------|
| **Data Residency Selection** | Provides options | Respects choice | Selects region |
| **Permission Configuration** | Manages Jira Core | Reads & reports | Defines policies |
| **Infrastructure & Uptime** | Provides Forge | Depends on it | Must plan for outages |
| **Export Security** | Provides storage | Creates signed ZIPs | Secures & retains exports |
| **Data Deletion** | Implements SLA | Clears storage | Initiates uninstall |
| **Compliance Mapping** | General guidance | Control documentation | Compliance strategy |
| **Incident Response** | Platform incidents | App vulnerabilities | Organizational IR |

---

## References

- [FORGE_PLATFORM_DEPENDENCY.md](FORGE_PLATFORM_DEPENDENCY.md): What Atlassian controls
- [SECURITY_OVERVIEW.md](SECURITY_OVERVIEW.md): What FirstTry controls
- [THREAT_MODEL.md](THREAT_MODEL.md): Residual risks for customer awareness
- [docs/operations/INCIDENT_RESPONSE_PLAN.md](../operations/INCIDENT_RESPONSE_PLAN.md): Response procedures
