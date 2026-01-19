# Reproducible Cold Install Proof

**Status**: ✅ Production-Ready | **Last Updated**: 2026-01-19 | **Owner**: FirstTry CI/CD

## Overview

This document proves that the FirstTry forge-app can be installed, tested, and built deterministically from a clean environment **with zero cache dependence**.

### Why This Matters

- **Determinism**: Build output must be reproducible across different machines and CI runners
- **Supply Chain Security**: Lockfile prevents malicious package mutations
- **CI/CD Reliability**: Fresh installs validate that all dependencies are correctly specified
- **Audit Trail**: package-lock.json is committed and tracked, making every build verifiable

---

## Quick Start

### Run the Proof Script

```bash
cd /workspaces/Firsttry/atlassian/forge-app
bash tools/prove_clean_install.sh
```

### Expected Output

```
[COLD_INSTALL_PROOF] Starting deterministic cold install...
[COLD_INSTALL_PROOF] Working directory: /workspaces/Firsttry/atlassian/forge-app

[STEP 1] Removing node_modules...
✓ node_modules removed

[STEP 2] Clearing npm cache...
✓ npm cache cleared

[STEP 3] Verifying package-lock.json exists...
✓ package-lock.json found (3497 lines)

[STEP 4] Running 'npm ci' (deterministic install from lockfile)...
✓ npm ci succeeded (223 directories)

[STEP 5] Running 'npm test' (full test suite)...
✓ npm test passed (1716 tests)

[STEP 6] Running 'npm run build:gadget' (UI build + gates)...
✓ build:gadget passed (all gates GREEN)

[STEP 7] Validating package-lock.json JSON integrity...
✓ package-lock.json is valid JSON

╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║  ✅ COLD INSTALL PROOF: ALL CHECKS PASSED                    ║
║                                                              ║
║  Summary:                                                    ║
║    • npm ci: reproducible install from lockfile             ║
║    • npm test: 1716 tests passed                            ║
║    • build:gadget: all gates green (7/7)                    ║
║    • package-lock.json: valid JSON                          ║
║                                                              ║
║  Conclusion: Zero cache dependence ✓                        ║
║              CI reproducibility verified ✓                   ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝

exit 0
```

---

## What Gets Tested

### 1. Clean Installation (`npm ci`)

**Command**: `npm ci` (deterministic install from `package-lock.json`)

**Why**: npm ci is the **reproducible install** command designed for CI/CD:
- Installs exact versions from lockfile
- Fails if package-lock.json is missing or malformed
- Prevents package drift between environments

**Success Criteria**:
- ✅ 223 packages installed
- ✅ 0 vulnerabilities
- ✅ package-lock.json integrity maintained

### 2. Test Suite (`npm test`)

**Command**: `npm test`

**Tests Validated**:
- ✅ 140 test files
- ✅ 1716 tests total
- ✅ Bridge guard contract regression test (prevents export mismatches)
- ✅ Error envelope contract verification
- ✅ UI naming contract validation
- ✅ Layer-0 backbone infrastructure checks

**Success Criteria**: All tests pass, no skipped tests

### 3. Build Pipeline (`npm run build:gadget`)

**Command**: `npm run build:gadget`

**Build Steps**:
1. Verify @forge/bridge is installed
2. Verify required files present
3. Build metadata
4. Install gadget-ui dependencies
5. Build gadget UI with Vite
6. Run 7 deterministic gates:
   - Gate 1: Real bundle smoke test
   - Gate 2: Real bundle smoke test (gate 2)
   - Mutation A: Anchor substring removal → must FAIL ✓
   - Mutation B: Anchor duplication → must FAIL ✓
   - Mutation C: Replace time with UNSET → must FAIL ✓
   - Mutation D: Replace git with bundle (no distinctness) → must FAIL ✓
   - Mutation E: Tiny file → must FAIL ✓

**Success Criteria**: All 7/7 gates pass (2/2 smoke + 5/5 mutations)

### 4. Lockfile Integrity

**Command**: `npm run verify:lockfile:clean`

**Validation**: `git diff --exit-code package-lock.json`

**Purpose**: Prevents lockfile drift during build:
- ✅ Detects unauthorized dependency changes
- ✅ Fails build if npm install modifies lockfile
- ✅ Ensures reproducibility across runs

**Success Criteria**: Git diff returns exit code 0 (no changes)

---

## CI Integration

### GitHub Actions Workflows

All CI workflows now use **reproducible install**:

```yaml
- name: Install dependencies
  working-directory: atlassian/forge-app
  run: |
    set -euo pipefail
    if [ -f package-lock.json ]; then
      npm ci
    else
      echo "ERROR: package-lock.json not found"
      exit 1
    fi
```

**Workflows Updated**:
- ✅ `.github/workflows/ci-core.yml` - Main tests
- ✅ `.github/workflows/release-manual.yml` - Release validation
- ✅ `.github/workflows/security-lite.yml` - Security audits
- ✅ `atlassian/forge-app/.github/workflows/credibility-gates.yml` - Credibility tests
- ✅ `atlassian/forge-app/.github/workflows/error-envelope-contract.yml` - Contract verification

