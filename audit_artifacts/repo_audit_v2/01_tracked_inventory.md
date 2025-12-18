# 01 — Tracked File Inventory by Top Folder

**Generated**: 2024-12-18  
**Method**: `git ls-files` analysis  
**Total Files**: 965  

---

## tests/ (242 files)

**Purpose**: Test suite covering all project modules  
**Structure**:
- Core integration tests
- Unit tests by module
- Enterprise feature tests (separate tier)
- FastPath verification tests
- CI parity tests

**Key subdirectories**:
- `tests/` — Root test files (most numerous)
- `tests/enterprise/` — Enterprise tier features (7 files)
- `tests/fastpath/` — Rust fastpath integration (1 file)
- `tests/ci_parity/` — CI parity runner tests (16 files)
- `tests/cache/` — Cache system tests (3 files)
- `tests/gates/` — Gates system tests (13 files)
- `tests/integration/` — Full pipeline integration (8 files)
- `tests/cli/` — CLI contract tests (4 files)
- `tests/security/` — Security/secrets scanning (1 file)
- `tests/license/` — Licensing tier system (3 files)

**Test Count**: 255 discovered via `git ls-files | grep test_`  
**Evidence**: `raw/tests_tracked.txt`

---

## (root) (233 files)

**Purpose**: Configuration, documentation, scripts, and manifest files  

### Configuration Files (Active)
- `pyproject.toml` — Python package definition
- `.gitignore` — Git ignore rules (Phase 0 updated)
- `.coveragerc` — Coverage config (Phase 0 re-tracked)
- `pytest.ini` — Pytest configuration
- `mypy.ini` — Type checking config
- `.pre-commit-config.yaml` — Pre-commit hooks
- `.ruff.toml` — Ruff linter config
- `conftest.py` — Pytest fixtures
- `.firsttry.yml` — FirstTry config (project-specific)

### CI/CD Configuration
- `.github/workflows/` — 34 workflow files (see .github/ section)
- `.devcontainer/` — Dev container setup (see .devcontainer/ section)
- `.githooks/` — Custom git hooks (see .githooks/ section)

### Documentation (Root Level)
- `README.md` — Primary entry point
- `CONTRIBUTING.md` — Contribution guidelines
- `SECURITY.md` — Security policy
- `CODE_OF_CONDUCT.md` — Community standards
- `LICENSE` — FirstTry Source-Available License (FSAL 1.0)

### Deliverable/Report Documents (120+ .md files)
**Pattern**: `*_COMPLETE*.md`, `*_REPORT*.md`, `*_SUMMARY*.md`

**Examples**:
- `ENTERPRISE_DELIVERY_INDEX.md`
- `PERFORMANCE_OPTIMIZATION_SUMMARY.md`
- `PHASE_COMPLETION_INDEX.md`
- `TESTING_BACKLOG.md`
- `WORKING_COMMANDS.md`
- [See full list in raw/md_files_list.txt]

**Assessment**: Likely output from multi-phase delivery sprints; consolidation recommended post-audit

### Database Files
- `.firsttry.db` — SQLite database (Phase 0 kept)
- `.firsttry_detect_cache.json` — Detection cache

### Build Outputs (Artifacts)
- `coverage.json`, `coverage.xml` — Coverage reports
- `bandit-report.json` — Security scan output
- `*.bundle` — Git bundle artifacts
- `*.bundle.sha256` — Hash verification

### Script Bundles (Demo/Examples)
- `demo_*.py` (11 files) — Demo scripts for various features
- `step12_*.py` (2 files) — Validation scripts
- `performance_benchmark*.py` — Perf tooling

---

## src/ (215 files)

**Purpose**: Main firsttry package source code  

### Package Structure
```
src/firsttry/
├── __init__.py              # Package init
├── __main__.py              # CLI entry (→ cli.py)
├── cli*.py                  # CLI implementations (7 variants)
├── config/                  # Configuration system
├── gates/                   # Quality gates system (26 files)
├── cache/                   # Caching layer (4 files)
├── cache_*.py               # Cache utilities
├── ci_parity/               # CI parity runner (17 files)
├── executor/                # Execution engine (3 files)
├── runner*.py               # Various runners
├── runners/                 # Runner implementations (23 files)
├── reporting/               # Report generation (4 files)
├── reports/                 # Report types (6 files)
├── license*.py              # Licensing system (6 files)
├── twin/                    # Twin fastpath system (5 files)
├── agents/                  # Agent system (3 files)
├── security/                # Security features (2 files)
└── [60+ other modules]      # Infrastructure, utilities
```

### Tier System Implementation
- `tier.py` — Tier detection
- `license*.py` (6 files) — License guard + tier mapping
- `pro_features.py` — Pro tier gate

### Critical Subsystems
- **Gates**: 26 files implementing quality checks
- **CI Parity**: 17 files for CI/CD mirroring
- **Runners**: 23 files for tool integration (pytest, ruff, mypy, npm)
- **Caching**: 4 files for result caching (local + S3)
- **Fastpath**: Rust native module (see ft_fastpath/)

### Status Summary
- **Lines of code**: ~450+ files with implementation
- **Dead code risk**: LOW (active imports detected)
- **Stubs**: 3 detected (minimal)
- **TODOs**: 3 active (see raw/rg_todos.txt)

---

## tools/ (72 files)

**Purpose**: Build, benchmark, and diagnostic tooling

### Categories
1. **Benchmarking** (5 files)
   - `ft_bench_*.py`, `bench_*.py`
   - Performance profiling harness

2. **Audit Tools** (3 files)
   - `ft_readiness_audit.py`
   - `audit_emit.py`
   - `ci_self_check.py`

