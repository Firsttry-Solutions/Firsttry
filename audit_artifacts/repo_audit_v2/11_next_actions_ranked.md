# 11 — Next Actions (Ranked Priority List)

**Date**: 2024-12-18  
**Scope**: 25 ranked actions to restore full audit capability and close critical gaps  
**Effort Total**: ~18 hours estimated  

---

## PHASE 1: UNBLOCK TEST & RUNTIME VERIFICATION (0.5 hours)

### Action 1: Install Package and Core Dependencies

**Scope**: Make firsttry runnable in audit environment  
**Impact**: Unblocks CLI testing + test collection  
**Effort**: 0.2 hours

**Command**:
```bash
cd /workspaces/Firstry
pip install -e .
pip install pytest pytest-cov pytest-timeout
```

**Files Modified**: None (installation only)  
**Verification**:
```bash
python -m firsttry --version        # Should print: 1.0.0
pytest --version                    # Should print: pytest X.Y.Z
```

**Done Means**: Both commands succeed; no errors

**Risk**: LOW (standard dependency install)

---

### Action 2: Capture CLI Help Output

**Scope**: Document CLI interface for analysis  
**Impact**: Proves entrypoint works; documents subcommands  
**Effort**: 0.05 hours

**Command**:
```bash
python -m firsttry --help 2>&1 | tee audit_artifacts/repo_audit_v2/raw/cli_help_final.txt
python -m firsttry doctor --help 2>&1 | tee -a audit_artifacts/repo_audit_v2/raw/cli_help_final.txt
```

**Verification**: Files contain help output; no errors

**Done Means**: `cli_help_final.txt` has 50+ lines of help text

---

### Action 3: Run Pytest Collection (Full)

**Scope**: Discover all test nodes; generate test matrix  
**Impact**: Complete test inventory for 05_tests_matrix.md  
**Effort**: 0.15 hours

**Command**:
```bash
pytest --collect-only -q 2>&1 | tee audit_artifacts/repo_audit_v2/raw/pytest_collect_final.txt
pytest --collect-only --co -q 2>&1 | grep "^tests/" | wc -l | tee audit_artifacts/repo_audit_v2/raw/pytest_count.txt
```

**Verification**: 
- File contains list of test nodes
- Count > 200

**Done Means**: `pytest_collect_final.txt` has 250+ lines

---

### Action 4: Run Smoke Tests (Targeted)

**Scope**: Execute subset of tests to verify test framework  
**Impact**: Proves tests can run; captures first failures  
**Effort**: 0.1 hours

**Command**:
```bash
pytest tests/test_imports_smoke.py -v 2>&1 | tee audit_artifacts/repo_audit_v2/raw/pytest_smoke_run.txt || true
```

**Verification**: 
- Output shows test results (pass/fail)
- No import errors

**Done Means**: Output shows "PASSED" or traceable "FAILED" with error

---

## PHASE 2: COMPLETE ENTRYPOINT ANALYSIS (1 hour)

### Action 5: Generate Complete CLI Surface Map

**Scope**: Document all subcommands + options  
**Impact**: Proves CLI completeness; unblocks 04_entrypoints_and_runtime.md  
**Effort**: 0.2 hours

**Command**:
```bash
python -c "
from src.firsttry.cli import main as cli_main
import click
app = cli_main
for name, cmd in app.commands.items() if hasattr(app, 'commands') else []:
    print(f'Subcommand: {name}')
" 2>&1 | tee audit_artifacts/repo_audit_v2/raw/cli_subcommands.txt || echo "Inspect manually"
```

**Verification**: Subcommand list generated

**Done Means**: `cli_subcommands.txt` lists 5+ subcommands or manual inspection done

---

### Action 6: Verify Package Entry Points

**Scope**: Check setup.py / pyproject.toml for CLI entry  
**Impact**: Proves CLI is distributable  
**Effort**: 0.1 hours

**Command**:
```bash
grep -A5 "\[project.scripts\]" pyproject.toml | tee audit_artifacts/repo_audit_v2/raw/entry_points.txt
```

**Verification**: Entry point for `firsttry` command defined

**Done Means**: File shows `firsttry = "src.firsttry.cli:main"`

---

