# Data Retention Documentation

**App Name**: FirstTry Governance - Atlassian Dual-Layer Integration  
**Last Updated**: 2025-12-22  
**Purpose**: Data lifecycle, retention policies, and deletion procedures  

---

## Data Storage Overview

### What Data Is Stored

This app stores in Forge Storage API:

1. **Jira Metadata Events**:
   - Issue created/updated timestamps
   - Project IDs and keys
   - Issue type metadata
   - Status metadata
   - Field definitions (no field values)

2. **Aggregated Data**:
   - Daily event counts
   - Weekly summaries
   - Project coverage statistics

3. **Generated Reports**:
   - Phase 5 Proof-of-Life reports
   - Phase 6 Snapshot evidence ledgers
   - Phase 7 Drift detection results
   - Phase 8 Metrics

4. **Operational Data**:
   - Pipeline run ledgers
   - Scheduler state
   - Readiness gate flags

### What Data Is NOT Stored

❌ **Never Stored**:
- Issue descriptions or comments (actual content)
- User email addresses or account names
- Attachments or files
- Custom field values (only field definitions)
- Passwords, API tokens, or credentials
- IP addresses or session identifiers

---

## Retention Policy

### Default Retention

**Policy**: Data retained **indefinitely** until explicit deletion.

**Rationale**: App is designed for historical governance tracking. No automatic expiration.

### Exceptions

**Run Ledgers**: Retention period **UNKNOWN** (implementation-dependent)  
**Scheduler State**: Overwritten on each run (effectively short retention)  

---

## Data Lifecycle

### Data Creation

**Trigger**: Jira metadata ingestion (manual or scheduled)  
**Frequency**: Daily/weekly pipelines (if enabled in manifest)  

### Data Updates

**Aggregations**: Overwritten daily/weekly  
**Reports**: New report overwrites previous (no versioning)  
**Events**: Append-only (no updates to historical events)  

## Data Deletion Procedures

### App Uninstallation

**Behavior**: Forge platform **does not** automatically delete app data on uninstall.

**Action Required**: Customer must manually delete data before uninstalling if they require removal of stored artifacts.

**Process**:
1. Use admin UI export feature to backup data (if desired).
2. Uninstall app via Jira admin console.
3. Forge Storage data **persists** after uninstall.
4. Contact Atlassian support to request Forge Storage deletion (if needed).

**IMPORTANT**: App developers **cannot** delete customer data. Only Atlassian Forge platform can delete Forge Storage.

### How to delete data (customer steps)

1. Export required reports via the admin UI (see `EXPORT_FORMAT.md`).
2. Uninstall the app from the Jira admin console.
3. Contact Atlassian support with a request to delete Forge Storage for the app, including the app id `ari:cloud:ecosystem::app/59d86182-c1c6-49ea-b2fb-6ee5be52b7fc` and the tenant cloudId.
4. Keep a copy of the support request and response for audit evidence.

Template support request (copy-paste):
```
Subject: Request to delete Forge Storage for FirstTry app

Please delete Forge Storage for app id ari:cloud:ecosystem::app/59d86182-c1c6-49ea-b2fb-6ee5be52b7fc for tenant the site identifier (cloudId). The customer has uninstalled the app and requests permanent deletion of app storage. Contact: contact@firsttry.run
```

**Notes**: The platform (Atlassian) controls storage deletion timelines; the timeline is UNKNOWN and depends on Atlassian support processes.

### Per-Tenant Deletion

**Capability**: **NOT IMPLEMENTED**

App does **not** provide:
- "Delete all my data" button
- Tenant-level purge function
- Selective data deletion API

**Workaround**: Uninstall app + request Forge Storage deletion from Atlassian

### Selective Deletion

**Capability**: **NOT IMPLEMENTED**

App does **not** provide:
- Delete specific events
- Delete specific reports
- Delete date ranges

**Rationale**: Governance app design assumes immutability of historical data.
- Delete specific events
- Delete specific reports
- Delete date ranges

**Rationale**: Governance app design assumes immutability of historical data.

---

## Data Export

### Export Formats

**Available**:
- JSON export (via admin UI)
- PDF export (via admin UI, if implemented)

**Location**: Browser download (not stored server-side)

### Export Scope

**Included**:
- Latest generated report
- Snapshot evidence (if Phase 6 enabled)
- Aggregated metrics

**Not Included**:
- Raw event stream (no bulk export)
- Historical report versions (only latest)
- Operational data (run ledgers, scheduler state)

### Export Limitations

**Frequency**: No rate limit (manual trigger only)  
**Size Limit**: Governed by Forge Storage API and browser download limits  
**Format Guarantees**: JSON schema may change across app versions  

