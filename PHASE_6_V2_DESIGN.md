# PHASE 6 v2: SNAPSHOT EVIDENCE LEDGER DESIGN

**Version:** 1.0.0  
**Status:** Stage 1 Design Document  
**Date:** 2024-01-15  
**Audience:** Engineering Team, Architecture Review  

---

## 1. Executive Summary

Phase 6 v2 implements an **immutable, deterministic evidence ledger** that automatically captures Jira configuration state on a daily and weekly schedule. This provides:

- **Audit Trail:** Complete historical record of what configuration was deployed when
- **Determinism:** Identical Jira state always produces identical snapshot hash (SHA256)
- **Tenant Isolation:** Multi-tenant safe; all data prefixed by `tenant_id`
- **Read-Only:** No write endpoints; pure observation of system state
- **Compliance:** Explicit missing-data disclosure for gaps in coverage

**Core Principle:** Same Jira state → Same snapshot payload → Same canonical hash

---

## 2. Architecture Overview

### 2.1 System Components

```
┌─────────────────────────────────────────────────────────┐
│ Forge Scheduled Triggers (Daily + Weekly)              │
│ - phase6:daily   (runs daily at configured time)       │
│ - phase6:weekly  (runs weekly at configured time)      │
└──────────────┬──────────────────────────────────────────┘
               │
               ├─→ SnapshotCapturer (queries Jira API)
               │   ├─ Projects inventory
               │   ├─ Field metadata
               │   ├─ Workflow inventory (daily)
               │   ├─ Workflow structures (weekly only)
               │   ├─ Automation rules
               │   └─ Missing-data tracking
               │
               ├─→ Canonicalization (deterministic JSON)
               │   ├─ Sort keys alphabetically
               │   ├─ Minify (no whitespace)
               │   └─ SHA256 hash
               │
               ├─→ SnapshotStorage (immutable storage)
               │   ├─ snapshot_runs (execution records)
               │   ├─ snapshots (immutable payloads)
               │   └─ retention_policy (auto-cleanup rules)
               │
               └─→ RetentionEnforcer (FIFO auto-delete)
                   ├─ Max age: 90 days (configurable)
                   ├─ Max records: 90 daily + 52 weekly
                   └─ Deletion strategy: FIFO
```

### 2.2 Data Model

Three primary entities stored in Forge requestStorage:

#### SnapshotRun (Execution Record)
One record per scheduled run, regardless of success/failure:
- Identification: `run_id` (UUID), `tenant_id`, `cloud_id`
- Scheduling: `scheduled_for`, `snapshot_type` (daily|weekly)
- Timing: `started_at`, `finished_at`, `duration_ms`
- Outcome: `status` (success|partial|failed), `error_code`, `error_detail`
- Metrics: `api_calls_made`, `rate_limit_hits_count`
- Output: `produced_snapshot_id`, `produced_canonical_hash`

#### Snapshot (Immutable Evidence)
Never modified after creation; append-only ledger:
- Identification: `snapshot_id` (UUID), `tenant_id`, `cloud_id`
- Metadata: `captured_at`, `snapshot_type`, `schema_version`
- Canonicalization: `canonical_hash` (SHA256), `hash_algorithm`
- Provenance: `input_provenance` (endpoints, scopes, filters)
- Coverage: `missing_data` (explicit disclosure of gaps)
- Payload: JSON object with datasets (structure depends on type)

#### RetentionPolicy (Cleanup Rules)
Tenant-specific deletion configuration:
- `max_days`: Delete snapshots older than N days (default 90)
- `max_records_daily`: Keep max N daily snapshots (default 90)
- `max_records_weekly`: Keep max N weekly snapshots (default 52)
- `deletion_strategy`: FIFO (first-in-first-out)
- `uninstall_behavior`: retain_for_days (v2 uses this)

### 2.3 Storage Layout (Forge requestStorage)

All keys prefixed by `tenant_id` for isolation:

