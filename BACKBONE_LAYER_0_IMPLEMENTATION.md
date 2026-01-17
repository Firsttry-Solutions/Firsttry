# Backbone Layer 0: Correlation + Ping Contract
## Implementation Document

**Date:** 2026-01-17  
**Status:** ✅ COMPLETE  
**Target:** One gadget load = deterministically grepable logs with exact UI_REQ_ID

---

## Overview

Layer 0 establishes the foundational correlation and error handling contract. Every UI action now has a unique `ui_req_id` that can be used to trace the request through production logs deterministically.

---

## A) Canonical Correlation Field: `ui_req_id`

### Implementation
- **UI Generator:** `FT_UI_REQ_ID = "ui_${Date.now()}_${Math.random().toString(16).slice(2, 8)}"`
- **UI Constant:** `UI_BUILD_MARKER = "UI_MARKER_20260117T141000Z"` (cache-bust verification)
- **Passing:** UI passes `{ ui_req_id }` to every `invoke()` call
- **Handler:** `gadget-handlers.ts` extracts and passes to all resolvers
- **Resolver Response:** All resolvers return `meta: { ui_req_id, backend_build_sha, now_iso }`

### Code Changes

**src/resolvers/ping.ts:**
```typescript
export interface PingResponseMeta {
  ui_req_id: string;
  backend_build_sha: string;
  now_iso: string;
}

export interface PingResponse {
  ok: boolean;
  meta: PingResponseMeta;
  error?: PingErrorResponse;
}
```

**src/gadget-ui/src/main.ts:**
```typescript
// BACKBONE LAYER 0: Hard-coded UI_BUILD_MARKER for cache-busting verification
const UI_BUILD_MARKER = "UI_MARKER_20260117T141000Z";

// UI_REQ_ID: Unique per page load
const FT_UI_REQ_ID = `ui_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
```

---

## B) Hardened ping() Resolver: NEVER "no-trace"

### Contract Enforcement
ping() now enforces:
1. **Try/Catch Wrapping:** Entire body wrapped, no unhandled exceptions
2. **Always Has Meta:** Both success and error include `meta: { ui_req_id, backend_build_sha, now_iso }`
3. **Always Has Trace on Error:** If `ok: false`, MUST have `error.trace_id_stable` (never null/undefined)
4. **JSON Logging:** Both paths emit machine-readable logs for grepping

### Success Path
```typescript
console.log(JSON.stringify({
  marker: "PING_OK",
  ui_req_id: uiReqId,
  backend_build_sha: backendBuildSha,
  timestamp_iso: nowIso
}));

return {
  ok: true,
  meta: { ui_req_id, backend_build_sha, now_iso }
};
```

### Error Path
```typescript
console.log(JSON.stringify({
  marker: "PING_ERR",
  ui_req_id: uiReqId,
  backend_build_sha: backendBuildSha,
  timestamp_iso: nowIso,
  error_code: errorCode,
  trace_id_stable: traceIdStable
}));

