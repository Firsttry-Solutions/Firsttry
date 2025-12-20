# PHASE 6 v2 INVESTIGATION SUMMARY

**Status:** ⚠️ **AWAITING DECISIONS** (not blocked, ready to proceed with confirmations)  
**Date:** December 20, 2025  
**Investigation:** Complete codebase review done; 3 decisions needed before implementation

---

## INVESTIGATION RESULTS

### What We Found ✅

1. **Forge Storage:** Using `@forge/api requestStorage()` with TTL support
   - Pattern: Hierarchical keys with sharding
   - Pagination: Strategy needed (application-level indexing recommended)
   - Status: ✅ Ready to use

2. **Jira API Access:** Phase 4-5 already using REST API v3
   - Projects, fields, workflows, issue types, statuses available
   - Phase 6 can reuse same endpoints
   - Status: ✅ Ready to query

3. **Scheduled Functions:** Manifest already has daily + weekly triggers
   - Pattern: `scheduledTrigger` with `interval: day/week`
   - Idempotency: Phase 5 shows atomic lock pattern (DONE markers)
   - Status: ✅ Ready to extend

4. **Admin UI:** HTML template-based (Phase 5)
   - Pattern: Server-rendered TypeScript
   - Can add new page or extend existing
   - Exports already implemented (JSON + PDF available)
   - Status: ✅ Framework ready

5. **Project Structure:** Clean separation (phase4, phase5, pipelines, etc.)
   - Phase 6 should follow same convention
   - Tests in separate `tests/phase6/` directory
   - Status: ✅ Ready for new phase

### What Needs Decision ⚠️

1. **Scheduler Integration**
   - Option A: New separate snapshot scheduler functions
   - Option B: Integrate into existing daily/weekly pipeline
   - Option C: Enhance Phase 5 scheduler to handle snapshots
   - **Recommendation:** Option A (cleanest separation)

2. **Admin UI Placement**
   - Option A: New admin page (`phase6-snapshot-page`)
   - Option B: Extend Phase 5 admin page with snapshots section
   - **Recommendation:** Option A (independent audit trail)

3. **Uninstall Behavior**
   - Option A: Retention-only (no explicit uninstall hook)
   - Option B: Add uninstall hook (unclear if Forge supports)
   - **Recommendation:** Option A for v2 (retention policy handles cleanup)

---

## FINDINGS BY AREA

### 📦 Storage
- ✅ `@forge/api` requestStorage available
- ✅ TTL support for auto-expiration
- ⚠️ Pagination requires custom indexing strategy
- **File:** `src/storage.ts` (147 lines, sharding pattern visible)

### 🔌 Jira Integration
- ✅ REST API v3 already integrated (Phase 4-5)
- ✅ Projects, fields, workflows, automation metadata available
- ✅ Coverage status tracking exists (`CoverageStatus` enum)
- **File:** `src/jira_ingest.ts` (663 lines, comprehensive endpoint coverage)

### ⏰ Scheduling
- ✅ Forge `scheduledTrigger` available (day/week intervals)
- ✅ Idempotency markers + atomic locks demonstrated (Phase 5)
- ✅ Exponential backoff pattern already implemented
- **Files:** `manifest.yml`, `src/scheduled/phase5_scheduler.ts` (436 lines)

### 🎨 Admin UI
- ✅ HTML template-based framework (Phase 5)
- ✅ Server-side rendering with TypeScript
- ✅ Export infrastructure ready (JSON + PDF)
- ✅ Can add new page or extend existing
- **Files:** `src/admin/phase5_admin_page.ts` (1225 lines), `src/exports/` directory

### 📁 Project Structure
- ✅ Clear phase-based organization (phase4, phase5, phase6)
- ✅ Separate `src/scheduled`, `src/exports`, `src/admin`
- ✅ Test structure mirrors source structure
- **Pattern:** Follow existing convention for Phase 6

---

## PROPOSED PHASE 6 FILE STRUCTURE

