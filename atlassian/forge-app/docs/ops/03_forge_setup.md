# Forge Setup — Login, Environment, Scopes

**Doc ID:** FT-OPS-003  
**Version:** 1.0.0  
**Owner:** operations@firsttry.run  
**Last Updated:** 2026-03-01  
**Review Cycle:** Quarterly  

## Audience

Operators preparing to deploy FirstTry to Atlassian Forge platform.

## Prerequisites

- Completed [02_local_setup.md](02_local_setup.md)
- Forge CLI installed (`forge --version` >= 13.0)
- Atlassian account created
- Jira Admin access on target site

## What Success Looks Like

After completing this runbook:
- Forge CLI authenticated to your Atlassian account
- Environment variables set (if needed)
- Manifest.yml reviewed and understood
- Ready to deploy to Jira site

## Procedure

### Step 1: Forge CLI Login

```bash
# Working directory: any
forge login
```

**What happens:**
1. Browser window opens
2. Redirects to Atlassian auth page
3. Prompts for account selection and permissions
4. Redirects back to localhost with auth token
5. CLI stores token locally

**Expected output:**
```
Opening browser for authentication...
Logged in successfully as: your.email@example.com
```

**Verification:**
```bash
forge whoami
```

**Expected output:**
```
Logged in as: your.email@example.com
Account ID: 1234567890abcdef
```

**If login fails:** See Troubleshooting section below.

### Step 2: Review Manifest

The manifest defines app metadata, scopes, and modules.

```bash
# Working directory: /path/to/Firsttry/atlassian/forge-app
cat manifest.yml
```

**Key sections to understand:**

#### App Metadata
```yaml
app:
  id: ari:cloud:ecosystem::app/...
```
**Note:** App ID is assigned by Forge on first deploy. Do not edit manually.

#### Permissions (Scopes)
```yaml
permissions:
  scopes:
    - read:jira-work
    - read:jira-user
    - storage:app
    - ...
```

**Critical scopes for FirstTry:**
- `read:jira-work` — Read issues, projects, workflows
- `read:jira-user` — Read user profiles, groups
- `storage:app` — Store audit evidence, tenant config
- `write:jira-work` — Create issues (if enabled)

**Security note:** FirstTry uses read-only scopes for audit. Write scopes are optional and disabled by default.

#### Modules
```yaml
modules:
  jira:globalPage:
    - key: audit-evidence-global-page
      title: Audit Evidence
      ...
```

Defines UI entry points. Do not modify without full audit.

### Step 3: Check Forge App Exists (First-Time Only)

```bash
# Working directory: /path/to/Firsttry/atlassian/forge-app
forge whoami
```

Output shows your registered apps. If this is first deploy, you will see:
```
No apps registered yet.
```

**Next:** Proceed to [04_deploy_run.md](04_deploy_run.md) to create app.

### Step 4: Set Environment Variables (Optional)

If deploying to a specific environment:

```bash
# Development
export FORGE_ENV=development

# Production (default)
export FORGE_ENV=production
```

**Note:** Forge environments are per-installation, not per-deployment. The same app deployment goes to all sites. Site-level configuration is managed via app settings in Jira.

## Forge Concepts

### App vs Installation

- **App:** Single deployment unit (code + manifest)
- **Installation:** Instance of app on a specific Jira site
- **One app, many installations:** Same code runs on multiple customer sites

### Environments

Forge has NO separate dev/prod environments for app code. Environments refer to:
- **Local tunnel:** `forge tunnel` for development
- **Deployed:** `forge deploy` for production

**FirstTry policy:** Production deployments require audit pass. Tunnel mode is for development only.

### Scopes and Permissions

Scopes are requested at install time. Users see a consent screen listing all requested permissions.

**Scope change policy:**
- Adding scopes requires app reinstall (users must re-consent)
- Removing scopes does not require reinstall
- Changing scopes requires full audit cycle

## Manifest Review Checklist

Before deploying, verify manifest.yml contains:

- [ ] `app.id` present (or empty on first deploy)
- [ ] `permissions.scopes` includes only required scopes
- [ ] `modules` defines expected UI entry points
- [ ] `resources` lists all backend functions (if any)
- [ ] No hardcoded secrets or API keys (use Forge secrets)

## Security Notes

### Forge Secrets

Sensitive data (API keys, tokens) must use Forge secrets, not hardcoded in code or manifest.

**Setting secrets:**
```bash
# Working directory: /path/to/Firsttry/atlassian/forge-app
forge variables set SECRET_NAME

# You will be prompted to enter the value (not echoed to terminal)
```

**Using secrets in code:**
```typescript
import { storage } from '@forge/api';

const secretValue = process.env.SECRET_NAME;
```

### Tenant Isolation

Forge provides automatic tenant isolation via Storage API. Each installation has separate storage namespace.

**DO NOT:**
- Share storage keys between installations
- Use global state in backend functions
- Store tenant data in external services without proper isolation

## Troubleshooting

### Issue: "forge login" opens browser but fails

**Cause:** Localhost callback blocked, or browser session expired.

**Fix:**
```bash
# Option 1: Use interactive mode (manual token entry)
forge login --interactive

# Option 2: Clear browser cache
# Remove cookies for *.atlassian.com
# Retry forge login

# Option 3: Check firewall
# Ensure localhost:8000-9000 is not blocked
```

### Issue: "forge whoami" shows "Not logged in"

**Cause:** Auth token expired or cleared.

**Fix:**
```bash
forge logout
forge login
```

### Issue: "Insufficient permissions" when deploying

**Cause:** Atlassian account does not have developer role.

**Fix:**
1. Log in to https://developer.atlassian.com
2. Verify "Developer" badge is present
3. If not, accept developer terms
4. Retry `forge login`

### Issue: Manifest validation errors

**Cause:** Syntax error or invalid scope in manifest.yml.

**Fix:**
```bash
# Validate manifest without deploying
forge lint

# Expected output: "No issues found" or specific error messages
```

## Common Commands

```bash
# Check login status
forge whoami

# Log out
forge logout

# View app list
forge list

# View installed environments (per app)
forge environments

# Set secret variable
forge variables set VAR_NAME

# List all variables
forge variables list
```

## Environment Comparison

| Aspect | Tunnel (Development) | Deploy (Production) |
|--------|---------------------|---------------------|
| Code changes | Instant reload | Requires redeploy |
| Storage | Isolated per tunnel session | Persistent per installation |
| Logs | Local terminal | Forge log streaming |
| Network | Can access localhost | Cannot access localhost |
| Use case | Development, debugging | Production, customer sites |

## Next Steps

After completing Forge setup, proceed to [04_deploy_run.md](04_deploy_run.md) to deploy FirstTry to a Jira site.

For audit without deployment, skip to [05_audit_runbook.md](05_audit_runbook.md).

## Notes

- **Forge CLI stores auth token in `~/.forge/config.json`.** Do not commit this file.
- **Manifest changes require redeploy.** After editing `manifest.yml`, run `forge deploy` to apply changes.
- **Scope changes trigger reinstall prompt.** Users must approve new scopes.
- **Storage is persistent.** Data survives app redeployments but is deleted on uninstall (per retention policy).
