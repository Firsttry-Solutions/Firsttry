# FirstTry Incident Response

**Version**: 1.0  
**Last Updated**: 2025-12-22

---

## Overview

This document describes how FirstTry responds to security incidents, data breaches, or operational failures.

---

## 1. Detection

### How Incidents Are Detected

- ✅ CI/CD test failures (automated)
- ✅ Security vulnerability reports (researcher disclosure)
- ✅ Atlassian platform alerts (monitoring)
- ✅ Customer reports (support email)
- ✅ Dependency vulnerability scans (npm audit)

---

## 2. Classification

Incidents classified by severity:

| Severity | Description | Example | Response Time |
|----------|-------------|---------|---|
| **CRITICAL** | Immediate threat; data compromised | Cross-workspace access exploited | 1 hour |
| **HIGH** | Significant risk; service impaired | Auth bypass | 4 hours |
| **MEDIUM** | Limited impact; partial functionality | Bug in specific edge case | 1 day |
| **LOW** | Minor issue; no data at risk | Typo in UI | 5 days |

---

## 3. Incident Response Phases

### Phase 1: Confirmation (T+0)

1. Verify incident is real (reproduce)
2. Assess scope (which workspaces? which data?)
3. Assign severity level
4. Notify incident response team

**Target**: <1 hour for CRITICAL, <4 hours for HIGH

### Phase 2: Containment (T+1)

1. Stop the bleeding (disable feature if needed)
2. Isolate affected systems
3. Prevent further damage
4. Preserve evidence (logs, state)

**For Data Breach**:
- Immediately revoke compromised credentials
- Restrict Jira API access
- Notify Atlassian security team
- Document affected workspaces

**Target**: <4 hours for CRITICAL

### Phase 3: Eradication (T+1 to T+7)

1. Identify root cause
2. Develop fix
3. Test fix (in isolation)
4. Deploy fix

**Target**: 24 hours for CRITICAL, 1 week for HIGH

### Phase 4: Recovery (T+7 to T+14)

1. Deploy fix to production
2. Restore affected workspaces (if needed)
3. Verify fix works
4. Monitor for regression

**Target**: ASAP after fix is ready

### Phase 5: Post-Incident (T+14 onwards)

1. Root cause analysis (RCA)
2. Preventive measures (code change, test, process change)
3. Customer communication
4. Documentation update

**Target**: Within 2 weeks of incident closure

---

## 4. Customer Communication

### Breach Notification Policy

**If FirstTry is breached AND customer data is affected**:

1. **Notification**: Email to workspace admin within 72 hours
2. **Details**: What data was affected, when, what we're doing
3. **No Cover-Up**: Full transparency
4. **Remediation**: Clear steps for customer to take

### No Breach Incidents Yet

FirstTry has zero recorded security breaches as of 2025-12-22.

---

## 5. Escalation Path

```
1. Developer (detection/triage)
   ↓
2. Security Lead (severity assessment)
   ↓
3. Engineering Manager (response coordination)
   ↓
4. Atlassian Security Team (if data breach)
   ↓
5. Affected Customers (if breach confirmed)
```

---

## 6. Evidence Preservation

During incident response:

- ✅ Logs are preserved (not deleted)
- ✅ Affected storage is backed up (read-only)
- ✅ Timeline is documented
- ✅ All actions are audited

**Retention**: Evidence retained for 30 days post-incident (or longer if legal hold)

---

## 7. Post-Incident Review

After each incident:

1. **RCA**: Why did it happen? Could we have prevented it?
2. **Action Items**: Code changes, process improvements, tests
3. **Improvement**: Implement preventive measures
4. **Documentation**: Update playbooks, alert thresholds

Example output: `incidents/2025-12-22-XSS-RCA.md`

---

## 8. Contacts

**Incident Report**: security@atlassian.com  
**Subject**: "FirstTry Security Incident"  
**Include**: Description, severity, timeline, affected workspaces

---

**Incident Response Plan**: 1.0  
**Effective**: 2025-12-22
