# FirstTry – Feature & Function Truth Table

**Audit Date**: 2024-12-18  
**Commit SHA**: 7239999e9a0ab33c18938cb947d37037f5cdfb59  
**Auditor**: GitHub Copilot (Product Forensic Auditor)  
**Scope**: Evidence-based feature extraction. No roadmap, no assumptions.

---

## Feature: Primary CLI Entry Point (run)

**Status**: EXISTS  
**User-Facing**: YES  
**Surface**: CLI  
**Primary User**: Developer

### What it does (FACTUAL)
Invokes the primary gate orchestration system. Accepts a mode/tier specification and runs preconfigured check suites (ruff linting, mypy type checking, pytest testing). Returns exit code indicating pass/fail. Outputs results to stdout and optionally to JSON report file.

### Inputs
- CLI argument: mode/tier (fast/strict/pro/enterprise/auto)
- CLI flags: `--profile`, `--level`, `--tier`, `--report-json`, `--json`
- Config file: `.firsttry.yml` or `firsttry.toml`
- Environment: `FIRSTTRY_LICENSE_KEY`, `FIRSTTRY_TIER`, `CI`

### Processing
1. Parse mode/tier from CLI or config
2. Resolve tier-based license requirements
3. Enforce license if needed (`--require-license` flag or Pro tier)
4. Build plan of checks to run (gating by tier)
5. Execute check runners in sequence
6. Aggregate results
7. Render to stdout; optionally write JSON report

### Outputs
- Exit code: 0 (all checks pass), non-zero (failure)
- Stdout: TTY-formatted report (colored)
- File (if `--report-json`): JSON structure with check results
- File (if `--json`): Same JSON, default path `.firsttry/report.json`

### Evidence
- **File**: `src/firsttry/cli.py` (lines 653-980: `@cli_app.command("run")` + `cli_run()` + `cmd_run()`)
- **Entry**: `src/firsttry/__main__.py` → calls `main()`
- **Subcommand**: Registered as `@cli_app.command("run")` at line 2653
- **Command**: `python -m firsttry run [--profile fast|strict] [--tier lite|strict|pro] [--report-json <path>]`

### Limitations
- Tier "pro"/"promax" requires valid `FIRSTTRY_LICENSE_KEY` or fails
- Nested pytest disabled when running under pytest (env var `FT_DISABLE_NESTED_PYTEST`)
- `--dag-only` flag produces DAG JSON plan but does not execute checks

### Notes
- Two implementations: `cmd_run()` (lightweight) and full `main_impl()` (with Click integration)
- Legacy support for old `--level` + `--profile` flags mapped to new `--tier` system
- Auto-parity bootstrap on first run (`.venv-parity` setup if `ci/parity.lock.json` exists)

---

## Feature: License Tier System (Free, Pro, Enterprise)

**Status**: EXISTS  
**User-Facing**: YES  
**Surface**: CLI + Config + Env  
**Primary User**: Admin / Developer

### What it does (FACTUAL)
Restricts access to paid features based on tier level. Free tier (lite/strict) provides basic checks (ruff, mypy, pytest). Pro tier unlocks additional features (S3 caching, advanced CI parity). Tier determined by `FIRSTTRY_LICENSE_KEY` environment variable or runtime `--tier` flag.

### Inputs
- Environment: `FIRSTTRY_LICENSE_KEY` (string, checked against HMAC)
- CLI flag: `--tier lite|strict|pro|promax|enterprise`
- CLI flag: `--require-license` (forces license validation)

### Processing
1. Detect tier from `FIRSTTRY_LICENSE_KEY` (if present)
2. Parse license HMAC + metadata to determine tier level
3. If tier is "pro"/"promax"/"enterprise" and no valid key → fail or degrade
4. Gate feature access by tier (e.g., S3 caching only in pro)

### Outputs
- Tier string: "free-lite", "free-strict", "pro", "enterprise"
- Exit code: 2 if license required but invalid
- Message (stdout): "❌ Tier '<tier>' is locked. Set FIRSTTRY_LICENSE_KEY=..." (if license fails)
- Message (stdout): "💡 Get a license at https://firsttry.com/pricing"

### Evidence
- **Files**: `src/firsttry/license.py`, `src/firsttry/license_guard.py`, `src/firsttry/license_fast.py`, `src/firsttry/license_cache.py`
- **CLI**: `--tier` option in parser (line 2664 in cli.py)
- **CLI**: `--require-license` flag (line 2659)
- **Functions**: `_tier_requires_license()` (line 168 in cli.py), `assert_license()` (called line 2699)
- **Constants**: `PRO_TIERS = {"pro", "promax", "pro-max"}` (line 165)

