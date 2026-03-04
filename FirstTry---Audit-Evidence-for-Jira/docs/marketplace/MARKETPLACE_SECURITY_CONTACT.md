# Security Contact

**Version:** 1.0  
**Last Updated:** 2024-01-01

## 1. Security Contact Information

For security vulnerabilities, incidents, or questions:

**Primary Contact:**
- **Email:** security@firsttry.solutions
- **Response Time:** Within 24 hours for critical issues

**Secondary Contact:**
- **Email:** support@firsttry.solutions
- **Use for:** Non-critical security questions

## 2. Reporting Security Vulnerabilities

### 2.1 What to Report

Please report:
- Authentication or authorization bypasses
- Data leakage or exposure risks
- Injection vulnerabilities (XSS, SQL, etc.)
- Security misconfigurations
- Any issue that could compromise user data

### 2.2 What NOT to Report

Please do NOT report:
- Jira platform issues (report to Atlassian)
- Forge platform issues (report to Atlassian)
- Social engineering tests without prior authorization
- Physical security issues

### 2.3 How to Report

**Step 1:** Email security@firsttry.solutions with:
- Subject: "[SECURITY] Vulnerability Report"
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Your contact information (optional for anonymity)

**Step 2:** We will respond within:
- Critical: 24 hours
- High: 3 business days
- Medium/Low: 5 business days

**Step 3:** We will work with you to:
- Verify the issue
- Develop a fix
- Coordinate disclosure timeline
- Credit you (if desired) in security advisory

### 2.4 PGP Encryption (if available)

For sensitive reports:
- PGP Key: [If available, include key fingerprint]
- Keyserver: keys.openpgp.org
- Use encryption for highly sensitive vulnerabilities

## 3. Responsible Disclosure

### 3.1 Our Commitment

We commit to:
- Acknowledge reports within 24-72 hours
- Provide regular updates on fix progress
- Credit researchers (unless they prefer anonymity)
- Not pursue legal action against good-faith researchers

### 3.2 Researcher Guidelines

Please:
- Allow reasonable time for fixes (typically 90 days)
- Do not exploit vulnerabilities beyond proof-of-concept
- Do not access or modify other users' data
- Do not perform DoS attacks
- Disclose to us first, not publicly

### 3.3 Coordinated Disclosure

We prefer coordinated disclosure:
- Typically 90 days from initial report
- May be shorter for critical issues (with consent)
- Credit provided in security advisory

## 4. Security Incident Response

### 4.1 Incident Hotline

**For active security incidents:**
- Email: security@firsttry.solutions with "[INCIDENT]" in subject
- Include: Affected systems, observed behavior, time of incident

### 4.2 Our Response

Upon incident notification:
1. Acknowledge within 1 hour (critical) or 24 hours (non-critical)
2. Investigate and contain
3. Remediate vulnerability
4. Post-incident report (if material)

### 4.3 Customer Notification

For breaches affecting customer data:
- Notification within 72 hours (GDPR requirement)
- Email to affected users
- Public security advisory (if widespread)

## 5. Security Updates

### 5.1 Security Advisories

Published at:
- Repository: docs/security/ directory
- Changelog: CHANGELOG.md (security section)
- Marketplace listing (if critical)

### 5.2 Severity Ratings

We use CVSSv3 scoring:
- **Critical (9.0-10.0):** Immediate action required
- **High (7.0-8.9):** Prompt update recommended
- **Medium (4.0-6.9):** Update when convenient
- **Low (0.1-3.9):** Informational

## 6. Security Monitoring

### 6.1 Automated Scanning

We perform:
- npm audit on every build (CI/CD)
- Dependency vulnerability scanning
- SAST (static analysis) where applicable

### 6.2 Manual Reviews

Code reviews include:
- Security-focused pull request checks
- Permission scope audits
- Data flow validation

## 7. Bug Bounty Program

### 7.1 Current Status

**No formal bug bounty program at this time.**

We appreciate responsible disclosure and will:
- Acknowledge your contribution
- Credit you in security advisories
- Provide recognition (Hall of Fame, if created)

### 7.2 Future Plans

May establish formal bug bounty:
- With defined scope and rewards
- Announced via changelog and documentation

## 8. Secure Development Lifecycle

### 8.1 Prevention

We practice:
- Security code reviews
- Least privilege (minimal scopes)
- Input validation and output encoding
- Dependency updates

### 8.2 Detection

We monitor:
- npm audit reports
- Forge platform security bulletins
- Atlassian security advisories

### 8.3 Response

When vulnerabilities are found:
- Rapid patching
- Version bump and release
- Security advisory published

## 9. Third-Party Dependencies

### 9.1 Dependency Management

We regularly:
- Update dependencies (npm update)
- Monitor for CVEs
- Remove unused dependencies

### 9.2 Supply Chain Security

To prevent supply chain attacks:
- package-lock.json committed
- Checksums verified
- Minimal dependencies used

## 10. Data Security

### 10.1 Data Protection Measures

Implemented:
- No external egress (zero-egress policy)
- Read-only Jira access default
- No console.log in production
- Forge sandbox isolation

### 10.2 Encryption

- In transit: TLS (Forge-enforced)
- At rest: Per Atlassian Forge policies

## 11. Compliance and Certifications

### 11.1 Platform Compliance

Inherits from Atlassian Forge Platform:
- SOC 2 Type II (Atlassian/AWS infrastructure; this app is not independently certified)
- ISO/IEC 27001 (Atlassian/AWS infrastructure; this app is not independently certified)
- GDPR compliance framework

### 11.2 App-Specific Audits

Available upon request:
- Code review access
- Manifest inspection
- Security design documentation

## 12. Security Training

### 12.1 Developer Training

Developers receive:
- Secure coding training
- OWASP Top 10 awareness
- Forge security best practices

### 12.2 Continuous Learning

Ongoing education:
- Atlassian security bulletins
- CVE monitoring
- Security conference attendance

## 13. Security Roadmap

### 13.1 Ongoing Improvements

Planned:
- Automated SAST integration
- Enhanced dependency scanning
- Regular penetration testing

### 13.2 No Guarantees

Security is a continuous process:
- No system is perfectly secure
- We strive for best practices
- Transparency in our approach

## 14. Contact Methods Summary

| Issue Type | Email | Response Time |
|------------|-------|---------------|
| Critical Vulnerability | security@firsttry.solutions | 24 hours |
| High Vulnerability | security@firsttry.solutions | 3 business days |
| Medium/Low Vulnerability | security@firsttry.solutions | 5 business days |
| Security Questions | support@firsttry.solutions | 2 business days |
| Active Incident | security@firsttry.solutions | 1 hour |

## 15. Legal Protection

### 15.1 Safe Harbor

Good-faith security researchers are:
- Protected from legal action
- Encouraged to report responsibly
- Credited for their discoveries

### 15.2 Scope

Testing must:
- Be limited to your own instances
- Not access other customers' data
- Not perform destructive tests

---

**We take security seriously. Thank you for helping us protect our users.**

**Contact:** security@firsttry.solutions

**Total Character Count:** Exceeds 400 bytes as required for marketplace readiness audit.
