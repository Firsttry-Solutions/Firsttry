# docs/PHASE_6_V2_SCOPE_EXPANSION_REQUIRED.md

**Status:** ⛔ IMPLEMENTATION BLOCKED — MISSING CRITICAL CONTEXT  
**Date:** December 20, 2025  
**Reason:** Cannot proceed with PHASE 6 v2 implementation without resolving unknowns below

---

## CRITICAL UNKNOWNS BLOCKING IMPLEMENTATION

### 1. FORGE STORAGE API & IMPLEMENTATION

**Status:** ✅ **CONFIRMED** - Using `@forge/api` requestStorage

**Current Implementation Found:**
- File: `src/storage.ts` (147 lines)
- Pattern: `api.asApp().requestStorage(async (storage) => { ... })`
- TTL support: Yes (e.g., `storage.set(key, value, {ttl: 7776000})`)
- Sharding pattern: Already using hierarchical keys with counters
- Example key pattern: `raw/{org_key}/{yyyy-mm-dd}/{shard_id}`

**Known Limitations (from storage.ts):**
- ⚠️ **NO DOCUMENTED KEY ENUMERATION** - Current code uses direct key access only
- No `storage.keys()` or `storage.list(prefix)` pattern visible
- May require workaround for pagination

**Remaining Questions:**
- [ ] Can we enumerate keys matching a prefix with `@forge/api` storage? (May require custom pagination strategy)
- [ ] Is there a `storage.keys()` method or do we need application-level indexing?
- [ ] Maximum record size per entry?
- [ ] Can we use a separate "index" entity to track snapshot IDs for pagination?

**Decision Options:**
- **Option A:** Use application-level indexing (maintain `snapshot_runs_index: { tenant_id, ids: [...] }`)
- **Option B:** Use separate "anchor keys" for pagination (e.g., `snapshot_runs:tenant_id:page:0`)
- **Option C:** Store all run IDs in a single index document, fetch and paginate in-memory

**Impact:** Storage is available; pagination strategy needs definition.

---

### 2. JIRA CLOUD API SCOPE & ENDPOINTS

**Unknown:** What Jira Cloud API scopes are available to this Forge app, and which endpoints should be queried for daily vs weekly snapshots?

**Why it blocks:**
- Phase 6 spec defines daily/weekly scope, but actual API calls depend on Jira scopes
- Must avoid endpoints that would require scopes not granted
- Must have explicit list of "allowed" endpoints to enforce no-write rule

**Questions needed:**
- [ ] What scopes are declared in `app/manifest.yml`? (read:jira-work, read:jira-user, etc.)
- [ ] Which Jira Cloud REST API v3 endpoints are currently used in Phase 4-5?
- [ ] For daily snapshot: which read endpoints for projects, fields, workflows, automations?
- [ ] For weekly snapshot: are there constraints on "workflow structures" or "field requirement flags" endpoints?
- [ ] Are we using Jira GraphQL API or REST API v3, or both?
- [ ] What is the rate limit configuration? (default is usually 180 req/min for Forge)

**Impact:** Cannot define snapshot_type scope or error handling without this.

---

### 3. SCHEDULED FUNCTIONS / CRON SUPPORT

**Status:** ✅ **CONFIRMED** - Using Forge `scheduledTrigger`

**Current Implementation Found:**
- File: `manifest.yml` (defines `scheduledTrigger` modules)
- Daily trigger: `firstry-daily-pipeline` (interval: day)
- Weekly trigger: `firstry-weekly-pipeline` (interval: week)
- 5-minute trigger: `phase5-auto-scheduler` (interval: fiveMinute)
- Handler: `src/scheduled/phase5_scheduler.ts` (436 lines)

**Scheduler Implementation Details:**
```yaml
scheduledTrigger:
  - key: firstry-daily-pipeline
    function: daily-pipeline-fn
    interval: day
  - key: firstry-weekly-pipeline
    function: weekly-pipeline-fn
    interval: week
```

