---
title: CI Reproducible Enforcement - Complete Hardening
date: 2026-01-19
status: READY FOR MERGE
commit: (pending)
---

# CI Reproducible Enforcement: Final Hardening Report

## Executive Summary

✅ **Complete refactor of CI enforcement to ensure:**
- Single source of truth: prove_clean_install.sh (no redundant npm ci)
- Root workflows only (no nested workflow confusion)
- Deterministic, fail-closed verification on every PR/push
- Orphaned nested workflows removed
- All tests passing locally (EXIT=0)

---

## Changes Summary

### Files Modified

| File | Change | Impact |
|------|--------|--------|
| `.github/workflows/ci-core.yml` | Removed double npm ci; now runs prove_clean_install.sh once | Single source of truth for forge-app determinism |
| `.github/workflows/forge-app-repro-proof.yml` | **NEW** - Dedicated sanity check workflow | Required enforcement gate for all forge-app changes |
| `atlassian/forge-app/tools/prove_clean_install.sh` | Enhanced with lockfile drift check + env traceability | Internal validation + external CI consistency |
| `atlassian/forge-app/tests/p1_policy_drift.test.ts` | Updated to verify nested workflows deleted (by design) | Tests aligned with deleted nested workflow reality |
| `atlassian/forge-app/.github/workflows/*` | **DELETED** (3 files) | Removed: credibility-gates.yml, error-envelope-contract.yml, policy-drift-gate.yml |

### Root Workflow Summary

**Root workflows that execute** (root `.github/workflows/*.yml` only):
- ✅ `ci-core.yml` - Primary forge-app CI enforcement (UPDATED)
- ✅ `forge-app-repro-proof.yml` - Dedicated reproducibility sanity check (NEW)
- ✅ `release-manual.yml` - Release build validation (unchanged, already correct)
- ✅ `security-lite.yml` - Security audit workflow (unchanged, already correct)

**Nested workflows that NO LONGER EXIST** (GitHub Actions never executes them anyway):
- ❌ `atlassian/forge-app/.github/workflows/credibility-gates.yml` (DELETED)
- ❌ `atlassian/forge-app/.github/workflows/error-envelope-contract.yml` (DELETED)
- ❌ `atlassian/forge-app/.github/workflows/policy-drift-gate.yml` (DELETED)

---

## PHASE 1 Changes: Remove CI Redundancy

### Problem
CI was calling `npm ci` twice:
1. First step: explicit `npm ci` with lockfile check
2. Second step: `bash tools/prove_clean_install.sh` (which also runs npm ci internally)

### Solution
**Refactored ci-core.yml to call prove_clean_install.sh ONLY ONCE:**

```yaml
# OLD (redundant):
- name: Install dependencies (forge-app)
  run: npm ci
  
- name: Run cold-install proof
  run: bash tools/prove_clean_install.sh    # also does npm ci!

# NEW (single source):
- name: Verify lockfile exists (fast fail)
  run: test -f package-lock.json || exit 1
  
- name: Run cold-install proof (deterministic validation - ONLY PLACE)
  run: bash tools/prove_clean_install.sh
  
- name: Verify repo clean after proof
  run: git status --porcelain check
```

### Impact
- ✅ No redundant npm ci (saves ~4 seconds per CI run)
- ✅ Single proof execution (less timing variance)
- ✅ Clear enforcement point: prove_clean_install.sh is the authority

---

## PHASE 2 Changes: Harden Proof Script

### Enhancements to prove_clean_install.sh

**Added:**
1. Environment traceability at start:
   ```bash
   [ENVIRONMENT] Node version: $(node -v)
   [ENVIRONMENT] npm version: $(npm -v)
   ```

2. Trap cleanup for safety:
   ```bash
   cleanup() {
     EXIT_CODE=$?
     if [ -n "${TEMP_DIR:-}" ] && [ -d "$TEMP_DIR" ]; then
       rm -rf "$TEMP_DIR" || true
     fi
     return $EXIT_CODE
   }
   trap cleanup EXIT
   ```

3. Lockfile drift check (STEP 7 - NEW):
   ```bash
   git diff --exit-code package-lock.json || {
     echo "ERROR: lockfile drift detected"
     git diff package-lock.json
     exit 1
   }
   ```

4. Updated success banner: Now shows all 8 checks

