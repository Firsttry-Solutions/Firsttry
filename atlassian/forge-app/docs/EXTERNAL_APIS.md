# External APIs and Outbound Egress Documentation

**Document Status**: Complete  
**Last Updated**: 2025-12-22  
**Contract**: GAP-3 Egress Proof  

---

## Policy Statement

This Forge app has **ZERO outbound egress to external services**.

All network activity is:
1. **Atlassian Platform APIs**: Provided by @forge/api, sandboxed by Forge runtime
2. **Same-Origin Requests**: Browser UI calls back to same Forge function (not external)

---

## Exhaustive Network Call Inventory

### 1. Atlassian Jira REST API (via @forge/api)

**Purpose**: Read-only metadata ingestion from Jira Cloud instance where app is installed.

**Execution Context**: Server-side (Forge runtime)

**Authorization**: `api.asUser()` or `api.asApp()` (Forge platform provides identity)

**Data Sensitivity**: Jira metadata (projects, issues, statuses, fields) - governed by manifest scopes

**Calls**:

| File | Line | Method | URL Pattern | Data Accessed |
|------|------|--------|-------------|---------------|
| [src/jira_ingest.ts](../src/jira_ingest.ts#L275) | 275 | `api.asUser().requestJira()` | `/rest/api/3/project` | Project list (id, key, name) |
| [src/jira_ingest.ts](../src/jira_ingest.ts#L310) | 310 | `api.asUser().requestJira()` | `/rest/api/3/issuetype` | Issue type metadata |
| [src/jira_ingest.ts](../src/jira_ingest.ts#L340) | 340 | `api.asUser().requestJira()` | `/rest/api/3/status` | Status metadata |
| [src/jira_ingest.ts](../src/jira_ingest.ts#L370) | 370 | `api.asUser().requestJira()` | `/rest/api/3/field` | Field metadata (system + custom) |
| [src/jira_ingest.ts](../src/jira_ingest.ts#L420) | 420 | `api.asUser().requestJira()` | `/rest/api/3/search` | Issue events (created, updated timestamps) via JQL |
| [src/phase6/snapshot_capture.ts](../src/phase6/snapshot_capture.ts#L275) | 275 | `api.asUser().requestJira()` | `/rest/api/3/project` | Phase 6 snapshot evidence (projects) |

**Platform Guarantee**: Atlassian Forge runtime enforces:
- Scopes declared in manifest.yml
- Rate limiting
- Network isolation (cannot call arbitrary URLs)

**Manifest Scopes** (read-only):
- `read:jira-work`
- `read:jira-user`
- `storage:app`

### 2. Forge Storage API (via @forge/api)

**Purpose**: Persistent key-value storage for app data (events, ledgers, reports).

**Execution Context**: Server-side (Forge runtime)

**Authorization**: `api.asApp().requestStorage()` or `storage.*` (Forge platform provides isolation)

**Data Sensitivity**: App-generated data (ingested events, computed aggregations, generated reports)

**Calls**: Used in 30+ files for app state persistence. Examples:

| File | Line | Method | Data Stored |
|------|------|--------|-------------|
| [src/evidence_storage.ts](../src/evidence_storage.ts#L68) | 68 | `api.asApp().requestStorage()` | Evidence records |
| [src/storage.ts](../src/storage.ts#L24) | 24 | `api.asApp().requestStorage()` | Generic storage operations |
| [src/run_ledgers.ts](../src/run_ledgers.ts#L41) | 41 | `api.asApp().requestStorage()` | Pipeline run ledgers |
| [src/admin/admin_page_loader.ts](../src/admin/admin_page_loader.ts#L85) | 85 | `api.asApp().requestStorage()` | Phase 5 report data |

**Platform Guarantee**: Forge runtime enforces:
- Tenant isolation (storage scoped to cloudId)
- Quota limits (documented by Atlassian)
- Data encryption at rest (Atlassian platform responsibility)

### 3. Browser-Side Same-Origin Requests (Client-Side UI)

**Purpose**: Admin UI calling back to same Forge function for actions (generate report, export).

**Execution Context**: Browser (client-side)

**Authorization**: Atlassian session cookie (user must be Jira admin)

**Data Sensitivity**: Generated reports (already tenant-scoped by Forge)

**Calls**:

| File | Line | Method | URL Pattern | Purpose |
|------|------|--------|-------------|---------|
| [src/admin/phase5_admin_page.ts](../src/admin/phase5_admin_page.ts#L1137) | 1137 | `fetch(window.location.href + '?action=generateNow')` | Same origin | Trigger manual report generation |
| [src/admin/phase5_admin_page.ts](../src/admin/phase5_admin_page.ts#L1166) | 1166 | `fetch(window.location.href + '?export=json')` | Same origin | Export report as JSON |
| [src/admin/phase5_admin_page.ts](../src/admin/phase5_admin_page.ts#L1184) | 1184 | `fetch(window.location.href + '?export=pdf')` | Same origin | Export report as PDF |

**Network Characteristics**:
- **Target**: Same Forge function (`phase5-admin-page-fn`) that rendered the page
- **Method**: POST (generateNow), GET (exports)
- **Data**: No external egress; calls back into app's own handler
- **Security**: Atlassian Forge iframe sandbox; user authentication required

---

## Static Analysis Results

**Scan Date**: 2025-12-22  
**Files Scanned**: 111 TypeScript files in `src/**/*.ts`  
**External Egress Found**: **ZERO**

**Patterns Searched**:
- `fetch(` (non-same-origin)
- `axios.`
- `http.request`
- `https.request`
- `WebSocket`
- `dns.lookup`
- `got(`

**Findings**:
- All `fetch` calls are same-origin (browser UI → same Forge function)
- All other network activity uses `@forge/api` (platform-provided, scoped by manifest)
- No third-party HTTP client libraries imported (axios, got, node-fetch)
- No DNS lookups, WebSocket connections, or raw socket usage

**False Positives**:
- Comment in [src/phase9_5c/auto_notification.ts](../src/phase9_5c/auto_notification.ts#L251): `// In production: Store in notifications table, trigger real-time UI update via WebSocket`
  - This is a **comment only** describing future possibility, not actual code

---

## OAuth/External Service Integration

**Question**: Does this app use OAuth to integrate with external services (GitHub, Slack, etc.)?

**Answer**: **NO**

The app includes an OAuth handler ([src/auth/oauth_handler.ts](../src/auth/oauth_handler.ts)) but it is:
1. **Unused in production** (no manifest triggers reference it)
2. **Documented for future scope expansion only**
3. Contains comment about `POST to https://api.atlassian.com/oauth/token` but this is:
   - Atlassian's own OAuth endpoint (not external)
   - Not currently invoked in runtime code

**Current Runtime Behavior**: No OAuth flows active. No external service integrations.

---

## Compliance Attestations

### Marketplace Review

✅ **No undeclared external API calls**  
✅ **All network activity scoped by manifest.yml**  
✅ **No data exfiltration to third-party services**  
✅ **No analytics/telemetry beacons**  

### Enterprise Security Review

✅ **Zero external egress** (firewall rules: no outbound required)  
✅ **Data remains within Atlassian Cloud** (Forge Storage API only)  
✅ **No customer data transmitted to app developer's infrastructure**  

### Data Processing

- **Jira API calls**: Read-only, on-demand, governed by Forge scopes
- **Forge Storage**: Encrypted at rest by Atlassian, tenant-isolated
- **Browser fetch**: Same-origin only, no external URLs

---

## Enforcement

**Test**: [tests/credibility/gap3_egress_static_and_runtime.test.ts](../tests/credibility/gap3_egress_static_and_runtime.test.ts)

1. **Static Scan**: Grep `src/**/*.ts` for network API imports
2. **Runtime Trap**: Monkey-patch `fetch`, `http.request`, `https.request` during tests
3. **Failure Mode**: Test FAILS if any non-Forge, non-same-origin call detected

**CI**: `.github/workflows/credibility-gates.yml` runs this test on every commit.

---

## Residual Risks

### UNKNOWN: Forge Platform Behavior

**Risk**: Forge runtime may make outbound calls we cannot observe (e.g., platform telemetry, CDN fetches).

**Mitigation**: Out of app's control. Documented dependency on Atlassian platform trust.

**Disclosure**: See [PLATFORM_DEPENDENCIES.md](PLATFORM_DEPENDENCIES.md).

---

## Contact for Questions

**Security Concerns**: See [SECURITY.md](SECURITY.md) for reporting instructions.

**Compliance Questions**: See [SUPPORT.md](SUPPORT.md) for support channels.

---

## Version History

| Version | Date       | Changes |
|---------|------------|---------|
| 1.0     | 2025-12-22 | Initial egress audit (GAP-3 closure) |

