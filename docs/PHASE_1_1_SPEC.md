# PHASE 1.1 Specification: Runtime Verification & Debug Proof Surface

**Version:** 0.1.0  
**Date:** 2025-12-19  
**Phase:** 1.1 (Runtime Verification & Debug Proof only - NO new business logic)  
**Status:** In Implementation

---

## 1. Purpose

PHASE 1.1 adds **runtime proof and introspection** for PHASE 1 event ingestion. It enables:

1. **Admin-only debug view** showing what events have been ingested (in summary form)
2. **Runtime verification script** proving the endpoint works end-to-end
3. **Idempotency verification** showing duplicate event handling works
4. **Storage key proof** confirming data is written to Forge storage
5. **Security tests** ensuring debug access is locked down and no secrets leak

PHASE 1.1 is **NOT a user-facing feature**. It is purely for engineering validation and audit.

---

## 2. Non-Goals

- **No new business logic.** Debug is read-only, informational only.
- **No event aggregation.** Raw events remain unchanged.
- **No reporting or forecasting.** Debug shows only ingestion proof.
- **No scheduling or alerts.** Deferred to Phase 2+.
- **No dashboard gadget expansion** (but may update admin page).
- **No additional scopes or permissions** beyond admin access.

---

## 3. Storage Keys & Debug Snapshot

### 3.1 Storage Keys Used by PHASE 1

PHASE 1 ingestion writes these keys (see src/storage.ts and src/ingest.ts):

| Key Pattern | Purpose | Example |
|------------|---------|---------|
| `seen/{org_key}/{repo_key}/{event_id}` | Idempotency marker | `seen/myorg/myrepo/a1b2c3d4-e5f6-4789-a1b2-c3d4e5f6a1b2` |
| `raw/{org_key}/{yyyy-mm-dd}/{shard_id}` | Raw event array | `raw/myorg/2025-12-19/shard_0` |
| `rawshard_counter/{org_key}/{yyyy-mm-dd}/{shard_id}` | Event count per shard | `rawshard_counter/myorg/2025-12-19/shard_0` |

### 3.2 Debug Index Keys (NEW - PHASE 1.1 ONLY)

To support debug snapshot without listing all storage keys, PHASE 1.1 adds lightweight marker keys:

| Key Pattern | Purpose | Written By | Read By |
|------------|---------|-----------|---------|
| `debug:last_ingest:{org_key}:{repo_key}` | Last ingestion marker | `src/storage_debug.ts` during ingest | Storage proof snapshot |

**Content of `debug:last_ingest:{org_key}:{repo_key}`:**
```json
{
  "timestamp": "2025-12-19T09:47:00.000Z",
  "event_id": "a1b2c3d4-e5f6-4789-a1b2-c3d4e5f6a1b2",
  "shard_id": "shard_0",
  "write_status": "success" | "duplicate",
  "org_key": "myorg",
  "repo_key": "myrepo"
}
```

**Hard rule:** This key is **read-only for debugging** and **never used by business logic**. It is purely a Phase 1.1 plumbing artifact.

### 3.3 Storage Proof Snapshot Function

**File:** `atlassian/forge-app/src/storage_debug.ts` (new)

**Export:** `getStorageProofSnapshot(orgKey: string, repoKey: string): Promise<StorageProofSnapshot>`

**Return type:**
```typescript
interface StorageProofSnapshot {
  org_key: string;
  repo_key: string;
  status: "success" | "incomplete" | "error";
  message: string;
  total_ingested_today: number | "unknown";
  recent_event_ids: string[]; // Last 5 event IDs, newest first
  shards_touched_today: string[]; // List of shard keys (e.g., ["shard_0"])
  idempotency_hits_count: number | "unknown";
  last_ingest_timestamp: string | null;
  error_detail?: string;
}
```

**Behavior:**

1. **Read `debug:last_ingest:{org_key}:{repo_key}`** to get last event metadata
2. **Read `rawshard_counter/{org_key}/YYYY-MM-DD/{shard_id}`** keys for today (iterate known shards)
3. **Sum all shard counters** → `total_ingested_today`
4. **Read raw event arrays** for last 5 event_ids (do NOT return payloads)
5. **List all shard keys touched today** (key names only, no values)
6. Return summary (NO raw payloads, NO headers, NO secrets)

**Never include in snapshot:**
- Raw event body/payload
- Headers
- Tokens
- Repo secrets
- Full storage keyspace dumps

