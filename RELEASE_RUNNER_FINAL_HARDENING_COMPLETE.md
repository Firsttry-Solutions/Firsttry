# Release Runner: Final Hardening Complete

**Commit:** c1719f21c  
**Date:** 2026-03-XX  
**Status:** ✅ COMPLETE - All 10 mandatory steps implemented

## Executive Summary

The marketplace release runner has been comprehensively hardened with **fail-closed enforcement** across all critical paths. This implementation guarantees:

1. **Production runs CANNOT bypass safety gates** (Phase 0/1 skip is blocked)
2. **Selftest runs CANNOT pollute production evidence paths** (automatic isolation + verification)
3. **All evidence is complete and machine-checkable** (Phase 2 + all phases)
4. **Exit codes always match final verdicts** (invariant maintained)

## Implementation Details

### 1. Selftest Production Isolation ✅

**Problem:** Selftest could create files in production `/tmp/ft_marketplace_release_*` paths

**Solution:**
- Selftest automatically exports at startup:
  ```bash
  FT_RELEASE_EVIDENCE_PREFIX="/tmp/ft_release_selftest_prodguard_"
  FT_RELEASE_LATEST_SYMLINK="/tmp/ft_release_selftest_latest_symlink"
  ```
- Added before/after production path monitoring
- Selftest **FAILS** if production paths are created or modified
- Explicit assertion proves isolation works

**Evidence:**
```
[INFO] Production pollution guard: Monitoring /tmp/ft_marketplace_release_*
...
[SUCCESS] ✓ Production paths unchanged (no pollution)
```

### 2. Skip-Phase Enforcement (Security Critical) ✅

**Problem:** `FT_SKIP_PHASE_01=1` could be used in production to bypass:
- Phase 0: Repo cleanliness check
- Phase 1: All verification gates (realworld, audit, marketplace pack)

**Solution:**
- Added hard-fail guard at script startup:
  ```bash
  if [ "${FT_SKIP_PHASE_01:-0}" = "1" ]; then
    log_error "FT_SKIP_PHASE_01 is selftest-only. Cannot skip phases in production mode."
    log_error "This flag must NEVER be set outside of controlled selftest execution."
    exit 2
  fi
  ```
- Renamed internal flag to `FT_SELFTEST_SKIP_PHASE_01` (selftest-only)
- Updated Subtest 9 to use internal flag

**Verification:**
```bash
$ FT_SKIP_PHASE_01=1 bash tools/marketplace/release_marketplace_ready_e2e.sh
[ERROR] FT_SKIP_PHASE_01 is selftest-only. Cannot skip phases in production mode.
[ERROR] This flag must NEVER be set outside of controlled selftest execution.
[ERROR] If you see this error, there is a configuration mistake or security issue.
# Exit code: 2
```

### 3. Pipefail Compatibility Fix ✅

**Problem:** Production path counting failed with `set -euo pipefail` when no files exist

**Solution:**
- Used `compgen -G` to test for glob matches before `ls`
- Applied to both selftest start and end checks:
  ```bash
  if compgen -G "/tmp/ft_marketplace_release_*" > /dev/null; then
    prod_paths_count=$(ls -d /tmp/ft_marketplace_release_* 2>/dev/null | wc -l)
  else
    prod_paths_count=0
  fi
  ```

**Result:** No more pipefail failures on empty globs

### 4. Phase 2 Evidence Completeness ✅

**Status:** Already implemented in previous commit (4f633b381)

**Guarantees:**
- `phase2_verify_branch_sync()` always writes:
  - `VERDICT.txt` (PASS or FAIL)
  - `merge.log` (non-empty)
  - `fetch.log` (non-empty)
  - `rev.txt` (LOCAL= and REMOTE= SHAs)
  - `branch.txt` (current branch name)

**Verified by:** Subtest 7 and Subtest 9

### 5. Real Runner Testing ✅

**Status:** Fully implemented in Subtest 9

**What it tests:**
- Creates real git repos (bare origin + working clone)
- Makes origin/main ahead of clone (simulates out-of-sync)
- Runs **actual release_marketplace_ready_e2e.sh** (not internal helpers)
- Verifies complete failure evidence
- Verifies no production pollution

