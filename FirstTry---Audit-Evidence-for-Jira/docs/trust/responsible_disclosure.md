# FirstTry Responsible Disclosure Policy

**Version:** 2.0.0  
**Last Updated:** March 4, 2026  
**Status:** Active  
**Classification:** Public

## 1. Overview

FirstTry welcomes security researchers to report vulnerabilities responsibly. This policy outlines our coordinated disclosure process and commitments.

## 2. Scope

### 2.1 In-Scope Systems

The following systems are **in scope** for vulnerability reports:

| System | URL/Identifier | Coverage |
|--------|----------------|----------|
| FirstTry Forge App | `ari:cloud:ecosystem::app/{app-id}` | All code in repository |
| Custom UI (Dashboard Gadget) | Rendered in Jira Cloud | React components, Forge UI Kit |
| Resolver Functions | Forge runtime | All functions in `src/resolvers/` |
| Evidence Generation | Build scripts | `tools/reviewer_demo/proof_pack/build_reviewer_proof_pack.sh` |
| Marketplace Audit | Verification scripts | `tools/marketplace_audit/run_marketplace_readiness_v2.sh` |

### 2.2 Out-of-Scope Systems

The following are **out of scope** (defer to Atlassian):

- ❌ Atlassian Cloud infrastructure
- ❌ Forge platform runtime
- ❌ Jira Cloud application
- ❌ Atlassian CDN/WAF
- ❌ Developer documentation (developer.atlassian.com)

**For Atlassian vulnerabilities:** Report to security@atlassian.com

---

## 3. Reporting a Vulnerability

### 3.1 How to Report

**Primary Channel: Email**
- **Address:** security@firsttry.run
- **Encryption:** PGP key available at https://firsttry.io/pgp-key.txt
- **Acknowledgment:** Within 24 hours

**Alternative: GitHub Security Advisory (Private)**
- Navigate to: https://github.com/firsttry/FirstTry---Audit-Evidence-for-Jira/security/advisories
- Click "Report a vulnerability"
- Fill out form (GitHub account required)

**DO NOT:**
- ❌ Open public GitHub issues for security bugs
- ❌ Post on social media before coordinated disclosure
- ❌ Disclose to third parties without our consent

---

### 3.2 What to Include

Please provide the following information:

1. **Vulnerability Description:**
   - Type of vulnerability (XSS, CSRF, data leak, etc.)
   - Impact assessment (CVSS score if available)
   - Affected component (Custom UI, resolver, etc.)

2. **Proof of Concept:**
   - Steps to reproduce
   - Screenshots or video (if applicable)
   - Code snippet or exploit (if safe to share)

3. **Environment:**
   - Forge environment (production/staging)
   - Browser version (if Custom UI bug)
   - Jira Cloud version (if relevant)

4. **Your Information:**
   - Name (or pseudonym)
   - Email address
   - Disclosure preference (credited/anonymous)
   - PGP key (if you want encrypted responses)

**Template:** See Section 8 for a report template.

---

## 4. Our Commitments

### 4.1 Response Timeline

| Phase | Timeline | Action |
|-------|----------|--------|
| **Acknowledgment** | **24 hours** | Confirm receipt of report |
| **Initial Assessment** | **72 hours** | Triage severity, assign owner |
| **Validation** | **7 days** | Reproduce vulnerability, confirm impact |
| **Remediation** | **30 days** (P0/P1)<br>**90 days** (P2/P3) | Develop, test, and deploy fix |
| **Disclosure** | **Coordinated** | Public disclosure after fix deployed |

### 4.2 Communication

- **Status updates:** Weekly for P0/P1, bi-weekly for P2/P3
- **Transparency:** Honest communication about fix timeline
- **Coordination:** Work with you on disclosure timeline

### 4.3 Recognition

If you desire credit:
- **Security Advisory:** Your name/handle in GitHub Security Advisory
- **Release Notes:** Credit in CHANGELOG.md
- **Hall of Fame:** Listed on firsttry.io/security (if you consent)

**Anonymous reports:** We will honor your request for anonymity.

---

## 5. Coordinated Disclosure

### 5.1 Embargo Period

We request a **90-day embargo** from initial report:

- Gives us time to develop and deploy fix
- Allows customers to update before public disclosure
- Standard practice in industry (CERT/CC recommendation)

**Early Disclosure:** If you need to disclose earlier (e.g., active exploitation), please notify us at least 7 days in advance.

### 5.2 Public Disclosure

After fix is deployed:

1. **GitHub Security Advisory:** Published with CVE (if CVSS ≥ 4.0)
2. **Release Notes:** Documented in CHANGELOG.md
3. **Customer Notification:** Email to all installations (if P0/P1)
4. **Researcher Acknowledgment:** Credited (if desired)

**Coordinated Date:** We will propose a disclosure date and coordinate with you.

---

## 6. Safe Harbor

### 6.1 Legal Protections

FirstTry commits to **not pursue legal action** against security researchers who:

1. Report in good faith
2. Follow this responsible disclosure policy
3. Do not cause harm (data exfiltration, denial of service, etc.)
4. Do not access customer data beyond proof of concept
5. Make a good faith effort to avoid privacy violations

**Scope:** This safe harbor applies only to security research, not malicious activity.

### 6.2 Excluded Activities

The following are **NOT protected** under safe harbor:

- ❌ Accessing or exfiltrating customer data
- ❌ Denial of service attacks
- ❌ Social engineering (phishing, pretexting)
- ❌ Physical attacks on Atlassian infrastructure
- ❌ Testing on production systems without prior consent

