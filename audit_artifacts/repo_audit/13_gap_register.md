# Gap Register (Master Issue List)

**Generated:** 2025-12-18  
**Total Gaps:** 18 identified  
**Severity Distribution:** 5 BLOCKER, 8 HIGH, 5 MEDIUM

---

## 1. BLOCKER: Missing Test Dependencies

**ID:** GAP-001  
**Severity:** 🔴 BLOCKER  
**Status:** Confirmed  

**Evidence:**
```
pytest_first_fail.txt:
  ModuleNotFoundError: No module named 'blake3'
  ModuleNotFoundError: No module named 'botocore'
```

**Impact:**
- Cannot run test suite
- CI/CD pipelines fail
- Cannot verify code correctness

**Root Cause:**
- `blake3` required by `src/firsttry/twin/hashers.py:7`
- `botocore` required for S3 integration tests
- Not installed in `.venv_tmp` environment

**Files Involved:**
- `.venv_tmp/` (incomplete installation)
- `pyproject.toml` (defines test extras)
- `src/firsttry/twin/hashers.py`
- `tests/cache/test_cache_s3_fail_open.py`

**Fix Outline:**
```bash
# Option 1: Install via test extra
pip install '.[test]'

# Option 2: Manual install
pip install blake3>=0.4 boto3>=1.34 botocore>=1.34
```

**Verification Command:**
```bash
.venv_tmp/bin/python -m pytest --collect-only -q
.venv_tmp/bin/python -m pytest -x tests/ --maxfail=1
```

**Expected Result:** pytest collects >1000 tests, first suite passes or shows actual failures (not import errors)

---

## 2. BLOCKER: Virtual Environments Tracked in Git

**ID:** GAP-002  
**Severity:** 🔴 BLOCKER  
**Status:** Confirmed  

**Evidence:**
```
git_ls_files.txt:
  .venv-build/        7,402 files
  .venv_tmp/          3,801 files
  Total bloat:        11,203 files (92% of entire repo!)
```

**Impact:**
- Repo is 11,203 files larger than necessary
- Slow clone/fetch/push operations
- Unnecessary storage usage
- .gitignore not preventing this

**Files Involved:**
- `.venv-build/` (should be removed)
- `.venv_tmp/` (should be removed)
- `.gitignore` (incomplete)

**Fix Outline:**
```bash
# Step 1: Remove from git index (keep local)
git rm --cached -r .venv-build .venv_tmp

# Step 2: Add to .gitignore
echo ".venv*/" >> .gitignore
echo ".venv_*" >> .gitignore

# Step 3: Commit
git add .gitignore
git commit -m "chore: remove venv from tracking and add to gitignore"

# Step 4: Force garbage collection
git gc --aggressive
```

**Verification Command:**
```bash
git ls-files | grep -c ".venv" # Should be 0
git status                       # Should show clean
```

**Expected Result:** repo size reduced from 12,108 to ~900 tracked files

---

## 3. BLOCKER: Coverage Files Tracked in Git

**ID:** GAP-003  
**Severity:** 🔴 BLOCKER  
**Status:** Confirmed  

**Evidence:**
```
git_ls_files.txt:
  .coverage.codespaces-f988a3.466262.XCPZXdJx
  .coverage.codespaces-f988a3.466989.XwrEEurx
  ... (6 more coverage files)
```

**Impact:**
- CI/CD coverage artifacts in git
- Pollutes repo with test state
- Should not be committed

**Files Involved:**
- `.coverage*` files (6 total)
- `.testmondata` (1 file)

**Fix Outline:**
```bash
git rm --cached .coverage* .testmondata
echo ".coverage*" >> .gitignore
echo ".testmondata" >> .gitignore
git add .gitignore
git commit -m "chore: remove coverage artifacts from tracking"
```

**Verification Command:**
```bash
git ls-files | grep -E "\.coverage|\.testmondata"  # Should be empty
```

---

## 4. BLOCKER: Incomplete Code Inventory

**ID:** GAP-004  
**Severity:** 🔴 BLOCKER  
**Status:** Partial evidence  

**Evidence:**
```
rg_notimplemented.txt: 4,337 NotImplementedError/pass occurrences
rg_todos.txt:          2,696 TODO/FIXME/XXX occurrences
rg_placeholders.txt:   2,048 placeholder markers
```

**Impact:**
- Unknown quantity of dead code
- Functions declared but not implemented
- Tests may pass on stubs

**Root Cause:**
- Massive codebase with incomplete refactoring
- Legacy code not cleaned up
- No enforcement of implementation completion

**Files Involved:**
- src/ (entire directory)
- tests/ (entire directory)

**Fix Outline:**
1. Triage all TODOs (which are real vs. informational?)
2. Remove dead NotImplementedError stubs
3. Replace placeholder code with real test fixtures
4. Add CI rule: reject new stubs without JIRA reference

**Verification Command:**
```bash
# Source-only (non-venv) TODOs
grep -rn "TODO\|FIXME" src/ tests/ scripts/ --include="*.py" | wc -l

# Source-only stubs
grep -rn "NotImplementedError\|^\s*pass\s*$" src/ --include="*.py" | wc -l
```

