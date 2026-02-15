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

# Copy contents of /tmp/state.b64 SAFELY (open in editor, do NOT cat)
code /tmp/state.b64  # Opens in VS Code editor

# Securely delete temp file after copying from editor
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

---

# Option A: Codespaces + noVNC + SSO (No Passwords) — RECOMMENDED

**Use this for interactive state generation in GitHub Codespaces without entering Jira credentials.**

## Quick Start

```bash
cd /workspaces/Firsttry/atlassian/forge-app

# Step 1: Set env (JIRA_EMAIL/JIRA_PASSWORD NOT required)
export JIRA_BASE_URL="https://firsttry.atlassian.net"
export FT_PW_AUTH_MODE="manual"    # Default; skips credential checks

# Step 2: Start noVNC + generate state (wrapper handles everything)
bash scripts/proof/optionA_generate_state_with_novnc.sh

# Step 3: Open noVNC URL (shown in terminal) and complete SSO login
# → noVNC opens in new browser tab → Authenticate → Done

# Step 4: Copy secret to GitHub (instructions printed at end)
```

## Why Option A?

| Feature | Auto | Password Required | noVNC Needed |
|---|---|---|---|
| **Option A (Recommended)** | ✅ Start/stop automatic | ❌ No | ✅ Yes (port 6080) |
| Old credential mode | ❌ Manual | ✅ Yes (insecure) | ✅ Optional |

**Option A benefits:**
- ✅ No passwords required (safer)
- ✅ Manual SSO login (more reliable than credential auth)
- ✅ Wrapper handles display stack entirely
- ✅ One command to generate OR use existing state
- ✅ Base64 encoding built-in (safe for GitHub Secrets)
- ✅ Evidence directory preserved for troubleshooting

## Step-by-Step

### Step 1: Forward noVNC Port (Codespaces)

In Codespaces terminal:
1. Click **PORTS** tab (at bottom)
2. Click the "+" icon to forward a port
3. Forward **6080** (Private)
4. You'll see: `http://localhost:6080` → click to open in browser

### Step 2: Run Option A Wrapper

```bash
cd /workspaces/Firsttry/atlassian/forge-app
export JIRA_BASE_URL="https://firsttry.atlassian.net"

bash scripts/proof/optionA_generate_state_with_novnc.sh
```

**What it does:**
1. Starts noVNC display stack (Xvfb + x11vnc + websockify)
2. Waits for `DISPLAY=:99` to be ready (max 30s)
3. Runs `generate_playwright_state.sh` in headed mode
4. Validates `state.json` is created and non-empty
5. Base64 encodes state → `/tmp/state.b64` (file only, NOT echoed)
6. Prints next-step instructions
7. Cleans up display stack on exit

### Step 3: Complete SSO in noVNC Browser

The wrapper outputs the noVNC URL (from Step 1):
```
http://localhost:6080/vnc.html
```

1. Open that URL in your browser
2. A remote desktop appears
3. Browser is already loading Jira login page
4. **Complete SSO authentication** (MFA, etc.)
5. Wait for script to say "Done" in terminal
6. Close noVNC browser tab

### Step 4: Verify State Files

```bash
# The wrapper outputs evidence directory:
ls -lah /tmp/ft_optionA_state_*/

# Inside:
# 01_novnc_start.log       ← Display stack startup
# 02_generate_state.log    ← State generation output
# 03_state_file_stat.log   ← state.json file size (no content)
# 04_state_b64_stat.log    ← base64 file size + SHA256 (no content)
```

### Step 5: Use State Locally (Codespaces Testing)

For local Playwright testing in Codespaces, use the state.json file directly:

```bash
# state.json is already saved locally:
tests/playwright/.auth/state.json

# For local test runs, Playwright will automatically use this file
# DO NOT load base64 into environment variables for local runs

# Example: Run a local test
cd /workspaces/Firsttry/atlassian/forge-app
npm run playwright:local  # or similar (checks for tests/playwright/.auth/state.json)
```

**Security Note:** Never run `cat /tmp/state.b64` in the terminal. The base64 file is for GitHub Secret transfer only.

### Step 6: Store in GitHub Secret (Production CI)

To make the state available in GitHub Actions (CI/CD):

