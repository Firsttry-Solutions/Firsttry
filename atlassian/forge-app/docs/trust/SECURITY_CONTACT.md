# Security Contact

**Version**: 1.0  
**Owner**: FirstTry Solutions  
**Last Updated**: 2026-02-26  
**Review Cycle**: Annual

---

## Primary Contact

**Email**: [security@firsttry.run](mailto:security@firsttry.run)

**Supported channels**:
- Email (preferred)
- Security contact in Jira marketplace (if published)

---

## Response SLA

- **Initial acknowledgement**: Within 24 business hours
- **Severity assessment**: Within 48 business hours
- **Updates**: At least every 5 business days during investigation
- **Resolution target**: Based on severity (see [INCIDENT_RESPONSE_PLAN.md](../operations/INCIDENT_RESPONSE_PLAN.md))

---

## Incident Severity Classification

| Severity | CVSS | Example | Response Time |
|----------|------|---------|----------------|
| **Critical** | ≥9.0 | Active exploit; data breach | 4 hours |
| **High** | 7.0–8.9 | Privilege escalation; major vulnerability | 8 hours |
| **Medium** | 4.0–6.9 | Minor vulnerability; limited impact | 24 hours |
| **Low** | <4.0 | Informational findings | 5 days |

---

## Responsible Disclosure

We practice responsible disclosure. Please:

1. **Report privately**: Send vulnerability details to security@firsttry.run (not public channels)
2. **Provide details**: Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Impact assessment
   - Your contact information
3. **Allow time**: Wait 90 days before public disclosure (or sooner if we patch)
4. **Avoid harm**: Do not exploit vulnerabilities; do not access other tenants' data

---

## What Qualifies as a Security Issue

**Report to us**:
- Authentication/authorization bypass
- Scope escalation (app requesting unauthorized Jira scopes)
- Data leakage to external services
- Cryptographic weaknesses in export signing
- Tenant isolation bypass
- Unpatched dependency vulnerabilities

**Report to Atlassian** (not FirstTry):
- Forge platform vulnerabilities
- Jira Cloud API vulnerabilities
- Atlassian infrastructure issues
- Forge Storage encryption weaknesses

---

## Security Contact Verification

To verify this security contact email is legitimate:
1. Check Atlassian Marketplace listing (FirstTry app page)
2. Check docs/trust/SECURITY_TXT.md for DNSSEC-signed contact (if using .well-known/security.txt)

---

## References

- [VULNERABILITY_DISCLOSURE_POLICY.md](VULNERABILITY_DISCLOSURE_POLICY.md): Detailed disclosure process
- [INCIDENT_RESPONSE_PLAN.md](../operations/INCIDENT_RESPONSE_PLAN.md): Incident handling
- [SECURITY_OVERVIEW.md](SECURITY_OVERVIEW.md): Security model