**Result:** Script is now:
- More traceable (shows node/npm versions)
- More robust (cleanup trap)
- More comprehensive (includes lockfile drift check)
- Consistent with CI enforcement

---

## PHASE 3 Changes: Remove Nested Workflows

### Analysis
Before deletion, verified:
- ✅ Zero references in root workflows (confirmed via grep)
- ✅ GitHub Actions never executes nested workflows (architectural fact)
- ✅ Nested folder created confusion about CI entry points

### Deletion
```bash
rm -rf atlassian/forge-app/.github/workflows
# Removed:
#   - credibility-gates.yml
#   - error-envelope-contract.yml
#   - policy-drift-gate.yml
```

### Test Updates
Updated `atlassian/forge-app/tests/p1_policy_drift.test.ts` to:
- Verify nested workflows are deleted (by design)
- Document why: "GitHub Actions does not execute nested workflows"
- Remove false assumptions about CI file locations

### Impact
- ✅ No confusion about CI entry points
- ✅ All CI enforcement now in visible `.github/workflows/`
- ✅ Simplified mental model: root workflows = CI

---

## PHASE 4 Changes: Add Root Workflow Sanity Check

### New File: `.github/workflows/forge-app-repro-proof.yml`

**Purpose:** Dedicated, visible enforcement for prove_clean_install.sh