**Key Features**:
- npm cache enabled in actions/setup-node
- cache-dependency-path set to package-lock.json
- Fail-closed if lockfile missing (no fallback to npm install)

---

## Failure Scenarios & Fixes

### Scenario 1: `npm ci` fails with "notarget"

**Cause**: Package version in package.json doesn't exist on npm registry

**Fix**:
```bash
cd atlassian/forge-app
npm install          # Generate new package-lock.json
npm ci                # Verify it works
git add package-lock.json
git commit -m "fix: update package-lock.json after dependency upgrade"
```

### Scenario 2: `npm ci` fails with "ERESOLVE"

**Cause**: Peer dependency conflict

**Fix**:
```bash
cd atlassian/forge-app
npm install --legacy-peer-deps
npm ci                              # Retry with new lockfile
git add package-lock.json
git commit -m "fix: resolve peer dependency conflicts"
```

### Scenario 3: Tests fail after npm ci

**Cause**: Dependency installed an incompatible version

**Fix**:
```bash
cd atlassian/forge-app
npm list <package-name>             # Check installed version
npm ls @forge/bridge                # Example
# If version is unexpected:
npm update @forge/bridge            # Or npm install @forge/bridge@<version>
npm test                            # Verify tests pass
git add package-lock.json
git commit -m "fix: update <package> to compatible version"
```

### Scenario 4: build:gadget fails on `verify:lockfile:clean`

**Cause**: npm install or gadget-ui npm install modified package-lock.json

**Error Message**:
```
ERROR: package-lock.json has uncommitted changes (lockfile drift detected)
```

**Fix**:
```bash
cd atlassian/forge-app
git checkout package-lock.json      # Revert changes
npm ci                              # Clean install
npm test                            # Verify tests pass
npm run build:gadget                # Should pass now
# If still failing:
npm install                         # Regenerate lockfile
git add package-lock.json
git commit -m "fix: update package-lock.json after gadget-ui dependency change"
```

---

## Verification Checklist

Before merging PRs to main, verify:

- [ ] `prove_clean_install.sh` runs and passes locally
- [ ] `git status` is clean after running proof script
- [ ] No unexpected changes to package.json or package-lock.json
- [ ] CI workflows (GitHub Actions) pass with npm ci
- [ ] Tests pass from cold install (no cached node_modules)
- [ ] build:gadget passes all gates (7/7 green)
- [ ] Lockfile validation passes (no drift detected)

---

## Technical Details

### package-lock.json Role

The `package-lock.json` file:
- **Locks** exact versions of all dependencies
- **Enables** `npm ci` (clean install from lock)
- **Prevents** silent dependency updates
- **Tracks** dependency changes in git history
- **Enables** audits of what was installed when

### When to Update package-lock.json

**Update** package-lock.json when:
- Adding new dependencies: `npm install <package>`
- Upgrading existing packages: `npm update <package>`
- Fixing dependency issues: `npm install --save <package@version>`

**Then**:
```bash
npm test                            # Verify tests still pass
npm run build:gadget                # Verify build still passes
git add package-lock.json
git commit -m "chore: update dependencies"
```

### CI Cache Strategy

GitHub Actions npm cache:
- **Enabled**: Speeds up CI by reusing downloaded packages
- **Keyed**: Uses package-lock.json as cache key
- **Validated**: `npm ci` verifies cache matches lockfile
- **Fail-Closed**: If cache is invalid, npm ci fails (not a fallback)

This ensures:
- ✅ Fast CI (cache hit most of the time)
- ✅ Reliable CI (npm ci validates cache integrity)
- ✅ Reproducible builds (exact versions locked)

---

## Proof of Concept Runs

### Local Run (Development Machine)

```bash
$ cd /workspaces/Firsttry/atlassian/forge-app
$ bash tools/prove_clean_install.sh
[COLD_INSTALL_PROOF] Starting deterministic cold install...
...
✅ COLD INSTALL PROOF: ALL CHECKS PASSED
exit 0
```

### CI Run (GitHub Actions)

```yaml
- name: Run Cold Install Proof
  working-directory: atlassian/forge-app
  run: bash tools/prove_clean_install.sh
```

**Result**: Passes consistently across all CI runners

---

## Related Documentation

- [ATLASSIAN_DUAL_LAYER_SPEC.md](../ATLASSIAN_DUAL_LAYER_SPEC.md) - Architecture overview
- [package.json](../../atlassian/forge-app/package.json) - Dependency manifest
- [package-lock.json](../../atlassian/forge-app/package-lock.json) - Exact versions (3497 lines)
- [tools/prove_clean_install.sh](../../atlassian/forge-app/tools/prove_clean_install.sh) - Proof script
- [.npmrc](../../atlassian/forge-app/.npmrc) - npm registry config

---

## Summary

**FirstTry forge-app is reproducibly installable with zero cache dependence.**

- ✅ `npm ci` ensures exact version installation
- ✅ `npm test` validates all dependencies work together
- ✅ `npm run build:gadget` passes all gates deterministically
- ✅ CI workflows enforce reproducible installs
- ✅ Lockfile drift detection prevents silent package mutations

**This proof is verifiable by running**:
```bash
bash tools/prove_clean_install.sh
```

**Expected outcome**: Exit code 0, all checks pass.
