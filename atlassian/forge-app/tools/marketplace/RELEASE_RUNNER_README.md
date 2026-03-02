# Marketplace Release Runner - Complete E2E Validation

**Script:** `tools/marketplace/release_marketplace_ready_e2e.sh`

Complete fail-closed release runner that validates everything green, deploys to Forge production, upgrades the installed app, and runs full end-to-end dashboard validation.

## Overview

This script implements a **7-phase release pipeline** with hard gates at every step:

1. **Phase 0:** Evidence directory creation + repo cleanliness check
2. **Phase 1:** All verification gates (realworld, audit, marketplace pack, claims, docs)
3. **Phase 2:** Branch sync verification (main must match origin/main)
4. **Phase 3:** Build & package sanity checks (npm ci, test, lint, forge lint)
5. **Phase 4:** Deploy to Forge production
6. **Phase 5:** Install/upgrade on production site (firsttry.atlassian.net)
7. **Phase 6:** End-to-end dashboard validation (Playwright)
8. **Phase 7:** Final marketplace-ready verdict

**ABSOLUTELY FAIL-CLOSED:** If any phase fails, the script stops immediately with:
- Clear error message
- Remediation steps
- Exit code 1
- Evidence directory with diagnostics

## Exit Code Integrity

The release runner enforces a **critical invariant**: **Exit code MUST always match FINAL_VERDICT**.

**Guaranteed by design:**
- If `FINAL_VERDICT.txt` contains `FAIL`, exit code is non-zero
- If `FINAL_VERDICT.txt` contains `PASS`, exit code is zero
- **It is IMPOSSIBLE to return exit 0 when verdict is FAIL**

**Safety mechanisms:**
1. The `finalize()` function validates exit code against final verdict
2. If exit_code=0 but artifact validation fails → forces exit 1
3. If exit_code≠0 but artifacts complete → keeps exit non-zero with FAIL verdict
4. Invariant violation detection → forces FAIL immediately

**Exit trap:**
```bash
trap 'finalize $?' EXIT
```

This ensures finalize() is always called with the actual exit code, performs validation, and exits with the correct code matching the verdict.

**Testing:**
Selftest includes subtest 7 that simulates a failure (exit_code=1) and verifies:
- Script exits with non-zero code
- FINAL_VERDICT.txt contains FAIL
- No possibility of exit 0 with FAIL verdict

## Selftest Mode

The release runner includes a built-in **selftest mode** that validates the fail-closed artifact validation logic without requiring auth, deployment, or Playwright against Jira.

### What It Proves

Selftest mode proves that:

1. **PASS cannot be produced without complete evidence artifacts** (phase directories, VERDICT.txt files, non-empty log files)
2. **PASS cannot be produced without Playwright artifacts** in 06_e2e
3. **Final report is non-trivial** (>= 500 bytes) for both PASS and FAIL scenarios
4. **finalize() forces FAIL** even with exit_code=0 if artifacts are incomplete

### Running Selftest

**Option 1: CLI flag**
```bash
cd atlassian/forge-app
bash tools/marketplace/release_marketplace_ready_e2e.sh --selftest
```

**Option 2: Environment variable**
```bash
FT_RELEASE_SELFTEST=1 bash tools/marketplace/release_marketplace_ready_e2e.sh
```

**Option 3: Keep evidence for inspection**
```bash
FT_RELEASE_SELFTEST=1 FT_SELFTEST_KEEP=1 bash tools/marketplace/release_marketplace_ready_e2e.sh
```

### Expected Output

On success, you'll see:

