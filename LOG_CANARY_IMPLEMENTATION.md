# LOG_CANARY Implementation - Production Log Stream Proof

**Commit:** `[main eac52890]` - BACKBONE: add LOG_CANARY to prove production log stream

## Overview

Added an unavoidable log canary to the `getBuildInfo` resolver that proves we are reading the correct production log stream for the running gadget.

## Implementation Details

### Where
**File:** [atlassian/forge-app/src/resolvers/getBuildInfo.ts](atlassian/forge-app/src/resolvers/getBuildInfo.ts)

**Resolver:** `getBuildInfo_resolver` - Guaranteed to run on gadget load (invoked by UI on every page load)

### What
Added LOG_CANARY log statement at the **very top** of the resolver, before any possible error handling:

```typescript
console.log(`LOG_CANARY resolver=getBuildInfo build=${FT_BUILD_SHA} ts=${resolvedAt} ui_req_id=${uiReqId || 'UNSET'}`);
```

### Format
```
LOG_CANARY resolver=getBuildInfo build=4688c2a ts=2026-01-17T16:36:05.328Z ui_req_id=test-req-123
```

**Fields:**
- `resolver=getBuildInfo` - Identifies the resolver that emitted the canary
- `build=<7-char SHA>` - Backend build SHA for version correlation
- `ts=<ISO timestamp>` - Exact timestamp when resolver executed
- `ui_req_id=<id or UNSET>` - UI request ID for correlation (UNSET if not provided)

## Requirements Met

✅ **Executes BEFORE any throw** - Log at top of try block, before tenant resolution  
✅ **Does not change response structure** - No modification to BuildInfo interface or return value  
✅ **Guaranteed on gadget load** - getBuildInfo is invoked on every dashboard page load  
✅ **Includes all required fields** - resolver name, build SHA, timestamp, UI request ID  
✅ **No handler wrapper swallowing** - Direct console.log, not wrapped in error handlers

## Proof Steps (Documented in Code Comment)

1. **Deploy to production**
   - Merge this branch to main
   - Trigger production deployment

2. **Reload gadget in dashboard**
   - Navigate to your Jira dashboard with the gadget installed
   - Hard refresh (Cmd+Shift+R / Ctrl+Shift+R)

3. **Check logs**
   ```bash
   timeout 90 forge logs --environment production --since 10m | grep -F "LOG_CANARY" | head -50
   ```

4. **Interpretation**
   - **If lines found:** ✅ We are reading the correct production log stream AND resolver executed AND deploy is active
   - **If zero lines:** ❌ Either:
     - Not reading correct log stream (check auth/app installation)
     - Resolver never executed (check manifest/UI wiring)
     - Deploy not active (check deployment status)

## Tests

**File:** [atlassian/forge-app/tests/getBuildInfo.test.ts](atlassian/forge-app/tests/getBuildInfo.test.ts)

8 test cases, all passing:

```
✓ should emit LOG_CANARY on resolver entry
✓ should include build SHA in LOG_CANARY
✓ should include ISO timestamp in LOG_CANARY
✓ should include UI request ID in LOG_CANARY
✓ should use UNSET for ui_req_id if not provided
✓ should emit LOG_CANARY even on error path
✓ should return BuildInfo with ok=true on success
✓ should never throw
```

### Test Strategy
- Mocks `console.log` using vitest `spyOn`
- Verifies LOG_CANARY format matches regex pattern
- Confirms all required fields are present
- Validates UNSET fallback for missing ui_req_id
- Ensures resolver maintains no-throw contract

## Why This Matters

**Problem:** In production, it's difficult to verify we're:
1. Reading the correct log stream for the running app
2. Actually invoking the resolver at all
3. That our code changes have been deployed

**Solution:** LOG_CANARY is an unavoidable marker that appears in logs if and only if:
- The resolver code has been deployed
- The resolver is being invoked
- We are reading the correct log stream

This is far more reliable than binary flags or version strings that might be misleading.

## Safety & Performance

- **No performance impact:** Single console.log statement
- **Always executes:** At top of resolver, before errors
- **No side effects:** Returns same BuildInfo response
- **Correlation:** Includes UI request ID for request tracing
- **Deterministic:** Same format every time, easy to grep

## Deployment Checklist

- [x] LOG_CANARY added to getBuildInfo resolver
- [x] Tests written and passing
- [x] Comment documents proof steps
- [x] Format is grep-friendly (single line, no JSON)
- [x] Includes all required fields
- [x] No response structure changes
- [x] Committed and ready

## Related Documentation

- Build info verification: See [BUILDINFO_AUDIT_PROOF_README.md](BUILDINFO_AUDIT_PROOF_README.md)
- Forensic reporting: See [FORENSIC_CHECK_REPORT.md](FORENSIC_CHECK_REPORT.md)
- Resolver architecture: [atlassian/forge-app/src/gadget-resolver.ts](atlassian/forge-app/src/gadget-resolver.ts)
