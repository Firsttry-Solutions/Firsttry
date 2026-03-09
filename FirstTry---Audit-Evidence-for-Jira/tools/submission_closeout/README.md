# Submission Closeout Harness

**Purpose**: Deterministic vendor-tree-only verification and evidence generation for Atlassian Marketplace submission.

**Scope**: Operates exclusively within `FirstTry---Audit-Evidence-for-Jira/`; does not modify parent repository.

---

## Quick Start

```bash
cd FirstTry---Audit-Evidence-for-Jira/
bash tools/submission_closeout/run_closeout.sh
```

Output: Evidence pack in `audit_artifacts/submission_closeout_<TIMESTAMP>/`

---

## What It Does: 9 Phases

### Phase 1: Cleanliness Precheck
- Verifies git status in vendor tree (no modified tracked files)
- Permits allowlisted untracked artifacts: `FINAL_SUBMISSION_PROOF_SUMMARY.md`, `audit_artifacts/`
- **Fails closed** on unexpected untracked files

### Phase 2: Pages Route Discovery
- Fetches live GitHub Pages root: https://firsttry-solutions.github.io/Firsttry/
- Extracts all href routes from root HTML
- For each required doc (11 total), probes multiple candidate routes:
  - Extensionless: `legal/privacy-policy`
  - Raw markdown: `legal/PRIVACY_POLICY.md`
  - HTML extension: `legal/privacy-policy.html`
- Records HTTP code and discovery method for each
- **No assumptions**: only reports what curl actually returns

### Phase 3: Pages Verdict
- Summarizes route discovery results
- Decision: **PAGES_LIVE_COMPLETE** (all 11 docs reachable) or **PAGES_ROOT_ONLY_NOT_DOCS_COMPLETE**

### Phase 4: Freeze Lock & Reviewer Gate
- Runs `audit/verify_freeze_lock.sh` (pass/fail)
- Runs `audit/reviewer_ready_gate.sh` (pass/fail)
- **Fails closed** if either fails

### Phase 5: Forge Install State
- Queries `forge install list` (if CLI available)
- Captures production install status without interpretation
- Non-blocking probe (optional environment constraint)

### Phase 6: Reviewer Playwright E2E
- **Precheck**: Verifies `tests/playwright/.auth/storageState.json` exists
  - If missing, **blocks** with clear instruction
- Sets environment:
  - `FT_REVIEWER_EVIDENCE_DIR=<evidence_dir>/40_playwright`
  - `JIRA_BASE_URL=https://firsttry-solutions.atlassian.net`
  - `JIRA_DASHBOARD_URL=...jira/dashboards/10001`
  - `FORGE_EMAIL=contact@firsttry.run`
- Runs: `npx playwright test tests/playwright/reviewer_dashboard_e2e.spec.ts --config=playwright.reviewer.config.ts`
- Captures stdout/stderr + generated artifacts (screenshots, logs, traces)
- **Non-blocking failure** (auth may not be available in all environments)

### Phase 7: Origin Parity
- Compares local HEAD with origin/main
- Determines: **REMOTE_MATCHED**, **LOCAL_AHEAD_OF_ORIGIN**, **LOCAL_BEHIND_ORIGIN**, or **DIVERGED**
- Explicitly reports any local commits ahead (for transparency)

### Phase 8: Final Verdict
- Aggregates all phases
- Applies strict decision logic:
  
  **FULL_SUBMISSION_BULLETPROOF_READY** if:
  - Pages: PAGES_LIVE_COMPLETE
  - Freeze lock: PASS
  - Reviewer gate: PASS
  - Playwright: PASS
  - Cleanliness: PASS or WARN (allowlisted only)
  - Origin: Not diverged and not behind
  
  **SUBMISSION_READY_WITH_NONBLOCKING_GAPS** if:
  - Freeze & gate PASS, but pages/playwright/parity have gaps
  
  **NOT_SUBMISSION_READY** otherwise

---

## Output Files

Located in: `audit_artifacts/submission_closeout_<YYYYMMDDTHHMMSSZ>/`

