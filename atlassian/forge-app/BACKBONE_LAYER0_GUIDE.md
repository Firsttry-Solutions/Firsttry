# BACKBONE LAYER 0 — Instrumentation Implementation Guide

**Status:** ✅ COMPLETE  
**Version:** 2.98.0+  
**Date:** 2026-01-17

---

## Overview

This document describes the **BACKBONE_LAYER_0** instrumentation system that ensures deterministic, non-bypassable correlation and tracing of all gadget resolver invocations. The system makes three critical values **impossible to bypass or fake**:

1. **ui_req_id** — Unique request ID per gadget load (UI → Backend correlation)
2. **backend_build_sha** — Deployed git commit SHA (7 hex chars, injected at build time)
3. **trace_id_stable** — Stable trace ID on all errors (never UNSET or missing)

---

## Architecture

### Layer 0: UI Wrapper (invokeWithUiReqId)
**File:** `src/gadget-ui/src/main.ts`

Every resolver invocation must use the wrapper function:

```typescript
// WRONG ❌
const result = await invoke('ping', {});

// RIGHT ✅
const result = await invokeWithUiReqId('ping', {});
```

**The wrapper:**
- Takes resolver name and optional payload
- Injects `ui_req_id: FT_UI_REQ_ID` (single source of truth)
- Calls Forge bridge with enriched payload
- **CI guard fails build if any direct invoke() calls remain**

**Enforced by:** `tests/backbone_registry_matches_ui_invokes.test.ts`

### Layer 0.5: Backend Build Injection
**File:** `src/build/backend_build.ts`

Single source of truth for backend build SHA:

```typescript
export const BACKEND_BUILD_SHA = "abc1234";  // Injected at build time
```

**Injection process:**
1. Build script runs: `node tools/build_meta.mjs`
2. Reads git: `git rev-parse --short=7 HEAD`
3. Rewrites `src/build/backend_build.ts` with injected SHA
4. Validates format: `^[0-9a-f]{7}$` at import time
5. **Impossible to be "unknown" after deploy**

**Enforced by:**
- Build script: `tools/build_meta.mjs`
- Validation: `src/build/backend_build.ts` (validateBackendBuildSha)
- Tests: `tests/backbone_layer0_instrumentation.test.ts`

### Layer 1: Backend Handler Extraction
**File:** `src/resolvers/gadget-handlers.ts`

`extractUiReqId(payload)` supports multiple payload shapes with precedence:

| Order | Format | Example |
|-------|--------|---------|
| 1 | `payload.ui_req_id` | `{ ui_req_id: "ui_..." }` |
| 2 | `payload.meta.ui_req_id` | `{ meta: { ui_req_id: "ui_..." } }` |
| 3 | `payload.uiReqId` | `{ uiReqId: "ui_..." }` (legacy) |
| 4 | `payload.meta.uiReqId` | `{ meta: { uiReqId: "ui_..." } }` (legacy) |
| 5 | `payload.requestId` | `{ requestId: "..." }` |
| 6 | `payload.reqId` | `{ reqId: "req_..." }` (normalized to `ui_...`) |
| 7 | `payload.ui_request_id` | `{ ui_request_id: "..." }` |
| 8 | `payload.context.ui_req_id` | `{ context: { ui_req_id: "..." } }` |

**If none found:** Returns `"ui_missing_" + timestamp + random` (detection marker)

**Enforced by:** `tests/backbone_layer0_instrumentation.test.ts`

### Layer 2: Meta Normalization
**File:** `src/resolvers/gadget-handlers.ts`

`metaBase(ui_req_id)` creates normalized response metadata:

```typescript
{
  ui_req_id: string,           // From extraction
  backend_build_sha: string,   // From BACKEND_BUILD_SHA constant (7 hex)
  now_iso: string              // UTC ISO timestamp
}
```

**Applied to every response** (success or error).

### Layer 3: Error Enforcement
**File:** `src/resolvers/gadget-handlers.ts`

`ensureTraceOnError(response, resolverName, ui_req_id)` guarantees:

```typescript
{
  ok: false,
  error: {
    code: string,                  // e.g., "RESOLVER_UNHANDLED_EXCEPTION"
    message: string,               // Truncated to 200 chars
    trace_id_stable: string        // e.g., "trace_ping_ui_123_1705...
  },
  meta: { ui_req_id, backend_build_sha, now_iso }
}
```

**Rules:**
- `error.code` always present (default: `"RESOLVER_UNHANDLED_EXCEPTION"`)
- `error.message` always present (default: `"Resolver failed"`)
- `error.trace_id_stable` NEVER `"UNSET"` or empty → auto-generated if missing
- Format: `trace_${resolverName}_${ui_req_id}_${timestamp}`

**Enforced by:** `tests/backbone_layer0_instrumentation.test.ts`

### Layer 4: Logging
**File:** `src/resolvers/gadget-handlers.ts` (handler function)

Three log markers (JSON, grepable):

