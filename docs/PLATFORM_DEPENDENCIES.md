# FirstTry Platform Dependencies

**Version**: 1.0  
**Last Updated**: 2025-12-22

---

## Executive Summary

FirstTry is a **read-only data analysis app** that runs entirely on **Atlassian Forge**. FirstTry has **zero control** over platform-level features. This document lists what FirstTry depends on and what it does NOT control.

---

## 1. Core Dependencies (Cannot Be Overridden)

### 1.1 Data Storage & Retention

| Behavior | Who Controls | FirstTry Role | Documentation |
|----------|--------------|---------------|----------------|
| **Data Residency** | Atlassian Forge (Jira Cloud region) | Read-only app within region | [DATA_RETENTION.md#22-data-residency](DATA_RETENTION.md#22-data-residency) |
| **Storage Encryption** | Atlassian (AES-256 at rest, TLS in transit) | Requests HTTPS only | [SECURITY.md#2-data-security](SECURITY.md#2-data-security) |
| **Backup & Recovery** | Atlassian Forge platform | Cannot backup or recover data | [DATA_RETENTION.md#23-data-backup--recovery](DATA_RETENTION.md#23-data-backup--recovery) |
| **Storage Quota** | Atlassian Forge plan limits | Fails gracefully if exceeded | [DATA_RETENTION.md#24-storage-quotas--limits](DATA_RETENTION.md#24-storage-quotas--limits) |
| **Data Deletion on Uninstall** | Atlassian Forge (automatic) | Cannot prevent or delay | [DATA_RETENTION.md#21-data-deletion-on-uninstall](DATA_RETENTION.md#21-data-deletion-on-uninstall) |
| **Retention Lifecycle** | Atlassian Forge (indefinite until uninstall) | No TTL enforcement | [DATA_RETENTION.md#executive-summary](DATA_RETENTION.md#executive-summary) |

### 1.2 Authentication & Authorization

| Behavior | Who Controls | FirstTry Role | Documentation |
|----------|--------------|---------------|----------------|
| **User Authentication** | Jira (OAuth 2.0 via Atlassian) | Trusts platform tokens | [SECURITY.md#24-sensitive-data-handling](SECURITY.md#24-sensitive-data-handling) |
| **Workspace Isolation** | Atlassian Forge API scope model | Structural (not configurable) | [SECURITY.md#23-tenant-isolation](SECURITY.md#23-tenant-isolation) |
| **Admin Approval** | Jira workspace admin | FirstTry requires Jira permission | [ACCESS_CONTROL.md](ACCESS_CONTROL.md) |
| **Scope Enforcement** | Atlassian Forge manifest.yml | Cannot request extra permissions | [manifest.yml](../atlassian/forge-app/manifest.yml) |

### 1.3 Data Access & APIs

| Behavior | Who Controls | FirstTry Role | Documentation |
|----------|--------------|---------------|----------------|
| **API Rate Limits** | Atlassian Jira Cloud | Respects limits, retries if needed | [RELIABILITY.md](RELIABILITY.md) |
| **Data Schema Changes** | Atlassian Jira | Adapts to Jira API changes | [INCIDENT_RESPONSE.md](INCIDENT_RESPONSE.md) |
| **Webhook Availability** | Atlassian Forge | Receives issue.created/updated events | [DATA_INVENTORY.md](DATA_INVENTORY.md) |
| **Field Availability** | Jira configuration (customer-defined) | Reads available fields only | [DATA_INVENTORY.md#11-custom-fields](DATA_INVENTORY.md#11-custom-fields) |

### 1.4 Updates & Deployments

| Behavior | Who Controls | FirstTry Role | Documentation |
|----------|--------------|---------------|----------------|
| **App Updates** | Atlassian Marketplace / Atlassian Forge | Automatic without downtime | [ENTERPRISE_READINESS.md#release-cycle](ENTERPRISE_READINESS.md#release-cycle) |
| **Rollback** | Atlassian Forge | Automatic rollback if deployment fails | [RELIABILITY.md](RELIABILITY.md) |
| **Availability During Updates** | Atlassian platform SLA | FirstTry available based on Forge uptime | [RELIABILITY.md](RELIABILITY.md) |

---

## 2. What FirstTry CANNOT Do

### 2.1 Storage & Data Lifecycle

❌ **Cannot**:
- Delete data before uninstall
- Control data residency (region locked by Jira Cloud workspace)
- Encrypt data with custom keys
- Back up data outside Forge storage
- Restore deleted data
- Enforce retention via TTL (indefinite by design)
- Migrate data to different Jira Cloud region

### 2.2 Access & Authorization

❌ **Cannot**:
- Require additional authentication beyond Jira OAuth
- Override Jira admin permissions
- Create custom roles or permission levels
- Deny access based on custom rules
- Audit user logins (not stored by FirstTry)

### 2.3 Configuration & Deployment

❌ **Cannot**:
- Require setup wizard
- Require configuration before use
- Auto-deploy to multiple workspaces
- Block Atlassian updates
- Request additional Forge permissions at runtime

### 2.4 Reliability & Support

❌ **Cannot**:
- Guarantee uptime beyond Atlassian Forge SLA
- Control Jira Cloud availability
- Provide on-premise deployment
- Support Jira Server (deprecated by Atlassian)
- Promise support SLA beyond "best effort"

---

## 3. Atlassian Responsibilities (FirstTry Dependencies)

| Responsibility | Atlassian Role | FirstTry Dependency |
|----------------|----------------|---------------------|
| **Infrastructure** | Runs Forge containers | FirstTry relies on Forge stability |
| **Data Encryption** | AES-256, TLS 1.2+ | FirstTry depends on encryption |
| **Authentication** | OAuth 2.0 + Jira identity | FirstTry trusts auth tokens |
| **API Stability** | Jira Cloud REST API | FirstTry reads Jira via API |
| **Webhooks** | Deliver events to Forge | FirstTry receives issue events |
| **Storage** | Forge KV storage | FirstTry writes logs & metrics |
| **Workspace Isolation** | Forge scope model | FirstTry relies on structural isolation |
| **Updates** | Automatic app deployment | FirstTry has no control over rollout |

---

## 4. Dependencies Not Met by FirstTry

### 4.1 GDPR / Data Subject Rights

**Responsibility**: Atlassian  
**Why FirstTry Cannot Meet This Alone**:
- Data deletion requires Atlassian uninstall
- Data access requires Jira API (Atlassian-controlled)
- Retention governed by Forge platform lifecycle
- Data residency locked to Jira Cloud region

**Reference**: [COMPLIANCE.md#gdpr-compliance](COMPLIANCE.md#gdpr-compliance)

### 4.2 SOC 2 / Security Certifications

**Responsibility**: Atlassian Forge platform  
**FirstTry's Role**: Operates within SOC 2-certified Forge infrastructure  
**FirstTry Does NOT Provide**: Standalone SOC 2 report

**Reference**: [COMPLIANCE.md#risk-assessment](COMPLIANCE.md#risk-assessment)

### 4.3 Data Processing Agreement (DPA)

**Responsibility**: Atlassian  
**Why FirstTry Cannot Offer One**:
- FirstTry does not control data processing terms
- Atlassian Forge is the data processor platform
- DPA must come from Atlassian, not the app

**Reference**: [COMPLIANCE.md#data-processing-addendum](COMPLIANCE.md#data-processing-addendum)

### 4.4 Incident Response & Forensics

**Responsibility**: Atlassian (for infrastructure) + Customer (for Jira data)  
**FirstTry's Role**: Logs errors; cannot access Forge infrastructure logs

**Reference**: [INCIDENT_RESPONSE.md](INCIDENT_RESPONSE.md)

---

## 5. What Changes If FirstTry Were Not on Forge?

| Feature | Today (On Forge) | If On-Premise | If Self-Hosted |
|---------|------------------|---------------|-----------------|
| Data Residency | Locked to Jira Cloud region | Customer controls | Customer controls |
| Encryption Keys | Atlassian manages | Customer manages | Customer manages |
| Backup & Recovery | Atlassian manages | Customer manages | Customer manages |
| Updates | Automatic, no downtime | Manual, requires downtime | Manual, requires downtime |
| Authentication | Jira OAuth only | Can add custom auth | Can add custom auth |
| Uptime SLA | Forge SLA only | Customer's infra SLA | Customer's infra SLA |

---

## 6. Recommended Alternatives If Dependencies Block You

| Requirement | FirstTry on Forge | Alternative |
|-------------|-------------------|-------------|
| **Custom encryption keys** | ❌ Not available | Evaluate on-premise solutions |
| **On-premise deployment** | ❌ Forge-only | Contact Atlassian for Marketplace on-premise apps |
| **Data residency in [region]** | ✅ Via Jira Cloud region (US/EU) | Confirm Jira Cloud region matches |
| **Custom data lifecycle** | ❌ Platform-controlled | Evaluate non-Forge apps |
| **Faster updates** | ❌ Automatic on Atlassian schedule | Enterprise Marketplace app with staged rollout |
| **Dedicated support SLA** | ⏳ "Best effort" | Escalate to Atlassian support via Jira Cloud plan |

---

## 7. Escalation: What To Ask Atlassian

If your organization requires a feature that FirstTry cannot provide due to Forge limitations:

1. **Contact**: security@atlassian.com
2. **Request**: "FirstTry is missing [feature] due to Forge limitations. Can Atlassian provide [workaround]?"
3. **Provide**: Your Jira Cloud organization ID
4. **Examples**:
   - Custom encryption key management
   - On-premise Marketplace deployment
   - Data residency guarantees outside US/EU
   - Dedicated support SLA

---

## 8. Change Log

| Date | Change |
|------|--------|
| 2025-12-22 | v1.0 - Initial release: Documented all FirstTry dependencies on Atlassian Forge |

---

**Related Documents**:
- [DATA_RETENTION.md](DATA_RETENTION.md) — What FirstTry retains
- [SECURITY.md](SECURITY.md) — How FirstTry secures data
- [COMPLIANCE.md](COMPLIANCE.md) — Compliance certifications & gaps
- [ENTERPRISE_READINESS.md](ENTERPRISE_READINESS.md) — Enterprise deployment guide
