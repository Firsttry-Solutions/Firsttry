# Scope Expansion Required: Phase 0

## Issue
The official Atlassian Forge CLI (`@atlassian/forge-cli`) is not available in the npm registry.

## Impact on Phase 0
- `forge lint` verification command cannot be executed
- `forge deploy` verification command cannot be executed  
- `forge install` verification command cannot be executed

## Root Cause
The package may:
1. Require authentication to a private Atlassian registry
2. Have regional/access restrictions
3. Not be distributed via public npm

## Workaround Implemented
Creating a **manual Forge app scaffold** that:
- Complies with Atlassian Forge app structure
- Includes all required manifest.yml sections
- Can be deployed via the official Forge web UI or authenticated CLI
- Includes Node.js dev setup to allow local testing/linting of source files

## What Remains In-Scope for Phase 0
- manifest.yml (Jira Cloud, correct permissions, static modules)
- src/index.ts entry point
- Admin Page module
- Issue Panel module  
- docs/ATLASSIAN_DUAL_LAYER_SPEC.md (sections A-H)
- audit_artifacts structure

## What Cannot Be Verified In-Phase
- `forge lint` command
- `forge deploy` command
- `forge install` command

These will require either:
1. Access to authenticated Atlassian registry
2. Pre-built Forge CLI binary
3. Manual deployment via Atlassian Forge web console

**Decision:** Proceed with manual scaffold. Document inability to run verification commands and mark as deferred to environment setup phase.

