# Auth State Bootstrap Guide

## Problem: SSO/MFA/CAPTCHA blocks headless automation

Headless Playwright cannot complete login flows that require:
- Single Sign-On (SSO) - user must authenticate with external identity provider
- Multi-Factor Authentication (MFA) - requires OTP or authenticator app
- CAPTCHA/bot-guard - interactive challenge

This makes traditional CI automation unreliable on enterprise SSO tenants.

## Solution: Cached auth state + state-only mode

The preferred path for enterprise tenants:

1. **One-time manual bootstrap** (local dev or human-attended):
   - Run a desktop browser via Playwright in headed mode
   - Human completes login once (SSO, MFA, CAPTCHA all handled)
   - Browser saves authentication state (`state.json`)

2. **Deterministic CI reuse**:
   - CI injects `state.json` via encrypted GitHub secret
   - Runs Playwright with `FT_AUTH_MODE=state-only`
   - No login automation needed; state reuse only
   - Unblocked by bot-guard/MFA

## Local Bootstrap

### Prerequisites

```bash
cd /workspaces/Firsttry/atlassian/forge-app

# Ensure Playwright is installed
npm ci
npx playwright install --with-deps
```

### Bootstrap Command

```bash
export JIRA_BASE_URL="https://firsttry.atlassian.net"
export JIRA_DASHBOARD_URL="https://firsttry.atlassian.net/jira/dashboards/10102"
export FT_BOOTSTRAP_TIMEOUT_SECONDS=900  # 15 min to complete login manually

bash scripts/proof/bootstrap_auth_state_headed.sh
echo "EXIT=$?"
```

### What Happens

1. Opens a headed browser window
2. Prompts you to log in (complete SSO, MFA, CAPTCHA if needed)
3. After login, browser saves cookies/credentials to state.json
4. Creates `/tmp/pw_state_bootstrap_<UTC_ISO_Z>/bootstrap-result.json` with:
   ```json
   {
     "result": "OK",
     "reasonCode": "STATE_BOOTSTRAP_OK",
     "statePath": "tests/playwright/.auth/state.json",
     "stateBytes": 4521
   }
   ```

### Output Artifacts

- **tests/playwright/.auth/state.json** — Generated auth state (DO NOT COMMIT, treat as secret)
- **/tmp/pw_state_bootstrap_<UTC_ISO_Z>/bootstrap-result.json** — Evidence JSON (OK success, reason codes on failure)
- **/tmp/pw_state_bootstrap_<UTC_ISO_Z>/bootstrap.stdout.log** — Log of setup run
- **/tmp/pw_state_bootstrap_<UTC_ISO_Z>/bootstrap.stderr.log** — Stderr from Playwright

### Exit Codes

| Code | Meaning |
|------|---------|
| 0    | SUCCESS - state.json created and validated |
| 1    | FAIL - state.json missing, invalid, or too small |
| 124  | TIMEOUT - exceeded FT_BOOTSTRAP_TIMEOUT_SECONDS |

### Failure Reason Codes

| Code | Meaning |
|------|---------|
| STATE_BOOTSTRAP_OK | Success |
| STATE_BOOTSTRAP_TIMEOUT | Exceeded timeout without generating state.json |
| STATE_FILE_MISSING | tests/playwright/.auth/state.json not created by Playwright |
| STATE_FILE_INVALID | Created file is not valid JSON |
| STATE_FILE_TOO_SMALL | File < 200 bytes (insufficient auth data) |
| STATE_FILE_EMPTY_SECTIONS | No cookies or origins entries in state |

## CI Setup

### 1. Generate Base64 State for Secret

After successful local bootstrap:

```bash
cat tests/playwright/.auth/state.json | base64 -w 0 > /tmp/state.b64
cat /tmp/state.b64  # Copy output
```

⚠️ **WARNING**: This is sensitive! Treat like a password.

### 2. Create GitHub Secret

In GitHub Actions:
- Go to Settings → Secrets and variables → Actions
- Create new repository secret: **FT_AUTH_STATE_JSON_B64**
- Paste the base64 content
- **NEVER** commit state.json or raw base64 to git

### 3. CI Injection

GitHub Actions workflow (`pw_dashboard_state_only.yml`) automatically:
1. Retrieves secret `FT_AUTH_STATE_JSON_B64`
2. Calls `scripts/proof/install_state_from_env.sh` to decode and validate
3. Runs dashboard test with `FT_AUTH_MODE=state-only`
4. Produces artifacts:
   - `/tmp/pw_dash_diag_*` — test results (state reuse success, or reason for failure)
   - `/tmp/pw_state_install_*` — state injection evidence

### State Injection Evidence

