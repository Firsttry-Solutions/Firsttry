# FirstTry – Feature Surface Map (User Interaction Paths)

**Audit Date**: 2024-12-18  
**Commit**: 7239999e9a0ab33c18938cb947d37037f5cdfb59  
**Purpose**: Maps how end users actually interact with FirstTry today

---

## Primary User Journey: Developer Running Checks Locally

### Scenario: Developer pushes code after local checks pass

```
┌─────────────────────────────────────────────────────────────┐
│ Developer's Workflow                                        │
├─────────────────────────────────────────────────────────────┤
│
│  1. Initialize Repository (First Run)
│     └─→ Install FirstTry: pip install firsttry
│     └─→ (Optional) Set license: export FIRSTTRY_LICENSE_KEY=...
│     └─→ (Optional) Create config: .firsttry.yml
│
│  2. Run Checks (Pre-Commit)
│     └─→ Command: firsttry run --profile fast
│     └─→ Or: firsttry run --tier free-strict
│     └─→ Or: firsttry run --gate pre-commit
│
│  3. View Results
│     └─→ Output: TTY (colored terminal)
│     └─→ Exit code: 0 (pass) or non-zero (fail)
│     └─→ Optional: --report-json report.json
│
│  4. Fix Issues (if fail)
│     └─→ Command: ruff check --fix src/
│     └─→ Or: mypy --fix (if available)
│     └─→ Or: pytest tests/ -xvs (run failed tests)
│
│  5. Re-run Checks
│     └─→ Command: firsttry run --profile fast
│     └─→ Speed: 2-3x faster (cached results)
│
│  6. Commit (if pass)
│     └─→ git commit -m "feat: add feature"
│     └─→ Pre-commit hook auto-runs checks (if installed)
│
│  7. Push
│     └─→ git push origin branch
│     └─→ Pre-push hook auto-runs checks (if installed)
│
└─────────────────────────────────────────────────────────────┘
```

**Surface Interaction Points**:
- ✅ CLI: `firsttry run [options]`
- ✅ Output: TTY (colored) + JSON report
- ✅ Exit codes: 0 or non-zero
- ✅ Config: .firsttry.yml (optional)
- ✅ Hooks: Auto-installed (optional)
- ✅ Env vars: `FIRSTTRY_LICENSE_KEY` (optional)

---

## CI/CD Integration: GitHub Actions

### Scenario: GitHub Actions workflow runs FirstTry in CI

```
┌─────────────────────────────────────────────────────────────┐
│ CI Workflow Integration                                     │
├─────────────────────────────────────────────────────────────┤
│
│  Workflow File: .github/workflows/test.yml
│  ────────────────────────────────────────
│  
│  jobs:
│    test:
│      runs-on: ubuntu-latest
│      steps:
│        - uses: actions/checkout@v3
│        - uses: actions/setup-python@v4
│        - run: pip install firsttry
│        
│        - name: Run FirstTry (pre-commit)
│          run: firsttry run --gate pre-commit
│        
│        - name: Run FirstTry (CI)
│          run: firsttry run --gate ci
│        
│        - name: Upload Report
│          if: always()
│          run: firsttry run --report-json report.json
│          # Report uploaded as artifact
│
│  Results:
│  - Exit code determines pass/fail ✅/❌
│  - TTY output visible in workflow log
│  - JSON report available for analysis
│
└─────────────────────────────────────────────────────────────┘
```

**Surface Interaction Points**:
- ✅ CLI: `firsttry run --gate [pre-commit|ci|ci-parity]`
- ✅ Exit codes: CI uses for pass/fail decision
- ✅ Output: Visible in GitHub Actions logs
- ✅ Artifacts: JSON report can be uploaded
- ✅ Auto-detection: Environment variable `CI=true` sets CI mode
- ⚠️ Telemetry: Disabled in CI automatically

---

## Advanced: CI Parity Testing (Pro Tier)

### Scenario: Developer tests that local setup matches CI

