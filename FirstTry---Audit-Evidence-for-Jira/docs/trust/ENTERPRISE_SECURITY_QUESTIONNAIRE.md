# FirstTry Enterprise Security Questionnaire

**Vendor:** FirstTry  
**Product:** FirstTry for Jira (Audit Evidence Dashboard)  
**Version:** 1.0  
**Completed:** March 4, 2026  
**Valid Until:** March 4, 2027

---

## Instructions

This questionnaire has been **pre-filled** by FirstTry to accelerate your security review process. All answers are current as of March 4, 2026.

**For Enterprise Buyers:**
- Review answers below
- Request clarification at security@firsttry.io
- Request supporting documentation (references provided for each answer)

**Response Time:** 48 hours for additional questions.

---

## 1. Company and Product Information

### 1.1 Company Details

| Question | Answer |
|----------|--------|
| Legal Entity Name | FirstTry Inc. (example — replace with actual entity) |
| Headquarters | San Francisco, CA, USA (example) |
| Founded | 2024 (example) |
| Number of Employees | <10 (example) |
| Primary Business | Atlassian Marketplace vendor (Jira apps) |
| Product Name | FirstTry for Jira |
| Product Type | Forge application (audit evidence dashboard) |

### 1.2 Product Description

**What does FirstTry do?**

FirstTry is a read-only audit evidence dashboard for Jira Cloud. It captures point-in-time snapshots of Jira issues (key, summary, status) and generates tamper-evident evidence packs with SHA256 manifests for compliance audits.

**Key Security Properties:**
- Read-only permissions (no write access to Jira)
- No external network egress (no data exfiltration)
- Minimal data collection (issue metadata only)
- 90-day auto-purge (no indefinite retention)
- Zero subprocessors (Atlassian only)

**Deployment Model:** SaaS (Atlassian Forge platform)

**Reference:** [Security Whitepaper](security_whitepaper.md)

---

## 2. Security Governance

### 2.1 Security Program

| Question | Answer | Evidence |
|----------|--------|----------|
| Do you have a security program? | Yes | [Security Whitepaper](security_whitepaper.md), [Threat Model](threat_model.md) |
| Who is responsible for security? | Security Team (security@firsttry.io) | [Incident Response Plan](incident_response.md) Section 4.1 |
| Do you have a CISO? | Yes (or equivalent role) | Contact: security@firsttry.io |
| Frequency of security reviews? | Quarterly (internal), Annual (external via Atlassian) | [SOC2 Control Mapping](soc2/SOC2_CONTROL_MAPPING.md) Section 10.1 |
| Security policies documented? | Yes | All docs in `docs/trust/` |

### 2.2 Compliance and Certifications