```
════════════════════════════════════════════════════════════
SELFTEST MODE: Validating Fail-Closed Evidence Logic
════════════════════════════════════════════════════════════

[SUBTEST 1/7] Happy path: Complete evidence → PASS
✓ Happy path: PASS verdict produced
✓ Happy path: FINAL_REPORT.md is 1234 bytes (>= 500)
✓ Happy path: FINAL_VERDICT.txt contains PASS

[SUBTEST 2/7] Missing logs: Remove all logs from 01_gates → FAIL
✓ Missing logs: FAIL verdict produced
✓ Missing logs: FINAL_VERDICT.txt mentions missing logs
✓ Missing logs: FINAL_REPORT.md is 876 bytes (>= 500)

[SUBTEST 3/7] Missing Playwright artifacts: Remove artifacts from 06_e2e → FAIL
✓ Missing Playwright: FAIL verdict produced
✓ Missing Playwright: FINAL_VERDICT.txt mentions missing Playwright artifacts

[SUBTEST 4/7] Missing phase directory: Remove 05_upgrade → FAIL
✓ Missing directory: FAIL verdict produced
✓ Missing directory: FINAL_VERDICT.txt mentions missing directory

[SUBTEST 5/7] Wrong verdict: Change 03_build VERDICT to FAIL → FAIL
✓ Wrong verdict: FAIL verdict produced
✓ Wrong verdict: FINAL_VERDICT.txt mentions PASS requirement

[SUBTEST 6/7] Playwright browser prerequisite: Fail-closed when browsers missing
✓ Browser check: Browsers present or installed successfully
✓ Browser check: Status file created with valid format
✓ Browser check: Log file created with diagnostic output

[SUBTEST 7/7] Exit code invariant: Simulated failure → exit non-zero
✓ Exit code test: Script exited with non-zero code
✓ Exit code test: FINAL_VERDICT.txt contains FAIL
✓ Exit code test: FINAL_REPORT.md created

════════════════════════════════════════════════════════════
[SELFTEST PASS]
════════════════════════════════════════════════════════════

All subtests passed:
  ✓ Happy path produces PASS with complete evidence
  ✓ Missing logs forces FAIL
  ✓ Missing Playwright artifacts forces FAIL
  ✓ Missing phase directory forces FAIL
  ✓ Wrong verdict forces FAIL
  ✓ Playwright browser prerequisite check works correctly
  ✓ Exit code always matches FINAL_VERDICT
  ✓ FINAL_REPORT.md >= 500 bytes in all cases

Evidence validation is fail-closed and working correctly.
```

### Selftest Exit Codes

- **0:** All subtests passed (validation logic working correctly)
- **1:** One or more subtests failed (validation logic broken)

### What Gets Tested

**Subtest 1: Happy Path**
- Creates complete evidence directory with all phases
- Each phase has VERDICT.txt containing "PASS"
- Each phase has at least one non-empty log file
- 06_e2e has Playwright artifacts (playwright-report directory)
- Verifies finalize() produces PASS verdict
- Validates FINAL_REPORT.md >= 500 bytes

**Subtest 2: Missing Logs**
- Removes all .log files from 01_gates phase
- Verifies finalize() forces FAIL even with exit_code=0
- Validates FINAL_VERDICT.txt mentions missing/non-empty logs

**Subtest 3: Missing Playwright Artifacts**
- Removes all artifacts from 06_e2e/artifacts directory
- Verifies finalize() forces FAIL
- Validates reason mentions Playwright artifacts

**Subtest 4: Missing Phase Directory**
- Removes 05_upgrade directory entirely
- Verifies finalize() forces FAIL
- Validates reason mentions missing directory

**Subtest 5: Wrong Verdict**
- Changes 03_build/VERDICT.txt from PASS to FAIL
- Verifies finalize() forces FAIL
- Validates reason mentions PASS requirement

**Subtest 6: Playwright Browser Prerequisite**
- Runs `ensure_playwright_browsers.sh` with `FT_NO_PW_INSTALL=1`
- Verifies script creates status file with valid format (OK or FAIL)
- Validates log file is created with diagnostic output
- Ensures fail-closed behavior without downloading browsers

**Subtest 7: Exit Code Invariant**
- Creates complete evidence with all PASS verdicts
- Calls finalize() with exit_code=1 (simulating early failure)
- Verifies script exits with non-zero code
- Validates FINAL_VERDICT.txt contains FAIL
- Ensures exit code always matches FINAL_VERDICT (fail-closed)

### Selftest Evidence

By default, selftest creates a temporary evidence directory and cleans it up automatically.

To preserve evidence for inspection:

```bash
FT_SELFTEST_KEEP=1 bash tools/marketplace/release_marketplace_ready_e2e.sh --selftest
```

The output will show:
```
Selftest evidence preserved at: /tmp/ft_release_selftest_XXXXXX
```