```
┌─────────────────────────────────────────────────────────────┐
│ CI Parity Workflow (Pro Tier Only)                          │
├─────────────────────────────────────────────────────────────┤
│
│  1. Initialize CI Parity (First Run)
│     └─→ FirstTry reads: .github/workflows/*.yml
│     └─→ Creates: ci/parity.lock.json
│     └─→ Auto-installs: git hooks (for parity checks)
│
│  2. Develop Locally
│     └─→ Code + commit changes
│     └─→ Pre-commit hook runs: firsttry run --gate ci-parity
│
│  3. Local Results
│     └─→ Output: TTY showing step-by-step progress
│     └─→ Optional: --report-json for CI parity report
│     └─→ Comparison: Local vs. CI spec
│
│  4. Diagnose Divergence
│     └─→ If local ✅ but CI ❌ → suggests what differs
│     └─→ Example: "Python version mismatch: 3.10 vs 3.11"
│
│  5. Update Parity Lock (if CI spec changes)
│     └─→ Workflow file modified
│     └─→ Detect: DriftCheckGate flags divergence
│     └─→ Action: Regenerate ci/parity.lock.json
│
│  6. Push with Confidence
│     └─→ Knows local matches remote CI
│     └─→ CI pass probability: high
│
└─────────────────────────────────────────────────────────────┘
```

**Surface Interaction Points**:
- ✅ CLI: `firsttry run --gate ci-parity`
- ✅ Config: ci/parity.lock.json (auto-generated)
- ✅ Hooks: Git pre-commit (auto-installed)
- ✅ Output: TTY + JSON report
- ✅ Detection: Automatic CI provider detection (GitHub, GitLab, etc.)
- ⚠️ License: Pro tier required
- ⚠️ Env: Auto-detected from CI workflow

---

## Configuration-Driven Setup

### Scenario: Team standardizes FirstTry configuration

```
┌─────────────────────────────────────────────────────────────┐
│ Configuration-Based Workflow                                │
├─────────────────────────────────────────────────────────────┤
│
│  File: .firsttry.yml (in repo)
│  ─────────────────────────────────
│
│  tier: free-strict              # Tier level
│  profile: strict                # Pre-defined profile
│  gates:                          # Enabled gates
│    - pre-commit
│    - ci
│  runners:                        # Runner config
│    pytest:
│      args: "-xvs --cov"
│    mypy:
│      args: "--strict"
│  caching:
│    backend: local               # Or: s3 (Pro+)
│    ttl: 86400                   # 1 day
│
│  Usage:
│  ──────
│  Developer 1: firsttry run        # Uses .firsttry.yml
│  Developer 2: firsttry run        # Same config
│  CI:          firsttry run        # Same config
│  Result:      All developers use same checks ✅
│
└─────────────────────────────────────────────────────────────┘
```

**Surface Interaction Points**:
- ✅ Config file: .firsttry.yml or pyproject.toml
- ✅ CLI: `firsttry run` (reads config automatically)
- ✅ Validation: Can be added (currently missing)
- ✅ Override: CLI flags override config
- ⚠️ Documentation: Config schema not user-documented

---

## Troubleshooting: Doctor Diagnostic

### Scenario: Developer has issues, runs diagnostics

```
┌─────────────────────────────────────────────────────────────┐
│ Doctor Tool (Hidden But Available)                          │
├─────────────────────────────────────────────────────────────┤
│
│  Developer issue:
│  "firsttry run fails with cryptic error"
│
│  Attempted access: firsttry doctor    # FAILS (command not found)
│  
│  Reason:
│  - Doctor tool exists (src/firsttry/doctor.py)
│  - Not registered as public CLI command
│  - Must be accessed via Python import
│
│  What it would check (if public):
│  - ✅ Git repo exists
│  - ✅ Python version >= 3.10
│  - ✅ Required tools installed (pytest, ruff, mypy, etc.)
│  - ✅ Config file validity
│  - ✅ License status (if Pro tier)
│  - ✅ Cache accessibility
│  - ✅ Pre-commit hooks state
│
│  Current workaround:
│  - Manual inspection of environment
│  - Check tool versions manually
│  - Inspect config file for syntax errors
│
│  Recommendation:
│  - Expose as public CLI command (easy fix)
│
└─────────────────────────────────────────────────────────────┘
```

