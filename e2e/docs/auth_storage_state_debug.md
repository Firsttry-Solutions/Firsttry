# Authentication & StorageState Debugging Guide

This guide explains how to diagnose and resolve authentication failures in `prod_dashboard_green.spec.ts` using the Atlassian Jira environment.

## Overview

The test `prod_dashboard_green.spec.ts` requires valid Atlassian authentication to load the Jira dashboard and locate the gadget iframe. Failures often occur due to:

1. **Missing or expired cookies** in `storageState.json`
2. **Atlassian auth redirects** that bypass top-level URL checks
3. **Auth challenge policies** that require re-authentication even with valid cookies

This debugging suite provides tools to:
- **Prove** whether `storageState.json` contains relevant cookies
- **Regenerate** `storageState.json` using Xvfb (headless display server)
- **Capture** evidence when authentication fails

## Quick Start

### 1. Prove Current StorageState

Check if your `.auth/storageState.json` has valid cookies:

```bash
cd /workspaces/Firsttry
npm run prove:storage
```

This will output a summary showing cookie counts per domain (no values printed):
- `firsttry.atlassian.net` - Jira dashboard cookies
- `id.atlassian.com` - Atlassian identity provider
- `auth.atlassian.com` - Atlassian auth service

**Example output:**
```
================================================================================
COOKIE SUMMARY (ANONYMIZED)
================================================================================
Timestamp: 2026-01-21T12:00:00.000Z
StorageState: .auth/storageState.json (2048 bytes)
Total cookies: 12

Domain Breakdown:
  firsttry_atlassian_net: 4 cookies
    Names: JSESSIONID, atlassian.xsrf.token, ASPSESSIONID, ...
  id_atlassian_com: 3 cookies [HAS EXPIRED]
    Names: idp_session, ...
  auth_atlassian_com: 2 cookies
    Names: auth_token, ...
  atlassian_net_root: 3 cookies
    Names: analytics_tracking_id, ...
================================================================================
```

**Interpretation:**
- If `Total cookies: 0`, the file is empty or missing relevant cookies → regenerate
- If `[HAS EXPIRED]` appears, some cookies have expiration times in the past → regenerate
- If domain counts are low, especially `firsttry_atlassian_net`, → likely missing session cookies

### 2. Regenerate StorageState (Xvfb)

To generate a fresh `storageState.json` with valid Atlassian session:

```bash
cd /workspaces/Firsttry
npm run auth:login:xvfb
```

This script:
1. Ensures `.auth/` directory exists
2. Deletes any existing `storageState.json` (clean start)
3. Checks for Xvfb availability (virtual display server for headless environments)
4. Runs the Playwright login flow under `xvfb-run` to capture cookies
5. Verifies that `storageState.json` was created and is non-empty
6. Runs `prove:storage` to validate the new file

**If Xvfb is missing:**
```
ERROR: Xvfb not found. Install with:
  sudo apt-get update && sudo apt-get install -y xvfb
```

Install and retry:
```bash
sudo apt-get update && sudo apt-get install -y xvfb
npm run auth:login:xvfb
```

### 3. Run Test with Generated StorageState

Once `storageState.json` is regenerated:

```bash
cd /workspaces/Firsttry/e2e
JIRA_DASHBOARD_URL="https://firsttry.atlassian.net/jira/dashboards/10102" \
STORAGE_STATE=".auth/storageState.json" \
npx playwright test tests/prod_dashboard_green.spec.ts --reporter=line
```

### 4. Inspect Failure Evidence

When the test fails, it generates `storage_state_proof.json` artifact with:
- Cookie counts per domain
- File size and modification time
- Whether any cookies are expired

Check the artifact in the test output directory (typically `/tmp/prod_dashboard_green_<timestamp>/`):

```bash
# Find latest test run
DIR=$(ls -td /tmp/prod_dashboard_green_* | head -1)
cat "$DIR/storage_state_proof.json" | jq '.'
```

**Example failure artifact:**
```json
{
  "ts": "2026-01-21T12:05:00.000Z",
  "mode": "loaded",
  "env_storage_state": ".auth/storageState.json",
  "fileStat": {
    "sizeBytes": 2048,
    "mtimeIso": "2026-01-21T12:01:00.000Z"
  },
  "totalCookies": 12,
  "cookieSummary": {
    "firsttry_atlassian_net": {
      "count": 4,
      "names": ["JSESSIONID", "atlassian.xsrf.token", ...],
      "hasExpired": false,
      "minExpires": 1706089200,
      "maxExpires": 1706175600
    },
    "id_atlassian_com": { "count": 0, ... },
    "auth_atlassian_com": { "count": 2, ... },
    "atlassian_net_root": { "count": 3, ... }
  }
}
```

## Validation Commands

### VALIDATION 1: Prove Current StorageState

```bash
cd /workspaces/Firsttry
STORAGE_STATE=".auth/storageState.json" node e2e/scripts/prove_storage_state.mjs
```

Expected output: Cookie counts and expiration status

### VALIDATION 2: Regenerate StorageState

```bash
cd /workspaces/Firsttry
node e2e/scripts/auth_login_xvfb.mjs
```

Expected output: Success message with file size and proof

### VALIDATION 3: Test __NONE__ Mode (No Auth)

