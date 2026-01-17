# Layer 0: Quick Reference Card

## TL;DR - What Changed

### Before Layer 0
- Errors showed "no-trace"
- No way to correlate UI request with backend logs
- Cache issues hidden from users
- Generic error messages

### After Layer 0
- ✅ Every request has unique `ui_req_id`
- ✅ All errors have `trace_id_stable` (never missing)
- ✅ Footer shows `UI_BUILD_MARKER` for cache verification
- ✅ Deterministic grepping of production logs

---

## Files Changed

### 1. Backend
**`src/resolvers/ping.ts`** - Complete rewrite
```
- New: PingResponseMeta interface
- New: Guaranteed trace_id_stable (never "no-trace")
- New: JSON logging (PING_OK/PING_ERR markers)
- New: Error handling wraps entire function
```

**`src/resolvers/gadget-handlers.ts`** - Small change
```
- Extract ui_req_id from payload
- Wrap and pass to all resolvers
```

### 2. UI
**`src/gadget-ui/src/main.ts`** - Three changes
```
- Add UI_BUILD_MARKER constant
- Update footer to show UI_BUILD_MARKER + ui_req_id
- Pass ui_req_id to ping invoke()
```

---

## Constants

```typescript
// Generate new UI_BUILD_MARKER on each deploy (for cache debugging)
const UI_BUILD_MARKER = "UI_MARKER_20260117T141000Z";

// Unique per page load (for correlation)
const FT_UI_REQ_ID = `ui_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
```

---

## Invoke Pattern (UI → Backend)

**Old (no correlation):**
```typescript
await invoke('ping', {});
```

**New (with correlation):**
```typescript
await invoke('ping', { ui_req_id: FT_UI_REQ_ID });
```

---

## Response Pattern (Backend → UI)

**Old (no meta):**
```typescript
{
  ok: true,
  backend_build_sha: "8e0e4e8",
  now_iso: "2026-01-17T14:20:00.000Z"
}
```

**New (with meta):**
```typescript
{
  ok: true,
  meta: {
    ui_req_id: "ui_1705508285000_a3f2b1c4",
    backend_build_sha: "8e0e4e8",
    now_iso: "2026-01-17T14:20:00.000Z"
  }
}
```

---

## Error Response Pattern

**Old (might say "no-trace"):**
```typescript
{
  ok: false,
  error: {
    code: "PING_FAILED",
    message: "Something went wrong",
    trace_id_stable: "no-trace"  // ❌ BAD
  }
}
```

**New (ALWAYS has trace_id_stable):**
```typescript
{
  ok: false,
  meta: {
    ui_req_id: "ui_1705508285000_a3f2b1c4",
    backend_build_sha: "8e0e4e8",
    now_iso: "2026-01-17T14:20:00.000Z"
  },
  error: {
    code: "TENANT_CONTEXT_MISSING",
    message: "Tenant context not available",
    trace_id_stable: "ping-error-1705508300000"  // ✅ ALWAYS PRESENT
  }
}
```

---

## Footer Display

**User sees:**
```
UI_BUILD_MARKER=UI_MARKER_20260117T141000Z | ui_req_id=ui_1705508285000_a3f2b1c4

UI: UI_v2.14.0 | Backend: 8e0e4e8 @ 2026-01-17T14:18:05Z

BACKBONE_L0: ui_req_id=ui_1705508285000_a3f2b1c4 | UI_BUILD_MARKER=UI_MARKER_20260117T141000Z
```

---

## Logging Patterns

### Success
```json
{ "marker": "PING_OK", "ui_req_id": "ui_1705508285000_...", "backend_build_sha": "8e0e4e8", "timestamp_iso": "2026-01-17T14:20:00.000Z" }
```

### Error
```json
{ "marker": "PING_ERR", "ui_req_id": "ui_1705508285000_...", "backend_build_sha": "8e0e4e8", "timestamp_iso": "2026-01-17T14:20:00.000Z", "error_code": "TENANT_CONTEXT_MISSING", "trace_id_stable": "ping-error-1705508300000" }
```

---

## Verification Commands

### Copy ui_req_id from footer
```
ui_1705508285000_a3f2b1c4
```

### Grep production logs
```bash
forge logs --environment production --limit 300 | grep "ui_1705508285000_a3f2b1c4"
```

### Expected output
```
PING_OK (or PING_ERR if error)
GADGET_INVOKE_REQUEST
GADGET_INVOKE_SUCCESS (or GADGET_INVOKE_ERROR)
```

---

## Error Diagnosis Flow

1. **User reports issue with ui_req_id**
   - E.g., `ui_1705508285000_a3f2b1c4`

2. **Engineer greps logs with that ID**
   ```bash
   grep "ui_1705508285000_a3f2b1c4" prod_logs.txt
   ```

3. **Engineer sees exact flow**
   - Request entry point
   - Resolver execution
   - Success or error
   - Error code if failed
   - Trace ID if failed

4. **If error, grep trace_id_stable**
   ```bash
   grep "ping-error-1705508300000" prod_logs.txt
   ```

5. **See all related log entries** for that error

---

## Cache Issue Diagnosis

**User says:** "I redeployed but still seeing old behavior"

**Check footer:**
```
UI_BUILD_MARKER=UI_MARKER_20260115T100000Z
```

**Compare with deployment date:**
```
Today is 2026-01-17 but marker shows 2026-01-15
```

**Diagnosis:**
```
Browser cache is stale → User needs to clear cache/hard refresh
```

---

## Build Status

```
✅ Build successful (2026-01-17T14:18:05Z)
   Backend: 574f618
   UI: generated
   All modules transformed
```

---

## Deployment Steps

1. Deploy build 574f618
2. Open gadget
3. Check footer for UI_BUILD_MARKER and ui_req_id
4. Copy ui_req_id
5. Run grep verification
6. Confirm PING_OK/PING_ERR with exact correlation

---

## What NOT to Do

- ❌ Don't use "no-trace" for missing trace IDs (always generate one)
- ❌ Don't swallow errors in UI (always display real error messages)
- ❌ Don't forget to update UI_BUILD_MARKER on each deploy
- ❌ Don't change roadmap text or feature scope

---

## What to Do Next

After Layer 0 verification passes:
1. Proceed to Layer 1: Freshness invariants
2. Do NOT modify roadmap or feature scope
3. Stay focused on infrastructure only

---

## Contact / Questions

For clarification on Layer 0 implementation, refer to:
- `LAYER_0_COMPLETION_SUMMARY.md` - Full details
- `BACKBONE_LAYER_0_IMPLEMENTATION.md` - Technical spec
- `LAYER_0_VISUAL_VERIFICATION.md` - User-facing examples

---

**Layer 0 Status: ✅ COMPLETE**
**Build: 574f618 (2026-01-17T14:18:05Z)**
**Ready for: Deployment + Layer 1**