```
phase6:snapshot_run:{tenant_id}:{run_id}
→ SnapshotRun JSON (TTL: 90 days)

phase6:snapshot:{tenant_id}:{snapshot_id}
→ Snapshot JSON (TTL: 90 days)

phase6:retention_policy:{tenant_id}
→ RetentionPolicy JSON (no TTL)

phase6:snapshot_index:{tenant_id}:{type}:{page}
→ Array of snapshot_ids (for pagination)
```

---

## 3. Determinism and Canonicalization

### 3.1 Canonical JSON Rules

Essential for idempotency: **Same Jira state → Same hash**

1. **Keys sorted alphabetically** (canonical object order)
2. **Minified** (no whitespace)
3. **Strings JSON-escaped** (UTF-8 encoded)
4. **Numbers/booleans/nulls as-is**
5. **Arrays order-preserving** (significant for state detection)

Example:
```javascript
// Input (unsorted)
{ z: 1, a: 2, m: 3 }

// Canonical form
{"a":2,"m":3,"z":1}

// SHA256
abc123def456...
```

### 3.2 Hash Algorithm

- **Algorithm:** SHA256 (64-character hex string)
- **Input:** Canonical JSON representation of entire snapshot payload
- **Stored in:** `snapshot.canonical_hash` and `snapshot_run.produced_canonical_hash`
- **Verification:** `verifyCanonicalHash(payload, expectedHash)` returns true iff identical

### 3.3 Idempotency Guarantee

If Jira state hasn't changed:
- Running snapshot capture multiple times → identical hash
- Hash mismatch definitively indicates state changed
- This enables audit-trail verification

---

## 4. Snapshot Types

### 4.1 Daily Snapshot (Lightweight)

Runs daily at configured time (default 02:00 UTC). Captures essential inventory:

**Datasets:**
- `project_inventory`: Project IDs + names
- `field_metadata`: Field IDs + basic metadata
- `workflow_inventory`: Workflow names/IDs (no definitions)
- `automation_inventory`: Automation IDs + names (no definitions)

**Typical payload size:** 50-200 KB
**API calls:** 4-5
**Timeout:** 2 minutes

### 4.2 Weekly Snapshot (Comprehensive)

Runs weekly (default Monday 02:00 UTC). Includes all daily data PLUS full definitions:

**Additional datasets:**
- `workflow_structures`: Full workflow definitions with transitions
- `field_requirements`: Field requirement flags
- `automation_definitions`: Full automation rule definitions

**Typical payload size:** 200 KB - 5 MB
**API calls:** 6-8
**Timeout:** 5 minutes

---

## 5. Error Handling and Missing Data

### 5.1 Error Categorization

Each `SnapshotRun` includes `error_code`:
- `NONE`: Fully successful
- `RATE_LIMIT`: Hit Jira rate limits (retry backoff)
- `PERMISSION_REVOKED`: No longer have needed scope
- `API_ERROR`: Transient API failure
- `TIMEOUT`: Execution exceeded time limit
- `PARTIAL_CAPTURE`: Some datasets available, others not
- `UNKNOWN`: Unclassified error

### 5.2 Missing Data Disclosure

Each `Snapshot` includes `missing_data[]` array. Each item:

```javascript
{
  dataset_name: "field_metadata",
  coverage_status: "MISSING" | "PARTIAL" | "AVAILABLE",
  reason_code: "permission_denied" | "api_unavailable" | "not_configured" | "rate_limited" | "unknown",
  reason_detail: "Human-readable explanation",
  retry_count: 0,  // How many times we retried
  last_attempt_at: "2024-01-15T10:05:30Z"  // ISO 8601
}
```

**Principle:** Better to explicitly disclose what's missing than silently omit.

### 5.3 Retry Strategy

On transient failures (rate limit, timeout):
1. Record as `partial` or `failed`
2. Backoff schedule:
   - First retry: 30 minutes
   - Second retry: 2 hours
   - Third retry: 24 hours
   - Then give up

---

## 6. Idempotency and Scheduling

### 6.1 Idempotency Key

Prevents duplicate snapshots within same time window:

```
Format: {tenant_id}:{snapshot_type}:{window_start_iso}

Daily example:   tenant1:daily:2024-01-15
Weekly example:  tenant1:weekly:2024-01-08  (Monday of that week)
```

