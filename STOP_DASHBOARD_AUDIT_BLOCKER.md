# DASHBOARD AUDIT BLOCKER — SCHEMA MISMATCH DETECTED

## Critical Issue: Two Incompatible Schema Versions

### Problem Statement
The dashboard gadget has a **TYPE MISMATCH** between what the resolver returns and what the UI expects:

- **Resolver returns:** `UnifiedGovernanceStatus` (from `src/core/unified_status_model.ts`)
  - Contains: `schemaVersion: "unified_status_v1"`, `subsystems[]`, `kpis[]`, `phases[]`, `export`
  - Has: `boundaries`, `operationalMetrics`, etc. in the snapshot data
  
- **UI imports & uses:** `GovernanceStatusV1` (from `src/shared/statusSchema.ts`)
  - Contains: `schemaVersion: "1"`, `scheduler`, `snapshots`, `timeline`, `checks`, `errors`
  - Missing: `operationalMetrics`, `boundaries` (which export functions use!)
  - Normalizer (`normalizeStatusV1()`) doesn't create these fields

### Audit Findings

1. **Export Functions Use Undefined Fields**
   - File: `src/gadget-ui/src/main.ts`, lines 990-1008
   - Function: `toSummaryText(payload)`
   - Unsafe accesses:
     ```typescript
     payload.operationalMetrics.checksCompletedLifetime  // ← NOT in GovernanceStatusV1!
     payload.operationalMetrics.snapshotCountRetained
     payload.operationalMetrics.daysContinuousOperation
     payload.operationalMetrics.failureCount7d
     payload.operationalMetrics.skippedChecksCount7d
     
     payload.boundaries.noJiraWrites  // ← NOT in GovernanceStatusV1!
     payload.boundaries.noConfigChanges
     payload.boundaries.noEnforcement
     ```

2. **Resolver Actually Returns Different Type**
   - File: `src/resolvers/governance_status.ts`
   - Type: `UnifiedGovernanceStatus` (not `GovernanceStatusV1`)
   - Returns: Object with `boundaries`, `counters`, `checks[]`, `version`, `environment`, etc.

3. **Main.ts Normalizer Assumption Wrong**
   - Line 215: `data = normalizeStatusV1(rawData, ...)`
   - This assumes rawData is structured for GovernanceStatusV1
   - But resolver returns UnifiedGovernanceStatus structure
   - The normalizer will **ignore** the operationalMetrics/boundaries fields!

### Questions Requiring Product Decisions

**Q1: What is the intended payload structure?**
- Should UI use `UnifiedGovernanceStatus` (what resolver actually returns)?
- Or should resolver be refactored to return `GovernanceStatusV1`?
- Or are these supposed to be merged into ONE schema?

**Q2: How should export functions get operationalMetrics/boundaries?**
- Option A: Add these fields to `GovernanceStatusV1` and update normalizer
- Option B: Update export functions to use data from UnifiedGovernanceStatus structure
- Option C: Create a new data transformation layer between resolver and export

**Q3: Is main.ts actually receiving the correct data?**
- Currently main.ts calls `normalizeStatusV1(rawData)` on the response
- If rawData is `UnifiedGovernanceStatus`, the normalizer will strip/ignore the operationalMetrics/boundaries
- The export functions will then receive `GovernanceStatusV1` (no operationalMetrics/boundaries)
- Result: **Export functions will crash** when trying to access these fields

## Evidence

### In statusSchema.ts (lines 102-249)
- `EMPTY_STATUS_V1()` creates an object WITHOUT operationalMetrics or boundaries
- `normalizeStatusV1()` creates an object WITHOUT operationalMetrics or boundaries
- Type definition `GovernanceStatusV1` does NOT include these fields

### In unified_status_model.ts (lines 123-131)
- `UnifiedGovernanceStatus` interface is the actual resolver return type
- This is a DIFFERENT schema than GovernanceStatusV1

