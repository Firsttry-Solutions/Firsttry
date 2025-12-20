# PHASE 6 v2 — STAGED IMPLEMENTATION PLAN

**Status:** Stage 1 in progress  
**Timeline:** Stage 1 (5-7 days) → Stage 2 (2-3 days)  
**Approach:** Staged delivery for incremental review

---

## STAGE 1: CORE EVIDENCE LEDGER (Days 1-7)

**Objective:** Complete snapshot capture, storage, and scheduler — working end-to-end

**Files Created (15):**

### Source Code (8)
```
src/phase6/
├── constants.ts                 (ErrorCode, CoverageStatus enums + defaults)
├── snapshot_model.ts            (SnapshotRun, Snapshot, RetentionPolicy types)
├── snapshot_storage.ts          (Storage CRUD + tenant isolation + pagination)
├── snapshot_capture.ts          (Daily/weekly capture logic, Jira queries)
├── canonicalization.ts          (Deterministic JSON hashing, sha256)
└── [5 core files]

src/scheduled/
├── snapshot_daily.ts            (Daily snapshot handler)
├── snapshot_weekly.ts           (Weekly snapshot handler)
└── [2 scheduler files]
```

### Tests (5)
```
tests/phase6/
├── snapshot_model.test.ts       (Data model, immutability, contracts)
├── snapshot_storage.test.ts     (CRUD, tenant isolation, pagination)
├── snapshot_capture.test.ts     (Capture logic, error handling, coverage)
├── snapshot_scheduler.test.ts   (Idempotency, run logging, backoff)
├── determinism.test.ts          (Canonical JSON hash stability)
└── [5 core tests]
```

### Documentation (2)
```
docs/
├── PHASE_6_V2_DESIGN.md         (Architecture, algorithms, storage)
├── PHASE_6_V2_SPEC.md           (Data model, API, behavior contracts)
└── [2 core docs]
```

### Config (1)
```
manifest.yml                      (ADD: scheduledTrigger + function entries)
```

**Stage 1 Deliverables:**
- ✅ Complete snapshot data model
- ✅ Working storage layer (append-only, immutable)
- ✅ Daily + weekly scheduler handlers
- ✅ Deterministic canonicalization + hashing
- ✅ Jira API integration (read-only)
- ✅ Tenant isolation (all keys prefixed)
- ✅ Idempotency guarantees
- ✅ Comprehensive core tests
- ✅ Design + spec documentation

**Stage 1 Exit Criteria:**
- All 15 files created and tested
- All snapshot captures working (daily + weekly)
- All tests passing (model, storage, capture, scheduler, determinism)
- Tenant isolation verified
- No Jira write endpoints used
- Retention policy enforced automatically

---

## STAGE 2: USER-FACING FEATURES (Days 8-10)

**Objective:** Admin UI, exports, remaining tests, verification

**Files Created (5):**

### Source Code (2)
```
src/admin/
├── phase6_snapshot_page.ts      (Admin page: status, history, retention)
└── [1 admin file]

src/exports/
├── phase6_export_json.ts        (Snapshot JSON export)
└── [1 export file]
```

### Tests (2)
```
tests/phase6/
├── retention.test.ts            (FIFO deletion, limits enforcement)
├── no_jira_writes.test.ts       (Whitelist verification: no write endpoints)
└── [2 remaining tests]
```

### Documentation (1)
```
docs/
└── PHASE_6_V2_TESTPLAN.md       (Comprehensive test coverage map)
```

**Stage 2 Deliverables:**
- ✅ Admin page with snapshot status display
- ✅ Snapshot history table (paginated, stable-ordered)
- ✅ Retention policy settings display
- ✅ JSON export of individual snapshots
- ✅ Retention enforcement tests
- ✅ Jira write-endpoint whitelist verification
- ✅ Comprehensive test plan documentation

**Stage 2 Exit Criteria:**
- All user-facing features complete
- Admin UI displays snapshot status + history
- Export functionality working
- All tests passing (including retention, no-write enforcement)
- Full documentation complete
- Phase 6 v2 ready for production

---

## STAGE BREAKDOWN

### Stage 1: Core Implementation ✅ STARTING NOW

**Days 1-2:** Data Model + Storage
- Create `snapshot_model.ts` (interfaces, types, contracts)
- Create `snapshot_storage.ts` (CRUD, pagination, tenant isolation)
- Create tests for storage layer
- Create `PHASE_6_V2_DESIGN.md` (architecture doc)

**Days 3-4:** Capture Logic + Canonicalization
- Create `snapshot_capture.ts` (daily/weekly capture, Jira queries)
- Create `canonicalization.ts` (deterministic JSON hashing)
- Create tests for capture + determinism
- Update design doc with algorithms

**Days 5-6:** Scheduler Integration
- Create `snapshot_daily.ts` + `snapshot_weekly.ts` (handlers)
- Update `manifest.yml` (add scheduledTrigger entries)
- Create `snapshot_scheduler.test.ts` (idempotency tests)
- Create `PHASE_6_V2_SPEC.md` (specification)

**Days 7:** Core Verification
- Run all Stage 1 tests
- Verify tenant isolation
- Verify no Jira write endpoints
- Verify determinism
- Complete Stage 1 exit criteria

---

### Stage 2: User Features ✅ QUEUED FOR LATER

**Days 8-9:** Admin UI + Exports
- Create `phase6_snapshot_page.ts` (new admin page)
- Create `phase6_export_json.ts` (snapshot export)
- Create remaining tests (retention, no-write verification)

**Day 10:** Final Verification + Docs
- Create `PHASE_6_V2_TESTPLAN.md`
- Run all tests (Stage 1 + Stage 2)
- Verify complete feature set
- Final documentation

---

## DECISION: MINIMUM VIABLE STAGE 1

For Stage 1, I'm skipping:
- ❌ Admin UI (deferred to Stage 2)
- ❌ Exports (deferred to Stage 2)
- ❌ Retention enforcement tests (deferred to Stage 2)
- ❌ No-write whitelist tests (deferred to Stage 2)

This keeps Stage 1 to **exactly 15 files** and delivers a complete, working snapshot system that can be reviewed and tested independently.

---

## NEXT STEP

I'm starting **Stage 1 implementation NOW**.

Files will be created in order:
1. Constants + enums
2. Data model interfaces
3. Storage layer (CRUD)
4. Snapshot capture logic
5. Canonicalization
6. Scheduler handlers
7. Core tests
8. Design + spec docs
9. Manifest updates

**Estimated Stage 1 completion:** 5-7 days

---

**Status:** Stage 1 starting. Will update progress as files are created.