### Action 7: Test FastAPI App Startup (if applicable)

**Scope**: Verify alternative entrypoint  
**Impact**: Completes runtime analysis  
**Effort**: 0.15 hours

**Command**:
```bash
python -c "from app.main import app; print('FastAPI app imports OK')" 2>&1 | tee audit_artifacts/repo_audit_v2/raw/fastapi_startup.txt
```

**Verification**: Import succeeds or fails cleanly

**Done Means**: File contains "imports OK" or clear error message

---

### Action 8: Document Auto-Parity Bootstrap Behavior

**Scope**: Explain first-run .venv-parity setup  
**Impact**: User education; prevents confusion  
**Effort**: 0.2 hours

**Files**:
- Edit: `CONTRIBUTING.md` (or create if missing)
- Add section: "First-Run Behavior"

**Content Template**:
```markdown
## First-Run Behavior

On first execution, `firsttry` automatically sets up a CI parity environment:

1. Detects `.git/` and `ci/parity.lock.json`
2. Creates `.venv-parity/` virtual environment
3. Installs dependencies from lock file
4. Installs git hooks (if configured)

**Opt-out**: `export FIRSTTRY_DISABLE_AUTO_PARITY=1`
```

**Verification**: CONTRIBUTING.md contains section

**Done Means**: Section is readable and explains opt-out clearly

---

## PHASE 3: DATABASE & MODELS VERIFICATION (0.5 hours)

### Action 9: Inspect Database Models

**Scope**: Catalog all SQLAlchemy models + constraints  
**Impact**: Completes 07_db_and_migrations.md  
**Effort**: 0.2 hours

**Command**:
```bash
python -c "
from src.firsttry.models import *
import inspect
models = [m for m in dir() if not m.startswith('_') and inspect.isclass(eval(m))]
for m in models:
    print(f'Model: {m}')
" 2>&1 | tee audit_artifacts/repo_audit_v2/raw/db_models.txt
```

**Verification**: Models list generated

**Done Means**: File contains list of 5+ models or error logged

---

### Action 10: Check for Alembic Migrations

**Scope**: Locate migration files; document version control  
**Impact**: Determines if DB schema is versioned  
**Effort**: 0.1 hours

**Command**:
```bash
find . -path "*/alembic/versions/*.py" -o -path "*/migrations/*.py" | tee audit_artifacts/repo_audit_v2/raw/migrations_list.txt || echo "No migrations found"
```

**Verification**: List or note of no migrations

**Done Means**: File generated with contents

---

### Action 11: Verify DB Connection String Handling

**Scope**: Check DATABASE_URL environment handling  
**Impact**: Security review completion  
**Effort**: 0.15 hours

**Command**:
```bash
grep -rn "DATABASE_URL" src/ | grep -v "# " | head -5 | tee audit_artifacts/repo_audit_v2/raw/db_url_usage.txt
```

**Verification**: Usage patterns documented

**Done Means**: File shows how DATABASE_URL is used (parsed, logged, etc.)

---

## PHASE 4: CONFIGURATION SCHEMA DOCUMENTATION (1.5 hours)

### Action 12: Reverse-Engineer `.firsttry.yml` Schema

**Scope**: Document required/optional fields + types  
**Impact**: Enables users to configure project  
**Effort**: 0.5 hours

**Method**: Inspect `src/firsttry/config/schema.py` or pydantic models

**Command**:
```bash
python -c "
from src.firsttry.config.schema import *
import inspect
print(inspect.getsource(FirstTryConfig) if 'FirstTryConfig' in dir() else 'Schema not found')
" 2>&1 | tee audit_artifacts/repo_audit_v2/raw/config_schema_source.txt
```

**Output File**: Create `audit_artifacts/repo_audit_v2/12_config_schema.md`

**Template**:
```markdown
# Configuration Schema

## `.firsttry.yml` Format

### Required Fields
- `version` (str): Config version (e.g., "1.0")

### Optional Fields
- `checks` (list): Which checks to run
- `gates` (list): Which gates to enforce
- `profile` (str): Predefined profile (standard/strict/pro)
- ...

### Example
```yaml
version: "1.0"
checks: [pytest, mypy, ruff]
profile: "standard"
```
"""

**Verification**: Schema doc created; all fields documented

**Done Means**: `12_config_schema.md` exists with examples

---

### Action 13: Document Profile Modes (Free/Pro/Enterprise)

**Scope**: Explain tier-based feature gates  
**Impact**: Users understand feature availability  
**Effort**: 0.3 hours

**Files**: Create `audit_artifacts/repo_audit_v2/13_tier_system.md`

**Content Template**:
```markdown
# Tier System

