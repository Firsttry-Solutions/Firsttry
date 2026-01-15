# Dashboard Feature Audit — Executive Summary

## Audit Status: ⛔ BLOCKED (Decision Required)

**Date:** 2026-01-15  
**Repo:** Firsttry-Solutions/Firsttry  
**HEAD:** 5af4f3bd39b4cc3312bb1086afcc2ad316e2a96c  
**Auditor:** GitHub Copilot  

---

## Key Findings

### 1. Schema Architecture Mismatch (CRITICAL)
The codebase has **two incompatible schema definitions**:

| Aspect | GovernanceStatusV1 | UnifiedGovernanceStatus |
|--------|-------------------|------------------------|
| Definition | `src/shared/statusSchema.ts` | `src/core/unified_status_model.ts` |
| Has `operationalMetrics`? | ❌ NO | ❌ (not checked, but resolver uses it) |
| Has `boundaries`? | ❌ NO | ✅ YES (line 243+) |
| Has `scheduler`? | ✅ YES | ❌ NO |
| Where used? | UI imports + normalizer | Backend resolver returns it |

**Problem:** Resolver returns UnifiedGovernanceStatus, but UI normalizes to GovernanceStatusV1, losing fields needed by export functions.

### 2. Dashboard Inventory (55 DOM Elements)
**Feature sections identified:**
- ✅ Operational status panel
- ✅ KPI metrics (5 tiles + status badges)
- ✅ Health indicators
- ✅ Checks table (20 items max)
- ✅ Availability signals (4 signals with 3-state logic)
- ✅ Boundaries & limitations
- ✅ Export controls (3 formats)
- ✅ Progress tracker (enterprise feature)
- ✅ Status banner (enterprise feature)
- ✅ Performance signals

### 3. Data Loss Bug in Export Functions (HIGH PRIORITY)
**File:** `src/gadget-ui/src/main.ts`, function `buildExportPayload()` (lines 869-920)

**The bug:**
```typescript
operationalMetrics: {
    checksCompletedLifetime: lastPayload.checksCompletedLifetime || 0,  // ❌ Doesn't exist
    snapshotCountRetained: lastPayload.snapshotsRetainedCount || 0,     // ❌ Doesn't exist
    daysContinuousOperation: lastPayload.daysContinuousOperation || 0,  // ❌ Doesn't exist
    failureCount7d: lastPayload.failureCount7d || 0,                    // ✅ Exists
    skippedChecksCount7d: lastPayload.skippedChecksCount7d || 0,        // ✅ Exists
},
boundaries: {
    noJiraWrites: lastPayload.boundaries?.noJiraWrites || false,       // ❌ boundaries doesn't exist
    noConfigChanges: lastPayload.boundaries?.noConfigChanges || false,  // ❌ Falls back to false
    noEnforcement: lastPayload.boundaries?.noEnforcement || false,      // ❌ Falls back to false
},
```

**Impact:** 
- ❌ Users who export metrics will get ZEROS instead of real values
- ❌ This is SILENT DATA LOSS (no error thrown)
- ⚠️ Worse than a crash because users won't know data is wrong
- ✅ NOT a crash (has fallbacks), but data integrity issue

### 4. Safe Patterns Already in Place (GOOD!)
**Availability Signals** (from recent tenantIdentity fix):
- ✅ Lines 653-730: Safe optional chaining + 3-state fallback logic
- ✅ 11 unit tests covering undefined/null/missing cases
- ✅ All signals have UNKNOWN state rendering

**Array Access:**
- ✅ Line 613: Guards `if (data.checks && data.checks.length > 0)`

**DOM Element Access:**
- ✅ All `document.getElementById()` calls properly guarded

---

## Root Cause Analysis

