# FirstTry Data Inventory

**Version**: 1.0  
**Last Updated**: 2025-12-22  
**Purpose**: Single source of truth for all data collected, stored, and processed

---

## Data Inventory Matrix

| Item | Source | Purpose | Storage | Sensitivity | Retention | Exported? |
|------|--------|---------|---------|-------------|-----------|-----------|
| **Issue Snapshots** | Jira API (GET /rest/api/3/issues) | Baseline for drift comparison | `{orgKey}/snapshots/{date}/` | Operational Metadata | 90 days | ✅ Yes (reports) |
| **Event Ledger** | Jira Webhooks (issue.created/updated) | Audit trail of changes | `{orgKey}/events/{date}/` | Operational Metadata | 90 days | ✅ Yes (audit) |
| **Drift Reports** | Local computation | User-facing analysis | `{orgKey}/reports/{timestamp}/` | Non-sensitive | 30 days | ✅ Yes (user) |
| **Export Data** | User export action | Temporary download staging | `{orgKey}/exports/{timestamp}/` | Non-sensitive | 7 days | ✅ Yes (limited window) |
| **Configuration** | App manifest | Drift detection rules | Memory only | Non-sensitive | Session | ❌ No |

---

## 1. Issue Snapshots

### 1.1 Definition

A snapshot is a point-in-time capture of all Jira issues in a workspace.

### 1.2 Collection Source

- **Endpoint**: `GET /rest/api/3/issues` (Jira REST API v3)
- **Scope**: All issues accessible to the FirstTry app (workspace-wide)
- **Frequency**: User-triggered (on demand) or scheduled
- **Method**: Paginated fetch with caching

### 1.3 Fields Captured

**Included**:
```
issue.key          // e.g., "PROJ-123"
issue.id           // Internal ID
issue.summary      // Issue title
issue.status       // Current status
issue.type         // Issue type (Bug, Story, etc.)
issue.created      // Creation timestamp
issue.updated      // Last update timestamp
issue.project      // Project context
issue.customFields // Any custom field values
```

**NOT Included**:
- ❌ Comments or descriptions
- ❌ Attachments
- ❌ User email addresses
- ❌ User avatars

### 1.4 Storage Location

```
Forge Storage:
  {orgKey}/snapshots/{YYYY-MM-DD}/{snapshotId}.json
  
Example:
  acme-corp/snapshots/2025-12-22/snap-abc123.json
```

### 1.5 Data Minimization

Snapshots are minimal:
- ✅ Only metadata (no comments, descriptions)
- ✅ Hashed correlation IDs (not user-linked)
- ✅ Workspace-scoped isolation
- ✅ Time-limited retention (90 days)

### 1.6 Retention & Purge

- **TTL**: 90 days (constant `SNAPSHOT_TTL_SECONDS = 7776000`)
- **Auto-Purge**: Atlassian Forge infrastructure
- **Manual Delete**: Workspace admin can clear via app Storage dashboard

---

## 2. Event Ledger

### 2.1 Definition

Event records capture changes to issues over time, enabling drift detection.

### 2.2 Event Types Captured

| Event | Source | Fields |
|-------|--------|--------|
| `issue.created` | Jira Webhook | issueKey, project, timestamp |
| `issue.updated` | Jira Webhook | issueKey, changedFields, timestamp |
| (others) | Future expansion | TBD |

### 2.3 Storage Location

```
Forge Storage:
  {orgKey}/events/{YYYY-MM-DD}/{eventId}.json
  
Example:
  acme-corp/events/2025-12-22/evt-def456.json
```

### 2.4 Event Record Structure

```json
{
  "id": "evt-def456",
  "issueKey": "PROJ-123",
  "eventType": "issue.updated",
  "timestamp": 1703289600,
  "changedFields": ["status", "assignee"],
  "tenantId": "acme-corp",
  "correlationId": "corr-xyz789"
}
```

### 2.5 Retention & Purge

- **TTL**: 90 days (constant `EVENT_TTL_SECONDS = 7776000`)
- **Auto-Purge**: Atlassian Forge infrastructure (FIFO)
- **Bounded Growth**: No unbounded ledger accumulation

---

## 3. Drift Reports

### 3.1 Definition

User-facing reports that summarize detected drift between baseline and current state.

### 3.2 Generation Source

- **Input**: Issue snapshots + event ledger
- **Computation**: Local (in-memory analysis)
- **Output**: JSON/CSV report

### 3.3 Storage Location

```
Forge Storage:
  {orgKey}/reports/{YYYY-MM-DDTHH:MM:SS}/{reportId}.json
  
Example:
  acme-corp/reports/2025-12-22T14:30:00/rpt-ghi789.json
```

### 3.4 Report Contents

**Included**:
- Summary of detected drift (count, severity)
- List of affected issues
- Recommendations

**NOT Included**:
- ❌ Full issue descriptions
- ❌ User information
- ❌ Sensitive comments

### 3.5 Retention & Purge

- **TTL**: 30 days (constant `REPORT_TTL_SECONDS = 2592000`)
- **Auto-Purge**: Atlassian Forge infrastructure
- **Reason**: Reports are auto-generated; old reports are not valuable

---

## 4. Export Data

### 4.1 Definition

Temporary copies of reports for user download (CSV, JSON, PDF if supported).

### 4.2 User Action

1. User navigates to report in FirstTry UI
2. User clicks "Export"
3. File is written to Forge storage with 7-day TTL
4. User downloads file
5. File is auto-deleted after 7 days

