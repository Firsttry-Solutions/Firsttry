# FirstTry Access Control & Authorization Model

**Version**: 1.0  
**Last Updated**: 2025-12-22

---

## Executive Summary

FirstTry operates under the **Jira workspace admin installation model**:

- ✅ No per-user login or authentication
- ✅ No granular permission configuration
- ✅ App reads all workspace issues (no scoping by project/user)
- ✅ Workspace admin can restrict via native Jira scopes (Atlassian controls)
- ✅ All users in workspace can view reports (read-only)

---

## 1. Installation & Consent Model

### 1.1 Installation Flow

1. **Jira Workspace Admin** navigates to Atlassian Marketplace
2. **Admin** clicks "Install" on FirstTry app
3. **Admin** reviews and approves Forge manifest scopes:
   - `read:jira-issue:read` — Read Jira issues
   - `write:forge:storage` — Write to app storage
4. **App is installed** and automatically available to all workspace users
5. **No further configuration required** (zero-setup principle)

### 1.2 Who Can Install?

- ✅ Jira workspace admin only
- ❌ Regular users cannot install

### 1.3 Who Can Use?

- ✅ All users in the workspace (after admin installs)
- ✅ No per-user enablement needed
- ✅ No authentication required (Jira session sufficient)

---

## 2. Jira API Access Model

### 2.1 Access Method: asApp (Server-to-Server)

FirstTry reads Jira data **as the app**, not as individual users:

```typescript
// src/api/jira-adapter.ts (conceptual)

// ✅ CORRECT: FirstTry reads as app
const issues = await asApp(jira).issues.search({
  query: 'project in (PROJ1, PROJ2)'
});

// ❌ NOT DONE: FirstTry never impersonates users
// FirstTry never calls asUser(jira.currentUser())
```

**Implication**:
- ✅ No per-user activity tracking
- ✅ No user login audit trail
- ✅ No "who viewed which issue" logging
- ✅ Single app identity for all reads

### 1.2 Scopes Requested

From `manifest.yml`:

```yaml
scopes:
  - 'read:jira-issue:read'      # Read issues
  - 'write:forge:storage'       # Write app storage
```

**What This Allows**:
- ✅ Read issue data (keys, statuses, fields)
- ✅ Write to Forge storage (for snapshots, reports)

**What This Prevents**:
- ❌ Create or modify issues
- ❌ Delete issues
- ❌ Access user profiles
- ❌ Access workspace settings
- ❌ Perform admin actions

---

## 3. Data Access Permissions

### 3.1 Who Sees What

| User Role | Snapshots | Events | Reports | Can Export? |
|-----------|-----------|--------|---------|-------------|
| **Workspace Admin** | ✅ All | ✅ All | ✅ All | ✅ Yes |
| **Regular User** | ✅ All | ✅ All | ✅ All | ✅ Yes |
| **Workspace Guest** | ✅ All | ✅ All | ✅ All | ✅ Yes |
| **Other Workspace** | ❌ None | ❌ None | ❌ None | ❌ No |

**Note**: FirstTry has no fine-grained permissions. All workspace users see the same drift data.

### 3.2 Project-Level Filtering

FirstTry can optionally filter by project (if configured):

```yaml
# manifest.yml (hypothetical future feature)
config:
  projects: ['PROJ1', 'PROJ2']  # Only monitor these projects
```

**Current Status**: Not implemented yet. Monitoring scope is workspace-wide.

---

## 4. Tenant Isolation

### 4.1 Multi-Workspace Isolation

Each Jira workspace is completely isolated:

```
Workspace A (orgKey=workspace-a)
  ├─ snapshots: {workspace-a}/snapshots/...
  ├─ events: {workspace-a}/events/...
  └─ reports: {workspace-a}/reports/...

Workspace B (orgKey=workspace-b)
  ├─ snapshots: {workspace-b}/snapshots/...
  ├─ events: {workspace-b}/events/...
  └─ reports: {workspace-b}/reports/...

Structural Guarantee: Keys are different → No cross-workspace access possible
```

**Verification**: See `tests/shakedown/scenarios/shk_keying_proof.test.ts`

### 4.2 No Cross-Workspace Leakage

- ✅ Storage keys are workspace-scoped ({orgKey} prefix)
- ✅ API calls are workspace-specific (Jira Cloud API enforces this)
- ✅ No shared state between workspaces

---

## 5. Write Operations & Data Modification

### 5.1 What FirstTry Writes

FirstTry writes ONLY to its own storage (non-issue-modifying):

```
✅ ALLOWED:
  - Store snapshots in Forge storage
  - Store event ledger in Forge storage
  - Generate and store reports

❌ NOT ALLOWED / NOT CAPABLE:
  - Modify Jira issues
  - Create Jira issues
  - Delete Jira issues
  - Change issue workflows
  - Modify Jira settings
```

### 5.2 Read-Only Guarantee

- ✅ Scope `read:jira-issue:read` is read-only
- ✅ No write scope to issues API
- ✅ Jira issue data is never modified by FirstTry
- ✅ FirstTry is a safe, passive observer

---

## 6. Authentication & Session Management

### 6.1 How Users Authenticate

