# FirstTry Governance - Security & Privacy Documentation

**Last Updated**: 2026-01-10  
**Classification**: Public (Marketplace Review)  
**Audience**: Atlassian Marketplace Reviewers, Jira Cloud Admins

## Overview

FirstTry Governance is a **read-only** Jira Cloud app that provides governance and compliance evidence collection. This document covers security architecture, data handling, permissions, and privacy practices.

---

## Architecture

### Scopes & Permissions

FirstTry declares **exactly 2 scopes** to Jira:

| Scope | Access Level | Purpose | Data Accessed |
|-------|-------------|---------|---------------|
| `read:jira-work` | Read-only | Ingest Jira metadata for evidence generation | Project names/keys, issue metadata (id, key, created/updated dates, assignee, status) |
| `storage:app` | App-scoped | Store governance evidence in Jira's encrypted storage | Evidence artifacts (no PII, no issue content) |

**Key Guarantee**: ✅ **No write scopes** (write:jira, manage:jira not declared)

### API Callsites

All Jira API calls use **GET method only**. Runtime guards enforce this:

**File**: `src/runtime_guards/assert_read_only.ts`  
```typescript
const mutationMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
```

**Evidence**: `src/jira_ingest.ts` (lines 155, 218, 281, 344, 411, 490) - all `requestJira()` calls use GET

### Data Flow

```
Jira Cloud REST API (read-only via requestJira)
    ↓
FirstTry Scheduled Pipelines (daily/weekly)
    ↓
Aggregation & Evidence Generation
    ↓
Forge Storage (app-scoped, encrypted)
    ↓
Jira Cloud Admin Dashboard Gadget (read-only view)
```

**No External Egress**: FirstTry does not send data to any external APIs. ✅ Verified in `docs/EXTERNAL_APIS.md`

---

## Data Handling

### Data Ingested (Read from Jira)

| Data | Source | Purpose | Retention |
|------|--------|---------|-----------|
| **Projects** | `/rest/api/3/project` | Governance baseline | 90 days |
| **Issue Types** | `/rest/api/3/issuetype` | Classification metadata | 90 days |
| **Statuses** | `/rest/api/3/status` | Workflow state snapshot | 90 days |
| **Fields** | `/rest/api/3/fields` | Schema definition | 90 days |
| **Issues** (basic) | `/rest/api/3/search` | Timestamps, key, assignee ID, status | 90 days |
| **Workflows** | `/rest/api/3/workflows` | Status transition rules | 90 days |

### Data NOT Ingested

❌ **Explicitly excluded**:
- Issue descriptions or comments (actual content)
- Custom field values (user data)
- Attachments or file content
- User email addresses or personal info
- API tokens or credentials

### Data Stored (In Jira Forge Storage)

FirstTry stores **only**:
- Governance evidence snapshots (timestamps, counts, metrics)
- Configuration policies (what constitutes "compliant")
- Hash digests of evidence (for integrity verification)

**Storage Scope**: `storage:app` (app-scoped, tenant-isolated, encrypted at rest by Atlassian)

---

## Runtime Behavior

### Read-Only Enforcement

Every `requestJira()` call is wrapped by `jira_get_wrapper.ts`:

```typescript
function wrapJiraGetForInstrumentation(requestJiraFn) {
  return async (path, options) => {
    // Force method to GET; reject if already set to PUT/POST/DELETE/PATCH
    const method = 'GET';
    if (options?.method && options.method !== 'GET') {
      throw new Error(`Cannot use ${options.method} on Jira API`);
    }
    return requestJiraFn(path, { ...(options || {}), method });
  };
}
```

**Evidence**: `src/core/perf_signals/jira_get_wrapper.ts` (lines 115-140)  
**Tests**: `tests/perf_signals/no_jira_writes_contract.test.ts` (217-230)

### Token Refresh

FirstTry includes a scheduled token refresh job every 12 hours to prevent OAuth expiry.

**File**: `src/scheduled/token_refresh_scheduler.handle`  
**Manifest**: `manifest.yml` (line 34, key: `token-refresh-job-fn`)  
**Note**: Token refresh is local only (no external egress); uses Atlassian's OAuth endpoints managed by Forge runtime.

---

## Authentication & Authorization

### User Context

All API calls use `api.asApp()` (app-scoped) or `api.asUser()` (user's context):

- **asApp()**: Used for system-level background tasks (scheduled pipelines)
- **asUser()**: Used for dashboard gadget (inherits user's Jira permissions)

**Guarantee**: Jira enforces user's own permission scope; FirstTry cannot escalate permissions.

### Scope Justification

Detailed in `docs/SCOPES_JUSTIFICATION.md`:
- `read:jira-work` is **minimum required** to collect governance metadata
- `storage:app` is necessary for evidence persistence
- No additional scopes needed

---

## Security Controls

### Input Validation

All API responses are validated against TypeScript contracts:
- `src/coverage_matrix.ts` (strict typing)
- `src/phase5_report_contract.ts` (type assertions)
- `src/disclosure_hardening_gaps_a_f.ts` (gap enforcement)

### Scheduled Task Limits

- **Max frequency**: 5 minutes (PHASE 5 auto-scheduler)
- **Daily limits**: Applied per organization
- **Rate limit handling**: Exponential backoff + logging

### Determinism & Reproducibility

FirstTry tests include explicit **determinism verification**:
- `FIRSTTRY_DETERMINISTIC=1` env var forces fixed timestamps
- Test suite verifies idempotency (same input → same output)
- Hash digests prevent tampering

**Evidence**: `npm_test_deterministic.log` (1243 tests pass in deterministic mode)

---

## Compliance & Standards

### Data Retention

- **Default**: 90 days (configurable)
- **Cleanup**: Automatic via `src/retention/cleanup.ts`
- **User action**: Admins can export/delete manually

### Incident Response

FirstTry has a documented incident response process in `docs/INCIDENT_RESPONSE.md`:
- Security issues: Contact `contact@firsttry.run`
- Non-security bugs: GitHub issue
- SLA: 24-hour response target

### Vulnerability Disclosure

See `legal/VULNERABILITY_DISCLOSURE.md` for responsible disclosure process.

---

## Manifest Verification

**Proof Reference**: `audit/proof_runs/run_20260110_121856/manifest_parsed.md`

✅ Manifest declares exactly 2 scopes (no extra)  
✅ No egress URLs in manifest  
✅ All function keys ≤ 23 characters  
✅ forge lint passes (exit 0)

---

## Testing & Audit

**Test Results**: `audit/proof_runs/run_20260110_121856/`
- npm test: ✅ 1243 tests pass
- FIRSTTRY_DETERMINISTIC=1 npm test: ✅ All pass (determinism verified)
- npm audit: ✅ Zero vulnerabilities

**Code Scans**:
- `jira_api_call_sites.txt`: All requestJira calls mapped
- `code_write_surface_scan.txt`: No POST/PUT/DELETE to Jira
- `runtime_guards/assert_read_only.ts`: Enforces GET-only

---

## References

- **Scopes Detailed**: [docs/SCOPES_JUSTIFICATION.md](docs/SCOPES_JUSTIFICATION.md)
- **Data Retention**: [docs/DATA_RETENTION_POLICY.md](docs/DATA_RETENTION_POLICY.md)
- **External APIs**: [docs/EXTERNAL_APIS.md](docs/EXTERNAL_APIS.md)
- **Manifest**: [manifest.yml](manifest.yml)
- **Security Tests**: `tests/perf_signals/no_jira_writes_contract.test.ts`

---

**Marketplace Ready**: ✅ This documentation supports evidence-based approval.