```bash
cd /workspaces/Firsttry/e2e
JIRA_DASHBOARD_URL="https://firsttry.atlassian.net/jira/dashboards/10102" \
STORAGE_STATE="__NONE__" \
npx playwright test tests/prod_dashboard_green.spec.ts -g "should load gadget iframe" --reporter=line
```

Expected result: Test fails with `AUTH_REQUIRED_OR_CAPTCHA_BLOCK` and generates `storage_state_proof.json` showing `mode: "__NONE__"`

### VALIDATION 4: Test with Auth Mode

```bash
cd /workspaces/Firsttry/e2e
JIRA_DASHBOARD_URL="https://firsttry.atlassian.net/jira/dashboards/10102" \
STORAGE_STATE=".auth/storageState.json" \
npx playwright test tests/prod_dashboard_green.spec.ts -g "should load gadget iframe" --reporter=line
```

Expected result: Test either passes OR fails with detailed storage state evidence

## Understanding Cookie Counts

### Healthy StorageState
- `firsttry_atlassian_net`: **3-5+ cookies** (session, XSRF token, etc.)
- `id_atlassian_com`: **1-2 cookies** (idp session, typically expires in days/weeks)
- `auth_atlassian_com`: **1-2 cookies** (auth tokens)
- Total: **5-10+ cookies**
- `hasExpired`: **false** (no expired cookies)

### Unhealthy StorageState
- Any domain with **0 cookies**
- `hasExpired: true` (one or more cookies are past expiration)
- Total: **< 3 cookies**
- File size: **< 500 bytes**

## Atlassian Challenge Policy

Atlassian may enforce **auth challenge policies** where:
1. Browser presents valid cookies
2. Jira shell loads (test passes locally)
3. But backend rejects the session and redirects to `/login`
4. Or redirects to `id.atlassian.com/authorize`

This can happen even with valid `storageState.json` if:
- Cookies are for a different Jira instance
- Session token has been invalidated server-side
- IP address changed (if strict IP binding is enabled)
- User account permissions changed

**Solution:**
1. Regenerate `storageState.json` with `npm run auth:login:xvfb`
2. Ensure you're using the correct `JIRA_DASHBOARD_URL`
3. Verify Atlassian account has access to the dashboard
4. Check if enterprise auth policies require specific headers/tokens

## Debugging Workflow

### If test fails with `AUTH_REQUIRED_OR_CAPTCHA_BLOCK`:

1. **Check current storageState:**
   ```bash
   npm run prove:storage
   ```
   
2. **If cookie counts are low or expired:**
   ```bash
   npm run auth:login:xvfb
   ```
   
3. **If still failing, check failure artifact:**
   ```bash
   DIR=$(ls -td /tmp/prod_dashboard_green_* | head -1)
   cat "$DIR/storage_state_proof.json" | jq '.cookieSummary'
   ```
   
4. **If cookies exist but test still fails:**
   - May be Atlassian auth challenge policy (see above)
   - Check network requests in artifact: `$DIR/request_failed.json`, `$DIR/response_errors.json`
   - Verify correct `JIRA_DASHBOARD_URL` is being used

### If test fails with `JIRA_SHELL_NOT_FOUND`:

1. Check `auth_check.json` for actual reason
2. If reason is `shell_never_appeared_within_timeout`:
   - Page loaded but Jira shell selectors not found
   - Check `page_snapshot.html` to see what was rendered
   - May indicate JavaScript loading issue or wrong dashboard URL

## File Locations

- **StorageState:** `.auth/storageState.json`
- **Proof script:** `e2e/scripts/prove_storage_state.mjs`
- **Login script:** `e2e/scripts/auth_login_xvfb.mjs`
- **Test:** `e2e/tests/prod_dashboard_green.spec.ts`
- **Test artifacts:** `/tmp/prod_dashboard_green_<timestamp>/`
- **This guide:** `e2e/docs/auth_storage_state_debug.md`

## Troubleshooting

### "STORAGE_STATE file not found"
**Cause:** `.auth/storageState.json` doesn't exist  
**Fix:** Run `npm run auth:login:xvfb` to regenerate

### "Xvfb not found"
**Cause:** Virtual display server not installed  
**Fix:** Run `sudo apt-get update && sudo apt-get install -y xvfb`

### "auth_login.mjs not found"
**Cause:** Script is missing or in wrong location  
**Fix:** Ensure `e2e/scripts/auth_login.mjs` exists and is executable

### Test times out waiting for shell
**Cause:** Jira page not loading, shell selectors not matching  
**Fix:**
1. Check `page_snapshot.html` to see actual page content
2. Verify `JIRA_DASHBOARD_URL` is correct and accessible
3. Check network failures: `request_failed.json`, `response_errors.json`

### Cookies count as 0 in proof
**Cause:** StorageState file is empty or malformed  
**Fix:** Run `npm run auth:login:xvfb` to regenerate from scratch

## Exit Codes

### prove_storage_state.mjs
- `0` - Success
- `2` - STORAGE_STATE missing
- `3` - Playwright launch failure

### auth_login_xvfb.mjs
- `0` - Success
- `1` - auth_login.mjs not found
- `4` - Xvfb not installed
- `5` - storageState.json not created after login
- `6` - auth_login.mjs failed or non-zero exit code
