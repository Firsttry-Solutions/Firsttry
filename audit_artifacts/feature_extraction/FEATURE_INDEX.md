# FirstTry – Feature Index (Compact Reference)

**Last Updated**: 2024-12-18  
**Commit**: 7239999e9a0ab33c18938cb947d37037f5cdfb59  
**Source**: Evidence-based audit only

---

## Quick Reference: All FirstTry Features

### Tier 1: Free (Lite/Strict)

| Feature | Status | User-Facing | Notes |
|---------|--------|-------------|-------|
| **CLI Entry (run)** | ✅ EXISTS | YES | Primary command, accepts mode/tier flags |
| **Ruff Linting** | ✅ EXISTS | YES | Python linting gate (PythonRuffGate) |
| **Mypy Type Checking** | ✅ EXISTS | YES | Type checking gate (PythonMypyGate) |
| **Pytest Testing** | ✅ EXISTS | YES | Test execution gate (PythonPytestGate) |
| **Local Caching** | ✅ EXISTS | NO | Speeds up repeated checks |
| **TTY Reporting** | ✅ EXISTS | YES | Colored terminal output |
| **JSON Reporting** | ✅ EXISTS | YES | Machine-readable output (--report-json) |
| **Configuration (YAML/TOML)** | ✅ EXISTS | YES | .firsttry.yml, pyproject.toml support |
| **Pre-Commit Hooks** | ✅ EXISTS | YES | Auto-installs git hooks |
| **Smart Pytest** | ✅ EXISTS | NO | Intelligent test selection (optimization) |
| **Changed-Only Optimization** | ✅ EXISTS | NO | Runs checks only on changed files |
| **Doctor/Diagnostic Tool** | ✅ EXISTS | YES | Environment health check |
| **CI Detection** | ✅ EXISTS | NO | Auto-detects GitHub Actions, GitLab CI, etc. |
| **Profile System** | ✅ EXISTS | YES | Named profiles (fast, strict, ci) |
| **Parallel Pytest** | ✅ EXISTS | NO | Multi-process test execution (w/ pytest-xdist) |

### Tier 2: Pro

| Feature | Status | User-Facing | Notes |
|---------|--------|-------------|-------|
| **License System** | ✅ EXISTS | YES | Free/Pro/Enterprise tiers |
| **S3 Caching** | ✅ EXISTS | NO | Remote cache backend (Pro+ only) |
| **CI Parity Runner** | ✅ EXISTS | YES | Replicate CI workflows locally |
| **Drift Detection** | ✅ EXISTS | YES | Config divergence checking |

### Tier 3: Enterprise

| Feature | Status | User-Facing | Notes |
|---------|--------|-------------|-------|
| **Policy System** | ⚠️ PARTIAL | YES (config) | Policy enforcement (incomplete) |

### Advanced Features (All Tiers)

| Feature | Status | User-Facing | Notes |
|---------|--------|-------------|-------|
| **Bandit (Secret Scanning)** | ✅ EXISTS | YES | SecurityBanditGate, security checks |
| **Dependency Analysis** | ✅ EXISTS | YES | DepsGate, DepsLockGate |
| **Coverage Enforcement** | ✅ EXISTS | YES | CoverageCheckGate, % thresholds |
| **Go Test Gate** | ✅ EXISTS | YES | GoTestGate for Go projects |
| **Node/NPM Tests** | ✅ EXISTS | YES | NodeNpmTestGate for JavaScript |
| **NPM Linting** | ✅ EXISTS | YES | NpmLintRunner + ESLintRunner |
| **Custom Runners** | ✅ EXISTS | YES | User-defined check extensions |
| **Fastpath (Rust Acceleration)** | ✅ EXISTS | NO | Optional native module (twin/) |
| **DAG Execution Plan** | ✅ EXISTS | YES | --dag-only flag, JSON output |
| **Quick-Fix Suggestions** | ✅ EXISTS | YES | Auto-generated fix commands |
| **Telemetry/Analytics** | ⚠️ PARTIAL | YES (opt-out) | Usage reporting (can disable) |
| **HTML Reporting** | ⚠️ PARTIAL | YES | HTML output (incomplete) |

### Missing / Not Implemented

| Feature | Status | User-Facing | Notes |
|---------|--------|-------------|-------|
| **License Activation CLI** | ❌ NOT IMPL | YES | `firsttry license activate` not found |
| **Policy CLI Editor** | ❌ NOT IMPL | YES | No way to create/edit policies via CLI |
| **Config Validator** | ❌ NOT IMPL | YES | No `firsttry validate-config` command |
| **Telemetry Dashboard** | ❌ NOT IMPL | YES | No built-in dashboard for metrics |
| **Time-Series Metrics** | ❌ NOT IMPL | NO | No historical trend data |

---

## Feature Availability by Tier

