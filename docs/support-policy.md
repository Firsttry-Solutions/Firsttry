# FirstTry Support Policy

**Version**: 3.2  
**Effective Date**: 2026-02-15  
**Marker**: [FT_SUPPORT_POLICY_PUBLISHED]

---

## Overview

FirstTry provides enterprise-grade support for access review governance. This policy outlines support channels, response times, and escalation procedures.

---

## Support Tiers

### Tier 1: Standard (Included)

| Aspect              | Details |
|---------------------|---------|
| **Availability**    | Business hours: Mon-Fri 09:00-17:00 UTC |
| **Response Time**   | 8-12 business hours |
| **Classification**  | General questions, documentation requests, feature inquiries |
| **Channel**         | Email: support@firsttry.app |
| **Included in**     | All subscriptions |

### Tier 2: Professional (+$500/month)

| Aspect              | Details |
|---------------------|---------|
| **Availability**    | 24×5: Mon-Fri 09:00-17:00 UTC + Emergency on-call |
| **Response Time**   | 2-4 business hours (standard), 1 hour (urgent) |
| **Classification**  | Data access issues, export failures, performance concerns |
| **Channel**         | Email + Slack channel + phone |
| **Included in**     | Professional + Enterprise tiers |

### Tier 3: Enterprise (Custom)

| Aspect              | Details |
|---------------------|---------|
| **Availability**    | 24×7: Dedicated support engineer |
| **Response Time**   | Per SLA (typical: 15 min critical, 30 min high, 1 hr medium) |
| **Classification**  | All issues including custom configuration, compliance audits |
| **Channel**         | Dedicated Slack, email, video calls, quarterly reviews |
| **Included in**     | Enterprise subscription |

---

## Issue Classification

### Severity Levels

#### CRITICAL
**Impact**: Access review system is down or unavailable  
**Example**: Export resolver returns 500 error; all reads fail  
**SLA (Professional)**: 1 hour acknowledgement, 4 hours resolution  
**SLA (Enterprise)**: 15 minutes acknowledgement, 2 hours resolution  

#### HIGH
**Impact**: Feature is significantly degraded; workaround available  
**Example**: Export takes 3× longer than normal; rate limiting too strict  
**SLA (Professional)**: 2 hours acknowledgement, 8 hours resolution  
**SLA (Enterprise)**: 30 minutes acknowledgement, 4 hours resolution  

#### MEDIUM
**Impact**: Feature works but inefficiently; no data loss  
**Example**: UI lag on review dashboard; minor display bug  
**SLA (Professional)**: 4 hours acknowledgement, 24 hours resolution  
**SLA (Enterprise)**: 1 hour acknowledgement, 8 hours resolution  

#### LOW
**Impact**: Cosmetic or enhancement request  
**Example**: Documentation typo; UI color preference  
**SLA (Professional)**: 8 hours acknowledgement, best effort  
**SLA (Enterprise)**: 2 hours acknowledgement, best effort  

---

## Support Contact Methods

### Email

**Address**: support@firsttry.app  
**Response Time**: 8-12 business hours (Standard), 1-2 hours (Professional/Enterprise)  
**Best for**: General questions, feature requests, documentation

### Slack Channel

**Channel**: #firsttry-support (Professional/Enterprise only)  
**Response Time**: 1-2 hours (business hours)  
**Best for**: Quick questions, real-time debugging

### Phone (Enterprise only)

**Line**: +1-800-FIRSTTRY (800-347-7879)  
**Hours**: Dedicated engineer on-call  
**Best for**: Emergency escalations, critical issues

### Escalation Path

```
Tier 1 (Support Agent)
         ↓ (if unresolved after 4 hours)
Tier 2 (Support Lead)
         ↓ (if unresolved after 24 hours)
Tier 3 (Engineering Manager)
         ↓ (if unresolved after 72 hours)
Tier 4 (Director of Engineering / CTO)
```

---

## Issue Investigation Process

### Step 1: Triage (0-30 min)
- Collect issue description, reproduction steps, error logs
- Determine severity + category (data, performance, security)
- Assign ticket number and support engineer

### Step 2: Initial Diagnostics (30 min - 2 hours)
- Check FirstTry health dashboard
- Review tenant audit logs
- Reproduce issue on staging environment

### Step 3: Root Cause Analysis (2-8 hours)
- Examine Forge runtime logs (via Atlassian)
- Check rate limiting state
- Validate data consistency (hash verification)

