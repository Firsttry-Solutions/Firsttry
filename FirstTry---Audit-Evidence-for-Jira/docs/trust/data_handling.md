# FirstTry Data Handling Policy

**Version:** 2.0.0  
**Last Updated:** March 4, 2026  
**Status:** Active

## 1. Overview

This document describes how FirstTry collects, processes, stores, and handles customer data in compliance with GDPR, CCPA, and industry best practices.

## 2. Data Collection

### 2.1 What Data We Collect

FirstTry is a **read-only, audit-focused application** with minimal data collection:

| Data Type | Source | Purpose | Legal Basis |
|-----------|--------|---------|-------------|
| Jira issue keys | Jira Cloud API | Display audit snapshots | Legitimate interest |
| Issue summaries | Jira Cloud API | Evidence pack content | Legitimate interest |
| Issue status | Jira Cloud API | Detect changes | Legitimate interest |
| User IDs | Forge Bridge | Attribute actions | Legitimate interest |
| Snapshot timestamps | FirstTry app | Audit trail | Legitimate interest |
| Configuration | User input | App settings | Contract |

### 2.2 What Data We Do NOT Collect

FirstTry explicitly **does not** collect:

- ❌ Issue descriptions or comments (only summaries)
- ❌ Attachments or files
- ❌ Personally identifiable information (PII) beyond user IDs
- ❌ Email addresses
- ❌ IP addresses
- ❌ Browser fingerprints
- ❌ Tracking cookies
- ❌ Usage analytics (no telemetry)

### 2.3 Data Sources

```
┌─────────────────────────────────────────────────────────┐
│  Data Collection (Read-Only)                             │
└─────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────┐
│  Jira Cloud API                                          │
│  ├─ GET /rest/api/3/issue/{key}                         │
│  └─ Fields: key, summary, status, updated               │
└─────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────┐
│  FirstTry Processor                                      │
│  ├─ Extract minimal fields                              │
│  └─ Generate snapshot                                   │
└─────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────┐
│  Forge Storage (Encrypted)                               │
│  └─ Per-installation isolation                          │
└─────────────────────────────────────────────────────────┘
```

## 3. Data Processing

### 3.1 Processing Activities

| Activity | Purpose | Data Used | Retention |
|----------|---------|-----------|-----------|
| Snapshot generation | Capture point-in-time state | Issue key, summary, status | 90 days |
| Evidence pack creation | Audit compliance | Snapshot data | Ephemeral (in /tmp) |
| Dashboard display | User interface | Snapshot data | Real-time |
| Scheduled refresh | Keep snapshots current | Issue key, updated timestamp | N/A |

### 3.2 Data Minimization

FirstTry implements **data minimization** principles:

1. **Minimal fields:** Only collect issue key, summary, status (not full issue body)
2. **No telemetry:** No usage analytics or tracking
3. **No external storage:** Data never leaves Atlassian infrastructure
4. **Auto-purge:** Snapshots deleted after 90 days
5. **Deletion on uninstall:** All data deleted when app removed

### 3.3 Data Flow Diagram

```
User Browser
    │
    │ 1. Dashboard load
    ▼
Forge Custom UI
    │
    │ 2. Resolver call (getSnapshots)
    ▼
Resolver Function
    │
    │ 3. Query Forge Storage
    ▼
Forge Storage (Encrypted)
    │
    │ 4. Return snapshot data
    ▼
Dashboard (Render)
```

**No data leaves Atlassian infrastructure.**

## 4. Data Storage

### 4.1 Storage Technology

FirstTry uses **Forge Storage API** provided by Atlassian:

- **Encryption:** AES-256 at rest
- **Isolation:** Per-installation (tenant-scoped)
- **Location:** Atlassian-managed datacenters
- **Backup:** Handled by Atlassian
- **Access control:** Only FirstTry app can access its own storage

### 4.2 Storage Structure

```json
{
  "storageKey": "snapshots",
  "value": {
    "PROJ-123": {
      "issueKey": "PROJ-123",
      "summary": "Example issue",
      "status": "Done",
      "snapshotTime": "2026-03-04T12:00:00Z"
    }
  }
}
```

**Key Points:**
- Single storage key per installation
- JSON structure
- No nested PII
- Timestamps in ISO 8601 format

### 4.3 Data Retention

See [Data Retention Policy](data_retention.md) for details.

## 5. Data Sharing

### 5.1 Third-Party Sharing

FirstTry **does not share data** with third parties:

- ❌ No analytics providers (no Google Analytics, Mixpanel, etc.)
- ❌ No CDNs for customer data
- ❌ No external APIs
- ❌ No marketing platforms
- ❌ No data brokers

### 5.2 Subprocessors

FirstTry has **zero subprocessors**. The only data processor is:

| Entity | Role | Purpose | Location |
|--------|------|---------|----------|
| Atlassian | Platform provider | Forge hosting | Global (customer-selected region) |

All data processing occurs within Atlassian's infrastructure.

See [Subprocessors](subprocessors.md) for details.

### 5.3 Legal Disclosures

FirstTry may disclose data only under the following circumstances:

1. **Legal obligation:** Valid court order, subpoena, or legal process
2. **Customer consent:** Explicit written permission
3. **Atlassian request:** For Marketplace security investigations

**Notice:** Wherever legally permitted, FirstTry will notify customers before disclosure.

## 6. Data Subject Rights

### 6.1 GDPR Rights

FirstTry supports the following data subject rights:

