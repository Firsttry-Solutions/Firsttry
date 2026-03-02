# Support SLA

**Last updated: 2026-03-02**

This document defines support channels and service level agreements for FirstTry.

## Support channels

### Primary support channels

1. **GitHub Issues** (Community Support):
   - URL: https://github.com/Firsttry-Solutions/Firsttry/issues
   - Best for: Bug reports, feature requests, general questions
   - Response time: Best-effort (typically 24-48 hours)
   - Availability: Public, searchable

2. **Email Support**:
   - See [SECURITY_CONTACT.md](SECURITY_CONTACT.md) for contact email
   - Best for: Private issues, security concerns, billing
   - Response time: See below by tier

3. **Documentation**:
   - Self-service: [Operational guides](../ops/05_audit_runbook.md)
   - Trust docs: [Trust center](README.md)
   - Always up-to-date with latest release

### Security issues

For security vulnerabilities, see [Vulnerability Disclosure](vulnerability-disclosure.md).

## Response times

Response times by issue priority:

| Priority | Description | Response Time | Resolution Target |
|----------|-------------|---------------|-------------------|
| **Critical** | Service down, data loss, security breach | 4 hours | 24 hours |
| **High** | Major functionality broken, workaround exists | 24 hours | 7 days |
| **Medium** | Minor functionality issue, cosmetic bugs | 48 hours | 30 days |
| **Low** | Feature requests, documentation improvements | 7 days | Best-effort |

### Business hours

- **Standard support**: Monday-Friday, 9 AM - 5 PM UTC
- **Critical issues**: 24/7 monitoring for service-impacting events

## Escalation

### Escalation process

If you're not satisfied with support response:

1. **Tier 1 → Tier 2**: Request escalation in your support ticket
   - Escalation time: Within 4 hours during business hours
   
2. **Tier 2 → Engineering**: For complex technical issues
   - Escalation time: Within 24 hours
   
3. **Emergency escalation**: For critical security/operational issues
   - Contact: See security contact in [SECURITY_CONTACT.md](SECURITY_CONTACT.md)
   - Response: Within 1 hour

### What to include in escalation request

- Original ticket/issue number
- Summary of issue and impact
- Steps already taken
- Business impact statement
- Requested resolution

## Service commitments

### Uptime

FirstTry inherits Atlassian Forge platform SLA:
- **Target uptime**: 99.9% (per Forge platform)
- **Scheduled maintenance**: Announced 48 hours in advance
- **Status page**: Monitor Atlassian Forge status for platform issues

### Data integrity

- **Backup**: Handled by Forge platform (no action required)
- **Recovery**: Per Forge platform recovery capabilities
- **Audit trail**: All operations logged for compliance

## Support scope

### Included in support

- Installation and configuration assistance
- Troubleshooting app functionality
- Security vulnerability reports
- Bug reports and fixes
- Feature request consideration
- Documentation clarification

### Not included (out of scope)

- Jira Cloud administration (contact Atlassian Support)
- Custom development or consulting
- Third-party integrations
- Training (see documentation)
- Issues caused by Jira Cloud or Forge platform (contact Atlassian)

## Contact information

- **General support**: Create GitHub issue (preferred)
- **Private inquiries**: See [SECURITY_CONTACT.md](SECURITY_CONTACT.md)
- **Security issues**: See [Vulnerability Disclosure](vulnerability-disclosure.md)

---

**Response time targets are goals, not guarantees. Actual response times may vary based on issue complexity and current support volume.**