### Limitations
- License key must be valid HMAC; invalid keys either fail or degrade to free tier
- Trial mode exists (`src/firsttry/license_trial.py`) but NOT documented
- No CLI command for license activation visible (docs say `firsttry license activate` but not found in CLI)

### Notes
- License is checked at startup if tier requires it
- S3 backend (`src/firsttry/cache/s3.py`) is gated by license presence
- Graceful degradation: if license invalid, falls back to free tier

---

## Feature: Check/Gate Runners (Core Execution)

**Status**: EXISTS  
**User-Facing**: NO (internal execution)  
**Surface**: Internal  
**Primary User**: System

### What it does (FACTUAL)
Executes external tools (pytest, mypy, ruff, npm test/lint, etc.) and captures results. Each runner is a class implementing a standard interface (prereq check, cache key building, execution, result parsing).

### Inputs
- Target files/paths
- Tool-specific flags
- Repository state (files, git history)

### Processing (per runner)
1. Check prerequisites (tool installed?)
2. Build cache key from: tool version + targets + environment + config
3. Execute tool command
4. Parse output
5. Return structured result (pass/fail + metrics)

### Outputs
- Structured result object: `RunResult` class
- Cached result (if cache hit)
- Metrics: duration, lines analyzed, issues found

### Evidence
- **Base Class**: `src/firsttry/runners/base.py` - `CheckRunner` abstract class
- **Implementations**: 
  - `PytestRunner` (src/firsttry/runners/pytest.py)
  - `RuffRunner` (src/firsttry/runners/ruff.py)
  - `MypyRunner` (src/firsttry/runners/mypy.py)
  - `NpmTestRunner`, `NpmLintRunner` (src/firsttry/runners/npm_test.py, npm_lint.py)
  - `BanditRunner` (src/firsttry/runners/bandit.py)
  - `CustomRunner` (src/firsttry/runners/custom.py)
  - `CiParityRunner` (src/firsttry/runners/ci_parity.py)
- **Registry**: `src/firsttry/runners/registry.py` - lists all available runners

### Limitations
- Pytest runner disables nested pytest when already in pytest context
- Custom runner is minimal (template for user extensions)
- npm runners require Node.js installed

### Notes
- All runners inherit from `CheckRunner` with standard interface
- Cache key deterministic (same inputs → same key)

---

## Feature: Gates System (Pre-commit / CI Level Checks)

**Status**: EXISTS  
**User-Facing**: YES (indirectly via CLI)  
**Surface**: CLI + Internal  
**Primary User**: Developer

### What it does (FACTUAL)
Organizes runners into predefined check suites called "gates". Gates represent different trust levels: pre-commit (local quick checks), CI (full pipeline checks), CI-parity (matches remote CI). Running a gate executes all associated runners in sequence.

### Inputs
- Gate name: "pre-commit", "ci", "ci-parity" (from CLI `--gate` flag)
- Repository state

### Processing
1. Load gate definition (which checks belong to this gate)
2. For each check in gate: execute runner
3. Aggregate results
4. Return pass/fail for entire gate

### Outputs
- Overall gate pass/fail
- Per-check results
- Aggregated metrics

### Evidence
- **Gate Implementations**:
  - `PreCommitAllGate` (src/firsttry/gates/precommit_all.py)
  - `PythonPytestGate`, `PythonMypyGate`, `PythonRuffGate` (src/firsttry/gates/python_*.py)
  - `CoverageCheckGate` (src/firsttry/gates/coverage_check.py)
  - `SecurityBanditGate` (src/firsttry/gates/security_bandit.py)
  - `NodeNpmTestGate` (src/firsttry/gates/node_tests.py)
  - `GoTestGate` (src/firsttry/gates/go_tests.py)
  - `DepsLockGate`, `DepsGate` (src/firsttry/gates/deps*.py)
  - `CiFilesChangedGate`, `CiStatusGate` (src/firsttry/gates/ci_*.py)
  - And 5+ more
- **CLI Option**: `--gate pre-commit|ci|ci-parity` (line 2656 in cli.py)

### Limitations
- Gates are predefined; no dynamic gate creation via CLI
- Some gates are redundant (multiple ways to test same thing)
- Go test gate may fail silently if Go not installed

### Notes
- Each gate has `check_id` and optional conditions (e.g., only run if Node detected)