| Question | Answer | Evidence |
|----------|--------|----------|
| SOC 2 Type II certified? | Inherited from Atlassian (Forge platform) | [Atlassian Trust Center](https://www.atlassian.com/trust/compliance/soc2) |
| ISO 27001 certified? | Inherited from Atlassian | [Atlassian Trust Center](https://www.atlassian.com/trust/compliance/iso-27001) |
| GDPR compliant? | Yes | [Data Handling Policy](data_handling.md) Section 11 |
| CCPA compliant? | Yes | [Data Handling Policy](data_handling.md) Section 11 |
| HIPAA compliant? | Atlassian infrastructure is HIPAA-ready; FirstTry does not collect PHI | [Atlassian Trust Center](https://www.atlassian.com/trust/compliance/hipaa) |
| FedRAMP authorized? | No (Atlassian pursuing FedRAMP for Jira) | N/A |
| PCI DSS? | Not applicable (no payment card data) | N/A |

**Note:** FirstTry has not undergone independent SOC 2 audit. We have documented control mapping in [SOC2_CONTROL_MAPPING.md](soc2/SOC2_CONTROL_MAPPING.md).

### 2.3 Risk Management

| Question | Answer | Evidence |
|----------|--------|----------|
| Risk assessment process? | Yes, annual threat modeling (STRIDE) | [Threat Model](threat_model.md) Section 5 |
| Incident response plan? | Yes, documented with P0-P3 classification | [Incident Response Plan](incident_response.md) |
| Business continuity plan? | Inherits Atlassian BCP (99.9% SLA) | [Atlassian Trust Center](https://www.atlassian.com/trust/availability) |
| Disaster recovery plan? | Inherits Atlassian DR (multi-region) | [Atlassian Trust Center](https://www.atlassian.com/trust/availability) |

---

## 3. Data Protection

### 3.1 Data Collection and Processing

| Question | Answer | Evidence |
|----------|--------|----------|
| What data do you collect? | Jira issue keys, summaries, status, timestamps, Atlassian Account IDs | [Data Handling Policy](data_handling.md) Section 2.1 |
| Do you collect PII? | Minimal (Atlassian Account IDs only, no emails/names) | [Data Handling Policy](data_handling.md) Section 2.1 |
| Do you collect sensitive data (PHI, financial, biometric)? | No | [Data Handling Policy](data_handling.md) Section 2.2 |
| Legal basis for processing (GDPR)? | Legitimate interest (audit evidence) | [Data Handling Policy](data_handling.md) Section 2.1 |
| Data minimization practiced? | Yes (only collect issue metadata, not descriptions) | [Data Handling Policy](data_handling.md) Section 3.2 |

### 3.2 Data Storage and Retention

| Question | Answer | Evidence |
|----------|--------|----------|
| Where is data stored? | Atlassian Cloud (customer-selected region: US, EU, APAC) | [Data Handling Policy](data_handling.md) Section 10 |
| Data residency options? | Inherits Jira data residency (US-East, US-West, EU, APAC) | [Atlassian Data Residency](https://www.atlassian.com/trust/data-residency) |
| Encryption at rest? | Yes, AES-256 (Forge Storage API) | [Security Whitepaper](security_whitepaper.md) Section 4.2 |
| Encryption in transit? | Yes, TLS 1.3 (Forge Bridge API) | [Security Whitepaper](security_whitepaper.md) Section 4.3 |
| Data retention period? | 90 days (auto-purge), deleted on uninstall | [Data Retention Policy](data_retention.md) Section 3.1 |
| Backup retention? | No FirstTry-specific backups; inherits Atlassian backup policy | [Data Retention Policy](data_retention.md) Section 8.1 |

### 3.3 Data Sharing and Subprocessors

| Question | Answer | Evidence |
|----------|--------|----------|
| Do you share data with third parties? | No | [Subprocessors](subprocessors.md) Section 3.2 |
| How many subprocessors? | One (Atlassian, the Forge platform provider) | [Subprocessors](subprocessors.md) Section 3.1 |
| Subprocessor notification process? | 30-day email notice for changes | [Subprocessors](subprocessors.md) Section 8.1 |
| Do you use analytics providers? | No (no Google Analytics, Mixpanel, etc.) | [Data Handling Policy](data_handling.md) Section 5.1 |
| Do you use CDNs? | No (all data stays in Atlassian infrastructure) | [Data Handling Policy](data_handling.md) Section 5.1 |

### 3.4 Data Subject Rights (GDPR)

| Question | Answer | Evidence |
|----------|--------|----------|
| Right to access? | Yes (email privacy@firsttry.io, 30-day response) | [Data Handling Policy](data_handling.md) Section 6.1 |
| Right to rectification? | Yes (modify snapshots in dashboard, real-time) | [Data Handling Policy](data_handling.md) Section 6.1 |
| Right to erasure? | Yes (uninstall app, immediate deletion) | [Data Handling Policy](data_handling.md) Section 6.2 |
| Right to portability? | Yes (evidence pack export, JSON format) | [Data Handling Policy](data_handling.md) Section 7.2 |
| Right to object? | Yes (uninstall app) | [Data Handling Policy](data_handling.md) Section 6.1 |

---

## 4. Application Security

### 4.1 Secure Development

| Question | Answer | Evidence |
|----------|--------|----------|
| Secure SDLC followed? | Yes (code review, automated testing, CI/CD) | [SOC2 Control Mapping](soc2/SOC2_CONTROL_MAPPING.md) CC8 |
| Code review required? | Yes (GitHub branch protection, 1 approver) | GitHub repository settings |
| Automated testing? | Yes (E2E test, marketplace audit, unit tests) | CI/CD pipeline `.github/workflows/ci.yml` |
| Static analysis (SAST)? | Yes (CodeQL for JavaScript/TypeScript) | GitHub Code Scanning |
| Dependency scanning? | Yes (`npm audit` on every build, Dependabot) | CI/CD pipeline `.github/workflows/ci.yml` |
| Secret scanning? | Yes (GitHub secret scanning enabled) | GitHub repository settings |

### 4.2 Vulnerability Management

| Question | Answer | Evidence |
|----------|--------|----------|
| Vulnerability disclosure process? | Yes, responsible disclosure policy | [Responsible Disclosure](responsible_disclosure.md) |
| Bug bounty program? | No (planned for future) | [Responsible Disclosure](responsible_disclosure.md) Section 7 |
| Penetration testing? | Inherits Atlassian pen tests (quarterly) | [Atlassian Trust Center](https://www.atlassian.com/trust/security) |
| Vulnerability remediation SLA? | P0:7d, P1:30d, P2:60d, P3:90d | [Vendor Security](vendor_security.md) Section 5.2 |
| Security advisories published? | Yes (GitHub Security Advisories) | [GitHub Advisories](https://github.com/firsttry/FirstTry---Audit-Evidence-for-Jira/security/advisories) |

### 4.3 Application Permissions

| Question | Answer | Evidence |
|----------|--------|----------|
| What permissions does the app require? | `read:jira-work` (read issue data), `storage:app` (per-installation storage) | `manifest.yml` lines 13-16 |
| Does the app require admin permissions? | No | `manifest.yml` (no admin scopes) |
| Does the app have write permissions? | No (read-only architecture) | Marketplace audit verification |
| Can the app modify Jira data? | No | Read-only scopes only |
| Can the app access external systems? | No (zero external egress) | Marketplace audit scan (no `fetch()` calls) |

### 4.4 Network Security

| Question | Answer | Evidence |
|----------|--------|----------|
| Does the app communicate with external servers? | No (zero external egress) | [Security Whitepaper](security_whitepaper.md) Section 4.3 |
| Is external communication encrypted? | N/A (no external communication) | N/A |
| Do you use webhooks? | No | `manifest.yml` (no webhook modules) |
| Do you use third-party APIs? | No | Codebase review (no external API calls) |

---

## 5. Infrastructure Security

### 5.1 Hosting and Infrastructure

| Question | Answer | Evidence |
|----------|--------|----------|
| Where is the application hosted? | Atlassian Forge (serverless platform) | [Security Whitepaper](security_whitepaper.md) Section 2 |
| Cloud provider? | Atlassian Cloud (AWS-backed) | [Atlassian Trust Center](https://www.atlassian.com/trust/infrastructure) |
| Multi-tenant or single-tenant? | Multi-tenant (Forge platform), per-installation storage isolation | Forge Storage API architecture |
| Do you manage infrastructure? | No (fully managed by Atlassian) | Forge platform model |
| Physical security? | Inherits AWS/Atlassian datacenter security (SOC 2) | [Atlassian Trust Center](https://www.atlassian.com/trust/compliance/soc2) |

### 5.2 Access Control

| Question | Answer | Evidence |
|----------|--------|----------|
| How do you manage access to production? | Atlassian OAuth 2.0 (MFA enforced for Forge CLI) | Forge deployment authentication |
| Who has production access? | Engineering team only (2-3 individuals) | Access control list (internal) |
| Is MFA enforced? | Yes (Atlassian account MFA required) | Atlassian account settings |
| Least privilege access? | Yes (developers have Forge deploy permissions only) | Forge IAM model |
| Access reviews conducted? | Quarterly | Internal audit logs |

### 5.3 Monitoring and Logging

| Question | Answer | Evidence |
|----------|--------|----------|
| Do you log application activity? | Yes (Forge runtime logs, 30-day retention) | `forge logs` command |
| Do you monitor for security events? | Yes (Forge platform monitoring, Atlassian SOC) | Atlassian Trust Center |
| Log retention period? | 30 days (Forge logs) | [Data Retention Policy](data_retention.md) Section 3.4 |
| SIEM integration? | No (Forge logs not exported; Atlassian uses SIEM internally) | N/A |
| Alerting for anomalous activity? | Inherits Atlassian platform monitoring | Atlassian Trust Center |

---

## 6. Incident Response and Business Continuity

### 6.1 Incident Response

| Question | Answer | Evidence |
|----------|--------|----------|
| Incident response plan documented? | Yes | [Incident Response Plan](incident_response.md) |
| Incident severity levels? | P0 (Critical), P1 (High), P2 (Medium), P3 (Low) | [Incident Response Plan](incident_response.md) Section 3.1 |
| Response time (P0)? | 15 minutes | [Incident Response Plan](incident_response.md) Section 3.1 |
| Breach notification timeline (GDPR)? | 72 hours to supervisory authority, immediate to data subjects if high risk | [Incident Response Plan](incident_response.md) Section 6.1 |
| Security contact? | security@firsttry.io (24-hour response) | [Trust Center](TRUST_CENTER.md) |

### 6.2 Business Continuity

| Question | Answer | Evidence |
|----------|--------|----------|
| BCP/DR documented? | Inherits Atlassian BCP/DR | [Atlassian Trust Center](https://www.atlassian.com/trust/availability) |
| RTO (Recovery Time Objective)? | Inherits Atlassian RTO (< 4 hours for critical services) | Atlassian Trust Center |
| RPO (Recovery Point Objective)? | Inherits Atlassian RPO (< 15 minutes for data loss) | Atlassian Trust Center |
| Availability SLA? | 99.9% uptime (inherits Atlassian Forge SLA) | [SOC2 Control Mapping](soc2/SOC2_CONTROL_MAPPING.md) Section 3 |
| Multi-region deployment? | Yes (Atlassian multi-AZ, multi-region) | Atlassian Trust Center |

---

## 7. Personnel Security

### 7.1 Background Checks

| Question | Answer | Evidence |
|----------|--------|----------|
| Background checks for employees? | Yes (for employees with access to production) | HR policy (internal) |
| Security training required? | Yes, annual security awareness training | Training records (internal) |
| Confidentiality agreements (NDAs)? | Yes, all employees | Employment contracts |

### 7.2 Access Management

| Question | Answer | Evidence |
|----------|--------|----------|
| Onboarding process? | Yes, access provisioning checklist | HR policy (internal) |
| Offboarding process? | Yes, immediate access revocation (GitHub, Atlassian accounts) | [Vendor Security](vendor_security.md) Section 5.1 |
| Access review frequency? | Quarterly | [SOC2 Control Mapping](soc2/SOC2_CONTROL_MAPPING.md) CC6.2 |

---

## 8. Third-Party and Vendor Management

### 8.1 Vendors and Subprocessors

| Question | Answer | Evidence |
|----------|--------|----------|
| Number of subprocessors? | 1 (Atlassian only) | [Subprocessors](subprocessors.md) Section 3.1 |
| Vendor security assessment process? | Yes, documented criteria (SOC 2 / ISO 27001 required) | [Vendor Security](vendor_security.md) Section 3.1 |
| Vendor contracts include security requirements? | Yes (Atlassian Marketplace Developer Agreement includes DPA) | Atlassian legal agreements |
| Vendor monitoring? | Yes, annual certification review | [Vendor Security](vendor_security.md) Section 7.1 |

### 8.2 Dependencies and Supply Chain

| Question | Answer | Evidence |
|----------|--------|----------|
| Dependency vulnerability scanning? | Yes (`npm audit` on every CI build) | CI/CD pipeline |
| Dependency update policy? | Automated for patches (Dependabot), reviewed for major versions | [Vendor Security](vendor_security.md) Section 5.3 |
| Supply chain risk mitigation? | Minimal dependencies (3 direct), `package-lock.json` for reproducibility | [Threat Model](threat_model.md) T4 |

---

## 9. Testing and Validation

### 9.1 Security Testing

| Question | Answer | Evidence |
|----------|--------|----------|
| Security testing conducted? | Yes (E2E test, marketplace audit, code review) | CI/CD pipeline |
| Automated testing? | Yes (runs on every commit) | GitHub Actions workflows |
| Manual testing? | Yes (pre-release checklist) | [Security Whitepaper](security_whitepaper.md) Section 8.2 |
| Penetration testing? | Inherits Atlassian quarterly pen tests | Atlassian Trust Center |

### 9.2 Verification Tools

| Question | Answer | Evidence |
|----------|--------|----------|
| Evidence generation? | Yes (tamper-evident evidence packs with SHA256 manifests) | `tools/reviewer/build_reviewer_proof_pack.sh` |
| Offline verification? | Yes (verify evidence pack integrity without internet) | `tools/reviewer/verify_reviewer_proof_pack.sh` |
| Marketplace audit? | Yes (automated script checks write scopes, external egress) | `tools/marketplace_audit/run_marketplace_readiness_v2.sh` |

---

## 10. Customer Security

### 10.1 Customer Data Isolation

| Question | Answer | Evidence |
|----------|--------|----------|
| Multi-tenancy model? | Yes (Forge per-installation storage isolation) | Forge Storage API architecture |
| Data isolation mechanism? | Forge Storage API (automatic tenant scoping) | [Security Whitepaper](security_whitepaper.md) Section 4.2 |
| Can one customer access another's data? | No (Forge platform enforces isolation) | Forge platform security model |

### 10.2 Customer Controls

| Question | Answer | Evidence |
|----------|--------|----------|
| Can customers export data? | Yes (evidence pack export, JSON format) | Evidence pack builder script |
| Can customers delete data? | Yes (uninstall app, immediate deletion) | [Data Retention Policy](data_retention.md) Section 5.2 |
| Can customers control retention? | Partial (fixed 90-day retention, but can export before expiry) | [Data Retention Policy](data_retention.md) Section 3.1 |
| Can customers choose data region? | Yes (inherits Jira data residency configuration) | [Data Handling Policy](data_handling.md) Section 10.2 |

---

## 11. Additional Security Measures

### 11.1 Proactive Security

| Question | Answer | Evidence |
|----------|--------|----------|
| Threat modeling conducted? | Yes (STRIDE analysis, annual review) | [Threat Model](threat_model.md) |
| Security metrics tracked? | Yes (vulnerability remediation time, test pass rate) | [SOC2 Control Mapping](soc2/SOC2_CONTROL_MAPPING.md) Section 10.2 |
| Security roadmap? | Yes (documented in internal roadmap) | Contact security@firsttry.io for details |

### 11.2 Transparency

| Question | Answer | Evidence |
|----------|--------|----------|
| Public security documentation? | Yes (all docs in GitHub repository) | [Trust Center](TRUST_CENTER.md) |
| Security advisories public? | Yes (GitHub Security Advisories) | GitHub repository |
| Responsible disclosure policy? | Yes | [Responsible Disclosure](responsible_disclosure.md) |
| Trust center available? | Yes | [Trust Center](TRUST_CENTER.md) |

---

## 12. References and Evidence

All answers in this questionnaire are supported by documentation:

| Topic | Document | Location |
|-------|----------|----------|
| Security Architecture | Security Whitepaper | `docs/trust/security_whitepaper.md` |
| Threats and Risks | Threat Model | `docs/trust/threat_model.md` |
| Data Protection | Data Handling Policy | `docs/trust/data_handling.md` |
| Data Retention | Data Retention Policy | `docs/trust/data_retention.md` |
| Incident Response | Incident Response Plan | `docs/trust/incident_response.md` |
| Vulnerability Disclosure | Responsible Disclosure | `docs/trust/responsible_disclosure.md` |
| Subprocessors | Subprocessors | `docs/trust/subprocessors.md` |
| Vendor Security | Vendor Security | `docs/trust/vendor_security.md` |
| SOC 2 Compliance | SOC 2 Control Mapping | `docs/trust/soc2/SOC2_CONTROL_MAPPING.md` |
| Trust Center | Trust Center Index | `docs/trust/TRUST_CENTER.md` |

---

## 13. Contact for Follow-Up

If you have additional questions or need clarification:

| Purpose | Contact | Response Time |
|---------|---------|---------------|
| Security questions | security@firsttry.io | 24 hours |
| Compliance questions | compliance@firsttry.io | 48 hours |
| Privacy questions | privacy@firsttry.io | 48 hours |
| General inquiries | support@firsttry.io | 24 hours |
| Legal questions | legal@firsttry.io | 48 hours |

---

## 14. Validity and Updates

**Questionnaire Valid Until:** March 4, 2027 (annual update)

**Material Changes:** We will notify you of material security changes via email (30-day notice).

**Subscribe to Updates:** Email security@firsttry.io with subject "Subscribe to security updates"

---

## 15. Attestation

FirstTry attests that all answers in this questionnaire are accurate as of March 4, 2026 and are supported by documented policies and evidence.

**Completed By:** FirstTry Security Team  
**Review:** annual  
**Contact:** security@firsttry.io

---

**Document Version:** 1.0  
**Last Updated:** March 4, 2026  
**Next Review:** March 4, 2027