Evidence structure:
```
/tmp/ft_release_selftest_XXXXXX/
├── happy/                    # Subtest 1: Complete evidence (PASS)
├── missing_logs/             # Subtest 2: Missing logs (FAIL)
├── missing_playwright/       # Subtest 3: Missing Playwright (FAIL)
├── missing_dir/              # Subtest 4: Missing directory (FAIL)
├── wrong_verdict/            # Subtest 5: Wrong verdict (FAIL)
└── browser_check/            # Subtest 6: Browser prerequisite check└── exit_code_test/           # Subtest 7: Exit code invariant```

### CI Integration

Add selftest to CI workflow to validate the validation logic:

```yaml
- name: Validate release runner selftest
  run: |
    cd atlassian/forge-app
    bash tools/marketplace/release_marketplace_ready_e2e.sh --selftest
```

### When to Run Selftest

- **Before making changes** to finalize() or assert_pass_artifacts_or_fail()
- **After modifying** evidence validation logic
- **In CI** as a fast (<10 seconds) sanity check
- **When debugging** why PASS/FAIL verdicts are produced

## Playwright Browser Prerequisites

The release runner requires Playwright browsers (Chromium) to be installed for Phase 6 (E2E tests). The runner **automatically checks and installs browsers** before running tests.

### Automatic Browser Installation

**Phase 6.2** runs before E2E tests to ensure browsers are present. This check:

1. **Verifies node/npm tooling** exists
2. **Checks Playwright availability** via `npx --no-install playwright`
3. **Validates Chromium executable** at expected path
4. **Installs browsers if missing** (unless blocked by environment)

### Browser Check Evidence

Browser check logs are captured to:

```
<evidence_dir>/06_e2e/
├── playwright_install.log             # Full installation/check log
├── playwright_browsers_status.txt     # Status: OK or FAIL
├── auth_capture.log
└── test_run.log
```

**Status Values:**
- `OK: browsers present` - Chromium already installed
- `OK: browsers installed` - Chromium installed during this run
- `FAIL: install required but not permitted` - FT_NO_PW_INSTALL=1 blocks installation
- `FAIL: install attempted but failed` - Installation error occurred

### Blocking Browser Installation

In locked-down CI environments where browser installation should fail explicitly:

```bash
export FT_NO_PW_INSTALL=1
bash tools/marketplace/release_marketplace_ready_e2e.sh
```

This will:
- Check if browsers are already present
- **FAIL immediately** if browsers are missing (instead of attempting download)
- Write clear diagnostics to evidence directory

### Troubleshooting Missing Browsers

**Symptom:** E2E tests fail with:
```
browserType.launch: Executable doesn't exist at /home/user/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome
```

**Root Cause:** Playwright browsers not installed

**Fix Option 1: Let release runner install them**
```bash
# Ensure FT_NO_PW_INSTALL is not set
unset FT_NO_PW_INSTALL

# Run release runner (will auto-install browsers)
cd atlassian/forge-app
bash tools/marketplace/release_marketplace_ready_e2e.sh
```

**Fix Option 2: Manual installation**
```bash
cd atlassian/forge-app
npx playwright install chromium
```

**Fix Option 3: Install all browsers**
```bash
npx playwright install
```

### Browser Installation Size

Chromium browser download is approximately **280 MB**:
- Chrome for Testing: ~167 MB
- Chrome Headless Shell: ~111 MB
- FFmpeg: ~2 MB

### Selftest Coverage

The selftest mode (subtest 6/6) validates browser prerequisite check logic:

- Runs `ensure_playwright_browsers.sh` with `FT_NO_PW_INSTALL=1`
- Verifies status file created with valid format
- Verifies log file created with diagnostic output
- Ensures fail-closed behavior without downloading browsers

This validates the prerequisite check itself without requiring actual browser installation.

## Prerequisites

### 1. Forge Authentication

You must have Forge CLI credentials configured. Two options:

**Option A: Environment Variables (Recommended for CI)**
```bash
export FORGE_EMAIL="your-email@example.com"
export FORGE_API_TOKEN="your-api-token"
```

Get your API token from: https://id.atlassian.com/manage-profile/security/api-tokens

**Option B: Interactive Login**
```bash
forge login
```

Then run the script (it will use the stored credentials).

### 2. Playwright Storage State (AUTO-CAPTURED)

The E2E tests require a valid Playwright storage state file (Jira session cookies).

**⚡ NEW: The release runner automatically captures auth during Phase 6**, so you don't need to pre-capture manually unless you want to test it standalone.