Users authenticate with **Jira Cloud directly** (Atlassian SSO):

1. User logs into Jira Cloud (email + password OR SSO)
2. User's session is managed by Atlassian
3. User navigates to FirstTry app (embedded in Jira)
4. FirstTry verifies user's Jira session (done by Forge platform)
5. User sees FirstTry UI

**FirstTry Never**:
- ❌ Collects passwords
- ❌ Manages user sessions
- ❌ Implements authentication

### 6.2 Session Tokens

- ✅ Forge platform handles all token management
- ✅ FirstTry receives authenticated request context
- ✅ No token storage in FirstTry
- ✅ No token refresh logic in FirstTry

---

## 7. Audit & Logging

### 7.1 What Is Logged

FirstTry logs:
- ✅ App invocation (timestamp, workspace)
- ✅ API call counts (aggregated, no per-user breakdown)
- ✅ Report generation (timestamp, report ID)
- ⚠️ Errors (sanitized, no PII)

### 7.2 What Is NOT Logged

FirstTry does NOT log:
- ❌ User identities (no email, user ID in logs)
- ❌ Jira issue content (no descriptions, comments)
- ❌ User actions or "who clicked what"
- ❌ API tokens or credentials

### 7.3 Log Redaction

All logs are automatically redacted:
- ✅ Email addresses → [REDACTED]
- ✅ API keys → [REDACTED]
- ✅ Tenant IDs → hashed

**Verification**: See `tests/p1_logging_safety.test.ts`

---

## 8. Failure Modes & Permission Errors

### 8.1 Insufficient Permissions

**Scenario**: Workspace admin installs FirstTry but scope approval fails

**FirstTry Behavior**:
1. Attempt to read issues fails (403 Forbidden)
2. FirstTry does NOT retry with different credentials
3. FirstTry does NOT fall back to weaker access
4. FirstTry returns ERROR to user: "Insufficient permissions"
5. User cannot proceed until admin approves scopes

**Principle**: Fail-closed, never fall back to degraded access.

### 8.2 Workspace Deletion

**Scenario**: Jira workspace is deleted by Atlassian

**FirstTry Behavior**:
- ✅ Storage becomes inaccessible
- ✅ App cannot read issues (workspace no longer exists)
- ✅ No data leakage to other workspaces

---

## 9. Future: Fine-Grained Permissions (Planned)

### 9.1 Not Yet Implemented

FirstTry currently has no fine-grained permissions:
- ❌ Cannot restrict by project
- ❌ Cannot restrict by issue type
- ❌ Cannot restrict by user role

### 9.2 Design Consideration

If fine-grained permissions are added:
- Scopes will remain minimal (read-only)
- Permission logic will be in app config (not Jira RBAC)
- Will NOT modify Jira's permission model
- Will NOT create custom roles

---

## 10. Compliance & Authorization Mapping

### 10.1 GDPR Considerations

| Aspect | FirstTry Model |
|--------|---|
| **User Consent** | Workspace admin installs (proxy consent for workspace users) |
| **Data Access Limitations** | All workspace users have same access (no fine-grained control) |
| **Right to Erasure** | TTL on all stored data (90 days max); manual delete available |
| **Audit Trail** | Per-workspace, not per-user |

### 10.2 SOC 2 Considerations

| Control | Evidence |
|---------|----------|
| **Access Control** | App-level only; no per-user config required |
| **Authentication** | Jira Cloud handles; FirstTry validates Forge context |
| **Least Privilege** | Read-only scopes; no write to Jira data |
| **Audit Trail** | Logs redacted; no per-user tracking |
| **Segregation** | Workspace isolation enforced by storage keys |

---

## 11. Risk Assessment

### 11.1 Potential Risks

| Risk | Mitigation |
|------|-----------|
| **Overly Broad Access** | Scopes limited to read-only; no issue modification |
| **Cross-Workspace Leakage** | Storage keys prevent structural cross-access |
| **User Impersonation** | asApp model (no asUser); no per-user auth |
| **Credential Exposure** | No credentials stored; Forge platform manages |
| **Unintended Data Export** | Users can export (expected); exports auto-delete (7 days) |

### 11.2 Residual Risks

- ⚠️ **No Project-Level Filtering**: FirstTry monitors all projects (workspace-wide). If finer scoping is needed, see [needs_scope_expansion.md](needs_scope_expansion.md).

---

## Appendix A: Scope Justification

Each Jira API scope is justified:

| Scope | Reason | Alternative |
|-------|--------|-------------|
| `read:jira-issue:read` | Need to read issues for drift detection | Could use webhooks only (loses baseline comparison) |
| `write:forge:storage` | Need to persist snapshots for next comparison | Could use memory only (app restarts lose state) |

---

## Appendix B: Zero Configuration Principle

FirstTry has **zero user-facing access configuration**:

- ❌ No "who can view reports" settings
- ❌ No "which projects to monitor" UI
- ❌ No "rate limiting" knobs
- ❌ No "data retention" sliders

**Why**: Reduces surface area for misconfiguration. All users in workspace get same access by design.

---

**Document Version**: 1.0  
**Next Review**: Q2 2026 or when access model changes