### Data Flow
```
Resolver (governance_status.ts)
  └─→ Returns: UnifiedGovernanceStatus { boundaries, counters, checks, ... }
        │
        └─→ Sent to UI as rawData
              │
              └─→ main.ts line 215: normalizeStatusV1(rawData, ...)
                    │
                    └─→ TRANSFORMS → GovernanceStatusV1 { scheduler, snapshots, ... }
                          │
                          ❌ LOSES: boundaries, operationalMetrics fields!
                          │
                          └─→ lastPayload = GovernanceStatusV1
                                │
                                └─→ buildExportPayload() tries to read:
                                    - lastPayload.operationalMetrics.* → UNDEFINED
                                    - lastPayload.boundaries.* → UNDEFINED
                                    → Falls back to 0/false values
```

### Why This Happened
1. Schema was split into two incompatible versions (GovernanceStatusV1 vs UnifiedGovernanceStatus)
2. No integration tests between resolver and UI
3. Export functions use fields that normalizer doesn't preserve
4. TypeScript allows the code to compile (due to `any` type and optional chaining)

---

## Decision Required (3 Options)

### Option A: Update GovernanceStatusV1 Schema ⭐ RECOMMENDED
**What to do:**
1. Add `operationalMetrics` and `boundaries` to GovernanceStatusV1 interface
2. Update `EMPTY_STATUS_V1()` to provide safe defaults
3. Update `normalizeStatusV1()` to extract/create these fields from input

**Pros:**
- Minimal code changes to UI
- Keeps current normalizer pattern
- Preserves type safety

**Cons:**
- GovernanceStatusV1 becomes a grab-bag of fields

**Estimated effort:** 2-3 hours

### Option B: Switch to UnifiedGovernanceStatus in UI
**What to do:**
1. Remove GovernanceStatusV1 import from main.ts
2. Use UnifiedGovernanceStatus type for data
3. Verify all field accesses match UnifiedGovernanceStatus structure
4. Remove normalizeStatusV1() call or adapt it

**Pros:**
- Single source of truth (resolver schema)
- Cleaner separation

**Cons:**
- Requires auditing all field accesses in UI
- May require schema definition fixes

**Estimated effort:** 4-5 hours

### Option C: Create Data Transformation Layer
**What to do:**
1. Create `transformResolverToUI()` function
2. Explicitly map UnifiedGovernanceStatus → GovernanceStatusV1
3. Document field mappings
4. Add unit tests

**Pros:**
- Explicit data transformation
- Easy to debug
- Clear contracts

**Cons:**
- More code
- Dual schema maintenance

**Estimated effort:** 3-4 hours

---

## Audit Blockers

The following phases are **BLOCKED** until above decision is made:
- Phase 4: Feature-by-feature audit
- Phase 5: Comprehensive no-throw test suite
- Phase 6: Backend contract verification
- Phase 7: Build/test execution
- Phase 8: Final proof report

---

## Recommendations

### Immediate Actions (Today)
1. ✅ **Review this document with team**
2. ✅ **Choose option A, B, or C** (recommend A for minimal disruption)
3. ✅ **Assign developer to implement fix**
4. ✅ **Add integration test** between resolver and UI to prevent regression

### Next Steps (After Fix)
1. Run complete audit phases 4-8
2. Create comprehensive no-throw test suite
3. Deploy with proof document
4. Monitor export function metrics in production

### Longer Term
1. Merge GovernanceStatusV1 and UnifiedGovernanceStatus into single schema
2. Add contract tests between resolver and UI
3. Document data flow in architecture guide

---

## Evidence Files

All audit data saved to `/tmp/`:
- `dashboard_audit_head.txt` — Git HEAD
- `dashboard_audit_dom_ids.txt` — 55 DOM element IDs
- `dashboard_audit_nested_reads_all.txt` — Unsafe read patterns found
- `dashboard_audit_schema_refs.txt` — Schema references
- `DASHBOARD_AUDIT_FINDINGS.md` — Detailed findings

---

## Questions for Product

1. **Was export data loss intentional?** Or should exports include real operational metrics?
2. **Which schema is the source of truth?** GovernanceStatusV1 or UnifiedGovernanceStatus?
3. **Timeline:** Can this be fixed before production deployment?

---

**Status:** Awaiting product decision on option A/B/C to continue audit.
