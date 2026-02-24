# RUNBOOK: Production Dashboard Smoke Test Soak

## Purpose

This soak runner proves sustained stability of the production dashboard authentication and access. It repeatedly executes the smoke test N times with a configurable delay between iterations. A single failure in any iteration fails-closed immediately and stops the soak.

This is a "boring" stability proof: no new features, just repeated validation that existing auth and dashboard access continue to work under repeated load.

---

## Preconditions (hard requirements)

- Repo location: `/workspaces/Firsttry`
- Node.js and npm available on PATH
- Playwright installed via repo dependencies
- Existing auth state file: `e2e/.auth/storageState.json` (from RUNBOOK_PROD_AUTH_REFRESH.md)
- Existing individual smoke runner: `e2e/scripts/run_prod_dashboard_smoke_failclosed.sh`
- Target environment: `https://firsttry.atlassian.net` production only

---

## Usage Examples

### Default (10 runs, 60 seconds between)
```bash
cd /workspaces/Firsttry
e2e/scripts/run_prod_dashboard_smoke_soak_failclosed.sh
```

### Extended soak (30 runs, 2 minutes between)
```bash
cd /workspaces/Firsttry
FT_SOAK_RUNS=30 FT_SOAK_SLEEP_SECONDS=120 \
  e2e/scripts/run_prod_dashboard_smoke_soak_failclosed.sh
```

### Strict mode (fail if repo dirty)
```bash
cd /workspaces/Firsttry
FT_SOAK_RUNS=10 FT_REQUIRE_CLEAN_TREE=1 \
  e2e/scripts/run_prod_dashboard_smoke_soak_failclosed.sh
```

### Quick proof (2 runs, 1 second between)
```bash
cd /workspaces/Firsttry
FT_SOAK_RUNS=2 FT_SOAK_SLEEP_SECONDS=1 \
  e2e/scripts/run_prod_dashboard_smoke_soak_failclosed.sh
```

---

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `FT_SOAK_RUNS` | 10 | Number of iterations to run |
| `FT_SOAK_SLEEP_SECONDS` | 60 | Delay between iterations (seconds) |
| `FT_REQUIRE_CLEAN_TREE` | (unset) | If set to `1`, fail if repo has uncommitted changes |

---

## Evidence Directory Layout

The soak runner creates a timestamped directory:
```
/tmp/ft_prod_dashboard_smoke_soak_<UTC_TIMESTAMP>/
├── RUN_DIR.txt                  Path to this directory
├── START_UTC.txt                Execution start time (ISO 8601)
├── GIT_HEAD.txt                 Git commit hash at soak start
├── GIT_STATUS.txt               Git status (empty if clean)
├── GIT_DIRTY.txt                Dirty flag: 0 (clean) or 1 (dirty)
├── SUCCESS.txt                  Present if all iterations passed
├── FAIL.txt                     Present if any iteration failed (contains details)
├── SUMMARY.json                 Machine-readable summary (if all passed)
└── runs/
    ├── run_01/
    │   ├── timestamp_utc.txt     ISO 8601 time of this iteration
    │   ├── exit_code.txt         Exit code of underlying runner
    │   ├── child_run_dir.txt     Path to child smoke runner's evidence dir
    │   └── child_success.txt     1 if child had SUCCESS.txt, else 0
    ├── run_02/
    │   └── ...
    └── run_NN/
        └── ...
```

---

## Pass/Fail Criteria

### ✅ PASS (all must be true)
- Soak runner exits 0
- `SUCCESS.txt` exists in top directory
- All N requested iterations completed
- Each iteration:
  - Underlying runner exits 0
  - Child evidence dir created
  - Child dir contains `SUCCESS.txt`
- `SUMMARY.json` is valid and present

### ❌ FAIL (if any is true)
- Soak runner exits non-zero
- `FAIL.txt` exists (contains failing iteration number)
- Any iteration:
  - Underlying runner exits non-zero
  - Cannot identify child directory deterministically
  - Child evidence dir missing `SUCCESS.txt`

Failure is **atomic and immediate**: soak stops on first failure (no partial results).

---

## Quick Triage Steps

**Step 1: Check for soak failure**
```bash
SOAK_DIR="$(ls -1dt /tmp/ft_prod_dashboard_smoke_soak_* | head -1)"
echo "Soak dir: $SOAK_DIR"

# If FAIL.txt exists, read it
cat "$SOAK_DIR/FAIL.txt" 2>/dev/null && echo "Soak failed. Details above."
```

**Step 2: Check iteration summary**
```bash
if [ -f "$SOAK_DIR/SUCCESS.txt" ]; then
    echo "All iterations passed"
    cat "$SOAK_DIR/SUMMARY.json"
fi
```

**Step 3: Inspect failing iteration**
```bash
# If soak failed, identify which iteration
FAIL_MSG=$(cat "$SOAK_DIR/FAIL.txt" 2>/dev/null)
echo "$FAIL_MSG"

# Check that iteration's metadata
# E.g., for run_05: cat $SOAK_DIR/runs/run_05/child_run_dir.txt
# Then inspect that child directory using RUNBOOK_PROD_SMOKE.md triage steps
```

**Step 4: If child smoke test failed**
- Inspect the child evidence directory (path in `child_run_dir.txt`)
- Follow triage steps from RUNBOOK_PROD_SMOKE.md (Steps A-E)
- If redirected to login, follow RUNBOOK_PROD_AUTH_REFRESH.md to refresh auth
- Re-run soak after fix

---

## Interpreting SUMMARY.json

Example:
```json
{
  "start_utc": "2026-02-24T06:51:23Z",
  "git_head": "a8921b22...",
  "runs_requested": 10,
  "runs_completed": 10,
  "pass_count": 10,
  "fail_count": 0,
  "sleep_seconds": 60,
  "child_run_dirs": [
    "/tmp/ft_prod_dashboard_smoke_run_20260224T065123Z",
    "/tmp/ft_prod_dashboard_smoke_run_20260224T065223Z",
    ...
  ]
}
```

All values are numeric except `start_utc`, `git_head`, and `child_run_dirs`.

---

## Security & Data Handling

- Soak runner does **not** print or log storageState contents
- Soak runner does **not** echo cookies, tokens, or auth JSON
- Evidence directories contain only:
  - Paths (safe to share)
  - Exit codes and counts (safe)
  - Metadata (timestamps, git info)
  - No secrets
- Child evidence dirs are created by underlying runner; see RUNBOOK_PROD_SMOKE.md security rules

---

## Performance Notes

Each iteration adds ~30-40 seconds (Playwright test + overhead).

For example:
- 10 iterations × 40 seconds + 9 × 60 second delays = ~400-600 seconds (6-10 minutes)
- 30 iterations × 40 seconds + 29 × 120 second delays = ~3500+ seconds (60+ minutes)

Plan soak runs accordingly. Consider running during off-peak hours or as a scheduled CI job.
