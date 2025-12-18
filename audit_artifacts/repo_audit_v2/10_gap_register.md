# 10 — Gap Register (Master Issues List)

**Date**: 2024-12-18  
**Generated From**: Steps A-H audit  
**Severity Scale**: BLOCKER (3) → HIGH (2) → MED (1) → LOW (0)  

---

## Critical Blockers

### BLK-01: Test Suite Execution Blocked by Missing Dependencies

**Severity**: BLOCKER  
**Impact**: Cannot verify test pass/fail; cannot generate test matrix  
**Root Cause**: Audit environment isolated; pytest not installed  
**Evidence**: `raw/pytest_collect_only.txt` (error output)

**Fix Outline**:
```bash
pip install -e .              # Install package + core deps
python -m pytest --collect-only -q 2>&1 | tee audit_artifacts/repo_audit_v2/raw/pytest_final_collect.txt
```

**Verification**: `pytest --collect-only` produces test count > 0

**Effort**: LOW (single install + pytest run)

---

### BLK-02: Package Not Installable in Current Environment (Full Deps)

**Severity**: BLOCKER  
**Impact**: Cannot run firsttry CLI to test entrypoint  
**Root Cause**: `pip install -e .` not executed; optional deps (boto3) not available  
**Evidence**: `python -m firsttry --help` fails with "No module named firsttry"

**Fix Outline**:
```bash
pip install -e .              # Core install
python -m firsttry --version  # Verify CLI works
```

**Verification**: `firsttry --version` returns "1.0.0"

**Effort**: LOW (pip install)

---

## High-Priority Gaps

### HP-01: CLI Architecture Documentation Missing

**Severity**: HIGH  
**Impact**: Developers don't know which cli_*.py is authoritative  
**Evidence**: 8 cli_*.py files with overlapping names (cli.py, cli_main.py, cli_v2.py, etc.)  
**Root Cause**: Iterative CLI redesigns without cleanup

**Fix Outline**:
1. Verify cli.py is canonical (it is, based on __main__.py)
2. Document purpose of each variant
3. Deprecate/remove unused variants
4. Update DEVELOPING.md

**Verification**: DEVELOPING.md explains cli_*.py roles

**Effort**: MED (code review + 2 KB doc)

---

### HP-02: `.firsttry.yml` Schema Not Documented

**Severity**: HIGH  
**Impact**: Users cannot configure project without trial-and-error  
**Evidence**: File exists; no schema documentation found  
**Root Cause**: Assumed documentation present; not in scope of this audit

**Fix Outline**:
1. Read src/firsttry/config/schema.py (likely contains schema)
2. Generate schema.md or schema.json
3. Add to docs/

**Verification**: docs/configuration.md contains full schema with examples

**Effort**: MED (1-2 hours to document)

---

### HP-03: Database Schema Not Verified

**Severity**: HIGH  
**Impact**: Cannot assess data integrity constraints  
**Evidence**: `src/firsttry/db_sqlite.py` and `db_pg.py` exist but not scanned  
**Root Cause**: Requires running tests or importing models

**Fix Outline**:
```bash
python -c "from src.firsttry.models import *; print([m for m in dir() if not m.startswith('_')])"
```

**Verification**: Models list generated; constraints documented

**Effort**: LOW (single import)

---

## Medium-Priority Gaps

### MP-01: Documentation Fragmentation (120+ .md Files at Root)

**Severity**: MED  
**Impact**: Truth source confusion; conflicting quickstarts likely  
**Evidence**: `raw/md_files_list.txt` shows 120+ markdown files at root level  
**Root Cause**: Multi-phase delivery; each phase generated completion docs

**Fix Outline**:
1. Inventory all .md files by category
2. Identify conflicting guides
3. Create consolidation roadmap
4. Move to `docs/` or archive

**Examples of Risk**:
- `README.md` vs `QUICKSTART_DEV.md` — likely different
- `GET_STARTED.md` vs `DEVELOPING.md` — similar names
- `INSTALLATION_*.md` (multiple versions)

**Verification**: Single authoritative README + CONTRIBUTING + DEVELOPING in root

**Effort**: HIGH (full review + consolidation)

---

### MP-02: Code Duplication: `tools/firsttry/` Mirrors `src/firsttry/`

**Severity**: MED  
**Impact**: Maintenance burden; inconsistencies over time  
**Evidence**: 47 files in tools/firsttry/ (verified file count)  
**Root Cause**: Unknown; possibly tooling compatibility or build artifact

**Fix Outline**:
1. Document intent (Why is there a duplicate?)
2. Options:
   - If intentional: Add build rule to keep in sync
   - If accidental: Remove and fix imports
   - If for bundling: Document and automate

**Verification**: Intent documented in CONTRIBUTING.md or tools/README.md

**Effort**: MED (architecture decision + 1 KB doc)

---

### MP-03: License Type May Confuse Users

**Severity**: MED  
**Impact**: License compliance confusion; FSAL 1.0 is non-standard  
**Evidence**: `LICENSE` file; pyproject.toml uses "FirstTry Source-Available License (FSAL 1.0)"  
**Root Cause**: Custom license; not OSI-approved

**Fix Outline**:
1. Clarify in README: "Source-available, not open source"
2. Add FAQs: Can I fork? Can I contribute back? Can I use in production?
3. Link to license in code headers (recommended)

**Verification**: README has "License" section; includes FAQs

**Effort**: LOW (0.5 hours)

---

### MP-04: Auto-Parity Bootstrap Not Obvious

**Severity**: MED  
**Impact**: Developers surprised by automatic env setup on first run  
**Evidence**: Code in `src/firsttry/cli.py` (lines ~80-100)  
**Root Cause**: Feature added; not documented in user-facing materials

