# Playwright SSO Authentication State Guide

## Overview

Production deployments require Playwright browser testing for fail-closed validation. For SSO-only tenants (like `firsttry.atlassian.net`), interactive login is not possible in headless/CI environments. This guide explains how to handle authentication using cached browser state.

## Security Model

**CRITICAL**: `state.json` contains session cookies and tokens. Treat it like an API key:
- ✅ Store in GitHub Secrets (base64-encoded)
- ✅ Use `chmod 600` for local files
- ❌ NEVER commit to git (protected by `.gitignore` + guards)
- ❌ NEVER print contents to logs or console

## Fail-Closed Behavior

The production release gate (`scripts/proof/ship_prod_release.sh` Step 11) **requires** authentication state:

```bash
IF auth state available: ✅ Run Playwright with storageState
ELSE: ❌ FAIL immediately with instructions
```

**No fallback to interactive login.** **No "skip for SSO" option.**

## Usage Patterns

### Pattern A: Local Development (One-Time Setup)

**Step 1: Generate auth state locally**

```bash
cd /workspaces/Firsttry/atlassian/forge-app

# Set required environment
export JIRA_BASE_URL="https://firsttry.atlassian.net"
export FT_AUTH_GENERATE_STATE=1
export FT_PLAYWRIGHT_MODE=headed

# Run generator (opens browser for manual SSO login)
bash scripts/proof/generate_playwright_state.sh
```

**What happens:**
1. Browser opens to JIRA login page
2. You complete SSO authentication manually
3. Script saves session to `tests/playwright/.auth/state.json`
4. Provenance file created: `tests/playwright/.auth/state.provenance.json`
5. Both files are `.gitignore`'d (never committed)

**Step 2: Run production release gate**

```bash
# State file now exists locally
bash scripts/proof/ship_prod_release.sh

# Step 11 will detect local state and use it
# Output: [FT_PROOF] PLAYWRIGHT_AUTH_MODE=STATE_FILE
```

### Pattern B: CI/GitHub Actions (Recommended for Production)

**Step 1: Generate state locally (once)**

Follow Pattern A Step 1 above to create `tests/playwright/.auth/state.json`.

**Step 2: Encode state for CI secret**

```bash
cd /workspaces/Firsttry/atlassian/forge-app

# Base64-encode (no line breaks)
base64 -w0 tests/playwright/.auth/state.json > /tmp/state.b64

# Copy contents of /tmp/state.b64
cat /tmp/state.b64

# Securely delete temp file
shred -u /tmp/state.b64
```

**Step 3: Store in GitHub Secret**

1. Go to: `https://github.com/Firsttry-Solutions/Firsttry/settings/secrets/actions`
2. Click **New repository secret**
3. Name: `FT_PLAYWRIGHT_STATE_B64`
4. Value: Paste the base64 string from Step 2
5. Click **Add secret**

**Step 4: Use in CI workflow**

```yaml
# .github/workflows/prod-deploy.yml
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Export Playwright auth state
        env:
          FT_PLAYWRIGHT_STATE_B64: ${{ secrets.FT_PLAYWRIGHT_STATE_B64 }}
        run: |
          # Secret is now available as environment variable
          # ship_prod_release.sh will auto-detect and decode it
          
      - name: Run production release
        env:
          FORGE_EMAIL: ${{ secrets.FORGE_EMAIL }}
          FORGE_API_TOKEN: ${{ secrets.FORGE_API_TOKEN }}
          FT_JIRA_TENANT: "https://firsttry.atlassian.net"
          FT_JIRA_USERNAME: ${{ secrets.FT_JIRA_USERNAME }}
          FT_JIRA_API_TOKEN: ${{ secrets.FT_JIRA_API_TOKEN }}
          FT_PROD_ENV: production
          FT_DEPLOY_CONFIRM: YES_DEPLOY
          FT_PLAYWRIGHT_STATE_B64: ${{ secrets.FT_PLAYWRIGHT_STATE_B64 }}
        working-directory: atlassian/forge-app
        run: bash scripts/proof/ship_prod_release.sh
```

