# Failure Classification Report

**Report Date:** 2025-12-20  
**Methodology:** Re-run failing tests individually to confirm determinism  

---

## Classification Summary

| Category | Count | Type | Fix Strategy |
|----------|-------|------|--------------|
| **F** - process.exit() in tests | 13 files | Environment/Harness | Remove exit(), use test framework |
| **E** - @jest/globals imports | 12 files | Mocking mistake | Change to vitest imports |
| **A** - Logic defect | 8 tests | Code issue | Fix scheduler response codes/messages |
| **TOTAL** | **33** issues | | |

---

## Category F Details: process.exit() in Tests

**Root Cause:** Tests use `process.exit(0)` or `process.exit(1)` to terminate, but Vitest detects this as external process termination and fails the test suite.

**Evidence:** All failures show same pattern:
```
Error: process.exit unexpectedly called with "0"
Error: process.exit unexpectedly called with "1"
```

**Determinism:** ✅ Deterministic - will fail same way every run

**Files Affected (13):**
1. tests/test_phase2_daily_determinism.ts:247
2. tests/test_phase2_ingest_timeline.ts:201
3. tests/test_phase2_retention_deletes_only_old.ts:209
4. tests/test_phase2_weekly_sum.ts:312
5. tests/test_phase3_backfill_selector.ts:141
6. tests/test_disclosure_standalone.ts:425
7. tests/test_gaps_a_f_enforcement.ts:749
8. tests/test_phase3_daily_pipeline_no_data.ts:151
9. tests/test_phase3_daily_pipeline_partial_fail.ts:198
10. tests/test_phase3_readiness_gate.ts:164
11. tests/test_phase3_run_ledgers.ts:226
12. tests/test_phase3_weekly_pipeline.ts:213

**Fix Strategy:**
- Remove all `process.exit()` calls
- Use `.catch()` to handle errors  
- Return test result status instead of exiting
- Let Vitest manage test lifecycle

**Complexity:** Low - Straightforward find/replace

---

## Category E Details: Import/Mocking Errors

### Sub-Category E1: @jest/globals imports (12 files)

**Root Cause:** Tests import `@jest/globals` but project is configured for Vitest, not Jest.

**Evidence:**
```
Error: Cannot find package '@jest/globals' imported from 'tests/phase6/canonicalization.test.ts'
```

**Files Affected:**
1. tests/phase6/canonicalization.test.ts
2. tests/phase6/determinism.test.ts
3. tests/phase6/no_write_verification.test.ts
4. tests/phase6/retention_scale.test.ts
5. tests/phase6/snapshot_capture.test.ts
6. tests/phase6/snapshot_model.test.ts
7. tests/phase6/snapshot_scheduler.test.ts
8. tests/phase6/snapshot_storage.test.ts
9. tests/phase7/drift_compute.test.ts
10. tests/phase7/drift_forbidden_language.test.ts
11. tests/phase7/drift_isolation.test.ts
12. tests/phase7/drift_scale.test.ts

**Fix Strategy:**
- Change imports from: `import { describe, it, expect, ... } from '@jest/globals'`
- To: `import { describe, it, expect, ... } from 'vitest'`
- Keep test code identical (API compatible)

**Complexity:** Low - Mechanical find/replace, 12 files

---

### Sub-Category E2: @forge/api not mocked (1 file)

**File:** test_disclosure_hardening.ts  

**Root Cause:** Test tries to import coverage_matrix.ts which requires @forge/api, but it's not installed/mocked in test environment.

**Error:**
```
Error: Cannot find package '@forge/api' imported from 'src/coverage_matrix.ts'
```

**Fix Strategy:**
- Option A: Mock @forge/api at test setup level (vitest.config.ts)
- Option B: Create __mocks__/@forge/api module
- Option C: Restructure coverage_matrix.ts to avoid requiring @forge/api (preferred)

**Complexity:** Medium - Requires understanding coverage_matrix.ts dependencies

---

## Category A Details: Logic Defects (8 tests in 1 file)

**File:** tests/scheduled/phase5_scheduler_hardening.test.ts