## Free Tier
- Basic checks: pytest, mypy, ruff
- Local caching only
- No AI/ML features

## Pro Tier
- All free tier +
- S3 remote cache
- Advanced optimization
- License: FSAL 1.0 (requires key)

## Enterprise Tier
- All pro tier +
- Custom policies
- Security scanning
- SLA support
```

**Verification**: Document created; tiers explained

**Done Means**: Users understand feature mapping to tiers

---

### Action 14: Generate Configuration Examples

**Scope**: Provide copy-paste config templates  
**Impact**: Users can get started faster  
**Effort**: 0.3 hours

**Files**: Create `docs/config-examples.md`

**Examples**:
1. Minimal config (pytest only)
2. Standard config (tests + type checking + linting)
3. Strict config (all gates)
4. Pro config (with S3 cache)

**Verification**: Examples provided for each tier

**Done Means**: docs/config-examples.md has 4+ working examples

---

## PHASE 5: DOCUMENTATION CONSOLIDATION (6 hours)

### Action 15: Audit All Root .md Files

**Scope**: Categorize 120+ markdown files; identify conflicts  
**Impact**: Identifies consolidation priorities  
**Effort**: 1.5 hours

**Command**:
```bash
find . -maxdepth 1 -name "*.md" ! -path "*/audit_artifacts/*" | sort > audit_artifacts/repo_audit_v2/raw/root_md_files_full.txt
wc -l audit_artifacts/repo_audit_v2/raw/root_md_files_full.txt
```

**Analysis**: Categorize by pattern
- PHASE_* files: Phase delivery docs (archive?)
- *_COMPLETE.md: Completion reports (archive?)
- DEVELOPMENT guides: DEVELOPING.md, QUICKSTART_DEV.md, etc.
- OPERATIONAL: Performance, benchmarks, etc.

**Output**: Create `audit_artifacts/repo_audit_v2/14_docs_consolidation_plan.md`

**Verification**: Plan created with categories + recommendations

**Done Means**: Plan outlines what to keep/archive/consolidate

---

### Action 16: Identify Truth Sources vs. Deliverables

**Scope**: Separate "living docs" from "point-in-time" reports  
**Impact**: Clarifies which docs to maintain  
**Effort**: 1 hour

**Living Docs** (maintain):
- README.md (entry point)
- CONTRIBUTING.md (contribution guidelines)
- DEVELOPING.md (setup + architecture)

**Point-in-Time** (archive):
- *_COMPLETE.md (delivery reports)
- *_REPORT.md (audit/analysis snapshots)
- PHASE_*.md (milestone reports)

**Recommendation**: Move archived docs to `docs/archive/` or branch

**Verification**: Classification documented

**Done Means**: Decision matrix created in consolidation plan

---

### Action 17: Consolidate Quickstart Guides

**Scope**: Merge README.md, QUICKSTART_DEV.md, GET_STARTED.md  
**Impact**: Single entry point; no confusion  
**Effort**: 1.5 hours

**Current State**:
- README.md (what is firsttry)
- GET_STARTED.md (how to install)
- QUICKSTART_DEV.md (dev setup)
- DEVELOPING.md (architecture)

**Proposed Structure**:
```
README.md
├── What is FirstTry (problem statement)
├── Quick Start (5-minute install)
└── Links to CONTRIBUTING.md, docs/

CONTRIBUTING.md
├── Development Setup
├── Making Changes
├── Testing Checklist
└── Releasing