### Free Tier (lite/strict)
- ✅ All basic checks (ruff, mypy, pytest)
- ✅ Local caching
- ✅ TTY + JSON reporting
- ✅ Configuration
- ✅ Pre-commit hooks
- ✅ CI detection
- ✅ Profile system
- ✅ Dependency analysis
- ✅ Coverage enforcement
- ✅ Bandit security scanning
- ✅ Go/Node support
- ❌ S3 caching (Pro+)
- ❌ CI parity runner (Pro+)

### Pro Tier
- ✅ All Free features +
- ✅ S3 remote caching
- ✅ CI parity runner
- ✅ Drift detection
- ✅ Advanced license features
- ❌ Policy system (Enterprise+)

### Enterprise Tier
- ✅ All Pro features +
- ✅ Policy enforcement (partial)
- ✅ Support for large teams
- ✅ Advanced telemetry

---

## CLI Commands

### Available Commands
- `firsttry run` — Execute checks with optional flags (--tier, --profile, --gate, --report-json, etc.)
- `firsttry run --dag-only` — Produce DAG plan without executing

### Hidden/Undocumented Commands
- `cmd_doctor()` — Environment diagnostic (not exposed in main CLI)

### Missing Commands (Docs Promise But Not Implemented)
- `firsttry license activate` — Mentioned in docs but not found in code

---

## Gates (Check Suites)

### Tier: free-lite
- pre-commit gate (basic checks)

### Tier: free-strict
- ci gate (comprehensive checks)

### Tier: pro+
- ci-parity gate (matches remote CI)

### Available Individual Gates
- PythonPytestGate, PythonMypyGate, PythonRuffGate
- CoverageCheckGate, ConfigDriftGate, DriftCheckGate
- SecurityBanditGate, NodeNpmTestGate, GoTestGate
- DepsGate, DepsLockGate, PreCommitAllGate
- CiFilesChangedGate, CiStatusGate, CiDiscoveryGate
- ... (20+ total)

---

## Runners (Check Implementations)

| Runner | Language | Status | Notes |
|--------|----------|--------|-------|
| PytestRunner | Python | ✅ EXISTS | Test execution |
| RuffRunner | Python | ✅ EXISTS | Linting |
| MypyRunner | Python | ✅ EXISTS | Type checking |
| BanditRunner | Python | ✅ EXISTS | Security scanning |
| NpmTestRunner | JavaScript | ✅ EXISTS | Test execution |
| NpmLintRunner | JavaScript | ✅ EXISTS | Linting |
| ESLintRunner | JavaScript | ✅ EXISTS | Advanced linting |
| GoTestRunner | Go | ✅ EXISTS | Test execution |
| CustomRunner | User-defined | ✅ EXISTS | Extensibility |
| CiParityRunner | Multi | ✅ EXISTS | CI replication |
| PipAuditRunner | Python | ✅ EXISTS | Dependency audit |
| ... | ... | ... | (16 total) |

---

## Configuration Files Supported

- `.firsttry.yml` — YAML format (primary)
- `firsttry.toml` — TOML format
- `pyproject.toml` — Standard Python project file
- `.firsttry/config.yaml` — Alternative path

### Config Keys
- `tier` — Feature tier (lite, strict, pro, enterprise)
- `checks` — Which checks to enable/disable
- `profile` — Predefined profile (fast, strict, ci, teams, pro)
- `runners` — Custom runner definitions
- `caching` — Cache configuration (backend, path, TTL)
- `gates` — Gate customization
- And more (schema in code, not documented)

---

## Output Formats

| Format | Status | Notes |
|--------|--------|-------|
| **TTY** | ✅ EXISTS | Colored terminal output (auto-detected) |
| **JSON** | ✅ EXISTS | Machine-readable via --report-json or --json |
| **HTML** | ⚠️ PARTIAL | Partial implementation (may not render all fields) |

---

## Environment Variables

### Configuration
- `FIRSTTRY_LICENSE_KEY` — Pro/Enterprise license
- `FIRSTTRY_TIER` — Override tier detection
- `FIRSTTRY_TELEMETRY_DISABLED` — Opt-out of analytics
- `CI` — Auto-detected (GitHub Actions, GitLab CI, etc.)
- `FIRSTTRY_DISABLE_AUTO_PARITY` — Skip CI parity bootstrap

### AWS (S3 Caching)
- `AWS_ACCESS_KEY_ID` — S3 credentials
- `AWS_SECRET_ACCESS_KEY` — S3 credentials
- `AWS_REGION` — S3 region

---

## Integration Points

### Git Hooks
- Pre-commit hook (auto-installed if `ci/parity.lock.json` exists)
- Pre-push hook (optional)

### CI/CD
- GitHub Actions: Auto-detected
- GitLab CI: Auto-detected
- Generic CI: Env var `CI=true` detection

### External Tools
- pytest, ruff, mypy, bandit (Python)
- npm, eslint (JavaScript)
- go test (Go)
- git (version control)
- bash/shell (for custom runners)

---

**Generated from evidence-based audit. All features verified against source code.**

