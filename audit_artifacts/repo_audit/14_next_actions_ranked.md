# Next Actions (Ranked)

**Generated:** 2025-12-18  
**Total Actions:** 20  
**Estimated Timeline:** 2-3 weeks  

---

## Phase 1: UNBLOCK (IMMEDIATE - Today)

### Action 1: Install Missing Test Dependencies
**Priority:** 🔴 BLOCKER  
**Scope:** Environment setup  
**Files:** N/A (package installation)  
**Effort:** 15 minutes  
**Owner:** DevOps / Build  

**Steps:**
```bash
cd /workspaces/Firstry
.venv_tmp/bin/pip install blake3>=0.4 boto3>=1.34 botocore>=1.34
# OR
.venv_tmp/bin/pip install '.[test]'
```

**Verification:**
```bash
.venv_tmp/bin/python -c "import blake3; import botocore"
.venv_tmp/bin/python -m pytest --collect-only -q | head -20
```

**Expected Result:** Zero import errors, 1000+ tests collected

---

### Action 2: Remove Virtual Environments from Git
**Priority:** 🔴 BLOCKER  
**Scope:** Repo cleanup  
**Files:** .venv-build/, .venv_tmp/, .gitignore  
**Effort:** 30 minutes  
**Owner:** DevOps  

**Steps:**
```bash
# Step 1: Stop tracking
git rm --cached -r .venv-build .venv_tmp --force

# Step 2: Update gitignore
cat >> .gitignore << 'EOF'

# Virtual environments
.venv/
.venv_*/
venv/
env/
.python-version
EOF

# Step 3: Commit
git add .gitignore
git commit -m "chore: remove venv from tracking and update .gitignore"

# Step 4: Verify
git ls-files | grep -c ".venv"  # Should output 0
```

**Verification:**
```bash
git status --short  # Should be clean
git ls-files | wc -l  # Should drop from 12,108 to ~900
du -sh .  # Repo size should drop significantly
```

**Expected Result:** Repo size reduced ~95%

---

### Action 3: Remove Coverage Artifacts from Git
**Priority:** 🔴 BLOCKER  
**Scope:** Repo cleanup  
**Files:** .coverage*, .testmondata  
**Effort:** 15 minutes  
**Owner:** DevOps  

**Steps:**
```bash
git rm --cached .coverage* .testmondata

cat >> .gitignore << 'EOF'

# Test coverage
.coverage
.coverage.*
.testmondata
htmlcov/
EOF

git add .gitignore
git commit -m "chore: remove coverage artifacts from git"
```

**Verification:**
```bash
git status --short  # Clean
git ls-files | grep coverage  # Empty
```

---

### Action 4: Run Full Test Suite (Post Dependencies)
**Priority:** 🔴 BLOCKER  
**Scope:** QA / Testing  
**Files:** All test files  
**Effort:** 30 minutes runtime + analysis  
**Owner:** QA  

**Steps:**
```bash
# Verify dependencies installed
.venv_tmp/bin/pip show blake3 botocore

# Run full test suite
.venv_tmp/bin/python -m pytest \
  -v \
  --tb=short \
  --color=yes \
  2>&1 | tee pytest_full_results.txt

# Generate coverage
.venv_tmp/bin/python -m pytest \
  --cov=src \
  --cov-report=html \
  --cov-report=term-missing
```

**Verification:**
```bash
grep -E "passed|failed|error" pytest_full_results.txt | tail -5
cat htmlcov/status.json | grep -o "percent_covered[^,]*"
```

**Expected Result:** 
- Most tests pass (or show real failures, not import errors)
- Coverage report generated

---

## Phase 2: STABILIZE (This Week)

### Action 5: Audit and Document Dead Code
**Priority:** 🔴 BLOCKER  
**Scope:** Code quality  
**Files:** src/, tests/  
**Effort:** 2-3 days  
**Owner:** Engineering Lead  

**Steps:**
```bash
# Export all stubs
grep -rn "NotImplementedError" src/ --include="*.py" > stubs.txt
grep -rn "^\s*pass\s*$" src/ --include="*.py" >> stubs.txt

# Categorize by module
cut -d: -f1 stubs.txt | sort | uniq -c | sort -rn

# For each module, determine: intentional or dead?
# Create JIRA tickets for each intentional stub with expiration date
```

