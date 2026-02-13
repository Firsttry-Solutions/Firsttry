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

No time estimates for token expiration; check manually when CI fails unexpectedly.

## Never Commit state.json

`.gitignore` should include:
```
tests/playwright/.auth/
```

Verify with: `git status tests/playwright/.auth/state.json` — should show "not tracked".

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Bootstrap timeout (no browser window) | Ensure GUI/X11 available; try increasing FT_BOOTSTRAP_TIMEOUT_SECONDS |
| state.json invalid JSON after bootstrap | Playwright crashed; check logs in bootstrap.stderr.log |
| CI fails with AUTH_STATE_REUSE_FAILED | State expired; re-bootstrap and update GitHub secret |
| CI says state not installed | FT_AUTH_STATE_JSON_B64 secret missing or empty |

## References

- Playwright docs: https://playwright.dev/docs/auth
- Atlassian SSO: Check your instance's authentication policy
