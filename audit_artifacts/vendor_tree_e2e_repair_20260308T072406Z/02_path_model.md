# Path Model — Vendor-Tree E2E

## Canonical Root Resolution

Both `create_storage_state.sh` and `run_reviewer_e2e_strict.sh` now use:

```
SCRIPT_DIR = $(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
           = /workspaces/Firsttry/FirstTry---Audit-Evidence-for-Jira/tools/reviewer_e2e
```

### create_storage_state.sh

```
SCRIPT_DIR = .../FirstTry---Audit-Evidence-for-Jira/tools/reviewer_e2e
VENDOR_ROOT = $(cd "$SCRIPT_DIR/../.." && pwd)
            = /workspaces/Firsttry/FirstTry---Audit-Evidence-for-Jira
AUTH_DIR    = $VENDOR_ROOT/tests/playwright/.auth
STORAGE_STATE = $AUTH_DIR/storageState.json
             = /workspaces/Firsttry/FirstTry---Audit-Evidence-for-Jira/tests/playwright/.auth/storageState.json
```

### run_reviewer_e2e_strict.sh

```
SCRIPT_DIR = .../FirstTry---Audit-Evidence-for-Jira/tools/reviewer_e2e
REPO_ROOT  = $(cd "$SCRIPT_DIR/../.." && pwd)
           = /workspaces/Firsttry/FirstTry---Audit-Evidence-for-Jira
FORGE_APP  = $REPO_ROOT
           = /workspaces/Firsttry/FirstTry---Audit-Evidence-for-Jira
PLAYWRIGHT_STORAGE_STATE = $FORGE_APP/tests/playwright/.auth/storageState.json
                        = /workspaces/Firsttry/FirstTry---Audit-Evidence-for-Jira/tests/playwright/.auth/storageState.json
```

### playwright.reviewer.config.ts

```
STORAGE_STATE = process.env.PLAYWRIGHT_STORAGE_STATE
             || path.join(__dirname, 'tests/playwright/.auth/storageState.json')
             = /workspaces/Firsttry/FirstTry---Audit-Evidence-for-Jira/tests/playwright/.auth/storageState.json
```

## What Was Removed

| File | Old Line | Problem |
|------|----------|---------|
| create_storage_state.sh | `FORGE_APP="$REPO_ROOT/atlassian/forge-app"` | Constructed non-existent nested path |
| create_storage_state.sh | `AUTH_DIR="$FORGE_APP/tests/playwright/.auth"` | Inherited wrong base |
| create_storage_state.sh | `cd "$FORGE_APP"` | Changed directory into wrong tree |
| run_reviewer_e2e_strict.sh | `FORGE_APP="/workspaces/Firsttry/FirstTry---Audit-Evidence-for-Jira"` | Hardcoded absolute path (fragile) |

## What Was Added

| File | New Variable | Value |
|------|-------------|-------|
| create_storage_state.sh | `VENDOR_ROOT` | `$(cd "$SCRIPT_DIR/../.." && pwd)` |
| create_storage_state.sh | Printed INFO lines | Shows resolved paths explicitly |
| run_reviewer_e2e_strict.sh | `FORGE_APP="$REPO_ROOT"` | Derived from computed REPO_ROOT |