### In governance_status.ts (resolver)
- Line 243+: Returns objects WITH `boundaries: { monitoringActive, readOnlyMode, noJiraWrites, ... }`
- These fields are from the UnifiedGovernanceStatus structure
- Never transformed to GovernanceStatusV1

### In main.ts (UI)
- Line 24: Imports GovernanceStatusV1 (wrong!)
- Line 215: Calls normalizeStatusV1() on resolver response (type mismatch!)
- Lines 990-1008: Export functions expect operationalMetrics/boundaries (which GovernanceStatusV1 doesn't have!)

## Decision Required

**One of these must be true before dashboard can be certified safe:**

1. **Update GovernanceStatusV1 schema:**
   - Add `operationalMetrics` and `boundaries` fields
   - Update `EMPTY_STATUS_V1()` to provide safe defaults
   - Update `normalizeStatusV1()` to extract/create these from input
   
2. **Remove GovernanceStatusV1, use UnifiedGovernanceStatus everywhere:**
   - Change main.ts to use UnifiedGovernanceStatus type
   - Remove normalizeStatusV1() call if not needed
   - Verify all field accesses match UnifiedGovernanceStatus structure
   
3. **Create data transformation layer:**
   - Add a function that converts resolver response to UI-expected format
   - Explicitly map UnifiedGovernanceStatus → GovernanceStatusV1 (or vice versa)
   - Document which fields map to which
   - Add unit tests for transformation

## Actual Impact Analysis

### Is This a Crash Bug?
**NO** — The export functions use fallbacks (`|| 0`, `|| false`, `?. `) so they won't throw.

### Is This a Data Loss Bug?
**YES** — Export functions will output ZERO values instead of real metrics:
- `checksCompletedLifetime` will be `0` instead of actual count
- `snapshotCountRetained` will be `0` instead of actual count
- `daysContinuousOperation` will be `0` instead of actual days
- `boundaries.noJiraWrites` will be `false` instead of actual state

This is a **SILENT DATA LOSS** bug, worse than a crash because users won't know the data is wrong.

### Proof
File: `src/gadget-ui/src/main.ts`, function `buildExportPayload()` lines 869-920:
```typescript
operationalMetrics: {
    checksCompletedLifetime: lastPayload.checksCompletedLifetime || 0,  // ← Field doesn't exist in GovernanceStatusV1
    snapshotCountRetained: lastPayload.snapshotsRetainedCount || 0,     // ← Will be 0!
    daysContinuousOperation: lastPayload.daysContinuousOperation || 0,  // ← Will be 0!
    failureCount7d: lastPayload.failureCount7d || 0,                    // ✓ This field exists
    skippedChecksCount7d: lastPayload.skippedChecksCount7d || 0,        // ✓ This field exists
},
boundaries: {
    noJiraWrites: lastPayload.boundaries?.noJiraWrites || false,       // ← boundaries doesn't exist in schema
    noConfigChanges: lastPayload.boundaries?.noConfigChanges || false,  // ← Will be false!
    noEnforcement: lastPayload.boundaries?.noEnforcement || false,      // ← Will be false!
},
```

## Blocking Audit

Until this is resolved, **CANNOT PROCEED** with:
- Phase 4 (feature audit)
- Phase 5 (test creation)
- Phase 6 (backend verification)
- Phase 7 (build/test execution)
- Phase 8 (proof report)

**Status:** ⛔ **AUDIT BLOCKED — DATA LOSS ISSUE**

**Required Action:** 
Choose one of the 3 schema options above, implement it, and notify when ready to continue audit. The export functions MUST receive the correct fields with real data.

---

## Supporting Evidence Files
- `/tmp/dashboard_audit_head.txt` - Repo HEAD
- `/tmp/dashboard_audit_dom_ids.txt` - DOM feature inventory (55 IDs)
- `/tmp/dashboard_audit_nested_reads_all.txt` - All unsafe reads found
- `/tmp/DASHBOARD_AUDIT_FINDINGS.md` - Detailed phase 0-3 findings
