# Scopes & Permissions

## Overview

This document explicitly lists all Atlassian Forge API scopes and permissions required by FirstTry - Audit Evidence Snapshot for Jira, the rationale for each, and what FirstTry **does NOT** access.

**Status**: Enterprise-Grade | **Last Updated**: 2026-01-12 | **Review**: [docs/SECURITY_SUMMARY.md](SECURITY_SUMMARY.md), [docs/PRIVACY.md](PRIVACY.md)

---

## Declared Scopes (Manifest)

FirstTry - Audit Evidence Snapshot for Jira declares exactly **two (2) scopes** in `atlassian/forge-app/manifest.yml`:

### 1. `storage:app` — Forge App Storage (Read/Write)

**Purpose**: Store governance evidence (snapshots, metrics, event ledgers, policy freeze-locks) within Atlassian Forge's isolated, tenant-specific storage.

**What it enables**:
- Creating and updating governance evidence documents (immutable ledgers, timestamped snapshots)
- Storing metric computations (M1-M5 governance metrics)
- Persisting policy configuration freeze-locks (Phase 6 pinning)
- Maintaining per-tenant audit trails

**Restrictions** (enforced by Forge platform):
- ✅ Data is **isolated per tenant** (workspace/organization level)
- ✅ Data is **never shared cross-tenant** (Forge API enforces this)
- ✅ Data is **readable only by this app** within the tenant
- ✅ FirstTry cannot access other apps' storage

**Access pattern**: Async writes during scheduled triggers (Phase 5 scheduler, Phase 6 weekly snapshots, Phase 7 daily dispatchers).

---

### 2. `read:jira-work` — Jira Issue & Configuration Read-Only Access

**Purpose**: Query Jira issue metadata, field definitions, automation rule configurations, and project settings to detect configuration drift.

**What it reads**:
- Issue field definitions (`GET /rest/api/3/field`)
- Project settings and configurations (`GET /rest/api/3/projects/{projectKey}`)
- Issue type schemes (`GET /rest/api/3/issuetypescheme`)
- Automation rules (if available via API; fallback to manual exports)
- Permission schemes, issue link types, resolutions, and statuses

**What it does NOT read**:
- ❌ Issue content (summaries, descriptions, comments)
- ❌ User profile data (emails, names, activity)
- ❌ Attachment content
- ❌ Workflow transitions or execution history
- ❌ Custom field values (only schema definitions)

**Restrictions** (enforced by FirstTry code):
- ✅ **Read-only**: FirstTry never calls POST, PUT, DELETE, or PATCH on Jira APIs
- ✅ **No impersonation**: FirstTry always calls `asApp()`, never `asUser()`
- ✅ **No external egress**: FirstTry never forwards Jira data outside Atlassian ecosystem

**Access pattern**: Synchronous queries during metric computation (Phase 2-8) and scheduled snapshots (Phase 5-6).

---

## What FirstTry NEVER Accesses

### Forbidden Scopes (Not Requested)

| Scope | Reason |
|-------|--------|
| `write:jira-work` | FirstTry is read-only; never modifies Jira |
| `manage:jira-configuration` | No config changes; drift is detected, not enforced |
| `read:jira-user` | No user tracking; personal data never collected |
| `read:app-install` | Not required for governance |
| External API calls | Manifest lacks external fetch permission; Forge blocks outbound |

### No Third-Party Integrations

- ❌ No webhooks to external services
- ❌ No data exports to cloud storage (S3, GCS, Azure)
- ❌ No integration with analytics platforms (Segment, Mixpanel)
- ❌ No credential forwarding to third-party audit systems

---

## Scope Validation

### How to Verify

1. **Check manifest**:
   ```bash
   cat atlassian/forge-app/manifest.yml | grep -A 5 "scopes:"
   ```
   Expected output:
   ```yaml
   scopes:
     - storage:app
     - read:jira-work
   ```

2. **Verify no mutations**:
   ```bash
   # Search for POST/PUT/DELETE in Forge app code
   grep -r "POST\|PUT\|DELETE\|asUser\|mutation" atlassian/forge-app/src --include="*.ts" --include="*.js"
   ```
   Expected: Only comments in type definitions; no actual mutation calls.

3. **Test read-only enforcement**:
   ```bash
   # Unit tests verify no write operations
   npm test -- --testNamePattern="read-only|readonly|no mutation"
   ```

---

## Marketplace Reviewer Checklist

- ✅ Scopes explicitly listed
- ✅ Rationale provided for each scope
- ✅ No excessive or unused scopes declared
- ✅ No implied scopes (e.g., "admin" inferred from read:jira-work)
- ✅ Restrictive scope model (read-only; no impersonation; storage-only for data persistence)
- ✅ Tested at build time (CI verifies no mutations, no external egress)

---

## References

- **Manifest**: [atlassian/forge-app/manifest.yml](../atlassian/forge-app/manifest.yml#L63-L65)
- **Security Model**: [docs/SECURITY.md](SECURITY.md)
- **Privacy**: [docs/PRIVACY.md](PRIVACY.md)
- **Accessible Data Inventory**: [docs/DATA_INVENTORY.md](DATA_INVENTORY.md)
- **Forge Permission Model** (external): Atlassian Forge documentation

---

## Questions?

For marketplace reviewers, compliance auditors, or enterprise procurement:

1. **"Can FirstTry modify my Jira data?"** → No. Scope `read:jira-work` is read-only; code is tested for zero mutations.
2. **"Where is my data stored?"** → In Atlassian Forge app storage (isolated per tenant), governed by Forge retention policies and your workspace settings.
3. **"Does FirstTry share my data with third parties?"** → No. FirstTry has zero external egress; no integration with external services.
4. **"What happens if I uninstall?"** → Data stored in Forge storage may be subject to Atlassian retention policies (usually 30 days); FirstTry has no independent control.

See [docs/SUPPORT_POLICY.md](SUPPORT_POLICY.md) for enterprise escalation.
