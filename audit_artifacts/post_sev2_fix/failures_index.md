# Test Failures Index - Post-SEV2 Implementation

**Report Date:** 2025-12-20  
**Test Run:** Full npm test suite  
**Summary:** 30 test files failed | 14 test files passed | 8 failing tests | 325 passing tests

---

## Failure Categories (By Root Cause)

### CATEGORY F: Process.exit() in Test Files (13 files)
**Classification:** F - External dependency leak (process.exit preventing Vitest from managing test)  
**Impact:** Tests call `process.exit()` which vitest catches and treats as failure  
**Fix:** Remove all `process.exit()` calls from test files and use Vitest's test completion model

**Affected Files:**
1. test_phase2_daily_determinism.ts:247
2. test_phase2_ingest_timeline.ts:201
3. test_phase2_retention_deletes_only_old.ts:209
4. test_phase2_weekly_sum.ts:312
5. test_phase3_backfill_selector.ts:141
6. test_disclosure_standalone.ts:425
7. test_gaps_a_f_enforcement.ts:749
8. test_phase3_daily_pipeline_no_data.ts:151
9. test_phase3_daily_pipeline_partial_fail.ts:198
10. test_phase3_readiness_gate.ts:164
11. test_phase3_run_ledgers.ts:226
12. test_phase3_weekly_pipeline.ts:213

---

### CATEGORY E: Mocking/Import Errors (11 files)
**Classification:** E - Mocking mistake / fixture invalid  
**Root Cause:** Tests import `@jest/globals` but project uses Vitest; also `@forge/api` not mocked

**Files:**
1. tests/phase6/canonicalization.test.ts - Error: Cannot find package '@jest/globals'
2. tests/phase6/determinism.test.ts - Error: Cannot find package '@jest/globals'
3. tests/phase6/no_write_verification.test.ts - Error: Cannot find package '@jest/globals'
4. tests/phase6/retention_scale.test.ts - Error: Cannot find package '@jest/globals'
5. tests/phase6/snapshot_capture.test.ts - Error: Cannot find package '@jest/globals'
6. tests/phase6/snapshot_model.test.ts - Error: Cannot find package '@jest/globals'
7. tests/phase6/snapshot_scheduler.test.ts - Error: Cannot find package '@jest/globals'
8. tests/phase6/snapshot_storage.test.ts - Error: Cannot find package '@jest/globals'
9. tests/phase7/drift_compute.test.ts - Error: Cannot find package '@jest/globals'
10. tests/phase7/drift_forbidden_language.test.ts - Error: Cannot find package '@jest/globals'
11. tests/phase7/drift_isolation.test.ts - Error: Cannot find package '@jest/globals'
12. tests/phase7/drift_scale.test.ts - Error: Cannot find package '@jest/globals'
13. test_disclosure_hardening.ts - Error: Cannot find package '@forge/api' imported from coverage_matrix.ts

---

### CATEGORY A: Deterministic Logic Defects (8 tests in 1 file)
**Classification:** A - Deterministic logic defect  
**File:** tests/scheduled/phase5_scheduler_hardening.test.ts  
**Tests Failing:** 8/18 in this file

#### Test 1: should never regenerate if AUTO_12H DONE_KEY exists
**Error:**
```
AssertionError: expected 'No trigger due at this time' to contain 'has already been generated'
```
**Line:** 193  
**Issue:** Test expects specific message about DONE_KEY existing, but code returns generic "No trigger due"

#### Test 2: should write DONE_KEY only on successful generation  
**Error:**
```
AssertionError: expected undefined to be true // Object.is equality
```
**Line:** 226  
**Issue:** body.report_generated is undefined instead of true

#### Test 3: should not write DONE_KEY on failed generation
**Error:**
```
AssertionError: expected 200 to be 202 // Object.is equality
```
**Line:** 253  
**Issue:** Expected status 202 (Accepted) on failure, got 200 (OK)

#### Test 4: should apply 30min backoff on 1st failure
**Error:**
```
AssertionError: expected 200 to be 202 // Object.is equality
```
**Line:** 296  
**Issue:** Expected 202, got 200