#### RESOLVER_ENTER
```json
{
  "marker": "RESOLVER_ENTER",
  "resolver": "ping",
  "ui_req_id": "ui_12345_abc",
  "backend_build_sha": "abc1234",
  "ts": "2026-01-17T18:00:00.000Z"
}
```

#### RESOLVER_OK / RESOLVER_ERR
```json
{
  "marker": "RESOLVER_ERR",
  "resolver": "ping",
  "ui_req_id": "ui_12345_abc",
  "backend_build_sha": "abc1234",
  "error_code": "TIMEOUT",
  "message": "Connection timeout after 5s",
  "trace_id_stable": "trace_ping_ui_12345_abc_1705...",
  "ts": "2026-01-17T18:00:00.000Z"
}
```

#### STACK (on unhandled exception)
```json
{
  "marker": "STACK",
  "resolver": "ping",
  "trace_id_stable": "trace_ping_ui_12345_abc_1705...",
  "stack": "Error: ... | at Handler | at resolve | ..."
}
```

---

## Verification & Testing

### 1. Unit Tests
**File:** `tests/backbone_layer0_instrumentation.test.ts`

```bash
npm run test -- backbone_layer0_instrumentation.test.ts
```

Tests:
- ✓ extractUiReqId: All 8 payload shapes + missing
- ✓ metaBase: SHA format + ISO timestamp
- ✓ ensureTraceOnError: trace enforcement + message truncation
- ✓ Integration: Full flow from extraction → error → logging

### 2. CI Guard Test
**File:** `tests/backbone_registry_matches_ui_invokes.test.ts`

Runs automatically during build:

```bash
npm run build:gadget
```

Checks:
- ✓ All UI `invokeWithUiReqId('NAME', ...)` calls extracted
- ✓ Zero direct `invoke()` calls in main.ts (fails build if found)
- ✓ All UI resolvers registered in `gadget-resolver.ts`
- ✓ backend_build.ts exists and SHA format valid
- ✓ Failure = build fails (non-bypassable)

### 3. Production Verification
**File:** `tools/l0_verify_backbone.sh`

```bash
./tools/l0_verify_backbone.sh 5        # Check last 5 minutes
./tools/l0_verify_backbone.sh 10       # Check last 10 minutes
./tools/l0_verify_backbone.sh --help   # Usage
```

Checks against production logs:
- ✓ `backend_build_sha` NEVER "unknown" (found N valid SHAs)
- ✓ `ui_req_id` NEVER "ui_missing" in resolvers (found N valid IDs)
- ✓ `trace_id_stable` NEVER "UNSET" (found N error traces)
- ✓ Error logging includes code + message + trace
- ✓ Activity: N resolver invocations

Exit code:
- **0** = All checks passed
- **1** = One or more checks failed

---

## Build Integration

### Manual Setup
```bash
cd atlassian/forge-app

# 1. Generate build metadata (includes backend_build.ts injection)
node tools/build_meta.mjs

# 2. Run CI guard test
node tests/backbone_registry_matches_ui_invokes.test.ts

# 3. Run unit tests
npm test

# 4. Build gadget
npm run build:gadget

# 5. Deploy to production
forge deploy
```

### NPM Scripts (Recommended)
Add to `package.json`:

```json
{
  "scripts": {
    "backbone:test": "npm test -- backbone_",
    "backbone:guard": "node tests/backbone_registry_matches_ui_invokes.test.ts",
    "backbone:verify": "./tools/l0_verify_backbone.sh 5",
    "build:safe": "node tools/build_meta.mjs && npm run backbone:guard && npm test && npm run build:gadget"
  }
}
```

Then:
```bash
npm run build:safe    # Safe build with all checks
npm run backbone:verify   # Post-deploy verification
```

---

## Production Verification Workflow

### Post-Deploy Checklist

1. **Immediately after deploy (within 5 minutes):**
   ```bash
   ./tools/l0_verify_backbone.sh 5
   ```
   Should show: ✅ All checks passed

2. **In gadget UI (manual test):**
   - Open gadget in browser
   - Check footer: Should show backend build SHA (not "PING_FAILED")
   - Open dev console: Should see logs with `ui_req_id` values

3. **Production logs (grep validation):**
   ```bash
   forge logs --environment production --since 5m | grep -E 'backend_build_sha":"unknown"|ui_req_id":"ui_missing'
   # Should return ZERO results
   ```

4. **Error inspection (if any RESOLVER_ERR):**
   ```bash
   forge logs --environment production --since 5m | grep RESOLVER_ERR | head -1 | jq .
   ```
   Should show: `error_code`, `message`, `trace_id_stable` (never UNSET)

---

## Troubleshooting

### Problem: `backend_build_sha` is "unknown" in logs
**Root cause:** BACKEND_BUILD_SHA not injected at build time  
**Fix:**
```bash
node tools/build_meta.mjs
grep "BACKEND_BUILD_SHA" src/build/backend_build.ts
# Should show: export const BACKEND_BUILD_SHA = "abc1234";
```

