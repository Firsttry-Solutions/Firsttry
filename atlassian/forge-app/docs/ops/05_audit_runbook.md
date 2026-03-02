# Audit Runbook — Deterministic Audit, 5x Stability, Artifacts

**Doc ID:** FT-OPS-005  
**Version:** 1.0.0  
**Owner:** operations@firsttry.run  
**Last Updated:** 2026-03-01  
**Review Cycle:** Quarterly  

## Audience

Operators, reviewers, and auditors running and interpreting the FirstTry enterprise audit v3.1.

## Prerequisites

- Completed [02_local_setup.md](02_local_setup.md)
- Clean worktree (`git status` shows no uncommitted changes)
- Dependencies installed (`npm ci` completed)
- Python 3.11+ installed
- jq, ripgrep installed

## What Success Looks Like

- Audit exits 0 (CONDITIONAL_ACCEPT)
- All 5 runs in stability harness exit 0
- Evidence directories created with canonical artifacts
- Results parseable and interpretable

## Quick Reference

```bash
# Working directory: /path/to/Firsttry/atlassian/forge-app

# ★ RECOMMENDED: Deterministic audit runner (single canonical command)
bash tools/audit/v3_1/run_deterministic.sh

# Check exit code
echo $?  # 0 = CONDITIONAL_ACCEPT, 1 = REJECT or preflight failure

# Find latest evidence directory (deterministic runner)
ls -ld /tmp/ft_audit_deterministic_latest  # Stable symlink
readlink /tmp/ft_audit_deterministic_latest  # Actual path

# Alternative: 5x stability harness (for CI/release gates)
bash tools/audit/v3_1/run_stability_5x.sh
```

### FORBIDDEN: Do NOT Do These

1. **Do NOT wrap audit with timeout command**  
   ❌ `timeout 300 bash tools/audit/v3_1/run_deterministic.sh`  
   ✅ `bash tools/audit/v3_1/run_deterministic.sh` (internal time budget)

2. **Do NOT run from wrong directory**  
   ❌ `cd /tmp && bash ~/Firsttry/atlassian/forge-app/tools/audit/v3_1/run_deterministic.sh`  
   ✅ `cd atlassian/forge-app && bash tools/audit/v3_1/run_deterministic.sh`

3. **Do NOT run with dirty git tree**  
   ❌ `# uncommitted changes in working tree`  
   ✅ `git status --porcelain` (should be empty)

4. **Do NOT modify evidence directories during audit**  
   ❌ `rm -rf /tmp/ft_audit_*`  
   ✅ Archive evidence after audit completes

## Procedure

### Step 1: Run Deterministic Audit (Recommended)

**This is the ONLY recommended command for operator use.**

```bash
# Working directory: /path/to/Firsttry/atlassian/forge-app
cd atlassian/forge-app

# Run deterministic audit with automatic preflight checks
bash tools/audit/v3_1/run_deterministic.sh
```

**What happens:**

1. **Preflight checks (automatic):**
   - Working directory validation (must be `atlassian/forge-app`)
   - Git clean tree check (fails if dirty)
   - Node version check (enforces major version match)
   - Dependency state (requires `package-lock.json`, runs `npm ci` if needed)
   - Semgrep version check (fails if version mismatch)
   - Network mode configuration
   - Locale/timezone standardization (LC_ALL=C, TZ=UTC)
   - Timeout discipline check (fails if wrapped with external `timeout`)

2. **Environment snapshot capture:**
   - Tool versions (node, npm, semgrep, jq, git)
   - Environment variables (FT_* flags)
   - Git state (commit hash, status, last commit)
   - Command invocation record

3. **Audit execution:**
   - Runs underlying F100 Hostile Audit v3.1 (12 phases)
   - Captures stdout/stderr to `EROOT/full.log`

4. **Evidence directory tracking:**
   - Identifies created audit directory deterministically
   - Fails if 0 or >1 directories created (non-determinism)
   - Creates stable symlinks:
     - `/tmp/ft_audit_deterministic_latest` → EROOT
     - `/tmp/ft_f100_hostile_audit_v3_1_latest` → underlying audit dir

5. **Artifact validation:**
   - Validates `results.json` exists and is valid JSON
   - Creates synthetic results.json on failure with ERROR decision
   - Copies key artifacts to `EROOT/artifacts/`

6. **Final summary:**
   - Prints decision, score, exit code
   - Prints phase result counts (FAIL/FLAG/PASS)
   - Prints HIGH flag breakdown (blocking vs allowlisted)
   - Prints reject reason if applicable
   - Prints evidence paths

**Runtime:** 2-3 minutes (including preflight checks).

