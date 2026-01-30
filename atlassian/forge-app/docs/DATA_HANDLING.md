# Data Handling Guide

**Effective Date**: January 2026  
**Version**: 1.0

---

## 1. Data Categories

This app processes the following data categories:

### Workspace & User Data (Required)
- **Jira workspace ID** (cloudId)
- **Jira user ID** (accountId)
- **User display name** (if available)

### Build & Snapshot Data (Core Function)
- **Git commit SHA** (build identity)
- **Bundle hash** (build identity)
- **Snapshot ID** (unique identifier)
- **Snapshot creation timestamp**
- **Snapshot state** (AVAILABLE, NO_SNAPSHOT, HARD_ERROR, INVALID_SNAPSHOT)
- **Build metadata** (size, version)

### Request Data (Operational)
- **UI request ID** (ui_req_id, for correlation)
- **Request timestamps**
- **Request status codes**

### Debug Data (Optional)
- **Console logs** (if ?ft_debug=1 enabled)
- **Request/response payloads** (if debug mode enabled)

---

## 2. Storage Location

### Where Data Is Stored

| Data Type | Storage | Accessible To |
|-----------|---------|---|
| Workspace metadata | Forge bridge (Atlassian) | Jira workspace admins, this app |
| Snapshot records | Forge Storage API | Jira workspace admins, this app |
| Browser session | Browser memory | Current user session only |
| Local storage | NONE (app does not use) | N/A |
| Server-side persistence | NONE (app stores no data on servers) | N/A |

### Encryption
- **In transit**: TLS 1.2+ (enforced by Forge)
- **At rest**: Forge Storage API encryption (Atlassian-managed keys)
- **Key management**: Atlassian (not controlled by this app)

---

## 3. Data Retention Policy

### Session Data
- **Retention**: Session-only (cleared when browser tab closes)
- **Deletion**: Automatic (no manual action needed)

### Snapshot Records
- **Retention**: Follows your Jira data retention policy
- **Deletion**: Manual (via Jira workspace admin, not via this app)
- **Duration**: No automatic expiration (unless configured in Jira)

### Debug Logs
- **Retention**: Browser console only (not persisted)
- **Deletion**: Automatic (cleared when tab closes)

### Request Logs
- **Retention**: Follows Atlassian Forge platform logs (typically 30 days)
- **Deletion**: Automatic (Atlassian-managed)

---

## 4. Data Deletion Policy

### User-Initiated Deletion
- **How**: Contact Jira workspace admin to remove this app
- **Effect**: All app-stored data is deleted
- **Timeline**: Immediate (upon app uninstall)

### Automatic Deletion
- **Forge logs**: Automatically deleted after ~30 days (Atlassian policy)
- **Session data**: Automatically deleted when tab closes
- **Browser cache**: User can clear via browser settings

### Manual Deletion (Admin)
Jira workspace admins can:
1. Export snapshot records (via Export button)
2. Uninstall this app (deletes all app data)
3. Request Atlassian to delete logs

---

## 5. Subprocessors

### Direct Subprocessors
**None**. This app does not engage third-party subprocessors.

### Indirect Subprocessors (Platform Dependencies)
- **Atlassian Forge Runtime**: Processes and stores app data
- **Jira Cloud**: Provides data access and audit trails
- **Atlassian Infrastructure**: Encrypts and backs up data

These are Atlassian-owned services, not external third parties.

---

## 6. Data Egress Statement

### External Data Egress
**NO EXTERNAL EGRESS**. This app:

- ❌ Does NOT send data to external APIs
- ❌ Does NOT export data to third-party services
- ❌ Does NOT use analytics or telemetry services
- ❌ Does NOT integrate with cloud storage providers
- ❌ Does NOT share data with ad networks or brokers

### Internal Egress (Jira Ecosystem Only)
- ✅ Data flows within the Jira workspace (Atlassian ecosystem)
- ✅ Data is visible to all users with app access
- ✅ Jira admins can access all app data

---

## 7. Data Processing

### How Data Is Used

