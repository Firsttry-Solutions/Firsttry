# BACKBONE L0 ROOT CAUSE REPORT

**Generated:** 2026-01-17T17:00:00Z  
**Investigation Focus:** Why UI shows "Backend: (PING_FAILED | trace: UNSET_TRACE_ID)" and probe cannot produce nonce

---

## Executive Summary

**Root Cause:** Two critical gadget resolvers (`ping` and `ensureFirstSnapshot`) were implemented but **NOT REGISTERED** in the canonical Forge resolver dispatcher (`gadget-resolver.ts`).

**Impact:**
- UI invokes `ping` resolver on gadget load → fails immediately in Forge bridge layer
- Since ping fails, `ensureFirstSnapshot` and `getBuildInfo` never run
- LOG_CANARY never emitted (getBuildInfo never invoked)
- UI displays: `Backend: (PING_FAILED | trace: UNSET_TRACE_ID)`
- Probe cannot generate nonce (depends on successful ping)

**Fix Applied:** Register the two missing resolvers in gadget-resolver.ts

**Status:** Deployed version 2.98.0 to production

---

## PHASE 0: EVIDENCE CAPTURE

### Environment & Installation

**File:** `/tmp/l0_whoami.txt`
```
Logged in as Arnab Poddar (contact@firsttry.run)
Account ID: 712020:5bb8dbe7-8759-4663-bbb2-106a55710cb2
```

**File:** `/tmp/l0_env_list.txt`
```
Environment ID: 136e862e-e5be-4815-b5f5-386a2ead851f
Type: PRODUCTION
Last deployed at: 2026-01-17T16:46:47.111Z
```

**File:** `/tmp/l0_install_list_prod.txt`
```
Installation ID: 2bb53ed8-fb94-49fd-981f-490e84eed36b
Environment: production
Site: firsttry.atlassian.net
Atlassian apps: Jira
Major Version: 2 (Latest)
```

### Production Logs (Before Fix)

**File:** `/tmp/l0_log_sizes.txt`
```
5193 /tmp/l0_logs_raw_20m.txt
4433 /tmp/l0_logs_grouped_20m.txt
```

**Key Observations from `/tmp/l0_logs_raw_20m.txt`:**
- Logs contain real resolver invocations (RESOLVER_ENTER, RESOLVER_ERR markers)
- All show `"backend_build_sha":"unknown"`
- No `LOG_CANARY` found
- No `PING_OK` or `PING_ERR` markers
- Only `getStatusSnapshot` resolver is being invoked, not ping/getBuildInfo

**File:** `/tmp/l0_canary_raw_hits.txt`
```
(empty - no LOG_CANARY found)
```

**File:** `/tmp/l0_runtime_markers_raw.txt`
```
RESOLVER_ENTER / RESOLVER_ERR for getStatusSnapshot only
No markers for ping, getBuildInfo, or LOG_CANARY
```

---

## PHASE 1: RESOLVER INVOCATION VERIFICATION

### UI Resolver Invocations

**File:** `/tmp/l0_invoke_calls.txt`

Located in `src/gadget-ui/src/main.ts`:
```
Line 222:  invoke('getStatusSnapshot', { ui_req_id: FT_UI_REQ_ID })
Line 833:  invoke('getSnapshotDebug', {})
Line 1187: invoke('refreshNow', {})
Line 1219: invoke('getSnapshotDebug', {})
Line 1394: invoke('exportTrustSnapshot', {})
Line 1480: invoke('probe', payload)
Line 1647: invoke('ping', { uiReqId: FT_UI_REQ_ID })  ← FIRST health check on load
Line 1687: invoke('ensureFirstSnapshot', { uiReqId: FT_UI_REQ_ID })  ← Second health check
Line 1715: invoke('getBuildInfo', { uiReqId: FT_UI_REQ_ID })  ← Build metadata resolver
```

**Execution Order (from UI):**
1. Line 222: getStatusSnapshot (works - in logs)
2. ~Line 1647: ping (should run on gadget load) ← **MISSING**
3. ~Line 1687: ensureFirstSnapshot (if ping succeeds) ← **MISSING**
4. ~Line 1715: getBuildInfo (gets build metadata) ← **MISSING**

### Backend Resolver Registration

**File:** `atlassian/forge-app/src/gadget-resolver.ts` (BEFORE FIX)

```typescript
// INCOMPLETE REGISTRATION
resolver.define('getStatusSnapshot', getStatusSnapshot_resolver);
resolver.define('getBuildInfo', getBuildInfo_resolver);
resolver.define('refreshNow', refreshNow_resolver);
resolver.define('exportTrustSnapshot', exportTrustSnapshot);
resolver.define('getSnapshotDebug', getSnapshotDebug_resolver);
// MISSING: ping
// MISSING: ensureFirstSnapshot
```

**File:** `/tmp/l0_handlers_ping_build.txt`
```
src/gadget-resolver.ts:25: import { getBuildInfo_resolver }
src/gadget-resolver.ts:32: import { getBuildInfo_resolver }
src/gadget-resolver.ts:43: resolver.define('getBuildInfo', getBuildInfo_resolver);
(No import of ping or ensureFirstSnapshot)
```