### Problem: Build fails with "No direct invoke() calls found"
**Root cause:** CI guard detected unregistered resolver or direct invoke() call  
**Fix:**
```bash
node tests/backbone_registry_matches_ui_invokes.test.ts
# Shows exactly which resolver is missing or which invoke() call is direct
```

### Problem: `ui_req_id` appears as "ui_missing_..." in production
**Root cause:** UI failed to pass ui_req_id, or backend extraction failed  
**Investigation:**
```bash
forge logs --environment production --since 10m | grep '"ui_req_id":"ui_missing'
# Shows which resolvers have missing correlation
# Next step: Check UI main.ts wrapper is being called
```

### Problem: `trace_id_stable` is "UNSET" in error logs
**Root cause:** Response from resolver didn't include trace, and renormalization failed  
**Fix:** Check ensureTraceOnError is being called on all error paths  
**Verification:**
```bash
forge logs --environment production --since 5m | grep '"trace_id_stable":"UNSET"'
# Should return zero results
```

---

## Deployment Checklist

- [ ] All files created/updated:
  - [ ] `src/build/backend_build.ts`
  - [ ] `src/gadget-ui/src/main.ts` (invokeWithUiReqId wrapper)
  - [ ] `src/resolvers/gadget-handlers.ts` (extraction, logging)
  - [ ] `src/gadget-resolver.ts` (BACKEND_BUILD_SHA import)
  - [ ] `tools/build_meta.mjs` (injection step)
  
- [ ] Tests created:
  - [ ] `tests/backbone_layer0_instrumentation.test.ts` (unit tests)
  - [ ] `tests/backbone_registry_matches_ui_invokes.test.ts` (CI guard)
  
- [ ] Verification script created:
  - [ ] `tools/l0_verify_backbone.sh` (production verification)
  
- [ ] Build process:
  - [ ] `npm run build:safe` passes all checks
  - [ ] No direct invoke() calls in main.ts
  - [ ] All resolvers registered
  - [ ] backend_build.ts has valid SHA
  
- [ ] Tests pass:
  - [ ] `npm test` (all unit tests)
  - [ ] `npm run backbone:guard` (CI guard)
  
- [ ] Post-deploy verification:
  - [ ] `./tools/l0_verify_backbone.sh 5` passes
  - [ ] Gadget footer shows build SHA
  - [ ] Zero "ui_missing" in resolvers
  - [ ] Zero "unknown" backend_build_sha
  - [ ] Zero "UNSET" trace_id_stable

---

## Key Design Decisions

1. **invokeWithUiReqId wrapper:** Enforces correlation at UI layer, not backend (earlier failure point)
2. **Build-time SHA injection:** No env vars, no runtime git calls → deterministic + immutable
3. **"ui_missing" marker:** NOT random; explicit string for grep verification  
4. **trace_id_stable enforcement:** Always generated if missing → impossible to be UNSET  
5. **Message truncation (200 chars):** Prevents log injection + PII leakage  
6. **CI guard in build:** Prevents deployment of broken wiring  
7. **Production verification script:** Non-interactive, returns PASS/FAIL for automation  

---

## Files Changed

| File | Change | Purpose |
|------|--------|---------|
| `src/build/backend_build.ts` | Created | Single source for backend build SHA |
| `src/gadget-ui/src/main.ts` | Updated | Added invokeWithUiReqId wrapper + replaced all invoke() calls |
| `src/resolvers/gadget-handlers.ts` | Updated | Import BACKEND_BUILD_SHA, enhanced error logging |
| `src/gadget-resolver.ts` | Updated | Import BACKEND_BUILD_SHA |
| `tools/build_meta.mjs` | Updated | Added backend_build.ts injection step |
| `tests/backbone_layer0_instrumentation.test.ts` | Created | Unit tests for extraction, meta, error handling |
| `tests/backbone_registry_matches_ui_invokes.test.ts` | Created | CI guard test for wiring validation |
| `tools/l0_verify_backbone.sh` | Created | Production verification script |

---

## Summary

**BACKBONE_LAYER_0** is a comprehensive instrumentation system that makes correlation and build identity **deterministic and non-bypassable**:

✅ **ui_req_id:** Single source of truth in FT_UI_REQ_ID, injected by wrapper  
✅ **backend_build_sha:** Injected at build time, never "unknown"  
✅ **trace_id_stable:** Enforced on all errors, never UNSET  
✅ **Error logging:** Code + message + trace, truncated for safety  
✅ **CI guard:** Fails build on wiring mismatch or direct invoke() calls  
✅ **Production verification:** Automated script validates all checks  

**Non-bypassable because:**
- Wrapper is the only invoke entry point (enforced by CI test)
- Build SHA is injected, not read from env vars
- Error response normalization is enforced before return
- CI guard fails build on any wiring mismatch

---

**Maintained by:** L0 Backbone Team  
**Last updated:** 2026-01-17  
**Status:** ✅ Production Ready
