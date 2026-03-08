# FirstTry Vendor Security Assessment

**Version:** 2.14.0  
**Last Updated:** March 4, 2026  
**Status:** Active

## 1. Overview

This document describes FirstTry's vendor security assessment process for third-party dependencies and service providers.

## 2. Vendor Categories

### 2.1 Platform Provider

| Vendor | Service | Risk Level | Assessment Frequency |
|--------|---------|------------|----------------------|
| **Atlassian** | Forge Platform Hosting | Critical | Annual |

**Rationale:** All FirstTry data resides on Atlassian infrastructure. Security depends entirely on Atlassian.

### 2.2 Development Dependencies

| Vendor | Package | Risk Level | Assessment Frequency |
|--------|---------|------------|----------------------|
| **npm Registry** | React, Forge UI Kit, storage API | High | Every major update |

**Rationale:** Supply chain attacks via compromised npm packages pose high risk (see Threat Model T4).

### 2.3 Build and Deployment

| Vendor | Service | Risk Level | Assessment Frequency |
|--------|---------|------------|----------------------|
| **GitHub** | Source code repository | High | Annual |
| **GitHub Actions** | CI/CD pipeline | High | Per workflow change |

**Rationale:** Compromised CI/CD can inject malicious code into production.

---

## 3. Vendor Selection Criteria

### 3.1 Mandatory Requirements

All vendors must meet the following baseline:

| Criterion | Description | Verification Method |
|-----------|-------------|---------------------|
| **Security Certifications** | SOC 2 Type II or ISO 27001 | Audit report review |
| **Data Protection** | GDPR/CCPA compliance | DPA review |
| **Encryption** | TLS 1.3 (transit), AES-256 (rest) | Technical documentation |
| **Incident Response** | Documented plan, 72-hour breach notification | Policy review |
| **Vulnerability Management** | Regular patching, CVE response | Security advisory subscription |
| **Access Control** | MFA enforced, least privilege | Configuration review |

### 3.2 Preferred Qualifications

| Qualification | Priority | Rationale |
|---------------|----------|-----------|
| ISO 27001 | High | Demonstrates mature security program |
| Bug bounty program | Medium | Proactive vulnerability discovery |
| Penetration testing | High | Independent security validation |
| Public security documentation | Medium | Transparency builds trust |
| Security advisories | High | Timely CVE notifications |

---

## 4. Atlassian Security Assessment

### 4.1 Assessment Summary

**Vendor:** Atlassian Pty Ltd  
**Service:** Forge Platform + Jira Cloud  
**Assessment Date:** 2026-03-04  
**Next Review:** 2027-03-04  
**Risk Level:** Low (due to strong security posture)

### 4.2 Security Posture

| Area | Rating | Evidence |
|------|--------|----------|
| **Certifications** | ✅ Excellent | SOC 2 Type II, ISO 27001, ISO 27018, CSA STAR |
| **Data Protection** | ✅ Excellent | GDPR-compliant DPA, Standard Contractual Clauses |
| **Encryption** | ✅ Excellent | TLS 1.3, AES-256, HSM-backed keys |
| **Access Control** | ✅ Excellent | OAuth 2.0, MFA enforced, RBAC |
| **Incident Response** | ✅ Excellent | Public incident response plan, 24/7 SOC |
| **Vulnerability Management** | ✅ Excellent | Bug bounty (HackerOne), quarterly pen tests |
| **Transparency** | ✅ Excellent | Public Trust Center, security advisories |

**Overall Rating:** ✅ **Approved**

### 4.3 Evidence

**Certifications (verified 2026-03-04):**
- SOC 2 Type II Report (FY2025): https://www.atlassian.com/trust/compliance/soc2
- ISO 27001 Certificate: Valid until 2027-01-15
- ISO 27018 Certificate: Valid until 2027-01-15

**Security Documentation:**
- Atlassian Trust Center: https://www.atlassian.com/trust
- Forge Security: https://developer.atlassian.com/platform/forge/security/
- Incident Response: https://www.atlassian.com/trust/security/incident-response

**Vulnerability Disclosure:**
- Bug Bounty: https://bugcrowd.com/atlassian (public program)
- Security Advisories: https://www.atlassian.com/trust/security/security-advisories

### 4.4 Risk Assessment

