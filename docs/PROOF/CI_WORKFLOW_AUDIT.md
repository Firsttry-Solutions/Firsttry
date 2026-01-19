# CI Workflow Audit Report

**Date**: 2026-01-19 | **Branch**: fix/bridge-guard-contract-20260119T161347Z | **Status**: Complete

## Executive Summary

**Finding**: Root workflows in `.github/workflows/` are the only workflows that execute in GitHub Actions. Nested workflows in `atlassian/forge-app/.github/workflows/` exist but are **NOT executed** unless explicitly referenced via `workflow_call` or `uses` directive from a root workflow.

**Current State**: Root workflows already have conditional npm ci/install logic, but NO root workflow currently runs the forge-app cold-install proof script (`prove_clean_install.sh`).

---

## Audit Findings

### 1. Root Workflow npm Usage

**Search Command**:
```bash
grep -r "npm ci\|npm install" .github/workflows/*.yml | grep -v "cache-dependency-path\|node-version"
```

**Results**:

| File | npm Command | Context |
|------|-------------|---------|
| ci-core.yml | `npm ci` + `npm install` (fallback) | forge-app install (conditional) |
| release-manual.yml | `npm ci` + `npm install` (fallback) | forge-app install (conditional) |
| security-lite.yml | `npm ci` + `npm install` (fallback) | forge-app install (conditional) |

**Conclusion**: All root workflows use conditional npm ci with fallback to npm install. This is correct but fallback should be removed to enforce reproducibility.

---

### 2. Root Workflow forge-app References

**Search Command**:
```bash
grep -r "atlassian/forge-app\|build:gadget\|prove_clean_install\|verify:lockfile" .github/workflows/*.yml
```

**Results**:

| Workflow | Type of Reference | Count |
|----------|------------------|-------|
| ci-core.yml | Path patterns (on triggers) | 2 |
| ci-core.yml | working-directory | 3 |
| evidence-guard.yml | Path patterns + execution | 2 |
| release-manual.yml | cache-dependency-path | 1 |
| release-manual.yml | working-directory | 2 |
| security-lite.yml | working-directory | 2 |

**Key Finding**: NO root workflow runs `prove_clean_install.sh`, `build:gadget`, or `verify:lockfile:clean`.

---

### 3. Nested Workflows vs Root Workflows

**Nested Workflows** (in `atlassian/forge-app/.github/workflows/`):
- credibility-gates.yml
- error-envelope-contract.yml
- policy-drift-gate.yml

**Execution Status**: ❌ NOT EXECUTING (not referenced by any root workflow)

**Search for References**:
```bash
grep -r "credibility-gates\|error-envelope-contract\|policy-drift-gate" .github/workflows/*.yml
```

**Result**: No matches found. Nested workflows are completely orphaned.

---

## Implications

### Current State Problems

1. **Nested workflows don't execute**: `atlassian/forge-app/.github/workflows/*` are not run by GitHub Actions
2. **No cold-install proof in CI**: `prove_clean_install.sh` is never called in any CI workflow
3. **No lockfile drift detection in CI**: `verify:lockfile:clean` gate never runs in CI
4. **Fallback weakens reproducibility**: npm install fallback defeats the purpose of lockfile enforcement

### Solutions Required

1. ✅ Add `prove_clean_install.sh` execution to a root workflow that always runs on PR/push
2. ✅ Replace npm install fallback with hard requirement for npm ci
3. ✅ Add explicit lockfile drift check in CI
4. ✅ Choose appropriate root workflow (recommend: `ci-core.yml`)

---

## Root Workflows Triggering on PR/Push

### ci-core.yml
- **Trigger**: Pull request (main, develop), push, workflow_dispatch
- **Path Filter**: atlassian/forge-app/**, tools/**, docs/**, .github/**
- **Job**: forge-app-tests
- **Current Steps**: verify ui-naming, verify backbone l0, npm test
- **Recommendation**: ✅ **ADD prove_clean_install.sh here**

### gates.yml
- **Trigger**: Push to main/develop, PR
- **Path Filter**: Various documentation paths
- **Job**: Multiple verification jobs
- **Recommendation**: ❌ Not ideal (doc-focused)

### evidence-guard.yml
- **Trigger**: PR and push
- **Path Filter**: atlassian/forge-app/**
- **Job**: Runs tenant isolation proof
- **Current Steps**: Node.js tenant isolation test
- **Recommendation**: ❌ Specialized workflow

### release-manual.yml
- **Trigger**: Manual workflow_dispatch
- **Recommendation**: ❌ Not for auto-enforcement

### security-lite.yml
- **Trigger**: PR with path changes
- **Recommendation**: ❌ Security-focused (not install-focused)

---

## Recommendation

**Choose**: `ci-core.yml`

**Reason**:
- Always runs on PR/push with forge-app changes
- Already has forge-app tests
- Correct place for reproducibility enforcement
- Already uses npm ci (conditionally)

**Steps to Add**:
1. Replace npm install fallback with hard npm ci check
2. Add `bash tools/prove_clean_install.sh` after npm ci
3. Add lockfile drift check: `git diff --exit-code atlassian/forge-app/package-lock.json`

---

## Audit Evidence

### ci-core.yml Current Install Steps

```yaml
- name: Install dependencies (forge-app)
  working-directory: atlassian/forge-app
  run: |
    set -euo pipefail
    if [ -f package-lock.json ]; then
      npm ci
    else
      npm install
    fi
```

**Problem**: Falls back to npm install (non-deterministic)

### Nested Workflows Status

```
✗ atlassian/forge-app/.github/workflows/credibility-gates.yml - NOT EXECUTED
✗ atlassian/forge-app/.github/workflows/error-envelope-contract.yml - NOT EXECUTED
✗ atlassian/forge-app/.github/workflows/policy-drift-gate.yml - NOT EXECUTED
```

**Proof**: grep found zero references from root workflows to nested workflows.

---

## Conclusion

**CI enforcement is NOT currently active for forge-app reproducible installs.**

The infrastructure exists (npm ci conditional, package-lock.json, prove_clean_install.sh) but:
- ❌ prove_clean_install.sh never runs in CI
- ❌ No lockfile drift check in CI
- ❌ npm install fallback still present (weakens determinism)
- ❌ Nested workflows completely orphaned

**Action**: Add cold-install proof enforcement to `ci-core.yml` (root workflow that always runs on forge-app changes).

---

## Appendix: All Audit Outputs

### Raw grep results

**npm ci/install usage** (from .github/workflows):
```
.github/workflows/ci-core.yml:            npm ci
.github/workflows/ci-core.yml:            npm install
.github/workflows/release-manual.yml:            npm ci
.github/workflows/release-manual.yml:            npm install
.github/workflows/security-lite.yml:            npm ci
.github/workflows/security-lite.yml:            npm install
```

**Nested workflows references from root**: (empty - no matches)

**Nested workflows in atlassian/forge-app/.github/workflows/**:
```
-rw-rw-rw-  credibility-gates.yml
-rw-rw-rw-  error-envelope-contract.yml
-rw-rw-rw-  policy-drift-gate.yml
```

---

**Audit performed by**: GitHub Copilot  
**Audit date**: 2026-01-19 16:50 UTC  
**Status**: COMPLETE - Ready for enforcement implementation