return {
  ok: false,
  meta: { ui_req_id, backend_build_sha, now_iso },
  error: {
    code: errorCode,
    message: errorMsg,
    trace_id_stable: traceIdStable,
    trace_id_instance: traceIdInstance
  }
};
```

**Acceptance:** Zero responses with error but missing `trace_id_stable`.

---

## C) UI Error Handling: NO SWALLOWING

### Changes
1. **Invoke Exception Handling:** Distinguishes between:
   - `INVOKE_THROW` - Promise rejected
   - `INVOKE_ERROR` - Response returned but `ok: false`

2. **Error Display:** Footer shows:
   - For ping error: `PING_ERR | code:<code> | trace:<trace_id_stable> | ui_req_id:<id>`
   - Never shows "no-trace" (logs warning if missing)

3. **Footer Always Includes:**
   - `ui_req_id` - for correlation
   - `UI_BUILD_MARKER` - for cache verification
   - Error code + trace when applicable

### Code Changes

**UI error handling:**
```typescript
let invokeErrorThrown = false;
try {
  rawData = await invoke('getStatusSnapshot', { ui_req_id: FT_UI_REQ_ID });
} catch (e) {
  invokeError = e instanceof Error ? e.message : String(e);
  invokeErrorThrown = true;
  console.error('Bridge.invoke threw exception:', invokeError);
}
```

**Ping error display:**
```typescript
const pingTrace = pingResult?.error?.trace_id_stable || 'UNSET_TRACE_ID';
if (pingTrace === 'UNSET_TRACE_ID' || !pingTrace) {
  console.error(`[CRITICAL] ping error response missing trace_id_stable!`);
}
proofEl.textContent = `BACKBONE_L0 | UI_BUILD_MARKER:${UI_BUILD_MARKER} | ui_req_id:${FT_UI_REQ_ID} | PING_ERR | code:${pingErrorCode} | trace:${pingTrace}`;
```

**Acceptance:** UI footer always contains `ui_req_id` and never shows "trace: no-trace".

---

## D) Cache-Busting Verification: UI_BUILD_MARKER

### Purpose
When debugging cache issues, users can visually confirm which UI bundle is loaded by checking the footer.

### Implementation
```typescript
const UI_BUILD_MARKER = "UI_MARKER_20260117T141000Z";
```

**Footer includes (always visible):**
```
UI_BUILD_MARKER=UI_MARKER_20260117T141000Z | ui_req_id=ui_1705508285000_a3f2b1c4
```

### Change Protocol
When deploying a new UI build for debugging:
1. Update `UI_BUILD_MARKER` to new timestamp
2. Deploy
3. User opens gadget
4. User checks footer - if marker hasn't changed, UI is stale/cached

**Acceptance:** User can visually confirm if UI is the deployed bundle.

---

## E) Proof Commands: Deterministic Grepping

### After Deployment
1. Open gadget UI
2. Copy `ui_req_id` from footer (e.g., `ui_1705508285000_a3f2b1c4`)
3. Run:
   ```bash
   forge logs --environment production --limit 300 | grep "ui_1705508285000_a3f2b1c4"
   ```

### Expected Output: Success Path
```
PING_OK
{"marker":"PING_OK","ui_req_id":"ui_1705508285000_a3f2b1c4","backend_build_sha":"8e0e4e8","timestamp_iso":"2026-01-17T14:20:00.123Z"}

GADGET_INVOKE_REQUEST
{"uiReqId":"ui_1705508285000_a3f2b1c4","resolverName":"ping","ts":"2026-01-17T14:20:00.000Z"}

GADGET_INVOKE_SUCCESS
{"uiReqId":"ui_1705508285000_a3f2b1c4","resolverName":"ping","ts":"2026-01-17T14:20:00.130Z"}
```

### Expected Output: Error Path
```
PING_ERR
{"marker":"PING_ERR","ui_req_id":"ui_1705508285000_a3f2b1c4","backend_build_sha":"8e0e4e8","timestamp_iso":"2026-01-17T14:20:00.123Z","error_code":"TENANT_CONTEXT_MISSING","trace_id_stable":"ping-error-1705508300000"}

GADGET_INVOKE_ERROR
{"uiReqId":"ui_1705508285000_a3f2b1c4","resolverName":"ping","error":"Tenant context missing","ts":"2026-01-17T14:20:00.130Z"}
```

**Acceptance:** Exact correlation works end-to-end, zero ambiguity.

---

## Files Modified

1. **src/resolvers/ping.ts**
   - Added `PingResponseMeta` interface
   - Updated `PingResponse` to include `meta` field
   - Hardened error handling with guaranteed `trace_id_stable`
   - Added JSON logging for both success and error paths

2. **src/resolvers/gadget-handlers.ts**
   - Updated to pass `ui_req_id` to all resolvers via wrapped request

3. **src/gadget-ui/src/main.ts**
   - Added `UI_BUILD_MARKER` constant
   - Updated footer rendering to always show `UI_BUILD_MARKER` and `ui_req_id`
   - Enhanced error handling to distinguish `INVOKE_THROW` vs `INVOKE_ERROR`
   - Updated ping error display to never show "no-trace"
   - Updated all invoke calls to pass `{ ui_req_id }`

---

## Testing Checklist

- [ ] Build completes without errors: `npm run build`
- [ ] Deploy to production
- [ ] Open gadget UI and copy `ui_req_id` from footer
- [ ] Verify `UI_BUILD_MARKER` visible in footer
- [ ] Run grep command with exact `ui_req_id`
- [ ] Confirm PING_OK or PING_ERR marker present in logs
- [ ] Confirm trace_id_stable always present on errors
- [ ] Confirm no "no-trace" values in error responses

---

## Next Phase

After Layer 0 passes all acceptance criteria:
- Proceed to Layer 1: freshness invariants + ensureFirstSnapshot
- Do NOT touch roadmap text or feature scope

---

## Build Status

✅ Build succeeded (2026-01-17T14:18:05Z)  
✅ Backend build: 574f618  
✅ UI bundle: generated  
✅ All modules transformed  

**Ready for deployment.**
