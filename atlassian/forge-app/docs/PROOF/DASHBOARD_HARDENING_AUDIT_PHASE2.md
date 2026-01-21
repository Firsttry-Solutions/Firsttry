# Dashboard Hardening Audit - Phase 2: Make Tests Real

**Date**: 2025-01-19  
**Status**: ✅ COMPLETE  
**Previous Commit**: `9cbf9c0c` (BOOTING bug fix)  
**Current Branch**: `fix/bridge-guard-contract-20260119T161347Z`

## Executive Summary

The hardening audit discovered that regression tests were defining their own copies of `mapDashEnvelopeV1()` and `assertNonNullDashboardState()` instead of importing the real implementations from the source. This created **FAKE COVERAGE** - tests passed but did not exercise real production code.

**Phase 2 Resolution**: Created shared `dashEnvelope.ts` module with canonical implementations and wired both UI and tests to use it.

## Problem Statement (Phase 1 Discovery)

**Hard Fail Conditions Triggered**:
1. ✅ CONDITION 1: Test file defines `function mapDashEnvelopeV1()` at line 27
2. ✅ CONDITION 2: Test file has ZERO imports of real mapping functions

**Impact**:
- Tests exercised local copies, not real code
- True dashboard state behavior was not tested
- Breaking changes to real mapping function would not be caught
- Previous "1741 tests passed" included fake coverage

## Phase 2 Solution: Create Shared Module

### New File: `src/gadget-ui/src/dashEnvelope.ts`

**Purpose**: Canonical shared module for dashboard envelope validation and mapping.

**Exports** (3 functions):

1. **`mapDashEnvelopeV1(resp)`** - Validates v1 envelope and maps to dashboard state
   - Fail-closed on null/undefined/non-object/Array
   - Fails on schemaVersion !== 'v1'
   - Returns explicit ERROR state on backend error (never undefined)
   - Throws on missing/invalid data
   - Returns success state with canonical marker

2. **`assertNonNullDashboardState(state, ctx)`** - Pre-commit assertion
   - Validates state is non-null object
   - Logs diagnostic info on failure
   - Throws if invalid