**Surface Interaction Points**:
- ❌ CLI: `firsttry doctor` (NOT YET PUBLIC)
- ✅ Function: cmd_doctor() exists in code
- ⚠️ Accessibility: Currently hidden from users

---

## License Management

### Scenario: Team upgrades from Free to Pro tier

```
┌─────────────────────────────────────────────────────────────┐
│ License Activation Journey                                  │
├─────────────────────────────────────────────────────────────┤
│
│  Step 1: Purchase License
│         └─→ Visit firsttry.com/pricing
│         └─→ Purchase Pro license
│         └─→ Receive: FIRSTTRY_LICENSE_KEY=<key>
│
│  Step 2: Activate License
│         Attempted: firsttry license activate   # FAILS (not implemented)
│         
│         Current workaround:
│         export FIRSTTRY_LICENSE_KEY=<key>
│         firsttry run --tier pro               # Requires --tier override
│
│  Step 3: Unlock Pro Features
│         With valid license:
│         - S3 caching available
│         - CI parity runner available
│         - Drift detection available
│         
│         Command: firsttry run --tier pro
│         Output: "Pro tier activated" (if key valid)
│
│  Step 4: Set Globally (Recommended)
│         ~/.bashrc or ~/.zshrc:
│         export FIRSTTRY_LICENSE_KEY=<key>
│         
│         Then: firsttry run    # Auto-detects Pro tier
│
│  Pain Points:
│  - No interactive activation command
│  - Manual env var setting required
│  - License key in shell history (security risk)
│  - No indication of license validity/expiry
│
└─────────────────────────────────────────────────────────────┘
```

**Surface Interaction Points**:
- ✅ Env var: `FIRSTTRY_LICENSE_KEY`
- ✅ CLI flag: `--tier pro`
- ❌ CLI command: `license activate` (NOT IMPLEMENTED)
- ⚠️ Security: Key often in shell history or .bashrc (unencrypted)

---

## Caching: Local vs. S3

### Scenario: Team adds S3 cache for shared build farm

```
┌─────────────────────────────────────────────────────────────┐
│ Caching Configuration                                       │
├─────────────────────────────────────────────────────────────┤
│
│  Default: Local Cache
│  ────────────────────
│  Location: .firsttry/cache/
│  Storage: Flat files on disk
│  Speed: Instant (same machine)
│  Benefit: No network overhead
│  Limitation: Not shared across machines
│
│  Config (.firsttry.yml):
│  caching:
│    backend: local
│    path: .firsttry/cache    # Configurable
│    ttl: 86400               # 1 day
│
│  ────────────────────────────────────────────
│
│  Pro: Shared S3 Cache
│  ────────────────────
│  Location: AWS S3 bucket
│  Storage: Compressed results in S3
│  Speed: 200-500ms per lookup (network)
│  Benefit: Shared across build farm
│  Limitation: Requires AWS credentials + internet
│  License: Pro tier only
│
│  Config (.firsttry.yml):
│  caching:
│    backend: s3
│    bucket: my-firsttry-cache
│    region: us-east-1
│
│  Environment:
│  export AWS_ACCESS_KEY_ID=...
│  export AWS_SECRET_ACCESS_KEY=...
│
│  Usage:
│  Developer 1 runs: firsttry run    → Uploads cache to S3
│  Developer 2 runs: firsttry run    → Downloads cache from S3
│  Result: Faster second run (S3 hit) ✅
│
│  Optimization:
│  - Cache invalidated on: tool version change, config change
│  - Deterministic keys: same inputs → same cache entry
│  - TTL: Configurable expiration
│
└─────────────────────────────────────────────────────────────┘
```

**Surface Interaction Points**:
- ✅ Config: .firsttry.yml (caching section)
- ✅ Env vars: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
- ✅ CLI: No explicit cache control (automatic)
- ⚠️ License: S3 backend Pro tier only

---

## Reporting: JSON Export for Analytics

### Scenario: Team wants to track check results over time

