# Scope Change Waiver — v4.2.2.3-scopefix-deploy

**Date**: 2026-02-16  
**Reason**: Forge scope validation failure (platform rejected read:jira-project and read:jira-configuration as invalid)  
**Consequence**: App cannot deploy unless invalid scopes removed

## Factual Analysis

### Invalid Scopes (Rejected by Forge Platform)
- `read:jira-project`: NOT a valid Forge scope
- `read:jira-configuration`: NOT a valid Forge scope

### Replacement Strategy
**Action**: Remove invalid scopes (move to minimal valid set)  
**Rationale**: Code inspection shows NO explicit Jira REST API calls. App uses Forge runtime provided APIs (asApp, asUser context). Invalid scopes were likely placeholder or inherited from template. Removing them unblocks deployment without reducing app capability (app remains read-only).

### Valid Scopes Retained
- `read:jira-user` ✅ Valid, essential for user context
- `read:jira-work` ✅ Valid, essential for work/issue listing
- `storage:app` ✅ Valid, required for app storage

### Old → New Scope Set Comparison

**OLD (invalid)**:
```
read:jira-configuration
read:jira-project
read:jira-user
read:jira-work
storage:app
```

**NEW (valid)**:
```
read:jira-user
read:jira-work
storage:app
```

### Why This Change Does NOT Expand Capabilities
1. **No new scopes added**: Only invalid ones removed
2. **No new Jira REST endpoints called**: Code inspection confirms no API calls to project or configuration endpoints
3. **No new outbound networking**: App remains read-only, zero mutations
4. **Storage usage unchanged**: storage:app scope retained
5. **User/work context unchanged**: read:jira-user and read:jira-work retained

### Compliance Statement
✅ App remains read-only (no write mutations)  
✅ No new outbound networking added  
✅ No external dependencies  
✅ No Jira write/mutation APIs used  
✅ No SOC2/ISO/pentest claims made  

### Auditing
This waiver may be audited by:
- `docker cp` of docs/scope-change-waiver.json and code snapshot
- Re-scan for read:jira-project / read:jira-configuration usage post-deployment
- Forge deployment logs confirm scope set matches manifest