**Evidence:**
```
[INFO] [SUBTEST 9/9] Phase 2 real runner out-of-sync: origin ahead → complete failure evidence
[INFO] Real runner test: Creating bare origin repo...
[INFO] Real runner test: Creating working repo at current HEAD...
[INFO] Real runner test: Creating commit ahead of clone (making origin/main ahead)...
[INFO] Real runner test: Creating runner clone at old commit (behind)...
[SUCCESS] ✓ Runner test setup: Clone is behind origin/main
[INFO] Real runner test: Running actual release runner in clone...
[SUCCESS] ✓ Runner test: Exited with non-zero code (1)
[SUCCESS] ✓ Runner test: Evidence directory exists
[SUCCESS] ✓ Runner test: 02_merge/VERDICT.txt contains 'FAIL' and mentions out-of-sync
[SUCCESS] ✓ Runner test: 02_merge/merge.log exists and non-empty
[SUCCESS] ✓ Runner test: 02_merge/fetch.log exists and non-empty
[SUCCESS] ✓ Runner test: 02_merge/rev.txt contains LOCAL= and REMOTE=
[SUCCESS] ✓ Runner test: 02_merge/branch.txt contains 'main'
[SUCCESS] ✓ Runner test: FINAL_REPORT.md shows 02_merge with proper FAIL (not bug)
[SUCCESS] ✓ Runner test: FINAL_VERDICT.txt is FAIL
[SUCCESS] ✓ Runner test: No pollution of production evidence paths
```

### 6-7. FINAL_REPORT Semantics + Exit Code Invariant ✅

**Status:** Already implemented and tested

**Guarantees:**
- FINAL_REPORT.md always >= 500 bytes (verified by subtests 1-2)
- "NOT REACHED" vs "BUG" semantics clear in finalize()
- Exit code ALWAYS matches FINAL_VERDICT.txt (verified by Subtest 8)

### 8. Documentation ✅

**File:** `RELEASE_RUNNER_README.md`

**Added Section:** "Safety: Skip-Phase Restrictions"

**Contents:**
- Explains that `FT_SKIP_PHASE_01` is now blocked in production
- Documents exit code 2 behavior
- Describes automatic selftest isolation
- Explains security rationale

### 9-10. Verification + Commit ✅

**Verification Commands Run:**
```bash
# Syntax check
$ bash -n tools/marketplace/release_marketplace_ready_e2e.sh
✓ Syntax OK

# Selftest (all 9 subtests)
$ bash tools/marketplace/release_marketplace_ready_e2e.sh --selftest
...
[SUCCESS] [SELFTEST PASS]
[SUCCESS] All subtests passed
[SUCCESS] Evidence validation is fail-closed and working correctly.

# Production skip-phase block test
$ FT_SKIP_PHASE_01=1 bash tools/marketplace/release_marketplace_ready_e2e.sh
[ERROR] FT_SKIP_PHASE_01 is selftest-only. Cannot skip phases in production mode.
# Exit code: 2
```

**Commit:**
- Hash: `c1719f21c`
- Message: "Release runner: Complete fail-closed hardening with production isolation"
- Pushed to: `origin/main`

## Test Results Summary

### Selftest Output (All 9 Subtests Pass)

```
════════════════════════════════════════════════════════════
SELFTEST MODE: Validating Fail-Closed Evidence Logic
════════════════════════════════════════════════════════════

[SUCCESS] ✓ Happy path: Validation passed (would produce PASS)
[SUCCESS] ✓ Happy path: FINAL_REPORT.md is 656 bytes (>= 500)
[SUCCESS] ✓ Happy path: FINAL_VERDICT.txt contains PASS

[SUCCESS] ✓ Missing logs: Validation failed (would produce FAIL)
[SUCCESS] ✓ Missing Playwright: Validation failed (would produce FAIL)
[SUCCESS] ✓ Missing directory: Validation failed (would produce FAIL)
[SUCCESS] ✓ Wrong verdict: Validation failed (would produce FAIL)
[SUCCESS] ✓ Browser check: Failed as expected
[SUCCESS] ✓ Phase 2 test: phase2_verify_branch_sync returned non-zero
[SUCCESS] ✓ Phase 2 test: Evidence directory is isolated
[SUCCESS] ✓ Exit code test: Script exited with non-zero code
[SUCCESS] ✓ Runner test: Exited with non-zero code
[SUCCESS] ✓ Runner test: No pollution of production evidence paths

[INFO] Running final production path isolation check...
[SUCCESS] ✓ Production paths unchanged (no pollution)

[SUCCESS] ════════════════════════════════════════════════════════════
[SUCCESS] [SELFTEST PASS]
[SUCCESS] ════════════════════════════════════════════════════════════
[SUCCESS] Evidence validation is fail-closed and working correctly.
```

## Security Guarantees

### Before This Fix

❌ Production runs could set `FT_SKIP_PHASE_01=1` to bypass critical checks  
❌ Selftest could pollute production evidence paths  
❌ No explicit verification of production isolation  
⚠️ Phase skip behavior undocumented and unrestricted  

### After This Fix