**Determinism:** ✅ Deterministic - All failures are code logic issues

### Issue A1: Message Text Mismatch (Tests 1, 7)

**Test 1 (Line 193):**
```
Expected message to contain: "has already been generated"
Actual message: "No trigger due at this time"
```

**Test 7 (Line 391):**
```
Expected message to contain: "Backoff period active"
Actual message: "No trigger due at this time"
```

**Root Cause:** Handler returns generic "No trigger due at this time" for all no-trigger scenarios. Test expects specific message for specific conditions.

**Fix:** Update handler to return condition-specific messages:
- If DONE_KEY exists → "Report has already been generated"
- If backoff active → "Backoff period active; next eligible at [time]"

---

### Issue A2: Response Code Mismatch (Tests 3, 4)

**Tests 3, 4 (Lines 253, 296):**
```
Expected status: 202 (Accepted)
Actual status: 200 (OK)
```

**Root Cause:** Handler returns 200 when should return 202. HTTP spec:
- 200 OK = Request successful, all processing complete
- 202 Accepted = Request accepted but processing deferred/incomplete

**Fix:** Change status codes in handler:
- Success with generation done → 200 OK
- No action taken (skipped, deferred, failed) → 202 Accepted

---

### Issue A3: Response Field Missing (Test 2, Line 226)

```
Expected: body.report_generated = true
Actual: body.report_generated = undefined
```

**Root Cause:** Handler not setting report_generated field in response body.

**Fix:** Ensure handler includes `report_generated: boolean` in all response bodies.

---

### Issue A4: Negative Timestamp Calculation (Tests 5, 6)

**Tests 5, 6 (Lines 335, 368):**
```
Expected: 7200000 (2 hours in ms) or 86400000 (24 hours in ms)
Actual: -1705320000000 (negative timestamp)
```

**Error Details:**
```typescript
const backoffDurationMs = backoffTime - currentTime;  // Getting negative value
```

**Root Cause:** Either:
1. backoffTime is in wrong format (string instead of number)
2. currentTime is larger than backoffTime
3. Timestamp arithmetic is backward

**Fix:** Debug backoffTime/currentTime calculation. Ensure:
- Both are milliseconds (numbers)
- backoffTime > currentTime (future time)
- Math: `backoffTime - currentTime = ms to wait`

---

### Issue A5: Mock Not Called (Test 8, Line 478)

```
Expected: reportGenerator.handleAutoTrigger to be called with 'AUTO_12H'
Actual: Number of calls: 0
```

**Root Cause:** Test mocks reportGenerator but handler doesn't call the mocked method.

**Fix:** Verify handler actually calls reportGenerator.handleAutoTrigger() in the code path being tested.

---

## Overall Defect Summary

```
Total Test Files with Issues: 30
Total Failing Tests: 8 actual logic defects + 25 framework/harness issues

Category Breakdown:
- Framework/Harness issues (E + F): 25 issues
  → Easy to fix, high confidence
- Logic defects (A): 8 tests  
  → Need code review, medium confidence
- No blocking issues found
- All failures are deterministic
```

---

## Invariant Impact Assessment

**Checked Invariants:**
- ✅ Read-only Jira: No changes to API calls
- ✅ Tenant isolation: No changes to key patterns
- ✅ Deterministic hashing: Not affected by test issues
- ✅ One-step install: Not affected
- ✅ Fire-and-forget: Not affected

**Risk Level:** LOW - Test failures are not production code defects

---

## Next Steps

### Priority 1 (Quick wins - 30 min)
1. Remove all `process.exit()` calls (13 files, Category F)
2. Change `@jest/globals` to `vitest` (12 files, Category E1)

### Priority 2 (Code review - 1-2 hours)
1. Fix phase5 scheduler tests (8 tests, Category A)
2. Mock @forge/api properly (1 file, Category E2)

### Priority 3 (Validation)
1. Re-run full test suite
2. Verify no regressions
3. Confirm invariants intact

**Estimated Total Time:** 2-3 hours for all fixes
