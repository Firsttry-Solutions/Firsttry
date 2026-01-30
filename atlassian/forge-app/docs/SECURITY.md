# Security Policy

**Effective Date**: January 2026  
**Version**: 1.0

---

## 1. Security Contact

For reporting security vulnerabilities or concerns:

- **Email**: security@firstry.io
- **Response time**: Best effort within 48 hours
- **Do NOT** post security issues publicly or file GitHub issues for vulnerabilities

---

## 2. Vulnerability Disclosure Process

### How to Report

1. Email security contact (see section 1)
2. Include:
   - **Description**: What is the vulnerability?
   - **Severity**: How serious is it? (Critical/High/Medium/Low)
   - **Steps to reproduce**: How can we verify it?
   - **Impact**: What could an attacker do?
   - **Suggested fix**: Do you have a remediation idea?

### Our Response

1. **Acknowledgement**: We will acknowledge receipt within 48 hours
2. **Investigation**: We will verify and assess the issue (2–5 days)
3. **Fix**: We will develop and test a patch (3–7 days, depending on severity)
4. **Release**: We will release the fix and credit the reporter (if requested)
5. **Disclosure timeline**: 
   - Critical: Within 24 hours of patch release
   - High/Medium: Within 7 days of patch release
   - Low: Within 30 days of patch release

### Responsible Disclosure

We ask that you:
- **Do NOT** disclose the vulnerability publicly until we've released a fix
- **Do NOT** exploit the vulnerability beyond demonstrating it exists
- **Do NOT** access data beyond what's necessary to verify the issue
- **Allow time** for us to fix the issue before disclosure (90 days maximum)

---

## 3. Supported Versions

| Version | Status | Security Support |
|---------|--------|------------------|
| 1.x+ | Active | ✅ Yes |
| < 1.0 | Deprecated | ❌ No |

**Recommendation**: Always keep this app updated to the latest version.

---

## 4. Security Best Practices

### For Users

- **Keep Jira updated**: Security patches are released regularly
- **Use strong passwords**: Your Jira password protects your account
- **Enable 2FA**: If your workspace supports it, enable two-factor authentication
- **Review permissions**: Ensure only authorized users have access to the app
- **Report suspicious activity**: If you see unusual behavior, contact support

### For Administrators

- **Audit app permissions**: This app requests minimal permissions (read-only access)
- **Monitor usage**: Check who is accessing the dashboard and when
- **Update regularly**: Deploy new versions as they become available
- **Backup snapshots**: Export and archive important snapshot records

---

## 5. Known Security Considerations

### Read-Only Access
- This app is read-only and cannot modify Jira data
- No authentication credentials are stored by this app
- All actions are logged by Jira (audit trail available)

### Data In Transit
- All communication is encrypted (TLS 1.2+)
- Requests are authenticated via Forge's OAuth bridge
- No unencrypted data is transmitted

### Data At Rest
- Session data is not persisted (cleared when tab closes)
- No sensitive data is stored in browser local storage
- Jira handles all persistent data storage

---

## 6. Incident Response Summary

If a security issue affects this app:

1. **We will investigate** the root cause and impact
2. **We will notify users** via:
   - In-app notifications (if possible)
   - Email to workspace admins
   - Security advisory (for critical issues)
3. **We will release a fix** as quickly as possible
4. **We will document lessons learned** in post-incident reviews

---

## 7. Compliance

This app complies with:
- **Atlassian App Marketplace security requirements**
- **GDPR** (General Data Protection Regulation)
- **SOC 2** principles (in development; contact support for audit reports)

---

## 8. Questions?

For security questions (non-vulnerability):
- Email: support@firstry.io
- See also: Privacy Policy (docs/PRIVACY_POLICY.md)

---

**Last Updated**: January 2026  
**Report vulnerabilities to**: security@firstry.io
