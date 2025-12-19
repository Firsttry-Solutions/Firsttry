# PHASE 1.1 Test Plan: Runtime Verification & Debug Proof

**Version:** 0.1.0  
**Date:** 2025-12-19  
**Phase:** 1.1

---

## 1. Overview

PHASE 1.1 test plan covers:

1. **Unit Tests** - Storage debug snapshot function behavior
2. **Security Tests** - Access control and redaction
3. **E2E Tests** - Runtime verification script
4. **Integration Tests** - Admin UI + debug endpoint + storage coherence

All tests are **deterministic** and **no synthetic data** in runtime proof (real HTTP calls only).

---

## 2. Unit Tests

### 2.1 Test File: `tests/test_storage_debug_snapshot.ts` (optional)

**Purpose:** Validate `getStorageProofSnapshot()` function logic

**Tests:**

| # | Name | Setup | Action | Expected | Type |
|---|------|-------|--------|----------|------|
| 1 | Returns correct shape | Mock storage | Call snapshot() | Result has org_key, repo_key, status, message, total_ingested_today, recent_event_ids, shards_touched_today, idempotency_hits_count | Unit |
| 2 | Handles no data gracefully | Empty storage | Call snapshot() | status: "incomplete", message explains no ingestion yet | Unit |
| 3 | Sums shard counters correctly | Mock 3 shards with counts [50, 75, 100] | Call snapshot() | total_ingested_today: 225 | Unit |
| 4 | Returns last 5 event IDs in order | Mock storage with 10 events | Call snapshot() | recent_event_ids has 5 most recent, newest first | Unit |
| 5 | Lists shard keys without values | Mock storage with shard_0, shard_1 | Call snapshot() | shards_touched_today: ["shard_0", "shard_1"], no values included | Unit |
| 6 | Never includes raw payload | Mock event with payload field | Call snapshot() | Result has no "payload" or "body" field | Unit |

---

## 3. Security Tests

### 3.1 Test File: `tests/test_storage_debug_access.ts`

**Purpose:** Verify admin-only access and proper error handling

**Tests:**

| # | Name | Setup | Action | Expected | Type |
|---|------|-------|--------|----------|------|
| 1 | Admin can call snapshot | Mock admin context | Call getStorageProofSnapshot() | Returns 200 with snapshot data | Security |
| 2 | Non-admin cannot call snapshot | Mock non-admin context | Call getStorageProofSnapshot() | Returns 403 or access denied | Security |
| 3 | Invalid debug token rejected | Send wrong token header | Call debug endpoint | Returns 401 Unauthorized | Security |
| 4 | Missing debug token rejected | No token header | Call debug endpoint | Returns 401 Unauthorized | Security |
| 5 | Access attempt logged | Admin calls snapshot | Check logs | Log entry with admin name, timestamp, no token | Security |
| 6 | Multiple access attempts tracked | Call snapshot 5 times | Check logs | 5 log entries (for audit trail) | Security |

---

### 3.2 Test File: `tests/test_storage_debug_redaction.ts`

**Purpose:** Ensure no secrets or raw payloads in debug output

**Tests:**

| # | Name | Setup | Action | Expected | Type |
|---|------|-------|--------|----------|------|
| 1 | No raw event payload in snapshot | Ingest event with arbitrary fields | Call snapshot() | Response has NO "payload" or "body" field | Redaction |
| 2 | No tokens in response | Ingest event with token headers | Call snapshot() | Response has NO token-like fields | Redaction |
| 3 | No secrets in response | Ingest event with secrets | Call snapshot() | Response has NO "secrets" or "credential" field | Redaction |
| 4 | Event ID safe to show | Ingest event, get ID | Call snapshot() | event_id appears in recent_event_ids (OK) | Redaction |
| 5 | Shard key names safe to show | Ingest to shard_0, shard_1 | Call snapshot() | shards_touched_today includes shard names (OK) | Redaction |
| 6 | Status message no leak | Error during ingestion | Call snapshot() | error_detail message describes issue, not internals | Redaction |
| 7 | Incomplete state clear | Before any ingestion | Call snapshot() | status: "incomplete", message is clear | Redaction |
| 8 | No keyspace dump | Multiple ingestions | Call snapshot() | Returns summary only, not full key listing | Redaction |

---

## 4. Integration Tests (Admin Page / Debug Endpoint)

### 4.1 Test: Admin Page Renders Snapshot

**Setup:**
- Deploy app to development environment
- Ingest 1 event via webtrigger

**Action:**
- Load admin page in browser (or via curl) with admin context
- Verify page displays storage proof

**Expected:**
- Page renders without errors
- Shows org_key, repo_key, total_ingested_today count
- Shows last event ID(s)
- Shows shard keys
- No raw payloads visible

**Type:** Integration

### 4.2 Test: Snapshot Persists After Ingest

**Setup:**
- Deploy app
- No prior ingestion

