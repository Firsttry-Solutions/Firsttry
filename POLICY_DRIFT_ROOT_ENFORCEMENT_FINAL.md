# Policy Drift Enforcement: Restored to Root CI

**Status**: ✅ COMPLETE  
**Commit**: `1ce1fd96` - ci: restore policy drift enforcement to root CI  
**Branch**: fix/bridge-guard-contract-20260119T161347Z  
**Date**: 2026-01-19T17:42:35Z  

## Summary

Recovered and restored **policy drift enforcement** from deleted nested workflow into **ROOT prove_clean_install.sh**, making it:
- ✅ Enforceable by GitHub Actions (nested workflows never executed)
- ✅ Portable (no /workspaces hardcoding)
- ✅ Comprehensive (8 reproducibility checks + policy drift = 8+PD)
- ✅ Testable (assertions verify root enforcement)
- ✅ Deterministic (fail-closed, no cache dependence)

## What Changed

### 1. Core Files Modified

#### `.github/workflows/ci-core.yml` (PORTABILITY FIX)
```yaml
# Before: Assumed /workspaces/Firsttry absolute path
# After: Uses GITHUB_WORKSPACE variable (GitHub Actions native)
cd "${GITHUB_WORKSPACE:-.}"
```

#### `.github/workflows/forge-app-repro-proof.yml` (ROBUSTNESS)
- Removed `paths:` filters (now triggers on all PRs)
- Added "Detect relevant changes" step
- Conditional: Only run proof if changes relevant
- Safe for branch protection rules (won't block irrelevant changes)

#### `atlassian/forge-app/tools/prove_clean_install.sh` (NEW STEP PD)
```bash
[STEP PD] POLICY DRIFT ENFORCEMENT (Root-Based Enforcement)
  [PD.1] node audit/policy_drift_check.js
    ✓ OAuth scopes unchanged
    ✓ Storage key prefixes unchanged
    ✓ Outbound network calls unauthorized
    ✓ Export schema version stable
    ✓ Retention policy TTL enforced (90 days)
  
  [PD.2] Detects policy baseline changes via git diff
  [PD.3] Verifies SECURITY.md/PRIVACY.md updated if baseline modified
```

#### `atlassian/forge-app/tests/p1_policy_drift.test.ts` (ROOT ASSERTIONS)
- ❌ Removed: Test checking nested workflow exists
- ✅ Added: Root enforcement assertions
  - `ci-core.yml` contains `bash tools/prove_clean_install.sh`
  - `prove_clean_install.sh` contains `POLICY_DRIFT_ROOT_ENFORCED=1` marker
  - `prove_clean_install.sh` contains `[STEP PD]` policy drift step

### 2. Policy Drift Commands (From Legacy Workflow)

**Source**: Extracted from commit 2ca1f564 (atlassian/forge-app/.github/workflows/policy-drift-gate.yml)

**Moved Verbatim**:
```bash
# PD.1 - Policy Drift Detection
node audit/policy_drift_check.js

# PD.2 - Baseline Change Detection
git diff --name-only HEAD~1..HEAD | grep "audit/policy_baseline/"

# PD.3 - Documentation Verification
if baseline_modified: check SECURITY.md/PRIVACY.md updated
```

## Verification

### ✅ Local Tests (19/19 PASS)
```
npm test -- p1_policy_drift
Test Files  1 passed (1)
Tests  19 passed (19)
```

### ✅ Proof Script (EXIT=0, 8+PD CHECKS GREEN)
```bash
bash tools/prove_clean_install.sh

✅ COLD INSTALL PROOF: ALL 8+PD CHECKS PASSED
  • node_modules: removed
  • npm cache: cleared
  • package-lock.json: verified
  • npm ci: reproducible install
  • npm test: full test suite
  • build:gadget: 7/7 gates green
  • lockfile drift: none
  • JSON validation: passed
  • policy drift: root-enforced ✓
```

### ✅ Final Assertions (PHASE 8)
- [✓] NO /workspaces paths in workflows (portable)
- [✓] ci-core.yml runs prove_clean_install.sh (root enforcement)
- [✓] POLICY_DRIFT_ROOT_ENFORCED=1 marker present (testable)
- [✓] Nested workflow deleted (by design)
- [✓] Repository clean (committed and pushed)

## Architecture

```
GitHub Actions Workflow (Root)
└── .github/workflows/ci-core.yml
    └── bash tools/prove_clean_install.sh
        ├── STEP 1-8: Reproducibility checks
        └── STEP PD: Policy drift enforcement ← MOVED FROM NESTED WORKFLOW
            ├── PD.1: node audit/policy_drift_check.js
            ├── PD.2: git diff baseline detection
            └── PD.3: SECURITY.md/PRIVACY.md verification
```

## Deployment Safety

✅ **No Business Logic Changes**: Commands moved verbatim from legacy workflow  
✅ **Fail-Closed**: Policy drift violations block CI (exit 1)  
✅ **Deterministic**: No cache dependence, no environmental assumptions  
✅ **Testable**: Root enforcement verified via filesystem checks  
✅ **Portable**: Works on any GitHub Actions runner (uses GITHUB_WORKSPACE)  

## Recovery Details

### How It Was Done (8-Phase Process)

**PHASE 0**: Captured repo state (branch, HEAD, workflow snapshots)

**PHASE 1**: Extracted legacy commands from git history
- `git log -- atlassian/forge-app/.github/workflows/policy-drift-gate.yml`
- `git show 2ca1f564:atlassian/forge-app/.github/workflows/policy-drift-gate.yml`
- Documented exact commands in /tmp/policy_drift_root/

**PHASE 2**: Moved policy drift into prove_clean_install.sh
- Added POLICY_DRIFT_ROOT_ENFORCED=1 marker
- Added STEP PD with all three sub-steps (PD.1, PD.2, PD.3)
- Updated success banner: "8+PD CHECKS PASSED"

**PHASE 3**: Fixed GitHub Actions paths
- ci-core.yml: Use ${GITHUB_WORKSPACE:-.} instead of /workspaces/Firsttry
- forge-app-repro-proof.yml: Removed path filters, added relevance detection

**PHASE 4**: Updated tests
- Replaced nested workflow checks with root enforcement assertions
- Verified ci-core.yml → prove_clean_install.sh → policy drift chain

**PHASE 5**: Local verification
- npm test: 1715 tests PASS
- bash tools/prove_clean_install.sh: EXIT=0, 8+PD gates GREEN

**PHASE 6**: Documentation (this file)

**PHASE 7**: Commit and push
- `git add -A && git commit && git push`

**PHASE 8**: Final assertions
- Verified no /workspaces hardcoding
- Verified root enforcement chain
- Verified repository clean

## Rollback

If needed, policy drift can be temporarily disabled by commenting STEP PD in prove_clean_install.sh:
```bash
# echo "[STEP PD] POLICY DRIFT ENFORCEMENT..."
```

However, this should NOT be done without addressing the underlying policy drift cause.

## Related Files

- **Primary**: [.github/workflows/ci-core.yml](.github/workflows/ci-core.yml)
- **Proof Script**: [atlassian/forge-app/tools/prove_clean_install.sh](atlassian/forge-app/tools/prove_clean_install.sh)
- **Tests**: [atlassian/forge-app/tests/p1_policy_drift.test.ts](atlassian/forge-app/tests/p1_policy_drift.test.ts)
- **Legacy Source** (archived): Commit 2ca1f564 - atlassian/forge-app/.github/workflows/policy-drift-gate.yml (deleted)

## Compliance

✅ **Requirement**: Move policy drift from nested workflow to root CI  
✅ **Requirement**: Fix invalid /workspaces paths  
✅ **Requirement**: Update tests to assert root enforcement  
✅ **Requirement**: NO business logic changes  
✅ **Requirement**: Deterministic (fail-closed)  
✅ **Requirement**: Local verification passes  

---

**Status**: Ready for merge  
**Blockers**: None  
**Risk Level**: Low (verbatim move, verified, tested)
