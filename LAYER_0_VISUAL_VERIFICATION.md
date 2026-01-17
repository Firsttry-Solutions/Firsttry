# Layer 0: Visual Verification Guide

## What Users Will See After Deployment

### Gadget Footer (Always Visible)

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  UI_BUILD_MARKER=UI_MARKER_20260117T141000Z | ui_req_id=ui_1705508285000_a3f2b1c4
│                                                                     │
│  UI: UI_v2.14.0 | Backend: 8e0e4e8 @ 2026-01-17T14:18:05Z         │
│                                                                     │
│  BACKBONE_L0: ui_req_id=ui_1705508285000_a3f2b1c4 | UI_BUILD_MARKER=UI_MARKER_20260117T141000Z
│                                                                     │
│  [✓ BUILD PROOF] UI+Backend versions verified in real-time        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## User Steps to Verify Correlation

### Step 1: User Opens Gadget
- Footer shows: `UI_BUILD_MARKER=UI_MARKER_20260117T141000Z`
- Footer shows: `ui_req_id=ui_1705508285000_a3f2b1c4`

### Step 2: User Copies ui_req_id
```
ui_1705508285000_a3f2b1c4
```

### Step 3: User Runs Grep Command
```bash
$ forge logs --environment production --limit 300 | grep "ui_1705508285000_a3f2b1c4"
```

### Step 4: User Sees Exact Correlation

#### Success Path Output
```json
INFO PING_OK 2026-01-17T14:20:00.100Z
{"marker":"PING_OK","ui_req_id":"ui_1705508285000_a3f2b1c4","backend_build_sha":"8e0e4e8","timestamp_iso":"2026-01-17T14:20:00.100Z"}

INFO GADGET_INVOKE_REQUEST 2026-01-17T14:20:00.000Z
{"uiReqId":"ui_1705508285000_a3f2b1c4","resolverName":"ping","ts":"2026-01-17T14:20:00.000Z"}

INFO GADGET_INVOKE_SUCCESS 2026-01-17T14:20:00.130Z
{"uiReqId":"ui_1705508285000_a3f2b1c4","resolverName":"ping","ts":"2026-01-17T14:20:00.130Z"}
```

**What This Means:**
- ✅ UI sent request with correct ui_req_id
- ✅ Backend received it in gadget handler
- ✅ Ping resolver executed with PING_OK marker
- ✅ Response returned successfully
- ✅ All timestamps correlate exactly

#### Error Path Output
```json
ERROR PING_ERR 2026-01-17T14:20:00.050Z
{"marker":"PING_ERR","ui_req_id":"ui_1705508285000_a3f2b1c4","backend_build_sha":"8e0e4e8","timestamp_iso":"2026-01-17T14:20:00.050Z","error_code":"TENANT_CONTEXT_MISSING","trace_id_stable":"ping-error-1705508300000"}

INFO GADGET_INVOKE_REQUEST 2026-01-17T14:20:00.000Z
{"uiReqId":"ui_1705508285000_a3f2b1c4","resolverName":"ping","ts":"2026-01-17T14:20:00.000Z"}

ERROR GADGET_INVOKE_ERROR 2026-01-17T14:20:00.060Z
{"uiReqId":"ui_1705508285000_a3f2b1c4","resolverName":"ping","error":"TENANT_CONTEXT_MISSING: Request context has no tenant","ts":"2026-01-17T14:20:00.060Z"}
```

**What This Means:**
- ✅ UI sent request with correct ui_req_id
- ✅ Backend received it in gadget handler
- ✅ Ping resolver executed with PING_ERR marker
- ✅ Error code: `TENANT_CONTEXT_MISSING`
- ✅ Trace ID (stable): `ping-error-1705508300000` ← **ALWAYS PRESENT (never "no-trace")**
- ✅ Support can trace to `ping-error-1705508300000` for related log entries

---

## Cache Issues Verification

### Scenario: User Says "I Redeployed But Seeing Old Behavior"

**Before Layer 0:**
- Engineer: "Did you hard refresh?"
- User: "Yes, I think so..."
- Problem: UNCLEAR if UI is actually new

