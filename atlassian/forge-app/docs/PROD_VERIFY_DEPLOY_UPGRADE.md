# Production Verification, Deployment & Upgrade Guide

## Overview

This document describes how to deterministically verify the UI fix is live, deploy the application to production, and upgrade the Jira installation—all with comprehensive evidence capture.

The process is **fail-closed**: hard gates block forward progress if they fail. No secrets are printed.

## Prerequisites

1. **Forge API Token**: Obtain from https://id.atlassian.com/manage-profile/security/api-tokens
2. **Atlassian Email**: Your Atlassian account email
3. **Jira Dashboard URL**: The production dashboard URL (example: `https://firsttry.atlassian.net/jira/dashboards/10102`)
4. **Playwright Storage State**: A persistent authentication file (path example: `e2e/.auth/storageState.persistent.json`)

## Environment Setup

Export the required environment variables (do NOT commit these):

```bash
# Forge authentication (required)
export FORGE_EMAIL="your-email@example.com"
export FORGE_API_TOKEN="<your-api-token-from-atlassian>"

# Jira dashboard access (required for UI smoke proof)
export JIRA_DASHBOARD_URL="https://firsttry.atlassian.net/jira/dashboards/10102"
export STORAGE_STATE="e2e/.auth/storageState.persistent.json"
```

**IMPORTANT**: Never commit `FORGE_API_TOKEN` or check it into git. Use environment variables only.

## Running the Verification & Deployment

### Single Command

From the forge-app directory:

```bash
cd /workspaces/Firsttry/atlassian/forge-app
npm run prod:verify-deploy-upgrade
```

### What This Does

The script performs the following steps in order:

1. **Create Evidence Directory**: `/tmp/ft_verify_deploy_upgrade_prod_<timestamp>/`
2. **Capture Git State**: Verify working tree is clean, capture commit hash
3. **Secret Scan**: Detect accidentally committed tokens (hard fail if found)
4. **Verify Environment Variables**: Require `FORGE_EMAIL` and `FORGE_API_TOKEN` set
5. **Forge Authentication**: Non-interactive login using env vars
6. **Collect Pre-Deployment State**: Current deployments and installations
7. **Run Local Build Gates**:
   - `npm ci`: Install dependencies
   - `npm test`: Run unit tests (1880+ tests)
   - `npm run build:gadget`: Build UI with all 7 gates (identity, mutations, lockfile, etc.)
   - Backbone L0 proof verification
8. **Production Log Check**: Count backend wire proof markers (informational)
9. **UI Smoke Proof** (HARD GATE):
   - Launch Playwright chromium
   - Navigate to Jira dashboard with authenticated context
   - Capture all browser console output
   - Wait for UI boot markers (`[UI_ENTRY_RUNTIME_PROOF]`, `[UI_SERVE_OK]`, `[UI_BOOT_PROOF]`)
   - Wait for dashboard resolver response: `[UI_FT_GETDASHBOARDSTATE_SUCCESS]`
   - **FAIL** if status=undefined
   - **FAIL** if status= field missing
   - **FAIL** if UI_RESP_KEYS marker missing
   - **FAIL** if UI_GIT_SHA marker missing
10. **Deploy to Production**: `forge deploy -e production --non-interactive`
11. **Verify Deployment**: List deployments to confirm registration
12. **Upgrade Jira Installation**: `forge install --upgrade` with scopes confirmed
13. **Verify Installation**: List installations to confirm upgrade
14. **Post-Deploy Logs**: Capture last 15 minutes of production logs
15. **Create Manifest**: List all evidence files

## Evidence Directory

Upon completion (success or failure), all outputs are in:

```
/tmp/ft_verify_deploy_upgrade_prod_<TIMESTAMP>/
```

### Key Evidence Files