**For these cases:** Contact security@firsttry.run to request authorization.

---

## 7. Bug Bounty Program

### 7.1 Current Status

FirstTry **does not currently offer a bug bounty program**.

### 7.2 Future Plans

We may establish a bug bounty in the future. If we do:
- Program details will be published on firsttry.io/security
- Researchers will be notified via existing disclosure channels

**Incentives:** Even without financial rewards, we deeply appreciate responsible disclosure and will publicly credit researchers (with permission).

---

## 8. Vulnerability Report Template

**Subject:** [VR-YYYYMMDD] [Vulnerability Type] in [Component]

**Body:**
```
## Vulnerability Summary
[Brief description of the vulnerability]

## Severity
[Low / Medium / High / Critical]
CVSS Score: [if calculated]

## Affected Component
- Component: [Custom UI / Resolver / Evidence Pack / etc.]
- File: [src/path/to/file.ts]
- Lines: [123-456]

## Proof of Concept
### Steps to Reproduce
1. [Step 1]
2. [Step 2]
3. [Step 3]

### Expected Result
[What should happen]

### Actual Result
[What actually happens]

### Screenshots/Video
[Attach or link]

## Impact
[What can an attacker do with this vulnerability?]

## Environment
- Forge Environment: [production/staging]
- Browser: [Chrome 120 / Firefox 118 / etc.]
- Jira Cloud Version: [if relevant]

## Suggested Fix
[Optional: Your recommendation for remediation]

## Disclosure Preference
- Credit me as: [Name / Handle / Anonymous]
- Contact me at: [email@example.com]
- PGP Key: [Fingerprint or paste key]

## Additional Notes
[Any other information]
```

---

## 9. Severity Classification

We use CVSS 3.1 for severity classification:

| CVSS Score | Severity | Response Time | Example |
|------------|----------|---------------|---------|
| 9.0 - 10.0 | **Critical** | 7 days | Remote code execution, data breach |
| 7.0 - 8.9 | **High** | 30 days | XSS, privilege escalation |
| 4.0 - 6.9 | **Medium** | 60 days | CSRF, information disclosure |
| 0.1 - 3.9 | **Low** | 90 days | Non-exploitable bugs, minor config issues |

**Adjustments:** We may adjust severity based on exploitability and real-world impact.

---

## 10. Past Disclosures

### 10.1 Hall of Fame

Researchers who have responsibly disclosed vulnerabilities (with permission to list):

| Date | Researcher | Vulnerability | Severity |
|------|------------|---------------|----------|
| - | - | - | - |

*No vulnerabilities reported yet.*

### 10.2 Security Advisories

Published advisories:

- [GitHub Security Advisories](https://github.com/firsttry/FirstTry---Audit-Evidence-for-Jira/security/advisories)

---

## 11. Contact Information

### 11.1 Primary Contact

- **Email:** security@firsttry.run
- **PGP Key:** https://firsttry.io/pgp-key.txt (Fingerprint: XXXX XXXX XXXX XXXX)
- **Response Time:** 24 hours

### 11.2 Secondary Contact

- **Engineering Lead:** engineering@firsttry.run
- **Compliance Officer:** compliance@firsttry.run

### 11.3 GitHub

- **Private Advisory:** https://github.com/firsttry/FirstTry---Audit-Evidence-for-Jira/security/advisories/new

---

## 12. References

- [ISO 29147](https://www.iso.org/standard/72311.html) (Vulnerability Disclosure)
- [NIST SP 800-61r2](https://csrc.nist.gov/publications/detail/sp/800-61/rev-2/final) (Incident Handling)
- [CERT/CC Disclosure Policy](https://vuls.cert.org/confluence/display/CVD)
- [Atlassian Security Policy](https://www.atlassian.com/trust/security/security-policy)
- FirstTry Incident Response Plan: `docs/trust/incident_response.md`

---

## 13. Frequently Asked Questions

### Q1: Can I test on production?

**A:** We prefer you test on a staging environment first. If you need production access for a specific test, email security@firsttry.run for authorization.

### Q2: What if I accidentally accessed customer data?

**A:** Immediately stop testing and notify us at security@firsttry.run. Describe what data was accessed. We will work with you under safe harbor (no legal action if good faith).

### Q3: Can I publish a blog post about the vulnerability?

**A:** Yes, after coordinated disclosure (90 days or mutual agreement). Please share a draft with us for technical review (we won't censor).

### Q4: What if you don't respond?

**A:** If no acknowledgment within 72 hours, try:
1. Secondary contact: engineering@firsttry.run
2. Atlassian Marketplace team: marketplace-security@atlassian.com
3. Public disclosure after 90 days (standard practice)

### Q5: Do you offer a bug bounty?

**A:** Not currently. We may in the future. We do offer public credit and our deep gratitude.

---

## 14. Policy Updates

### 14.1 Change Notification

Changes to this policy will be announced via:
- Email to known security researchers
- GitHub release notes
- firsttry.io/security

### 14.2 Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-03-04 | Initial release |

---

**Policy Owner:** FirstTry Security Team  
**Approved By:** Chief Information Security Officer  
**Next Review:** 2026-06-04

---

## 15. Thank You

We deeply appreciate security researchers who help us protect our customers. Your work makes the internet safer for everyone.

**Together, we build trust.**

---

**FirstTry Security Team**  
security@firsttry.run