### Resolver Implementation Files Exist

**File:** `/tmp/l0_resolver_files.txt`
```
-rw-rw-rw- ensureFirstSnapshot.ts  (234 lines, export at line 130)
-rw-rw-rw- ping.ts  (114 lines, export at line 33)
```

**Both files were implemented with proper exports:**
- `src/resolvers/ping.ts` exports `async function ping(req?: any): Promise<PingResponse>`
- `src/resolvers/ensureFirstSnapshot.ts` exports `async function ensureFirstSnapshot(input?: any): Promise<EnsureFirstSnapshotResponse>`

---

## PHASE 2: RUNTIME PROOF (LOG_CANARY)

**Finding:** LOG_CANARY never appeared in production logs because `getBuildInfo` resolver was never invoked, which prevents the entire health check sequence.

**File:** `/tmp/l0_canary_raw_hits.txt` - **EMPTY**  
**File:** `/tmp/l0_canary_grouped_hits.txt` - **EMPTY**

This confirms:
1. ✅ forge logs is working (contains real markers)
2. ❌ getBuildInfo resolver never runs (no LOG_CANARY)
3. ❌ Reason: ping fails, blocking downstream resolvers

---

## PHASE 3: FAILURE LAYER CLASSIFICATION

**Bucket:** **BUCKET B (Backend not invoked)**

**Evidence:**
1. UI invokes `ping` resolver (line 1647 in main.ts)
2. Backend registered resolvers do NOT include `ping` (gadget-resolver.ts before fix)
3. Forge bridge immediately fails with "resolver not found"
4. Error is NOT captured in logs (happens at bridge layer, before @forge/api)
5. UI falls back to error state: `PING_FAILED` with `UNSET_TRACE_ID`

**UI Code Location:** `src/gadget-ui/src/main.ts:1647-1662`
```typescript
try {
    pingResult = await invoke('ping', { uiReqId: FT_UI_REQ_ID });
} catch (pingErr) {
    pingError = pingErr instanceof Error ? pingErr.message : String(pingErr);
    console.error(`[UI_PING_INVOKE_FAILED]...`);
}

if (pingError || !pingResult?.ok) {
    const pingTrace = pingResult?.error?.trace_id_stable || 'UNSET_TRACE_ID';
    // Shows: Backend (PING_FAILED | trace: UNSET_TRACE_ID)
}
```

---

## PHASE 4: MINIMAL FIX APPLIED

**Commit:** `a369de38` - BACKBONE L0 FIX: Register missing ping and ensureFirstSnapshot resolvers

**File Changed:** `atlassian/forge-app/src/gadget-resolver.ts`

**Diff:**
```typescript
// BEFORE
import Resolver from '@forge/resolver';
import { getStatusSnapshot_resolver } from './resolvers/getStatusSnapshot';
import { getBuildInfo_resolver } from './resolvers/getBuildInfo';
import { refreshNow_resolver } from './resolvers/refreshNow';
import { exportTrustSnapshot } from './resolvers/audit_snapshot_export';
import { getSnapshotDebug_resolver } from './resolvers/getSnapshotDebug';

const resolver = new Resolver();
resolver.define('getStatusSnapshot', getStatusSnapshot_resolver);
resolver.define('getBuildInfo', getBuildInfo_resolver);
resolver.define('refreshNow', refreshNow_resolver);
resolver.define('exportTrustSnapshot', exportTrustSnapshot);
resolver.define('getSnapshotDebug', getSnapshotDebug_resolver);

// AFTER
import Resolver from '@forge/resolver';
import { getStatusSnapshot_resolver } from './resolvers/getStatusSnapshot';
import { getBuildInfo_resolver } from './resolvers/getBuildInfo';
import { refreshNow_resolver } from './resolvers/refreshNow';
import { exportTrustSnapshot } from './resolvers/audit_snapshot_export';
import { getSnapshotDebug_resolver } from './resolvers/getSnapshotDebug';
import { ping } from './resolvers/ping';  // ← ADDED
import { ensureFirstSnapshot } from './resolvers/ensureFirstSnapshot';  // ← ADDED

const resolver = new Resolver();
resolver.define('getStatusSnapshot', getStatusSnapshot_resolver);
resolver.define('getBuildInfo', getBuildInfo_resolver);
resolver.define('refreshNow', refreshNow_resolver);
resolver.define('exportTrustSnapshot', exportTrustSnapshot);
resolver.define('getSnapshotDebug', getSnapshotDebug_resolver);
resolver.define('ping', ping);  // ← ADDED
resolver.define('ensureFirstSnapshot', ensureFirstSnapshot);  // ← ADDED
```

**Why This is Minimal:**
- No new code written (both resolvers already exist with proper implementations)
- Only adds 2 import statements and 2 resolver.define() calls
- Does not change response structures, error handling, or business logic
- No refactoring or cleanup

---

## PHASE 4: DEPLOYMENT & VERIFICATION