**What happens:**
1. CI exports `FT_PLAYWRIGHT_STATE_B64` secret (never logged)
2. `ship_prod_release.sh` Step 11 decodes it to `/tmp/ft_playwright_state_$$.json`
3. Validates JSON structure and size (>= 200 bytes)
4. Moves to `tests/playwright/.auth/state.json` with `chmod 600`
5. Creates provenance: `state.provenance.json` (marks CI source)
6. Playwright runs with `storageState`
7. Output: `[FT_PROOF] PLAYWRIGHT_AUTH_MODE=STATE_B64`

## Priority Order

`ship_prod_release.sh` checks auth state sources in this order:

1. **`FT_PLAYWRIGHT_STATE_B64`** (environment variable) ← **Preferred for CI**
2. **`tests/playwright/.auth/state.json`** (local file) ← Fallback for local runs
3. **None available** → **FAIL with instructions** ← Fail-closed

## State Expiration

Browser sessions expire after ~7-30 days (depends on tenant SSO settings).

**Symptoms of expired state:**
- Playwright tests fail with "Authentication required" or "Session expired"
- Logs show: `[AUTH] Login page detected after storageState injection`

**Resolution:**
1. Regenerate state locally (Pattern A)
2. Re-encode and update GitHub Secret (Pattern B Step 2-3)
3. Retry deployment

## Evidence Logging

Each deployment logs auth mode to evidence directory:

```bash
# $EVID/31_playwright_auth_mode.log
PLAYWRIGHT_AUTH_MODE=STATE_B64          # or STATE_FILE
PLAYWRIGHT_STATE_SOURCE=CI_SECRET       # or LOCAL_FILE
PLAYWRIGHT_STATE_PATH=tests/playwright/.auth/state.json
PLAYWRIGHT_STATE_SIZE_BYTES=15234
```

**What is logged:** Source, size, mode
**What is NOT logged:** Cookies, tokens, JSON contents

## Troubleshooting

### Error: "No Playwright auth state found"

**Cause:** Neither `FT_PLAYWRIGHT_STATE_B64` nor local `state.json` available.

**Fix:** Follow Pattern A (local) or Pattern B (CI).

### Error: "Decoded state file too small"

**Cause:** Base64 string is truncated or invalid.

**Fix:**
```bash
# Test decode locally
echo "$FT_PLAYWRIGHT_STATE_B64" | base64 -d | wc -c
# Should be >= 200 bytes

# Regenerate if < 200
```

### Error: "state.json exists but state.provenance.json is missing"

**Cause:** Manual creation of `state.json` without proper generator.

**Fix:** Delete and regenerate:
```bash
rm tests/playwright/.auth/state.json
# Then follow Pattern A
```

### Error: "Playwright tests failed" (after state injection)

**Cause:** State expired, or SSO tenant changed.

**Fix:** Regenerate state (Pattern A).

## Security Controls

1. **`.gitignore`**: Blocks `tests/playwright/.auth/*.json` from commits
2. **Guard script**: `guard_no_state_json_commit.sh` fails if state staged
3. **Provenance**: Tracks how state was created (audit trail)
4. **Permissions**: `chmod 600` on all state files
5. **Cleanup**: State deleted after Playwright run (defense-in-depth)
6. **Base64 encoding**: Prevents accidental exposure in CI logs
7. **No echo**: Scripts never print decoded state contents

## Codespaces SSO: Use noVNC

GitHub Codespaces runs in a remote container without a physical display. The interactive generator script (`generate_playwright_state.sh`) requires a visible browser for SSO login.

### The Canonical noVNC Workflow (SSO via storageState)