**Expected output (PASS):**
```
═══════════════════════════════════════════════════════
  PREFLIGHT CONTRACT — F100 Audit v3.1
═══════════════════════════════════════════════════════

[PREFLIGHT OK] Working directory: /workspaces/Firsttry/atlassian/forge-app
[PREFLIGHT OK] Git: Clean working tree
[PREFLIGHT OK] Node: v18.20.0 (major: 18)
[PREFLIGHT OK] Lockfile: package-lock.json present
[PREFLIGHT OK] Dependencies: node_modules present
[PREFLIGHT OK] Semgrep: 1.45.0
[PREFLIGHT OK] Network: Standard mode (external links allowed)
[PREFLIGHT OK] Locale: LC_ALL=C, LANG=C, TZ=UTC
[PREFLIGHT OK] Timeout: No external timeout wrapper detected

[PREFLIGHT] All checks passed. Proceeding with audit...

============================================================
  DETERMINISTIC AUDIT RUNNER — F100 v3.1
  Evidence: /tmp/ft_audit_deterministic_20260301T120000Z_12345
  Symlink:  /tmp/ft_audit_deterministic_latest
  Started:  2026-03-01T12:00:00Z
============================================================

[... audit phases 00-12 ...]

============================================================
  DETERMINISTIC AUDIT — FINAL SUMMARY
============================================================

Decision:           CONDITIONAL_ACCEPT
Score:              72/100
Exit code:          0

Phase Results:
  FAIL:             0
  FLAG:             425
  PASS:             12

HIGH Flags:
  Blocking:         0
  Allowlisted:      382

Evidence:
  EROOT:            /tmp/ft_audit_deterministic_20260301T120000Z_12345
  Audit dir:        /tmp/ft_f100_hostile_audit_v3_1_20260301T120000Z_12345
  Symlink:          /tmp/ft_audit_deterministic_latest
  Symlink (audit):  /tmp/ft_f100_hostile_audit_v3_1_latest

Key Artifacts:
  results.json:     /tmp/ft_audit_deterministic_20260301T120000Z_12345/artifacts/results.json
  FINAL_REPORT.md:  /tmp/ft_audit_deterministic_20260301T120000Z_12345/artifacts/FINAL_REPORT.md
  Decision file:    /tmp/ft_audit_deterministic_20260301T120000Z_12345/artifacts/99_FINAL_DECISION.txt

Full log:           /tmp/ft_audit_deterministic_20260301T120000Z_12345/full.log

[DETERMINISTIC] EXIT 0 — PASS (CONDITIONAL_ACCEPT)
```

**Exit codes:**
- `0` = CONDITIONAL_ACCEPT (passes scoring policy)
- `1` = REJECT, preflight failure, or non-deterministic execution

### Step 2: Inspect Results (If Audit Fails)

**If audit exits 1, determine the root cause:**

```bash
# Read evidence directory path
EROOT=$(readlink /tmp/ft_audit_deterministic_latest)
echo "Evidence: $EROOT"

# Read final decision
jq -r '.final_decision' "$EROOT/artifacts/results.json"

# Read reject reason
jq -r '.reject_reason' "$EROOT/artifacts/results.json"

# List FAIL phases
jq -r '.results[] | select(.status=="FAIL") | "[\(.phase)] \(.message)"' \
  "$EROOT/artifacts/results.json"

# Count blocking HIGHs
jq -r '.blocking_high_count' "$EROOT/artifacts/results.json"

# Full log
less "$EROOT/full.log"
```

### If It Fails, What Now?

| Failure Type | Symptoms | Root Cause | Fix |
|--------------|----------|------------|-----|
| **Preflight failure** | `[PREFLIGHT FAIL]` message, exits before audit runs | Environment not deterministic | See preflight fix table below |
| **No evidence directory created** | `[ERROR] No new evidence directory created` | Audit terminated before creating temp dir | Check full.log for early failure (missing tool, permission denied) |
| **Multiple evidence directories** | `[ERROR] Multiple evidence directories created` | Non-deterministic audit execution (race condition or parallel run) | Do NOT run multiple audits in parallel. Run sequentially. |
| **results.json missing** | `[ERROR] results.json missing from audit output` | Audit failed before phase 13 (Evidence Packaging) | Check full.log for FAIL phase. Fix underlying issue and rerun. |
| **results.json corrupted** | `[ERROR] results.json is not valid JSON` | Truncated write or process killed mid-write | Do NOT kill audit mid-run. Let it complete or fail naturally. |
| **REJECT decision** | `Decision: REJECT`, exit 1 | One or more phases returned FAIL status, or score < 50, or blocking HIGHs >= 3 | See reject_reason field. Fix FAIL phases or allowlist known issues. |
| **HIGH_RISK decision** | `Decision: HIGH_RISK`, exit 1 | Score 50-64, some blocking issues | Review FAIL phases and HIGH flags. Remediate or request policy exception. |
| **CONDITIONAL_REMEDIATION_REQUIRED** | `Decision: CONDITIONAL_REMEDIATION_REQUIRED`, exit 1 | Score 65-84, manageable risk | Review MEDIUM/HIGH flags. Document mitigations. May proceed with sign-off. |

### Preflight Failure Fixes

| Preflight Check | Failure Symptom | Fix |
|-----------------|-----------------|-----|
| Working directory | `package.json not found` | `cd atlassian/forge-app` before running audit |
| Git clean tree | `Git working tree is dirty` | `git status --porcelain`, commit or stash changes |
| Node version | `Node version mismatch: found v20.x, expected v18.x` | Install Node 18: `nvm install 18` or `fnm use 18` |
| Lockfile missing | `package-lock.json missing` | `npm install` (generates lockfile) |
| node_modules missing | `node_modules missing and FT_AUDIT_NO_INSTALL=1` | `npm ci` then retry audit |
| Semgrep missing | `semgrep not found and FT_AUDIT_NO_INSTALL=1` | `pip3 install semgrep==1.45.0` |
| Semgrep version mismatch | `semgrep version mismatch: found 1.50.0, expected 1.45.0` | `pip3 install semgrep==1.45.0 --force-reinstall` |
| Timeout wrapper | `Audit wrapped with timeout command` | Do NOT use `timeout`. Run directly: `bash tools/audit/v3_1/run_deterministic.sh` |

### Step 3: Parse Results.json Fields

**Deterministic runner ensures results.json always has these fields:**

