# CI and Artifacts — Required Checks, Evidence, Interpretation

**Doc ID:** FT-OPS-006  
**Version:** 1.0.0  
**Owner:** operations@firsttry.run  
**Last Updated:** 2026-03-01  
**Review Cycle:** Quarterly  

## Audience

Developers and reviewers interpreting CI results and downloading evidence artifacts.

## Prerequisites

- GitHub account with read access to repository
- Understanding of GitHub Actions workflows

## What Success Looks Like

- Can interpret CI check results
- Can download and examine evidence artifacts
- Understand failure modes and remediation steps

## CI Workflow: ci-core.yml

**Trigger:** Push to main, PRs to main/develop, workflow_dispatch  
**Required:** All checks must pass for PR merge  
**Timeout:** 30 minutes  

### Workflow Steps

#### 1. Forge App Unit Tests
```yaml
- Run cold-install proof (deterministic validation)
- Verify repo clean after proof
- Verify UI naming contract
- Verify Layer-0 Backbone infrastructure
- Run tests (npm test)
```

#### 2. Setup Python for Audit
```yaml
- Python 3.11
- pip cache
```

#### 3. Run Enterprise Audit v3.1 (5x Stability)
```yaml
- bash tools/audit/v3_1/run_stability_5x.sh
```

#### 4. Upload Audit Evidence
```yaml
- Artifact: f100-audit-stability-evidence-{run_number}
- Retention: 90 days
- Path: /tmp/ft_audit_stability_5x_*
```

## Interpreting CI Results

### Green Check (Pass)
All steps succeeded. PR can be merged.

### Red X (Fail)
At least one step failed. Click "Details" to view logs.

### Yellow Circle (In Progress)
CI currently running. Wait for completion.

## Downloading Evidence Artifacts

### Via GitHub UI

1. Navigate to repository Actions tab
2. Click on workflow run (e.g., "CI Core - Forge App Tests #123")
3. Scroll to "Artifacts" section
4. Click "f100-audit-stability-evidence-{run_number}" to download
5. Unzip downloaded file

### Via GitHub CLI

```bash
# List artifacts for run
gh run view RUN_ID --repo Firsttry-Solutions/Firsttry

# Download specific artifact
gh run download RUN_ID --name f100-audit-stability-evidence-123 --repo Firsttry-Solutions/Firsttry
```

### Artifact Contents

```
f100-audit-stability-evidence-123/
├── SUCCESS.txt                         # Summary
├── ft_f100_hostile_audit_v3_1_..._1/  # Run 1 evidence
│   ├── results.json
│   ├── FINAL_REPORT.md
│   ├── 99_FINAL_DECISION.txt
│   ├── SCORING_SUMMARY.json
│   └── PHASE_*_*.txt
├── ft_f100_hostile_audit_v3_1_..._2/ # Run 2 evidence
├── ft_f100_hostile_audit_v3_1_..._3/  # Run 3 evidence
├── ft_f100_hostile_audit_v3_1_..._4/  # Run 4 evidence
└── ft_f100_hostile_audit_v3_1_..._5/  # Run 5 evidence
```

## Validating Downloaded Artifacts

```bash
# Working directory: /path/to/unzipped/artifact
cd f100-audit-stability-evidence-123

# Verify 5 evidence directories exist
ls -ld ft_f100_hostile_audit_v3_1_* | wc -l  # Must be 5

# Check each decision
for dir in ft_f100_hostile_audit_v3_1_*; do
  echo "$dir: $(cat $dir/99_FINAL_DECISION.txt)"
done

# Expected: All show CONDITIONAL_ACCEPT

# Validate JSON for each run
for dir in ft_f100_hostile_audit_v3_1_*; do
  jq empty "$dir/results.json" && echo "$dir: Valid JSON"
done
```

## Common CI Failures

### Failure: "Clean install proof failed"

**Location:** Step "Run cold-install proof"