The noVNC runner (`scripts/proof/run_playwright_with_novnc.sh`) is now SSO-compatible. It automatically:
1. Starts Xvfb (virtual display)
2. Launches noVNC server on `localhost:6080`
3. Calls `generate_playwright_state.sh` interactively (you complete SSO in the noVNC browser)
4. Validates `state.json` is created and valid
5. Runs Playwright dashboard diagnostics with `storageState`

#### Required Environment Variables

```bash
export JIRA_BASE_URL="https://firsttry.atlassian.net"
export JIRA_DASHBOARD_URL="https://firsttry.atlassian.net/jira/dashboards/10102"
export FT_AUTH_GENERATE_STATE="1"           # Tell generator to run
export FT_PLAYWRIGHT_MODE="headed"          # Enable interactive browser
bash scripts/proof/run_playwright_with_novnc.sh
```

**Legacy variables NOT used:** `JIRA_EMAIL`, `JIRA_PASSWORD` (these were for older non-SSO auth)

#### Complete Workflow

For Codespaces-based Playwright SSO state generation, use the noVNC runner:


**Step 1: Set environment variables and run noVNC runner**

```bash
cd /workspaces/Firsttry/atlassian/forge-app

export JIRA_BASE_URL="https://firsttry.atlassian.net"
export JIRA_DASHBOARD_URL="https://firsttry.atlassian.net/jira/dashboards/10102"
export FT_AUTH_GENERATE_STATE="1"
export FT_PLAYWRIGHT_MODE="headed"

bash scripts/proof/run_playwright_with_novnc.sh
```

The noVNC runner will automatically:
- Start Xvfb (virtual display available at DISPLAY=:99)
- Launch noVNC on `localhost:6080`
- Call `generate_playwright_state.sh` for state generation
- Run Playwright dashboard tests with storageState

**Step 2: Access browser via noVNC**

In Codespaces:
- Open **PORTS** tab
- Forward port 6080 (PRIVATE)
- Click the noVNC URL
- Remote desktop appears with a browser

Complete SSO login in the browser. The script auto-detects when you're authenticated and saves `state.json`.

**Step 3: Verify success**

The runner outputs:
```
[PW_NOVNC] ✅ Auth state validation PASSED
[PW_NOVNC] === PHASE 2: DASHBOARD DIAGNOSTICS (headed) ===
```

Both auth state generation AND dashboard tests succeeded.

**Step 4 (Optional): Store for CI use**

```bash
base64 -w0 tests/playwright/.auth/state.json > /tmp/state.b64
# Store in GitHub Secret: FT_PLAYWRIGHT_STATE_B64
# Then CI workflows auto-detect and use it
```

---

## ⚠️ Older Implementation (Deprecated)

The following describes the older way to use noVNC. The above steps are now preferred.

**Old Step 1: Start noVNC Server in Codespaces**

```bash
cd /workspaces/Firsttry/atlassian/forge-app
bash scripts/proof/run_playwright_with_novnc.sh
```

This script:
- Starts Xvfb (virtual display)
- Launches noVNC server on `localhost:6080`
- Outputs connection instructions

**Old Step 2: Access Browser via noVNC**

The script prints a URL like:
```
🌐 noVNC URL: http://localhost:6080?path=websockify
🔓 Password: (default noVNC password, see script)
```

In Codespaces:
- Open the **PORTS** tab
- Forward port 6080 (PRIVATE forwarding recommended)
- Click the forwarded URL
- Authenticate with the password from script output

**Step 3: Generate Playwright State via noVNC**

In another Codespaces terminal (while noVNC is running):

```bash
cd /workspaces/Firsttry/atlassian/forge-app

# Set required environment
export JIRA_BASE_URL="https://firsttry.atlassian.net"
export JIRA_DASHBOARD_URL="https://firsttry.atlassian.net/jira/your-work"
export FT_AUTH_GENERATE_STATE=1
export FT_PLAYWRIGHT_MODE=headed

# Run generator
bash scripts/proof/generate_playwright_state.sh
```