---

## 5. BLOCKER: Test Suite Cannot Run

**ID:** GAP-005  
**Severity:** 🔴 BLOCKER  
**Status:** Confirmed  

**Evidence:**
```
Tests found: 603 files
Test execution: FAILED (import errors, not test failures)
Error: ModuleNotFoundError: No module named 'blake3'
```

**Impact:**
- Cannot verify code quality
- CI/CD blocks
- Unknown test coverage

**Root Cause:** See GAP-001 (missing dependencies)

**Fix:** See GAP-001

---

## 6. HIGH: Unpinned Production Dependencies

**ID:** GAP-006  
**Severity:** 🟡 HIGH  
**Status:** Confirmed  

**Evidence:**
```
pyproject.toml:
  PyYAML>=6.0         (could be 7.x with breaking changes)
  ruff>=0.1.0         (too broad, 0.1 → 0.7)
  blake3>=0.4         (could be 1.x)
```

**Impact:**
- Different versions across environments
- Potential breaking changes on upgrade
- Harder to debug environment-specific issues

**Files Involved:**
- `pyproject.toml` → dependencies section

**Fix Outline:**
1. Use requirements.txt for pinned versions
2. Or use poetry.lock for deterministic builds
3. Or narrow version ranges (>=X.Y, <X+1)

**Verification Command:**
```bash
pip index versions ruff | head -5
pip install --dry-run ruff==0.1.0  # Check if works
```

---

## 7. HIGH: Documentation Conflicts

**ID:** GAP-007  
**Severity:** 🟡 HIGH  
**Status:** Likely  

**Evidence:**
```
Multiple files found:
  README.md
  GET_STARTED.md
  QUICKSTART_DEV.md
  PHASE1_QUICK_REF.md
  DEVELOPING.md
```

**Impact:**
- New developers get conflicting instructions
- Maintenance nightmare
- Unknown which is current

**Fix Outline:**
1. Designate one primary README
2. Archive or delete conflicting docs
3. Add version check to ensure docs stay current

**Verification Command:**
```bash
# Check modification dates
git log -1 --format="%ai" README.md
git log -1 --format="%ai" GET_STARTED.md
git log -1 --format="%ai" DEVELOPING.md
```

---

## 8. HIGH: Loose Import Patterns

**ID:** GAP-008  
**Severity:** 🟡 HIGH  
**Status:** Confirmed  

**Evidence:**
```
rg_import_risks.txt: 1,921 occurrences
Patterns:
  import X as Y        (aliasing)
  from X import *      (wildcard)
```

**Impact:**
- Reduces code clarity
- Hard to trace symbols
- Namespace collision risk

**Fix Outline:**
1. Audit wildcard imports (most risky)
2. Use ruff to auto-fix imports
3. Enforce explicit imports via linter

**Verification Command:**
```bash
grep -rn "from .* import \*" src/ --include="*.py"
```

---

## 9. HIGH: Entrypoints Not Documented

**ID:** GAP-009  
**Severity:** 🟡 HIGH  
**Status:** Confirmed  

**Evidence:**
```
rg_main.txt: 743 __main__ definitions
rg_cli.txt: 1,131 CLI references
But: No single "how to run" document
```

**Impact:**
- Users don't know how to invoke the tool
- Multiple CLI frameworks (typer, click, argparse)
- No clear main entrypoint

**Fix Outline:**
1. Document primary CLI entrypoint
2. Standardize on one CLI framework
3. Create "Getting Started" that shows example invocation

**Verification Command:**
```bash
python -m firsttry.ft --help
python -m firsttry.cli --help
bash scripts/run_all_tests.sh --help
```

---

## 10. MEDIUM: No Lock File for Dependencies

**ID:** GAP-010  
**Severity:** 🟡 MEDIUM  
**Status:** Confirmed  

**Evidence:**
```
No poetry.lock or pip-compile output found
Requirements-dev.txt exists (pinned)
But pyproject.toml has unpinned ranges
```

**Impact:**
- Inconsistent builds across machines
- Harder to reproduce issues

**Fix Outline:**
1. Use poetry to generate lock file
2. Or use pip-compile: `pip-compile pyproject.toml`
3. Or commit requirements-dev.txt as source of truth

**Verification Command:**
```bash
pip-compile pyproject.toml --output-file=requirements.txt
git diff requirements.txt  # Should show locked versions
```

---

## 11. MEDIUM: JavaScript Dependencies Unaudited

**ID:** GAP-011  
**Severity:** 🟡 MEDIUM  
**Status:** Confirmed  

**Evidence:**
```
dashboard/package.json exists
vscode-extension/package.json exists
No npm audit results found
```

**Impact:**
- Unknown security vulnerabilities in frontend
- Outdated dependencies

**Fix Outline:**
```bash
cd dashboard && npm audit
cd vscode-extension && npm audit
```

---

## 12. MEDIUM: No .env.example

**ID:** GAP-012  
**Severity:** 🟡 MEDIUM  
**Status:** Likely  

**Evidence:**
```
env_files.txt: (empty)
No .env.example or .env.sample found
```

