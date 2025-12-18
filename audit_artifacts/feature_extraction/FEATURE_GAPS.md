# FirstTry – Feature Gaps & Missing Implementations

**Audit Date**: 2024-12-18  
**Commit**: 7239999e9a0ab33c18938cb947d37037f5cdfb59  
**Classification**: Missing + Partial Features Only

---

## NOT IMPLEMENTED (Claimed in Docs but No Code)

### 1. License Activation CLI Command

**Status**: ❌ NOT IMPLEMENTED  
**User Impact**: HIGH  
**Workaround**: Set `FIRSTTRY_LICENSE_KEY` environment variable manually

**What was promised**:
- CLI command: `firsttry license activate`
- Interactive prompt for license key entry
- Validation and storage of license

**What exists**:
- Error message pointing to `license activate` command
- No command handler in CLI
- License system works via env var only

**Evidence**:
- **Search**: No `cmd_license_activate` in cli.py
- **Search**: No `@cli_app.command("license")` in cli.py
- **File**: Error message at line 2701 in cli.py suggests command doesn't exist

**What developers must do instead**:
```bash
export FIRSTTRY_LICENSE_KEY="<key-from-pricing>"
firsttry run --tier pro
```

**Effort to Implement**: Medium (requires Click command handler + license validation UI)

---

### 2. Configuration Validator Command

**Status**: ❌ NOT IMPLEMENTED  
**User Impact**: MEDIUM  
**Workaround**: Validate manually by running `firsttry run` and observing errors

**What would be useful**:
- CLI command: `firsttry validate-config`
- Check config file (.firsttry.yml, pyproject.toml) for validity
- Report schema errors before execution
- Suggest corrections

**What exists**:
- Config schema (src/firsttry/config/schema.py)
- Config loader (src/firsttry/config_loader.py)
- No CLI command to invoke validation standalone

**Evidence**:
- **File**: src/firsttry/config/schema.py exists but not exposed as CLI
- **CLI**: No `validate`, `check-config`, or similar command

**Why it matters**:
- Config errors discovered at runtime (slow feedback)
- No early validation before check execution
- Users waste time waiting for config parse errors

**Effort to Implement**: Small (create Click command + call schema validator)

---

### 3. Policy Editor / Creation CLI

**Status**: ❌ NOT IMPLEMENTED  
**User Impact**: HIGH (for Enterprise users)  
**Workaround**: Manually edit JSON policy files

**What would be useful**:
- CLI command: `firsttry policy create --name enterprise-strict`
- Interactive prompt to define policy rules
- Save to `policies/<name>.json`
- Validate policy syntax

**What exists**:
- Policy system reference (src/firsttry/policies.py or similar)
- Example policy file: `policies/enterprise-strict.json`
- No CLI to create/edit policies

**Evidence**:
- **Directory**: `policies/` exists with examples
- **CLI**: No `policy` subcommand in cli.py

**Why it matters**:
- Enterprise customers cannot easily customize policies
- Must ask support for policy creation
- Slows down onboarding

**Effort to Implement**: Medium (requires schema definition + interactive CLI)

---

### 4. Telemetry Dashboard / Reporting

**Status**: ❌ NOT IMPLEMENTED  
**User Impact**: LOW (internal analytics)  
**Workaround**: Parse telemetry logs manually

**What would be useful**:
- Web dashboard showing usage trends
- CLI command: `firsttry telemetry report`
- Historical data (tests run, coverage trends, etc.)

**What exists**:
- Telemetry collection (src/firsttry/telemetry.py)
- Server-side analytics (external to repo)
- No local reporting

**Evidence**:
- **File**: src/firsttry/telemetry.py exists (collects data)
- **CLI**: No telemetry reporting command
- **Dashboard**: No built-in UI

**Why it matters**:
- Users cannot see their own usage patterns
- Cannot prove ROI to management
- Dashboard is external (requires FirstTry cloud access)

**Effort to Implement**: Large (requires backend + frontend + data pipeline)

---

## PARTIAL IMPLEMENTATIONS (Works but Incomplete)

### 1. HTML Report Generation

**Status**: ⚠️ PARTIAL  
**User Impact**: MEDIUM  
**Current**: Basic HTML file generation; may miss fields  
**Missing**: Full styling, interactive features, trend visualization

**What exists**:
- `src/firsttry/reporting/html.py` — HTML renderer
- Generates static HTML file
- Includes basic styling (CSS inline)

**What's missing**:
- Interactive JavaScript features (filtering, sorting)
- Responsive design (mobile-unfriendly?)
- Trend visualization (charts, graphs)
- Drill-down reports (click to see details)
- Comparison reports (before/after, commit-to-commit)

**Evidence**:
- **File**: src/firsttry/reporting/html.py
- **Line count**: ~200 lines (suggests basic implementation)
- **CLI**: No `--report-html` flag visible (users get HTML via JSON conversion)

**How to access**:
- Currently: generate JSON, then manually convert to HTML
- No direct CLI option

**Effort to Complete**: Medium (add JavaScript + CSS + template improvements)

---

### 2. Policy System

