# Quick Start: Auth Storage State Debugging

## 🎯 Problem
`prod_dashboard_green.spec.ts` fails due to Atlassian auth redirects. Need to:
1. Prove whether storageState has valid cookies
2. Regenerate storageState deterministically
3. Capture evidence when auth fails

## ✅ Solution (3 Commands)

### 1. Validate Your Current StorageState
```bash
npm run prove:storage
# Defaults to: /workspaces/Firsttry/.auth/storageState.json
# Or specify explicitly:
STORAGE_STATE="/workspaces/Firsttry/.auth/storageState.json" npm run prove:storage
```
**Output**: 
- JSON proof at `/tmp/storage_state_proof.json`
- Human summary showing cookie counts by domain
- Exit code `0` = success, `2` = file not found

### 2. Run Preflight Auth Check (Before Test)
```bash
npm run auth:preflight
# Navigates to dashboard and verifies Jira shell loads
# Exit code: 0 (ok), 10 (redirect), 11 (no shell), 12 (missing)
```

### 3. Regenerate StorageState (Xvfb-Aware)
```bash
npm run auth:login:xvfb
```
**What it does**:
- Creates `/workspaces/Firsttry/.auth` directory
- Runs interactive login under Xvfb display server
- Verifies Jira shell loads BEFORE saving (not just any file)
- Validates cookies exist after creation
- Works in headless CI environments

### 4. Run Test & Capture Proof
```bash
# With manual auth (storageState loaded)
cd /workspaces/Firsttry/e2e
JIRA_DASHBOARD_URL="https://firsttry.atlassian.net/jira/dashboards/10102" \
STORAGE_STATE="/workspaces/Firsttry/.auth/storageState.json" \
  npx playwright test tests/prod_dashboard_green.spec.ts

# Without auth (test expected to fail, captures proof anyway)
STORAGE_STATE="__NONE__" \
  npx playwright test tests/prod_dashboard_green.spec.ts
```

**Artifacts created** (in test-results/):
- `storage_state_proof.json` - Anonymized cookie summary
- `screenshot_*.png` - Test failure screenshot
- `console_records.json` - Browser console logs

## 📊 Reading storage_state_proof.json

```json
{
  "ts": "2026-01-21T12:24:14.996Z",                          // When proof was collected
  "mode": "loaded",                                           // "loaded" | "__NONE__" | "missing"
  "env_storage_state": "/workspaces/Firsttry/.auth/storageState.json",
  "resolvedStorageStatePath": "/workspaces/Firsttry/.auth/storageState.json",
  "repoRoot": "/workspaces/Firsttry",
  "cwd": "/workspaces/Firsttry/e2e",
  "fileStat": {
    "sizeBytes": 2957,                                        // File size bytes
    "mtimeIso": "2026-01-21T06:07:16.210Z"                    // Last modified
  },
  "totalCookies": 6,                                          // Total cookies from file
  "cookieSummary": {
    "firsttry_atlassian_net": {
      "count": 6,                                             // Number of cookies for domain
      "names": ["ajs_anonymous_id", "atlassian.xsrf.token", ...],
      "hasExpired": false,                                    // Any cookie expired?
      "minExpires": 1771567112,                               // Unix timestamp (soonest)
      "maxExpires": 1801916404.428949                         // Unix timestamp (latest)
    },
    "id_atlassian_com": {"count": 0, "names": [], ...},
    "auth_atlassian_com": {"count": 0, "names": [], ...},
    "other": {"count": 0, "names": [], ...}
  }
}
```

### ✅ Healthy Indicators
- `mode`: "loaded" (not "__NONE__" or "missing")
- `totalCookies`: > 4 (should have JSESSIONID, xsrf token, etc.)
- `hasExpired`: false (cookies not expired)
- `minExpires`: Far in future (>= 7 days)
- `resolvedStorageStatePath`: Points to `/workspaces/Firsttry/.auth/storageState.json`