**Cause:** Lockfile drift, npm version mismatch.

**Log excerpt:**
```
Lockfile changed after npm install
FAIL: package-lock.json differs
```

**Fix:**
```bash
# Local verification
cd atlassian/forge-app
npm ci
bash tools/prove_clean_install.sh

# If fails locally, regenerate lockfile (requires maintainer approval)
rm package-lock.json
npm install
git add package-lock.json
git commit -m "chore: regenerate lockfile"
```

### Failure: "Repo dirty after proof"

**Location:** Step "Verify repo clean after proof"

**Cause:** Build artifacts or generated files not gitignored.

**Log excerpt:**
```
ERROR: Working tree dirty after CI proof run
M  some-generated-file.js
```

**Fix:** Add file to `.gitignore`, commit, retry.

### Failure: "UI naming contract violation"

**Location:** Step "Verify UI naming contract"

**Cause:** UI component names do not match contract.

**Fix:** See `tools/verify_ui_naming_contract.sh` for rules. Rename components.

### Failure: "Layer-0 Backbone verification failed"

**Location:** Step "Verify Layer-0 Backbone infrastructure"

**Cause:** Missing or misconfigured backbone infrastructure.

**Log excerpt:**
```
ERROR: Backbone infrastructure check failed
Missing: src/shared/backbone/...
```

**Fix:** Restore missing files from git, or fix configuration per backbone spec.

### Failure: "npm test failed"

**Location:** Step "Run tests"

**Cause:** Unit test failures.

**Fix:** Run tests locally, fix failing tests, commit, retry.

```bash
cd atlassian/forge-app
npm test
```

### Failure: "Run enterprise audit v3.1 (5x stability)"

**Location:** Step "Run enterprise audit"

**Cause:** Audit exits 1 on at least one of 5 runs.

**Log excerpt:**
```
RUN 1/5: PASS
RUN 2/5: FAIL (exit 1)
STABILITY TEST: FAILURE
```

**Fix:** Download artifacts, examine failed run's evidence directory, address blocking HIGHs or FAIL phases.

## CI Artifacts Retention

| Artifact | Retention | Size | Purpose |
|----------|-----------|------|---------|
| f100-audit-stability-evidence | 90 days | 10-20 MB | Audit proof |
| portal-source-audit | 90 days | 1-5 MB | Docs audit |
| portal-live-audit | 90 days | 1-5 MB | Pages verification |

**Policy:** Download critical artifacts before retention expires.

## Required Checks Policy

All checks in ci-core.yml are REQUIRED:
- Cannot bypass
- Cannot skip
- Cannot mark as "expected failure"

**If check fails:** Fix root cause, do not merge.

## Workflow Dispatch (Manual Trigger)

```bash
# Trigger ci-core.yml manually
gh workflow run ci-core.yml --repo Firsttry-Solutions/Firsttry
```

**Use case:** Re-run after manual fix, or test before PR.

## Troubleshooting

### Issue: Artifact download fails with 404

**Cause:** Artifact expired (90-day retention exceeded), or wrong run ID.

**Fix:** Use recent run ID, or re-run workflow to regenerate artifact.

### Issue: Cannot download artifact (permission denied)

**Cause:** Repository is private and you lack access.

**Fix:** Request read access from repository owner.

### Issue: CI stuck "In Progress" for >60 minutes

**Cause:** GitHub Actions runner timeout or infrastructure issue.

**Fix:** Cancel run, retry. If persists, check GitHub status page.

## Next Steps

- **For troubleshooting failures:** [07_troubleshooting.md](07_troubleshooting.md)
- **For releases:** [08_release_procedure.md](08_release_procedure.md)
- **For incidents:** [09_incident_response.md](09_incident_response.md)

## Notes

- **CI evidence is the official audit record.** Local runs are for development only.
- **90-day retention is policy, not technical limit.** Download critical evidence immediately.
- **Required checks enforce security and reproducibility.** No exceptions.