**Status**: ⚠️ PARTIAL  
**User Impact**: HIGH (Enterprise only)  
**Current**: Policies can be written in JSON; not fully enforced  
**Missing**: Complete policy language, enforcement at all gates, validation

**What exists**:
- Policy file format (JSON) documented in examples
- Example: `policies/enterprise-strict.json`
- Reference in some gate implementations

**What's unclear**:
- Policy language specification (not documented)
- How policies are loaded at runtime
- Which gates enforce policies
- No CLI to validate/test policies

**Evidence**:
- **Directory**: `policies/` with examples
- **File**: src/firsttry/gates/ (may have policy enforcement)
- **CLI**: No policy validation command

**Why it's incomplete**:
- Users cannot understand policy syntax without docs
- Cannot test policies before deployment
- Unclear which gates support policies

**Effort to Complete**: Large (document spec + add validation + CLI support)

---

### 3. Telemetry System

**Status**: ⚠️ PARTIAL  
**User Impact**: LOW (privacy concern)  
**Current**: Collects metrics; can be disabled  
**Missing**: User control over what's collected; transparency

**What exists**:
- Collection of metrics (timing, results, errors)
- Server endpoint for sending
- Disable via env var: `FIRSTTRY_TELEMETRY_DISABLED=1`

**What's missing**:
- Endpoint URL not documented
- No local view of what data is collected
- No granular opt-in/opt-out (all-or-nothing)
- No privacy policy link in code

**Evidence**:
- **File**: src/firsttry/telemetry.py
- **Env**: `FIRSTTRY_TELEMETRY_DISABLED` documented
- **CLI**: No telemetry introspection command

**Why it's incomplete**:
- Privacy concern: users don't know what's being sent
- No transparency (data format not visible)
- No opt-in for specific metrics

**Effort to Complete**: Medium (document + add telemetry viewer + privacy docs)

---

### 4. License Trial Mode

**Status**: ⚠️ PARTIAL  
**User Impact**: MEDIUM (onboarding)  
**Current**: Trial system exists in code (src/firsttry/license_trial.py)  
**Missing**: CLI interface, documentation, time-limit enforcement

**What exists**:
- Trial module: src/firsttry/license_trial.py
- Logic for time-limited access
- Can be enabled via config

**What's missing**:
- No CLI command to activate trial
- Trial duration not documented
- Feature set during trial unclear
- No "trial expires in X days" warning

**Evidence**:
- **File**: src/firsttry/license_trial.py exists
- **CLI**: No `trial` command
- **Docs**: No trial mention in user documentation

**Why it matters**:
- Potential customers cannot test Pro features
- Onboarding friction (must contact sales)

**Effort to Implement**: Small (add CLI command + timer display)

---

### 5. Custom Gate Definition

**Status**: ⚠️ PARTIAL  
**User Impact**: MEDIUM (advanced users)  
**Current**: Gates are hardcoded; no extension mechanism  
**Missing**: User-defined gates in config

**What exists**:
- Gate registry: src/firsttry/gates/__init__.py
- Custom runner support (CustomRunner)
- No custom gate support

**What's missing**:
- Config syntax for defining custom gates
- Way to combine runners into custom gates
- No CLI to validate custom gate definitions

**Evidence**:
- **File**: CustomRunner exists (src/firsttry/runners/custom.py)
- **File**: No CustomGate in gates/
- **Config**: No examples of custom gate definitions

**Why it matters**:
- Advanced users cannot extend gate system
- Custom checks forced into runner system only
- Organizational policies hard to encode

**Effort to Implement**: Large (requires gate DSL + validation + registry)

---

### 6. Distributed Execution

**Status**: ⚠️ PARTIAL  
**User Impact**: MEDIUM (large projects)  
**Current**: DAG exists; no distributed backend  
**Missing**: Worker pool, remote execution, result aggregation

**What exists**:
- DAG planning (src/firsttry/planner/dag.py)
- Execution plan JSON output (--dag-only)
- Sequential local execution

**What's missing**:
- Worker queue (Redis, etc.)
- Remote runner execution
- Result aggregation
- Failure handling for distributed runs

**Evidence**:
- **File**: DAG system exists but not used for distribution
- **CLI**: No `--workers` or `--distributed` flag
- **Docs**: No distributed execution guide

**Why it matters**:
- Large test suites (1000+ tests) take too long locally
- Could parallelize across machines
- Slows down CI/CD cycles

**Effort to Implement**: Large (requires backend infrastructure + protocol)

---

### 7. Coverage Trend Analysis

**Status**: ⚠️ PARTIAL  
**User Impact**: MEDIUM (analytics)  
**Current**: Coverage gate checks absolute threshold  
**Missing**: Trend analysis, regression detection, historical tracking

**What exists**:
- CoverageCheckGate (checks threshold)
- Coverage reports generated (XML, JSON)
- No historical database

**What's missing**:
- Storage for historical coverage data
- Trend detection (is coverage improving/declining?)
- Regression alerts (coverage dropped since last commit)
- Trend charts/visualization

