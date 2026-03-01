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
