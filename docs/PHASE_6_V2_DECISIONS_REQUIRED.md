# PHASE 6 v2 — DECISIONS REQUIRED BEFORE IMPLEMENTATION

**Status:** ⚠️ AWAITING DECISIONS  
**Blocks:** Implementation cannot start until these 3 decisions are confirmed  
**Timeline:** Ready to start within 1 hour of decision confirmation

---

## DECISION 1: SCHEDULER INTEGRATION APPROACH

**Question:** How should Phase 6 snapshot capture integrate with existing scheduled pipelines?

### Option A: Separate Snapshot Scheduler Functions ✅ RECOMMENDED

```yaml
# Add to manifest.yml
modules:
  function:
    - key: phase6-snapshot-daily-fn
      handler: scheduled/snapshot_daily.run
    - key: phase6-snapshot-weekly-fn
      handler: scheduled/snapshot_weekly.run

  scheduledTrigger:
    - key: phase6-snapshot-daily
      function: phase6-snapshot-daily-fn
      interval: day
    - key: phase6-snapshot-weekly
      function: phase6-snapshot-weekly-fn
      interval: week
```

**Pros:**
- ✅ Clean separation of concerns (Phase 6 independent from Phase 3-5)
- ✅ Can fail without affecting Phase 5 reports
- ✅ Separate execution logs + audit trail
- ✅ Clear code organization

**Cons:**
- ❌ Duplicate scheduler infrastructure (minor overhead)

---

### Option B: Integrate into Existing Daily/Weekly Pipeline

```yaml
# Modify existing handlers to include snapshot capture
# Both daily-pipeline-fn and weekly-pipeline-fn call snapshot capture
```

**Pros:**
- ✅ Reuses existing scheduler infrastructure
- ✅ Single execution window (fewer functions)

**Cons:**
- ❌ Coupling Phase 6 to Phase 3 infrastructure
- ❌ Failure in Phase 6 could impact Phase 5 reports
- ❌ Harder to debug independently

---

### Option C: Enhance Phase 5 Scheduler

```typescript
// phase5_scheduler.ts calls both Phase 5 triggers AND Phase 6 snapshots
async function runSchedule() {
  await handlePhase5Triggers(...);    // Existing
  await handlePhase6Snapshots(...);   // New
}
```

**Pros:**
- ✅ Single scheduler function for all governance

**Cons:**
- ❌ Heavy coupling (Phase 5 scheduler owns Phase 6)
- ❌ Mixed concerns (report generation + evidence ledger)
- ❌ Hardest to evolve

---

## DECISION 2: ADMIN UI PLACEMENT

**Question:** Should Phase 6 snapshot UI be a new admin page or extend Phase 5?

### Option A: New Admin Page ✅ RECOMMENDED

```yaml
# Add to manifest.yml
modules:
  jira:adminPage:
    - key: phase6-snapshot-page
      title: FirstTry Snapshots — Evidence Ledger
      description: View snapshot history, capture status, retention policy
      function: phase6-snapshot-page-fn

  function:
    - key: phase6-snapshot-page-fn
      handler: admin/phase6_snapshot_page.run
```

**File Structure:**
```
src/admin/
├── phase6_snapshot_page.ts      (NEW: 1000-1200 lines)
│   ├── SnapshotPageHandler
│   ├── renderSnapshotStatus()   (last run, errors)
│   ├── renderSnapshotHistory()  (paginated table)
│   └── renderRetentionPolicy()  (settings display)
└── [existing]
```

**Pros:**
- ✅ Clear separation (Phase 6 independent admin page)
- ✅ Users see evidence ledger separately from reports
- ✅ Can evolve independently
- ✅ Audit trail clearly distinct from Phase 5

**Cons:**
- ❌ Two admin pages instead of one

---

### Option B: Extend Phase 5 Admin Page

```typescript
// phase5_admin_page.ts adds new section
// renderPhase6SnapshotSection()
```

**Pros:**
- ✅ Single admin page (simpler navigation)

**Cons:**
- ❌ Mixes two governance layers (reports + evidence)
- ❌ Phase 5 page grows to 1500+ lines
- ❌ Harder to evolve independently
- ❌ UI hierarchy suggests they're related (they're not)