**Verification:**
```bash
# Every stub should be either:
# 1. Tested (test asserts NotImplementedError)
# 2. In a v2.0 branch/label
# 3. Have JIRA ticket with due date
grep -rn "NotImplementedError\|TODO" src/ --include="*.py" | wc -l
```

**Expected Result:** All stubs categorized and tracked

---

### Action 6: Consolidate Documentation
**Priority:** 🟡 HIGH  
**Scope:** Documentation  
**Files:** README.md, GET_STARTED.md, DEVELOPING.md, etc.  
**Effort:** 4 hours  
**Owner:** Docs  

**Steps:**
```bash
# Step 1: Identify primary README
# Compare timestamps
git log -5 --format="%ai %s" README.md GET_STARTED.md DEVELOPING.md

# Step 2: Designate primary source
# Keep: README.md (most likely to be discovered)
# Merge: GET_STARTED.md → README.md
# Archive: Move others to docs/archived/

# Step 3: Add version checking
# In README, add line: "Last updated: $(date +%F)"
# Automated check: compare with git log
```

**Verification:**
```bash
# One primary README should exist
find . -maxdepth 1 -name "*README*" -o -name "GET_STARTED*" -o -name "QUICKSTART*"
# Should only show 1-2 files (README.md + maybe DEVELOPING.md)
```

---

### Action 7: Create .env.example
**Priority:** 🟡 HIGH  
**Scope:** Documentation / Config  
**Files:** .env.example (new)  
**Effort:** 1 hour  
**Owner:** Engineering  

**Steps:**
```bash
# Step 1: Audit all environment variables
grep -rn "os.environ\|getenv" src/ --include="*.py" | grep -oP '["'"'"']\K[A-Z_]+' | sort | uniq

# Step 2: Create .env.example
cat > .env.example << 'EOF'
# FirstTry Configuration
# Copy this file to .env and fill in values

# Required
FIRSTTRY_PROJECT_DIR=/path/to/project

# Optional (with defaults)
FIRSTTRY_CACHE_DIR=~/.firsttry/cache
FIRSTTRY_LOG_LEVEL=INFO
FIRSTTRY_WORKERS=4

# AWS Integration (if enterprise)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1

# Advanced
DEBUG=false
EOF

# Step 3: Commit
git add .env.example
git commit -m "docs: add .env.example"
```

**Verification:**
```bash
python -c "
import os
import re
# Load .env.example
with open('.env.example') as f:
    env_vars = re.findall(r'^(\w+)=', f.read(), re.MULTILINE)
# Check: do tests/code use any undocumented vars?
print(f'Documented {len(env_vars)} env vars')
"
```

---

### Action 8: Pin Production Dependencies
**Priority:** 🟡 HIGH  
**Scope:** Supply chain  
**Files:** pyproject.toml, requirements.txt  
**Effort:** 2 hours  
**Owner:** DevOps  

**Steps:**
```bash
# Step 1: Generate lock file
pip-compile pyproject.toml --output-file=requirements.txt

# Step 2: Or use poetry
poetry lock

# Step 3: Update CI to use lock file
# In .github/workflows, change: pip install -r requirements.txt
```

**Verification:**
```bash
pip install -r requirements.txt --dry-run
# Should show pinned versions (==, not >=)
```

---

### Action 9: Standardize on One CLI Framework
**Priority:** 🟡 HIGH  
**Scope:** Refactoring  
**Files:** src/firsttry/cli.py, src/firsttry/ft.py  
**Effort:** 4 hours  
**Owner:** Engineering Lead  

**Steps:**
```bash
# Step 1: Audit CLI usage
grep -rn "@typer\|@click\|@argparse" src/ --include="*.py"

# Step 2: Identify primary framework
# Recommendation: typer (modern, async-ready, type-safe)

# Step 3: Refactor minority framework usage
# Create deprecation branch: feature/cli-cleanup

# Step 4: Update entrypoint
# Point to typer-based CLI only
```

**Verification:**
```bash
python -m firsttry.ft --help
python -m firsttry.cli --help
# Both should work, but point to same implementation
```

---

### Action 10: Update Import Patterns
**Priority:** 🟡 HIGH  
**Scope:** Code quality  
**Files:** src/ (import statements)  
**Effort:** 2 hours  
**Owner:** Engineering  