| File | Purpose |
|------|---------|
| `01_git_status.txt` | Raw git status --short output |
| `02_git_diff_stat.txt` | Raw git diff --stat output |
| `03_untracked_files.txt` | Raw untracked files list |
| `04_cleanliness_verdict.txt` | PASS/WARN/FAIL classification |
| `10_pages_root_headers.txt` | HTTP headers from root URL |
| `11_pages_root.html` | Full HTML of root page |
| `12_pages_extracted_hrefs.txt` | All unique href routes from root |
| `13_pages_route_discovery.tsv` | Per-doc discovery results (tab-separated) |
| `14_pages_required_docs_live_check.txt` | Pages summary (live count) |
| `15_pages_verdict.txt` | PAGES_LIVE_COMPLETE or INCOMPLETE |
| `20_freeze_verify.txt` | Full freeze lock verification output |
| `21_reviewer_gate.txt` | Full reviewer gate check output |
| `22_gate_summary.txt` | Gates pass/fail summary |
| `30_forge_install_list.txt` | Forge CLI install list output (if available) |
| `31_install_summary.txt` | Forge installation summary |
| `40_playwright/` | Playwright E2E evidence directory (if run) |
| `40_playwright/stdout.txt` | Test stdout |
| `40_playwright/stderr.txt` | Test stderr |
| `41_playwright_summary.txt` | Playwright result summary |
| `50_origin_parity.txt` | origin/main vs HEAD comparison |
| `60_final_verdict.txt` | FINAL VERDICT decision + all inputs |

---

## Failure Scenarios

### Phase 1 Fails
- **Cause**: Modified tracked files or unexpected untracked files in vendor tree
- **Action**: Fix git status; remove unexpected files
- **Remedy**: `git status`, `git add`, or `git clean -fd`

### Phase 2/3 Fails (Pages not live or docs not reachable)
- **Cause**: GitHub Pages not published or routes differ from expected
- **Action**: Check Pages settings in GitHub repo; verify Jekyll config
- **Output**: Actual HTTP codes and discovered routes in `13_pages_route_discovery.tsv`

### Phase 4 Fails (Freeze or Gate)
- **Cause**: Freeze lock stale or marketplace compliance gate broken
- **Action**: Review `20_freeze_verify.txt` or `21_reviewer_gate.txt`
- **Remedy**: Regenerate freeze lock or fix failing gate check

### Phase 6 Fails (Playwright)
- **Cause**: Auth session missing or test error
- **Action**: Check `41_playwright_summary.txt` and `40_playwright/stderr.txt`
- **Note**: Non-critical for local development; required for cloud submission

### Phase 7 Shows LOCAL_AHEAD_OF_ORIGIN
- **Meaning**: Local commits not yet pushed to origin/main
- **Action**: Push commits before marketplace submission (if required)
- **Note**: Explicitly logged for transparency

---

## No Modifications

This harness **never modifies**:
- Package versions
- Product name, scope, or app ID
- Marketplace documentation
- `.github` workflows or parent repo files
- Freeze lock (only reads and verifies)

---

## Environment Requirements

- Bash 4.0+
- `curl`
- `git`
- Optional: `forge` CLI (for Phase 5)
- Optional: `npx` / Node.js (for Phase 6)

---

## Assumptions / Constraints

- Runs from inside `FirstTry---Audit-Evidence-for-Jira/` (enforced)
- GitHub Pages root must be live to pass Phase 2
- Playwright auth state may not be available in all environments (Phase 6 non-blocking)
- `forge install list` requires forge CLI (Phase 5 optional)

---

## Example Run

```bash
$ cd FirstTry---Audit-Evidence-for-Jira/
$ bash tools/submission_closeout/run_closeout.sh

[INFO] Vendor root: /workspaces/Firsttry/FirstTry---Audit-Evidence-for-Jira
...
[INFO] Phase 2 complete: PAGES_LIVE_COMPLETE
[INFO] Verdict: FULL_SUBMISSION_BULLETPROOF_READY

FINAL VERDICT:
VERDICT: FULL_SUBMISSION_BULLETPROOF_READY
```

---

## Files in This Harness

- **lib.sh** - Shared functions (logging, git, curl, verdict logic)
- **run_closeout.sh** - Main orchestrator (9 phases)
- **README.md** - This file (documentation)