### Step 4: Resolution (1-24 hours)
- Apply fix or workaround
- Deploy to production (if code change)
- Verify with customer

### Step 5: Postmortem (24-72 hours)
- Document root cause
- Publish incident report (Critical/High only)
- Recommend preventive measures

---

## Known Issues & Workarounds

| Issue | Workaround | Status |
|-------|-----------|--------|
| Export >50MB fails silently | Reduce date range; request Professional support for partition strategy | KNOWN / Backlog |
| Rate limiter resets at random times | Manual reset available via admin UI (Settings > Rate Limiting) | WORKING |
| Reviewer group changes not reflected in frozen snapshot | Run `ar.openReview` again to capture latest group membership | KNOWN / By design |

---

## SLA Commitment

### Response SLA

FirstTry guarantees acknowledgement within specified windows:

| Severity | Standard | Professional | Enterprise |
|----------|----------|--------------|-----------|
| CRITICAL | 12h      | 1h           | 15 min    |
| HIGH     | 24h      | 2h           | 30 min    |
| MEDIUM   | 48h      | 4h           | 1h        |
| LOW      | 1 week   | 1 week       | 2h        |

### Resolution SLA

Reasonable effort to resolve within:

| Severity | Standard | Professional | Enterprise |
|----------|----------|--------------|-----------|
| CRITICAL | 48h      | 4h           | 2h        |
| HIGH     | 5 days   | 8h           | 4h        |
| MEDIUM   | 10 days  | 24h          | 8h        |
| LOW      | Best effort | Best effort | Best effort |

**Note**: SLA clock pauses if customer does not respond within 24 hours.

---

## Business Continuity

### Maintenance Windows

**Scheduled maintenance**: Mondays 01:00-02:00 UTC (1 hour)  
**Notification**: Communicated 7 days in advance via Jira Cloud notifications

### Unscheduled Incidents

**Incident response**: Major incidents (affecting >50 customers) trigger 24/7 war room  
**Communication**: Updates published every 30 minutes on [status.firsttry.app](https://status.firsttry.app)

### Backup & Disaster Recovery

- **RTO** (Recovery Time Objective): 1 hour (all data restored)
- **RPO** (Recovery Point Objective): 15 minutes (max data loss)
- **Backup location**: Geographically separated from primary (AWS multi-region)
- **Test frequency**: Quarterly disaster recovery drills

---

## Support Exit Criteria

Support ticket is closed when:

1. Issue is resolved (verified by customer)
2. Customer confirms workaround is acceptable
3. Customer does not respond for 5 business days
4. Duplicate ticket (redirect to original)

Closed tickets may be reopened within 30 days.

---

## Premium Support Benefits (Professional/Enterprise)

✓ Priority queue (skip standard triage)  
✓ Reduced SLA response times  
✓ Direct engineer contact  
✓ Quarterly business reviews  
✓ Custom training + documentation  
✓ Advance notification of feature changes  
✓ Early access to beta features

---

## Support & Billing Escalations

### Account-Related Issues

**Email**: billing@firsttry.app  
**Response**: 1 business day  
**Issues**: Subscription changes, invoicing, license keys

### Data Privacy / Security Concerns

**Email**: security@firsttry.app  
**Response**: 2 hours (24/7)  
**Issues**: Suspected breach, security vulnerability, privacy complaint

---

## Feedback & Continuous Improvement

FirstTry regularly surveys support customers:

- **NPS survey**: Quarterly (Net Promoter Score)
- **Feature voting**: Monthly (customer-requested improvements)
- **Issue trends**: Published quarterly (most common issues + resolutions)

Customer feedback directly informs product roadmap. Top requested features are prioritized in monthly releases.

---

## Appendix: Contact Quick Reference

| Issue Type                  | Escalation Path                                      |
|-----------------------------|------------------------------------------------------|
| General question            | Email support@firsttry.app                           |
| Export not working          | Email + Slack (Prof/Ent); include error logs         |
| Data access concern         | Email security@firsttry.app + incident response     |
| Performance issue           | Email support@firsttry.app + run benchmark harness  |
| Billing question            | Email billing@firsttry.app                           |
| Feature request             | Slack #feature-requests (Prof/Ent) or support email |
| Compliance audit            | Email enterprise@firsttry.app (Ent only)            |

---

**This policy is effective as of 2026-02-15. Updates available upon request.**