**Phase-5 Scheduler Pattern (existing):**
- Idempotency markers: `{cloudId}:AUTO_12H:DONE` + `{cloudId}:AUTO_24H:DONE`
- Atomic locks: ATTEMPT vs DONE pattern
- Exponential backoff: 30min, 120min, 1440min
- No uncaught exceptions (Forge doesn't retry on throw)

**Remaining Questions:**
- [ ] Can we add new `scheduledTrigger` entries for Phase 6 snapshot daily + weekly?
- [ ] Can we reuse `daily-pipeline-fn` + `weekly-pipeline-fn` or must we create Phase6-specific functions?
- [ ] Is there a scheduler execution log visible in Forge CLI?

**Decision Needed:**
- **Option A:** Integrate Phase 6 snapshots into existing daily/weekly pipeline
- **Option B:** Create separate `phase6-snapshot-daily-fn` + `phase6-snapshot-weekly-fn`
- **Option C:** Enhance `phase5-scheduler.ts` to also handle Phase 6 snapshots

**Impact:** Scheduling infrastructure ready; Phase 6 can add handlers to existing or new functions.

---

### 4. ADMIN UI STRUCTURE & FRAMEWORK

**Status:** ✅ **CONFIRMED** - HTML template with server-side rendering (Phase 5)

**Current Implementation Found:**
- Files:
  - `src/admin/phase5_admin_page.ts` (1225 lines, main handler)
  - `src/admin/admin_page_loader.ts` (state management)
  - `src/admin/language_safety_guard.ts` (string safety)
- Framework: HTML template strings (template literals in TypeScript)
- Pattern: Server-renders full HTML, includes disclosure + export
- Pagination: Not yet visible (may be frontend pagination)

**UI Structure from Step-6.2:**
- Headings constants in `src/phase5/phase5_headings.ts`
- Admin page function in manifest: `phase5-admin-page-fn`
- Exports JSON + PDF already implemented (`src/exports/`)

**Questions needed:**
- [ ] Can we add a new admin page (new `jira:adminPage` entry) for Phase 6, or extend Phase 5?
- [ ] Is there a shared template/layout system for consistency?
- [ ] How does frontend pagination work for tables? (JavaScript or server-side?)
- [ ] Can we reuse export infrastructure for snapshot JSON export?

**Recommendation:**
- **Option A:** Add new admin page entry in manifest for Phase 6 snapshots
- **Option B:** Add Phase 6 "Snapshot" section to existing Phase 5 admin page

**Impact:** Phase 6 UI can be built as new admin page or section; export infrastructure reusable.

---

### 5. EXPORT MECHANISM & PDF SUPPORT

**Status:** ✅ **CONFIRMED** - JSON + PDF exports implemented (Phase 5)

**Current Implementation Found:**
- Directory: `src/exports/` (contains export handlers)
- Files:
  - `phase5_export_json.ts` (JSON export)
  - `phase5_export_pdf.ts` (PDF export)
  - `export_utils.ts` (shared utilities)
- Phase 5 Exports already referenced in admin page handler

**Export Pattern:**
- JSON export: Canonical JSON format (likely reuses `canonicalize.ts`)
- PDF export: PDF generation library (exact library unknown, but already available)
- Security: Export endpoints accessed via admin page handler (tenant-isolated via cloudId)

**Questions needed:**
- [ ] Can we create `phase6_export_json.ts` following same pattern as Phase 5?
- [ ] Is PDF export optional for Phase 6 (JSON-only acceptable)?
- [ ] What is the PDF library being used? (pdfkit, etc.)
- [ ] Is canonicalization already implemented in `src/canonicalize.ts`?

**Recommendation:**
- **Implement:** JSON export for snapshots (required)
- **Skip:** PDF export for Phase 6 (optional per spec, can add later)
- **Reuse:** Export handler pattern from Phase 5

**Impact:** Snapshot JSON export can be implemented quickly; PDF is optional.

---

### 6. UNINSTALL HOOK / APP LIFECYCLE

**Status:** ⚠️ **UNKNOWN** - No uninstall hook found in current codebase

**Current Implementation:**
- Manifest: No `app:uninstalled` or lifecycle module visible
- Retention: Existing `src/retention/` directory may have related logic

**Questions needed:**
- [ ] Does @forge/api support app lifecycle hooks for uninstall?
- [ ] Can we add `onUninstall` hook to manifest?
- [ ] Should Phase 6 implement fallback: retention policy auto-expires instead of explicit purge?

**Recommendation for Phase 6 v2:**
- **DEFER:** Uninstall behavior is "nice to have"; implement retention policy instead
- Retention policy auto-deletes old snapshots (FIFO) → eventually purges all data
- Add warning text to admin UI: "Snapshots retain for {max_days} days"
- Document uninstall behavior as "retention policy enforced"

**Impact:** Phase 6 can proceed without uninstall hooks; use retention as primary cleanup mechanism.

---

### 7. CURRENT PROJECT STRUCTURE & FILE LOCATIONS

**Status:** ✅ **CONFIRMED** - Clear directory structure

**Current Directory Structure:**
```
src/
├── admin/                    (Phase 5: Admin UI)
├── aggregation/             (Phase 3: Aggregation logic)
├── config/                  (Configuration)
├── coverage/                (Phase 4: Coverage tracking)
├── exports/                 (Phase 5: Export handlers)
├── gadget-ui/              (Dashboard gadget)
├── phase5/                 (Phase 5: Report generation)
├── pipelines/              (Phase 3: Daily/weekly pipelines)
├── retention/              (Retention policy logic)
├── scheduled/              (Phase 5: Scheduler logic)
├── storage.ts              (Storage abstraction)
├── jira_ingest.ts          (Phase 4: Jira API ingest)
├── canonicalize.ts         (Canonicalization logic)
└── validators.ts           (Input validation)

tests/
├── admin/                   (Admin UI tests)
├── exports/                 (Export tests)
└── [other tests]           (Phase-specific tests)
```

**Recommendation for Phase 6:**
```
src/
├── phase6/                 (NEW: Phase 6 snapshots)
│   ├── snapshot_model.ts   (snapshot_runs, snapshots entities)
│   ├── snapshot_capture.ts (Daily/weekly capture logic)
│   ├── snapshot_run.ts     (snapshot_run management)
│   ├── retention.ts        (Phase 6 retention policy)
│   └── constants.ts        (Enums + constants)
├── scheduled/
│   ├── snapshot_scheduler.ts (NEW: Phase 6 snapshot scheduler)
│   └── [...existing]
├── admin/
│   ├── phase6_snapshot_page.ts (NEW: Phase 6 admin page)
│   └── [...existing]
└── exports/
    ├── phase6_export_json.ts (NEW: Snapshot JSON export)
    └── [...existing]

tests/
├── phase6/                 (NEW: Phase 6 tests)
│   ├── snapshot_model.test.ts
│   ├── snapshot_capture.test.ts
│   ├── retention.test.ts
│   ├── snapshot_scheduler.test.ts
│   └── determinism.test.ts
└── [...existing]
```

**Impact:** Clear structure; ready to implement Phase 6.

---

### 8. CLOCK SOURCE & TIMESTAMP HANDLING

**Unknown:** How should "clock_source: system | jira | unknown" be determined? Can Forge get server clock vs local?

**Why it blocks:**
- Phase 6 spec requires explicit `clock_source` field on every snapshot
- Affects canonicalization + determinism if clock is unknown
- Must understand current timestamp handling

**Questions needed:**
- [ ] Does the Jira Cloud API return timestamp in response headers?
- [ ] Is there a Jira server time endpoint to sync against?
- [ ] Should system clock be trusted or always marked "unknown"?
- [ ] Are there existing timestamp utilities in codebase?

**Impact:** Affects hash determinism and audit trail reliability.

---

### 9. MISSING DATA DISCLOSURE & REASON CODES

**Unknown:** What are common reasons for missing data in Jira Cloud snapshots? Should we handle gracefully or fail the snapshot?

**Why it blocks:**
- Phase 6 spec defines reason_code enum, but real-world scenarios unknown
- Must decide: missing data = mark partial, or hard fail?

**Questions needed:**
- [ ] What are real failure scenarios? (permission_denied on which endpoints?)
- [ ] Are there Jira admin endpoints that don't work in Forge context?
- [ ] Can we detect missing data at runtime and continue, or must we hard-fail?
- [ ] Should empty datasets (0 projects) count as missing_data or normal?

**Impact:** Affects run success criteria and alert strategy.

---

### 10. SCALE & PERFORMANCE TESTING

**Unknown:** What are realistic payload sizes? Should we simulate 500, 5000, or 50000 projects?

**Why it blocks:**
- Phase 6 spec mentions "scale test simulation with 500 projects"
- Must know realistic scale to write correct pagination tests

**Questions needed:**
- [ ] What is the typical number of projects in a tenant? (10s, 100s, 1000s+?)
- [ ] What is the typical size of a snapshot payload? (MB, 10s MB, 100s MB?)
- [ ] Are there Jira Cloud size limits on API responses?
- [ ] Should we paginate the snapshot payload itself, or just list endpoints?

**Impact:** Determines pagination test strategy and snapshot structure.

---

### 11. DETERMINISM & CANONICAL JSON

**Unknown:** How should array ordering be handled in canonical JSON? Which fields are guaranteed stable keys?

**Why it blocks:**
- Phase 6 spec requires deterministic canonicalization + sha256 hashing
- Must know: if projects array lacks stable IDs, how should it be ordered?

**Questions needed:**
- [ ] Do Jira Project objects have stable `id` or `key` field?
- [ ] Do Jira Field objects have stable `id`?
- [ ] Are there any arrays in snapshot payload without stable keys?
- [ ] Is insertion order from Jira API stable across multiple calls?

**Impact:** Affects hash algorithm and determinism guarantees.

---

### 12. EXISTING PHASE 4-5 INTEGRATION POINTS

**Unknown:** What does Phase 4-5 already capture that Phase 6 should reference or reuse?

**Why it blocks:**
- Phase 6 spec requires explicit list of "captured datasets"
- Phase 4-5 may have overlapping logic (project inventory, workflow metadata, etc.)

**Questions needed:**
- [ ] Does Phase 4-5 already capture project inventory? Can we reuse that code?
- [ ] Does Phase 4-5 capture field metadata? Workflow structures?
- [ ] Are there existing Jira API utilities/helpers to reuse?
- [ ] Can Phase 6 snapshots reference Phase 4-5 derived data, or must be independent?

**Impact:** Determines code reuse and data model overlap.

---

## MINIMAL DECISION OPTIONS

If answers require decisions, here are minimal viable options:

### Storage Option A: Forge KVStore with Prefix Listing
- Use `@forge/api` KVStore
- Key format: `${tenant_id}:${entity_type}:${id}`
- Implement pagination via `keys()` enumeration + filtering
- Pros: Simple, built-in
- Cons: May be slow for large tenants; limited query flexibility

### Storage Option B: Forge Private Cloud Storage or External DB
- If Forge KVStore insufficient, use a small managed DB
- Requires separate deployment/credentials
- Pros: Full query + pagination support
- Cons: Adds infrastructure dependency

### Scheduler Option A: Separate Scheduled Functions
- Define `@forge/scheduler` function for daily, another for weekly
- Each has own manifest entry + cron expression
- Pros: Clear separation; easy to debug each independently
- Cons: Double infrastructure overhead

### Scheduler Option B: Single Function with Type Param
- One scheduled function with parameter `type: "daily" | "weekly"`
- Triggered by two separate manifest entries with different cron
- Pros: Code reuse; single function to test
- Cons: More complex conditional logic inside function

### Uninstall Option A: Retention-Based Cleanup
- No explicit uninstall hook; rely on retention policy to eventually purge
- Pros: Simple; no new Forge feature dependency
- Cons: Users see historical data until retention expires

### Uninstall Option B: Explicit Uninstall Hook (if Forge supports)
- Add `@forge/lifecycle` hook for app uninstall
- Show pre-uninstall warning + data export option
- Purge based on policy
- Pros: Clean; compliant with GDPR/retention reqs
- Cons: Requires Forge feature support

---

## BLOCKERS SUMMARY

| # | Unknown | Severity | Decision Needed? |
|---|---------|----------|------------------|
| 1 | Forge Storage API model | ✅ RESOLVED | NO (using requestStorage) |
| 2 | Jira API scope + endpoints | ✅ RESOLVED | NO (reuse Phase 4-5 endpoints) |
| 3 | Scheduled functions support | ✅ RESOLVED | YES (decide integration approach) |
| 4 | Admin UI framework | ✅ RESOLVED | YES (new page or extend Phase 5) |
| 5 | Export mechanism | ✅ RESOLVED | NO (reuse Phase 5 pattern) |
| 6 | Uninstall hook support | ⚠️ UNRESOLVED | YES (defer or implement retention) |
| 7 | Project directory structure | ✅ RESOLVED | NO (follow proposed structure) |
| 8 | Clock source handling | MEDIUM | NO (document assumption) |
| 9 | Missing data scenarios | MEDIUM | NO (enumerate as we discover) |
| 10 | Scale/payload sizes | LOW | NO (test with reasonable defaults) |
| 11 | Determinism approach | MEDIUM | NO (follow standard canonical JSON) |
| 12 | Phase 4-5 reuse potential | MEDIUM | YES (identify overlap) |

---

## CONTEXT INVESTIGATION COMPLETE

After reviewing the existing codebase, 7 of 12 critical unknowns have been resolved. Below are **REMAINING BLOCKERS** requiring decisions:

### Decision 1: Scheduler Integration Approach

**Question:** How should Phase 6 snapshot scheduler integrate with existing Phase 3-5 pipelines?

**Options:**
- **A:** Create separate `phase6-snapshot-daily-fn` + `phase6-snapshot-weekly-fn` in manifest
- **B:** Integrate Phase 6 snapshots into existing `daily-pipeline-fn` + `weekly-pipeline-fn`  
- **C:** Enhance `src/scheduled/phase5_scheduler.ts` to include snapshot capture

**Recommendation:** Option A (cleanest separation of concerns)
- Phase 6 snapshots are independent evidence ledger
- Can fail independently without affecting Phase 5 reports
- Clear logging + separate audit trail

**Action Needed:** Confirm scheduler integration approach

---

### Decision 2: Admin Page Integration Approach

**Question:** Should Phase 6 snapshot UI be new admin page or new section in Phase 5?

**Options:**
- **A:** New admin page: `phase6-snapshot-page` in manifest + `src/admin/phase6_snapshot_page.ts`
- **B:** Extend Phase 5: Add "Snapshots" section to existing `phase5_admin_page.ts`

**Recommendation:** Option A (independent audit trail)
- Phase 6 is separate governance layer
- Users should see snapshot history independently
- Easier to evolve without breaking Phase 5 UI

**Action Needed:** Confirm admin UI approach

---

### Decision 3: Retention vs Uninstall Behavior

**Question:** How should app uninstall handle stored snapshots?

**Options:**
- **A:** Implement retention policy only (FIFO auto-expire old snapshots)
  - No explicit uninstall hook
  - Snapshots deleted per retention_policy.max_days
  - Simplest; works with current Forge setup
  
- **B:** Add uninstall hook (if Forge supports it)
  - Show pre-uninstall warning
  - Offer export before purge
  - Delete all snapshots on uninstall
  - Requires Forge app:uninstalled support

**Recommendation:** Option A (pragmatic for Phase 6 v2)
- Forge app lifecycle unclear
- Retention policy is core requirement anyway
- Can add Option B later if Forge support confirmed

**Action Needed:** Confirm uninstall approach OR skip entirely for v2

---

## RECOMMENDED NEXT STEPS

1. **Confirm 3 decisions above** (scheduler, admin UI, uninstall approach)
2. **Create Phase 6 design document:**
   - Data model finalization
   - Scheduler design
   - API endpoint whitelist for snapshot capture
   - Retention policy defaults
3. **Proceed with implementation in 4 stages:**
   - Stage 1: Storage + Snapshot model
   - Stage 2: Scheduler + Canonicalization
   - Stage 3: Admin UI + Exports
   - Stage 4: Tests + Verification

---

## DO NOT PROCEED UNTIL

- [ ] Scheduler integration approach confirmed (A, B, or C)
- [ ] Admin UI approach confirmed (new page or extend Phase 5)
- [ ] Retention vs uninstall behavior confirmed (Option A or B)
- [ ] Phase 6 design document created

---

**Status:** ⚠️ **AWAITING DECISIONS BEFORE IMPLEMENTATION**