**Standalone Auth Capture (Optional)**

If you want to capture auth separately for testing:

```bash
cd atlassian/forge-app
npm run jira:auth:capture
```

This will:
- Open a browser (requires DISPLAY env var)
- Prompt you to log in to Jira
- Save the session to `/tmp/ft_jira_auth_capture_<timestamp>_<pid>/storageState.json`
- Create symlink: `/tmp/ft_jira_auth_capture_latest`
- Validate the captured session

**Environment Variables for Capture:**

```bash
# Required for interactive capture
export DISPLAY=:0  # or your X11 display
export JIRA_DASHBOARD_URL="https://firsttry.atlassian.net/jira/dashboards/10000"
# OR
export JIRA_SITE="firsttry.atlassian.net"

# Optional: override output directory
export RUN_DIR="/custom/output/dir"
```

**Output:**
```
[PASS] storageState: /tmp/ft_jira_auth_capture_20260302T063000Z_12345/storageState.json
[PASS] run_dir: /tmp/ft_jira_auth_capture_20260302T063000Z_12345
[PASS] latest: /tmp/ft_jira_auth_capture_latest
```

**Verify captured state:**
```bash
ls -la /tmp/ft_jira_auth_capture_latest/storageState.json
cat /tmp/ft_jira_auth_capture_latest/ENV.txt
```

**To use pre-captured state in release runner:**
```bash
export STORAGE_STATE="/tmp/ft_jira_auth_capture_latest/storageState.json"
bash tools/marketplace/release_marketplace_ready_e2e.sh
```

**Note:** If `STORAGE_STATE` is not set, the release runner will capture auth automatically during Phase 6.

### 3. Clean Repository

The script requires a clean git working tree (no uncommitted changes).

```bash
git status --porcelain  # Must be empty
```

If dirty, commit or stash changes before running.

### 4. Main Branch Sync

You must be on `main` branch, synced with `origin/main`:

```bash
git checkout main
git pull origin main
```

The script will fail if local main differs from remote main.

## Usage

### Basic Usage (All Defaults)

```bash
cd atlassian/forge-app
bash tools/marketplace/release_marketplace_ready_e2e.sh
```

**Defaults:**
- Target site: `firsttry.atlassian.net`
- Environment: `production`
- Storage state: `/workspaces/Firsttry/e2e/.auth/storageState.json`

### Custom Configuration

```bash
export FORGE_EMAIL="your-email@example.com"
export FORGE_API_TOKEN="your-api-token"
export JIRA_SITE="your-site.atlassian.net"
export ENVIRONMENT="production"
export STORAGE_STATE="/custom/path/storageState.json"

bash tools/marketplace/release_marketplace_ready_e2e.sh
```

### CI/CD Integration

Add to GitHub Actions workflow:

```yaml
- name: Run marketplace release validation
  env:
    FORGE_EMAIL: ${{ secrets.FORGE_EMAIL }}
    FORGE_API_TOKEN: ${{ secrets.FORGE_API_TOKEN }}
    STORAGE_STATE: ${{ github.workspace }}/e2e/.auth/storageState.json
  run: |
    cd atlassian/forge-app
    bash tools/marketplace/release_marketplace_ready_e2e.sh
```

## What Gets Validated

### Phase 1: Verification Gates

- **Realworld gates:** 50k scale tests, storage I/O, multi-tenant isolation
- **Deterministic audit:** Enterprise compliance checks (fail_count=0, blocking_high=0)
- **Marketplace pack:** 12 trust docs, no broken links, no placeholders
- **Claims consistency:** Documentation vs implementation integrity
- **Docs linkability:** All internal links valid (offline check)

### Phase 3: Build Sanity

- **package-lock.json:** Present and valid (reproducible installs)
- **npm ci:** Clean install from lockfile
- **npm test:** Unit tests pass
- **npm run lint:** Linting passes (if configured)
- **forge lint:** Manifest and app structure validation

### Phase 4: Deploy

- **Forge auth:** Valid credentials
- **build:gadget:** Full build pipeline with all verifications
- **forge deploy:** Deploy to production environment
- **Deployment artifacts:** All build outputs valid

### Phase 5: Install/Upgrade

