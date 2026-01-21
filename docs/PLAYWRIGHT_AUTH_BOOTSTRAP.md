# Playwright Auth Bootstrap

## One-Time Setup Required

The diagnostic runner requires authenticated Jira storage state. This file must be created once before running `diag:dashboard`.

### Generate Storage State (Headed Mode with xvfb-run)

Run this command EXACTLY ONCE to generate `/workspaces/Firsttry/e2e/.auth/storageState.json`:

```bash
xvfb-run --auto-servernum --server-args='-screen 0 1280x800x24' node /workspaces/Firsttry/e2e/scripts/auth_login.mjs
```

This command will:
1. Launch a virtual display (xvfb)
2. Open Jira in a headed browser
3. Wait for you to manually log in via Jira's login form
4. Capture cookies and session state
5. Save to `/workspaces/Firsttry/e2e/.auth/storageState.json`

### Prerequisites

- Valid Jira account credentials
- Network access to your Jira instance
- `auth_login.mjs` script exists in `e2e/scripts/`

### After Bootstrap

Once `storageState.json` exists, you can run the diagnostic runner in headless mode:

```bash
export JIRA_DASHBOARD_URL="https://your-site.atlassian.net/secure/Dashboard.jspa?selectedProjectKey=YOUR_PROJECT"
export STORAGE_STATE="/workspaces/Firsttry/e2e/.auth/storageState.json"
xvfb-run --auto-servernum --server-args='-screen 0 1280x800x24' npm run diag:dashboard
```

## Troubleshooting

**storageState.json exists but authentication fails?**
- Credentials may have expired
- Re-run the bootstrap command above
- Check network access to Jira instance

**xvfb not available?**
- Install: `apt-get install xvfb`
- Or run headed mode on machine with display: `HEADLESS=0 node e2e/scripts/phase5_dashboard_diagnose.mjs`
