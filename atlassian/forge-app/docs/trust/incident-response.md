# Incident Response

**Last updated: 2026-03-02**

This document outlines FirstTry's security incident response process.

## Incident classification

We classify security incidents by severity and impact:

### Severity levels

| Severity | Definition | Examples | Response Time |
|----------|------------|----------|---------------|
| **P0 - Critical** | Active data breach, service compromise | RCE exploit, credential leak, data exfiltration | Immediate (< 1 hour) |
| **P1 - High** | Potential data exposure, security control failure | Authentication bypass, privilege escalation | 4 hours |
| **P2 - Medium** | Security weakness, no active exploitation | Misconfiguration, vulnerable dependency | 24 hours |
| **P3 - Low** | Potential future risk, informational | Code quality issue, hardening opportunity | 7 days |

### Incident types

- **Security breach**: Unauthorized access to systems or data
- **Vulnerability exploitation**: Active exploitation of known or zero-day vulnerability
- **Data exposure**: Unintended disclosure of customer or system data
- **Service disruption**: DDoS or availability impact with security implications
- **Policy violation**: Failure to meet security commitments

## Customer notification

We are committed to transparent incident communication:

### Notification triggers

We notify affected customers when:
1. Customer data has been accessed, disclosed, or modified without authorization
2. Security controls protecting customer data have failed
3. Regulatory notification requirements apply (GDPR, CCPA, etc.)
4. Prolonged service disruption (> 4 hours) due to security incident

### Notification timeline

| Phase | Timeline | Content |
|-------|----------|---------|
| **Initial notification** | Within 24 hours of confirmed incident | Incident nature, known impact, immediate actions |
| **Status updates** | Every 48 hours during active incident | Remediation progress, updated impact assessment |
| **Final report** | Within 14 days of resolution | Root cause, full timeline, preventive measures |

### Notification channels

- **Email**: Direct notification to customer admin contacts
- **In-app banner**: Status notification within FirstTry app
- **Status page**: Public incident updates (for widespread issues)
- **GitHub Security Advisory**: For vulnerability-related incidents

## Post-incident review

Every P0/P1 incident triggers a formal post-incident review:

### Review process

**Timeline**: Within 7 days of incident resolution

**Participants**:
- Engineering lead
- Security team
- Product management
- Customer success (for customer-impacting incidents)

**Deliverables**:
1. **Incident timeline**: Chronological reconstruction of events
2. **Root cause analysis**: Technical and process failures
3. **Impact assessment**: Customer data, service availability, compliance
4. **Remediation actions**: Immediate fixes, long-term improvements
5. **Lessons learned**: Process improvements, preventive measures

### Review document structure

```markdown
## Incident Overview
- Date/time of incident
- Detection method
- Severity classification
- Customer impact

## Timeline
- [HH:MM] Incident detected
- [HH:MM] Initial response initiated
- [HH:MM] Customer notification sent
- [HH:MM] Remediation completed
- [HH:MM] Incident closed

## Root Cause Analysis
- Technical root cause
- Contributing factors
- Why existing controls failed

## Impact Assessment
- Systems affected
- Data accessed/modified
- Customer impact
- Regulatory implications

## Remediation
- Immediate actions taken
- Long-term fixes deployed
- Monitoring improvements

## Prevention
- New controls implemented
- Process improvements
- Training/awareness updates

## Action Items
- [ ] Action 1 (Owner, Due Date)
- [ ] Action 2 (Owner, Due Date)
```

## Incident response team

### Roles and responsibilities

| Role | Responsibilities | Contact Method |
|------|------------------|----------------|
| **Incident Commander** | Overall incident coordination, customer communication | On-call rotation |
| **Engineering Lead** | Technical response, remediation development | Direct escalation |
| **Security Lead** | Threat analysis, forensics, evidence preservation | Security contact |
| **Communications** | Customer notifications, status updates | Support email |

### Escalation

- **Internal escalation**: Engineering → Security → Executive (for P0/P1)
- **External escalation**: Atlassian Forge support (for platform issues)
- **Regulatory escalation**: Legal/compliance team (for reportable incidents)

## Detection and monitoring

FirstTry relies on multiple detection layers:

1. **Automated monitoring**:
   - Forge platform health metrics
   - Error rate anomalies
   - API failure patterns

2. **Customer reports**:
   - Support tickets
   - GitHub issues
   - Direct security reports

3. **Proactive scanning**:
   - Dependency vulnerability scanning (Dependabot)
   - Code security analysis (CodeQL)
   - Audit execution (deterministic verification)

## Evidence preservation

For all P0/P1 incidents:
- **Logs retained**: 90 days minimum
- **Forensic snapshots**: Captured and stored securely
- **Chain of custody**: Documented for potential legal/regulatory needs
- **External audit**: Available upon request for affected customers

## Regulatory compliance

FirstTry complies with:
- **GDPR**: Data breach notification within 72 hours
- **CCPA**: California resident notification per statute
- **SOC 2**: Incident response procedures per Type II controls
- **Atlassian Marketplace**: Security incident reporting requirements

## Contact

To report a security incident:
- **Email**: See [SECURITY_CONTACT.md](SECURITY_CONTACT.md)
- **Vulnerability disclosure**: See [Vulnerability Disclosure](vulnerability-disclosure.md)
- **Emergency**: Use security contact for immediate response

---

**This incident response plan is reviewed quarterly and updated as needed. Last review: 2026-03-02**
