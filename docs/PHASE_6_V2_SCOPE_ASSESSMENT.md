# PHASE 6 v2 IMPLEMENTATION SCOPE — FILE IMPACT ASSESSMENT

**Status:** Ready to implement; confirming scope with user  
**File Impact:** ~20 files (exceeds 15-file threshold)  
**Reason:** Phase-level implementation (complete feature)

---

## FILES THAT WILL BE CREATED/MODIFIED

### New Source Files (9)
```
src/phase6/
├── constants.ts                  (Enums: ErrorCode, CoverageStatus, etc.)
├── snapshot_model.ts             (SnapshotRun, Snapshot, RetentionPolicy interfaces)
├── snapshot_storage.ts           (Storage layer: CRUD for snapshots/runs)
├── snapshot_capture.ts           (Daily/weekly capture logic, Jira API queries)
├── canonicalization.ts           (Deterministic JSON hashing, sha256)
└── [5 files]

src/scheduled/
├── snapshot_daily.ts             (NEW: Daily snapshot scheduler handler)
├── snapshot_weekly.ts            (NEW: Weekly snapshot scheduler handler)
└── [2 files]

src/admin/
├── phase6_snapshot_page.ts       (NEW: Admin page UI)
└── [1 file]

src/exports/
├── phase6_export_json.ts         (NEW: Snapshot JSON export)
└── [1 file]
```

### Modified Files (1)
```
manifest.yml                       (ADD: scheduledTrigger + jira:adminPage + functions)
```

### New Test Files (7)
```
tests/phase6/
├── snapshot_model.test.ts        (Data model validation, immutability)
├── snapshot_storage.test.ts      (Storage CRUD, tenant isolation, pagination)
├── snapshot_capture.test.ts      (Capture logic, error handling, coverage)
├── snapshot_scheduler.test.ts    (Idempotency, run logging, backoff)
├── determinism.test.ts           (Canonical JSON hash, stability)
├── tenant_isolation.test.ts      (Cross-tenant access prevention)
├── no_jira_writes.test.ts        (Whitelist verification: no write endpoints)
└── [7 files]
```

### New Documentation Files (3)
```
docs/
├── PHASE_6_V2_DESIGN.md          (Detailed architecture + algorithms)
├── PHASE_6_V2_SPEC.md            (Data model + API + behavior spec)
└── PHASE_6_V2_TESTPLAN.md        (Test strategy + coverage map)
```

---

## SUMMARY

| Category | Count | Files |
|----------|-------|-------|
| New source code | 9 | phase6 (5), scheduled (2), admin (1), exports (1) |
| Modified files | 1 | manifest.yml |
| New tests | 7 | tests/phase6/ |
| New docs | 3 | docs/ |
| **TOTAL** | **20** | (exceeds 15-file threshold) |

---

## IMPACT ASSESSMENT

### Why >15 Files is Expected Here

This is **Phase-level work**, not a small feature. Phase 6 includes:
- ✅ Complete data model (SnapshotRun, Snapshot, RetentionPolicy)
- ✅ Scheduler integration (2 separate handler files)
- ✅ Storage layer (CRUD + tenant isolation + pagination)
- ✅ Snapshot capture (Jira API integration, canonicalization, error handling)
- ✅ Admin UI (new page, status display, history table, retention settings)
- ✅ Exports (JSON export, future PDF)
- ✅ Comprehensive tests (determinism, isolation, no-write enforcement)
- ✅ Documentation (design, spec, test plan)

**Comparison:** Earlier phases (Phase 4-5) also create ~15-20 files when complete.

### Files Organization Strategy

All Phase 6 code follows existing conventions:
- Source: `src/phase6/` (mirrors phase4, phase5 structure)
- Tests: `tests/phase6/` (mirrors test structure)
- Docs: `docs/PHASE_6_V2_*.md` (follows pattern)
- No scattered changes across unrelated directories

### Risk Assessment

- ✅ **Low Risk:** All files are new or minimal manifest additions
- ✅ **No Breaking Changes:** Phase 6 is independent; doesn't modify Phase 4-5 code
- ✅ **Clear Scope:** Bounded to Phase 6 snapshot feature only
- ✅ **Testable:** Each file has corresponding tests
- ✅ **Documented:** Design + spec + test plan included

---

## DECISION POINT

**The 15-file threshold rule exists to prevent scope creep and maintain clarity.**

In this case:
- ✅ Decisions are confirmed
- ✅ Investigation is complete
- ✅ Scope is well-defined (Phase 6 v2 only)
- ✅ File organization is clear
- ✅ No undiscovered dependencies

**Question:** Should I proceed with Phase 6 v2 implementation (20 files), or break it into smaller stages?

### Option A: Proceed with Full Implementation (20 files)
- **Timeline:** 5-7 days
- **Deliverable:** Complete Phase 6 v2 (all stages in one go)
- **Risk:** Large changeset (but well-organized, tested, documented)

### Option B: Implement in Smaller Stages (15 files → +5 files)
- **Stage 1 (Files 1-15):** Core data model + storage + scheduler
  - Skip: Admin UI, exports, some tests
  - Deliverable: Snapshot capture working end-to-end
- **Stage 2 (Files 16-20):** Admin UI + exports + remaining tests
  - Deliverable: User-facing features

---

## RECOMMENDATION

**Proceed with Full Implementation (Option A).**

Reasoning:
1. Phase 6 v2 is a cohesive feature (snapshots are incomplete without UI + exports)
2. All 20 files are interdependent (hard to split cleanly)
3. The 15-file rule is a checkpoint, not an absolute limit for Phase-level work
4. Implementation, tests, and docs together reduce risk
5. You've already invested in decisions and investigation

---

## NEXT STEP: USER CONFIRMATION

Confirm how to proceed:

- [ ] **Option A:** Go ahead with full 20-file implementation
- [ ] **Option B:** Implement in stages (core first, then UI)
- [ ] **Option C:** Scale back to minimal MVP (fewer files)

**My recommendation: Option A.** Ready to start immediately upon confirmation.

---

**Awaiting decision to proceed with Phase 6 v2 implementation.**