### ⚠️ Warning Indicators
- `totalCookies`: 0 or < 4 (missing auth cookies)
- `hasExpired`: true (cookies expired)
- `minExpires`: Close to now (expires soon)
- `mode`: "__NONE__" (no storage state loaded)
- Different `resolvedStorageStatePath`: Using wrong file

## 🔧 Troubleshooting

### Problem: "STORAGE_STATE_INVALID: storage state file missing"
```bash
# Regenerate it:
npm run auth:login:xvfb
```

### Problem: "Preflight check FAILED: Redirected to auth domain"
```bash
# Storage state cookies are likely expired
# Regenerate:
npm run auth:login:xvfb

# Then verify with preflight:
npm run auth:preflight
```

### Problem: "Xvfb not found"
```bash
# Install on Linux:
sudo apt-get update && sudo apt-get install -y xvfb

# Or regenerate manually in headed mode:
cd /workspaces/Firsttry/e2e
node scripts/auth_login.mjs
```

### Problem: Test still fails after valid storageState
```bash
# 1. Run preflight check first:
npm run auth:preflight

# If preflight passes but test fails, check the artifacts:
cat test-results/prod_dashboard_green-*/storage_state_proof.json | jq '.'

# Look for:
# - resolvedStorageStatePath: Should be /workspaces/Firsttry/.auth/storageState.json
# - totalCookies: Should be > 4
# - hasExpired: Should be false
# - Any cookies in firsttry_atlassian_net domain

# If cookies exist but test fails, it's likely:
# 1. Cookies are expired (hasExpired: true) → Regenerate
# 2. Jira site is different (check JIRA_DASHBOARD_URL)
# 3. Atlassian Challenge Policy blocking (check captcha)
```

## 🔐 Path Resolution Rules

All scripts now use **ABSOLUTE PATHS** (no relative paths).
Path resolution is unified in: `e2e/scripts/storage_state_paths.mjs`

- Default canonical location: `/workspaces/Firsttry/.auth/storageState.json`
- Relative paths in STORAGE_STATE env var are resolved against `/workspaces/Firsttry` (repo root, NOT cwd)
- Scripts log the resolved path for debugging
- Location `/workspaces/Firsttry/e2e/.auth` is rejected with clear error

Examples:
```bash
# All of these resolve to the same file:
STORAGE_STATE="/workspaces/Firsttry/.auth/storageState.json" npm run prove:storage
STORAGE_STATE=".auth/storageState.json" npm run prove:storage  # Relative (resolved to repo root)
npm run prove:storage  # Uses default (canonical)
```

## 📚 Full Documentation
See [e2e/docs/auth_storage_state_debug.md](./e2e/docs/auth_storage_state_debug.md) for:
- Advanced troubleshooting
- Exit codes reference
- Atlassian Challenge Policy explanation
- How Jira shell verification prevents auth bypasses

## 🎓 How It Works

### Pre-Flight Auth Check
1. Loads storageState.json
2. Launches headless Chromium with that storage
3. Navigates to Jira dashboard (60s timeout)
4. Checks NOT redirected to id.atlassian.com / auth.atlassian.com
5. Checks Jira shell selectors present (ak-main-content, etc.)
6. Returns exit code: 0 (ok), 10 (redirect), 11 (no shell), 12 (missing)

### Auth Login with Xvfb
1. Checks for Xvfb (virtual display server)
2. Cleans old storageState (force fresh login)
3. Runs interactive auth_login.mjs under `xvfb-run -a`
4. auth_login.mjs verifies Jira shell BEFORE saving
5. auth_login_xvfb validates cookies exist after creation
6. Returns exit code 0 (success) or 5/6 (failure)

### Path Resolution in Test
1. Resolves STORAGE_STATE relative to `/workspaces/Firsttry`
2. Validates file exists, has content, JSON valid
3. Parses cookies array before using
4. Throws STORAGE_STATE_INVALID if missing/empty/invalid
5. Logs resolved path for debugging

---

**Key Principle**: 🔐 **Never print cookie values** - Only names, counts, domains, expiration status

