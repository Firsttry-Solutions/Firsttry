# Incident Response Plan

**Version**: 1.0  
**Owner**: FirstTry Solutions  
**Last Updated**: 2026-02-26  
**Review Cycle**: Annual

---

## 1. Overview

This plan defines how FirstTry responds to security incidents, vulnerabilities, and operational events.

---

## 2. Incident Severity Classification

| Severity | CVSS | Example | Notify SLA | Ack SLA |
|----------|------|---------|-----------|---------|
| **Critical** | ≥9.0 | Active exploit, data breach, scope escalation detected, unpatched critical CVE | 24 hours | 4 hours |
| **High** | 7.0–8.9 | Privilege escalation vulnerability, POST/PUT/DELETE discovered in code, dependency with high CVE | 48 hours | 8 hours |
| **Medium** | 4.0–6.9 | Minor vulnerability, missing input validation, low-impact cryptography issue | 5 days | 24 hours |
| **Low** | <4.0 | Informational findings, documentation gaps, development practices note | 14 days | 5 days |

**IMPORTANT CAVEAT**:
> Notification timelines are best-effort and subject to Atlassian Forge platform availability and customer contact availability. FirstTry will make reasonable efforts to notify reported contacts within stated SLAs, but external factors may impact delivery.

---

## 3. Incident Response Workflow

### Phase 1: Detection & Initial Response

**Timeline**: Immediate (0–1 hour)

1. **Detection source**:
   - Vulnerability report (security.contact@firsttry.run)
   - Internal scanning (CI/CD gate, dependency checks)
   - User report (support channels)
   - Forge platform notification (if Forge incident affects FirstTry)

2. **Initial assessment**:
   - Reproduce issue (if applicable)
   - Assign severity level
   - Determine if code patch needed or mitigation sufficient

3. **Notification rules**:
   - Critical: Contact security.firsttry.run within 4 hours
   - High: Contact security.firsttry.run within 8 hours
   - Medium/Low: Email to registered contacts within timeframe

### Phase 2: Investigation & Development

**Timeline**: 1–30 days (depends on severity)

1. **Investigation**:
   - Root cause analysis
   - Impact assessment (affected versions, customers, data)
   - Determine if issue is FirstTry-owned or platform-owned

2. **Development**:
   - Create fix or mitigation
   - Develop test cases
   - Code review by another team member

3. **Release planning**:
   - Determine rollout strategy (immediate, next release, staged)
   - Prepare customer notification (email, CHANGELOG.md)
   - Consider backward compatibility

### Phase 3: Patch Release & Communication

**Timeline**: As soon as patch is ready (typically 7–30 days)

1. **Release**:
   - Tag release with version (e.g., v0.4.2-patch1)
   - Publish to Atlassian Marketplace (if applicable)
   - Push to production via forge deploy

2. **Communication**:
   - Update CHANGELOG.md with security notice
   - Email registered security contacts
   - Post advisory (if public repo used)

3. **Verification**:
   - Confirm patch deployed in production
   - Monitor for deployment issues

### Phase 4: Post-Incident Review

**Timeline**: 1 week after resolution

1. **Conduct retrospective**:
   - What was the root cause?
   - Could this have been prevented?
   - What process improvements apply?

2. **Update documentation**:
   - Update threat model if new threat discovered
   - Update security policies if process gaps identified
   - Regenerate evidence artifacts

3. **Lessons learned**:
   - Share findings with team
   - Update CI/CD gates if applicable
   - Retrain on secure coding practices if needed

---

## 4. Incident Response Roles

| Role | Responsible For | Contact |
|------|-----------------|---------|
| **Security Contact** | Primary incident coordinator | security.contact@firsttry.run |
| **Emergency Response** | Critical/P0 incidents requiring immediate action | emergency@firsttry.run |
| **Lead Developer** | Code investigation & patch | (internal team) |
| **Release Manager** | Deployment & communication | (internal team) |
| **Product Owner** | Customer communication & impact assessment | (internal team) |

---

## 5. Escalation Paths

### Level 1: FirstTry Team
- Assess severity
- Develop initial mitigation plan
- Notify customers if needed

### Level 2: Atlassian Escalation (if applicable)
- If issue is in Forge platform or Jira API
- Contact Atlassian support with details
- Reference incident tracking system

### Level 3: Customer Escalation
- If incident affects specific customer data
- Contact customer's nominated security officer
- Provide incident details and remediation steps

---

## 6. Communication Templates

### Critical/High Severity Notification

**Subject**: [SECURITY INCIDENT] FirstTry – <Issue Title>

**Body**:
```
We are aware of a security issue in FirstTry (# CVE-XXXX-XXXXX or Issue #XXX).

SEVERITY: <High | Critical>
IMPACT: <Who is affected and how>
TIMELINE: <When patch will be available>
ACTION: <What customers should do: update, reconfigure, monitor logs, etc.>

We appreciate your patience and will provide updates every 24 hours.

Contact: security.contact@firsttry.run
```

### Patch Release Notification

**Subject**: [SECURITY PATCH] FirstTry v0.4.2 – Update Available

**Body**:
```
A security patch is now available for FirstTry v0.4.2.

ISSUE: <Description>
SEVERITY: <Level>
PATCH NOTES: See CHANGELOG.md for details

Please update at your earliest convenience.

Update procedure:
1. Jira Settings → Apps
2. FirstTry → Update
3. Confirm installation

If you have questions, contact: support@firsttry.run
```

---

## 7. Incident Tracking

**All incidents logged in**:
- GitHub Issues (private repo) with severity label
- CHANGELOG.md (after resolution)
- Annual security report (if applicable)

**Retention**: Posts-incident records retained for 2 years (per legal/compliance requirements).

---

## 8. Third-Party Incident Dependencies

**If incident is in Atlassian Forge or Jira Cloud**:
- FirstTry cannot independently patch platform issues
- Will coordinate with Atlassian on remediation timeline
- Will notify customers of Atlassian's guidance and ETA

---

## 9. Testing and Exercises

**Annual incident response drill**:
- Simulate security incident
- Walk through workflow
- Validate contact information
- Test notification systems

---

## References

- [SECURITY_CONTACT.md](../trust/SECURITY_CONTACT.md): Contact information
- [VULNERABILITY_DISCLOSURE_POLICY.md](../trust/VULNERABILITY_DISCLOSURE_POLICY.md): Reporting process
- [THREAT_MODEL.md](../trust/THREAT_MODEL.md): Known threat scenarios