**Fix Outline**:
1. Add callout in CONTRIBUTING.md: "First run sets up .venv-parity/"
2. Document opt-out: `FIRSTTRY_DISABLE_AUTO_PARITY=1`
3. Explain rationale: "Ensures CI parity without manual steps"

**Verification**: CONTRIBUTING.md has section on first-run behavior

**Effort**: LOW (0.5 hours)

---

### MP-05: No Startup Validation for License Env Var

**Severity**: MED  
**Impact**: License key not enforced early; errors may occur late  
**Evidence**: `FIRSTTRY_LICENSE_KEY` is optional; no required= pattern detected  
**Root Cause**: Tier system is graceful-degrading (works without license)

**Fix Outline**:
1. Determine: Should license be required or optional?
2. If optional: Document fallback behavior (tier=free)
3. If required: Add validation in cli.py startup

**Verification**: Error message or doc explains license behavior

**Effort**: LOW (if doc-only) or MED (if validation needed)

---

## Low-Priority Gaps

### LP-01: 3 Active TODO Comments in Code

**Severity**: LOW  
**Impact**: Incomplete features or workarounds  
**Evidence**: `raw/rg_todos.txt`  
**Examples**:
- `src/firsttry/checks_orchestrator_optimized.py:35` — "for very large repos, consider..."
- `src/firsttry/tests/prune.py:78` — "Implement more sophisticated dependency analysis"
- `src/firsttry/config_loader.py:119` — "grep -R 'TODO(admin)'"

**Fix Outline**: Review each TODO; convert to GitHub Issue if actionable

**Verification**: Backlog has corresponding issues

**Effort**: LOW (0.5 hours to triage)

---

### LP-02: Minimal Type Checking Baseline

**Severity**: LOW  
**Impact**: Type coverage may drift  
**Evidence**: `.quality/typing_baseline.txt` (1 file; content unknown)  
**Root Cause**: Type checking configured but baseline minimal

**Fix Outline**: Run mypy --version and check baseline compliance

**Verification**: `mypy src/ --ignore-missing-imports` produces report

**Effort**: LOW (single command)

---

### LP-03: VSCode Extension May Have Integration Gaps

**Severity**: LOW  
**Impact**: IDE experience incomplete  
**Evidence**: 12 files in vscode-extension/; only basic inspection done  
**Root Cause**: Separate concern; not core audit focus

**Fix Outline**: Extension review out of scope for now

**Verification**: N/A (marked as deferred)

**Effort**: N/A

---

### LP-04: `tools/` Duplication of Embedded Firsttry

**Severity**: LOW  
**Impact**: Maintenance overhead; 47 files  
**Evidence**: `tools/firsttry/` is full copy of src/firsttry/  
**Root Cause**: Bundling strategy; purpose unclear

**Fix Outline**: Document why; consolidate if possible

**Verification**: tools/README.md explains rationale

**Effort**: LOW (doc)

---

## Observations (Not Gaps)

### OB-01: Well-Organized Test Suite

- ✅ 255 test files with clear categorization
- ✅ Enterprise tier tests segregated
- ✅ CI parity tests comprehensive
- **Assessment**: GOOD

### OB-02: Comprehensive CI/CD Workflows

- ✅ 28 workflow files; high coverage (audit, quality, hardening, parity)
- ✅ Matrix testing across Python versions
- **Assessment**: GOOD

### OB-03: Multi-Tier Licensing Implementation

- ✅ Free, standard, pro tiers; cleanly gated
- ✅ License guard in place
- **Assessment**: GOOD

### OB-04: Rust Integration (Fastpath)

- ✅ Optional native module; properly gated
- ✅ Fallback to pure Python
- **Assessment**: GOOD

---

## Summary Table

| ID | Gap | Severity | Effort | Status |
|----|-----|----------|--------|--------|
| **BLK-01** | Test execution blocked | BLOCKER | LOW | Ready to fix |
| **BLK-02** | Package not installed | BLOCKER | LOW | Ready to fix |
| **HP-01** | CLI architecture unclear | HIGH | MED | Design decision needed |
| **HP-02** | Config schema not documented | HIGH | MED | Quick win |
| **HP-03** | Database schema unverified | HIGH | LOW | One import away |
| **MP-01** | Docs fragmented (120+ .md) | MED | HIGH | Big consolidation project |
| **MP-02** | Duplicate tools/firsttry/ | MED | MED | Needs strategy |
| **MP-03** | License confusion | MED | LOW | Doc-only |
| **MP-04** | Auto-parity not documented | MED | LOW | Doc-only |
| **MP-05** | License validation optional | MED | LOW-MED | Design decision |
| **LP-01** | 3 TODOs in code | LOW | LOW | Triage to issues |
| **LP-02** | Minimal type baseline | LOW | LOW | Review baseline |
| **LP-03** | Extension gaps | LOW | N/A | Deferred |
| **LP-04** | Tools duplication doc | LOW | LOW | Doc-only |

---

## Priority Matrix

### Must-Fix (Blocking)
1. BLK-01: Install deps & run tests
2. BLK-02: Install package
3. HP-02: Document config schema
4. HP-03: Verify database models

### Should-Fix (High Value)
5. MP-01: Consolidate docs
6. HP-01: Clarify CLI architecture
7. MP-02: Document tools/ strategy

### Nice-To-Fix (Low Effort)
8. MP-03: License clarity doc
9. MP-04: Auto-parity documentation
10. LP-01: Triage TODOs to issues

---

## Estimated Timeline

- **Blockers**: 0.5 hours (install deps, run tests)
- **High-Priority**: 4-6 hours (config doc, architecture review)
- **Medium-Priority**: 8-10 hours (docs consolidation, code decisions)
- **Low-Priority**: 2-3 hours (cleanup, TODOs)

**Total**: ~14-19 hours for full remediation

