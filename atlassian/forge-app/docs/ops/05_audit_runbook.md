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

# Single audit run
bash tools/audit/v3_1/run_f100_hostile_audit_v3_1.sh

# 5x stability harness (required for production proof)
bash tools/audit/v3_1/run_stability_5x.sh

# Check exit code
echo $?  # 0 = pass, 1 = reject

# Find latest evidence directory
ls -td /tmp/ft_audit_stability_5x_* | head -1
```

## Procedure

### Step 1: Verify Prerequisites

```bash
# Working directory: /path/to/Firsttry/atlassian/forge-app

# Verify clean worktree
git status

# Verify dependencies installed
ls node_modules/ | wc -l  # Should show hundreds of packages

# Verify required tools
jq --version
rg --version
python3 --version
```

**Expected:** All commands succeed, worktree clean.

### Step 2: Run Single Audit (Test)

```bash
# Working directory: /path/to/Firsttry/atlassian/forge-app
bash tools/audit/v3_1/run_f100_hostile_audit_v3_1.sh
```

**What happens (12 phases):**
1. **Phase 00:** Dependency install, lockfile verification
2. **Phase 01:** Supply chain (duplicates, outdated, npm audit)
3. **Phase 02:** Secret detection (regex, entropy, trufflehog)
4. **Phase 03:** Entrypoint binding (manifest resolvers)
5. **Phase 04:** Exfiltration risk (network calls, telemetry)
6. **Phase 05:** Forge-specific (storage isolation, rate limits)
7. **Phase 06:** Manifest validation (scopes, modules)
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
