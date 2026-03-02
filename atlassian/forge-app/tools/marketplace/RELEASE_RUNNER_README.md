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

### 2. Playwright Storage State

The E2E tests require a valid Playwright storage state file (Jira session cookies).

**Default location:** `/workspaces/Firsttry/e2e/.auth/storageState.json`

**To capture/refresh auth state:**
```bash
cd atlassian/forge-app
npm run jira:auth:capture
```

This will open a browser, prompt you to log in to Jira (firsttry.atlassian.net), and save the session.

**To verify storage state:**
```bash
npm run jira:auth:verify
```

**Custom path:** Set `STORAGE_STATE` env var:
```bash
export STORAGE_STATE="/path/to/your/storageState.json"
```

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

- **Dashboard loads:** No blank panels, no auth walls
- **Dashboard gadget renders:** UI displays correctly
- **Snapshot export:** HTML/JSON exports work end-to-end
- **No console errors:** Clean Playwright console log
- **Deterministic markers:** Build identity + provenance present

**Test file:** `/workspaces/Firsttry/e2e/tests/prod_dashboard_green.spec.ts`

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
│   ├── test_run.log                     # Playwright test output
│   ├── artifacts/
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
