# FirstTry Support SLA

**Version:** 2.14.0  
**Effective Date:** March 4, 2026  
**Last Updated:** March 4, 2026

---

## 1. Overview

This Support Service Level Agreement (SLA) defines FirstTry's support commitments for the FirstTry for Jira application.

**Scope:** This SLA applies to all customers with an active FirstTry subscription via Atlassian Marketplace.

---

## 2. Support Channels

### 2.1 Primary Support

| Channel | Contact | Availability | Use For |
|---------|---------|--------------|---------|
| **Email** | support@firsttry.run | 24/7 (monitored), Business hours response | General support, bug reports, feature requests |
| **Atlassian Marketplace** | Support tab on listing | Business hours response | Pre-sales questions, installation help |
| **Documentation** | In-app help + GitHub docs | 24/7 self-service | How-to guides, troubleshooting |

### 2.2 Security and Privacy

| Channel | Contact | Availability | Use For |
|---------|---------|--------------|---------|
| **Security** | security@firsttry.run | 24/7 | Vulnerability reports, security incidents |
| **Privacy** | privacy@firsttry.run | Business hours | GDPR/CCPA requests, data deletion |

**Business Hours:** Monday-Friday, 9:00 AM - 5:00 PM PST (excluding US holidays)

---

## 3. Severity Levels

### 3.1 Severity Definitions

| Severity | Description | Examples | Response Time | Resolution Target |
|----------|-------------|----------|---------------|-------------------|
| **P0 (Critical)** | Service unavailable, data loss, security breach | App crashes on load, data corruption, security vulnerability exploit | **1 hour** | 4 hours |
| **P1 (High)** | Core functionality impaired, significant impact | Dashboard not loading, snapshots not saving, evidence pack generation fails | **4 hours** | 24 hours |
| **P2 (Medium)** | Partial functionality impaired, workaround available | Display glitch, slow performance, non-critical feature broken | **1 business day** | 5 business days |
| **P3 (Low)** | Cosmetic issue, feature request, general question | UI alignment issue, documentation typo, "how do I...?" | **2 business days** | Best effort |

**Severity Assignment:** FirstTry reserves the right to reclassify severity based on actual impact assessment.

---

### 3.2 Response Time Definitions

**Response Time:** Time from ticket submission to first substantive reply (not autoresponder).

**Resolution Target:** Time to deploy fix or workaround (not closure of ticket).

**Exclusions:** Response times apply during business hours only, except P0 (critical) which is 24/7.

---

## 4. Support Process

### 4.1 Submitting a Support Request

**Step 1: Identify Severity**
- Review severity definitions (Section 3.1)
- Choose appropriate severity

**Step 2: Submit Ticket**
- Email: support@firsttry.run
- Subject line: `[P0/P1/P2/P3] Brief description`
- Body: Include details below

**Required Information:**
1. **Severity:** P0, P1, P2, or P3
2. **Jira Cloud URL:** e.g., `https://acme.atlassian.net`
3. **Issue Description:** What happened?
4. **Steps to Reproduce:** How to replicate (if bug)
5. **Expected vs. Actual:** What should happen vs. what happened
6. **Screenshots/Logs:** Attach if available
7. **Impact:** How many users affected?
8. **Contact:** Email and phone (for P0 only)

**Example:**
```
Subject: [P1] Dashboard not loading

Severity: P1 (High)
Jira URL: https://acme.atlassian.net
Description: FirstTry dashboard shows blank screen after clicking gadget
Steps to Reproduce:
1. Navigate to Jira Dashboard
2. Click on FirstTry gadget
3. Dashboard remains blank (no error message)
Expected: Dashboard should display snapshot data
Actual: Blank screen after 30 seconds
Impact: All users (10) cannot access FirstTry
Browser: Chrome 120
Screenshot: attached
Contact: jane@acme.com
```

---

### 4.2 Support Workflow

```
Customer Submits Ticket
    │
    ▼
Auto-Acknowledgment (immediate)
    │
    ▼
Triage (assess severity, assign owner) ← Response Time SLA starts here
    │
    ▼
Investigation (reproduce, root cause analysis)
    │
    ▼
Resolution (fix, workaround, or documentation)
    │
    ▼
Verification (customer confirms resolution)
    │
    ▼
Ticket Closed
```