```
┌─────────────────────────────────────────────────────────────┐
│ Reporting & Analytics                                       │
├─────────────────────────────────────────────────────────────┤
│
│  Command: firsttry run --report-json results.json
│  
│  Output File Structure:
│  ──────────────────────
│  {
│    "summary": {
│      "total_checks": 12,
│      "passed": 10,
│      "failed": 2,
│      "skipped": 0,
│      "duration": 34.5
│    },
│    "checks": [
│      {
│        "name": "ruff",
│        "status": "pass",
│        "issues": 0,
│        "duration": 2.3
│      },
│      {
│        "name": "pytest",
│        "status": "pass",
│        "coverage": 85.2,
│        "tests_run": 342,
│        "duration": 14.2
│      },
│      ...
│    ],
│    "timestamp": "2024-12-18T10:30:45Z"
│  }
│
│  Usage:
│  ──────
│  1. Export after each run: firsttry run --report-json results.json
│  2. Collect results: git commit results.json
│  3. Track trends: Parse JSON over time
│  4. Analyze: Coverage declining? Tests getting slower?
│  5. Alert: Custom script checks for regressions
│
│  Benefits:
│  - Machine-readable format
│  - Automated analysis possible
│  - Integration with dashboards (if built)
│  - Trend detection (manual for now)
│
│  Limitation:
│  - No built-in trend dashboard
│  - No historical storage
│  - Manual JSON parsing required
│
└─────────────────────────────────────────────────────────────┘
```

**Surface Interaction Points**:
- ✅ CLI flag: `--report-json <path>`
- ✅ Output format: JSON (schema in code, not documented)
- ✅ Automation: Can be scripted
- ⚠️ Analytics: No built-in dashboard

---

## Custom Runners: Extending FirstTry

### Scenario: Team adds organization-specific checks

```
┌─────────────────────────────────────────────────────────────┐
│ Custom Runner Extension                                     │
├─────────────────────────────────────────────────────────────┤
│
│  Use Case:
│  - Run proprietary security scanner
│  - Check license header in files
│  - Validate API contracts
│  - Organization-specific compliance
│
│  Implementation:
│  ───────────────
│  1. Write custom runner:
│     class OrgSecurityScanRunner(CheckRunner):
│       def run(self):
│         # Run org security tool
│         # Return result
│
│  2. Register in config:
│     .firsttry.yml:
│     runners:
│       org-security:
│         path: src/runners/org_security.py
│         command: python -m org_security_scan
│
│  3. Use in gate:
│     gates:
│       - org-security
│
│  4. Run checks:
│     firsttry run --gate ci
│     # Includes org security check
│
│  Implementation Status:
│  ✅ CustomRunner exists (template)
│  ✅ Can write custom runners
│  ⚠️ Registration process unclear (docs missing)
│  ⚠️ Runner interface not formally documented
│
│  Effort:
│  - Easy: Simple shell command in CustomRunner
│  - Medium: Full Python runner implementation
│  - Hard: Complex stateful checks
│
└─────────────────────────────────────────────────────────────┘
```

**Surface Interaction Points**:
- ✅ CustomRunner class (template)
- ✅ Config: .firsttry.yml (runners section)
- ⚠️ Documentation: Runner interface not documented
- ⚠️ CLI: No runner validation command

---

## Enterprise: Policy Enforcement

### Scenario: Enterprise org enforces security policies

