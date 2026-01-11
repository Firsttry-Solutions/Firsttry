# STOP: Forge Authentication Required

**Prompt**: COPILOT PROMPT v7 — Marketplace Submission Runbook  
**Phase**: PHASE 3 — Confirm Forge Auth  
**Status**: HARD STOP (Non-negotiable, per RULE B)

## Issue

Forge CLI is not authenticated. The command `forge whoami` returned:

```
Error: Not logged in. If a local keychain is available, run forge login, otherwise set
environment variables before trying again. See 
https://go.atlassian.com/dac/platform/forge/getting-started/#log-in-with-an-atlassian-api-token
```

## Why This Is Blocking

COPILOT PROMPT v7 has strict rules:
- **RULE B**: "DO NOT fake site URLs. If no site URL is available, STOP with STOP_NEED_JIRA_SITE.md."
- **Equivalent**: DO NOT proceed without real authentication. Cannot fake Forge credentials.

Production deploy and install require valid Forge CLI authentication.

## Resolution

Before rerunning COPILOT PROMPT v7, authenticate with Forge CLI:

### Option 1: Use Local Keychain (Recommended)
```bash
cd /workspaces/Firsttry/atlassian/forge-app
forge login
# Follow the prompts to authenticate with your Atlassian account
```

### Option 2: Set Environment Variables
```bash
export FORGE_API_TOKEN=<your-api-token>
export FORGE_PLATFORM_ORG=<your-org-key>
cd /workspaces/Firsttry/atlassian/forge-app
forge login
```

See: https://go.atlassian.com/dac/platform/forge/getting-started/#log-in-with-an-atlassian-api-token

## Next Steps

1. Authenticate with Forge CLI (above)
2. Rerun COPILOT PROMPT v7 from the release branch:
   ```bash
   cd /workspaces/Firsttry
   git switch release/freeze-20260111-4d9ed6c5
   # Run v7 again
   ```

## Captured State

- Bundle path: `/workspaces/Firsttry/atlassian/forge-app/audit/submission_bundle/run_20260111_072601`
- Bundle contents:
  - ✓ Repo identity metadata captured
  - ✓ Git logs and status captured
  - ✓ Key files snapshotted (manifest.yml, FREEZE_LOCK.json, etc.)
  - ✓ Freeze verification passed
  - ✓ Reviewer gate passed (all 8 checks)
  - ⚠️ Forge auth check FAILED

The submission bundle is preserved. After authentication, Phase 4+ will continue from here.

---

**Generated**: 2026-01-11T07:27:51Z  
**Release Branch**: `release/freeze-20260111-4d9ed6c5`