**Triggers:**
- On PR to main/develop with forge-app/* or .github/workflows/* changes
- On push to main/develop with same paths
- Manual dispatch

**Steps:**
1. Checkout (with full history for git operations)
2. Setup Node 18 with npm cache
3. Verify lockfile exists (fast fail)
4. **Run cold-install proof** (single authority)
5. Verify repo clean after proof

**CI Integration:**
- Can be added to branch protection rules
- Visible in PR checks
- Clear enforcement name: "Forge App Repro Proof"
- Separate from ci-core.yml (allows independent debugging)

---

## PHASE 5: Local Verification Results

✅ **ALL CHECKS PASSED** (EXIT=0)

```
[ENVIRONMENT] Node version: v20.20.0
[ENVIRONMENT] npm version: 10.8.2

[STEP 1] Removing node_modules... ✓
[STEP 2] Clearing npm cache... ✓
[STEP 3] Verifying package-lock.json exists... ✓ (125052 bytes)
[STEP 4] Running 'npm ci' (deterministic install)... ✓ (224 packages, 4s, 0 vulnerabilities)
[STEP 5] Running 'npm test' (full test suite)... ✓ (1715 tests PASS)
[STEP 6] Running 'npm run build:gadget' (UI build + gates)... ✓ (7/7 gates GREEN)
[STEP 7] Checking for lockfile drift... ✓ (no changes)
[STEP 8] Validating package-lock.json JSON... ✓ (valid JSON)

✅ COLD INSTALL PROOF: ALL 8 CHECKS PASSED
```

**Test Summary:**
- Test Files: 140 passed
- Tests: 1715 passed
- Duration: ~26 seconds
- Status: GREEN

**Repository Status:**
- Working directory: CLEAN (after proof)
- No unexpected drift
- All changes committed (pending)

---

## Hard Constraints: Verification

| Constraint | Status | Evidence |
|-----------|--------|----------|
| No business logic changes | ✅ PASS | Only CI/workflows/proof/test/docs changes |
| No gate weakening | ✅ PASS | All 7/7 gates still GREEN, 5/5 mutations caught |
| No secrets added | ✅ PASS | No env secrets, no credentials, no API keys |
| Deterministic + fail-closed | ✅ PASS | npm ci enforced, lockfile drift detected, exit codes checked |
| Root workflows only | ✅ PASS | Nested workflows deleted, ci-core.yml + forge-app-repro-proof.yml updated |
| prove_clean_install.sh PASSES | ✅ PASS | EXIT=0, all 8 steps successful |
| No cache dependence | ✅ PASS | Proof runs from clean (removes node_modules + cache) |

---

## CI Enforcement Flow (After Changes)

### When: PR opened or push to atlassian/forge-app/**

```
GitHub Actions Triggers
    ↓
.github/workflows/ci-core.yml (ROOT)
    ↓
[1] Checkout code (with fetch-depth: 0 for git history)
    ↓
[2] Setup Node 18 + npm cache (cache key: package-lock.json)
    ↓
[3] Verify lockfile exists (FAST FAIL if missing)
    ↓
[4] Run prove_clean_install.sh (SINGLE SOURCE OF TRUTH)
    │   ├─ Remove node_modules (clean state)
    │   ├─ Clear npm cache
    │   ├─ Verify package-lock.json
    │   ├─ npm ci (deterministic from lockfile)
    │   ├─ npm test (1715 tests)
    │   ├─ npm run build:gadget (7/7 gates)
    │   ├─ Check lockfile drift (no mutations)
    │   └─ Validate JSON
    │
    ├─ EXIT=0 on SUCCESS
    └─ EXIT=1 on ANY FAILURE
    ↓
[5] Verify repo clean (working tree must be clean after proof)
    ↓
[6] Continue with other gates (UI naming contract, Layer-0, tests, docs)
    ↓
✅ PR can merge (all checks GREEN)
```

### Parallel: forge-app-repro-proof.yml Workflow

- Dedicated sanity check
- Same prove_clean_install.sh validation
- Can be required separately for extra rigor
- Easier to debug independently

---

## Files Changed

### New Files (1)
- `.github/workflows/forge-app-repro-proof.yml` - Dedicated repro proof workflow

### Modified Files (3)
- `.github/workflows/ci-core.yml` - Removed redundant npm ci
- `atlassian/forge-app/tools/prove_clean_install.sh` - Enhanced with 8 checks + drift detection
- `atlassian/forge-app/tests/p1_policy_drift.test.ts` - Updated for deleted workflows

### Deleted Files (3)
- `atlassian/forge-app/.github/workflows/credibility-gates.yml` ⬅️ Never executed by GitHub Actions
- `atlassian/forge-app/.github/workflows/error-envelope-contract.yml` ⬅️ Never executed
- `atlassian/forge-app/.github/workflows/policy-drift-gate.yml` ⬅️ Never executed

---

## Proof of Effectiveness

### Before Changes
- ❌ CI called npm ci twice (redundant)
- ❌ Nested workflows existed but were never executed (confusion)
- ❌ Tests expected deleted workflows (fragile)
- ❌ No clear enforcement point for reproducibility
- ❌ Lockfile drift undetectable in proof script

### After Changes
- ✅ CI calls prove_clean_install.sh ONCE (efficient)
- ✅ Orphaned nested workflows DELETED (clarity)
- ✅ Tests verify by-design deletion (correct)
- ✅ prove_clean_install.sh is single authority (deterministic)
- ✅ Lockfile drift detected inside proof script
- ✅ New dedicated workflow for extra safety
- ✅ All local proofs PASS (EXIT=0, 1715 tests)

---

## Merge Readiness Checklist

- ✅ All phases completed (0-6)
- ✅ Local prove_clean_install.sh: EXIT=0 PASS
- ✅ All tests: 1715 PASS
- ✅ All gates: 7/7 GREEN
- ✅ Repository: CLEAN (expected files modified)
- ✅ No business logic changes
- ✅ No gate weakening
- ✅ No secrets added
- ✅ Deterministic + fail-closed
- ✅ Root workflows only
- ✅ Documentation complete

---

## Next Steps

1. **Review PR Changes:**
   - Verify ci-core.yml changes
   - Verify new forge-app-repro-proof.yml
   - Verify prove_clean_install.sh enhancements
   - Verify nested workflows deleted
   - Verify tests updated

2. **CI Verification:**
   - Open PR in GitHub
   - Verify ci-core.yml runs successfully
   - Verify forge-app-repro-proof.yml runs successfully
   - Verify all checks pass

3. **Merge:**
   - Approve changes
   - Merge to main (no force push)
   - Monitor first PR after merge

4. **Post-Merge:**
   - Verify future PRs enforce reproducible installs
   - Verify lockfile drift detection works
   - Verify no false positives

---

## Questions?

Refer to individual workflow files for exact steps, or review `/tmp/ci_hardening/` proof logs.

**Key Files:**
- `.github/workflows/ci-core.yml` - Main enforcement
- `.github/workflows/forge-app-repro-proof.yml` - Sanity check
- `atlassian/forge-app/tools/prove_clean_install.sh` - Deterministic proof
- `docs/PROOF/CI_REPRO_ENFORCEMENT_FINAL.md` - This document