```bash
EROOT=$(readlink /tmp/ft_audit_deterministic_latest)
RJ="$EROOT/artifacts/results.json"

# Final decision (CONDITIONAL_ACCEPT, REJECT, etc.)
jq -r '.final_decision' "$RJ"

# Score (0-100)
jq -r '.score' "$RJ"

# Phase result counts
jq -r '.fail_count' "$RJ"  # Number of FAIL phases
jq -r '[.results[] | select(.status=="FLAG")] | length' "$RJ"  # Total FLAGS
jq -r '[.results[] | select(.status=="PASS")] | length' "$RJ"  # Total PASS

# HIGH flag breakdown
jq -r '.blocking_high_count' "$RJ"      # HIGHs that trigger reject
jq -r '.allowlisted_high_count' "$RJ"   # HIGHs that are reviewed/accepted

# Reject reason (if decision != CONDITIONAL_ACCEPT)
jq -r '.reject_reason' "$RJ"

# Metadata
jq -r '.meta.version' "$RJ"      # Audit version (3.1)
jq -r '.meta.timestamp' "$RJ"    # Completion timestamp
jq -r '.meta.runner' "$RJ"       # Runner script name
```

### Step 4: Run 5x Stability Harness (For CI/Release Gates)
8. **Phase 07:** Runtime checks (lint, test, build)
9. **Phase 08:** Data flow (PII, tenant isolation)
10. **Phase 09:** Observability (logging, secrets exposure)
11. **Phase 10:** Silent failures (error handling)
12. **Phase 11:** Legal (licenses, external links)

**Runtime:** 2-3 minutes.

**Expected output (summary):**
```
=== AUDIT COMPLETE ===
Decision: CONDITIONAL_ACCEPT
Score: 72/100
FAIL phases: 0
HIGH flags (blocking): 0
HIGH flags (allowlisted): 382
MEDIUM flags: 40
LOW flags: 3

Evidence: /tmp/ft_f100_hostile_audit_v3_1_20260301T055945Z_12345

EXIT 0 — CONDITIONAL ACCEPT
```

**Verification:**
```bash
echo $?  # Must be 0
```

### Step 3: Examine Evidence Directory

```bash
# Working directory: any
evdir=$(ls -td /tmp/ft_f100_hostile_audit_v3_1_* | head -1)
cd "$evdir"
ls -la
```

**Required files (canonical artifacts):**
- `results.json` — Machine-readable phase results (427+ entries)
- `FINAL_REPORT.md` — Human-readable audit report
- `99_FINAL_DECISION.txt` — Single-line decision
- `SCORING_SUMMARY.json` — Score breakdown

**Phase-specific evidence:**
- `PHASE_00_*.txt` — Dependency snapshots
- `PHASE_01_*.txt` — Supply chain findings
- `PHASE_02_*.txt` — Secret scan results
- ...
- `PHASE_11_*.txt` — Legal compliance

**Verification:**
```bash
# Validate results.json parseability
jq empty results.json && echo "Valid JSON"

# Count results
jq '.results | length' results.json

# View decision
cat 99_FINAL_DECISION.txt
```

### Step 4: Run 5x Stability Harness

**Required for production deployments.**

```bash
# Working directory: /path/to/Firsttry/atlassian/forge-app
bash tools/audit/v3_1/run_stability_5x.sh
```

**What happens:**
- Runs audit 5 times sequentially
- Each run must exit 0
- Fail-fast on first non-PASS
- Records 5 separate evidence directories

**Runtime:** 10-12 minutes (5 × 2min).

**Expected output:**
```
========================================================================
  F100 AUDIT STABILITY HARNESS — 5x Deterministic Run
========================================================================

RUN 1/5
  Evidence: /tmp/ft_f100_hostile_audit_v3_1_..._1
  Exit code: 0
  Decision: CONDITIONAL_ACCEPT

RUN 2/5
  Evidence: /tmp/ft_f100_hostile_audit_v3_1_..._2
  Exit code: 0
  Decision: CONDITIONAL_ACCEPT

RUN 3/5
  Evidence: /tmp/ft_f100_hostile_audit_v3_1_..._3
  Exit code: 0
  Decision: CONDITIONAL_ACCEPT

RUN 4/5
  Evidence: /tmp/ft_f100_hostile_audit_v3_1_..._4
  Exit code: 0
  Decision: CONDITIONAL_ACCEPT

RUN 5/5
  Evidence: /tmp/ft_f100_hostile_audit_v3_1_..._5
  Exit code: 0
  Decision: CONDITIONAL_ACCEPT

========================================================================
  STABILITY TEST: SUCCESS
========================================================================

Stability evidence: /tmp/ft_audit_stability_5x_20260301T055945Z
Summary: /tmp/ft_audit_stability_5x_20260301T055945Z/SUCCESS.txt
```

**Verification:**
```bash
# Check exit code
echo $?  # Must be 0

# View summary
stabdir=$(ls -td /tmp/ft_audit_stability_5x_* | head -1)
cat "$stabdir/SUCCESS.txt"
```

### Step 5: Interpret Results

#### Exit Codes

| Exit Code | Meaning | Action |
|-----------|---------|--------|
| 0 | CONDITIONAL_ACCEPT | Deploy allowed |
| 1 | REJECT / CONDITIONAL_REMEDIATION_REQUIRED / HIGH_RISK | Fix issues, rerun |
| 2 | Audit script error | Check logs, report bug |

#### Decision States

