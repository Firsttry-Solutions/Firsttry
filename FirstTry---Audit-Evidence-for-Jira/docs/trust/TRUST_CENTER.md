# FirstTry Trust Center

**Welcome to the FirstTry Trust Center** — your comprehensive resource for security, privacy, and compliance documentation.

**Last Updated:** March 4, 2026  
**Version:** 2.14.0

---

## 🔒 Quick Security Overview

| Property | Status | Details |
|----------|--------|---------|
| **Architecture** | Read-only, No External Egress | No write permissions, no network access beyond Jira API |
| **Permissions** | `read:jira-work`, `storage:app` | Minimal scopes, least-privilege access |
| **Data Storage** | Encrypted AES-256 at rest | Forge Storage API (Atlassian-managed) |
| **Data Transmission** | TLS 1.3 in transit | All API calls encrypted |
| **Data Retention** | 90 days auto-purge | Snapshots deleted automatically |
| **Compliance** | SOC 2, ISO 27001, GDPR, CCPA | Inherits Atlassian certifications |
| **Evidence Packs** | Tamper-evident SHA256 manifests | Offline verification supported |
| **Marketplace Ready** | Automated audit passing | `run_marketplace_readiness_v2.sh` validates compliance |

---

## 📚 Documentation Index

### Security

| Document | Description | Audience |
|----------|-------------|----------|
| [Security Whitepaper](security_whitepaper.md) | Comprehensive security architecture, controls, threat model, compliance | Security teams, CISOs, auditors |
| [Threat Model](threat_model.md) | STRIDE analysis, attack vectors, mitigations, residual risks | Security engineers, pen testers |
| [Incident Response Plan](incident_response.md) | P0-P3 incident classification, response procedures, breach notification | Security teams, compliance officers |
| [Responsible Disclosure](responsible_disclosure.md) | Vulnerability reporting process, safe harbor policy, coordinated disclosure | Security researchers, bug bounty hunters |

### Privacy and Data Protection

| Document | Description | Audience |
|----------|-------------|----------|
| [Data Handling Policy](data_handling.md) | GDPR/CCPA compliance, data collection, processing, data subject rights | Privacy officers, legal teams |
| [Data Retention Policy](data_retention.md) | Retention periods (90 days), auto-purge mechanisms, deletion procedures | Compliance teams, customers |
| [Subprocessors](subprocessors.md) | Third-party processors (Atlassian only), GDPR Article 28 compliance | Legal teams, procurement |
| [Vendor Security](vendor_security.md) | Vendor selection criteria, security assessment, ongoing monitoring | Security teams, procurement |

### Compliance

| Document | Description | Audience |
|----------|-------------|----------|
| [SOC 2 Control Mapping](soc2/SOC2_CONTROL_MAPPING.md) | Trust Services Criteria (CC1-CC9, Availability, Confidentiality), evidence sources | Auditors, compliance teams, enterprise buyers |
| [Enterprise Security Questionnaire](ENTERPRISE_SECURITY_QUESTIONNAIRE.md) | Pre-filled vendor security questionnaire (typical buyer questions) | Procurement teams, InfoSec reviewers |

### Legal

| Document | Description | Audience |
|----------|-------------|----------|
| [Privacy Policy](../legal/PRIVACY_POLICY.md) | Data collection, use, retention, disclosure (GDPR/CCPA) | End users, legal teams |
| [Terms of Service](../legal/TERMS_OF_SERVICE.md) | Usage terms, warranties, limitations of liability | Customers, legal teams |

### Operations

| Document | Description | Audience |
|----------|-------------|----------|
| [Support SLA](../support/SUPPORT_SLA.md) | Support severity levels (P0-P3), response times, escalation | Customers, support teams |

### Technical

| Document | Description | Audience |
|----------|-------------|----------|
| [Trust Center Architecture](TRUST_CENTER_ARCHITECTURE.md) | System diagrams, Forge boundary, data flow, evidence pack design | Technical architects, developers |
| [Reviewer E2E Proof Pack](../reviewer/REVIEWER_E2E_PROOF_PACK.md) | Evidence pack system documentation (existing, created pre-trust center) | Atlassian Marketplace reviewers, auditors |