**Check before capture:** If run with same idempotency key already exists → skip.

### 6.2 Daily Scheduling

- **Frequency:** Every 24 hours (via Forge `scheduledTrigger`)
- **Window:** Single run per calendar day
- **Idempotent:** Multiple invocations same day → single snapshot
- **Isolation:** One tenant's run doesn't affect another

### 6.3 Weekly Scheduling

- **Frequency:** Every 7 days (via Forge `scheduledTrigger`)
- **Window:** Single run per calendar week (Monday-Sunday)
- **Idempotent:** Multiple invocations same week → single snapshot
- **Isolation:** Same tenant isolation as daily

---

## 7. Retention and Auto-Cleanup

### 7.1 Retention Policy

Default configuration (configurable per tenant):
- **Max age:** 90 days
- **Max daily snapshots:** 90 records
- **Max weekly snapshots:** 52 records
- **Strategy:** FIFO (delete oldest first when limit exceeded)

### 7.2 Enforcement Process

After successful capture, `RetentionEnforcer` runs:

1. **Phase 1:** Delete by age (older than `max_days`)
2. **Phase 2:** Delete by FIFO if count exceeds `max_records`

All deletions logged with reason.

### 7.3 Uninstall Behavior (v2)

**Decision:** Retention-only for Phase 6 v2

On uninstall:
- All snapshots marked for deletion after `uninstall_retain_days` (default 90 days)
- Auto-cleanup respects this deadline
- Admin can't manually delete (retention-only enforcement)

---

## 8. READ-ONLY Jira Access

### 8.1 Whitelisted Endpoints

Only read operations on these endpoints:
- `/rest/api/3/projects` (get project list)
- `/rest/api/3/issuetypes` (get issue type inventory)
- `/rest/api/3/statuses` (get status inventory)
- `/rest/api/3/fields` (get field metadata)
- `/rest/api/3/issues/search` (query issues if needed)
- `/rest/api/3/workflows` (get workflow definitions)
- `/rest/api/3/automation/rules` (get automation rules)

### 8.2 No Write Operations

Snapshots never call:
- POST (create)
- PUT (update)
- DELETE (remove)
- PATCH (modify)

**Verification:** Unit tests explicitly check that no write endpoints are invoked.

### 8.3 Scope Requirements

App requires these scopes (read-only):
- `read:jira-work` (projects, issues, fields, workflows)
- `read:jira-user` (user metadata if needed)

---

## 9. Tenant Isolation

### 9.1 Isolation Guarantees

**All storage keys include `tenant_id`:**

```
phase6:snapshot_run:{tenant_id}:{run_id}
phase6:snapshot:{tenant_id}:{snapshot_id}
phase6:retention_policy:{tenant_id}
phase6:snapshot_index:{tenant_id}:{type}:{page}
```

**Cross-tenant access is impossible:**
- `SnapshotRunStorage` constructor requires `tenant_id`
- All methods validate tenant match before accessing storage
- Query operations filtered by tenant_id prefix

### 9.2 Concurrent Execution

Multiple tenants can run snapshots simultaneously:
- Independent storage keys → no locks needed
- Idempotency keys per tenant → no cross-tenant conflicts
- Retention enforcement per tenant → independent cleanup

---

## 10. Algorithm: Deterministic Canonicalization

### 10.1 Pseudocode

```
function canonicalJSON(obj):
  if obj is null:
    return "null"
  if obj is boolean:
    return string(obj)  // "true" or "false"
  if obj is number:
    return string(obj)  // "42" or "3.14"
  if obj is string:
    return JSON.stringify(obj)  // Escape special chars
  if obj is array:
    items = [canonicalJSON(item) for item in obj]
    return "[" + join(items, ",") + "]"
  if obj is object:
    keys = sort(object.keys(obj))  // Alphabetical
    pairs = []
    for key in keys:
      value = canonicalJSON(obj[key])
      pairs.append(JSON.stringify(key) + ":" + value)
    return "{" + join(pairs, ",") + "}"
```

### 10.2 Example Walkthrough

Input snapshot payload:
```javascript
{
  z: 1,
  a: { name: "Alpha", id: 2 },
  m: [3, 4]
}
```

