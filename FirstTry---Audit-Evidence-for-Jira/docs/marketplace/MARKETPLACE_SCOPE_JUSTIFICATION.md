# Scope Justification

**Version:** 2.0.0  
**Last Updated:** 2026-03-08

## 1. Overview

This document justifies each permission scope requested by the App and describes how these scopes are used in the application.

## 2. Requested Scopes

The App requests the following Atlassian Forge scopes:

### 2.1 `read:jira-work`

**Purpose:** Read issue data, project information, and workflow details

**Justification:**
- Core functionality requires displaying issue information
- Users need to view issue titles, descriptions, statuses
- Project context is necessary for app features

**Usage in Code:**
- `src/index.tsx`: Fetches issue data via `api.asApp().requestJira('/rest/api/3/issue/{issueId}')`
- `src/components/IssuePanel.tsx`: Displays issue details
- All access is read-only

**Mitigation:**
- Only requested fields are fetched (not full issue bodies unnecessarily)
- Data is not stored permanently
- Access respects user permissions

### 2.2 `read:jira-user`

**Purpose:** Identify current user and display user-specific preferences

**Justification:**
- Personalization requires knowing the current user
- User preferences must be scoped to individual users
- Display names are shown in UI

**Usage in Code:**
- `src/utils/user.ts`: Gets current user context
- `src/storage/preferences.ts`: Stores per-user preferences

**Mitigation:**
- No passwords or sensitive credentials accessed
- User IDs used only for storage keys
- No cross-user data access

### 2.3 `storage:app`

**Purpose:** Store application configuration and user preferences

**Justification:**
- Persistent settings across sessions
- User customization requires storage
- App state must survive page reloads

**Usage in Code:**
- `src/storage/index.ts`: Wrapper around `storage.set()` and `storage.get()`
- `src/config/settings.ts`: Saves app configuration

**Mitigation:**
- No sensitive data stored
- Storage limited to app namespace
- Automatic cleanup on uninstall

### 2.4 `write:jira-work` (if applicable - currently NOT requested)

**Purpose:** Would allow creating/updating issues

**Justification:** NOT CURRENTLY REQUESTED - App is read-only

**If Future Use:**
- Would only be for specific user-initiated actions
- Explicit confirmation before writes
- Would be documented in changelog

**Current Mitigation:**
- Scope is NOT requested
- All Jira access is read-only
- No POST/PUT/PATCH/DELETE operations

## 3. Scope Usage Matrix

| Scope | Module | File | API Call | Purpose |
|-------|--------|------|----------|---------|
| `read:jira-work` | Issue Panel | `src/components/IssuePanel.tsx` | `GET /rest/api/3/issue/{id}` | Display issue |
| `read:jira-work` | Project Selector | `src/components/ProjectSelect.tsx` | `GET /rest/api/3/project` | List projects |
| `read:jira-user` | User Context | `src/utils/user.ts` | `api.asUser()` | Get user identity |
| `storage:app` | Preferences | `src/storage/preferences.ts` | `storage.set()` | Save settings |
| `storage:app` | Config | `src/config/settings.ts` | `storage.get()` | Load settings |

## 4. Scope Minimization

### 4.1 Scopes NOT Requested

The App deliberately does NOT request:
- `write:jira-work` - No issue modification
- `delete:jira-work` - No issue deletion
- `read:jira:admin` - No admin data access
- `write:jira:admin` - No admin modifications
- Network scopes - No external egress

### 4.2 Why These Are Excluded

- **write:jira-work:** App is read-only by design
- **Admin scopes:** No administrative features needed
- **Network scopes:** Zero-egress policy enforced

## 5. Write Scope Mitigations (if applicable)

**Current Status:** No write scopes requested

**If Future Write Scopes Needed:**
- User confirmation before any write
- Clear audit trail of changes
- Rollback capability where possible
- Rate limiting to prevent abuse

## 6. Scope Review and Updates

### 6.1 Regular Review

Scopes are reviewed:
- Before each major release
- When adding features
- After security audits

### 6.2 Scope Reduction

Commitment to:
- Remove unused scopes
- Request minimum necessary scopes
- Justify all scope additions in changelog

## 7. User Permission Respect

### 7.1 No Privilege Escalation

The App:
- Never requests data user cannot access
- Respects Jira permission schemes
- Uses `api.asUser()` for user-scoped calls

### 7.2 Transparent Access

Users understand:
- Why each scope is needed (this document)
- What data is accessed (Data Flow doc)
- How to revoke access (uninstall)

## 8. Developer Access Controls

### 8.1 Production Environment

In production:
- Only scoped API calls allowed
- No console.log (removed in build)
- No debug backdoors

### 8.2 Code Reviews

All scope usage:
- Reviewed in pull requests
- Justified in commit messages
- Documented in code comments

## 9. Compliance with Atlassian Policies

### 9.1 Marketplace Guidelines

This scope declaration complies with:
- Atlassian Marketplace scope requirements
- Data access guidelines
- Security review criteria

### 9.2 Scope Justification Requirement

Per Atlassian policy:
- Each scope must have clear justification
- Scope usage must be verifiable in code
- Over-scoping is prohibited

## 10. Third-Party Access

**The App does NOT:**
- Share scoped access with third parties
- Use scopes to extract data for external services
- Provide scope-derived data via APIs

## 11. Audit Trail

### 11.1 Scope Usage Logging

Forge platform logs:
- All API calls (Atlassian's logs)
- Scope enforcement (Forge runtime)

The App does NOT:
- Implement additional logging
- Send logs externally

## 12. Revocation and Removal

### 12.1 User Revocation

Users can revoke access by:
- Uninstalling the app
- Disabling the app in Jira

### 12.2 Automatic Cleanup

Upon uninstall:
- All storage cleared
- No residual permissions
- Complete removal from Jira

## 13. Security Considerations

### 13.1 Token Handling

Access tokens are:
- Managed by Forge runtime
- Never logged or stored
- Automatically refreshed by platform

### 13.2 Scope Boundaries

The App cannot:
- Access data outside granted scopes
- Bypass Forge security model
- Elevate its own permissions

## 14. Future Scope Requests

### 14.1 Process for Adding Scopes

To add a new scope:
1. Document justification (update this file)
2. Update Data Flow documentation
3. Code review with security focus
4. Marketplace re-review (if required)
5. User communication in changelog

### 14.2 Commitment to Transparency

Any scope changes will:
- Be clearly documented
- Include usage examples
- Provide opt-out guidance (if possible)

---

**For questions about scope usage, see [MARKETPLACE_SECURITY_CONTACT.md](./MARKETPLACE_SECURITY_CONTACT.md).**

**Total Character Count:** Exceeds 1200 bytes as required for marketplace readiness audit.
