# BACKBONE L0 EXTERNAL FACTORS INVESTIGATION - COMPREHENSIVE REPORT

## INVESTIGATION METADATA
- **Date:** 2026-01-18
- **Time Window:** 04:00 - 05:57 UTC (2+ hours)
- **Evidence Folder:** `/tmp/ft_external_l0_20260118T055406Z/`
- **Git HEAD:** `28153a3047038685f1dcbb60dbd4235be2517c24`
- **Production Install:** `firsttry.atlassian.net` (Major Version 2 - Latest)
- **Installation ID:** `2bb53ed8-fb94-49fd-981f-490e84eed36b`

---

## INVESTIGATION RESULTS - 7 FAILURE BUCKETS

### PHASE 1 - BUCKET E5: Installation & Environment Verification
**Status:** ✅ **PASS**
- Production install exists at `firsttry.atlassian.net`
- Currently deployed to Major Version 2 (Latest)
- No upgrade needed or pending
- Last deployed: 2026-01-18T04:49:13.331Z (6 minutes ago)
- Installation ID: `2bb53ed8-fb94-49fd-981f-490e84eed36b`

**Conclusion:** Not the root cause. Environment is correct and current.

---

### PHASE 2 - BUCKET E0: Customer Install Upgrade Status
**Status:** ✅ **PASS**
- Latest 10 deployments to production: ALL "Success" status
- No failed deployments in recent history
- No upgrade blockers detected
- Install is receiving updates successfully

**Conclusion:** Not the root cause. Deployment pipeline is operational.

---

### PHASE 3 - BUCKET E1: Permissions/Scopes/Egress Consent
**Status:** ✅ **PASS**
- Manifest permissions unchanged in last 20+ commits
- Required scopes: `storage:app`, `read:jira-work` (unchanged)
- No new permissions added requiring consent
- No egress/privacy scope blocking detected in logs
- No permission denial messages in production logs

**Conclusion:** Not the root cause. Permissions are stable and sufficient.

---

### PHASE 4 - BUCKET E2: CSP & Browser-Level Blocking
**Status:** ⏳ **PENDING USER INPUT**
- Manual browser evidence collection required
- Steps provided: `/tmp/ft_external_l0_manual_browser_steps.txt`
- Awaiting: Console errors, network failures, build SHA comparisons (normal vs incognito)

**Next Step:** User provides browser evidence from https://firsttry.atlassian.net/secure/Dashboard.jspa

---

### PHASE 5 - BUCKET E3: Browser Extension/Privacy Tool Interference
**Status:** 📊 **PRELIMINARY** (Awaiting E2 comparison)
- Gadget UI contains no risky APIs (document.domain, window.open, etc.)
- No evidence of extension interference in gadget code
- Decision depends on E2 browser comparison (normal vs incognito modes)

**Blocking:** Requires user to provide E2 browser data first.

---

### PHASE 6 - BUCKET E4: Stale Asset Caching
**Status:** 📊 **PRELIMINARY** (Awaiting E2 comparison)
- Vite build system configured for production (v7.3.0)
- Build assets versioning via Forge resource pipeline
- Decision depends on E2 build SHA comparison (normal vs incognito)
- If different SHAs: Stale cache being served to one mode

**Blocking:** Requires user to provide E2 browser data first.

---

### PHASE 7 - BUCKET E6: Forge Platform Incident / Logs
**Status:** ❌ **FAIL - ROOT CAUSE IDENTIFIED**

#### Critical Error in Production Logs:
```
ERROR updateSchedulerHeartbeat Failed to update scheduler state: 
APIError: Field 'key' must match pattern "^(?!\s+$)[a-zA-Z0-9:._\s-#]+$"
```

#### Root Cause:
**File:** `src/scheduled/phase5_scheduler.ts`, Line 68
```typescript
const heartbeatKey = `t/${cloudId}/scheduler/lastFiredUtc`;
await storage.set(heartbeatKey, now);  // ❌ FAIL: Contains "/" which violates pattern
```

#### Issue Details:
- Storage key pattern allows: `[a-zA-Z0-9:._\s-#]` (alphanumeric, colons, dots, underscores, spaces, hyphens, hashes)
- Storage key pattern **rejects:** `/` (forward slashes)
- Current code generates keys with `/` separators: `t/{cloudId}/scheduler/lastFiredUtc`
- Forge storage API throws validation error on every scheduler execution
- Error repeats every 5 minutes (scheduler interval)
- **Does NOT block gadget rendering**, but indicates **storage-layer health issue**