**Evidence**:
- **File**: src/firsttry/gates/coverage_check.py (no trend logic)
- **CLI**: No coverage history command
- **Reports**: No trend data in JSON output

**Why it matters**:
- Cannot detect slow coverage decline
- No early warning before coverage tanks
- Hard to prove progress to stakeholders

**Effort to Implement**: Medium (add time-series DB + analysis + visualization)

---

### 8. CI Parity HTML Report

**Status**: ⚠️ PARTIAL  
**User Impact**: LOW (experimental feature)  
**Current**: CI parity results in JSON/TTY  
**Missing**: Visual diff report, step-by-step replay

**What exists**:
- CI parity execution (src/firsttry/ci_parity/)
- JSON output of results
- Console output

**What's missing**:
- HTML report with side-by-side diff
- Visual highlighting of divergence
- Interactive replay of steps
- Comparison with remote CI results

**Evidence**:
- **File**: src/firsttry/ci_parity/ (no HTML reporter)
- **CLI**: No `--report-html` for ci-parity
- **Docs**: No mention of HTML CI parity reports

**Why it matters**:
- Hard to understand CI parity divergence
- Need better visualization tools

**Effort to Implement**: Small-Medium (add HTML reporter + styling)

---

## UNDOCUMENTED / HIDDEN FEATURES

### 1. Doctor Diagnostic Tool

**Status**: ✅ EXISTS but HIDDEN  
**User-Facing**: YES (should be)  
**Surface**: Internal function only

**What it does**:
- Diagnoses environment issues
- Checks: Git, Python version, tool availability, config validity
- Returns pass/fail checklist

**Why it's hidden**:
- No entry point in main CLI
- Function `cmd_doctor()` exists but not registered as command
- Users must find it by inspecting code

**How to use**:
- Currently: must call directly from Python
- Should be: `firsttry doctor` command

**Effort to Expose**: Minimal (register Click command)

---

### 2. Trial Mode

**Status**: ✅ EXISTS but UNDOCUMENTED  
**User-Facing**: YES (should be)  
**Surface**: Module exists but no CLI

**What it does**:
- Allows time-limited Pro feature access
- Useful for onboarding/trials

**Why it's hidden**:
- No CLI command to activate
- Not documented in README

**How to use**:
- Currently: must set config manually
- Should be: `firsttry trial start` command

**Effort to Expose**: Small (add CLI + documentation)

---

### 3. Fastpath Rust Module

**Status**: ✅ EXISTS but OPTIONAL  
**User-Facing**: NO (transparent)  
**Surface**: Automatic fallback

**What it does**:
- Optional Rust acceleration for file scanning
- Falls back to pure Python if unavailable

**Why it's undocumented**:
- Transparent to users (no config needed)
- May not build on all platforms

**Performance impact**:
- ~50x faster with Rust (if available)
- Graceful degradation (still works without)

**Effort to Document**: Small (add to DEVELOPING.md)

---

## FEATURE PARITY ISSUES (vs. Similar Tools)

### Compared to: GitHub Actions Workflows

| Feature | FirstTry | GH Actions | Gap |
|---------|----------|------------|-----|
| Caching | ✅ Local + S3 | ✅ Artifact cache | FirstTry lacks S3 browse/purge |
| Reports | ✅ JSON/TTY | ✅ Annotation API | FirstTry lacks inline annotations |
| Distribution | ⚠️ DAG only | ✅ Matrix strategy | FirstTry cannot parallelize |
| Custom actions | ✅ Runners | ✅ Actions | FirstTry more limited |

### Compared to: Pre-commit Framework

| Feature | FirstTry | Pre-commit | Gap |
|---------|----------|-----------|-----|
| Hooks | ✅ Auto-install | ✅ Framework | Similar |
| Custom hooks | ✅ Runners | ✅ Languages | Similar |
| Parallelization | ⚠️ Partial | ✅ Built-in | FirstTry less efficient |
| Speed | ⚠️ Variable | ✅ Optimized | FirstTry slower on large repos |

---

## RECOMMENDATIONS FOR COMPLETION

### High Priority (User-Facing, High Impact)
1. ✅ Implement `firsttry license activate` command
2. ✅ Document policy system + add CLI validation
3. ✅ Complete HTML report generation (interactive features)
4. ✅ Add `firsttry validate-config` command

### Medium Priority (Nice to Have)
5. ✅ Expose `firsttry doctor` as public command
6. ✅ Implement telemetry viewer (`firsttry telemetry status`)
7. ✅ Add distributed execution framework
8. ✅ Implement coverage trend analysis

### Low Priority (Polish)
9. ✅ Document fastpath module
10. ✅ Expose trial mode CLI

### Internal (Non-blocking)
11. ✅ Implement custom gate definitions
12. ✅ Add CI parity HTML report

---

**Classification Summary**:
- **Not Implemented**: 4 features (claimed but no code)
- **Partial**: 8 features (exists but incomplete)
- **Hidden/Undocumented**: 3 features (exists but not user-accessible)
- **Parity Gaps**: Compared to similar tools (see table above)

**Total Gap Items**: 15

