# Data Handling Policy
## FirstTry Governance Dashboard for Atlassian Jira

**Version**: 1.0 | **Last Updated**: 2026-01-30

---

## Executive Summary

The FirstTry Governance Dashboard operates under a **strict read-only, no-store model**:

- **Scope**: Dashboard reads live Jira project governance data (permissions, workflows, automation rules)
- **Data Storage**: Zero data stored off-platform; all snapshots stored in Jira Storage API (on-platform)
- **Data Transit**: HTTPS only; no third-party logging or analytics
- **Compliance**: SOC 2 Type II ready (audit-in-progress); ISO 27001 scoped

---

## 1. Data Collection

### 1.1 What Data Is Collected?

When the dashboard renders, it calls `api.asUser().requestJira()` to fetch **live** Jira data:

| Data Type | Source | Purpose | Retention |
|-----------|--------|---------|-----------|
| Project names + IDs | Jira Cloud API | Dashboard display | Snapshot only |
| Permission schemes | Jira Cloud API | Audit evidence | Snapshot only |
| Workflow definitions | Jira Cloud API | Governance review | Snapshot only |
| Automation rule summaries | Jira Cloud API | Audit scope | Snapshot only |
| Timestamps (created, modified) | Jira Cloud API | Audit trail | Snapshot only |

**Critical**: No sensitive data (issue counts, user emails, API keys, secrets) is captured or stored.

### 1.2 How Is Data Collected?

The dashboard uses **user-context reads only**:

```typescript
// From gadget-resolver.ts line 509
api.asUser().requestJira(async (client: any) => {
  // Fetch governance data as the logged-in user
  // User's Jira permissions determine visible projects
})
```

**Important**: 
- Every dashboard render triggers a **live API call** to Jira
- No cached snapshots except those explicitly exported by the user
- User's Jira permissions are respected (no escalation)

---

## 2. Data Storage

### 2.1 Where Is Data Stored?

**On-Platform Only**: All stored snapshots are saved to Jira Storage API:

```
Jira Cloud
├─ Storage API
│  └─ Governance Dashboard Snapshots
│     ├─ Snapshot ID: <guid>-<timestamp>
│     ├─ Content: Project configs, permission schemes (no PII)
│     └─ Owner: Jira instance only
```

### 2.2 What Happens If I Export?

When you export a governance snapshot:

1. **Export Format**: JSON file containing:
   - Project names + permission role summaries (no user emails)
   - Workflow definition names (no transitions)
   - Automation rule counts (no rule logic)
   - Timestamps (export time, snapshot age)

2. **Export Destination**: User's browser download folder (your machine)

3. **No Cloud Upload**: Exports are NOT sent to FirstTry servers or any third party

4. **No Analytics**: Export events are NOT logged or tracked

---

## 3. Data Retention

| Data | Location | Retention | Deletion |
|------|----------|-----------|----------|
| Live dashboard reads | RAM (in-app only) | <1 minute (render only) | Auto (render cycle) |
| Exported snapshots | Jira Storage API | Until manually deleted by user | User-initiated |
| Support logs (if enabled) | Jira instance only | 30 days | Auto-rotation |

**No data is retained after a snapshot is deleted by the user.**

---

## 4. Third-Party Access

### 4.1 APIs Called

**Jira Only**:
- `requestJira()` → Jira Cloud REST API (read-only)
- Scope: `read:jira-work` (minimal read)

**No External Calls**:
- ❌ No analytics (Segment, Mixpanel, etc.)
- ❌ No telemetry (Datadog, New Relic, etc.)
- ❌ No CDN logging (CloudFlare, etc.)
- ❌ No third-party webhooks

### 4.2 OAuth Scope

The app requests ONLY:

```yaml
permissions:
  scopes:
    - storage:app          # Store snapshots in Jira
    - read:jira-work       # Read Jira governance data (minimal)
```

**No write permissions requested**. Cannot create, modify, or delete issues, projects, or workflows.

---

## 5. Security & Compliance

### 5.1 Encryption

- **In Transit**: HTTPS TLS 1.2+ (Jira Cloud enforced)
- **At Rest**: AES-256 (Jira Storage API)
- **User Files**: Customer's responsibility (download to their device)

### 5.2 Access Control

- **User Context**: Dashboard respects Jira user permissions (no escalation)
- **Snapshot Ownership**: Only the creating user can view/export their snapshots
- **No Admin Bypass**: Jira instance admins cannot override snapshot privacy

### 5.3 Compliance Targets

- **SOC 2 Type II**: In-progress audit (FY 2026)
- **ISO 27001**: Scoped for governance apps (certified by 2026 Q2)
- **GDPR**: Full compliance (right-to-deletion implemented)

---

## 6. Support & Questions

For data handling questions, contact:

**Email**: [contact@firsttry.run](mailto:contact@firsttry.run)  
**Response Time**: Within 24 business hours  
**Privacy Contact**: [contact@firsttry.run](mailto:contact@firsttry.run)

---

## 7. Updates to This Policy

Changes to this policy require:

1. Version bump (e.g., 1.0 → 1.1)
2. Updated timestamp
3. 7-day notice to all users (via app banner)
4. Email notification to enterprise customers

**Last Reviewed**: 2026-01-30  
**Reviewed By**: First Try Solutions Security  
**Next Review**: 2026-07-30