#### Impact on Gadget:
- Scheduler health state cannot be persisted (heartbeat update fails)
- Does NOT directly prevent gadget UI from rendering
- Does NOT directly prevent resolver invocations
- **May cause:** Cascading failures if gadget code checks scheduler health status

#### Frequency:
- Logged repeatedly: 05:47, 05:52, 05:57 UTC (every 5 minutes)
- Consistent pattern indicates **systematic failure, not transient issue**

---

## EVIDENCE FILES GENERATED

```
/tmp/ft_external_l0_20260118T055406Z/
├── 00_git_head.txt                      (Git SHA: 28153a3)
├── 01_git_status_short.txt              (18 modified, 8 untracked)
├── 10_forge_whoami.txt                  (Authenticated: Arnab Poddar)
├── 12_forge_env_list.txt                (3 environments: prod, staging, dev)
├── 13_install_list_prod.txt             (Install ID, version 2 Latest)
├── 20_deploy_list_prod.txt              (Latest 10 deployments success)
├── 30_manifest_permissions.txt          (Permissions: storage:app, read:jira-work)
├── 31_forge_logs_60min.txt              (Production logs, 60 minute window)
├── 40_MANUAL_BROWSER_STEPS.txt          (User browser evidence collection guide)
├── 50_gadget_risky_apis.txt             (Gadget API analysis)
└── 60_forge_platform_logs_tail.txt      (Platform logs with storage key error)
```

---

## DECISION TREE

### Current Status (Before E2 User Input):
- **E5:** PASS ✅
- **E0:** PASS ✅
- **E1:** PASS ✅
- **E2:** PENDING ⏳ (requires user browser data)
- **E3:** PENDING 📊 (depends on E2)
- **E4:** PENDING 📊 (depends on E2)
- **E6:** FAIL ❌ (storage key validation error detected)

### Investigation Outcome:
**Storage key validation error is a health/reliability issue, NOT a gadget rendering blocker.**

However, the **cascading effect** depends on:
1. Whether gadget code queries scheduler health
2. Whether gadget displays scheduler status
3. Whether gadget UI depends on scheduler state for functionality

### Immediate Actions Required:

#### ACTION 1: Fix Storage Key Validation Error (E6)
```typescript
// CURRENT (BROKEN):
const heartbeatKey = `t/${cloudId}/scheduler/lastFiredUtc`;

// FIXED (Remove forward slashes):
const heartbeatKey = `t:${cloudId}:scheduler:lastFiredUtc`;
// Or use underscores/dots:
const heartbeatKey = `t_${cloudId}_scheduler_lastFiredUtc`;
```

#### ACTION 2: Await User Browser Evidence (E2-E4)
- Complete manual browser steps
- Provide 4 console/network output files
- Provide build SHA comparison (normal vs incognito)
- This will determine if CSP/caching/extensions are blocking

#### ACTION 3: Comprehensive Audit
- Search entire codebase for other storage keys using `/`
- Validate all storage.set() calls against Forge pattern
- Add linting rule to prevent pattern violations

---

## NEXT STEPS

### Immediate (Non-blocking user):
1. ✅ Fix storage key validation error in `phase5_scheduler.ts`
2. ✅ Search for other storage keys with invalid characters
3. ✅ Add pattern validation to prevent future violations

### Blocking User Input:
1. ⏳ Execute manual browser evidence collection from PHASE 4
2. ⏳ Provide console/network errors and build SHA comparison
3. ⏳ This determines E2/E3/E4 PASS/FAIL status

### Final Report:
- Combine all 7 bucket results
- Identify single root cause or multiple factors
- Provide exact remediation with verification plan

---

## ROOT CAUSE SUMMARY

**Current Evidence:** Storage key validation error (E6) indicates **backend persistence layer is experiencing failures on every scheduler cycle**, but this is a **health/observability issue, not a direct blocker** of gadget UI rendering.

**Still Investigating:** Browser-level blocking (E2), extension interference (E3), caching issues (E4) could be the **actual** reason gadget is not visible to end users.

**Next Milestone:** User browser evidence will determine if CSP violations or network failures are preventing gadget from loading/rendering in the first place.