Expected success case (`/tmp/pw_state_install_<UTC>/state-install-result.json`):
```json
{
  "reason": "STATE_INSTALL_OK",
  "result": "OK",
  "stateBytes": 4521,
  "statePath": "tests/playwright/.auth/state.json"
}
```

## State Rotation

Auth tokens have limited lifetime. If CI fails with `AUTH_STATE_REUSE_FAILED`, re-bootstrap:

1. `bash scripts/proof/bootstrap_auth_state_headed.sh` (local)
2. Update GitHub secret with new base64

## Never Commit state.json

**CRITICAL:** `state.json` is a secret — it contains session cookies and credentials.

### Verify it's not tracked

`.gitignore` blocks all files matching these patterns:
```
tests/playwright/.auth/state.json
tests/playwright/.auth/*.json
```

Verify state.json is NOT tracked:
```bash
git status tests/playwright/.auth/state.json
# Should output: "fatal: pathspec 'tests/playwright/.auth/state.json' did not match any files"
# or: "not tracked by git"

# If it IS tracked, remove it:
git rm --cached tests/playwright/.auth/state.json
git commit -m "remove: accidentally tracked state.json"
```

### Guardrails prevent leaks

The CI workflow includes automated checks:
- `Pre-flight guard`: Ensures state.json is NOT tracked or staged before injection
- `Post-flight guard`: Ensures state.json does NOT appear in artifact directories
- Scripts never echo `FT_AUTH_STATE_JSON_B64` or decoded content

**Guard Evidence Path:** `/tmp/pw_state_guard_<UTC>/state-guard-result.json`  
Schema:
```json
{
  "result": "OK" | "FAIL",
  "reasonCode": "UNKNOWN" | "STATE_FILE_TRACKED" | "STATE_FILE_PRESENT_IN_ARTIFACT_DIR" | "STATE_FILE_PRESENT_IN_REPO" | "STATE_SECRET_ECHO_RISK",
  "details": {
    "phase": "pre" | "post",
    "violations": number,
    "tracked": boolean,
    "staged": boolean,
    "stateExists": boolean,
    "statePath": string,
    "newestOutDir": string,
    "outDirHasState": boolean,
    "echoRisk": boolean
  }
}
```

**CI Cleanup:** The workflow explicitly deletes `tests/playwright/.auth/state.json`:
- Before post-flight guard (defense-in-depth)
- At end of job (final cleanup)

If guards detect violations, the workflow **fails immediately**.

## Rotate the CI secret safely

Auth tokens have limited lifetime (~1-4 weeks depending on your Jira instance). When CI fails with `AUTH_STATE_REUSE_FAILED`, re-bootstrap and rotate the secret:

### Step 1: Bootstrap fresh (local)

```bash
bash scripts/proof/bootstrap_auth_state_headed.sh
# Complete login in the browser window that appears
# Exit 0 when done
```

### Step 2: Encode to base64 (safe, no secrets in shell history)

**Linux:**
```bash
cat tests/playwright/.auth/state.json | base64 -w 0 > /tmp/state.b64
cat /tmp/state.b64  # Copy output
```

**macOS:**
```bash
cat tests/playwright/.auth/state.json | base64 -w 0 | tr -d '\n'
# or
(cat tests/playwright/.auth/state.json | base64) | tr -d '\n'
# Copy output
```

### Step 3: Update GitHub secret

- Go to: Settings → Secrets and variables → Actions
- Select secret: **FT_AUTH_STATE_JSON_B64**
- Update value with new base64
- Click "Update secret"

### Step 4: Clean up locally

```bash
# DO NOT commit state.json
rm tests/playwright/.auth/state.json

# Verify it's gone
git status tests/playwright/
```

**WARNING:** 
- NEVER paste state.json or base64 into logs, comments, or Slack.
- NEVER store state.json in your git clone; it's generated locally only.
- Treat base64 as a secret; only paste into GitHub's secret form.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Bootstrap timeout (no browser window) | Ensure GUI/X11 available; try increasing FT_BOOTSTRAP_TIMEOUT_SECONDS |
| state.json invalid JSON after bootstrap | Playwright crashed; check logs in bootstrap.stderr.log |
| CI fails with AUTH_STATE_REUSE_FAILED | State expired; re-bootstrap and update GitHub secret (see "Rotate the CI secret safely") |
| CI says state not installed | FT_AUTH_STATE_JSON_B64 secret missing or empty |
| Pre-flight or post-flight guard fails | Git contamination or artifact leak; check /tmp/pw_state_guard_* evidence |

## References

- Playwright docs: https://playwright.dev/docs/auth
- Atlassian SSO: Check your instance's authentication policy

