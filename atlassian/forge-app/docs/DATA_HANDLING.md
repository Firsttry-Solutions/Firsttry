# Data Handling Policy

**Last Updated**: 2026-01-10  
**Classification**: Public (Data Privacy & Retention)

---

## Data Accessed

FirstTry accesses the following read-only metadata from Jira Cloud:

- **Project metadata**: Project keys, names, category, type (software/business)
- **Issue type definitions**: Field schemas, required fields, transitions
- **Status definitions**: Workflow states and category mappings
- **Issue metadata**: Issue key, created date, updated date, assignee ID, reporter ID, current status
- **Field schema**: Custom field names and types (schema only, NOT custom field values)

### What Is NOT Accessed

- ❌ Issue descriptions or comments
- ❌ Attachments or file content
- ❌ Custom field values
- ❌ User personal data (email, full name)
- ❌ Private fields or restricted content
- ❌ Audit logs (Jira's own internal logs)

---

## Data Stored

FirstTry stores governance evidence exclusively in **Atlassian Forge Storage** (app-scoped, cloudId-isolated):

1. **Snapshots**: Jira metadata snapshots (project/issue schema, timestamp, structure)
2. **Drift Ledgers**: Historical comparisons of metadata changes over time
3. **Proof-of-Life Reports**: Evidence of periodic app execution and health
4. **Pipeline Run Ledgers**: Audit trail of governance checks
5. **Disclosure Envelopes**: Transparent reporting of missing/incomplete data

---

## Storage Location Details

| Attribute | Value |
|-----------|-------|
| **Service** | Atlassian Forge Storage API (managed service) |
| **Region** | Follows Jira Cloud tenant region (US, EU, or APAC) |
| **Access Control** | Forge platform enforces cloudId isolation; app cannot access other tenants' storage |
| **Backup / Disaster Recovery** | Atlassian Forge Storage standard practices (customer cannot configure) |
| **Customer-Managed Encryption** | Not applicable (encryption at rest managed by Forge Storage) |

---

## Data Retention Period

| Data Type | Default Retention | Rationale |
|-----------|-------------------|-----------|
| Snapshots | 30 days (rolling) | Recent metadata for comparison; older snapshots purged to manage storage quota |
| Drift Ledgers | 90 days (rolling) | Sufficient for trend analysis and audit trail |
| Reports | 12 months (rolling) | Long-term governance and compliance tracking |

**Automatic Purge**: Data older than retention period is automatically deleted daily via scheduled cleanup job (Forge scheduled trigger).

**Customer Control**: Customers may manually trigger deletion by:
1. Uninstalling the FirstTry app from Jira Cloud
2. Contacting support at: https://github.com/Global-domination/Firstry/issues

---

## Data Deletion Policy

### Automatic Deletion

- **Trigger**: Daily scheduled job (Forge scheduledTrigger)
- **Scope**: All data exceeding retention period (30/90/365 days per type)
- **Timeline**: Data physically deleted within 24 hours of retention expiry
- **Irreversible**: No restore capability; data is permanently deleted

### Manual Deletion (Uninstall)

- **Trigger**: When customer uninstalls FirstTry app from Jira Cloud
- **Scope**: ALL FirstTry data (snapshots, ledgers, reports)
- **Timeline**: Deleted immediately; physical deletion within 24 hours
- **Confirmation**: No confirmation email; deletion is automatic per Forge Storage behavior

### Export / Data Subject Access Request (DSAR)

- **Capability**: FirstTry does NOT expose a bulk export API
- **Workaround**: Customer can screenshot/copy individual snapshots from dashboard
- **Escalation**: DSAR requests should be directed to Atlassian (who manages Jira Cloud data) + FirstTry support for clarification on what FirstTry stores

---

## Data Egress Policy

### Outbound Data Transfer

**NONE** — FirstTry does NOT transmit stored data outside Jira Cloud Forge environment.

**Blocked Channels**:
- ❌ No HTTP/HTTPS egress to monitoring/analytics services
- ❌ No webhooks to external systems
- ❌ No email delivery of snapshots
- ❌ No S3/cloud storage export
- ❌ No Slack/Teams notifications containing snapshot data

**Why**: Forge network sandbox prevents outbound calls; app lacks HTTP scope permissions.

**Data Residency**: All evidence remains in Forge Storage and is accessible only via Jira Cloud UI dashboards.

---

## Data Handling Contact

**Questions about data practices**:
- **Email**: https://github.com/Global-domination/Firstry/issues (use "data-handling" label)
- **Response Time**: Best effort; no SLA
- **Privacy Officer**: None designated (app has no external data flows; Jira Cloud admins are responsible for org-level privacy)
- **Data Protection Officer**: Not applicable (data processing is within Jira Cloud; GDPR accountability belongs to Jira Cloud customer + Atlassian)

---

## Related Documentation

- [SECURITY.md](SECURITY.md) — Security model and threat boundaries
- [SCOPES_JUSTIFICATION.md](SCOPES_JUSTIFICATION.md) — Why storage:app and read:jira-work scopes are required
- [SUPPORT.md](SUPPORT.md) — How to get help with data questions