| Risk | Likelihood | Impact | Mitigation | Residual Risk |
|------|------------|--------|------------|---------------|
| Atlassian data breach | Low | High | Inherits Atlassian security, no external egress | Low |
| Forge runtime vulnerability | Low | High | Forge security reviews, Marketplace checks | Low |
| Service outage | Low | Medium | Atlassian 99.9% SLA, no FirstTry-specific mitigation | Low |
| Atlassian insolvency | Very Low | High | N/A (would require platform migration) | Very Low |

**Overall Risk:** Low

---

## 5. npm Dependency Assessment

### 5.1 Dependency Inventory

FirstTry uses **minimal dependencies** to reduce attack surface:

| Package | Purpose | Maintainer | Last Security Audit |
|---------|---------|------------|---------------------|
| `@forge/ui` | Forge UI Kit | Atlassian | Continuous (Atlassian-maintained) |
| `@forge/api` | Forge API client | Atlassian | Continuous (Atlassian-maintained) |
| `react` | UI framework | Meta (Facebook) | Continuous (industry standard) |

**Total Dependencies:** 3 direct, ~50 transitive (as of 2026-03-04)

### 5.2 Security Scanning

**Tools:**
- `npm audit` (run on every CI build)
- `dependabot` (GitHub automated PRs for vulnerabilities)

**Process:**
1. **Detection:** `npm audit` reports vulnerability
2. **Triage:** Security team assesses exploitability (CVSS score)
3. **Remediation:**
   - Critical (CVSS ≥ 9.0): Hotfix within 24 hours
   - High (CVSS 7.0-8.9): Patch within 7 days
   - Medium (CVSS 4.0-6.9): Patch in next release
   - Low (CVSS < 4.0): Backlog (address opportunistically)
4. **Verification:** Rerun `npm audit`, deploy to staging, test

**CI/CD Integration:**
```bash
# In .github/workflows/ci.yml
- name: Audit dependencies
  run: npm audit --audit-level=high
  # Fails build if high/critical vulnerabilities found
```

### 5.3 Dependency Update Policy

| Update Type | Approval Required | Timeline |
|-------------|-------------------|----------|
| **Patch (x.y.Z)** | Automated (Dependabot) | Weekly |
| **Minor (x.Y.0)** | Code review | Monthly |
| **Major (X.0.0)** | Security + engineering review | Quarterly |

**Lock File:** `package-lock.json` ensures reproducible builds (mitigates dependency confusion attacks).

---

## 6. GitHub Security Assessment

### 6.1 Assessment Summary

**Vendor:** GitHub (Microsoft)  
**Service:** Source control + CI/CD  
**Assessment Date:** 2026-03-04  
**Risk Level:** Low

### 6.2 Security Posture

| Area | Rating | Evidence |
|------|--------|----------|
| **Certifications** | ✅ Excellent | SOC 2 Type II, ISO 27001 |
| **Access Control** | ✅ Excellent | MFA enforced, branch protection |
| **Secret Management** | ✅ Excellent | Encrypted secrets, secret scanning |
| **Audit Logs** | ✅ Excellent | Complete audit trail |
| **Vulnerability Scanning** | ✅ Excellent | Dependabot, CodeQL, secret scanning |

**Overall Rating:** ✅ **Approved**

### 6.3 Repository Security Configuration

**Branch Protection (main branch):**
- ✅ Require pull request reviews (1 approver)
- ✅ Require status checks (CI passing)
- ✅ Require signed commits (GPG)
- ✅ No force pushes
- ✅ No deletions

**Secret Scanning:**
- ✅ Enabled for Atlassian API tokens
- ✅ Enabled for GitHub personal access tokens
- ✅ Alerts sent to security@firsttry.run

**Dependabot:**
- ✅ Security updates enabled
- ✅ Version updates enabled (weekly)

**Code Scanning (CodeQL):**
- ✅ Enabled for JavaScript/TypeScript
- ✅ Runs on every push/PR
- ✅ Blocks merge if high-severity issues found

---

## 7. Ongoing Vendor Monitoring

### 7.1 Continuous Monitoring

| Activity | Frequency | Owner |
|----------|-----------|-------|
| Review Atlassian security advisories | Weekly | Security Team |
| Monitor Atlassian status page | Daily (automated alerts) | Operations Team |
| Review npm audit results | Every CI build | CI/CD Pipeline |
| Check GitHub security advisories | Daily (automated alerts) | Security Team |
| Verify Atlassian certifications | Annually | Compliance Team |