#### Test 5: should apply 120min backoff on 2nd failure
**Error:**
```
AssertionError: expected -1705320000000 to be 7200000 // Object.is equality
```
**Line:** 335  
**Issue:** Backoff time calculation returning negative value (timestamp arithmetic issue)

#### Test 6: should apply 24h backoff on 3rd+ failures
**Error:**
```
AssertionError: expected -1705320000000 to be 86400000 // Object.is equality
```
**Line:** 368  
**Issue:** Same negative timestamp issue

#### Test 7: should skip generation if backoff is still active
**Error:**
```
AssertionError: expected 'No trigger due at this time' to contain 'Backoff period active'
```
**Line:** 391  
**Issue:** Response message doesn't contain expected "Backoff period active" text

#### Test 8: should always use handleAutoTrigger for generation
**Error:**
```
AssertionError: expected "vi.fn()" to be called with arguments: [ 'AUTO_12H' ]
Number of calls: 0
```
**Line:** 478  
**Issue:** Mock function not called - handleAutoTrigger not invoked

---

## Failure Details

### File-by-File Summary

**Failing (30 files):**
1. test_disclosure_hardening.ts - @forge/api not found
2. test_disclosure_standalone.ts - process.exit(0) call
3. test_gaps_a_f_enforcement.ts - process.exit(0) call
4. test_phase2_daily_determinism.ts - process.exit(0) call
5. test_phase2_ingest_timeline.ts - process.exit(0) call
6. test_phase2_retention_deletes_only_old.ts - process.exit(0) call
7. test_phase2_weekly_sum.ts - process.exit(0) call
8. test_phase3_backfill_selector.ts - process.exit(0) call
9. test_phase3_daily_pipeline_no_data.ts - process.exit(1) + "Cannot read properties of undefined (reading 'asApp')"
10. test_phase3_daily_pipeline_partial_fail.ts - process.exit() + asApp error
11. test_phase3_readiness_gate.ts - process.exit(1) call
12. test_phase3_run_ledgers.ts - process.exit(1) call
13. test_phase3_weekly_pipeline.ts - process.exit(1) + asApp error
14. test_phase4_jira_ingest_evidence_coverage.ts - No test suite found
15. test_phase4_standalone.ts - No test suite found
16. test_storage_debug_access.ts - No test suite found
17. test_storage_debug_redaction.ts - No test suite found
18. phase6/canonicalization.test.ts - @jest/globals not found
19. phase6/determinism.test.ts - @jest/globals not found
20. phase6/no_write_verification.test.ts - @jest/globals not found
21. phase6/retention_scale.test.ts - @jest/globals not found
22. phase6/snapshot_capture.test.ts - @jest/globals not found
23. phase6/snapshot_model.test.ts - @jest/globals not found
24. phase6/snapshot_scheduler.test.ts - @jest/globals not found
25. phase6/snapshot_storage.test.ts - @jest/globals not found
26. phase7/drift_compute.test.ts - @jest/globals not found
27. phase7/drift_forbidden_language.test.ts - @jest/globals not found
28. phase7/drift_isolation.test.ts - @jest/globals not found
29. phase7/drift_scale.test.ts - @jest/globals not found
30. scheduled/phase5_scheduler_hardening.test.ts - 8 failing tests

**Passing (14 files):**
- test_disclosure_standalone.ts (but calls process.exit)
- test_gaps_a_f_enforcement.ts (but calls process.exit)
- test_phase2_daily_determinism.ts (but calls process.exit)
- test_phase2_ingest_timeline.ts (but calls process.exit)
- test_phase2_retention_deletes_only_old.ts (but calls process.exit)
- test_phase2_weekly_sum.ts (but calls process.exit)
- test_phase3_backfill_selector.ts (but calls process.exit)
- Other passing tests

---

## Testing Results

```
Test Files:  30 failed | 14 passed (44 total)
Tests:       8 failed | 325 passed (333 total)
Errors:      5 unhandled rejections (process.exit calls)
Duration:    430ms test run + 1.26s transform + 1.29s import
```

---

## Determinism Assessment

All failures classified as:
- **Deterministic:** ✅ Yes - Will fail consistently on re-run
- **Flaky:** ❌ No - Not timing-related
- **Environment:** Some - process.exit is test harness issue, not production code