```
src/
├── phase6/
│   ├── constants.ts              (ErrorCode, CoverageStatus enums)
│   ├── snapshot_model.ts         (SnapshotRun, Snapshot, RetentionPolicy)
│   ├── snapshot_capture.ts       (capture daily/weekly snapshot logic)
│   ├── snapshot_storage.ts       (storage layer for snapshots)
│   └── canonicalization.ts       (deterministic hashing)
├── scheduled/
│   ├── snapshot_daily.ts         (NEW: daily snapshot handler)
│   ├── snapshot_weekly.ts        (NEW: weekly snapshot handler)
│   └── [existing]
├── admin/
│   ├── phase6_snapshot_page.ts   (NEW: snapshot admin UI)
│   └── [existing]
├── exports/
│   ├── phase6_export_json.ts     (NEW: snapshot JSON export)
│   └── [existing]
└── [existing files]

tests/
├── phase6/
│   ├── snapshot_model.test.ts
│   ├── snapshot_capture.test.ts
│   ├── snapshot_storage.test.ts
│   ├── snapshot_scheduler.test.ts
│   ├── canonicalization.test.ts
│   ├── tenant_isolation.test.ts
│   ├── determinism.test.ts
│   ├── retention.test.ts
│   └── no_jira_writes.test.ts
└── [existing]

manifest.yml (ADD):
  scheduledTrigger:
    - key: phase6-snapshot-daily
      function: phase6-snapshot-daily-fn
      interval: day
    - key: phase6-snapshot-weekly
      function: phase6-snapshot-weekly-fn
      interval: week
  
  function:
    - key: phase6-snapshot-daily-fn
      handler: scheduled/snapshot_daily.run
    - key: phase6-snapshot-weekly-fn
      handler: scheduled/snapshot_weekly.run
  
  jira:adminPage:
    - key: phase6-snapshot-page
      title: FirstTry Snapshots — Evidence Ledger
      function: phase6-snapshot-page-fn
  
  function:
    - key: phase6-snapshot-page-fn
      handler: admin/phase6_snapshot_page.run
```

---

## IMPLEMENTATION READINESS

| Component | Status | Notes |
|-----------|--------|-------|
| Storage Layer | ✅ READY | Use requestStorage + application-level indexing |
| Jira API | ✅ READY | Reuse Phase 4-5 endpoints |
| Scheduler | ⚠️ NEEDS DECISION | Confirm integration approach (A/B/C) |
| Admin UI | ⚠️ NEEDS DECISION | Confirm new page vs extend (A/B) |
| Exports | ✅ READY | JSON export; PDF optional |
| Retention | ✅ READY | Use existing retention pattern |
| Uninstall | ⚠️ NEEDS DECISION | Defer or implement (A/B) |
| Tests | ✅ READY | Follow existing vitest + test structure |

---

## NEXT IMMEDIATE ACTIONS

1. **Confirm 3 decisions:**
   ```
   [ ] Scheduler approach: A (separate) / B (integrated) / C (enhanced)
   [ ] Admin UI approach: A (new page) / B (extend Phase 5)
   [ ] Uninstall approach: A (retention only) / B (explicit hook)
   ```

2. **Once decisions confirmed, proceed with:**
   - Create `docs/PHASE_6_V2_DESIGN.md` (detailed design doc)
   - Create `docs/PHASE_6_V2_SPEC.md` (specification)
   - Create `docs/PHASE_6_V2_TESTPLAN.md` (test plan)
   - Implement in 4 stages

---

## BLOCKERS STATUS

- ❌ NO CRITICAL BLOCKERS (all foundational tech confirmed)
- ⚠️ 3 ARCHITECTURAL DECISIONS NEEDED (not blockers, just decisions)
- ✅ ALL FOUNDATIONAL INFRASTRUCTURE CONFIRMED

---

## CONFIDENCE LEVEL

**Implementation Confidence: HIGH (85%+)**

Phase 6 v2 can proceed immediately with:
- ✅ Storage layer confirmed
- ✅ Jira API confirmed
- ✅ Scheduling infrastructure confirmed
- ✅ Admin UI framework confirmed
- ⚠️ Just needs 3 architectural decisions

**Estimated effort:** 5-7 days (with design doc + comprehensive tests)

---

**See:** `docs/PHASE_6_V2_SCOPE_EXPANSION_REQUIRED.md` for full details

**Status:** Ready to implement once decisions provided