**Steps:**
```bash
# Step 1: Find wildcard imports (most risky)
grep -rn "from .* import \*" src/ --include="*.py"

# Step 2: Replace with explicit imports
# Use ruff auto-fix: ruff check --select F403,F401 src/

# Step 3: Enforce via linter config
# Add to .ruff.toml:
# select = ["F403", "F401"]  # Reject wildcard imports
```

**Verification:**
```bash
grep -rn "import \*" src/  # Should be empty
```

---

## Phase 3: HARDEN (Next 2 Weeks)

### Action 11: Implement Startup Validator ("ft doctor")
**Priority:** 🟡 HIGH  
**Scope:** Feature / UX  
**Files:** src/firsttry/doctor.py (new)  
**Effort:** 2 hours  
**Owner:** Engineering  

**Steps:**
```python
# Create src/firsttry/doctor.py
def validate_startup():
    """Check all required env vars and dependencies."""
    required = [
        'FIRSTTRY_PROJECT_DIR',
    ]
    optional = [
        'AWS_ACCESS_KEY_ID',  # Only if enterprise
    ]
    
    errors = []
    for var in required:
        if not os.environ.get(var):
            errors.append(f"Missing required: {var}")
    
    if errors:
        print("Configuration errors:")
        for e in errors:
            print(f"  ❌ {e}")
        sys.exit(1)
    
    print("✅ All checks passed")
```

**Verification:**
```bash
python -m firsttry doctor  # Should show all OK
unset FIRSTTRY_PROJECT_DIR
python -m firsttry doctor  # Should show helpful error
```

---

### Action 12: Run JavaScript Dependency Audit
**Priority:** 🟡 MEDIUM  
**Scope:** Supply chain  
**Files:** dashboard/, vscode-extension/  
**Effort:** 1 hour  
**Owner:** Frontend  

**Steps:**
```bash
cd dashboard && npm audit --audit-level=high
cd ../vscode-extension && npm audit --audit-level=high
```

**Verification:**
```bash
# Should show: "0 high severity vulnerabilities"
npm audit summary
```

---

### Action 13: Document All Entrypoints
**Priority:** 🟡 HIGH  
**Scope:** Documentation  
**Files:** docs/entrypoints.md (new)  
**Effort:** 2 hours  
**Owner:** Docs  

**Steps:**
```bash
# Create docs/entrypoints.md documenting:
# 1. Primary CLI: python -m firsttry.ft [commands]
# 2. Dev CLI: python -m firsttry.cli [dev commands]
# 3. Scripts: scripts/run_all_tests.sh
# 4. FastAPI server (if applicable)

# Include: expected output, required env vars, example usage
```

**Verification:**
```bash
# Test each entrypoint
python -m firsttry.ft --help
python -m firsttry.cli --help
bash scripts/run_all_tests.sh --help
```

---

### Action 14: Investigate Database Schema
**Priority:** 🟡 MEDIUM  
**Scope:** Data model audit  
**Files:** src/, .firsttry.db  
**Effort:** 2 hours  
**Owner:** Data/Backend  

**Steps:**
```bash
# Step 1: Check if SQLite
file .firsttry.db  # Shows: "SQLite 3.x database"

# Step 2: Inspect schema
sqlite3 .firsttry.db ".schema"

# Step 3: Document tables, columns, indexes
# Create docs/database_schema.md

# Step 4: Verify data integrity constraints
sqlite3 .firsttry.db "PRAGMA foreign_key_list(table_name);"
```

**Verification:**
```bash
# Every table should have constraints/indexes
sqlite3 .firsttry.db ".indexes"
```

---

### Action 15: Add Input Validation Tests
**Priority:** 🟡 MEDIUM  
**Scope:** Security / QA  
**Files:** tests/security/ (new folder)  
**Effort:** 3 hours  
**Owner:** QA  

**Steps:**
```bash
# Create tests/security/test_input_validation.py
# Test all public APIs for:
# - Empty string handling
# - SQL injection attempts
# - Path traversal attempts
# - Unicode/encoding issues
```

**Verification:**
```bash
pytest tests/security/ -v
```

---

### Action 16: Create SBOM (Software Bill of Materials)
**Priority:** 🟡 MEDIUM  
**Scope:** Supply chain  
**Files:** sbom.json (new)  
**Effort:** 1 hour  
**Owner:** DevOps  