---

## DECISION 3: RETENTION vs EXPLICIT UNINSTALL

**Question:** How should app uninstall handle stored snapshots?

### Option A: Retention-Based Cleanup (v2) ✅ RECOMMENDED

```typescript
// Phase 6 uses retention policy to auto-delete old snapshots
// On uninstall: snapshots deleted per retention_policy.max_days

retention_policy: {
  tenant_id,
  max_days: 90,              // Keep snapshots for 90 days
  max_records_daily: 90,     // Keep 90 daily snapshots
  max_records_weekly: 52,    // Keep 52 weekly snapshots (1 year)
  deletion_strategy: "FIFO", // Delete oldest first
}
```

**Pros:**
- ✅ Works immediately (no Forge feature dependency)
- ✅ Gradual cleanup (no surprise mass deletion)
- ✅ Complies with retention regulations
- ✅ Simplest to implement for v2

**Cons:**
- ❌ Snapshots remain for {max_days} even after uninstall
- ❌ No explicit "purge all now" option at uninstall

**Uninstall Behavior:**
- User clicks "Uninstall"
- App removes from tenant
- Snapshots remain in storage for {max_days}
- Retention policy auto-deletes after {max_days}
- ✅ GDPR compliant (within retention period)

---

### Option B: Explicit Uninstall Hook (Future)

```yaml
# Add to manifest.yml (if Forge supports)
modules:
  app:uninstalled:
    function: phase6-uninstall-fn
```

```typescript
// phase6_uninstall.ts
async function onUninstall(context) {
  // Show pre-uninstall modal with options:
  // 1. "Export snapshots before uninstall"
  // 2. "Delete all snapshots immediately"
  // 3. "Keep snapshots for {max_days}"
  
  // Delete all snapshots for this tenant
  await deleteAllSnapshots(tenant_id);
}
```

**Pros:**
- ✅ Immediate cleanup on uninstall
- ✅ User choice (export, keep, or delete)
- ✅ No orphaned data

**Cons:**
- ❌ Forge support unclear (may not be available)
- ❌ Requires pre-uninstall modal (complex UX)
- ❌ Cannot implement for Phase 6 v2 without confirmation

**Blocker:** Does @forge/api support `app:uninstalled` lifecycle hooks?

---

## SUMMARY TABLE

| Decision | Recommended | Reason |
|----------|------------|--------|
| **Scheduler** | Option A | Independent from Phase 5; cleaner failure isolation |
| **Admin UI** | Option A | Evidence ledger clearly separate from reports |
| **Uninstall** | Option A (v2) | Works immediately; Option B for future release |

---

## NEXT STEP: CONFIRM DECISIONS

Please confirm:

```
[ ] SCHEDULER: 
    [ ] Option A (separate functions)
    [ ] Option B (integrated pipeline)
    [ ] Option C (enhanced Phase 5)

[ ] ADMIN UI:
    [ ] Option A (new page)
    [ ] Option B (extend Phase 5)

[ ] UNINSTALL:
    [ ] Option A (retention policy only, for v2)
    [ ] Option B (explicit hook, if Forge supports)
    [ ] Skip uninstall behavior for v2
```

---

## ONCE DECISIONS CONFIRMED

**Immediate next steps:**

1. Create `docs/PHASE_6_V2_DESIGN.md` (detailed architecture)
2. Create `docs/PHASE_6_V2_SPEC.md` (specification + data model)
3. Create `docs/PHASE_6_V2_TESTPLAN.md` (comprehensive test plan)
4. Implement in 4 stages:
   - **Stage 1** (Day 1): Storage + Data Model
   - **Stage 2** (Day 2): Snapshot Capture + Canonicalization
   - **Stage 3** (Day 3-4): Scheduler + Admin UI + Exports
   - **Stage 4** (Day 5): Comprehensive Tests + Verification

**Estimated Timeline:** 5-7 days (with design docs + tests)

---

**Awaiting decisions to proceed.** Ready to implement within 1 hour of confirmation.