| File | Purpose |
|------|---------|
| `01_git_head.txt` | Commit hash before deployment |
| `02_git_status_porcelain.txt` | Git status (must be clean) |
| `03_secret_scan_repo.txt` | Secret marker scan results |
| `10_forge_login.txt` | Forge login output |
| `11_forge_whoami.txt` | Authenticated user confirmation |
| `12_deploy_list_before.txt` | Pre-deployment state |
| `20_npm_ci.txt` | Dependency installation |
| `21_npm_test.txt` | Full unit test output (1880+ tests) |
| `22_build_gadget.txt` | Build output with all 7 gates |
| `23_proof_gate.txt` | Backbone L0 verification |
| `30_prod_logs_2h.txt` | Recent production logs (2h) |
| `31_wire_proof_count.txt` | Count of backend wire proof markers |
| `40_ui_smoke_proof.txt` | UI smoke proof summary |
| `41_browser_console_full.txt` | Full browser console capture |
| `50_forge_deploy_prod.txt` | Forge deploy output |
| `51_deploy_list_after.txt` | Post-deployment state |
| `60_forge_install_upgrade.txt` | Jira upgrade output |
| `61_install_list_after.txt` | Post-upgrade state |
| `70_prod_logs_15m.txt` | Post-deploy logs (15m) |
| `99_manifest.txt` | Directory contents listing |

## Hard Gates (Cannot Be Overridden)

These gates must pass or the script exits with non-zero:

1. **Git Working Tree Clean**: No tracked changes allowed
2. **No Token Leaks**: Secret scan must not find ATATT or Bearer tokens
3. **Environment Variables**: `FORGE_EMAIL` and `FORGE_API_TOKEN` required
4. **Forge Authentication**: `forge login` and `forge whoami` must succeed
5. **Build Gates**: All local tests, builds, and proofs must pass
6. **UI Status Not Undefined**: Browser console must show `status=` with a value (not undefined)
7. **UI Proof Markers**: `[UI_RESP_KEYS]`, `UI_GIT_SHA=`, and `[UI_FT_GETDASHBOARDSTATE_SUCCESS]` must appear
8. **Deployment**: `forge deploy` must succeed
9. **Upgrade**: `forge install --upgrade` must succeed

## Troubleshooting

### "FORGE_EMAIL not set" or "FORGE_API_TOKEN not set"

Export both environment variables:

```bash
export FORGE_EMAIL="your@email.com"
export FORGE_API_TOKEN="<token>"
npm run prod:verify-deploy-upgrade
```

### "Forge login failed"

Verify your Atlassian API token is valid and the email matches your account.

### "HARD GATE FAILED: status=undefined"

The UI is still logging `status` as undefined. This indicates the fix was not applied or the build did not rebuild the UI.

**Check**:
- Is `src/gadget-ui/src/main.ts` reading from `stateResult.status` (not `data.status`)?
- Did you run `npm run build:gadget`?

### "Storage state file not found"

Ensure the Playwright persistent storage file exists:

```bash
ls -la e2e/.auth/storageState.persistent.json
```

If missing, create it by running a Playwright auth flow first.

### "Browser timeout waiting for marker"

The dashboard may be slow to load or not hitting our resolvers. Check:
- Is the Jira instance running?
- Can you manually navigate to the dashboard URL?
- Are there network errors in the browser console (check `41_browser_console_full.txt`)?

## Success Indicator

If the script completes with:

```
============================================================================
✅ ALL GATES PASSED - PRODUCTION VERIFICATION + DEPLOYMENT + UPGRADE COMPLETE
============================================================================
Evidence directory: /tmp/ft_verify_deploy_upgrade_prod_<TIMESTAMP>
```

Then:

- ✅ UI fix verified live (status is NOT undefined)
- ✅ Code deployed to production
- ✅ Jira installation upgraded to latest version
- ✅ All evidence captured in directory

## Manual Verification

After deployment, you can manually verify the fix is live:

1. **Open Dashboard**: https://firsttry.atlassian.net/jira/dashboards/10102
2. **Hard Reload**: Ctrl+Shift+R (with cache disabled in DevTools)
3. **Open Console**: F12 → Console tab
4. **Search for**: `[UI_FT_GETDASHBOARDSTATE_SUCCESS]`
5. **Verify**: You should see `status=HARD_ERROR` (or another valid status value, NOT undefined)

## Support

If you encounter issues:

1. Review the evidence directory files, especially:
   - `21_npm_test.txt` (tests)
   - `22_build_gadget.txt` (build)
   - `40_ui_smoke_proof.txt` (UI proof)
   - `41_browser_console_full.txt` (browser logs)

2. Check that all env vars are set correctly

3. Ensure the Jira instance is accessible and your storage state is up to date
