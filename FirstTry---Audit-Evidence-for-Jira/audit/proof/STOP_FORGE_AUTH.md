# STOP: Forge CLI Not Authenticated

## Problem
The Forge CLI is not authenticated. Proceeding without authentication will cause PHASE 4 (production deploy/install) to fail.

## Current Status
```
Error: Not logged in. If a local keychain is available, run forge login, otherwise set environment variables before trying again.
```

## Required Action
Choose one of the following:

### Option A: Local Authentication (Interactive)
```bash
cd /workspaces/Firsttry
forge login
```

### Option B: Environment Variable Authentication
Set the following environment variables before re-running the gate:
- `FORGE_EMAIL`: Your Atlassian email
- `FORGE_API_TOKEN`: Your Atlassian API token (obtain from https://id.atlassian.com/manage-profile/security/api-tokens)

Example:
```bash
export FORGE_EMAIL="your-email@example.com"
export FORGE_API_TOKEN="your-api-token"
```

## Next Steps
After authentication, re-run the readiness gate:
```bash
cd /workspaces/Firsttry/atlassian/forge-app
npm run reviewer:gate
```

## Note
This is a hard requirement. The reviewer-ready gate cannot proceed without valid Forge authentication for production deployment proof.