**If data unavailable:** Return `status: "incomplete"` with explanation.

---

## 4. Access Control & Security Gates

### 4.1 Admin Page Module

**Module:** `jira:settingsPage` (if exists) OR extend `adminPageHandler` in `src/index.ts`

**Route:** `/admin/storage-proof` (hypothetical; actual route depends on Forge)

**Access Control:** 

**Method 1 (Preferred): Context-based Admin Check**

If Forge provides `context.getAdmin()` or similar:

```typescript
const isAdmin = await context.getAdmin();
if (!isAdmin) {
  return { status: 403, body: { message: "Forbidden: admin access required" } };
}
```

**Method 2 (Fallback): Debug Token via Header**

If context-based check unavailable:

1. Require `FIRSTRY_DEBUG_VIEW_TOKEN` environment secret in Forge
2. Admin must pass `X-Debug-Token: {FIRSTRY_DEBUG_VIEW_TOKEN}` header
3. Compare tokens; reject if missing or invalid
4. **NEVER display token in UI or logs**

**Method 3 (Last Resort): Conservative Gate**

If neither method works:
- Return static "Debug access not supported in this environment"
- Write `needs_scope_expansion.md` explaining why

### 4.2 Security Properties

- **No query param tokens.** Token must be in secure HTTP-only header if used.
- **No token in response.** Debug snapshot output never includes auth credentials.
- **Rate limiting:** Not required for Phase 1.1 (debug endpoint, not user-facing).
- **Audit logging:** Log access attempts (admin name + timestamp) at info level (no sensitive data).
- **Redaction:** All snapshot outputs must pass redaction policy (test must enforce).

---

## 5. Runtime Verification Script

**File:** `atlassian/forge-app/scripts/verify_runtime_ingestion.sh`

**Prerequisites:**
- `FORGE_EMAIL` set in environment
- `FORGE_API_TOKEN` set in environment
- `FIRSTRY_INGEST_TOKEN` set in environment (the ingestion token, not debug token)
- `curl` available
- Forge CLI v12+ installed

**Steps:**

1. **Get Forge environment:** Query `forge install list` to get app URL
2. **Construct webtrigger URL:** Use app URL + `/webhook/ingest` route (or appropriate path for Forge v12)
3. **Send first event (new):**
   - POST JSON EventV1 to webtrigger
   - Include `X-FT-INGEST-TOKEN` header
   - Capture response; expect 200 with `{ status: "accepted", event_id: "..." }`
4. **Send second event (duplicate):**
   - Send exact same event again
   - Expect 200 with `{ status: "duplicate", event_id: "..." }`
5. **Fetch Storage Proof Snapshot:**
   - GET `/admin/storage-proof` (or appropriate endpoint)
   - Include debug token if required
   - Verify response includes event_id from step 3
   - Verify shard key appears
6. **Exit code:**
   - 0 if all checks pass
   - 1 if any check fails

**Output:** Deterministic; no secrets printed. Redact tokens in echoed commands.

**Documentation:** See `scripts/verify_runtime_ingestion.md` for copy-paste commands and expected outputs.

---

## 6. Tests

### 6.1 Security Tests (`tests/test_storage_debug_access.ts`)

**Scenario 1:** Admin can access snapshot
- Call `getStorageProofSnapshot()` with admin context
- Verify non-empty result

**Scenario 2:** Non-admin cannot access snapshot
- Mock non-admin context
- Call `getStorageProofSnapshot()`
- Verify 403 or access denied error

**Scenario 3:** Invalid debug token rejected
- Send incorrect token via header
- Verify 401 response

**Scenario 4:** Access logged**
- Verify admin access attempt logged
- Verify no token/secrets in log

### 6.2 Redaction Tests (`tests/test_storage_debug_redaction.ts`)

**Scenario 1:** Snapshot never includes raw payload
- Ingest event with arbitrary field values
- Call `getStorageProofSnapshot()`
- Verify response has NO field named `payload`, `headers`, `body`, etc.

**Scenario 2:** Snapshot never includes tokens
- Ingest event sent with token header
- Call `getStorageProofSnapshot()`
- Verify response has NO field matching token pattern

**Scenario 3:** Snapshot shows "incomplete" if no data
- Call `getStorageProofSnapshot()` before any ingestion
- Verify `status: "incomplete"` and appropriate message

**Scenario 4:** Event IDs are safe to show
- Ingest event with event_id
- Call `getStorageProofSnapshot()`
- Verify event_id appears in `recent_event_ids`
- Verify it is NOT wrapped with surrounding payload data