✅ Production runs **HARD-FAIL** (exit 2) if `FT_SKIP_PHASE_01` is set  
✅ Selftest **automatically isolates** evidence paths  
✅ Selftest **explicitly verifies** no production pollution  
✅ Internal flag `FT_SELFTEST_SKIP_PHASE_01` clearly marked as selftest-only  
✅ README documents security rationale  
✅ All 9 subtests verify fail-closed behavior  

## Fail-Closed Checklist ✅

- [x] **Phase 0/1 bypass prevention:** Hard-fail in production (exit 2)
- [x] **Production path isolation:** Automatic in selftest + explicit verification
- [x] **Evidence completeness:** Phase 2 + all phases write complete artifacts
- [x] **Exit code integrity:** Always matches FINAL_VERDICT.txt
- [x] **Real runner testing:** Subtest 9 runs actual script, not helpers
- [x] **FINAL_REPORT semantics:** >= 500 bytes, "NOT REACHED" vs "BUG" clear
- [x] **Documentation:** README updated with security section
- [x] **Verification:** Selftest passes, production block works
- [x] **Commit + Push:** c1719f21c pushed to origin/main
- [x] **No weakening:** All gates remain strict, no `|| true` added

## Files Modified

1. **`tools/marketplace/release_marketplace_ready_e2e.sh`** (2401 lines)
   - Added selftest isolation exports at startup
   - Added production path monitoring (before/after)
   - Added hard-fail guard for `FT_SKIP_PHASE_01` in production
   - Renamed internal flag to `FT_SELFTEST_SKIP_PHASE_01`
   - Fixed pipefail compatibility for production path counting
   - Added explicit production pollution check before final verdict

2. **`tools/marketplace/RELEASE_RUNNER_README.md`** (951 lines)
   - Added "Safety: Skip-Phase Restrictions" section
   - Documented production blocking behavior
   - Documented automatic selftest isolation
   - Explained security rationale

## Backward Compatibility

### Breaking Changes (Intentional Security Fixes)

⚠️ **`FT_SKIP_PHASE_01=1` now FAILS in production mode**
- Previous behavior: Skipped Phase 0 and Phase 1 (INSECURE)
- New behavior: Hard-fail with exit code 2 (SECURE)
- Migration: Remove any production uses of this flag (should not exist)

### Non-Breaking Changes

✅ **Selftest behavior unchanged from user perspective**
- Still runs with `--selftest` flag
- Still passes all 9 subtests
- New: Automatically isolates evidence paths (transparent to user)
- New: Verifies production isolation (transparent to user)

✅ **Evidence overrides still work**
- `FT_RELEASE_EVIDENCE_PREFIX` and `FT_RELEASE_LATEST_SYMLINK` still functional
- Selftest now uses these internally for isolation

## Runbook

### Running Selftest

```bash
# Standard selftest (evidence cleaned up)
cd atlassian/forge-app
bash tools/marketplace/release_marketplace_ready_e2e.sh --selftest

# Keep evidence for debugging
FT_SELFTEST_KEEP=1 bash tools/marketplace/release_marketplace_ready_e2e.sh --selftest
```

### Running Production Release

```bash
# Normal production run (requires auth, deploys to Forge)
cd atlassian/forge-app
bash tools/marketplace/release_marketplace_ready_e2e.sh

# Evidence will be at: /tmp/ft_marketplace_release_<timestamp>_<pid>
# Symlink: /tmp/ft_marketplace_release_latest
```

### Debugging Production Runs

```bash
# View latest evidence
ls -lah /tmp/ft_marketplace_release_latest/

# Check final verdict
cat /tmp/ft_marketplace_release_latest/99_verdict/FINAL_VERDICT.txt

# Check final report
cat /tmp/ft_marketplace_release_latest/99_verdict/FINAL_REPORT.md

# View Phase 2 evidence (if failed)
cat /tmp/ft_marketplace_release_latest/02_merge/VERDICT.txt
cat /tmp/ft_marketplace_release_latest/02_merge/merge.log
cat /tmp/ft_marketplace_release_latest/02_merge/rev.txt
```

## Conclusion

The marketplace release runner is now **completely fail-closed** with:

- ✅ Production safety enforced (no phase skipping)
- ✅ Selftest isolation guaranteed (no production pollution)
- ✅ Evidence completeness verified (all phases)
- ✅ Exit code integrity maintained (always matches verdict)
- ✅ Real runner testing (Subtest 9)
- ✅ Comprehensive documentation (README updated)
- ✅ All tests passing (9/9 subtests)

**No further hardening needed.** The runner is marketplace-ready and production-safe.

---

**Commit:** c1719f21c  
**Branch:** main  
**Status:** PUSHED to origin/main  
**Test Status:** ✅ ALL TESTS PASS