The script will:
1. Launch a headed (visible) browser in the noVNC virtual display
2. Navigate to JIRA login page
3. Wait for you to complete SSO authentication via the noVNC remote desktop
4. Save session to `tests/playwright/.auth/state.json`

**Step 4: Extract Base64 for GitHub Secret**

After successful state.json generation:

```bash
base64 -w0 tests/playwright/.auth/state.json > /tmp/state.b64
echo "State size: $(wc -c </tmp/state.b64) bytes"
```

**CRITICAL:** Never print the base64 contents directly:
```bash
# ❌ DO NOT DO THIS:
cat /tmp/state.b64  # Will expose state in logs

# ✅ DO THIS:
# Copy the file securely to GitHub Secret settings
# Use: Settings > Secrets and Variables > Actions > New Repository Secret
# Name: FT_PLAYWRIGHT_STATE_B64
# Value: (paste contents from /tmp/state.b64)
```

**Step 5: Configure GitHub Secret**

1. Go to https://github.com/Firsttry-Solutions/Firsttry/settings/secrets/actions
2. Click **New repository secret**
3. Name: `FT_PLAYWRIGHT_STATE_B64`
4. Value: Paste contents of `/tmp/state.b64` (without printing it first)
5. Click **Add secret**

**Step 6: Verify in CI**

Ship scripts will automatically detect the base64 secret:

```bash
# In CI workflow or local test:
export FT_PLAYWRIGHT_STATE_B64="<secret from GitHub>"
bash scripts/proof/ship_prod_release.sh
# Script will:
# 1. Detect FT_PLAYWRIGHT_STATE_B64 is set
# 2. Decode and validate
# 3. Use for storageState in Playwright
# 4. Write evidence: PLAYWRIGHT_AUTH_MODE=STATE_B64
```

### Why noVNC?

| Approach | Pro | Con |
|---|---|---|
| **Interactive terminal** | Simple, no extra setup | Blocks forever if not connected; hard to use headless |
| **noVNC (Codespaces)** | ✅ Visible browser, manual login, no timeout issues | Requires port forward + browser tab |
| **Base64 in CI** | ✅ No manual interaction, automated | Requires state pre-generated locally |

**Recommended for Codespaces:** noVNC + base64 secret combo
- Generate locally once (noVNC)
- Store as GitHub Secret (base64)
- CI uses secret (zero interaction)

## Related Files

- **Generator**: `scripts/proof/generate_playwright_state.sh`
- **noVNC wrapper**: `scripts/proof/run_playwright_with_novnc.sh`
- **Prod gate**: `scripts/proof/ship_prod_release.sh` (Step 11)
- **Playwright runner**: `scripts/proof/run_dashboard_playwright.sh`
- **Guard**: `scripts/proof/guard_no_state_json_commit.sh`
- **Gitignore**: `.gitignore` (lines for `.auth/`)
- **Forge auth**: `docs/FORGE_AUTH_IN_CODE_SPACES.md`

## FAQ

**Q: Can I skip Playwright for SSO tenants?**
A: No. Fail-closed design. Generate state once, reuse in CI.

**Q: How often do I regenerate state?**
A: When it expires (7-30 days), or when SSO config changes.

**Q: Can I use the same state in multiple repos?**
A: Yes, if they target the same tenant and SSO identity.

**Q: What if my laptop has the state but CI doesn't?**
A: Follow the noVNC + base64 steps to copy from Codespaces to GitHub Secret.

**Q: Is state tenant-specific?**
A: Yes. Each Atlassian tenant needs its own state.json.

**Q: Will noVNC work on my local machine?**
A: Yes, same steps apply. Port forward to `localhost:6080` and use the noVNC URL.

---

**Last Updated:** 2026-02-15  
**Applies To:** All SSO-only tenants (e.g., `firsttry.atlassian.net`)  
**Codespaces:** Recommended workflow is noVNC + base64 GitHub Secret

