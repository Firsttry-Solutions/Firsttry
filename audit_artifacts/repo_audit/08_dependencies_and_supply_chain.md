# Dependencies and Supply Chain Audit

**Generated:** 2025-12-18

## Summary

| Type | File | Status |
|------|------|--------|
| Python (main) | pyproject.toml | Present |
| Python (dev) | requirements-dev.txt | Present |
| Python (prod) | requirements.txt | Present |
| JavaScript | dashboard/package.json | Present |

## Key Findings

### BLOCKER Issues

1. **Missing Test Dependencies**
   - blake3 and botocore not installed
   - Blocks test execution
   - Fix: `pip install .[test]`

2. **Virtual Environments Tracked in Git**
   - .venv-build: 7,402 files
   - .venv_tmp: 3,801 files
   - Should be removed and added to .gitignore

### HIGH Priority Issues

1. **Coverage Files Tracked**
   - .coverage.* files present in git
   - Should be in .gitignore

2. **Loose Version Constraints**
   - ruff>=0.1.0 (too broad)
   - black>=22.0.0 (too broad)
   - Consider using requirements-dev.txt for pinned versions

### Dependencies Found

**Core (unpinned in pyproject.toml):**
- PyYAML>=6.0
- ruff>=0.1.0
- black>=22.0.0
- mypy>=1.0.0
- pytest>=7.0.0
- blake3>=0.4

**Dev (pinned in requirements-dev.txt):**
- ruff==0.6.9
- black==24.10.0
- mypy==1.11.2
- pytest==8.3.3
- pytest-cov==5.0.0

**Optional:**
- boto3>=1.34 (enterprise/test)
- botocore>=1.34.0 (test)

## Next Actions

1. Install test dependencies
2. Remove venv from git
3. Create lock file (poetry.lock)
4. Audit JavaScript dependencies (npm audit)
5. Narrow version constraints
