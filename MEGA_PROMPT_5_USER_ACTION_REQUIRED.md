# MEGA-PROMPT 5: REQUEST ID CORRELATION + ALWAYS-RETURN RESOLVER ✅

**Status**: ✅ **v2.67.0 DEPLOYED**

## Problem Fixed

**Before**: 
- UI footer shows "Backend: undefined @ undefined" 
- getBuildInfo resolver may fail silently due to missing tenant context
- No way to correlate UI invoke calls with backend resolver logs

**After**:
- getBuildInfo ALWAYS returns build metadata (no tenant guard)
- UI sends uiReqId per page load for correlation
- Resolver echoes uiReqId in response
- SERVE_PROOF line shows: UI_REQ_ID + ECHO (match check) + BACKEND values + RESOLVER_OK
- Logs contain [BUILDINFO_UI_CALLED] + [BUILDINFO_UI_PROOF] with uiReqId for tracing

---

## Changes Deployed

### 1. **Resolver (getBuildInfo.ts)**
- ✅ Accept `uiReqId` from UI invoke payload
- ✅ Remove tenant context guards (build_meta is non-tenant data)
- ✅ Echo `uiReqId` in response as `uiReqIdEcho`
- ✅ Add `[BUILDINFO_UI_CALLED]` log with uiReqId + tenantPresent status
- ✅ Add `[BUILDINFO_UI_PROOF]` log with uiReqId + FT_BUILD_SHA + FT_BUILD_TIME_UTC

### 2. **UI (main.ts)**
- ✅ Generate `FT_UI_REQ_ID = ui_<timestamp>_<random>` per page load
- ✅ Invoke getBuildInfo with payload: `{ uiReqId: FT_UI_REQ_ID }`
- ✅ Render SERVE_PROOF line with:
  - `UI_REQ_ID:<id>` (request ID from this page load)
  - `ECHO:<id or none>` (echo back from resolver, match check)
  - `BACKEND:<sha>@<time>` (build metadata)
  - `RESOLVER_OK:true/false` (successful return check)
- ✅ Add logs: `[UI_BUILDINFO_INVOKE_START]`, `[UI_BUILDINFO_INVOKE_SUCCESS]`, `[UI_BUILDINFO_INVOKE_ERROR]`

---

## Success Criteria

**UI Display (After hard refresh + gadget re-add)**:
```
SERVE_PROOF: cdfa04fba064__20260115T120000Z | UI_REQ_ID:ui_<timestamp>_<hex> | 
ECHO:ui_<timestamp>_<hex> | BACKEND: 6be614bd @ 2026-01-15T11:14:51Z | RESOLVER_OK:true
```

✅ UI_REQ_ID present (unique per page load)  
✅ ECHO matches UI_REQ_ID (proves resolver received request)  
✅ BACKEND shows sha@time (NOT "undefined @ undefined")  
✅ RESOLVER_OK shows true (resolver completed successfully)  

**Backend Logs**:
```bash
cd /workspaces/Firsttry/atlassian/forge-app
forge logs --environment production --since "30m" --limit 2500 | grep "BUILDINFO_UI_"
```

Expected entries:
```
[BUILDINFO_UI_CALLED] uiReqId=ui_<timestamp>_<hex> tenantPresent=false resolvedAt=2026-01-15T...
[BUILDINFO_UI_PROOF] uiReqId=ui_<timestamp>_<hex> FT_BUILD_SHA=6be614bd FT_BUILD_TIME_UTC=2026-01-15T11:14:51Z resolvedAt=2026-01-15T...
```

✅ Logs contain uiReqId matching UI footer  
✅ FT_BUILD_SHA + FT_BUILD_TIME_UTC present (not undefined)  
✅ Shows tenantPresent=false (gracefully handled)  

---

## User Verification Steps

### Step 1: Remove + Re-add Gadget
1. Open Jira dashboard
2. Click gadget settings (gear icon)
3. Remove gadget
4. Hard refresh: **Ctrl+Shift+R** (Windows/Linux) or **Cmd+Shift+R** (Mac)
5. Add gadget back: Jira home → Create dashboard widget → Search "Governance Status" → Add