| Data | Purpose | Retention |
|------|---------|-----------|
| Workspace ID | Identify Jira workspace | Session |
| User ID | Identify current user | Session |
| Snapshot records | Display in dashboard | Until app uninstall |
| Git SHA / Bundle hash | Show build identity | Until app uninstall |
| Request ID | Correlate multi-step requests | ~30 days (Forge logs) |

### Data Is NOT Used For
- ❌ Machine learning or analytics
- ❌ Advertising or marketing
- ❌ Selling or sharing with third parties
- ❌ Building user profiles
- ❌ Tracking behavior across apps

---

## 8. Data Sharing Within Jira

### Visibility
- **Snapshot records**: Visible to all users who can access this Forge app in the workspace
- **Build identity**: Visible to all users accessing the dashboard
- **Export data**: Visible to users who click Export (exported records are user-visible)

### Access Control
- **Workspace-level**: Only users in the Jira workspace can access data
- **App-level**: Any user with permission to view the Forge app can see dashboard data
- **Role-based restrictions**: Not enforced by this app (rely on Jira workspace permissions)

---

## 9. Compliance

### GDPR (General Data Protection Regulation)

**Data Subject Rights**:
- **Access**: Jira users can see their own data via the dashboard
- **Deletion**: Jira admins can delete app data by uninstalling the app
- **Portability**: Users can export snapshot records via the Export button

**Data Processing**:
- **Legal basis**: Legitimate interest (build verification & audit)
- **Processor**: Atlassian (primary), this app (secondary processor)
- **Data Agreements**: Covered by Atlassian's Data Processing Addendum (DPA)

### SOC 2
- **Audit status**: In development (contact support for audit reports)
- **Controls**: Inherit Atlassian Forge platform controls

### HIPAA
- **Status**: NOT HIPAA-compliant (not designed for PHI)
- **Recommendation**: Do not store Protected Health Information in snapshots

---

## 10. Third-Party Integrations

### APIs This App Calls
- **Jira REST API**: Read-only access to snapshot metadata
- **Forge Storage API**: Read/write to snapshot records
- **Forge Runtime**: OAuth and request correlation

### APIs This App DOES NOT Call
- ❌ Google Analytics, Mixpanel, Amplitude, Segment (no analytics)
- ❌ AWS S3, Azure Blob Storage, Google Cloud Storage (no external storage)
- ❌ Slack, Teams, Discord webhooks (no notifications)
- ❌ Payment processors (no billing)
- ❌ CRM or email services (no outreach)

---

## 11. Data Subject Requests

### Access Request
User wants to see all data we hold about them.

**Process**:
1. Contact support (see docs/SUPPORT.md)
2. Provide: Jira workspace URL, user display name
3. We will provide: Snapshot records visible to that user
4. Timeline: Best effort within 5 business days

### Deletion Request
User wants all their data deleted.

**Process**:
1. Contact Jira workspace admin
2. Admin uninstalls this app
3. Result: All app data is deleted immediately
4. OR: Contact Atlassian for deletion of Forge platform logs

### Portability Request
User wants to export all their data.

**Process**:
1. Use the Export button in the dashboard
2. Snapshot records are exported as JSON
3. Timeline: Immediate

---

## 12. Data Breach Notification

If a data breach occurs:

1. **Investigation**: We investigate the root cause (2–5 days)
2. **Notification**: We notify affected users via email + Jira alerts (within 72 hours or per legal requirement)
3. **Remediation**: We implement fixes and security patches (3–7 days)
4. **Transparency**: We publish a security advisory with details

---

## 13. Contact

For data handling questions:

- **Email**: support@firstry-solutions.com
- **Privacy inquiries**: support@firstry-solutions.com
- **Security inquiries**: security@firstry-solutions.com

---

## 14. Changes to This Policy

We may update this data handling guide to reflect:
- Changes in how data is stored or processed
- New integrations or subprocessors
- Legal or regulatory changes

When we make changes:
1. We update the "Effective Date" at the top
2. We increment the "Version" number
3. Existing data continues to be handled per the previous policy (no retroactive changes)

---

**Last Updated**: January 2026  
**For questions**: support@firstry-solutions.com