**CONDITIONAL_ACCEPT (exit 0):**
- Score >= 70 AND blocking_highs == 0
- OR score >= 85 AND blocking_highs < 3
- **Action:** Deployment allowed

**CONDITIONAL_REMEDIATION_REQUIRED (exit 1):**
- Score 65-69 with operational concerns
- **Action:** Review MEDIUM/LOW flags, address if critical

**HIGH_RISK (exit 1):**
- Score 50-64 with multiple MEDIUM flags
- **Action:** Address MEDIUM flags before deployment

**REJECT (exit 1):**
- Score < 50 OR blocking_highs >= 3 OR has_fail == 1
- **Action:** Address blocking HIGHs and FAIL phases

#### Blocking vs Allowlisted HIGHs

**Blocking HIGH:**
- Security issue requiring remediation
- `allowlisted == false` or `allowlisted == null`
- Counted toward reject threshold (3+ = REJECT)

**Allowlisted HIGH:**
- Reviewed operational concern or platform guarantee
- `allowlisted == true`
- NOT counted toward reject threshold

**Examples of allowlisted HIGHs:**
- Phase 05 storage operations (Forge tenant isolation)
- Phase 01 duplicate packages (non-critical, npm ecosystem normal)
- Phase 01 outdated packages (managed by Dependabot)
- Phase 02 trufflehog unavailable (regex/entropy fallback sufficient)

#### Phase Statuses

**PASS:**
- Phase completed with no issues
- All checks executed and passed
- No flags or failures