```
┌─────────────────────────────────────────────────────────────┐
│ Enterprise Policy Workflow                                  │
├─────────────────────────────────────────────────────────────┤
│
│  Use Case:
│  - Minimum 80% code coverage required
│  - No hardcoded secrets allowed
│  - All dependencies locked
│  - Specific Python version required
│  - License headers in all files
│
│  Configuration:
│  ───────────────
│  File: policies/enterprise-strict.json
│  {
│    "minimum_coverage": 80,
│    "banned_functions": ["eval", "exec"],
│    "allowed_python_versions": ["3.10", "3.11"],
│    "require_license_header": true,
│    "forbidden_packages": ["requests", "urllib3"]
│  }
│
│  Activation:
│  ───────────
│  .firsttry.yml:
│  tier: enterprise
│  policy: enterprise-strict
│  license: (FIRSTTRY_LICENSE_KEY env var)
│
│  Usage:
│  ──────
│  firsttry run --tier enterprise
│  # Validates against policy
│  # Fails if any policy violated
│
│  Current Status:
│  ✅ Policy file format exists (examples)
│  ⚠️ Policy enforcement partially implemented
│  ❌ Policy editor CLI missing
│  ❌ Policy validation command missing
│  ⚠️ Policy documentation missing (user guide)
│
│  User Experience:
│  - Enterprise customers must write JSON manually
│  - No way to validate policy before deployment
│  - No guidance on policy best practices
│  - Support must help with policy creation
│
└─────────────────────────────────────────────────────────────┘
```

**Surface Interaction Points**:
- ⚠️ Config: policies/enterprise-strict.json (manual creation)
- ✅ CLI flag: `--tier enterprise`
- ❌ CLI command: `policy validate` (NOT IMPLEMENTED)
- ✅ Env var: `FIRSTTRY_LICENSE_KEY`
- ⚠️ Documentation: Policy format not documented

---

## Quick Reference: User Command Paths

### Basic Developer
```bash
# Install
pip install firsttry

# Run checks (default tier: free-strict)
firsttry run

# With specific tier
firsttry run --tier free-strict
firsttry run --profile fast

# Export report
firsttry run --report-json report.json

# Exit code check
firsttry run && echo "PASS" || echo "FAIL"
```

### Pro Developer (with caching + S3)
```bash
# License
export FIRSTTRY_LICENSE_KEY=<key>

# S3 caching
export AWS_ACCESS_KEY_ID=<id>
export AWS_SECRET_ACCESS_KEY=<key>

# Run with Pro features
firsttry run --tier pro

# CI parity
firsttry run --gate ci-parity

# Report
firsttry run --report-json report.json
```

### CI/CD (GitHub Actions)
```bash
- run: pip install firsttry
- run: firsttry run --gate pre-commit
- run: firsttry run --gate ci
- run: firsttry run --report-json report.json
```

### Enterprise
```bash
# License + policy
export FIRSTTRY_LICENSE_KEY=<key>

# Run with policy
firsttry run --tier enterprise

# (Manual policy JSON creation)
```

---

## Feature Surface Summary

### User Touchpoints (Actually Exposed)

| Touchpoint | Type | Status | Notes |
|-----------|------|--------|-------|
| **CLI Command** | Interface | ✅ EXISTS | `firsttry run [options]` |
| **Exit Codes** | Interface | ✅ EXISTS | 0=pass, non-zero=fail |
| **TTY Output** | Output | ✅ EXISTS | Colored terminal output |
| **JSON Report** | Output | ✅ EXISTS | `--report-json <path>` |
| **Config Files** | Config | ✅ EXISTS | .firsttry.yml, pyproject.toml |
| **Env Vars** | Config | ✅ EXISTS | LICENSE_KEY, AWS credentials, CI |
| **Git Hooks** | Integration | ✅ EXISTS | Auto-installed (optional) |
| **GitHub Detection** | Integration | ✅ EXISTS | Auto-detected (CI mode) |
| **HTML Report** | Output | ⚠️ PARTIAL | Basic implementation |
| **License Activation** | Interface | ❌ MISSING | Command not implemented |
| **Policy Editor** | Interface | ❌ MISSING | No CLI command |
| **Config Validator** | Interface | ❌ MISSING | No CLI command |
| **Doctor Tool** | Interface | ✅ EXISTS | But hidden (not public CLI) |

### Hidden Features (In Code But Not User-Accessible)

| Feature | Why Hidden | Impact |
|---------|-----------|--------|
| Doctor | Not registered as CLI command | Medium (support burden) |
| Trial Mode | No CLI to activate | Low-Medium (onboarding) |
| Fastpath | Transparent optimization | None (works behind scenes) |
| Telemetry | No user introspection | Low (privacy concern) |

---

**Generated from evidence-based analysis of source code and CLI structure.**

