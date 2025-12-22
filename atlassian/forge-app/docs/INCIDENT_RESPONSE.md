# Incident Response Documentation

**App Name**: FirstTry Governance - Atlassian Dual-Layer Integration  
**Last Updated**: 2025-12-22  
**Purpose**: Security incident and operational incident response procedures  

---

## Scope

This document covers incident response for:
1. **Security Incidents**: Suspected vulnerabilities, breaches, or security events
2. **Operational Incidents**: Service degradation, data integrity issues, unexpected behavior

**Out of Scope**:
- Atlassian Forge platform incidents (handled by Atlassian)
- Jira Cloud platform incidents (handled by Atlassian)
- Customer-side configuration issues

---

## Security Incident Response

### Reporting

**Method**: GitHub Security Advisory  
**URL**: https://github.com/Global-domination/Firstry/security/advisories/new  

**DO NOT** report security incidents via:
- Public GitHub issues
- Email
- Social media
- Public forums

### Response Process

1. **Acknowledgment**: Best effort within 7 days
2. **Triage**: Assess severity (Critical / High / Medium / Low / Informational)
3. **Investigation**: UNKNOWN timeframe (depends on maintainer availability)
4. **Remediation**: UNKNOWN timeframe
5. **Disclosure**: Coordinated with reporter

**NO GUARANTEED RESPONSE TIMES**

### Severity Classification

| Level | Definition | Example |
|-------|------------|---------|
| **Critical** | Active exploitation; data breach imminent | RCE vulnerability actively exploited |
| **High** | Exploitable vulnerability; no active exploitation | Authentication bypass possible |
| **Medium** | Theoretical vulnerability; difficult to exploit | XSS in admin-only UI |
| **Low** | Security issue with minimal impact | Information disclosure (non-sensitive) |
| **Informational** | Security concern but not exploitable | Outdated dependency (no known CVE) |

### Communication

- **Private**: Via GitHub Security Advisory until patched
- **Public**: After patch released, coordinated disclosure
- **Customer Notification**: GitHub repository release notes + security advisory

**NO EMAIL NOTIFICATIONS** (GitHub watch/subscribe only)

---

## Operational Incident Response

### Detection

**Customer-Reported**: GitHub issues  
**Platform-Detected**: Forge runtime errors (not visible to app developers)  
**Proactive Monitoring**: NONE (no monitoring infrastructure)

### Response Process

1. **Report Received**: Customer opens GitHub issue
2. **Triage**: Best effort by maintainers (no SLA)
3. **Investigation**: UNKNOWN timeframe
4. **Resolution**: UNKNOWN timeframe
5. **Communication**: Via GitHub issue comments

### Incident Severity (Operational)

**NO SLA PROVIDED**

Rough guidelines (not commitments):

| Impact | Definition | Example | Response |
|--------|------------|---------|----------|
| **Total Outage** | App completely non-functional | Forge runtime crash loop | Best effort |
| **Partial Outage** | Some features broken | Report generation fails | Best effort |
| **Degradation** | Performance issues | Slow storage operations | Best effort |
| **Minor Issue** | Cosmetic or edge case | UI layout glitch | Best effort |

**All response times: UNKNOWN (maintainer availability)**

---

## Data Integrity Incidents

### Scenarios

1. **Storage Corruption**: Data in Forge Storage becomes inconsistent
2. **Missing Data**: Expected data not captured or stored
3. **Incorrect Calculations**: Aggregations or reports contain errors

### Response

1. **Customer Reports Issue**: Via GitHub with evidence (screenshots, export files)
2. **Verification**: Maintainers attempt reproduction
3. **Root Cause Analysis**: UNKNOWN timeframe
4. **Fix**: Code patch (if reproducible)
5. **Data Recovery**: **NOT POSSIBLE** (app has no backup mechanism)

**IMPORTANT**: App does NOT provide data recovery or backlog replay.

---

## Incident Communication

### Internal

**Platform**: GitHub repository (public)  
**Channels**: Issue comments, security advisories, release notes  

**NO PRIVATE CUSTOMER PORTAL**

### External

**Status Page**: NONE  
**Incident Updates**: GitHub issue comments only  
**Post-Mortems**: UNKNOWN (at maintainer discretion)  

---

## Escalation Path

**Level 1**: GitHub issue (community support)  
**Level 2**: Repository maintainers (best effort)  
**Level 3**: NONE (no escalation beyond maintainers)  

**NO PAID SUPPORT TIER**

---

## Platform Incident Dependencies

### Forge Platform Incidents

**Responsibility**: Atlassian  
**Status Page**: https://status.atlassian.com  
**Customer Action**: Contact Atlassian support

This app **cannot mitigate** Forge platform incidents.

### Jira Cloud Incidents

**Responsibility**: Atlassian  
**Status Page**: https://status.atlassian.com  
**Customer Action**: Contact Atlassian support

This app **cannot mitigate** Jira Cloud incidents.

---

## Incident History

**Location**: GitHub repository releases and security advisories  
**URL**: https://github.com/Global-domination/Firstry/releases  

**NO FORMAL INCIDENT LOG**

---

## Disaster Recovery

### Backup Strategy

**App Code**: Git repository (GitHub)  
**App Data (in Forge Storage)**: **NO BACKUP** (Forge Storage API does not provide backup/restore)  

**Data Loss Risk**: Forge Storage failures = unrecoverable data loss

### Recovery Time Objective (RTO)

**UNKNOWN** (depends on Forge platform recovery)

### Recovery Point Objective (RPO)

**UNKNOWN** (no point-in-time recovery; depends on Forge Storage state)

---

## Business Continuity

**Alternative Deployment**: NONE (Forge-only app)  
**Failover Region**: NONE (Forge controls deployment region)  
**High Availability**: Forge platform responsibility  

---

## Compliance Obligations

### Breach Notification

**Responsibility**: Atlassian (as platform provider and data processor)

This app:
- Stores no PII (only Jira metadata)
- Has no direct customer data processor relationship
- Delegates breach notification to Atlassian/Forge

**Customer Obligation**: Review Atlassian's breach notification process

---

## Testing & Exercises

**Incident Response Drills**: NONE  
**Tabletop Exercises**: NONE  
**Penetration Testing**: NONE  

**Security Testing**: See [tests/credibility/](../tests/credibility/) for automated tests

---

## Contact

**Security Incidents**: https://github.com/Global-domination/Firstry/security/advisories/new  
**Operational Incidents**: https://github.com/Global-domination/Firstry/issues  

**NO EMAIL SUPPORT**

---

## Disclaimer

This incident response process is provided on a **best-effort basis** with **no guaranteed response times**.

For production-critical applications, customers should implement their own monitoring, alerting, and incident response procedures that do not depend on app developer responsiveness.

See LICENSE for warranty disclaimer.
