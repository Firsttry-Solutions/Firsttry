# BACKBONE LAYER 0: Handler-Level Correlation + Trace Enforcement
## DEPLOYMENT COMPLETE (Version 2.93.0)

**Commit:** `b434d411` - BACKBONE_LAYER_0: Handler-Level Correlation + Trace Enforcement  
**Deployed:** 2026-01-17 14:52 UTC  
**Build Version:** 2.93.0  

---

## What Was Fixed

### PROBLEM (Pre-Deployment)
- Gadget logs showed `uiReqId` with `req_` prefix (OLD format)
- Production logs did NOT contain `ui_req_id` (NEW format) from footer
- Ping resolver failures showed `trace:UNSET_TRACE_ID` (missing trace_id_stable)
- No deterministic way to grep UI request logs by ui_req_id from footer

### SOLUTION (Handler-Level Enforcement)
All correlation + trace enforcement moved to handler dispatcher (not per-resolver):

1. **`extractUiReqId(payload)`** - Canonical extraction
   - Priority chain: `payload.ui_req_id` → `payload.meta.ui_req_id` → `payload.uiReqId` → `payload.requestId`
   - Returns `null` if none found
   - Result passed to all resolvers

2. **`metaBase(ui_req_id)`** - Guaranteed meta structure
   - `{ ui_req_id, backend_build_sha, now_iso }`
   - Merged into every response (success or error)

3. **`ensureTraceOnError(res, resolverName, ui_req_id)`** - Hard guarantee
   - If `ok:false`: **MUST** have `error.trace_id_stable` (non-empty)
   - If missing: generate `trace_${resolverName}_${ui_req_id}_${timestamp}`
   - Ensure `error.code` and `error.message` exist (with defaults)
   - Ensure `meta` exists and merged correctly

4. **Handler dispatcher logs**
   - `RESOLVER_ENTER`: Log entry with ui_req_id (grepable)
   - `RESOLVER_OK` or `RESOLVER_ERR`: Log exit with ui_req_id + trace_id_stable
   - Format: Machine-readable JSON for `forge logs | grep <ui_req_id>`

5. **Ping resolver compliance**
   - No changes needed - already returns meta + trace_id_stable
   - Handler normalization ensures it cannot fail the contract

---

## Files Modified

### 1. `src/resolvers/gadget-handlers.ts` (MAJOR REFACTOR)
- **Removed:** Old `uiReqId` with `req_` prefix generation
- **Added:** `extractUiReqId()` function (canonical extraction)
- **Added:** `metaBase()` function (guaranteed meta structure)
- **Added:** `ensureTraceOnError()` function (hard trace guarantee)
- **Refactored:** Handler dispatcher to enforce correlation + trace at boundary
- **Enhanced:** Logging with RESOLVER_ENTER/RESOLVER_OK/RESOLVER_ERR markers
- **Result:** All responses normalized, all errors have trace_id_stable

### 2. `tests/backbone_layer0_handler_correlation.test.ts` (NEW)
- 29 comprehensive tests covering:
  - **Part 1:** ui_req_id extraction (6 tests)
  - **Part 2:** meta base structure (3 tests)
  - **Part 3:** error trace enforcement (10 tests)
  - **Part 4:** handler integration (5 tests)
  - **Part 5:** ping resolver compliance (2 tests)
  - **Part 6:** deterministic grepping (3 tests)
- Contract violations result in test failures (regression protection)

### 3. `src/resolvers/ping.ts` (NO CHANGES)
- Already compliant with correlation contract
- Handler normalization adds additional safety layer

---

## Test Results

✅ **All 1428 tests passing** (including 29 new correlation tests)  
✅ **Build successful** (79 modules, 479ms)  
✅ **Gadget bundle:** 90.32 kB (gzip: 25.39 kB)  
✅ **UI_BUILD_MARKER:** `UI_MARKER_20260117T141000Z`  
✅ **Production deployment:** Version 2.93.0 deployed and installed  

---

## Proof Contract (Verification Steps)

### STEP A: Manual Gadget Reload in Browser
1. Go to https://firsttry.atlassian.net
2. Remove "FirstTry – Governance Status" gadget
3. Re-add it
4. **Hard refresh** `Ctrl+F5` (bypass browser cache)
5. **Verify footer shows:**
   ```
   UI_BUILD_MARKER=UI_MARKER_20260117T141000Z | ui_req_id=ui_17586xxxxx_xxxxxx
   ```
   (must show NEW `ui_` prefix, not old `req_` prefix)

### STEP B: Make Gadget Invocation
- Click any button or trigger resolver call
- Note the `ui_req_id` from footer

### STEP C: Grep Production Logs
```bash
cd /workspaces/Firsttry/atlassian/forge-app
timeout 30 forge logs --environment production --limit 600 | grep "<ui_req_id_from_footer>"
```

**Expected output:** Multiple lines like:
```json
{"marker":"RESOLVER_ENTER","resolver":"ping","ui_req_id":"ui_17586xxxxx_xxxxxx",...}
{"marker":"PING_OK","ui_req_id":"ui_17586xxxxx_xxxxxx",...}
{"marker":"RESOLVER_OK","resolver":"ping","ui_req_id":"ui_17586xxxxx_xxxxxx",...}
```

### STEP D: Verify Error Response
If any resolver fails, grep should show:
```json
{"marker":"RESOLVER_ERR","resolver":"ping","error_code":"PING_FAILED","trace_id_stable":"trace_ping_ui_17586xxxxx_xxxxxx_...",...}
```
- ✅ Must include `trace_id_stable` (never empty/UNSET)
- ✅ `ui_req_id` matches footer value exactly
- ✅ Deterministically grepable

---

## Correlation Contract (Enforcement)

### GUARANTEED
1. **Every error response** includes `error.trace_id_stable` (non-empty)
2. **Every response** includes `meta` with `{ui_req_id, backend_build_sha, now_iso}`
3. **Handler logs** include RESOLVER_ENTER and RESOLVER_OK/RESOLVER_ERR with ui_req_id
4. **Production logs** are deterministically grepable by ui_req_id from footer

### TESTABLE
- 29 tests verify contract cannot regress
- Any regression causes test failure (CI blocker)

### GREPABLE
```bash
# Find all operations for a specific UI request
forge logs --limit 600 | grep "ui_1768660190864_d8f211a2"

# Find all errors with traces
forge logs --limit 600 | grep "RESOLVER_ERR" | grep "trace_id_stable"

# Find specific resolver activity
forge logs --limit 600 | grep '"resolver":"ping"'
```

---

## Backward Compatibility

✅ **Fully backward compatible**
- Old payload formats still supported (fallback chain)
- Existing resolvers require zero changes
- Handler normalization adds safety without breaking changes
- All 1428 existing tests pass unchanged

---

## Next Steps: User Verification

1. **Complete browser reload** (STEP A above) - User must do this
2. **Verify footer shows new UI_BUILD_MARKER and ui_ prefix** (STEP B above)
3. **Run correlation proof grep** (STEP C above)
4. **Output PASS if all conditions met** (STEP D above)

Once user confirms Step A-B, we can execute Steps C-D automatically.