| Right | How to Exercise | Response Time |
|-------|-----------------|---------------|
| Access | Email privacy@firsttry.run | 30 days |
| Rectification | Modify snapshots in dashboard | Real-time |
| Erasure | Uninstall app | Immediate |
| Portability | Evidence pack export | On demand |
| Objection | Uninstall app | Immediate |
| Restriction | Disable scheduled triggers | Via app config |

### 6.2 CCPA Rights

California residents have additional rights:

- **Right to know:** Request disclosure of data collected
- **Right to delete:** Request deletion (uninstall app)
- **Right to opt-out:** No data selling (N/A for FirstTry)
- **Non-discrimination:** No penalty for exercising rights

### 6.3 Data Deletion

**Automatic Deletion:**
- Snapshots older than 90 days: Auto-purged
- Uninstall: All data deleted immediately

**Manual Deletion:**
- Email privacy@firsttry.run with installation ID
- Data deleted within 48 hours

## 7. Data Security

### 7.1 Security Controls

| Control | Implementation | Standard |
|---------|----------------|----------|
| Encryption at rest | AES-256 (Forge Storage) | NIST SP 800-175B |
| Encryption in transit | TLS 1.3 (Atlassian) | RFC 8446 |
| Access control | Forge Bridge (OAuth 2.0) | RFC 6749 |
| Network isolation | No external egress | N/A |
| Input validation | All user inputs sanitized | OWASP ASVS |

### 7.2 Data Protection Impact Assessment (DPIA)

**Risk Level:** Low

**Rationale:**
1. Read-only access (no data modification)
2. Minimal data collection (issue metadata only)
3. No sensitive categories (no health, biometric, financial data)
4. No profiling or automated decision-making
5. Short retention period (90 days)
6. Strong isolation (per-installation storage)

**Assessment:** DPIA not required under GDPR Article 35.

## 8. Data Breach Response

### 8.1 Notification Obligations

In the event of a data breach affecting FirstTry data:

1. **Detection:** Atlassian or FirstTry detects breach
2. **Assessment:** Determine scope, impact, affected users (within 24 hours)
3. **Notification to Supervisor Authority:** Within 72 hours (GDPR Article 33)
4. **Notification to Data Subjects:** Without undue delay if high risk (GDPR Article 34)
5. **Remediation:** Implement fixes, evidence packs for forensics

### 8.2 Breach Classification

| Severity | Criteria | Notification |
|----------|----------|--------------|
| Critical | PII exposed, external exfiltration | Immediate (< 24 hours) |
| High | Unauthorized access to snapshots | Within 72 hours |
| Medium | Access control misconfiguration | Within 7 days |
| Low | No data exposure | Internal only |

See [Incident Response Plan](incident_response.md) for details.

## 9. Privacy by Design

FirstTry implements **Privacy by Design** principles:

1. **Proactive not reactive:** Security controls built-in, not added later
2. **Privacy as default:** Minimal data collection, auto-purge enabled by default
3. **Privacy embedded:** No toggle to "disable privacy"
4. **Full functionality:** Privacy does not reduce app capabilities
5. **End-to-end security:** From collection to deletion
6. **Transparency:** This document + security whitepaper
7. **User-centric:** Data subject rights supported

## 10. Cross-Border Data Transfers

### 10.1 International Transfers

FirstTry data resides within **Atlassian Cloud infrastructure**:

- **EU customers:** Data stored in EU region (Frankfurt, Dublin)
- **US customers:** Data stored in US region (Virginia, Oregon)
- **APAC customers:** Data stored in Sydney

**Transfer Mechanism:** Atlassian Standard Contractual Clauses (SCCs)

### 10.2 Data Residency

Customers can verify data residency via Atlassian Cloud settings:
- Jira Admin → System → Atlassian account → Data residency

FirstTry inherits Jira's data residency configuration.

## 11. Compliance

### 11.1 Regulatory Compliance

| Regulation | Status | Evidence |
|------------|--------|----------|
| GDPR | Compliant | This document + security whitepaper |
| CCPA | Compliant | Data subject rights supported |
| HIPAA | Not applicable | No PHI collected |
| SOC 2 Type II | Inherited from Atlassian | Atlassian Trust Center |
| ISO 27001 | Inherited from Atlassian | Atlassian certifications |

### 11.2 Audit Trail

FirstTry maintains audit trails for:

1. **Data access:** Forge Bridge logs (managed by Atlassian)
2. **Data modifications:** N/A (read-only app)
3. **Configuration changes:** Logged in snapshot metadata
4. **Evidence packs:** SHA256 manifests with timestamps

## 12. Contact Information

For data handling inquiries:

- **Privacy Officer:** privacy@firsttry.run
- **Data Protection Officer:** dpo@firsttry.run
- **General Inquiries:** support@firsttry.run

**Response Time:** Within 48 hours for privacy inquiries.

---

## 13. References

- [GDPR](https://gdpr.eu/)
- [CCPA](https://oag.ca.gov/privacy/ccpa)
- [Atlassian Privacy Policy](https://www.atlassian.com/legal/privacy-policy)
- [Forge Storage API](https://developer.atlassian.com/platform/forge/storage/)
- FirstTry Security Whitepaper: `docs/trust/security_whitepaper.md`
- Data Retention Policy: `docs/trust/data_retention.md`

---

**Policy Owner:** FirstTry Privacy Team  
**Next Review:** 2026-06-04  
**Version History:**
- v1.0 (2026-03-04): Initial release