---

## 🎯 For Enterprise Buyers

### Due Diligence Checklist

If your organization is evaluating FirstTry for procurement, here's what you need:

| Task | Document | Status |
|------|----------|--------|
| Review security architecture | [Security Whitepaper](security_whitepaper.md) | ✅ Available |
| Assess threats and mitigations | [Threat Model](threat_model.md) | ✅ Available |
| Verify data handling practices | [Data Handling Policy](data_handling.md) | ✅ Available |
| Confirm data retention | [Data Retention Policy](data_retention.md) | ✅ Available |
| Review subprocessors (GDPR) | [Subprocessors](subprocessors.md) | ✅ Available |
| Check SOC 2 compliance | [SOC 2 Control Mapping](soc2/SOC2_CONTROL_MAPPING.md) | ✅ Available |
| Complete security questionnaire | [Enterprise Security Questionnaire](ENTERPRISE_SECURITY_QUESTIONNAIRE.md) | ✅ Available |
| Review incident response | [Incident Response Plan](incident_response.md) | ✅ Available |
| Verify Atlassian compliance | [Atlassian Trust Center](https://www.atlassian.com/trust) | ✅ External (Atlassian SOC 2 Type II) |

### Typical Buyer Questions

**Q: Is FirstTry SOC 2 compliant?**  
A: FirstTry inherits Atlassian's SOC 2 Type II certification. We have documented our control mapping in [SOC2_CONTROL_MAPPING.md](soc2/SOC2_CONTROL_MAPPING.md). FirstTry implements 39 controls; 12 are inherited from Atlassian.

**Q: Where is my data stored?**  
A: Data is stored in Atlassian Cloud infrastructure in your selected region (US, EU, or APAC). FirstTry inherits your Jira data residency configuration. See [Data Handling Policy](data_handling.md#10-cross-border-data-transfers).

**Q: Does FirstTry share data with third parties?**  
A: No. FirstTry has **zero subprocessors** beyond Atlassian (the Forge platform provider). No analytics, no CDNs, no external APIs. See [Subprocessors](subprocessors.md).

**Q: How long is data retained?**  
A: Snapshots are auto-purged after **90 days**. Uninstalling the app deletes all data immediately. See [Data Retention Policy](data_retention.md).

**Q: Can FirstTry exfiltrate data?**  
A: No. FirstTry has **no external network egress** (enforced by Forge platform). The Marketplace audit script verifies this on every deployment. See [Security Whitepaper](security_whitepaper.md#4-security-controls).

**Q: What permissions does FirstTry require?**  
A: Read-only permissions (`read:jira-work`, `storage:app`). No write permissions, no admin permissions, no Jira configuration changes. See [manifest.yml](../../manifest.yml).

**Q: How do I report a security vulnerability?**  
A: Email security@firsttry.run or use our [Responsible Disclosure](responsible_disclosure.md) process. We respond within 24 hours.

---

## 🏆 Certifications and Compliance

### FirstTry

| Standard | Status | Evidence |
|----------|--------|----------|
| Atlassian Marketplace Security Review | ✅ Approved | Listed on Atlassian Marketplace |
| Evidence Pack System | ✅ Operational | [Reviewer E2E Proof Pack](../reviewer/REVIEWER_E2E_PROOF_PACK.md) |
| Marketplace Readiness Audit v2 | ✅ Passing | `tools/marketplace_audit/run_marketplace_readiness_v2.sh` |
| Read-Only Architecture | ✅ Verified | No write scopes in manifest, no external egress |
| SOC 2 Control Mapping | ✅ Documented | [SOC2_CONTROL_MAPPING.md](soc2/SOC2_CONTROL_MAPPING.md) |

**Note:** FirstTry has not yet undergone independent SOC 2 audit. We inherit Atlassian's certifications for infrastructure.

### Atlassian (Inherited)

| Standard | Status | Audit Report |
|----------|--------|--------------|
| SOC 2 Type II | ✅ Certified | [Atlassian Trust Center](https://www.atlassian.com/trust/compliance/soc2) |
| ISO 27001 | ✅ Certified | [Atlassian Trust Center](https://www.atlassian.com/trust/compliance/iso-27001) |
| ISO 27018 | ✅ Certified | [Atlassian Trust Center](https://www.atlassian.com/trust/compliance/iso-27018) |
| GDPR | ✅ Compliant | [Atlassian DPA](https://www.atlassian.com/legal/data-processing-addendum) |
| CCPA | ✅ Compliant | [Atlassian Privacy Policy](https://www.atlassian.com/legal/privacy-policy) |
| CSA STAR Level 2 | ✅ Certified | [Atlassian Trust Center](https://www.atlassian.com/trust) |

---

## 🛠️ Verification Tools

FirstTry provides automated tools for security verification:

| Tool | Purpose | Command | Expected Output |
|------|---------|---------|-----------------|
| **Marketplace Audit v2** | Verify marketplace readiness (no write scopes, no external egress, required docs) | `bash tools/marketplace_audit/run_marketplace_readiness_v2.sh` | `FINAL_VERDICT.txt` = PASS |
| **Trust Center Validator** | Verify all trust docs present | `bash tools/trust_center/verify_trust_center.sh` | All docs present, exit 0 |
| **SOC2 Evidence Pack** | Bundle SOC2 mapping + security docs | `bash tools/soc2_mapping/build_soc2_evidence_pack.sh` | Tamper-evident ZIP in `/tmp/` |
| **Reviewer E2E Test** | Validate dashboard functionality and evidence generation | `npm run test:e2e` | All tests pass |
| **Evidence Pack Verifier** | Offline verification of evidence packs | `bash tools/reviewer_demo/proof_pack/verify_reviewer_proof_pack.sh <dir>` | `VERIFICATION PASSED` |

---

## 📞 Contact Information

### Security

- **Report Vulnerability:** security@firsttry.run (24-hour response)
- **PGP Key:** https://firsttry.io/pgp-key.txt
- **GitHub Security Advisory:** [Private disclosure](https://github.com/firsttry/FirstTry---Audit-Evidence-for-Jira/security/advisories)

### Privacy

- **Privacy Officer:** privacy@firsttry.run
- **Data Protection Officer (DPO):** dpo@firsttry.run
- **GDPR/CCPA Requests:** privacy@firsttry.run (48-hour response)

### Compliance

- **SOC 2 Inquiries:** compliance@firsttry.run
- **Audit Requests:** compliance@firsttry.run
- **Legal:** legal@firsttry.run

### Support

- **General Support:** support@firsttry.run
- **Technical Support:** support@firsttry.run
- **SLA:** See [Support SLA](../support/SUPPORT_SLA.md)

---

## 🔄 Updates and Notifications

### How We Communicate Changes

1. **Email Notification:** Sent to app administrators for material changes (30-day notice for subprocessor changes)
2. **In-App Banner:** Dashboard notifications for security updates
3. **GitHub Releases:** [Release notes](https://github.com/firsttry/FirstTry---Audit-Evidence-for-Jira/releases) for all changes
4. **CHANGELOG.md:** Detailed change log in repository

### Subscribe to Updates

- **GitHub Watch:** Click "Watch" on [repository](https://github.com/firsttry/FirstTry---Audit-Evidence-for-Jira) for security advisories
- **Security Mailing List:** Email security@firsttry.run with subject "Subscribe to security updates"

---

## 📜 Document Versions

All trust center documents are version-controlled:

| Document | Version | Last Updated | Next Review |
|----------|---------|--------------|-------------|
| Security Whitepaper | 1.0 | 2026-03-04 | 2026-06-04 |
| Threat Model | 1.0 | 2026-03-04 | 2026-06-04 |
| Data Handling Policy | 1.0 | 2026-03-04 | 2026-06-04 |
| Data Retention Policy | 1.0 | 2026-03-04 | 2026-06-04 |
| Incident Response Plan | 1.0 | 2026-03-04 | 2026-06-04 |
| Responsible Disclosure | 1.0 | 2026-03-04 | 2026-06-04 |
| Subprocessors | 1.0 | 2026-03-04 | 2027-03-04 (annual) |
| Vendor Security | 1.0 | 2026-03-04 | 2027-03-04 (annual) |
| SOC 2 Control Mapping | 1.0 | 2026-03-04 | 2027-03-04 (annual) |
| Trust Center (this doc) | 1.0 | 2026-03-04 | 2026-06-04 |

**Review Schedule:** Security docs quarterly, compliance docs annually.

---

## 🌐 External Resources

### Atlassian

- [Atlassian Trust Center](https://www.atlassian.com/trust)
- [Forge Security](https://developer.atlassian.com/platform/forge/security/)
- [Atlassian Marketplace](https://marketplace.atlassian.com/)
- [Atlassian Status Page](https://status.atlassian.com/)

### Compliance Frameworks

- [AICPA Trust Services Criteria (SOC 2)](https://www.aicpa.org/interestareas/frc/assuranceadvisoryservices/aicpasoc2report.html)
- [ISO 27001](https://www.iso.org/standard/27001)
- [GDPR](https://gdpr.eu/)
- [CCPA](https://oag.ca.gov/privacy/ccpa)

### Security Resources

- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CWE Top 25](https://cwe.mitre.org/top25/)

---

## ✅ Trust Center Validation

This Trust Center has been validated with automated tooling:

```bash
# Verify all required documents are present
$ bash tools/trust_center/verify_trust_center.sh
✓ All trust center documents present
✓ All legal documents present
✓ All support documents present
✓ SOC2 control mapping present
FINAL VERDICT: PASS

# Verify marketplace readiness
$ bash tools/marketplace_audit/run_marketplace_readiness_v2.sh
✓ Manifest verification: PASS (no write scopes, no external egress)
✓ External network scan: PASS (no fetch calls found)
✓ Required documentation: PASS (all docs present)
✓ Evidence harness: PASS (reviewer E2E system complete)
✓ Trust center: PASS (all trust docs present)
FINAL VERDICT: PASS
```

**Last Validation:** 2026-03-04  
**Next Validation:** Every deployment (CI/CD automated)

---

## 🏗️ Architecture

For technical details on the FirstTry architecture, see:

- [Trust Center Architecture](TRUST_CENTER_ARCHITECTURE.md) — System diagrams, Forge boundary, data flow
- [Security Whitepaper](security_whitepaper.md) — Security architecture deep dive
- [Reviewer E2E Proof Pack](../reviewer/REVIEWER_E2E_PROOF_PACK.md) — Evidence pack architecture

---

## 📊 Transparency

FirstTry is committed to transparency:

- ✅ **Open Documentation:** All trust docs are public (this repository)
- ✅ **Automated Verification:** Evidence packs, marketplace audit (reproducible)
- ✅ **No Hidden Egress:** Source code available for review
- ✅ **Fail-Closed Design:** Security checks fail CI/CD if violations detected
- ✅ **Responsible Disclosure:** Safe harbor for security researchers

**GitHub Repository:** https://github.com/firsttry/FirstTry---Audit-Evidence-for-Jira

---

## 📝 Legal Notices

### Limitation of Liability

FirstTry documentation is provided "as is" for informational purposes. Customers should conduct their own due diligence and consult with legal/compliance advisors.

### Atlassian Independence

FirstTry is an independent Atlassian Marketplace vendor. Atlassian does not endorse or warrant FirstTry beyond standard Marketplace approval.

### Document Authority

In case of conflict between this Trust Center and legal agreements (Terms of Service, DPA), the legal agreements take precedence.

---

**Trust Center Maintained By:** FirstTry Security & Compliance Team  
**Contact:** trust@firsttry.run  
**Version:** 2.14.0  
**Last Updated:** March 4, 2026  
**Next Review:** 2026-06-04

---

**Building Trust Through Transparency**