**Steps:**
```bash
# Install tool
pip install cyclonedx-bom

# Generate SBOM
cyclonedx-bom -o sbom.json

# Commit
git add sbom.json
git commit -m "docs: add software bill of materials"
```

---

### Action 17: Document Architecture
**Priority:** 🟡 MEDIUM  
**Scope:** Documentation  
**Files:** docs/architecture.md (new)  
**Effort:** 3 hours  
**Owner:** Lead Engineer  

**Steps:**
```bash
# Create docs/architecture.md including:
# - System components (CLI, cache, executor, etc.)
# - Data flow diagrams
# - Sequence diagrams
# - Module dependencies
```

---

### Action 18: Set Up Pre-Commit Hooks
**Priority:** 🟡 MEDIUM  
**Scope:** Code quality  
**Files:** .pre-commit-config.yaml (already exists, verify)  
**Effort:** 1 hour  
**Owner:** DevOps  

**Steps:**
```bash
# Verify pre-commit is configured
cat .pre-commit-config.yaml

# Install hooks
pre-commit install

# Test
pre-commit run --all-files
```

---

### Action 19: Create Contributing Guidelines
**Priority:** 🟡 MEDIUM  
**Scope:** Documentation  
**Files:** CONTRIBUTING.md (already exists, update)  
**Effort:** 2 hours  
**Owner:** Docs  

**Steps:**
```bash
# Update CONTRIBUTING.md to include:
# - Code style (ruff, black, mypy settings)
# - Test requirements
# - PR checklist
# - CI/CD pipeline explanation
```

---

### Action 20: Schedule Technical Debt Backlog Grooming
**Priority:** 🟡 MEDIUM  
**Scope:** Process  
**Files:** N/A (team process)  
**Effort:** 1 hour (recurring)  
**Owner:** Tech Lead  

**Steps:**
1. Create "technical-debt" GitHub label
2. Convert all identified gaps to GitHub Issues
3. Prioritize in next sprint planning
4. Monthly review to ensure new debt isn't accumulating

**Verification:**
```bash
# After each sprint, check:
git log --oneline --grep="tech debt\|refactor" | wc -l
# Should show steady progress
```

---

## Summary Table

| # | Action | Phase | Priority | Effort | Owner |
|---|--------|-------|----------|--------|-------|
| 1 | Install test deps | Unblock | 🔴 | 15m | DevOps |
| 2 | Remove venv from git | Unblock | 🔴 | 30m | DevOps |
| 3 | Remove coverage from git | Unblock | 🔴 | 15m | DevOps |
| 4 | Run full tests | Unblock | 🔴 | 30m | QA |
| 5 | Audit dead code | Stabilize | 🔴 | 2d | Lead |
| 6 | Consolidate docs | Stabilize | 🟡 | 4h | Docs |
| 7 | Create .env.example | Stabilize | 🟡 | 1h | Eng |
| 8 | Pin dependencies | Stabilize | 🟡 | 2h | DevOps |
| 9 | Standardize CLI | Stabilize | 🟡 | 4h | Lead |
| 10 | Update imports | Stabilize | 🟡 | 2h | Eng |
| 11 | Implement "ft doctor" | Harden | 🟡 | 2h | Eng |
| 12 | JS audit | Harden | 🟡 | 1h | FE |
| 13 | Document entrypoints | Harden | 🟡 | 2h | Docs |
| 14 | Investigate DB | Harden | 🟡 | 2h | Backend |
| 15 | Add security tests | Harden | 🟡 | 3h | QA |
| 16 | Create SBOM | Harden | 🟡 | 1h | DevOps |
| 17 | Document architecture | Harden | 🟡 | 3h | Lead |
| 18 | Set up pre-commit | Harden | 🟡 | 1h | DevOps |
| 19 | Update CONTRIBUTING | Harden | 🟡 | 2h | Docs |
| 20 | Schedule debt grooming | Harden | 🟡 | 1h | Lead |

---

## Milestones

**End of Today:** Actions 1-4 complete (tests unblocked)
**End of Week:** Actions 1-10 complete (repo stabilized)
**End of Month:** Actions 1-20 complete (hardened)

## Success Criteria

- ✅ All tests pass
- ✅ No venv or coverage artifacts in git
- ✅ Repo size <50MB
- ✅ Documentation unified and current
- ✅ CI/CD fully functional
- ✅ All gaps tracked in GitHub Issues
- ✅ Zero high-severity security issues