Canonical form (step by step):
1. Sort keys: a, m, z
2. Process `a`: `{"id":2,"name":"Alpha"}` (keys sorted)
3. Process `m`: `[3,4]`
4. Process `z`: `1`
5. Result: `{"a":{"id":2,"name":"Alpha"},"m":[3,4],"z":1}`

SHA256 of that string → snapshot hash.

---

## 11. Implementation Stages

### Stage 1: Core Evidence Ledger (This PR)
✅ Complete after this PR:
- Snapshot model + storage
- Canonicalization + determinism
- Daily + weekly schedulers
- Idempotency + retention

**Not included:**
- Admin UI for viewing snapshots
- Export functionality
- Scale testing (100K+ snapshots)

### Stage 2: User-Facing Features (Next PR)
Will include:
- Admin page to browse snapshots
- JSON/PDF export
- Retention policy UI
- Evidence audit trail viewer

---

## 12. Testing Strategy

### Unit Tests (Stage 1)
- **snapshot_model.test.ts:** Data structure validation
- **canonicalization.test.ts:** Determinism verification (critical)
- **snapshot_storage.test.ts:** Tenant isolation, TTL, FIFO
- **snapshot_capture.test.ts:** Jira API calls (read-only verified)
- **snapshot_scheduler.test.ts:** Idempotency, scheduling
- **determinism.test.ts:** Large payloads, edge cases

### Integration Tests (Stage 2)
- End-to-end: Capture → Store → Query → Export
- Retention enforcement across 100+ snapshots
- No-write Jira access verification

### Performance Tests (Future)
- 1000+ snapshots in storage
- Pagination with large result sets
- Canonicalization of 5+ MB payloads

---

## 13. Key Files (Stage 1)

| File | Purpose |
|------|---------|
| `src/phase6/constants.ts` | Enums, storage key helpers, defaults |
| `src/phase6/snapshot_model.ts` | TypeScript interfaces (Run, Snapshot, Policy) |
| `src/phase6/snapshot_storage.ts` | CRUD + retention enforcement |
| `src/phase6/snapshot_capture.ts` | Jira API querying + payload building |
| `src/phase6/canonicalization.ts` | Deterministic JSON + SHA256 |
| `src/scheduled/snapshot_daily.ts` | Daily scheduled handler |
| `src/scheduled/snapshot_weekly.ts` | Weekly scheduled handler |
| `tests/phase6/*.test.ts` | 5 test files (model, storage, capture, scheduler, determinism) |

---

## 14. Decision Log

**Decision 1: Scheduler Integration**  
✅ Chosen: Separate Phase-6 scheduled functions  
Rationale: Isolation, reusability, independent error handling

**Decision 2: Admin UI Placement**  
✅ Chosen: New dedicated Phase-6 admin page  
Rationale: Cleaner separation, audit trail clarity

**Decision 3: Uninstall Behavior**  
✅ Chosen: Retention-only for v2  
Rationale: Pragmatic for v2; explicit purge can come later

---

## 15. Success Criteria (Stage 1)

- ✅ All 5 test files pass (100+ test cases)
- ✅ Tenant isolation verified
- ✅ Determinism verified (identical state → identical hash)
- ✅ No write endpoints called
- ✅ Idempotency working (same window → single snapshot)
- ✅ Retention enforcement operational
- ✅ Storage keys follow phase6: prefix pattern
- ✅ TTL set correctly (90 days)
- ✅ Missing data disclosure populated

---

## Appendix A: Glossary

- **Canonicalization:** Process of converting object to deterministic form (alphabetical keys, minified)
- **Determinism:** Property that same input always produces same output
- **Idempotency:** Running operation multiple times = single result (no duplicates)
- **Tenant Isolation:** Each tenant's data separated (no cross-tenant access)
- **Evidence Ledger:** Immutable, append-only audit trail of system state
- **FIFO:** First-in-first-out deletion (oldest records deleted first)
- **Scope:** Jira API permission level (e.g., read:jira-work)

---

**Document Version:** 1.0.0  
**Last Updated:** 2024-01-15  
**Next Review:** After Stage 1 completion