```bash
# 1. Open /tmp/state.b64 in an editor (SAFE way to view/copy):
#    - In Codespaces: code /tmp/state.b64
#    - Or use file explorer to open the file
#    Then copy contents from the editor

# 2. Go to: https://github.com/Firsttry-Solutions/Firsttry/settings/secrets/actions

# 3. Click: New repository secret
#    Name: FT_PLAYWRIGHT_STATE_B64
#    Value: (paste from editor, NOT from terminal)

# 4. Save secret

# Now CI workflows will auto-detect and use FT_PLAYWRIGHT_STATE_B64:
#   export FT_PLAYWRIGHT_STATE_B64="${{ secrets.FT_PLAYWRIGHT_STATE_B64 }}"
#   bash scripts/proof/ship_prod_release.sh
```

**CRITICAL:** Do NOT use `cat /tmp/state.b64` in terminal. Always copy from file editor or file explorer.
#    Value: (paste from /tmp/state.b64)
```

Then in CI workflows, the secret is auto-detected:
```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Ship production release
        env:
          FT_PLAYWRIGHT_STATE_B64: ${{ secrets.FT_PLAYWRIGHT_STATE_B64 }}
          # ... other secrets ...
        run: bash scripts/proof/ship_prod_release.sh
```

## Security Reminders (Option A)

1. **Never echo base64 state:**
   ```bash
   # ❌ BAD (exposes secret)
   echo "$FT_PLAYWRIGHT_STATE_B64"
   
   # ✅ GOOD (view file in editor, then copy)
   cat /tmp/state.b64  # (in editor/browser, not terminal)
   ```

2. **Never commit state.json:**
   ```bash
   # Verify it's gitignored:
   git ls-files tests/playwright/.auth/state.json
   # (should output nothing)
   
   # If it leaked, delete it:
   git rm --cached tests/playwright/.auth/state.json
   git commit -m "fix: remove state.json from history"
   ```

3. **Rotate state if leaked:**
   - Delete from GitHub Secret
   - Regenerate using this script
   - Update secret with new value

4. **State expiration:**
   - Sessions expire every 7-30 days
   - If tests fail with "Authentication required", regenerate state
   - Re-run: `bash scripts/proof/optionA_generate_state_with_novnc.sh`

## Troubleshooting Option A

### Error: "DISPLAY=:99 did not become ready"

**Cause:** Xvfb startup failed or took > 30s.

**Fix:**
```bash
# Check if apt packages are installed
command -v Xvfb && echo "✓ Xvfb installed" || echo "✗ Xvfb missing"

# If missing, install manually
sudo apt-get update && sudo apt-get install -y xvfb fluxbox x11vnc novnc websockify

# Retry
bash scripts/proof/optionA_generate_state_with_novnc.sh
```

### Error: "state.json not found"

**Cause:** `generate_playwright_state.sh` did not complete or failed.

**Fix:** Check the log:
```bash
# The wrapper printed evidence dir; look inside:
tail -100 /tmp/ft_optionA_state_*/02_generate_state.log

# Common reasons:
# - Timeout waiting for browser to load
# - SSO failed (wrong credentials, MFA rejected)
# - noVNC connection lost during login

# Resolution: Retry
bash scripts/proof/optionA_generate_state_with_novnc.sh
```

### Error: "state.json too small (< 200 bytes)"

**Cause:** Incomplete authentication or corrupted state.

**Fix:** Regenerate:
```bash
rm tests/playwright/.auth/state.json tests/playwright/.auth/state.provenance.json
bash scripts/proof/optionA_generate_state_with_novnc.sh
```

### Issue: noVNC browser is very slow

**Cause:** Network latency or host machine not fast enough.

**Fix:**
- Make sure noVNC port is forwarded as **PRIVATE** (better performance)
- Use a wired network if possible
- Reduce XVFB resolution (edit script, set `XVFB_WHD="1280x720x24"`)

---

## State Expiration

Browser sessions expire after ~7-30 days (depends on tenant SSO settings).

**Symptoms of expired state:**
- Playwright tests fail with "Authentication required" or "Session expired"
- Logs show: `[AUTH] Login page detected after storageState injection`

**Resolution:**
1. Regenerate state locally (Option A, Step 2-4)
2. Re-encode and update GitHub Secret (Option A, Step 6)
3. Retry deployment

---



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

