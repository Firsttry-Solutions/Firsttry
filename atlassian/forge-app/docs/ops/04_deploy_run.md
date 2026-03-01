# Deploy and Run — Install App, Verify, Smoke Test

**Doc ID:** FT-OPS-004  
**Version:** 1.0.0  
**Owner:** operations@firsttry.run  
**Last Updated:** 2026-03-01  
**Review Cycle:** Quarterly  

## Audience

Operators deploying FirstTry to a Jira site for the first time or upgrading existing installation.

## Prerequisites

- Completed [03_forge_setup.md](03_forge_setup.md)
- Forge CLI authenticated (`forge whoami` succeeds)
- Jira Admin access on target site
- Audit pass completed (for production deployments)

## What Success Looks Like

- App deployed to Forge platform
- App installed on Jira site
- UI accessible in Jira
- Smoke test passes

## Procedure

### Step 1: Deploy App to Forge Platform

```bash
# Working directory: /path/to/Firsttry/atlassian/forge-app
forge deploy
```

**What happens:**
1. Builds app bundle (TypeScript → JavaScript)
2. Uploads to Forge platform
3. Assigns version number (auto-incremented)

**Expected output:**
```
Building app...
Deploying app...
Deployed app to Forge platform
Deployment ID: 1234567890abcdef
Version: 1.0.0
```

**Verification:**
```bash
forge list
```

**Expected:** App appears in list with status "Deployed".

### Step 2: Install App on Jira Site

```bash
# Working directory: /path/to/Firsttry/atlassian/forge-app
forge install
```

**Interactive prompts:**
1. Select target site (choose from your accessible sites)
2. Confirm scopes/permissions
3. Wait for installation

**Expected output:**
```
? Select a site: firsttry.atlassian.net
Installing app to firsttry.atlassian.net...
App installed successfully
Installation ID: ari:cloud:jira::site/...
```

**Verification:**
```bash
forge install --list
```

**Expected:** Shows installed site(s) and installation IDs.

### Step 3: Verify App in Jira UI

1. Log in to target Jira site (e.g., `https://firsttry.atlassian.net`)
2. Navigate to **Apps** menu (top navigation)
3. Look for **Audit Evidence** (or configured app name)
4. Click to open global page

**Expected:**
- App appears in dropdown
- Clicking opens app UI
- No permission errors

**If app not visible:** See Troubleshooting.

### Step 4: Smoke Test

Run basic functionality test to verify app is operational.

**Manual smoke test:**
1. Open Audit Evidence global page
2. Verify page loads (no blank screen or error messages)
3. Check for expected UI elements (navigation, panels)
4. Verify no console errors (F12 developer tools)

**Automated smoke test (if available):**
```bash
# Working directory: /path/to/Firsttry/atlassian/forge-app
npm run smoke-test
```

**Expected:** All checks pass.

## Deployment Modes

### Development Mode (Tunnel)

For local development with instant reload:

```bash
# Working directory: /path/to/Firsttry/atlassian/forge-app
forge tunnel
```

**What happens:**
- Runs local dev server
- Proxies app UI to Jira site
- Code changes reload instantly (no redeploy)

**Use case:** Development, debugging, rapid iteration.

**Warning:** Do NOT use tunnel mode for production or customer sites.

### Production Mode (Deploy)

For stable, production-ready deployments:

```bash
forge deploy
forge install --upgrade
```

**Use case:** Production, customer pilots, Marketplace submissions.

## Upgrade Procedure

To upgrade existing installation to new version:

```bash
# Working directory: /path/to/Firsttry/atlassian/forge-app

# Deploy new version
forge deploy

# Upgrade all installations
forge install --upgrade

# Or upgrade specific site
forge install --upgrade --site firsttry.atlassian.net
```

**Note:** Upgrades preserve storage data. Tenant configuration persists across deployments.

## Rollback Procedure

If deployment causes issues:

```bash
# List deployment history
forge deploy history

# Rollback to previous version
forge deploy rollback --deployment-id PREVIOUS_DEPLOYMENT_ID

# Or interactive selection
forge deploy rollback
```

**Critical:** Test rollback procedure in non-production site first.

## Post-Deployment Checklist

- [ ] `forge deploy` succeeded without errors
- [ ] `forge install` succeeded on target site
- [ ] App visible in Jira Apps menu
- [ ] App UI loads without errors
- [ ] Smoke test passes
- [ ] Logs show no critical errors (`forge logs --tail`)
- [ ] If production: Audit pass recorded in evidence directory

## Troubleshooting

### Issue: "forge deploy" fails with "Build error"

**Cause:** TypeScript compilation error.

**Fix:**
```bash
# Working directory: /path/to/Firsttry/atlassian/forge-app
npm run build
# Review errors, fix source code
forge deploy
```

### Issue: App not visible in Jira Apps menu

**Cause:** Installation incomplete, or scopes not approved.

**Fix:**
1. Log out of Jira and log back in
2. Navigate to **Settings > Apps > Manage apps**
3. Verify FirstTry is listed as "Installed"
4. If not: Reinstall via `forge install`

### Issue: "Insufficient permissions" error in UI

**Cause:** User does not have required Jira permissions.

**Fix:** Grant user appropriate Jira project permissions (not Forge issue).

### Issue: Blank screen or infinite loader

**Cause:** JavaScript error, missing dependencies, or backend function failure.

**Fix:**
```bash
# Check logs for errors
forge logs --tail

# Common causes:
# - Missing environment variables
# - Incorrect manifest configuration
# - Backend function timeout
```

### Issue: "forge install" fails with "App already installed"

**Cause:** App exists on site, use upgrade instead.

**Fix:**
```bash
forge install --upgrade
```

## Common Deployment Workflows

### Full Redeploy

```bash
# Working directory: /path/to/Firsttry/atlassian/forge-app
cd /path/to/Firsttry/atlassian/forge-app
git pull origin main
npm ci
npm test
forge deploy
forge install --upgrade
```

### Deployment with Audit Proof

```bash
# Working directory: /path/to/Firsttry/atlassian/forge-app

# Run audit first
bash tools/audit/v3_1/run_stability_5x.sh
audit_exit=$?

# Only deploy if audit passes
if [ $audit_exit -eq 0 ]; then
  forge deploy
  forge install --upgrade --site firsttry.atlassian.net
else
  echo "Audit failed, deployment blocked"
  exit 1
fi
```

##Next Steps

After deployment, proceed to:
- **Verify audit compatibility:** [05_audit_runbook.md](05_audit_runbook.md)
- **Monitor in production:** [09_incident_response.md](09_incident_response.md)
- **Understand CI artifacts:** [06_ci_and_artifacts.md](06_ci_and_artifacts.md)

## Notes

- **Production deployments require audit pass.** Run stability 5x harness before deploy.
- **Storage persists across deployments.** Data survives upgrades but is deleted on uninstall.
- **Manifest changes trigger reinstall.** Scope changes require user re-consent.
- **Log retention is 7 days.** Download logs immediately after incidents.