DEVELOPING.md
├── Architecture Overview
├── Module Guide (src/, tests/, tools/)
└── Advanced Customization
```

**Verification**: Single-threaded guide from start to contribution

**Done Means**: README → CONTRIBUTING → DEVELOPING flows clearly

---

### Action 18: Deprecate or Explain Duplicate Docs

**Scope**: For each conflicting pair, decide: keep one or merge  
**Impact**: No confusion; clear guidance  
**Effort**: 1 hour

**Examples**:
- `CLI_INTEGRATION_GUIDE.md` vs. `CLI_COMPATIBILITY_SUMMARY.md` → Merge or delete?
- `PERFORMANCE_OPTIMIZATION_SUMMARY.md` vs. `FT_VS_MANUAL_BENCHMARK.md` → Which is current?
- Multiple `*_IMPLEMENTATION.md` files → Which is the spec?

**Action**: For each pair, commit decision
- Merge content into single file
- Or: Clearly state which is canonical + deprecate other
- Or: Archive to `docs/archive/` with rationale

**Verification**: Duplicates resolved; decisions documented

**Done Means**: No conflicting guides exist; precedence clear

---

## PHASE 6: CODE QUALITY & ARCHITECTURE DOCUMENTATION (2 hours)

### Action 19: Document CLI Variants & Consolidation Path

**Scope**: Explain each of 8 cli_*.py files; retire unused ones  
**Impact**: Reduces cognitive load; simplifies maintenance  
**Effort**: 1 hour

**Files to Review**:
- cli.py (CANONICAL)
- cli_main.py (compat? legacy?)
- cli_enhanced.py (experimental?)
- cli_v2.py (rewrite in progress?)
- [5 others]

**Decision per file**:
- Keep: Document purpose + integration point
- Deprecate: Add `__deprecated__` marker; log warning
- Remove: If unused, delete + verify tests pass

**Output**: Create `CONTRIBUTING.md` section: "CLI Architecture"

**Verification**: Each cli_*.py has documented purpose

**Done Means**: CONTRIBUTING.md explains CLI design + maintenance plan

---

### Action 20: Document tools/firsttry/ Intent

**Scope**: Explain why src/firsttry/ is duplicated in tools/  
**Impact**: Prevents accidental divergence  
**Effort**: 0.3 hours

**Decision Points**:
1. Is it a build artifact? (should be auto-generated)
2. Is it intentional? (should have sync script + tests)
3. Is it stale? (should be removed)

**Output**: Create `tools/README.md` with rationale

**Template**:
```markdown
# Tools Directory

## `tools/firsttry/`

**Purpose**: [Intentional copy for bundling? Stale artifact? Test isolation?]

**Maintenance**: 
- Manual sync required: [list source files that need updating]
- Or: Auto-generated by build script
- Or: Deprecated; use src/firsttry/ directly

**When to Update**: [Criteria for syncing]
```

**Verification**: Rationale documented; team aligned

**Done Means**: tools/README.md explains the intent + maintenance procedure

---

### Action 21: Create Type Checking Compliance Report

**Scope**: Document mypy configuration + baseline compliance  
**Impact**: Ensures typing quality is maintained  
**Effort**: 0.5 hours

**Command**:
```bash
python -m mypy src/firsttry --ignore-missing-imports --html=audit_artifacts/repo_audit_v2/raw/mypy_report.html 2>&1 | tee audit_artifacts/repo_audit_v2/raw/mypy_summary.txt
```

**Output**: Create `audit_artifacts/repo_audit_v2/15_type_checking_report.md`

**Content**:
- Mypy version + config
- Coverage % (lines typed / total)
- Top untyped modules
- Compliance baseline (target: X%)

**Verification**: Report generated; baseline set

**Done Means**: Mypy report shows type coverage % + action plan

---

### Action 22: Triage Active TODO Comments

**Scope**: Convert 3 TODOs to GitHub Issues  
**Impact**: Backlog visibility; no forgotten work  
**Effort**: 0.3 hours

**TODOs to Create Issues For**:
1. `checks_orchestrator_optimized.py:35` — "for very large repos, consider [optimization]"
2. `tests/prune.py:78` — "Implement more sophisticated dependency analysis"
3. `config_loader.py:119` — "grep -R 'TODO(admin)' src/"

**Issue Template**:
```markdown
**Title**: [Brief description from TODO]

**Description**: 
Suggested in code at [file:line].

**Impact**: [Why does this matter?]

**Suggested Approach**: [TODO text]