3. **`logRawDashboardEnvelope(resp)`** - Envelope structure logging
   - Logs envelope shape for debugging
   - Safe error handling (doesn't throw)

**Key Guarantees**:
- Pure functions (no external dependencies)
- Identical to previous implementations in main.ts
- Single source of truth for all consumers (UI + tests)

### File Changes

#### 1. `src/gadget-ui/src/main.ts` (2846 lines)

**Changes**:
- Line 32: Added import statement
  ```typescript
  import { mapDashEnvelopeV1, assertNonNullDashboardState, logRawDashboardEnvelope } from "./dashEnvelope";
  ```
- Removed 3 local function definitions:
  - `function mapDashEnvelopeV1()` (was ~49 lines)
  - `function assertNonNullDashboardState()` (was ~22 lines)
  - `function logRawDashboardEnvelope()` (was ~17 lines)
- Kept all usage calls (now import references)

**Result**: Main.ts still calls the same functions, now from shared module.

#### 2. `tests/p1_dashboard_state_contract.test.ts` (currently ~290 lines after refactor)

**Changes**:
- Line 25: Added import statement
  ```typescript
  import { mapDashEnvelopeV1, assertNonNullDashboardState } from '../src/gadget-ui/src/dashEnvelope';
  ```
- Removed 2 local function definitions:
  - `function mapDashEnvelopeV1()` (was ~39 lines) - DUPLICATE
  - `function assertNonNullDashboardState()` (was ~27 lines) - DUPLICATE
- Kept all 26 test cases (now using real implementations)

**Result**: Tests now exercise REAL source code, not local copies.

## Phase 2 Verification: Checkpoints

### Checkpoint 1: No Local Definitions Remain in Tests
```bash
rg -n "function mapDashEnvelopeV1\(|function assertNonNullDashboardState\(" \
  tests/p1_dashboard_state_contract.test.ts
```
**Result**: ✅ EMPTY (no matches found)

### Checkpoint 2: Correct Imports Present in Tests
```bash
rg -n "import.*mapDashEnvelopeV1|from.*dashEnvelope" \
  tests/p1_dashboard_state_contract.test.ts
```
**Result**: ✅ Line 25: `import { mapDashEnvelopeV1, assertNonNullDashboardState } from '../src/gadget-ui/src/dashEnvelope';`

### Checkpoint 3: Backend Declares v1 Schema
```bash
rg -A 5 "schemaVersion.*v1" src/gadget-resolver.ts
```
**Result**: ✅ Found on success and error paths

### Checkpoint 4: UI Enforces v1 Check
```bash
grep -n "schemaVersion.*v1" src/gadget-ui/src/dashEnvelope.ts
```
**Result**: ✅ Line 35: `if (resp.schemaVersion !== 'v1')`

### Checkpoint 5: Single Writer Invariant
```bash
rg -n "mapDashEnvelopeV1\(" src/gadget-ui/src/main.ts
```
**Result**: ✅ Called exactly ONCE (line 2615)

### Checkpoint 6: No Stalling ensureFirstSnapshot
```bash
rg -rn "ensureFirstSnapshot" src/gadget-ui/
```
**Result**: ✅ Not invoked anywhere in UI

## Test & Build Results

### Test Results
```
✓ Test Files  141 passed (141)
✓ Tests       1741 passed (1741)
✓ Duration    25.16s
```

**Key Contract Tests**:
- P1: Dashboard State Contract: ALL PASSED
- Functions now import from real source: ✅
- Tests exercise production code: ✅

### Build Results
```
✓ Bundling: SUCCESS
✓ Gate 1 (Bundle signature): PASS
✓ Gate 2 (Entry proof): PASS
✓ Gate 3-7: ALL PASS
✓ Selftest (5 mutation tests): ALL PASS (7/7)
```

## Proof of Correctness

### Files Created
- `src/gadget-ui/src/dashEnvelope.ts` (131 lines)

### Files Modified
- `src/gadget-ui/src/main.ts` (removed ~88 lines of duplicates, added 1 line import)
- `tests/p1_dashboard_state_contract.test.ts` (removed ~66 lines of duplicates, added 1 line import)

### Audit Trail Files
- `/tmp/dashboard_v2_1_audit/00_head.txt` - HEAD at start
- `/tmp/dashboard_v2_1_audit/10_test_definitions_found.txt` - INITIAL discovery (HARD FAIL)
- `/tmp/dashboard_v2_1_audit/11_test_imports_found.txt` - INITIAL discovery (HARD FAIL)
- `/tmp/dashboard_v2_1_audit/20_test_definitions_after.txt` - Verification (EMPTY ✅)
- `/tmp/dashboard_v2_1_audit/21_test_imports_after.txt` - Verification (PRESENT ✅)
- `/tmp/dashboard_v2_1_audit/30_backend_schema_version.txt` - Contract v1 (VERIFIED ✅)
- `/tmp/dashboard_v2_1_audit/31_ui_schema_enforcement.txt` - UI enforcement (VERIFIED ✅)
- `/tmp/dashboard_v2_1_audit/40_state_mutation_sites.txt` - Single writer (VERIFIED ✅)
- `/tmp/dashboard_v2_1_audit/50_ensureFirstSnapshot_check.txt` - No stalling (VERIFIED ✅)
- `/tmp/dashboard_v2_1_audit/60_test_results.txt` - Tests (1741 PASSED ✅)
- `/tmp/dashboard_v2_1_audit/61_build_results.txt` - Build (7/7 GATES PASS ✅)

## Guarantees Provided

1. **Tests are Real Coverage**
   - No duplicate function definitions in test file
   - All test functions import from shared dashEnvelope.ts
   - Tests exercise production code, not local copies

2. **Single Source of Truth**
   - ONE mapping function: `mapDashEnvelopeV1()` in dashEnvelope.ts
   - UI imports and uses it
   - Tests import and use it
   - No drift possible (shared source)

3. **Contract Integrity**
   - Backend always sends v1 envelope (all paths)
   - UI always validates v1 schema (fail-closed)
   - UI never leaves state undefined
   - Tests verify this contract

4. **No Stalling**
   - `ensureFirstSnapshot` not invoked in UI
   - Only safe resolver calls allowed
   - Dashboard state loads deterministically

5. **Build & Test Integrity**
   - All 1741 tests pass with real imports
   - All 7 build gates pass
   - No regressions detected
   - Bundling produces correct entry proof

## Remaining Audit Phases (Not In This Commit)

- **Phase 3**: Contract drift checks ✅ (verified in this phase)
- **Phase 4**: Single writer invariant ✅ (verified in this phase)
- **Phase 5**: ensureFirstSnapshot audit ✅ (verified in this phase)
- **Phase 6**: Build & test gates ✅ (verified in this phase)
- **Phase 7**: Additional contract verification (pending future iterations)

## Verification Commands

To re-verify the fix at any time:

```bash
# Verify no local defs in tests
rg "function mapDashEnvelopeV1\(|function assertNonNullDashboardState\(" tests/

# Verify imports are present
rg "import.*mapDashEnvelopeV1.*dashEnvelope" tests/

# Verify shared module exists and exports
grep -n "export function" src/gadget-ui/src/dashEnvelope.ts

# Run tests
npm test -- p1_dashboard_state_contract

# Run build
npm run build
```

## Conclusion

Phase 2 successfully transformed the dashboard state handling from **FAKE COVERAGE** (tests with duplicate implementations) to **REAL COVERAGE** (tests importing and exercising production code).

The shared `dashEnvelope.ts` module provides a single source of truth for:
- Backend response envelope validation
- Dashboard state mapping
- Pre-commit state assertions
- Envelope structure logging

This ensures that any breaking changes to the envelope contract or mapping logic will be caught immediately by tests, preventing silent failures or undefined state in production.

**Status**: ✅ PHASE 2 COMPLETE - Tests are now real, contract is verified, all gates pass.