### Step 2: Hard Refresh Page
- **Windows/Linux**: `Ctrl+Shift+R`
- **Mac**: `Cmd+Shift+R`
- Wait 10-15 seconds for page to fully load

### Step 3: Check Footer
Footer should display (bottom of gadget):
```
UI: UI_v2.14.0 | Backend: 6be614bd @ 2026-01-15T11:14:51Z

[✓ BUILD PROOF] UI+Backend versions verified in real-time

SERVE_PROOF: cdfa04fba064__20260115T120000Z | UI_REQ_ID:ui_1737013692512_a4f2c | 
ECHO:ui_1737013692512_a4f2c | BACKEND: 6be614bd @ 2026-01-15T11:14:51Z | RESOLVER_OK:true
```

✅ All three lines visible  
✅ No "undefined" values anywhere  
✅ UI_REQ_ID and ECHO match  

### Step 4: Verify Backend Logs
```bash
RUN_DIR="/tmp/your_run_dir"
cd /workspaces/Firsttry/atlassian/forge-app
forge logs --environment production --since "15m" --limit 2500 > "$RUN_DIR/logs_after_open.txt"
grep -n "BUILDINFO_UI_" "$RUN_DIR/logs_after_open.txt" | head -50
```

Expected results:
- Multiple entries with [BUILDINFO_UI_CALLED]
- Matching [BUILDINFO_UI_PROOF] entries
- uiReqId in logs matching UI footer
- FT_BUILD_SHA and FT_BUILD_TIME_UTC populated

---

## Deployment Record

| Component | Action | Status |
|-----------|--------|--------|
| Resolver | Accept uiReqId + echo back | ✅ |
| Resolver | Remove tenant guard | ✅ |
| Resolver | Add UI correlation logs | ✅ |
| UI | Generate FT_UI_REQ_ID | ✅ |
| UI | Pass uiReqId in invoke | ✅ |
| UI | Render UI_REQ_ID + ECHO | ✅ |
| Dist | Rebuild with new code | ✅ |
| Forge lint | Pass gates | ✅ |
| Git commit | 6be614bd | ✅ |
| Deploy | v2.67.0 deployed | ✅ |
| Install | Upgraded at firsttry.atlassian.net | ✅ |

---

## Proof Evidence

**Source Code Changes**:
- [src/resolvers/getBuildInfo.ts](../atlassian/forge-app/src/resolvers/getBuildInfo.ts) — Resolver correlation + always-return
- [src/gadget-ui/src/main.ts](../atlassian/forge-app/src/gadget-ui/src/main.ts) — UI request ID + invoke with payload

**Compiled Artifacts**:
- `src/gadget-ui/dist/assets/index.*.js` — Contains FT_UI_REQ_ID, uiReqId correlation, BUILDINFO_UI_ log markers

**Git Commit**: 6be614bd (GitHub main branch)

**Deployed Version**: v2.67.0

---

## Troubleshooting

### If SERVE_PROOF still shows "undefined" values:
1. Verify gadget was removed + re-added (resource reload)
2. Hard refresh twice (Ctrl+Shift+R twice, wait between)
3. Check DevTools Console for errors

### If ECHO doesn't match UI_REQ_ID:
1. Resolver may not have received payload
2. Check backend logs for [BUILDINFO_UI_CALLED] entry
3. If missing: resolver not being called, escalate

### If logs don't show BUILDINFO_UI_ entries:
1. Run: `forge logs --environment production --since "30m" | grep BUILDINFO`
2. Should see both old `BUILDINFO_PROOF` and new `BUILDINFO_UI_PROOF` entries
3. If missing: deployment may not have propagated, wait 2-3 minutes

---

## Next: User Verification

**Action Required**:
1. Open dashboard gadget (Governance Status)
2. Remove + re-add gadget
3. Hard refresh page
4. Observe SERVE_PROOF line with UI_REQ_ID + ECHO + BACKEND (non-undefined)
5. Run logs command to correlate uiReqId in [BUILDINFO_UI_CALLED] entries

**Expected Result**: ✅ **Footer shows actual build metadata, not undefined**

---

**Deployed**: 2026-01-15 11:14:51Z  
**Version**: v2.67.0  
**Commit**: 6be614bd  
**Status**: LIVE & AWAITING USER VERIFICATION