---

## GDPR & Privacy Considerations

### Data Minimization

✅ **Implemented**: App stores only metadata (IDs, timestamps, counts)  
✅ **No PII**: No email addresses, account names, or personal identifiers  

### Right to Access

**Process**: Customer exports data via admin UI  
**Format**: JSON (machine-readable)  

### Right to Deletion

**Process**: Customer uninstalls app + contacts Atlassian for Forge Storage deletion  
**Timeline**: UNKNOWN (depends on Atlassian support)  

### Right to Portability

✅ **Supported**: JSON export provides machine-readable format  

### Data Processing Agreement (DPA)

**Responsibility**: Atlassian (as Forge platform provider)

This app:
- Does not process personal data (only Jira metadata IDs)
- Has no direct data processor relationship with customers
- Delegates DPA obligations to Atlassian/Forge

**Customer Action**: Review Atlassian's DPA for Forge apps.

---

## Data Residency

### Storage Location

**Platform**: Atlassian Forge Storage API  
**Region**: Governed by customer's Jira Cloud region  
**Specifics**: UNKNOWN (Atlassian-controlled)  

**App Does NOT**:
- Control storage region
- Replicate data cross-region
- Store data outside Forge Storage

See [PLATFORM_DEPENDENCIES.md](PLATFORM_DEPENDENCIES.md) for Forge infrastructure details.

### Data Sovereignty

**Compliance**: Delegated to Atlassian Forge platform  
**Customer Control**: Limited to Jira Cloud region selection (Atlassian setting)  

---

## Data Encryption

### Encryption at Rest

**Provider**: Forge Storage API  
**Algorithm**: UNKNOWN (Atlassian-controlled)  
**Key Management**: UNKNOWN (Atlassian-controlled)  

**App Does NOT**:
- Implement encryption
- Manage encryption keys
- Control encryption settings

### Encryption in Transit

**Provider**: Forge platform (TLS)  
**Version**: UNKNOWN (Atlassian-controlled)  

---

## Data Backup & Recovery

### Backup Strategy

**Forge Storage Backups**: UNKNOWN (Atlassian responsibility)  
**App-Level Backups**: **NONE**  

**Data Loss Risk**: If Forge Storage fails, data is **unrecoverable** by app.

### Recovery Capabilities

**Point-in-Time Recovery**: **NOT SUPPORTED**  
**Disaster Recovery**: **UNKNOWN** (Forge platform responsibility)  
**Customer-Initiated Restore**: **NOT SUPPORTED**  

---

## Audit & Compliance

### Data Access Logs

**Forge Platform Logs**: Available to Atlassian only (not app developers)  
**App-Level Logs**: **NONE** (no audit trail implementation)  
**Customer Visibility**: Jira audit log records app actions (Atlassian-provided)  

### Compliance Reporting

**Data Retention Report**: This document  
**Data Inventory**: See [What Data Is Stored](#what-data-is-stored) above  
**Access Logs**: Not provided by app (platform responsibility)  

---

## Retention Period Overrides

### Regulatory Requirements

**Customer Responsibility**: If customer has regulatory retention requirements (e.g., "delete after 7 years"), customer must:
1. Track app data retention separately
2. Uninstall app or request deletion at required time
3. Verify deletion with Atlassian

**App Does NOT**:
- Enforce regulatory retention periods
- Track customer-specific compliance deadlines
- Automatically delete data based on age

### Custom Retention Policies

**Supported**: **NO**

App uses fixed retention policy (indefinite until manual deletion).

**Feature Request**: Customers may request retention policy features via GitHub issues (no commitment).

---

## Data Minimization Practices

### What App Collects

**Only**: Jira metadata IDs, timestamps, and counts  
**Never**: Issue content, user names, emails, attachments  

### Collection Justification

**Purpose**: Governance tracking (compliance with original design spec)  
**Legal Basis**: Customer consent (via app installation)  

### Data Anonymization

**Status**: Data is pseudonymous (Jira IDs, not human names)  
**Re-identification Risk**: Low (no PII stored)  

---

## Contact

**Data Deletion Requests**: Uninstall app via Jira admin console, then contact Atlassian support  
**Export Questions**: https://github.com/Global-domination/Firstry/issues  
**Privacy Concerns**: See [SECURITY.md](SECURITY.md)  

**NO EMAIL SUPPORT**

---

## Disclaimer

Data retention and deletion are **platform-dependent** (Forge Storage API).

Customers with specific retention requirements should:
1. Review Atlassian's Forge data handling policies
2. Implement independent data tracking
3. Not rely solely on app-level retention

See LICENSE for warranty disclaimer.