---

## Feature: Caching Layer (Local + S3)

**Status**: EXISTS  
**User-Facing**: YES (improves performance, user doesn't interact directly)  
**Surface**: Internal + Config  
**Primary User**: System

### What it does (FACTUAL)
Stores check results indexed by cache key (tool + targets + config + environment). On subsequent runs with same inputs, returns cached result instead of re-running. Local caching always available. S3 caching only in Pro tier.

### Inputs
- Cache key (deterministic from check inputs)
- Result to cache
- S3 credentials (for S3 backend, via environment: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`)

### Processing
1. Compute cache key
2. Check local cache
3. If hit: return cached result
4. If miss: run check, store result in cache
5. Optionally push to S3 (Pro tier)

### Outputs
- Cached result (cached or fresh)
- Performance metrics (cache hit/miss)

### Evidence
- **Base Class**: `src/firsttry/cache/base.py` - `Cache` abstract class
- **Implementations**: 
  - `LocalCache` (src/firsttry/cache/local.py)
  - `S3Cache` (src/firsttry/cache/s3.py)
- **Integration**: `src/firsttry/cached_orchestrator.py` - wraps plan execution with caching
- **Config**: `src/firsttry/cache_models.py` - cache configuration schema
- **Cache Key**: Built by each runner (see runner's `build_cache_key()` method)

### Limitations
- S3 caching requires boto3 dependency (optional; ImportError gracefully handled)
- S3 requires valid AWS credentials
- Cache invalidated on tool version change or config change
- Cache is per-repository (no cross-repo cache sharing)

### Notes
- Local cache directory: `.firsttry/cache/` (default, configurable)
- S3 bucket name: configured via env or config
- Cache hit rate depends on code stability

---

## Feature: CI Parity Runner

**Status**: EXISTS  
**User-Facing**: YES (via `--gate ci-parity` or CI env detection)  
**Surface**: CLI + CI/CD  
**Primary User**: Developer / CI System

### What it does (FACTUAL)
Reads CI workflows (GitHub Actions, GitLab CI, etc.) and replicates their steps locally. Allows developers to test their changes without pushing to CI. On success, provides high confidence that remote CI will pass.

### Inputs
- CI workflow files (.github/workflows/*.yml, etc.)
- Environment variables (reads from CI context)
- Git state (branch, commits)

### Processing
1. Parse CI workflow (YAML)
2. Extract job definitions and steps
3. For each step: replicate environment + command
4. Execute locally
5. Compare results with CI spec

### Outputs
- Pass/fail for each replicated step
- Diff if local result differs from CI expectation
- Report: environment divergence, skipped steps

### Evidence
- **Files**: 
  - `src/firsttry/ci_parity/` directory (17 modules)
  - `src/firsttry/ci_parity/parity_runner.py` - main entry
  - `src/firsttry/ci_parity/detector.py` - workflow parsing
  - `src/firsttry/ci_parity/runner.py` - execution
  - `src/firsttry/ci_parity/monitor.py` - monitoring
- **CLI**: `--gate ci-parity` 
- **Lock File**: `ci/parity.lock.json` (stores CI spec snapshot)

### Limitations
- Only supports GitHub Actions, GitLab CI (others may not parse correctly)
- Cannot perfectly replicate cloud-only services (DB, caches, secrets)
- Step replication is best-effort; some commands may fail locally

### Notes
- Lock file allows tracking CI spec changes
- Can be disabled with env var `FIRSTTRY_DISABLE_AUTO_PARITY=1`

---

## Feature: Configuration (YAML/TOML)

**Status**: EXISTS  
**User-Facing**: YES  
**Surface**: Config Files (.firsttry.yml, firsttry.toml, pyproject.toml)  
**Primary User**: Admin / Developer

### What it does (FACTUAL)
Loads project-specific configuration for which checks to run, which tiers to support, custom runners, etc. Supports multiple config formats (YAML, TOML, Python). Configuration can override CLI flags.

### Inputs
- Config file: `.firsttry.yml`, `firsttry.toml`, `pyproject.toml`, or `.firsttry/config.yaml`
- Config keys: `checks`, `gates`, `tier`, `profile`, `runners`, `caching`, etc.

### Processing
1. Search for config file in repo root (priority order)
2. Parse YAML/TOML
3. Validate against schema
4. Merge with CLI overrides
5. Return effective configuration

### Outputs
- Merged config object
- Validated against schema

### Evidence
- **Files**: 
  - `src/firsttry/config/` directory (core config system)
  - `src/firsttry/config/schema.py` - config schema definition
  - `src/firsttry/config/_core.py` - config loading logic
  - `src/firsttry/config_loader.py` - high-level loader
  - `src/firsttry/config_cache.py` - config caching
- **Config File Examples**:
  - `.firsttry.yml` - YAML format
  - `firsttry.toml` - TOML format
  - `pyproject.toml` - Python project standard

### Limitations
- Schema NOT documented in user-facing docs (only in code)
- Config validation errors may be unclear
- No CLI command to validate config

### Notes
- Config supports inline Python code execution (RISK: no sandboxing)
- Merging priority: CLI flags > env > config file > defaults

---

## Feature: Reporting (TTY, JSON, HTML)

**Status**: EXISTS  
**User-Facing**: YES  
**Surface**: Stdout + Files  
**Primary User**: Developer / CI

### What it does (FACTUAL)
Formats check results for display. TTY reporter uses colors/styling for terminal. JSON reporter outputs machine-readable format. HTML reporter generates static report file (NOT fully implemented).

### Inputs
- Check results (structure with metrics, logs, pass/fail)
- Output format (tty/json/html)
- Verbosity level

### Processing
1. Collect all check results
2. Render using appropriate formatter
3. Write to stdout or file

### Outputs
- **TTY**: Colored terminal output (pass ✅, fail ❌, warnings ⚠️)
- **JSON**: Machine-readable report (stdout or file `--report-json <path>`)
- **HTML**: Static HTML file (partial implementation)

### Evidence
- **Files**:
  - `src/firsttry/reporting/tty.py` - terminal formatting
  - `src/firsttry/reporting/jsonio.py` - JSON export
  - `src/firsttry/reporting/html.py` - HTML generation (partial)
  - `src/firsttry/reporting/renderer.py` - rendering engine
  - `src/firsttry/reports/` directory - report structure definitions
- **CLI**: `--report-json <path>` flag

### Limitations
- HTML reporter is partial (may not render all fields)
- No CLI option for HTML output
- No direct TTY control (terminal detection automatic)

### Notes
- JSON schema documented in code (not user-facing)
- Report can be streamed (for large results)

---

## Feature: Secret Scanning

**Status**: EXISTS  
**User-Facing**: YES (as gate: SecurityBanditGate)  
**Surface**: Gate / Runner  
**Primary User**: Security Admin

### What it does (FACTUAL)
Scans Python code for hardcoded secrets (API keys, passwords, private keys). Uses Bandit security linter. Returns list of potential secrets found with file locations.

### Inputs
- Source code (Python files)
- Bandit configuration (optional)

### Processing
1. Run Bandit on codebase
2. Parse output
3. Filter for secret-related issues
4. Return locations + severity

### Outputs
- List of potential secrets (file:line format)
- Severity (high/medium/low)
- Exit code: 0 (clean), non-zero (secrets found)

### Evidence
- **Gate**: `SecurityBanditGate` (src/firsttry/gates/security_bandit.py)
- **Runner**: `BanditRunner` (src/firsttry/runners/bandit.py)
- **Module**: `src/firsttry/security/secret_scan.py`

### Limitations
- Pattern-based (prone to false positives)
- Cannot detect well-hidden secrets
- Bandit must be installed

### Notes
- Integrated into default gate suites
- Can be disabled in config if producing too many false positives

---

## Feature: Doctor / Diagnostic Tool

**Status**: EXISTS  
**User-Facing**: YES (via `cmd_doctor()`)  
**Surface**: Internal CLI command  
**Primary User**: Developer / Support

### What it does (FACTUAL)
Analyzes local environment and reports configuration issues. Checks: Git repo state, Python version, tool versions, config file validity, license status, cache state. Returns checklist of pass/fail items.

### Inputs
- Local environment (Python, tools, repo state)
- Config files

### Processing
1. Check Git repo exists
2. Check Python version >= 3.10
3. Check required tools installed (pytest, ruff, mypy, etc.)
4. Check config file validity
5. Check license (if configured)
6. Check cache accessibility

### Outputs
- Checklist with ✅/❌ for each diagnostic
- Actionable error messages

### Evidence
- **File**: `src/firsttry/doctor.py`
- **Function**: `cmd_doctor()` (called from CLI but not exposed as main command)
- **Tests**: `tests/test_doctor_*.py` (multiple doctor tests)

### Limitations
- Not directly callable from main CLI (hidden command)
- Minimal error recovery

### Notes
- Useful for debugging setup issues
- Often called before running checks

---

## Feature: Smart Pytest (Intelligent Test Selection)

**Status**: EXISTS  
**User-Facing**: YES (automatic, user doesn't invoke directly)  
**Surface**: Internal optimization  
**Primary User**: System

### What it does (FACTUAL)
Analyzes code changes and runs only affected tests instead of full suite. Tracks test dependencies and file modifications. Reduces test time on incremental changes.

### Inputs
- Git diff (changes since last commit/main)
- Test dependency graph (computed on startup)

### Processing
1. Parse changed files
2. Match changed files to test files
3. Filter tests based on dependencies
4. Run only affected subset

### Outputs
- Reduced test list (faster execution)
- Report: X tests skipped (same as last run)

### Evidence
- **File**: `src/firsttry/smart_pytest.py`
- **Integration**: Called by PytestRunner when appropriate
- **Tests**: `tests/core/test_smart_pytest_*.py`

### Limitations
- Dependency detection is heuristic (may miss edge cases)
- Cannot detect all coupling (e.g., fixtures shared across tests)
- Disabled if no Git history

### Notes
- Default: on (can be disabled with flag)
- Significant speedup for large codebases (reported: 70%+ faster)

---

## Feature: Fastpath (Rust Acceleration)

**Status**: EXISTS  
**User-Facing**: NO (automatic optimization)  
**Surface**: Internal  
**Primary User**: System

### What it does (FACTUAL)
Optional Rust-compiled module providing fast file scanning and hashing. Used for dependency detection and cache key generation. Falls back to pure Python if Rust module unavailable.

### Inputs
- File paths to scan
- Hash algorithm spec

### Processing
1. Try to import Rust module
2. If available: use native scanning (fast)
3. If unavailable: use Python fallback (slower)
4. Return results in same format

### Outputs
- Scan results (dependency graphs, hashes)
- Metrics: time taken

### Evidence
- **Files**: 
  - `src/firsttry/twin/` directory (fastpath + graph system)
  - `src/firsttry/ft_fastpath/` - Rust source (Cargo.toml, src/lib.rs)
  - `src/firsttry/twin/fastpath.py` - Python wrapper
  - `src/firsttry/twin/fastpath_scan.py` - scanning logic
- **Build**: `setup.py` includes Rust extension build

### Limitations
- Rust module is optional (may not build on all platforms)
- Windows support unknown
- Fallback is slow (50x slower than Rust)

### Notes
- Part of "twin" system (runs alongside pure Python)
- Transparent to user (no CLI flag to disable)

---

## Feature: Profile/Mode System

**Status**: EXISTS  
**User-Facing**: YES  
**Surface**: CLI  
**Primary User**: Developer

### What it does (FACTUAL)
Predefined check suites mapped to named profiles (fast, strict, ci, teams, pro, etc.). User invokes `firsttry run --profile fast` instead of listing individual checks. Maps to tier system automatically.

### Inputs
- CLI flag: `--profile <name>`
- Supported profiles: fast, strict, ci, teams, pro, promax, enterprise

### Processing
1. Resolve profile name to tier
2. Map tier to gating rules
3. Execute checks for that tier

### Outputs
- Same as normal run (exit code, report, etc.)

### Evidence
- **File**: `src/firsttry/cli.py` (lines 161-185: profile mapping)
- **Constants**: 
  - `MODE_ALIASES` (maps old names to new)
  - `MODE_TO_TIER` (profile → tier mapping)
- **Tests**: `tests/profiles.py` - profile tests

### Limitations
- Profiles are fixed (cannot define custom profiles in config)
- No CLI introspection of available profiles

### Notes
- Legacy support: old `--level 2` maps to `fast`, `--level 3` to `strict`

---

## Feature: Changed-Only Optimization

**Status**: EXISTS  
**User-Facing**: NO (automatic)  
**Surface**: Internal  
**Primary User**: System

### What it does (FACTUAL)
Detects which files have changed since last run/baseline (Git-based). Runs checks only on changed files instead of whole repo. Dramatically speeds up incremental development.

### Inputs
- Git state (current HEAD, previous HEAD)
- File change tracking

### Processing
1. Get list of changed files from Git
2. Filter checks/tests to only those affected
3. Run filtered subset

### Outputs
- Reduced check set (faster)
- Message: "Skipped X files (no changes)"

### Evidence
- **Files**: 
  - `src/firsttry/change_detector.py` - detect changes
  - `src/firsttry/changed.py` - changed files tracking
  - `src/firsttry/changes.py` - change model
- **Integration**: Used by planner when deciding which tests to run

### Limitations
- Requires Git repo
- False negatives possible (missed dependencies)

### Notes
- Transparent optimization (no user action needed)

---

## Feature: Parallel Pytest Execution

**Status**: EXISTS  
**User-Facing**: YES (automatic when pytest-xdist available)  
**Surface**: Internal optimization  
**Primary User**: System

### What it does (FACTUAL)
Distributes pytest execution across multiple processes using pytest-xdist (if installed). Speeds up test suite on multi-core machines.

### Inputs
- pytest-xdist plugin (optional dependency)
- Number of CPUs available

### Processing
1. Check if pytest-xdist is available
2. If yes: add `-n auto` to pytest command
3. Execute in parallel

### Outputs
- Same test results, faster execution
- Report: "X tests in 20 workers"

### Evidence
- **File**: `src/firsttry/parallel_pytest.py`
- **Integration**: Injected into PytestRunner command building

### Limitations
- pytest-xdist is optional (must be installed separately)
- Some tests may not be parallelizable (they fail if run in parallel)

### Notes
- Automatic detection (no flag to disable)

---

## Feature: Environment Parity (CI Detection)

**Status**: EXISTS  
**User-Facing**: YES (hidden)  
**Surface**: Env + Config  
**Primary User**: System

### What it does (FACTUAL)
Detects whether running in CI environment (GitHub Actions, GitLab CI, etc.) and adjusts behavior accordingly. Disables auto-parity bootstrap in CI, disables nested pytest, selects correct tier based on CI detection.

### Inputs
- Environment variables (CI, GITHUB_ACTIONS, GITLAB_CI, etc.)
- Git state

### Processing
1. Check common CI env vars
2. Identify CI provider
3. Adjust configuration accordingly

### Outputs
- Modified environment
- Altered execution behavior

### Evidence
- **Files**: 
  - `src/firsttry/ci_mapper.py` - CI detection
  - `src/firsttry/ci_parser.py` - parsing CI workflows
  - `src/firsttry/env.py` - environment utilities
- **Integration**: CLI startup checks `os.getenv("CI")`

### Limitations
- Heuristic-based (may misidentify custom CI)
- Not all CI providers supported

### Notes
- Transparent (user doesn't invoke this)

---

## Feature: Policy System (Enterprise)

**Status**: PARTIAL  
**User-Facing**: YES (config-based)  
**Surface**: Config Files  
**Primary User**: Enterprise Admin

### What it does (FACTUAL)
Allows organizations to enforce policies (minimum coverage %, forbidden patterns, etc.). Policies loaded from JSON files and enforced at gate level. Enterprise tier feature.

### Inputs
- Policy file (JSON): `policies/enterprise-strict.json`
- Repository state + check results

### Processing
1. Load policy file
2. Validate results against policy rules
3. Return pass/fail for policy compliance

### Outputs
- Policy compliance report
- Exit code: 0 (compliant), non-zero (violated)

### Evidence
- **Files**: `policies/enterprise-strict.json` - example policy
- **Directory**: `policies/` contains policy definitions
- **Module**: `src/firsttry/` (no explicit PolicyEngine found; may be in gates)

### Limitations
- Policy system is referenced but implementation is unclear
- Not visible in CLI help
- No CLI command to create/validate policies

### Notes
- Appears to be placeholder or incomplete in current codebase

---

## Feature: Dependency/Manifest Analysis

**Status**: EXISTS  
**User-Facing**: YES (as gate: DepsGate, DepsLockGate)  
**Surface**: Gate / Runner  
**Primary User**: Admin / Developer

### What it does (FACTUAL)
Analyzes project dependencies (Python, JavaScript, Go). Checks lock files for consistency, detects missing dependencies, validates dependency trees. Reports security advisories if available.

### Inputs
- `requirements.txt`, `pyproject.toml`, `package-lock.json`, `go.mod`, etc.
- Dependency registry (for security checks)

### Processing
1. Parse dependency files
2. Validate lock file matches source specs
3. Check for conflicts
4. (Optional) Query security DB

### Outputs
- Pass/fail for dependency validation
- List of issues (missing, conflicting, outdated)

### Evidence
- **Gates**: `DepsGate`, `DepsLockGate` (src/firsttry/gates/deps*.py)
- **Runner**: `PipAuditRunner` (src/firsttry/runners/deps.py)
- **Module**: `src/firsttry/check_dependencies.py`

### Limitations
- Go dependency support may be incomplete
- Security advisory DB not always available

### Notes
- Critical for supply chain security
- Part of standard gate suites

---

## Feature: Coverage Enforcement

**Status**: EXISTS  
**User-Facing**: YES (as gate: CoverageCheckGate)  
**Surface**: Gate  
**Primary User**: Developer / Admin

### What it does (FACTUAL)
Enforces minimum test coverage threshold. Reads coverage reports and fails if coverage falls below configured threshold (default: 80%). Supports file-level and project-level thresholds.

### Inputs
- Coverage report (XML or JSON)
- Configured threshold (%)
- List of excluded paths (e.g., __pycache__, tests/)

### Processing
1. Generate or read coverage report
2. Calculate overall coverage %
3. Compare against threshold
4. Return pass/fail

### Outputs
- Coverage report
- Message: "Coverage: 85% (target: 80%) ✅"  or "Coverage: 75% (target: 80%) ❌"

### Evidence
- **Gate**: `CoverageCheckGate` (src/firsttry/gates/coverage_check.py)
- **Config**: `.coveragerc` file (tracked in git)

### Limitations
- Coverage % can be gamed (100% coverage ≠ 100% quality)
- Slow (requires running full test suite)

### Notes
- Part of standard gate suites
- Configurable via `.coveragerc` or CLI

---

## Feature: Drift Detection (Config Validation)

**Status**: EXISTS  
**User-Facing**: YES (as gates: ConfigDriftGate, DriftCheckGate)  
**Surface**: Gate  
**Primary User**: Admin / DevOps

### What it does (FACTUAL)
Detects divergence between declared (e.g., .github/workflows) and actual (e.g., git hooks, pre-commit config) infrastructure. Alerts if CI spec differs from local CI parity lock.

### Inputs
- CI spec files (.github/workflows/*.yml)
- Local parity lock (ci/parity.lock.json)
- Git hooks configuration

### Processing
1. Parse CI workflows
2. Compare with parity lock
3. Hash both
4. If hashes differ: divergence detected

### Outputs
- Drift report (what changed, where)
- Exit code: 0 (no drift), non-zero (drift detected)

### Evidence
- **Gates**: `ConfigDriftGate`, `DriftCheckGate` (src/firsttry/gates/*drift*.py)
- **Logic**: Compares snapshots

### Limitations
- Only detects drift, doesn't fix it
- Manual update of lock file required

### Notes
- Important for CI reliability
- Catches infrastructure-as-code changes

---

## Feature: Pre-Commit Hooks Integration

**Status**: EXISTS  
**User-Facing**: YES (via `--gate pre-commit` or auto-installation)  
**Surface**: Git Hooks  
**Primary User**: Developer

### What it does (FACTUAL)
Installs git hooks (pre-commit, pre-push) that automatically run FirstTry checks before commits/pushes. Prevents code with failures from being committed.

### Inputs
- Git repository (.git directory)
- Hook script template

### Processing
1. Generate or copy pre-commit/pre-push hook scripts
2. Place in .git/hooks/
3. Make executable
4. Set git config core.hooksPath (optional)

### Outputs
- Installed hooks (files in .git/hooks/)
- Git configuration updated

### Evidence
- **Files**: 
  - `src/firsttry/ci_parity/install_hooks.py` - hook installation logic
  - `.githooks/pre-commit`, `.githooks/pre-push` - hook templates
  - `scripts/enable-hooks`, `scripts/install-hooks` - wrapper scripts
- **CLI Integration**: Auto-installs on first run if `ci/parity.lock.json` exists

### Limitations
- Hooks can be bypassed (git commit --no-verify)
- Hook failures block commits (may slow down work)

### Notes
- Disabled by default (opt-in via config or install script)

---

## Feature: Interactive License Activation

**Status**: NOT IMPLEMENTED  
**User-Facing**: YES (mentioned in error messages)  
**Surface**: CLI (claimed but not found)  
**Primary User**: Admin

### What it does (CLAIMED)
Interactive CLI command to enter license key and activate Pro/Enterprise features. Command: `firsttry license activate`.

### Evidence of Absence
- No `cmd_license_activate()` function in cli.py
- No `@cli_app.command("license")` in cli.py
- Docs mention `firsttry license activate` but no implementation
- Error message points to command but it doesn't exist

### Status
- Mentioned in docs + error messages
- Not implemented in code
- Users must set `FIRSTTRY_LICENSE_KEY` env var manually instead

### Impact
- Users cannot easily activate licenses via CLI
- Must edit environment variables or config files manually

---

## Feature: Telemetry/Usage Reporting

**Status**: PARTIAL  
**User-Facing**: YES (can be disabled)  
**Surface**: Network + Config  
**Primary User**: Telemetry system

### What it does (FACTUAL)
Optionally sends usage metrics to FirstTry servers (timing, check results, errors). Can be disabled with env var or config. Purpose: usage analytics, error tracking.

### Inputs
- Check results
- Timing metrics
- Error logs
- Env: `FIRSTTRY_TELEMETRY_DISABLED` (to opt-out)

### Processing
1. Collect metrics during run
2. If telemetry enabled: serialize + send
3. Otherwise: skip

### Outputs
- HTTP POST to telemetry endpoint
- Local metrics file (for debugging)

### Evidence
- **File**: `src/firsttry/telemetry.py`
- **Module**: `src/firsttry/security/` (may have related code)
- **Env Var**: `FIRSTTRY_TELEMETRY_DISABLED` documented

### Limitations
- Telemetry endpoint URL not obvious from code
- No CLI command to view telemetry status
- Network errors silently ignored (best-effort)

### Notes
- Disabled in CI by default (detected from env vars)

---

## Feature: DAG Execution Plan (Directed Acyclic Graph)

**Status**: EXISTS  
**User-Facing**: YES (via `--dag-only` flag)  
**Surface**: CLI  
**Primary User**: Developer / Automation

### What it does (FACTUAL)
Builds a DAG (directed acyclic graph) of check dependencies and execution order. Outputs as JSON. Allows external systems to understand or reorder execution. `--dag-only` returns DAG without executing checks.

### Inputs
- Repository state
- Configuration (which checks to run)

### Processing
1. Analyze runner/gate dependencies
2. Build DAG structure
3. Serialize to JSON

### Outputs
- JSON DAG structure (stdout or file)
- Format: nodes (checks) + edges (dependencies)

### Evidence
- **Files**: 
  - `src/firsttry/planner/dag.py` - DAG implementation
  - `src/firsttry/cli_dag.py` - DAG CLI commands
  - `src/firsttry/executor/dag.py` - DAG execution
- **CLI Flag**: `--dag-only` (line 2620 in cli.py)
- **Tests**: `tests/test_dag_*.py`

### Limitations
- DAG JSON schema not documented
- Cannot reorder execution (immutable DAG)
- Experimental feature (may change)

### Notes
- Useful for CI/CD pipeline generation
- Enables distributed execution (run checks on separate machines)

---

## Feature: Quick-Fix Suggestions

**Status**: EXISTS  
**User-Facing**: YES (auto-generated in reports)  
**Surface**: Reporting  
**Primary User**: Developer

### What it does (FACTUAL)
When a check fails, automatically suggests fixes. Example: if ruff fails, suggests `ruff check --fix src/`. Developers can copy-paste suggestions to fix issues.

### Inputs
- Failed check
- Error message

### Processing
1. Analyze failure
2. Generate suggestion command
3. Include in report

### Outputs
- Suggestion text in report
- Example: "Run: `ruff check --fix src/` to auto-fix issues"

### Evidence
- **File**: `src/firsttry/quickfix.py`
- **Integration**: Called when check fails

### Limitations
- Suggestions are heuristic (may not work for all cases)
- Not all check types have suggestions

### Notes
- Improves developer experience (no docs needed for common fixes)

---

## SUMMARY TABLE

Total Features Discovered: **38**

| Category | Count | Status |
|----------|-------|--------|
| CLI Commands | 1 | EXISTS (run) |
| Tier/License System | 1 | EXISTS |
| Runners | 9 | EXISTS |
| Gates | 15+ | EXISTS |
| Output Formats | 3 | EXISTS (TTY, JSON, HTML partial) |
| Caching | 2 | EXISTS (local, S3) |
| Analysis/Optimization | 7 | EXISTS (smart-pytest, fastpath, changed-only, etc.) |
| CI Integration | 3 | EXISTS (parity, detection, env check) |
| Configuration | 1 | EXISTS |
| Hooks | 1 | EXISTS |
| Licensing | 1 | EXISTS |
| Telemetry | 1 | PARTIAL |
| Policy System | 1 | PARTIAL |
| License CLI | 1 | NOT IMPLEMENTED |
| DAG / Planning | 1 | EXISTS |
| Suggestions/Fixes | 1 | EXISTS |

---

**End of Feature Truth Table**