### 7.2 Incident Response Integration

**Vendor Breach Notification:**
1. Vendor notifies FirstTry (email to security@firsttry.run)
2. FirstTry assesses impact on customers
3. FirstTry notifies affected customers (within 72 hours if GDPR breach)
4. FirstTry implements mitigations (e.g., force logout, revoke tokens)

**Example: Atlassian Breach**
- Atlassian discovers breach → Notifies FirstTry
- FirstTry assesses: "Do FirstTry customers' Jira data affected?"
- If yes: Trigger FirstTry incident response plan
- If no: Monitor situation, no customer notification

---

## 8. Vendor Offboarding

### 8.1 Removal Criteria

A vendor may be removed if:

1. **Security Incident:** Breach with customer data exposure
2. **Compliance Failure:** Loss of required certifications (SOC 2, ISO 27001)
3. **Terms of Service Changes:** Unacceptable data use or privacy changes
4. **Bankruptcy/Acquisition:** Business continuity risk
5. **Repeated Vulnerabilities:** Pattern of poor security practices

### 8.2 Offboarding Process

**For Platform Provider (Atlassian):**
- **Not feasible:** Forge apps cannot operate without Atlassian
- **Alternative:** Discontinue FirstTry product

**For Dependencies (npm packages):**
1. Identify alternative package (or remove feature)
2. Update code to remove dependency
3. Run tests (including marketplace audit, E2E)
4. Deploy to staging, verify
5. Deploy to production
6. Monitor for regressions

**For GitHub:**
1. Export repository to alternative provider (GitLab, Bitbucket)
2. Update CI/CD pipelines
3. Update documentation
4. Notify team

---

## 9. Vendor Security Questionnaire

When evaluating new vendors, FirstTry uses the following questionnaire:

### 9.1 Core Questions

1. **Certifications:**
   - Do you hold SOC 2 Type II or ISO 27001?
   - When was your last audit?
   - Can you provide audit reports?

2. **Data Protection:**
   - Are you GDPR/CCPA compliant?
   - Do you have a Data Processing Agreement?
   - Where is data stored (regions)?

3. **Encryption:**
   - Encryption in transit (TLS version)?
   - Encryption at rest (algorithm)?
   - Key management (HSM, KMS)?

4. **Access Control:**
   - MFA enforced for all accounts?
   - Least privilege access?
   - Regular access reviews?

5. **Incident Response:**
   - Do you have an incident response plan?
   - Breach notification timeline?
   - Contact for security incidents?

6. **Vulnerability Management:**
   - Frequency of patching?
   - Bug bounty program?
   - Penetration testing?

7. **Subprocessors:**
   - Do you use subprocessors?
   - Can you provide a list?
   - Notification process for changes?

8. **Audit and Compliance:**
   - Can customers audit your security?
   - Do you provide audit logs?
   - Retention period for logs?

### 9.2 Scoring

| Score | Rating | Decision |
|-------|--------|----------|
| 90-100 | Excellent | Approved |
| 70-89 | Good | Approved with monitoring |
| 50-69 | Fair | Approved with mitigations |
| < 50 | Poor | Rejected |

---

## 10. References

- [Atlassian Trust Center](https://www.atlassian.com/trust)
- [GitHub Security](https://github.com/security)
- [npm Security Best Practices](https://docs.npmjs.com/security-best-practices)
- [NIST SP 800-161](https://csrc.nist.gov/publications/detail/sp/800-161/rev-1/final) (Supply Chain Risk Management)
- [CIS Software Supply Chain Security Guide](https://www.cisecurity.org/insights/white-papers/cis-software-supply-chain-security-guide)
- FirstTry Threat Model: `docs/trust/threat_model.md`
- FirstTry Subprocessors: `docs/trust/subprocessors.md`

---

## 11. Vendor Security Contacts

| Vendor | Security Contact | Response Time |
|--------|------------------|---------------|
| Atlassian | security@atlassian.com | 24 hours |
| GitHub | https://bounty.github.com | 72 hours |
| npm | security@npmjs.com | 72 hours |

---

## 12. Change Log

| Date | Change | Reason |
|------|--------|--------|
| 2026-03-04 | Initial version | First release |

---

**Policy Owner:** FirstTry Security Team  
**Approved By:** Chief Information Security Officer  
**Next Review:** 2027-03-04  
**Version:** 2.14.0