**Action:**
1. Call snapshot() → status: "incomplete"
2. Ingest 1 event
3. Call snapshot() again

**Expected:**
- After ingest, status: "success"
- total_ingested_today: 1
- recent_event_ids: [the event ID]

**Type:** Integration

---

## 5. E2E Runtime Verification Script

### 5.1 Script: `scripts/verify_runtime_ingestion.sh`

**Prerequisites:**
- FORGE_EMAIL environment variable set
- FORGE_API_TOKEN environment variable set
- FIRSTRY_INGEST_TOKEN environment variable set
- curl available
- Forge CLI v12+ installed
- App deployed to development environment

**Steps & Verification:**

| Step # | Command | Expected Output | Redaction |
|--------|---------|-----------------|-----------|
| 1 | `forge --version` | Version 12.X.X | None |
| 2 | `forge install list` | Shows firsttry app in Jira, development environment | Remove API token from URLs |
| 3 | Construct webtrigger URL | URL constructed from forge install output | Redact any query tokens |
| 4 | Send event 1 via curl | HTTP 200, `{ status: "accepted", event_id: "..." }` | Redact token header |
| 5 | Send event 2 (duplicate) via curl | HTTP 200, `{ status: "duplicate", event_id: "..." }` | Redact token header |
| 6 | Fetch admin snapshot | HTTP 200, JSON with event IDs and shard keys | Redact auth header |
| 7 | Verify event ID in snapshot | Event ID from step 4 appears in snapshot | None (ID is safe) |
| 8 | Verify shard key in snapshot | Shard key appears (e.g., "shard_0") | None (shard key is safe) |
| 9 | Exit code | 0 if all pass, 1 if any fail | None |

**Expected Behavior:**
- Script is deterministic (same input → same output)
- No hardcoded tokens (must come from environment)
- Idempotency verified (step 5 shows "duplicate")
- Storage proof verified (event ID in snapshot)
- All failures reported with clear error message

**Documentation:** See `scripts/verify_runtime_ingestion.md` for copy-paste commands and expected outputs.

---

## 6. Test Commands

### 6.1 Run All Tests

```bash
cd /workspaces/Firstry/atlassian/forge-app

# Unit + Security tests
npm test

# Or individually:
npm run test:debug:access
npm run test:debug:redaction
npm run test:debug:snapshot

# E2E runtime script (requires live deployment)
bash scripts/verify_runtime_ingestion.sh
```

### 6.2 Deploy & Verify

```bash
cd /workspaces/Firstry/atlassian/forge-app

# Deploy to development environment
forge deploy --environment development

# Check installation
forge install list

# Run runtime verification (all-in-one)
bash scripts/verify_runtime_ingestion.sh
```

---

## 7. Test Evidence Capture

All test outputs must be captured in:

**File:** `audit_artifacts/atlassian_dual_layer/phase_1_1_evidence.md`

**Outputs to capture:**

1. `npm test` output (all test names + pass/fail)
2. `forge --version` (exact CLI version)
3. `forge install list` (app installation proof, redacted)
4. `forge deploy --environment development` (deployment success)
5. `curl` commands for event ingestion (redacted tokens)
6. `curl` response for first event (status: "accepted", event_id)
7. `curl` response for duplicate event (status: "duplicate", same event_id)
8. `curl` response for admin snapshot (event IDs, shard keys visible)
9. Verification that event ID from step 6 appears in step 8
10. Final script exit code (should be 0)

**Redaction rules:**
- Replace actual tokens with `<REDACTED>`
- Keep app URLs visible; mask only query tokens
- Keep event IDs visible (non-sensitive)
- Keep shard keys visible (non-sensitive)
- Never expose `FIRSTRY_INGEST_TOKEN` or `FIRSTRY_DEBUG_VIEW_TOKEN`

---

## 8. Success Criteria

Phase 1.1 test plan is DONE when:

- [ ] All unit tests pass (if tests exist)
- [ ] All security tests pass (access control + redaction)
- [ ] All integration tests pass (admin page displays snapshot)
- [ ] Runtime verification script passes end-to-end (exit code 0)
- [ ] Idempotency verified in script output (duplicate event detected)
- [ ] Storage proof verified (event ID in snapshot)
- [ ] All test outputs captured in evidence file
- [ ] No secrets leaked in evidence file
- [ ] No Phase 2 features tested (deferred to Phase 2+)

---

## 9. Test Ownership & Execution

| Test Type | Owner | Environment | Notes |
|-----------|-------|-------------|-------|
| Unit tests | Copilot | Local | No deployment required |
| Security tests | Copilot | Local | Mock context; no live Jira |
| Integration tests | Copilot | Development | Requires app deployed |
| E2E script | Copilot | Development | Real HTTP calls to webtrigger |

---

**Next document:** `audit_artifacts/atlassian_dual_layer/phase_1_1_evidence.md` (skeleton created; populated during implementation)
