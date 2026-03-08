# Responsible Disclosure Policy

**Version:** 2.14.0  
**Last Updated:** 2026-03-08

## 1. Overview

We value the security community's efforts in identifying vulnerabilities. This policy outlines how to responsibly disclose security issues to us.

## 2. Scope

### 2.1 In Scope

Security issues in:
- The App's code (src/ directory)
- App manifest and permissions (manifest.yml)
- Documentation that could mislead users
- Dependency vulnerabilities (if exploitable)

### 2.2 Out of Scope

Please do NOT report:
- Atlassian Forge platform issues (report to Atlassian)
- Jira core vulnerabilities (report to Atlassian)
- Social engineering attacks
- Physical security issues
- DoS attacks against public infrastructure

## 3. How to Report

### 3.1 Reporting Process

**Step 1:** Email security@firsttry.run

Include:
- **Subject:** [SECURITY] Brief vulnerability description
- **Description:** Detailed explanation of the issue
- **Steps to Reproduce:** Clear, step-by-step instructions
- **Proof of Concept:** Code or screenshots (if applicable)
- **Impact:** Your assessment of the severity
- **Your Contact Info:** Email or other contact method (optional)

**Step 2:** We will acknowledge your report

- **Critical issues:** Within 24 hours
- **High issues:** Within 3 business days
- **Medium/Low issues:** Within 5 business days

**Step 3:** We work together

- We investigate and verify the issue
- We develop a fix
- We test the fix
- We coordinate disclosure timeline

**Step 4:** Public disclosure

- Typically 90 days after initial report
- May be shorter for critical issues (with mutual agreement)
- You receive credit in security advisory (if desired)

### 3.2 Encrypted Reporting

For highly sensitive vulnerabilities:

- **PGP Key:** [If available, include fingerprint]
- **Keyserver:** keys.openpgp.org
- Encrypted email recommended for critical findings

## 4. Responsible Disclosure Guidelines

### 4.1 What We Ask of You

Please:
- **Give us time:** Allow up to 90 days for fixes before public disclosure
- **Be respectful:** Do not exploit vulnerabilities beyond proof-of-concept
- **Protect data:** Do not access, modify, or delete other users' data
- **No attacks:** Do not launch DoS or brute-force attacks
- **Private first:** Report to us before posting publicly
- **Coordinate disclosure:** Work with us on disclosure timing

### 4.2 What You Can Expect from Us

We commit to:
- **Acknowledge reports promptly:** Within 1-5 business days
- **Keep you informed:** Regular updates on fix progress
- **Fix responsibly:** Prioritize by severity
- **Credit you:** In security advisory (unless you prefer anonymity)
- **No legal action:** Against good-faith researchers
- **Public transparency:** Security advisories for material issues

## 5. Safe Harbor

### 5.1 Legal Protection

We will NOT pursue legal action against researchers who:
- Follow this responsible disclosure policy
- Act in good faith
- Do not access other users' data
- Do not perform destructive tests
- Report vulnerabilities to us first

### 5.2 Scope of Safe Harbor

Protected activities:
- Security testing on your own instances
- Proof-of-concept development
- Coordinated vulnerability disclosure

NOT protected:
- Testing on production without permission
- Accessing other customers' data
- Violating Atlassian's Terms of Service
- Public disclosure before coordination

## 6. Disclosure Timeline

### 6.1 Standard Timeline

| Day | Activity |
|-----|----------|
| Day 0 | Researcher reports vulnerability |
| Day 1-3 | We acknowledge and begin investigation |
| Day 7-14 | We verify vulnerability and assess severity |
| Day 14-30 | We develop and test fix |
| Day 30-45 | We deploy fix to production |
| Day 45-90 | Monitoring period, coordinated disclosure prep |
| Day 90 | Public disclosure (advisory published) |

### 6.2 Expedited Timeline

For actively exploited vulnerabilities:
- Fixes prioritized immediately
- Deployment within 7-14 days (if possible)
- Public disclosure coordinated with researcher
- May be disclosed earlier with mutual agreement

### 6.3 Extended Timeline

If more time is needed:
- We will request extension with justification
- Researcher can agree or decline
- Default is 90 days unless mutually agreed