3. **Validation** (4 files)
   - `check_critical_coverage.py`
   - `coverage_enforcer.py`
   - `coverage_embed.py`
   - `emit_audit_with_policy.py`

4. **Utilities** (8 files)
   - Dead code detection
   - Typing metrics
   - Report collation
   - Hang detection

5. **Embedded Firsttry** (47 files)
   - `tools/firsttry/` — Standalone firsttry copy
   - Duplicate of src/firsttry (intentional?)
   - Tests mirror pattern
   - Status: RISK — code duplication

### Assessment
- **Purpose**: Clear (supporting CI/build)
- **Risk**: Code duplication in embedded firsttry
- **Recommendation**: Consolidate or document intent post-audit

---

## audit_artifacts/ (67 files)

**Purpose**: Audit outputs and historical evidence  
**Status**: Recently created (Phase 0 completion + v2 in progress)

### Subfolders
- `repo_audit/` — Previous audit (v1; 15 files + 26 evidence)
- `repo_hygiene_phase0/` — Phase 0 execution evidence (4 files + 26 raw outputs)
- `repo_audit_v2/` — Current audit (this run; 35+ raw outputs)

### Not part of source distribution
- **Decision**: Keep in git for historical audit trail
- **Size**: ~1-2 MB (acceptable overhead)
- **Consideration**: Could be moved to separate branch post-audit

---

## scripts/ (37 files)

**Purpose**: Helper scripts for CI, testing, and development

### Categories
1. **CI/Testing** (12 files)
   - `ft_*.sh` — FirstTry-specific CI helpers
   - `run_tests.sh` — Test orchestration
   - `check_*.sh` — Pre-commit validators

2. **Development** (8 files)
   - `dev_fast.sh` — Local dev setup
   - `enable-hooks`, `install-hooks` — Git hook management
   - `ft_quick_sweep.sh`, `ft_tier_sweep.sh` — Quick workflows

3. **Diagnostics** (5 files)
   - `ft_gap_probe_*.sh` — Gap detection
   - `ft_view_benchmark.sh` — Results viewer

4. **Validation** (7 files)
   - `validate-*.sh` — Pre-flight checks
   - `ft_audit_readonly.sh` — Audit runner
   - `verify_*.sh` — Verification scripts

### Status
- **Well-organized**: Clear naming convention
- **Documented**: Most include header comments
- **Active**: Used by CI workflows

---

## .github/ (34 files)

**Purpose**: GitHub Actions CI/CD configuration

### Workflows (28 .yml files)
- `ci*.yml` (7 variants) — Main CI pipeline + hardened/parity versions
- `audit*.yml` (3 variants) — Audit workflows (enterprise, hardened, readonly)
- `quality.yml`, `codeql.yml` — Code quality gates
- `publish.yml` — Package publishing
- `release-vsix.yml` — VSCode extension release
- `remote-cache*.yml` (3 variants) — Cache management
- `nightly-*.yml` — Scheduled jobs
- And 8+ more

### Actions (1 file)
- `actions/firsttry-gate/action.yml` — Custom gate action

### Config (2 files)
- `dependabot.yml` — Dependency updates
- `codeql.yml` — Code scanning

### Assessment
- **Complexity**: HIGH (28 workflows across matrix of platforms)
- **Maturity**: PRODUCTION (staged CI, hardening, parity validation)
- **Risk**: Maintenance burden if not actively used

---

## docs/ (15 files)

**Purpose**: Sphinx documentation

### Structure
- `conf.py` — Sphinx configuration
- `index.rst` — Documentation root
- `*.md` — Content files (licensing, hashing, coverage doctrine)
- `_static/` — Static assets
- `screenshots/` — UI examples
- `requirements.txt` — Sphinx deps

### Assessment
- **Minimal**: Only 15 files; docs are primarily in root .md files
- **Maintained**: Sphinx setup suggests formal docs site
- **Status**: May be outdated (not checked in detail)

---

## Other Folders

| Folder | Files | Purpose |
|--------|-------|---------|
| `vscode-extension/` | 12 | VSCode extension (TypeScript) |
| `dashboard/` | 8 | React UI dashboard |
| `app/` | 5 | FastAPI web application |
| `.devcontainer/` | 4 | Docker dev environment |
| `ft_fastpath/` | 4 | Rust fastpath module |
| `my-monorepo/` | 3 | Example monorepo structure |
| `patches-perf-40pc/` | 3 | Performance patch series |
| `.githooks/` | 2 | Custom git hooks |
| `ci/` | 2 | CI lock files |
| `firsttry-audit/` | 2 | Audit runner scripts |
| `licensing/` | 2 | Licensing module |
| `.quality/` | 1 | Quality baseline |
| `constraints/` | 1 | Dependency constraints |
| `policies/` | 1 | Enterprise policies |

---

## Summary Statistics

| Category | Count | Notes |
|----------|-------|-------|
| **Python files** | ~650 | .py extension |
| **Test files** | 255 | test_*.py or *_test.py |
| **YAML files** | ~40 | .yml/.yaml |
| **Config files** | ~20 | Linting/testing/build |
| **Documentation** | 140+ | .md files |
| **Scripts** | 37 | .sh files |
| **TypeScript/JS** | 20 | Extension + dashboard |
| **Rust** | 1 | fastpath module |
| **JSON** | 10+ | Config/data files |
| **CSV/bundles** | 5+ | Build artifacts |

---

## Evidence References

- Full file list: `raw/git_ls_files.txt`
- Folder counts: `raw/top_folder_counts.txt`
- Test inventory: `raw/tests_tracked.txt`
- MD file list: `raw/md_files_list.txt`

**Assessment**: Repository is well-organized by role. Clear separation: tests, source, tools, docs, CI/CD, examples. Main risk: documentation fragmentation (120+ .md files at root).