- **Forge install --upgrade:** Upgrade existing installation
- **Or forge install:** First-time install if not present
- **Target site:** firsttry.atlassian.net (or custom JIRA_SITE)

### Phase 6: End-to-End Dashboard

- **Auth capture:** Automatic Jira session capture (interactive browser login)
- **Storage state validation:** Ensures cookies/origins are present and valid
- **Dashboard loads:** No blank panels, no auth walls
- **Dashboard gadget renders:** UI displays correctly
- **Snapshot export:** HTML/JSON exports work end-to-end
- **No console errors:** Clean Playwright console log
- **Deterministic markers:** Build identity + provenance present

**Test file:** `/workspaces/Firsttry/e2e/tests/prod_dashboard_green.spec.ts`

**Auth outputs:**
- `/tmp/ft_marketplace_release_latest/06_e2e/auth_capture/storageState.json`
- `/tmp/ft_marketplace_release_latest/06_e2e/auth_capture.log`

## Evidence Artifacts

Every run creates an evidence directory:

```
/tmp/ft_marketplace_release_YYYYMMDDTHHMMSSZ_PID/
├── 00_env/
│   └── env.txt                          # Environment snapshot (node, npm, forge versions)
├── 01_ci/
│   ├── realworld.log                    # Realworld gates output
│   ├── REALWORLD_SUMMARY.json           # Realworld verdict
│   ├── audit.log                        # Audit output
│   ├── results.json                     # Audit results (fail_count, blocking_high_count)
│   ├── marketplace_pack.log             # Marketplace pack output
│   ├── MARKETPLACE_PACK_VERDICT.txt     # Pack verdict
│   ├── claims_extract.log               # Claims extraction output
│   ├── claims_verify.log                # Claims consistency output
│   ├── CLAIMS_VERDICT.txt               # Claims verdict
│   └── docs_offline.log                 # Docs linkability output
├── 02_merge/
│   ├── branch.txt                       # Current branch name
│   ├── fetch.log                        # Git fetch output
│   ├── rev.txt                          # Local + remote HEAD SHAs
│   └── MERGE_STATUS.txt                 # Sync status
├── 03_build/
│   ├── npm_ci.log                       # npm ci output
│   ├── npm_scripts.txt                  # Available npm scripts
│   ├── npm_test.log                     # Test output (if run)
│   ├── npm_lint.log                     # Lint output (if run)
│   └── VERDICT.txt                      # Build phase verdict
├── 04_deploy/
│   ├── forge_whoami.log                 # Forge auth check
│   ├── env_list.log                     # Forge environments list
│   ├── forge_lint.log                   # Forge lint output
│   ├── build_gadget.log                 # Gadget build output
│   ├── deploy.log                       # Deploy output
│   ├── deploy_verbose.log               # Verbose deploy info
│   └── VERDICT.txt                      # Deploy phase verdict
├── 05_upgrade/
│   ├── site.txt                         # Target site + environment
│   ├── install_upgrade.log              # Upgrade output
│   ├── install.log                      # First install output (if applicable)
│   ├── install_list.log                 # Installed apps list
│   └── VERDICT.txt                      # Upgrade phase verdict
├── 06_e2e/
│   ├── discovery.txt                    # E2E harness detection
│   ├── auth_capture.log                 # Auth capture output
│   ├── auth_capture/                    # Auth capture evidence
│   │   ├── storageState.json            # Captured Jira session
│   │   └── ENV.txt                      # Capture environment info
│   ├── test_run.log                     # Playwright test output
│   ├── artifacts/
│   │   ├── storageState.json            # Copy of captured session (for evidence)
│   │   ├── playwright-report/           # HTML test report
│   │   └── test-results/                # Screenshots, videos, traces
│   └── VERDICT.txt                      # E2E phase verdict
└── 99_verdict/
    ├── FINAL_REPORT.md                  # Comprehensive summary
    └── FINAL_VERDICT.txt                # PASS or FAIL

Stable symlink: /tmp/ft_marketplace_release_latest → (latest run)
```

## Exit Codes

The script uses standard exit codes:

- **0:** Success (all phases passed, marketplace-ready)
- **1:** Failure (phase failed, see evidence directory)