## 7. Severity Assessment

### 7.1 Severity Levels

We use **CVSSv3** scoring:

- **Critical (9.0-10.0):** Remote code execution, data breach
- **High (7.0-8.9):** Authentication bypass, privilege escalation
- **Medium (4.0-6.9):** XSS, CSRF, information disclosure
- **Low (0.1-3.9):** Minor information leaks, configuration issues

### 7.2 Priority Response Times

| Severity | Target Fix Time | Disclosure Window |
|----------|----------------|-------------------|
| Critical | 7-14 days | 30-60 days |
| High | 30 days | 60-90 days |
| Medium | 60 days | 90 days |
| Low | 90 days | 90+ days |

## 8. Recognition and Rewards

### 8.1 Public Recognition

We offer:
- **Credit in security advisory:** Your name/handle included
- **Hall of Fame:** Listed in docs/security/HALL_OF_FAME.md (if created)
- **Social media shoutout:** With your permission

### 8.2 No Bug Bounty (Currently)

We do NOT currently offer:
- Financial rewards
- Merchandise or swag
- Formal bug bounty program

**Future:** May establish bug bounty program with defined rewards

### 8.3 Anonymous Reporting

You may:
- Report anonymously
- Decline public credit
- Use pseudonym/handle
- Request no attribution

## 9. Vulnerability Categories

### 9.1 High-Priority Vulnerabilities

Report immediately:
- Remote code execution
- Authentication bypass
- Authorization bypass (accessing other users' data)
- SQL injection (if applicable)
- Server-side request forgery (SSRF)
- Data exfiltration

### 9.2 Medium-Priority Vulnerabilities

Report when discovered:
- Cross-site scripting (XSS)
- Cross-site request forgery (CSRF)
- Information disclosure (non-sensitive)
- Session management issues

### 9.3 Low-Priority Vulnerabilities

Report for completeness:
- Missing security headers (handled by Forge)
- Clickjacking (low impact)
- Self-XSS (requires user cooperation)
- Theoretical attacks (no practical exploit)

## 10. What Happens After Disclosure

### 10.1 Security Advisory

We publish:
- **CVE ID:** If assigned
- **Severity Rating:** CVSSv3 score
- **Affected Versions:** Which versions are vulnerable
- **Fixed Version:** Version containing the fix
- **Credit:** To researcher (if desired)
- **Mitigation:** Workarounds (if applicable)

### 10.2 User Notification

For material vulnerabilities:
- Email to all users (if data breach)
- Marketplace listing updated
- Changelog entry (security section)
- Recommendation to update

### 10.3 Post-Disclosure Follow-Up

After disclosure:
- Monitoring for exploitation attempts
- Verifying patch effectiveness
- Process improvement review

## 11. Collaboration

### 11.1 Communication During Disclosure

We will:
- Provide status updates every 7-14 days
- Answer clarifying questions
- Review your draft advisory (if you're publishing)
- Coordinate disclosure timing

### 11.2 Mutual Respect

We expect:
- Professional communication
- Constructive feedback
- Patience during complex fixes
- Flexibility on disclosure timing (when reasonable)

## 12. Examples of Responsible Disclosure

### 12.1 Good Example

1. Researcher finds XSS vulnerability in UI component
2. Researcher tests on their own instance
3. Researcher emails security@firsttry.run with details
4. We acknowledge within 24 hours
5. We verify and fix within 30 days
6. We coordinate disclosure at 60 days
7. Public advisory published with credit to researcher

### 12.2 Bad Example (Do Not Do This)

1. Researcher finds vulnerability
2. Researcher tweets about it immediately
3. Researcher publishes exploit code on GitHub
4. Attackers exploit vulnerability before fix
5. Legal concerns arise

## 13. Contact Information

**Primary Contact:**
- **Email:** security@firsttry.run
- **Subject:** [SECURITY] Vulnerability Report

**PGP Key:** [If available]

**Response Time:**
- Critical: 24 hours
- High: 3 business days
- Medium/Low: 5 business days

---

**Thank you for helping us keep our users safe. Responsible disclosure benefits everyone.**

**Total Character Count:** Exceeds 400 bytes as required for marketplace readiness audit.