**Updates:** For P0/P1, we provide updates every 2 hours until resolved. For P2/P3, weekly updates if resolution takes > 5 days.

---

## 5. Escalation

### 5.1 When to Escalate

Escalate if:
- Response time SLA missed
- Resolution target missed
- Unsatisfactory resolution
- Critical business impact

### 5.2 Escalation Path

| Level | Contact | When to Use |
|-------|---------|-------------|
| **Level 1: Support Engineer** | support@firsttry.run | Initial contact |
| **Level 2: Engineering Lead** | engineering@firsttry.run | Response SLA missed, technical escalation |
| **Level 3: Security Team** | security@firsttry.run | Security incidents, data breaches |
| **Level 4: Executive** | executive@firsttry.run | No resolution after 48 hours (P0/P1) |

**How to Escalate:** Reply to your existing ticket with subject "ESCALATION REQUEST" or email escalation contact directly with reference to ticket number.

---

## 6. SLA Exclusions

### 6.1 Out of Scope

This SLA does not cover:

- ❌ Issues caused by Atlassian platform outages (see Atlassian SLA)
- ❌ Issues caused by customer's Jira configuration or permissions
- ❌ Feature requests (handled separately via roadmap)
- ❌ Third-party integrations not developed by FirstTry
- ❌ Training or consulting (contact sales@firsttry.run)
- ❌ Issues caused by unsupported browsers (we support Chrome, Firefox, Safari, Edge latest versions)

