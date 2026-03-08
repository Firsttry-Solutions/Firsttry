# Data Flow Documentation

**Version:** 2.0.0  
**Last Updated:** 2026-03-08

## 1. Executive Summary

This document describes all data flows within the Jira Forge application, including:
- What data is accessed
- Where data is stored
- How data moves through the system
- Data retention and deletion

## 2. Data categories accessed

The App accesses the following categories of data from Jira Cloud:

### 2.1 Issue Data
- Issue keys, summaries, descriptions
- Issue status, priority, type
- Assignee and reporter information
- Comments and activity history
- Custom field values

**Purpose:** Display issue information in app UI, analyze governance compliance

### 2.2 Project Data
- Project keys, names, descriptions
- Project configurations and settings
- Workflow schemes

**Purpose:** Provide project-level views and filtering

### 2.3 User Data
- User account IDs (not email addresses)
- Display names
- Avatar URLs (Atlassian-hosted)

**Purpose:** Display user information in UI, track preferences

**Access Method:** All data accessed via Forge `requestJira()` API (read-only for issue/project data)

### 2.4 User Input

The App receives input from:
- UI form submissions
- Configuration panels
- Button clicks and selections

## 3. Data stored

### 3.1 Forge Storage API

**What We Store:**
- User preferences (theme, display settings)
- App configuration (enabled features, defaults)
- Cached issue metadata (for performance)
- Application state

**Storage Location:** Atlassian Forge Storage (managed by Atlassian)

**Storage Duration:** Until app uninstall or explicit deletion

### 3.2 What We Do NOT Store

Items excluded from storage:
- User passwords or credentials
- Complete issue bodies (only references)
- Attachments or file content
- Audit logs (handled by Jira)

## 4. Data Flow Diagram

```
User Browser
    ↓ (User Action)
Forge UI Component
    ↓ (Forge API Call)
Forge Runtime
    ↓ (Read Issue Data)
Jira Cloud API
    ↓ (Returns Data)
Forge Runtime
    ↓ (Process & Filter)
App Logic (src/)
    ↓ (Store Preferences)
Forge Storage
    ↓ (Read Cached Data)
App Logic
    ↓ (Render UI)
User Browser
```

## 5. Detailed Data Flows

### 5.1 Issue Display Flow

1. User navigates to issue page
2. Forge loads UI module
3. App calls `api.asApp().requestJira('/rest/api/3/issue/{issueId}')`
4. Forge runtime fetches data from Jira
5. App processes and filters data
6. App renders relevant information in UI
7. No permanent storage of issue content

### 5.2 Configuration Flow

1. User opens app settings panel
2. App reads current config from Forge Storage
3. User modifies settings
4. App validates input
5. App stores updated config via `storage.set(key, value)`
6. Settings persist in Forge Storage

### 5.3 Preference Load Flow

1. User opens app
2. App calls `storage.get(userId + ':preferences')`
3. Forge Storage returns data
4. App applies preferences to UI
5. No external transmission

## 6. Network Boundaries

### 6.1 Internal to Forge

All data stays within:
- Forge runtime sandbox
- Atlassian-controlled infrastructure
- No egress to external servers

### 6.2 No External Egress

The App does NOT:
- Call external APIs
- Send telemetry to third parties
- Use external CDNs (Forge handles assets)
- Connect to external databases

## 7. Data Processing

### 7.1 In-Memory Processing

The App processes data in memory:
- Filtering issue lists
- Sorting and grouping
- Calculating derived values

**Duration:** Cleared on function completion

### 7.2 No Sensitive Data Logging

The App does NOT log:
- Issue content
- User credentials
- Request/response bodies

## 8. Data retention

### 8.1 Persistent Data

**Retention Period:** 7 days for cached data; indefinite for user preferences until:
- App is uninstalled (automatic deletion)
- User requests deletion
- Manual cleanup via app settings

### 8.2 Temporary Data

In-memory data:
- Cleared after request completes
- Not persisted to disk
- No logging to external systems

## 9. Data Deletion

### 9.1 Uninstall Procedure

When app is uninstalled:
1. Forge automatically clears all storage entries
2. No data remains in Forge Storage
3. No manual cleanup required

### 9.2 User-Initiated Deletion

Users can delete specific data:
- Via "Clear Preferences" button in settings
- Calls `storage.delete(key)`
- Immediate removal from storage

### 9.3 Automatic Cleanup

The App includes:
- Stale data cleanup (configurable interval)
- Orphaned entry detection
- Storage quota management

## 10. Data Access Controls

### 10.1 Scope-Based Access

The App only accesses data permitted by declared scopes:
- `read:jira-work` for issue reading
- `storage:app` for app storage
- No admin or write scopes unless required

### 10.2 User Context

All API calls are made:
- In the context of the requesting user
- With user's permissions
- No elevation of privileges

## 11. Data Encryption

### 11.1 In Transit

All data transmission uses:
- HTTPS/TLS (Forge enforced)
- Atlassian's encryption standards

### 11.2 At Rest

Forge Storage encryption:
- Managed by Atlassian
- Per Atlassian's security policies
- App has no direct control

## 12. Compliance Considerations

### 12.1 GDPR

For EU users:
- Data minimization: Only necessary data stored
- Right to deletion: Via uninstall or settings
- Data portability: Limited by Forge capabilities

### 12.2 Data Residency

Data resides:
- In Atlassian's chosen AWS regions
- Per customer's Jira instance location
- No cross-region transfers by app

## 13. Monitoring and Auditing

### 13.1 Access Logs

The App does NOT maintain its own logs. Atlassian provides:
- Forge function invocation logs
- API access logs (if enabled)

### 13.2 Error Reporting

Errors are reported:
- To Forge monitoring (Atlassian)
- No external error tracking services
- No PII in error messages

## 14. Third-Party Data Sharing

**The App does NOT share data with third parties.**

- No analytics services
- No advertising networks
- No data brokers
- No subprocessors (except Atlassian/AWS per Forge infrastructure)

## 15. Data Flow Security Measures

### 15.1 Input Validation

All user input is:
- Sanitized before processing
- Validated against expected formats
- Rejected if malformed

### 15.2 Output Encoding

Data rendered in UI is:
- Encoded to prevent XSS
- Handled by Forge UI libraries
- No direct DOM manipulation

## 16. Future Data Flow Changes

Any changes to data flows require:
- Updated documentation
- Marketplace review (if scope changes)
- User notification (for material changes)

## 17. Deterministic Claims (Machine-Parseable)

The following claims are provided for automated validation and marketplace review:

```
CLAIM_DATA_STORED: FORGE_STORAGE_ONLY
CLAIM_EGRESS: ATLASSIAN_ONLY
CLAIM_THIRD_PARTY_APIS: NONE
```

**Explanation:**
- **CLAIM_DATA_STORED: FORGE_STORAGE_ONLY** - All data is stored exclusively in Atlassian Forge Storage API. No external databases or third-party storage.
- **CLAIM_EGRESS: ATLASSIAN_ONLY** - All network requests go only to Atlassian APIs via `requestJira()`. Zero egress to external domains.
- **CLAIM_THIRD_PARTY_APIS: NONE** - No third-party API integrations. No fetch/axios/http requests to external services.

---

**This document represents the current data flows. For questions or concerns, see [MARKETPLACE_SECURITY_CONTACT.md](./MARKETPLACE_SECURITY_CONTACT.md).**