---

## 7. Integration Points

### 7.1 Forge Manifest Changes (Minimal)

**If using admin page route:**

```yaml
modules:
  jira:settingsPage:
    - key: storage-proof-page
      title: FirstTry Ingestion Proof
      resource: storage-proof-resource

resources:
  - key: storage-proof-resource
    path: src/storage-proof-ui
```

**If updating gadget:**

Minimal changes; reuse existing resource if possible.

### 7.2 Ingest Handler Changes (if any)

**If needed:** Update `src/ingest.ts` to write `debug:last_ingest:{org_key}:{repo_key}` marker after successful ingest.

**Change must be minimal:** Only add the marker write; no other logic changes.

### 7.3 Storage Layer Changes (if any)

**If needed:** Add `markLastIngest()` function to storage layer to write debug markers.

**Must not change:** Idempotency logic, shard rollover, or any Phase 1 business logic.

---

## 8. Evidence Artifacts

**File:** `audit_artifacts/atlassian_dual_layer/phase_1_1_evidence.md`

**Must contain:**

1. **forge --version** output
2. **forge install list** output (showing firsttry app, Jira, development environment)
3. **forge deploy** output (successful deployment)
4. **curl test output** (redacted; token hidden, real event sent)
5. **Idempotency proof** (second curl with duplicate event, response shows "duplicate")
6. **Storage proof snapshot output** (from admin page or debug endpoint)
7. **Event ID appears in snapshot** (proving write success)
8. **Test run output** (test_storage_debug_access.ts and test_storage_debug_redaction.ts)
9. **Script output** (verify_runtime_ingestion.sh run end-to-end)
10. **Explicit disclosure:** Any missing data or incomplete states

---

## 9. Redaction Policy

**For all captured outputs in evidence:**

1. **Tokens:** Replace `X-FT-INGEST-TOKEN: abc123def456` → `X-FT-INGEST-TOKEN: <REDACTED>`
2. **URLs:** Keep app URL visible; mask query param tokens
3. **Secrets:** Never log `FIRSTRY_INGEST_TOKEN` or `FIRSTRY_DEBUG_VIEW_TOKEN`
4. **Raw payloads:** If any event body appears in output, remove sensitive fields
5. **Event content:** Event IDs and shard keys are safe to log (non-sensitive identifiers)

---

## 10. Success Criteria (DONE MEANS DONE)

Phase 1.1 is DONE when:

- [ ] `docs/PHASE_1_1_SPEC.md` exists (this file) with all sections
- [ ] `docs/PHASE_1_1_TESTPLAN.md` exists with test + command list
- [ ] `atlassian/forge-app/src/storage_debug.ts` exists and exports `getStorageProofSnapshot()`
- [ ] Admin page / debug endpoint displays storage proof snapshot
- [ ] `atlassian/forge-app/scripts/verify_runtime_ingestion.sh` is executable and passes
- [ ] `atlassian/forge-app/scripts/verify_runtime_ingestion.md` documents commands and expected outputs
- [ ] Security tests pass: access control, redaction, incomplete state handling
- [ ] `forge deploy --environment development` succeeds
- [ ] `forge install list` shows app installed in development environment
- [ ] Runtime script sends real events and verifies storage
- [ ] Idempotency verified (duplicate event returns 200 "duplicate")
- [ ] Storage proof snapshot shows ingested event IDs and shard keys
- [ ] All test outputs and curl commands captured in `audit_artifacts/atlassian_dual_layer/phase_1_1_evidence.md`
- [ ] No Phase 2 features present (no aggregation, no reporting, no forecasts)
- [ ] No secrets or raw payloads leaked in debug output

---

## 11. Scope Boundaries

**In Scope:**
- Debug snapshot function (read-only, informational)
- Admin page or debug endpoint (protected, secured)
- Runtime verification script (curl-based, deterministic)
- Security tests (access control, redaction)
- Evidence documentation (captured outputs, proofs)

**Out of Scope:**
- Event aggregation or summarization (Phase 2+)
- Reporting or forecasting (Phase 2+)
- Scheduling or alerting (Phase 2+)
- Additional storage layers or caching (Phase 1 storage only)
- Changes to EventV1 schema (Phase 1 schema frozen)
- New modules or significant permission changes (minimal changes only)

---

**Next document:** `docs/PHASE_1_1_TESTPLAN.md`
