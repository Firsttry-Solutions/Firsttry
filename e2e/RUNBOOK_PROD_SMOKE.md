# RUNBOOK: Production Dashboard Smoke Test

## Purpose

This smoke test proves that an authenticated user can access the Jira production dashboard at https://firsttry.atlassian.net without being redirected to login. It validates:
- Authentication session state is valid (storageState.json)
- Network connectivity to production Jira is operational
- Dashboard UI loads and renders (basic content check via Playwright)

**What it does NOT prove:** Feature functionality, API correctness, performance, or any business logic beyond successful authentication and page load.

---

## Preconditions (hard requirements)

- Repo location: `/workspaces/Firsttry`
- Node.js and npm available on PATH
- Playwright installed via repo dependencies (no global install required)
- Existing auth state file: `e2e/.auth/storageState.json` (gitignored; see RUNBOOK_PROD_AUTH_REFRESH.md to create)
- Target environment: `https://firsttry.atlassian.net` production only
- Running from Codespaces or equivalent Linux container with network access to production Jira

---

## Single Command (recommended)

```bash
cd /workspaces/Firsttry
e2e/scripts/run_prod_dashboard_smoke_failclosed.sh
```

**Output:** Script prints `RUN_DIR=/tmp/ft_prod_dashboard_smoke_run_<UTC_TIMESTAMP>` upon completion.

---

## Where Evidence Is Written

### Runner Evidence Directory
```
/tmp/ft_prod_dashboard_smoke_run_<UTC_TIMESTAMP>/
```

### Child Playwright Evidence Directory
```
/tmp/ft_dashboard_smoke_<UTC_TIMESTAMP>/
```
(Path stored in `child_evidence_dir.txt` inside runner directory)

### Required Evidence Files (runner directory)

**Always present:**
- `RUN_DIR.txt` — absolute path to this evidence directory
- `START_UTC.txt` — ISO 8601 execution start time
- `GIT_HEAD.txt` — git commit hash at time of run
- `GIT_STATUS.txt` — uncommitted changes (empty if clean)
- `GIT_DIRTY.txt` — dirty flag: 0 (clean) or 1 (dirty/warning)
- `playwright_run.txt` — full Playwright test output (tee'd)
- `child_evidence_dir.txt` — path to Playwright's evidence directory
- `SUCCESS.txt` or `ERROR.txt` — status marker
- `WARNINGS.txt` — if repo was dirty (advisory only)

**Conditionally present (if storageState exists):**
- `storageState.sha256.txt` — SHA256 hash of authentication state
- `storageState.bytes.txt` — byte count of storageState.json
- `storageState.shape.txt` — JSON validation result: `PASS` or `FAIL`
- `storageState.shape_error.txt` — error detail if shape validation failed

---

## Pass/Fail Criteria

### ✅ PASS (all must be true)
- Runner exits 0
- `SUCCESS.txt` exists in runner evidence dir
- Child evidence dir exists and contains `SUCCESS.txt` (or test-specific success marker)
- `storageState.shape.txt` = `PASS` (if storageState exists)

### ❌ FAIL (if any is true)
- Runner exits non-zero
- `ERROR.txt` exists in runner evidence dir
- Test detected redirect to login (id.atlassian.com or /login path) in `final_url.txt`
- `storageState.shape.txt` = `FAIL` (invalid JSON structure)

---

## Fast Triage on Failure (exact sequence)

**Step A: Check runner error**
```bash
RUN_DIR="$(ls -1dt /tmp/ft_prod_dashboard_smoke_run_* | head -1)"
cat "$RUN_DIR/ERROR.txt" 2>/dev/null || echo "No ERROR.txt"
```

**Step B: Read Playwright output (last 80 lines)**
```bash
tail -80 "$RUN_DIR/playwright_run.txt"
```

**Step C: Inspect child evidence directory**
```bash
CHILD=$(cat "$RUN_DIR/child_evidence_dir.txt")
echo "Child dir: $CHILD"
ls -lah "$CHILD"
cat "$CHILD/final_url.txt" 2>/dev/null
cat "$CHILD/host.txt" 2>/dev/null
cat "$CHILD/path.txt" 2>/dev/null
head -100 "$CHILD/console.txt" 2>/dev/null
```

**Step D: Validate storageState**
```bash
cat "$RUN_DIR/storageState.shape.txt" 2>/dev/null
cat "$RUN_DIR/storageState.bytes.txt" 2>/dev/null
```

**Step E: If redirected to login**
If Steps C shows `host.txt` contains `id.atlassian.com` or `path.txt` contains `/login`:
- Authentication session expired
- Follow **RUNBOOK_PROD_AUTH_REFRESH.md** to refresh `storageState.json`
- Re-run smoke test after refresh

---

## Security Rules

- **Never commit** `e2e/.auth/storageState.json` (gitignored by design)
- Evidence directories under `/tmp` are temporary and should not be checked into version control
- Do not leave VNC/noVNC ports open (6080/5901) after troubleshooting
- Do not print or log full storageState contents (contains session cookies)
- Do not share evidence directories publicly without redacting paths and secrets