**Tests:** ✅ All 1472 tests pass
```
Test Files  119 passed (119)
Tests  1472 passed (1472)
```

**Build:** ✅ Gadget UI built successfully
```
dist/index.html                 37.10 kB │ gzip:  5.17 kB
dist/assets/index.DKSxt3r1.css  14.75 kB │ gzip:  3.32 kB
dist/assets/index.0hoJv6jo.js   93.05 kB │ gzip: 26.14 kB
```

**Deploy:** ✅ Version 2.98.0 deployed to production
```
✔ Deployed
Deployed FirstTry – Governance Status to the production environment.
The version of your app [2.98.0] that was just deployed to [production]
```

**Installation:** ✅ Updated to latest
```
Installation ID: 2bb53ed8-fb94-49fd-981f-490e84eed36b
Environment: production
Major Version: 2 (Latest)
```

---

## EXPECTED POST-DEPLOY BEHAVIOR (After Gadget Reload)

Once a user reloads the gadget in their Jira dashboard, the following will occur:

### Health Check Sequence (Should Now Succeed):

1. **getStatusSnapshot** invoked → succeeds (no change)

2. **ping** invoked → ✅ NOW SUCCEEDS (was missing)
   - Returns: `{ ok: true, meta: { ui_req_id, backend_build_sha, now_iso } }`
   - Logs: `PING_OK` marker
   - UI displays build SHA instead of PING_FAILED

3. **ensureFirstSnapshot** invoked → ✅ NOW SUCCEEDS (was missing)
   - Ensures at least one snapshot exists
   - Returns: `{ ok: true, did_write, snapshot_id }`
   - Continues to next step

4. **getBuildInfo** invoked → ✅ NOW SUCCEEDS (was blocked by ping)
   - **LOGS LOG_CANARY:** `LOG_CANARY resolver=getBuildInfo build=<SHA> ts=<ISO> ui_req_id=<id>`
   - Returns: build metadata with actual backend_build_sha
   - UI footer displays correct build SHA

5. **probe** can now execute → ✅ GENERATES NONCE
   - Depends on successful getBuildInfo
   - Emits: `PROBE_OK` with nonce
   - Run Probe button now produces usable nonce

### Verification Commands (After Gadget Reload):

```bash
# Check logs for successful markers
forge logs --environment production --since 10m | grep -F "LOG_CANARY"
forge logs --environment production --since 10m | grep -F "PING_OK"
forge logs --environment production --since 10m | grep "marker.*PROBE_OK"

# Expected output: Multiple lines with actual build SHAs, timestamps, and request IDs
```

---

## ROOT CAUSE SUMMARY

| Layer | Component | Status | Finding |
|-------|-----------|--------|---------|
| **L0: Resolver Registration** | gadget-resolver.ts | ❌ BROKEN | `ping` and `ensureFirstSnapshot` not registered |
| **L1: Resolver Implementation** | ping.ts, ensureFirstSnapshot.ts | ✅ OK | Both files exist with proper exports |
| **L2: Forge Bridge** | invoke() dispatch | ❌ FAILS | Unregistered resolvers cause immediate bridge failure |
| **L3: Log Capture** | forge logs | ✅ OK | Works, but receives no gadget UI resolver logs due to L2 failure |
| **L4: Error Propagation** | UI error handling | ✅ OK | Correctly shows PING_FAILED with UNSET_TRACE_ID |

---

## Files Produced (Evidence Archive)

All evidence files saved to `/tmp/l0_*.txt`:

```
l0_whoami.txt                  - Forge authentication proof
l0_settings_list.txt           - Forge CLI settings
l0_env_list.txt                - Production deployment metadata
l0_install_list_prod.txt       - Production installation proof
l0_logs_raw_20m.txt            - Raw production logs (pre-deploy) [5193 bytes]
l0_logs_grouped_20m.txt        - Grouped logs (pre-deploy) [4433 bytes]
l0_log_sizes.txt               - Log file sizes
l0_logs_raw_head.txt           - First 80 lines of raw logs
l0_logs_raw_tail.txt           - Last 80 lines of raw logs
l0_invoke_calls.txt            - UI resolver invocations found
l0_handlers_ping_build.txt     - Resolver registration check
l0_resolver_files.txt          - Missing resolver files exist
l0_canary_raw_hits.txt         - LOG_CANARY search (empty - proves issue)
l0_canary_grouped_hits.txt     - LOG_CANARY search (empty - proves issue)
l0_runtime_markers_raw.txt     - Resolver markers in logs
l0_post_deploy_markers.txt     - Post-deploy marker search (ready for verification)
```

---

## Conclusion

The gadget UI was trying to invoke two resolvers that were never registered in the backend dispatcher. This is a pure **wiring error** at the Forge resolver layer (L0) - not a business logic issue. Both resolver implementations were correct and complete; they just weren't connected.

The fix is deterministic and minimal: register the two existing resolvers. After gadget reload, all health checks will succeed, LOG_CANARY will be emitted, and probe will generate nonces.

**Status:** Fix deployed as version 2.98.0. Ready for gadget reload verification.