**PASS_WITH_SKIPS:**
- Phase completed successfully, but some checks were skipped
- Skipped checks are flagged (LOW/MEDIUM severity)
- Common in **Phase 07 (Runtime Execution Gates)** when:
  - `npm test` skipped (FT_SKIP_TESTS_IN_AUDIT=1 — tests run separately in CI)
  - `forge lint` skipped (requires Forge authentication, not available in cleanroom)
  - `forge deploy --dry-run` skipped (requires auth or CLI doesn't support --dry-run)
- **Action:** Review `artifacts/PHASE_07_ran.txt` and `artifacts/PHASE_07_skipped.txt` to verify skip reasons acceptable for your environment. Skipped checks do NOT trigger REJECT but should be manually verified if critical.

**FLAG:**
- Phase detected an issue but did not fail
- Severity: LOW, MEDIUM, or HIGH
- High-severity flags may trigger REJECT if 3+ are blocking

**FAIL:**
- Phase detected a critical issue
- Audit immediately REJECTs
- Must be remediated before deployment

**Query phase statuses:**
```bash
evdir=$(ls -td /tmp/ft_f100_hostile_audit_v3_1_* | head -1)

# List all PASS phases
jq -r '.results[] | select(.status=="PASS") | "[\(.phase)] \(.message)"' \
  "$evdir/artifacts/results.json"

# List PASS_WITH_SKIPS phases
jq -r '.results[] | select(.status=="PASS_WITH_SKIPS") | "[\(.phase)] \(.message)"' \
  "$evdir/artifacts/results.json"

# View skipped checks in Phase 07
cat "$evdir/artifacts/PHASE_07_skipped.txt" 2>/dev/null || echo "No skips"

# View which checks ran in Phase 07  
cat "$evdir/artifacts/PHASE_07_ran.txt" 2>/dev/null || echo "No checks ran"
```

### Step 6: Parse Results Programmatically

**Count blocking HIGHs:**
```bash
evdir=$(ls -td /tmp/ft_f100_hostile_audit_v3_1_* | head -1)
cd "$evdir"
jq '[.results[] | select(.severity=="HIGH" and (.allowlisted != true))] | length' results.json
```

**List all blocking HIGHs:**
```bash
jq -c '.results[] | select(.severity=="HIGH" and (.allowlisted != true))' results.json
```

**Get scoring breakdown:**
```bash
cat SCORING_SUMMARY.json
```

**Expected format:**
```json
{
  "score": 72,
  "decision": "CONDITIONAL_ACCEPT",
  "has_fail": 0,
  "high_flags": 382,
  "high_flags_blocking": 0,
  "high_flags_allowlisted": 382,
  "medium_flags": 40,
  "low_flags": 3
}
```

## Determinism Requirements

The audit is designed for deterministic, repeatable results:

## Optional: Real-World Capability Gates v2 (50k Scale + Storage I/O + Multi-Tenant Isolation)

### Overview

Real-world capability gates v2 validate that FirstTry can handle production-scale workloads, maintain multi-tenant isolation, and enforce paid feature gating. These tests are **optional** and add ~60-120 seconds to audit runtime.

**CRITICAL CLARIFICATION: "Entities" vs. "Tenants"**

These tests generate **synthetic data entities** (user accounts, projects, diff records), NOT real tenants or real Jira instances. We CANNOT simulate 5000 tenants offline without Forge auth. Instead:
- **50,000 entities**: 10k admins + 10k shadow admins + 10k projects + 20k diff items
- **5 simulated tenants**: Used for multi-tenant isolation testing (t1..t5 with deterministic keys)

This validates performance at realistic enterprise scale within a single test environment.

**What is tested:**

1. **Multi-Tenant Isolation (100k keys)**: Verify key builder prevents collisions across 5 tenants
2. **Storage I/O Stress (50k keys)**: Test storage layer with 5 tenants × 10k keys, realistic JSON blobs
3. **Scale Test 5k entities**: Original baseline test (HTML generation for 5000 entities)
4. **Scale Test 50k entities**: Extended scale test (HTML generation for 50,000 entities)
5. **Concurrency Stress (1000 parallel ops)**: Verify thread safety under concurrent load
6. **License State Tests**: Verify paid feature gating (baseline/pro/enterprise plans)

**When to run:**
- Before marketplace submissions
- Before major releases
- When validating multi-tenant isolation fixes
- When validating performance regression fixes
- When testing on new infrastructure

### Running Real-World Gates

**Standalone execution:**
```bash
# Working directory: /path/to/Firsttry/atlassian/forge-app
bash tools/realworld/run_realworld_gates.sh
```

**Integrated with audit:**
```bash
# Set environment variable (no value assignment, just presence check)
FT_REALWORLD_GATES=1 bash tools/audit/v3_1/run_deterministic.sh
```

**Verification:**
```bash
# Check exit code
echo $?  # 0 = PASS, 1 = FAIL

# Find latest evidence
ls -ld /tmp/ft_realworld_latest  # Stable symlink
readlink /tmp/ft_realworld_latest  # Actual path

# View summary
cat /tmp/ft_realworld_latest/artifacts/REALWORLD_SUMMARY.json | jq .
```

### Understanding Results

**REALWORLD_SUMMARY.json structure (v2.0):**
```json
{
  "version": "2.0",
  "timestamp_utc": "2026-03-01T12:34:56Z",
  "git_sha": "abc123...",
  "multitenant_isolation": {
    "status": "PASS|FAIL",
    "key_count": 100000,
    "tenant_count": 5,
    "notes": ["Verifies key builder prevents collisions", ...]
  },
  "storage_io": {
    "status": "PASS|FAIL",
    "duration_ms": 5000,
    "tenant_count": 5,
    "keys_per_tenant": 10000,
    "total_keys": 50000
  },
  "scale_5k": {
    "status": "PASS|FAIL",
    "entity_count": 5000,
    "duration_ms": 150,
    "output_bytes": 1673380,
    "determinism": "PASS|FAIL"
  },
  "scale_50k": {
    "status": "PASS|FAIL",
    "entity_count": 50000,
    "duration_ms": 3000,
    "output_bytes": 15000000,
    "heap_used_bytes": 250000000,
    "determinism": "PASS|FAIL"
  },
  "concurrency": {
    "status": "PASS|FAIL",
    "levels": [100, 500, 1000],
    "failures": { "100": 0, "500": 0, "1000": 0 }
  },
  "license": {
    "status": "PASS|FAIL",
    "cases": 5,
    "total": 5
  },
  "final": {
    "status": "PASS|FAIL",
    "exit_code": 0,
    "fail_reasons": []
  }
}
```

**Interpreting statuses:**

| Field | PASS Criteria | FAIL Causes |
|-------|---------------|-------------|
| **multitenant_isolation.status** | 100k keys, no collisions, all keys tenant-prefixed | Collisions detected, invalid key format, static keys |
| **storage_io.status** | 50k keys written/read/deleted, no cross-tenant reads | Cross-tenant contamination, count mismatch, storage limits exceeded |
| **scale_5k.status** | 5000 entities processed, output generated, deterministic | Crash, out-of-memory, non-deterministic hashes |
| **scale_50k.status** | 50k entities processed, output generated, deterministic | Crash, out-of-memory, non-deterministic hashes, excessive heap |
| **concurrency.status** | All levels complete with 0 failures | Any level has failures or crashes |
| **license.status** | All test cases pass | Feature gating not working, blocking mechanism missing |
| **final.status** | All phases PASS | Any phase FAIL |

**Performance baselines (reference only):**
- Multi-tenant isolation: < 10 seconds
- Storage I/O: < 20 seconds
- Scale 5k: < 5 seconds
- Scale 50k: < 60 seconds
- Concurrency 1000: < 5 seconds
- License tests: < 1 second
- **Total runtime: < 120 seconds**

### Evidence Artifacts

**Directory structure (v2):**
```
/tmp/ft_realworld_TIMESTAMP_PID/
├── 00_env/
│   └── (environment capture files)
├── 00_multitenant/
│   ├── run.log
│   ├── key_collision_report.json
│   ├── key_format_samples.json (first 50 keys)
│   └── static_key_report.json
├── 01_scale/
│   ├── run.log          # 5k scale test log
│   ├── metrics.json
│   ├── output_hashes.json
│   └── html_snippet.txt
├── 01b_scale_50k/
│   ├── run.log          # 50k scale test log
│   ├── metrics.json
│   ├── output_hashes.json
│   └── html_snippet.txt (first 2KB)
├── 02_concurrency/
│   ├── run.log
│   └── results.json
├── 02b_storage_io/
│   ├── run.log
│   ├── storage_metrics.json
│   └── storage_invariants.json
├── 03_license/
│   ├── run.log
│   └── results.json
└── artifacts/
    └── REALWORLD_SUMMARY.json  # Final summary (v2.0)
```

**Query examples:**
```bash
RWORLD=$(readlink /tmp/ft_realworld_latest)

# Overall status
jq -r '.final.status' "$RWORLD/artifacts/REALWORLD_SUMMARY.json"

# Multi-tenant isolation
jq -r '.multitenant_isolation.status' "$RWORLD/artifacts/REALWORLD_SUMMARY.json"

# Storage I/O status
jq -r '.storage_io.status' "$RWORLD/artifacts/REALWORLD_SUMMARY.json"

# Scale tests (both)
jq -r '{scale_5k: .scale_5k.status, scale_50k: .scale_50k.status}' "$RWORLD/artifacts/REALWORLD_SUMMARY.json"

# All gate statuses
jq -r '{multitenant: .multitenant_isolation.status, storage_io: .storage_io.status, scale_5k: .scale_5k.status, scale_50k: .scale_50k.status, concurrency: .concurrency.status, license: .license.status, final: .final.status}' "$RWORLD/artifacts/REALWORLD_SUMMARY.json"

# Fail reasons (if any)
jq -r '.final.fail_reasons[]' "$RWORLD/artifacts/REALWORLD_SUMMARY.json"
```

### Troubleshooting

**Issue: Multi-tenant isolation failure (collision detected)**

**Cause:** Key builder not properly prefixing tenant keys, or collision in key generation logic.

**Fix:** Review `00_multitenant/key_collision_report.json` for collision details. Check key format in `key_format_samples.json`. Escalate with evidence.

**Issue: Storage I/O failure (cross-tenant reads)**

**Cause:** Tenant isolation broken in storage layer, keys not properly scoped.

**Fix:** Review `02b_storage_io/storage_invariants.json` for failed checks. If `no_cross_tenant_reads: FAIL`, escalate immediately (security issue).

**Issue: Storage limit exceeded (FT_REALWORLD_STORAGE_LIMIT)**

**Cause:** Test attempted to write value > 240KB, or key > 200 chars, or > 50k keys per tenant.

**Fix:** This is a LIMIT ENFORCEMENT test. If legitimate app code triggers this, app may need refactoring to respect storage limits. Review `02b_storage_io/run.log` for error details.

**Issue: Scale 50k test non-deterministic**

**Cause:** Same as Scale 5k - randomness in serialization.

**Fix:** Review `01b_scale_50k/output_hashes.json`. Compare with `01_scale/output_hashes.json` to see if determinism issue is scale-dependent or universal. Escalate with both evidence directories.

**Issue: Scale 50k excessive heap usage**

**Cause:** Memory leak or inefficient data structures at scale.

**Fix:** Review `01b_scale_50k/metrics.json` heap_used_bytes. Compare with scale_5k. If heap grows non-linearly (e.g., 50MB for 5k but 500MB for 50k), investigate memory leak.

**Issue: Concurrency test failures at level 1000**

**Cause:** Race conditions, shared mutable state, insufficient memory.

**Fix:** Review `02_concurrency/results.json` for `first_error` field. If race condition, escalate. If memory, increase Node heap: `NODE_OPTIONS="--max-old-space-size=4096"`.

**Issue: Real-world gates fail but audit passes**

**Explanation:** This is expected. Real-world gates are **optional** and test performance/scale/isolation, not correctness. Audit tests correctness (security, compliance). You can deploy if audit passes, but investigate gate failures before production load.

### Design Principles

**No network dependencies:**
- All tests run locally
- No Forge auth required
- No external API calls

**Synthetic data only:**
- Scale tests use deterministic synthetic entities (admins/projects/etc) with fixed timestamps
- Storage tests use simulated tenants (t1..t5) with deterministic key patterns
- NO claim of "5000 real tenants" or "50k real users" - these are synthetic data entities

**Bounded resources:**
- Storage uses in-memory fake_storage.ts with hard limits (240KB values, 50k keys/tenant, 200 char keys)
- Any limit violation => fail-closed with FT_REALWORLD_STORAGE_LIMIT error

**Deterministic outputs:**
- Same inputs → identical hashes (excluding timing/memory fields)
- All PRNGs use fixed seeds
- All timestamps are fixed (2026-03-01T00:00:00Z)

**Fail-closed:**
- Any unhandled exception → exit 1
- Any invariant violation → FAIL status + clear remediation guidance

**Synthetic data only:**
- Scale test uses deterministic synthetic evidence (5000 user accounts with stable IDs)
- No real PII or production data

**Deterministic outputs:**
- Same inputs → identical hashes (excluding timestamp_utc field only)
- Run twice and compare: hashes must match

**Fail-closed:**
- Any unhandled exception → exit 1
- Missing required fields → fail (not silently default)

## Determinism Requirements

### Environment Standardization

Set automatically by audit scripts:
```bash
export LC_ALL=C
export LANG=C
export TZ=UTC
export SEMGREP_ENABLE_VERSION_CHECK=0
export SEMGREP_SEND_METRICS=off
export FT_SKIP_EXTERNAL_LINKS=1
export FT_SKIP_TESTS_IN_AUDIT=1
umask 022
```

### Network Independence

- External link validation skipped (FT_SKIP_EXTERNAL_LINKS=1)
- No internet access required
- Runs in air-gapped environments

### Test Redundancy Elimination

- npm test skipped during audit (tests run separately in CI)
- No redundant executions

### Evidence Integrity

- Evidence directories immutable after creation
- Trap handler ensures canonical artifacts exist even on crash
- PID suffix prevents collisions

## Troubleshooting

### Issue: Audit exits 1 with 0 blocking HIGHs

**Cause:** Score below threshold due to MEDIUM/LOW flags.

**Fix:** Review SCORING_SUMMARY.json. If score is 65-72, review MEDIUM flags. If operational noise, escalate for allowlist consideration.

### Issue: Stability harness fails on run 2+

**Cause:** Non-deterministic behavior (race condition, network dependency, flaky test).

**Fix:** This should not happen. Escalate to maintainers with evidence directories.

### Issue: Evidence directory missing results.json

**Cause:** Audit crashed before trap handler execution.

**Fix:** Check system logs for OOM, disk space. Retry after freeing resources.

### Issue: "jq parse error" on results.json

**Cause:** Truncated JSON (disk full, premature termination).

**Fix:** Trap handler should prevent this. If occurs, escalate with corrupted file.

### Issue: Audit takes >10 minutes

**Cause:** Network timeout (external links not skipped), or slow npm operations.

**Fix:** Verify FT_SKIP_EXTERNAL_LINKS=1 is set. Check npm cache.

## Optional: Marketplace Pack Verification (Privacy & Security)

### Overview

The Marketplace Pack Verifier ensures all required privacy and security documentation is in place for Atlassian Marketplace submission. This is an **offline, deterministic verification** that checks:

- **Presence**: All required docs exist in `docs/trust/`
- **Content**: Docs have proper structure (H1, dates, required headings)
- **Linkability**: Docs are referenced in navigation (mkdocs.yml, README.md)
- **Integrity**: Internal links work, no broken references
- **Completeness**: No TODO/PLACEHOLDER/XXX tokens in required sections

**Prerequisites:**
- Real-world capability gates must be PASS (see previous section)
- All trust documentation must exist
- Navigation files must link to trust docs

### Running Marketplace Pack Verification

```bash
cd atlassian/forge-app
bash tools/marketplace/verify_privacy_security_pack.sh
```

**Expected runtime:** 5-10 seconds

**Exit codes:**
- `0` = PASS (all checks green, ready for Marketplace submission)
- `1` = REJECT (see verdict for remediation steps)

### Evidence Directory Structure

```
/tmp/ft_marketplace_pack_TIMESTAMP_PID/
├── 00_inputs/
│   └── REALWORLD_SUMMARY.json          # Prerequisite check (must be PASS)
├── 01_presence/
│   └── presence_report.txt             # Per-doc existence check
├── 02_pages/
│   └── pages_linkability_report.txt    # Navigation link verification
├── 03_links/
│   └── link_report.txt                 # Internal link integrity
├── 04_content/
│   └── content_report.txt              # Content completeness check
├── 05_verdict/
│   └── VERDICT.txt                     # PASS or REJECT with remediation
└── artifacts/
    ├── PACK_PRESENCE.json              # Machine-readable presence check
    ├── PACK_PAGES.json                 # Machine-readable linkability check
    ├── PACK_LINKS.json                 # Machine-readable link integrity
    └── PACK_CONTENT.json               # Machine-readable content check
```

**Stable symlink:** `/tmp/ft_marketplace_pack_latest` → mostrecent run

### Required Documentation Files

The verifier checks for these exact paths in `docs/trust/`:

- `README.md` - Trust center landing page
- `privacy-policy.md` - Privacy commitments and data practices
- `security.md` - Security controls and architecture
- `data-retention-deletion.md` - Data lifecycle management
- `subprocessors.md` - Third-party service providers
- `vulnerability-disclosure.md` - Security reporting process
- `support-sla.md` - Support channels and response times
- `incident-response.md` - Security incident handling
- `data-processing.md` - Data flow and processing architecture
- `access-scope-and-permissions.md` - Forge scopes and API access

### Understanding Results

#### PASS Verdict

```
PASS

✓ All required docs present (12)
✓ Navigation linkability verified
✓ Internal links integrity verified
✓ Content completeness verified

MARKETPLACE URLS (pasteable):
  - privacy-policy.md: https://firsttry.example.com/trust/privacy-policy
  - security.md: https://firsttry.example.com/trust/security
  ...
```

**Next steps:**
1. Copy URLs from verdict for Marketplace submission
2. Verify URLs are publicly accessible (GitHub Pages deployed)
3. Submit to Atlassian Marketplace with pasteable links

#### REJECT Verdict

```
REJECT

Marketplace Pack Verification: REJECT
Total failure categories: 2

MISSING DOCS (3):
  - docs/trust/support-sla.md
  - docs/trust/incident-response.md
  - docs/trust/access-scope-and-permissions.md

CONTENT ISSUES (5):
  - docs/trust/privacy-policy.md: missing 'Last updated: YYYY-MM-DD'
  - docs/trust/security.md: contains 'TODO'
  - docs/trust/subprocessors.md: missing heading 'Updates'
  ...

REMEDIATION:
1. Create missing docs in docs/trust/ with required structure
2. Add links to navigation files (mkdocs.yml or docs/README.md)
3. Fix broken internal links (see link_report.txt)
4. Remove TODO/PLACEHOLDER/XXX tokens from docs
5. Add missing required headings (see content_report.txt)
```

**Action required:** Follow remediation steps in order, then re-run verification.

### Interpreting Artifacts

#### PACK_PRESENCE.json

```json
{
  "present": ["docs/trust/README.md", "docs/trust/privacy-policy.md", ...],
  "missing": ["docs/trust/support-sla.md"],
  "total": 11,
  "missing_count": 1
}
```

- `present`: List of docs found in repo
- `missing`: List of docs that must be created
- `missing_count`: Number of missing docs (must be 0 for PASS)

#### PACK_CONTENT.json

```json
{
  "issues": [
    "docs/trust/privacy-policy.md: missing 'Last updated: YYYY-MM-DD'",
    "docs/trust/security.md: contains 'TODO'"
  ],
  "content_completeness_pass": false
}
```

- `issues`: List of content problems (empty for PASS)
- `content_completeness_pass`: Boolean (must be true)

#### PACK_LINKS.json

```json
{
  "broken_links": ["docs/trust/security.md: ../nonexistent.md"],
  "insecure_external_links": ["docs/trust/privacy.md: http://example.com"],
  "link_integrity_pass": false
}
```

- `broken_links`: Internal links that don't resolve
- `insecure_external_links`: HTTP (not HTTPS) or localhost links
- `link_integrity_pass`: Boolean (must be true)

### Troubleshooting

#### Issue: "REALWORLD gates not found"

**Symptom:**
```
FAIL: /tmp/ft_realworld_latest symlink not found
Must run realworld gates first
```

**Fix:**
```bash
cd atlassian/forge-app
bash tools/realworld/run_realworld_gates.sh
# Then retry marketplace verification
bash tools/marketplace/verify_privacy_security_pack.sh
```

#### Issue: "REALWORLD gates status = FAIL"

**Symptom:**
```
FAIL: REALWORLD gates status = FAIL (expected PASS)
Fix REALWORLD gates first before running marketplace pack verification
```

**Fix:** Marketplace verification is gated on realworld being green. Fix realworld issues first (see previous section).

#### Issue: Missing required doc

**Symptom:**
```
MISSING DOCS (1):
  - docs/trust/support-sla.md
```

**Fix:** Create the missing doc with required structure:

```markdown
# Support SLA

**Last updated: YYYY-MM-DD**

## Support channels

[Content here]

## Response times

[Content here]

## Escalation

[Content here]
```

Ensure all required headings are present (see content_report.txt for list).

#### Issue: Doc not linked in navigation

**Symptom:**
```
PAGES ISSUES (2):
  - docs/trust/support-sla.md not linked - add to docs/README.md
```

**Fix:** Add link to navigation file:

Edit `docs/README.md` and add:
```
→ [Support SLA] pointing to trust/support-sla.md
```

Or edit `mkdocs.yml` nav section:
```yaml
nav:
  - Trust:
    - "Support SLA": "trust/support-sla.md"
```

#### Issue: Broken internal link

**Symptom:**
```
LINK ISSUES (3):
  See: /tmp/ft_marketplace_pack_latest/03_links/link_report.txt
```

**Fix:** Open link_report.txt and find broken links:
```
FAIL docs/trust/security.md: broken link: ../architecture.md
```

Either:
1. Fix the link target: `../architecture.md` → `ARCHITECTURE.md`
2. Or create the missing target file

#### Issue: Content contains TODO/PLACEHOLDER

**Symptom:**
```
CONTENT ISSUES (2):
  - docs/trust/privacy-policy.md: contains 'TODO'
  - docs/trust/security.md: contains 'PLACEHOLDER'
```

**Fix:** Search and replace forbidden tokens:
```bash
cd docs/trust
grep -r "TODO" *.md        # Find occurrences
# Then edit files to replace with actual content
```

Forbidden tokens: `TODO`, `TBD`, `PLACEHOLDER`, `FILL_ME`, `XXX`, `coming soon`

#### Issue: Missing required heading

**Symptom:**
```
CONTENT ISSUES (1):
  - docs/trust/privacy-policy.md: missing heading 'Data retention'
```

**Fix:** Add the required heading to the doc:
```markdown
## Data retention

[Content describing retention policies]
```

See `04_content/content_report.txt` for full list of required headings per doc type.

### What This Does NOT Verify

The marketplace pack verifier is **offline-only** and cannot verify:

- ❌ **Actual Marketplace submission**: You still need to submit via Atlassian portal
- ❌ **GitHub Pages deployment**: Assumes docs are published, but doesn't check live URLs
- ❌ **Visual rendering**: Does not check HTML/CSS rendering of docs
- ❌ **External link validity**: Does not fetch external URLs (offline constraint)
- ❌ **Marketplace review approval**: Atlassian reviewers may have additional requirements

**This tool proves:**
- ✅ All required docs exist in repo
- ✅ Content structure meets basic requirements
- ✅ Docs are linked in navigation
- ✅ Internal links are not broken
- ✅ No obvious incomplete sections (TODO marks)

### Integration with CI

The marketplace pack verifier can run in CI to prevent doc regressions:

```yaml
- name: Verify Marketplace Pack
  working-directory: atlassian/forge-app
  run: bash tools/marketplace/verify_privacy_security_pack.sh
```

See `.github/workflows/ci-marketplace-pack.yml` for full CI integration.

**CI requirements:**
- Real-world gates must run first (produces required input)
- No network access needed (fully offline)
- Takes ~5-10 seconds
- Exit 0 = pass, exit 1 = fail (CI will fail build)

## Checklist

Before proceeding to deployment:

- [ ] Single audit run exits 0
- [ ] Stability 5x harness exits 0
- [ ] All 5 evidence directories exist
- [ ] results.json parseable with jq
- [ ] 99_FINAL_DECISION.txt shows CONDITIONAL_ACCEPT
- [ ] SCORING_SUMMARY.json shows blocking_highs == 0
- [ ] Worktree still clean (`git status`)
- [ ] Evidence directories preserved (not deleted)

## Next Steps

After audit pass:
- **For deployemnt:** [04_deploy_run.md](04_deploy_run.md)
- **For CI understanding:** [06_ci_and_artifacts.md](06_ci_and_artifacts.md)
- **For releases:** [08_release_procedure.md](08_release_procedure.md)

## Notes

- **Audit is required before production deploy.** No exceptions.
- **Evidence directories are audit trail.** Preserve for compliance.
- **Do not modify evidence dirs.** Content is immutable.
- **Stability 5x proves determinism.** Single run not sufficient for production proof.