**Labels**: enhancement, tech-debt
```

**Verification**: Issues created and linked in code comments

**Done Means**: 3+ issues created; code comments reference issue numbers

---

## PHASE 7: SECURITY & LICENSING REVIEW (1 hour)

### Action 23: Verify Secret Scan Configuration

**Scope**: Ensure secret scanning is active in CI  
**Impact**: Prevents accidental credential leaks  
**Effort**: 0.2 hours

**Command**:
```bash
grep -A10 "secret" .github/workflows/*.yml | head -30 | tee audit_artifacts/repo_audit_v2/raw/ci_secret_scan.txt
```

**Check Points**:
- Is bandit configured in CI?
- Does CI block on secret detection?
- Is scanning documented in SECURITY.md?

**Verification**: CI runs secret scans

**Done Means**: CI workflow shows secret scan step with `fail_on_error: true`

---

### Action 24: Document License Grant & Restrictions

**Scope**: Clarify FSAL 1.0 implications for users  
**Impact**: Legal clarity; reduces license confusion  
**Effort**: 0.3 hours

**Output**: Create section in README.md or docs/LICENSE.md

**Content**:
```markdown
# License: FirstTry Source-Available License (FSAL 1.0)

## Can I...
- **Use in production?** ✅ YES (with license key for Pro/Enterprise)
- **Modify code?** ✅ YES (for internal use)
- **Distribute modified version?** ❌ NO (source-available, not open source)
- **Fork this repo?** ✅ YES (but resulting derivative is yours to maintain)
- **Sell it?** ❌ NO (commercial licensing required)

## For Commercial Use
Contact: [email]

## Full License
See LICENSE file.
```

**Verification**: README has license FAQ

**Done Means**: License questions answered in user-facing materials

---

### Action 25: Verify Dependency Security (Bandit/Safety)

**Scope**: Run security scan on dependencies  
**Impact**: Flags known vulnerabilities  
**Effort**: 0.2 hours

**Command**:
```bash
pip install safety bandit
bandit -r src/ -f json -o audit_artifacts/repo_audit_v2/raw/bandit_results.json 2>&1 | head -50 | tee audit_artifacts/repo_audit_v2/raw/bandit_summary.txt
```

**Verification**: Scan completes; results logged

**Done Means**: bandit_results.json exists; HIGH/CRITICAL issues (if any) documented

---

## Final Assembly: Generate Comprehensive Audit Report

### Action 26: Create Executive Summary

**Scope**: One-page overview of audit findings  
**Impact**: Executives/stakeholders can understand status  
**Effort**: 0.5 hours

**Output**: Create `audit_artifacts/repo_audit_v2/EXECUTIVE_SUMMARY.md`

**Sections**:
- **Repo Health**: 965 files, well-organized, Phase 0 complete
- **Critical Findings**: 2 blockers (now resolved), 3 high-priority gaps
- **Recommendation**: Ready for production with 3-4 week consolidation phase
- **Timeline**: 18 hours to full remediation

**Verification**: Summary captures key points from all reports

**Done Means**: Summary provides clear status + next steps

---

## Implementation Checklist

- [ ] Phase 1: Install deps + run tests (0.5 hrs)
- [ ] Phase 2: Complete entrypoint analysis (1 hr)
- [ ] Phase 3: Verify database models (0.5 hrs)
- [ ] Phase 4: Document configuration (1.5 hrs)
- [ ] Phase 5: Consolidate docs (6 hrs)
- [ ] Phase 6: Architecture documentation (2 hrs)
- [ ] Phase 7: Security review (1 hr)
- [ ] Final: Executive summary (0.5 hrs)

**Total Estimated Time**: ~18 hours

---

## Success Criteria

✅ All 11 audit deliverables complete  
✅ All blockers resolved  
✅ All high-priority gaps documented + action planned  
✅ Test suite executable and passing (or failures documented)  
✅ Configuration & tier system explained to users  
✅ Documentation consolidated & truth sources clear  
✅ Security posture verified  
✅ Architecture decisions documented  

---

**Audit Status**: 🟡 PARTIALLY COMPLETE (evidence collected; running actions will complete)

**Next**: Execute Action 1 (pip install -e .) to unblock remaining actions.