Detailed failure modes:
- Repo dirty (uncommitted changes)
- Missing tools (node, npm, jq, forge)
- Realworld gates failed
- Audit failed (fail_count > 0 or blocking_high > 0)
- Marketplace pack failed
- Claims consistency failed
- Branch out of sync (local != origin/main)
- Build failed (npm ci, test, lint, forge lint)
- Forge auth failed (FORGE_EMAIL or FORGE_API_TOKEN missing/invalid)
- Deploy failed
- Install/upgrade failed
- E2E test failed (dashboard not loading, console errors, etc.)

## Troubleshooting

### Error: "FORGE_EMAIL not set"

```bash
export FORGE_EMAIL="your-email@example.com"
export FORGE_API_TOKEN="your-api-token"
```

Or run `forge login` interactively.

### Error: "Storage state file not found"

Capture auth state:
```bash
cd atlassian/forge-app
npm run jira:auth:capture
```

This will open a browser and prompt you to log in.

### Error: "Repository has uncommitted changes"

Commit or stash changes:
```bash
git status
git add -A
git commit -m "your message"
# or
git stash
```

### Error: "Local main is out of sync with origin/main"

Pull changes:
```bash
git pull origin main
```

Or if you have unpushed commits:
```bash
git push origin main
```

Then re-run the script.

### Error: "Realworld gates failed"

Check the realworld log:
```bash
cat /tmp/ft_marketplace_release_latest/01_ci/realworld.log
```

Fix failures, commit, and re-run.

### Error: "forge deploy failed"

Check deploy log:
```bash
cat /tmp/ft_marketplace_release_latest/04_deploy/deploy.log
```

Common issues:
- Manifest.yml syntax error
- App ID mismatch
- Build artifacts invalid
- Forge account permissions

### Error: "E2E dashboard test failed"

Check test log and artifacts:
```bash
cat /tmp/ft_marketplace_release_latest/06_e2e/test_run.log
open /tmp/ft_marketplace_release_latest/06_e2e/artifacts/playwright-report/index.html
```

Common issues:
- Storage state expired (re-capture auth)
- Dashboard not loading (check console errors)
- App not upgraded (check install logs)
- Site URL mismatch (verify JIRA_SITE)

## Success Output

When all phases pass, you'll see:

```
════════════════════════════════════════════════════════════
FINAL VERDICT: PASS
════════════════════════════════════════════════════════════

✅ All phases completed successfully
✅ App deployed to production
✅ App upgraded on firsttry.atlassian.net
✅ End-to-end dashboard validated

Evidence: /tmp/ft_marketplace_release_20260302T062000Z_12345
Symlink:  /tmp/ft_marketplace_release_latest

Marketplace-ready: YES
```

## Integration with Existing Scripts

This script reuses existing infrastructure:

- **Deploy:** Uses `tools/prod_deploy_and_upgrade.sh` logic (integrated inline)
- **E2E test:** Calls `npm run test:prod-dashboard` (existing script)
- **Realworld gates:** Calls `tools/realworld/run_realworld_gates.sh`
- **Audit:** Calls `tools/audit/v3_1/run_deterministic.sh`
- **Marketplace pack:** Calls `tools/marketplace/verify_privacy_security_pack.sh`
- **Claims:** Calls `tools/marketplace/extract_trust_doc_claims.sh` + `verify_claims_consistency.sh`

## Related Documentation

- [Realworld Gates](../realworld/README.md)
- [Deterministic Audit](../audit/v3_1/README.md)
- [Marketplace Pack Verifier](verify_privacy_security_pack.sh)
- [E2E Dashboard Tests](/workspaces/Firsttry/e2e/tests/prod_dashboard_green.spec.ts)
- [Deploy Script](../prod_deploy_and_upgrade.sh)

## Design Philosophy

**Fail-Closed:** Every step requires explicit success. No assumptions.

**Evidence-Driven:** Every phase produces machine-checkable verdict files.

**No Side Effects:** Script does not modify code (only deploys + upgrades).

**Deterministic:** Same inputs → same verdict (modulo time-dependent data).

**CI-Friendly:** All output logged, exit codes meaningful, artifacts preserved.

## Version History

- **v1.0.0 (2026-03-02):** Initial implementation - 7-phase release runner with E2E validation

## Support

For issues or questions:
- Check evidence directory: `/tmp/ft_marketplace_release_latest`
- Review phase logs in evidence directory
- See troubleshooting section above
- Contact: support@firsttry.solutions