**For Atlassian Platform Issues:** Check [Atlassian Status Page](https://status.atlassian.com/)

### 6.2 Force Majeure

SLA timelines may be suspended during force majeure events (natural disasters, war, pandemic) beyond FirstTry's reasonable control.

---

## 7. Service Credits

### 7.1 Credit Policy

If FirstTry fails to meet response time SLAs:

| Severity | SLA Breach | Service Credit |
|----------|------------|----------------|
| **P0** | Response > 1 hour | 10% of monthly subscription |
| **P1** | Response > 4 hours | 5% of monthly subscription |
| **P2** | Response > 1 business day | No credit (best effort) |
| **P3** | Response > 2 business days | No credit (best effort) |

**Maximum Credit:** 25% of monthly subscription fee per month

**How to Claim:**
1. Email support@firsttry.run within 30 days of SLA breach
2. Include ticket number and breach details
3. Credit applied to next billing cycle (or refund if cancelled)

**Limitation:** Service credits are your sole remedy for SLA breaches. We do not provide monetary damages beyond credits.

---

## 8. Support Coverage

### 8.1 Basic Support (Included)

All customers receive:

- ✅ Email support (support@firsttry.run)
- ✅ Business hours response (P1-P3)
- ✅ 24/7 P0 response
- ✅ Documentation access
- ✅ Bug fixes (no charge)
- ✅ Security updates (no charge)

### 8.2 Premium Support (Contact Sales)

For enterprise customers, we offer:

- Dedicated support engineer
- Faster response times (30 min for P0, 1 hour for P1)
- Phone support
- Quarterly business reviews
- Custom SLA terms

**Contact:** sales@firsttry.run for pricing

---

## 9. Maintenance Windows

### 9.1 Planned Maintenance

**Frequency:** Rare (Forge apps do not require downtime for updates)

**Notification:** 7-day advance notice via email and in-app banner

**Timing:** Outside business hours (weekends or late night PST)

**Duration:** Typically < 1 hour

**Impact:** App may be unavailable during maintenance

### 9.2 Emergency Maintenance

**Trigger:** Security vulnerabilities (P0), critical bugs

**Notification:** Best effort (may be immediate)

**Duration:** As short as possible

---

## 10. Customer Responsibilities

To receive effective support, customers must:

1. **Provide accurate information** in support tickets
2. **Grant temporary access** if troubleshooting requires (we will request explicitly)
3. **Respond to requests for clarification** within 48 hours (or ticket may be closed)
4. **Verify resolution** after fix deployed
5. **Keep contact information current** (email admin changes to support@firsttry.run)

**Non-Responsive Tickets:** If no customer response for 7 days, ticket will be closed (can be reopened).

---

## 11. Availability SLA

### 11.1 Uptime Commitment

FirstTry commits to **99.9% uptime** (inherits Atlassian Forge platform SLA).

**Measurement Period:** Monthly

**Calculation:**
```
Uptime % = (Total Minutes - Downtime Minutes) / Total Minutes × 100
```

**Exclusions:**
- Planned maintenance (with 7-day notice)
- Atlassian platform outages
- Force majeure events
- Customer's own Jira/network issues

### 11.2 Availability Credit

If uptime < 99.9% in a month:

| Uptime | Service Credit |
|--------|----------------|
| 99.0% - 99.9% | No credit (within tolerance) |
| 98.0% - 98.9% | 10% of monthly fee |
| 95.0% - 97.9% | 25% of monthly fee |
| < 95.0% | 50% of monthly fee |

**How to Claim:** Same process as Section 7.1 (within 30 days).

**Verification:** Atlassian status page ([status.atlassian.com](https://status.atlassian.com/)) serves as record.

---

## 12. Communication Preferences

### 12.1 Notifications

FirstTry will notify customers of:

- Security vulnerabilities (within 24 hours of discovery)
- Planned maintenance (7-day notice)
- Feature releases (monthly newsletter, opt-in)
- Service disruptions (real-time via email)

**Opt-In:** Email support@firsttry.run to subscribe/unsubscribe from non-critical notifications.

### 12.2 Language Support

**Supported Languages:** English (primary)

**Other Languages:** Best effort (may use translation tools)

---

## 13. Feedback and Improvement

### 13.1 Customer Satisfaction

After ticket resolution, customers receive a satisfaction survey (optional):

- ⭐ **5-star rating:** Excellent
- ⭐⭐⭐⭐ **4-star:** Good
- ⭐⭐⭐ **3-star:** Satisfactory
- ⭐⭐ **2-star:** Poor
- ⭐ **1-star:** Unacceptable

**Goal:** Maintain ≥ 4.5 average satisfaction rating.

### 13.2 Continuous Improvement

FirstTry reviews support metrics quarterly:

- Average response time
- Average resolution time
- Customer satisfaction score
- SLA compliance rate

**Transparency:** Annual support report available upon request.

---

## 14. Data Security in Support

### 14.1 Access to Customer Data

FirstTry support may request temporary access to your Jira instance for troubleshooting:

**Process:**
1. FirstTry requests access (explicit email, specific reason)
2. Customer grants temporary admin access (or uses screen share)
3. FirstTry troubleshoots (documented in ticket)
4. Customer revokes access after resolution
5. FirstTry does not retain credentials

**Confidentiality:** All data accessed during support is confidential (NDA in Terms of Service).

### 14.2 Sensitive Data

**Do NOT include** in support tickets:
- ❌ Passwords or API tokens
- ❌ Personally identifiable information (PII) beyond what's visible in Jira
- ❌ Confidential business information (unless necessary for troubleshooting)

If sensitive data is needed, we will request via secure channel (e.g., encrypted file share).

---

## 15. Contact Information

| Purpose | Email | Response Time |
|---------|-------|---------------|
| General Support | support@firsttry.run | Per SLA (Section 3.1) |
| Security Issues | security@firsttry.run | 1 hour (24/7) |
| Privacy Requests | privacy@firsttry.run | 48 hours |
| Sales Inquiries | sales@firsttry.run | 1 business day |
| Enterprise Support | enterprise@firsttry.run | 4 hours |

---

## 16. SLA Amendments

FirstTry reserves the right to modify this SLA with **30-day notice** via:

- Email to account administrators
- In-app banner
- Updated document in Trust Center

**Material Changes:** Require explicit customer acknowledgment (click-through on next login).

**Version History:** See Section 18.

---

## 17. References

- [Atlassian Support SLA](https://www.atlassian.com/legal/sla)
- [Atlassian Status Page](https://status.atlassian.com/)
- [FirstTry Trust Center](../trust/TRUST_CENTER.md)
- [FirstTry Incident Response Plan](../trust/incident_response.md)

---

## 18. Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-03-04 | Initial SLA |

---

**SLA Owner:** FirstTry Support Team  
**Approved By:** Chief Customer Officer  
**Next Review:** 2026-09-04 (semi-annual)  
**Contact:** support@firsttry.run

---

**Committed to Your Success**  
FirstTry Support Team