### 4.3 Storage Location

```
Forge Storage:
  {orgKey}/exports/{YYYY-MM-DDTHH:MM:SS}/{exportId}.csv
  
Example:
  acme-corp/exports/2025-12-22T14:30:00/exp-jkl012.csv
```

### 4.4 Retention & Purge

- **TTL**: 7 days (constant `EXPORT_TTL_SECONDS = 604800`)
- **Auto-Purge**: Atlassian Forge infrastructure
- **Reason**: Temporary download staging; no long-term storage

---

## 5. Configuration

### 5.1 Definition

App configuration and drift detection rules (read from manifest and code).

### 5.2 Storage

- **Location**: Memory only (not persisted)
- **Source**: `manifest.yml` + hardcoded defaults
- **Lifetime**: Session duration only
- **Reset**: Each app invocation reloads configuration

### 5.3 User Modifiable?

- ❌ No configuration UI
- ❌ No user settings
- ✅ Only workspace admin can change via manifest
- ✅ Changes require app reinstall

---

## 6. Sensitive Data Classification

### 6.1 NO Personal Data Stored

FirstTry does **NOT** store:
- ❌ User email addresses
- ❌ User ID or display names
- ❌ User profile information
- ❌ Jira login credentials or API tokens
- ❌ Issue comments or descriptions
- ❌ Attachment content
- ❌ Git commits or code (if integrated in future)

### 6.2 Data Sensitivity Levels

| Data Type | Sensitivity | Why |
|-----------|------------|-----|
| **Issue Snapshots** | LOW (Operational Metadata) | Keys, statuses, dates only; no content |
| **Event Ledger** | LOW (Audit Trail) | Change log; no user attribution |
| **Drift Reports** | LOW (Analysis Output) | Summary; no sensitive details |
| **Export Data** | LOW (Summary) | User-requested output; no secrets |

---

## 7. Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ JIRA CLOUD WORKSPACE                                        │
│                                                             │
│  [Issue Database] ──GET /rest/api/3/issues──> FirstTry App │
│                                                     │        │
│  [Webhooks] ─issue.created/updated events─> FirstTry App   │
│                                                     │        │
└─────────────────────────────────────────────────────┼───────┘
                                                      │
                                    ┌─────────────────┼─────────────────┐
                                    │                 │                 │
                                    ▼                 ▼                 ▼
                        ┌──────────────────┐ ┌────────────────┐ ┌─────────────┐
                        │  Snapshots       │ │  Event Ledger  │ │ Reports     │
                        │  {orgKey}/snap.. │ │  {orgKey}/evt..│ │ {orgKey}/.. │
                        │  90 days TTL     │ │  90 days TTL   │ │ 30 days TTL │
                        └──────────────────┘ └────────────────┘ └─────────────┘
                                    │                 │                 │
                                    └─────────────────┼─────────────────┘
                                                      │
                                              ┌───────┴────────┐
                                              │                │
                                    ┌─────────▼────────┐ ┌──────▼──────────┐
                                    │   User Interface │ │ Export Staging  │
                                    │  (Read Snapshots)│ │ {orgKey}/exp... │
                                    │                  │ │ 7 days TTL      │
                                    └──────────────────┘ └─────────────────┘
```

---

## 8. Cross-Workspace Data Isolation

### 8.1 Tenant Scoping

All data is scoped to `{orgKey}`:

```
Example:
  Workspace "ACME Corp" (orgKey=acme-corp)
    └─ snapshots/... (only ACME data)
    └─ events/...    (only ACME events)
    └─ reports/...   (only ACME reports)

  Workspace "TechCorp" (orgKey=tech-corp)
    └─ snapshots/... (NEVER mixed with ACME)
    └─ events/...
    └─ reports/...
```

### 8.2 No Cross-Workspace Lookups

- ✅ Structurally impossible (different {orgKey} = different namespace)
- ✅ Storage key builder prevents accidental cross-tenant access
- ✅ Verified by tests: `shk_keying_proof.test.ts`

---

## 9. Compliance Mappings

### 9.1 GDPR Data Inventory

| GDPR Category | FirstTry Mapping | Justification |
|---------------|------------------|----------------|
| Personal Data | NOT STORED | No email, user ID, or identifiable info |
| Processing Activity | Issue snapshot collection | Legitimate interest (drift detection) |
| Data Subject Rights | See [DATA_RETENTION.md](DATA_RETENTION.md) | Governed by Atlassian Forge terms |
| DPA Status | NOT offered by FirstTry | Rely on Atlassian's Forge DPA terms |

### 9.2 CCPA Data Inventory

| CCPA Category | FirstTry Status |
|---------------|-----------------|
| Data Collection | Only Jira metadata collected |
| Consumer Rights | No personal data = no rights apply |
| Opt-Out | N/A (no personal data) |

---

## Appendix A: Data Minimization Evidence

Each data type is justified:

| Data | Why Necessary | Why Minimal |
|------|---------------|-----------|
| **Issue Keys** | Identify issues | Keys only; no content |
| **Status** | Detect status drift | Current status; no history |
| **Custom Fields** | Detect custom field changes | Field values only; no user context |
| **Event Timestamp** | Timeline for audit | Timestamp only; no user ID |
| **Event Type** | Understand change | Event type only; no details |

---

**Document Version**: 1.0  
**Next Review**: Q2 2026 or when data collection changes