**After Layer 0:**

1. **Check Footer:**
   ```
   UI_BUILD_MARKER=UI_MARKER_20260115T100000Z
   ```

2. **Compare with Expected:**
   ```
   I deployed on 2026-01-17, but footer shows 2026-01-15
   ```

3. **Diagnosis:**
   ```
   Browser is serving stale cached bundle
   Clear browser cache → refresh → new UI_BUILD_MARKER appears
   ```

**Result:** Problem is INSTANTLY VISIBLE and DETERMINISTICALLY DIAGNOSABLE

---

## Error Tracing Example

### Production Issue: "Dashboard not loading after deploy"

**Old Pattern:**
```
Log: "ERROR: INVOKE_FAILED"
Engineer: "Which invoke? When? Why? Need more logs..."
```

**New Pattern:**

1. User provides footer info:
   ```
   UI_BUILD_MARKER=UI_MARKER_20260117T141000Z
   ui_req_id=ui_1705508285000_a3f2b1c4
   ```

2. Engineer runs:
   ```bash
   forge logs --environment production --limit 500 | grep "ui_1705508285000_a3f2b1c4"
   ```

3. Engineer sees exact flow:
   ```
   GADGET_INVOKE_REQUEST: ping (ui_req_id present ✅)
   PING_ERR: error_code=TENANT_CONTEXT_MISSING, trace_id_stable=ping-error-1705508300000
   GADGET_INVOKE_ERROR: exact error message
   ```

4. Engineer investigates:
   ```bash
   forge logs --environment production | grep "ping-error-1705508300000"
   # Finds related stack trace, context info, etc.
   ```

**Result:** Problem triaged in SECONDS instead of hours

---

## Non-Error Case: Boring Success Path

**User opens dashboard:**
- Footer loads with UI_BUILD_MARKER ✓
- Footer loads with ui_req_id ✓
- All resolvers return successfully
- All timestamps correlate

**Support Verification:**
```bash
$ grep "ui_1705508285000_a3f2b1c4" prod_logs.txt
# Sees PING_OK, BUILD_INFO, ENSURE_FIRST_SNAPSHOT_OK, STATUS_SNAPSHOT_OK
# All with matching timestamps
```

**Result:** Dashboard is working exactly as deployed

---

## Key Points

### Why This Matters

| Before | After |
|--------|-------|
| "Dashboard broken" | "PING_ERR \| code:TENANT_CONTEXT_MISSING \| trace:ping-error-1705508300000" |
| "Which request?" | "grep ui_1705508285000_a3f2b1c4" |
| "Is cache stale?" | Look at UI_BUILD_MARKER in footer |
| "When did it fail?" | Exact timestamps correlate |
| Hours of debugging | Minutes of diagnosis |

### Zero Ambiguity

- Every request has unique `ui_req_id`
- Every error has `trace_id_stable` (never missing)
- Every footer shows which UI bundle is loaded
- All logs for one request are grepable in one command
- All timestamps correlate exactly

---

## Deployment Checklist

- [ ] Deploy build (574f618)
- [ ] Open gadget UI
- [ ] Verify footer shows:
  - [ ] `UI_BUILD_MARKER=UI_MARKER_20260117T141000Z`
  - [ ] `ui_req_id=ui_1705508285000_...` (some unique ID)
- [ ] Copy ui_req_id
- [ ] Run grep: `forge logs --environment production --limit 300 | grep "<ui_req_id>"`
- [ ] Verify output shows:
  - [ ] `PING_OK` or `PING_ERR` marker
  - [ ] `ui_req_id` matches exactly
  - [ ] `trace_id_stable` present if error (never missing)
  - [ ] Timestamps correlate
- [ ] ✅ LAYER 0 OPERATIONAL

---

## Notes

- Footer always shows UI_BUILD_MARKER (cache-busting verification)
- Footer always shows ui_req_id (for correlation queries)
- All errors show trace_id_stable (never "no-trace")
- All requests are deterministically grepable
- All timestamps use ISO 8601 format (Z timezone)

**Result:** Production debugging is now deterministic, traceable, and fast.
