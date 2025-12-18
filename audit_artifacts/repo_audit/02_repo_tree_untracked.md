# Untracked and Ignored Files Inventory

**Generated:** 2025-12-18  
**Source:** `git status --porcelain=v1` + `git clean -ndx`

## Summary

| Category | Status | Details |
|----------|--------|---------|
| **Untracked Files** | 1 directory | `audit_artifacts/` (audit in progress) |
| **Ignored Files** | 1 directory | Would be removed: `audit_artifacts/` |
| **Dirty Working Dir** | Clean | Only audit_artifacts/ is untracked |

## Untracked Status (git status --porcelain=v1)

```
?? audit_artifacts/
```

**Interpretation:**
- `??` = Untracked (not in .gitignore, not in git index)
- Only the `audit_artifacts/` directory from this audit run is untracked
- This is expected behavior for a new audit

## Potentially Ignored Files (git clean -ndx dry-run)

```
Would remove audit_artifacts/
```

**Interpretation:**
- The `.gitignore` does NOT ignore `audit_artifacts/`
- `git clean -ndx` would remove it (because it's untracked)
- This directory exists only for this audit session

## .gitignore Review

**Evidence:** `.gitignore` is tracked in git (checked in)

Common ignored patterns (from `.gitignore`):
- `__pycache__/`
- `*.pyc`
- `.coverage*`
- `.venv*/` (note: virtual envs ARE tracked in this repo)
- `.mypy_cache/`
- Build artifacts

## Notable Observations

### ✅ Virtual Environments ARE Tracked
- `.venv-build/` - 7,402 files (tracked)
- `.venv_tmp/` - 3,801 files (tracked)

**Impact:** Large git repo size due to venv inclusion. Consider .gitignore to exclude these.

### ✅ Coverage Files ARE Tracked
- `.coverage*` files present in git_ls_files
- Indicates CI/CD coverage artifacts are committed

**Impact:** Pollutes repo; should be in .gitignore

### ✅ Test Artifacts ARE Tracked
- `.testmondata` present
- `*.json` test result files present

**Impact:** Test state coupled to commits; should be ignored

## Secrets/Sensitive Data Check

**Status:** ✅ NO .env files tracked

Evidence from `find . -maxdepth 4 -name ".env*" -type f`:
- **Result:** Empty (no .env files found)
- `.env` files are NOT in git ✅

## Recommendation Summary

**BLOCKER:**
- Remove `.venv*/` directories from git (`git rm --cached .venv-build/.venv_tmp`) 
- Add to .gitignore to prevent future commits

**HIGH:**
- Remove `.coverage*` files from git
- Remove `.testmondata` from git
- Add these to .gitignore

**MEDIUM:**
- Review why virtual environments are tracked (unusual practice)
- Ensures clean dev setup without repo bloat
