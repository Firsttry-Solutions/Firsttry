# Phase 4 Jira API Scope Requirements

**Document:** PHASE 4 Scope Declaration  
**Date:** 2025-12-19  
**Status:** READY FOR MANIFEST UPDATE

---

## Required Scopes (MUST DECLARE IN manifest.yml)

### Scope 1: read:jira-work

**Purpose:** Read projects, issue types, statuses, fields, and issues  
**Used by Phase 4 for:**
- `GET /rest/api/3/project` → Projects metadata
- `GET /rest/api/3/issuetype` → Issue types metadata
- `GET /rest/api/3/status` → Statuses metadata
- `GET /rest/api/3/fields` → Fields metadata (schema only)
- `GET /rest/api/3/search` → Issue events (timestamps only)

**Failure Scenario:**
```json
{
  "coverage": "NOT_PERMITTED_BY_SCOPE",
  "errorMessage": "HTTP 403: read:jira-work scope required for projects"
}
```

---

### Scope 2: automation:read

**Purpose:** Read automation rules metadata  
**Used by Phase 4 for:**
- `GET /rest/api/3/automations` → Automation rules (id, name, enabled, lastModified)

**Failure Scenario:**
```json
{
  "coverage": "NOT_PERMITTED_BY_SCOPE",
  "errorMessage": "HTTP 403: automation:read scope required for automation rules"
}
```

---

## manifest.yml Changes (PENDING)

The manifest.yml needs to declare these scopes:

```yaml
---
# Atlassian Forge App Manifest - FirstTry Governance Dual Layer
# PHASE 4: Read-only Jira data ingestion with immutable evidence storage

app:
  id: ari:cloud:ecosystem::app/59d86182-c1c6-49ea-b2fb-6ee5be52b7fc
  description: FirstTry Governance - Atlassian Dual-Layer Integration
  runtime:
    name: nodejs20.x

# NEW: API Scopes required for PHASE 4
scopes:
  - read:jira-work      # Read projects, issues, fields
  - automation:read     # Read automation rules

modules:
  # ... (existing modules remain unchanged)
  
# ... rest of manifest unchanged
```

---

## Scope Availability Checklist

Before deploying Phase 4, verify:

- [ ] Jira Cloud instance allows `read:jira-work` scope (standard in all Jira Cloud)
- [ ] Jira Cloud instance allows `automation:read` scope (available in most instances; may require Premium)
- [ ] Forge app is authorized to request these scopes
- [ ] No existing scopes conflict with Phase 4 scopes (none expected)

---

## Fallback Strategy (If Scope Unavailable)

If a scope is unavailable:

1. **Coverage flag** = `NOT_PERMITTED_BY_SCOPE`
2. **Error message** = Explicit HTTP 403 error (e.g., "automation:read scope required")
3. **Behavior** = Ingest what's possible; mark blocked datasets as NOT_PERMITTED_BY_SCOPE
4. **UI display** = Show permission error clearly to admin
5. **Remediation** = Admin must grant scope in Jira instance before Phase 4 can proceed

---

## Test Verification

All Phase 4 tests assume scopes are available:

```bash
npm test  # Runs with mock scopes (tests pass)
```

Real deployment will verify scopes are available before first ingestion.

---

## Phase 5+ Scope Requirements (Preview)

Phase 5 may require additional scopes:

- `read:audit-log` - For audit event ingestion (automation triggers, issue transitions)
- Additional read scopes for enhanced data fetching

These will be documented in Phase 5 evidence pack.

---

**Status:** Ready to update manifest.yml and deploy Phase 4