**Impact:**
- New developers don't know what env vars are needed
- Runtime errors if required vars missing

**Fix Outline:**
1. Create `.env.example`
2. List all required and optional env vars
3. Provide default values where safe

---

## 13. MEDIUM: No Startup Validation

**ID:** GAP-013  
**Severity:** 🟡 MEDIUM  
**Status:** Unknown  

**Evidence:**
```
rg_env_usage.txt: 1,386 env var references
But: Unclear if validated at startup
```

**Impact:**
- Cryptic runtime errors if env vars missing
- No helpful "doctor" command

**Fix Outline:**
1. Create startup validator function
2. Print helpful errors for missing vars
3. Consider "ft doctor" command

---

## 14. MEDIUM: No API Documentation

**ID:** GAP-014  
**Severity:** 🟡 MEDIUM  
**Status:** Unknown  

**Evidence:**
```
FastAPI detected (209 refs)
But: No /docs endpoint route documented
No OpenAPI schema in git
```

**Impact:**
- API users can't discover endpoints
- No schema versioning documented

**Fix Outline:**
1. Verify FastAPI auto-doc generation
2. Document how to access /docs and /redoc
3. Add schema versioning comment

---

## 15. MEDIUM: Configuration Files Not Validated

**ID:** GAP-015  
**Severity:** 🟡 MEDIUM  
**Status:** Unknown  

**Evidence:**
```
5 config files found (.ruff.toml, mypy.ini, etc.)
Unclear if all are actually used
```

**Impact:**
- Dead config files accumulate
- Tool behavior inconsistent across teams

**Fix Outline:**
1. Audit each config file
2. Remove unused configs
3. Document which tools are mandatory

---

## 16. LOW: Placeholder Code in Production

**ID:** GAP-016  
**Severity:** 🟡 MEDIUM  
**Status:** Likely  

**Evidence:**
```
rg_placeholders.txt: 2,048 occurrences
Patterns: "placeholder", "lorem", "dummy", "sample"
```

**Impact:**
- May indicate incomplete implementations
- Risk of demo/test data reaching production

**Fix Outline:**
1. Audit: are any in critical paths?
2. Replace: with actual test fixtures
3. Linter rule: reject new placeholder code

---

## 17. LOW: Database Schema Unknown

**ID:** GAP-017  
**Severity:** 🟡 MEDIUM  
**Status:** Unknown  

**Evidence:**
```
.firsttry.db exists (SQLite?)
But: No migrations/ folder
No ORM definitions found (yet)
```

**Impact:**
- Unknown data model
- Unclear constraints and relationships
- Backup/recovery procedures unknown

**Fix Outline:**
1. Audit: does DB exist?
2. If yes: document schema, constraints, indexes
3. If yes: verify migrations exist and work

---

## 18. LOW: Venv Isolation Not Clean

**ID:** GAP-018  
**Severity:** 🟡 MEDIUM  
**Status:** Confirmed  

**Evidence:**
```
.venv-build/ and .venv_tmp/ in git
May have stale packages
Unclear which is primary
```

**Impact:**
- Developers might use wrong venv
- Hard to ensure clean environment

**Fix Outline:**
1. Remove both venvs from git
2. Document: "run `python -m venv .venv`"
3. Add `.venv/` to .gitignore (standard pattern)

---

## Summary Table

| ID | Gap | Severity | Status | Est. Effort |
|----|----|----------|--------|-------------|
| GAP-001 | Missing test deps | 🔴 BLOCKER | Confirmed | 15 min |
| GAP-002 | Venv in git | 🔴 BLOCKER | Confirmed | 30 min |
| GAP-003 | Coverage in git | 🔴 BLOCKER | Confirmed | 15 min |
| GAP-004 | Dead code | 🔴 BLOCKER | Partial | 2-3 days |
| GAP-005 | Tests can't run | 🔴 BLOCKER | Confirmed | Blocks on 001 |
| GAP-006 | Unpinned deps | 🟡 HIGH | Confirmed | 2 hours |
| GAP-007 | Doc conflicts | 🟡 HIGH | Likely | 4 hours |
| GAP-008 | Import patterns | 🟡 HIGH | Confirmed | 2 hours |
| GAP-009 | Entrypoints undoc | 🟡 HIGH | Confirmed | 2 hours |
| GAP-010 | No lock file | 🟡 MEDIUM | Confirmed | 1 hour |
| GAP-011 | JS audit needed | 🟡 MEDIUM | Confirmed | 1 hour |
| GAP-012 | No .env.example | 🟡 MEDIUM | Likely | 30 min |
| GAP-013 | No startup check | 🟡 MEDIUM | Unknown | 2 hours |
| GAP-014 | No API docs | 🟡 MEDIUM | Unknown | 2 hours |
| GAP-015 | Config not validated | 🟡 MEDIUM | Unknown | 1 hour |
| GAP-016 | Placeholders in code | 🟡 MEDIUM | Likely | 4 hours |
| GAP-017 | DB unknown | 🟡 MEDIUM | Unknown | 2 hours |
| GAP-018 | Venv isolation | 🟡 MEDIUM | Confirmed | 30 min |

