# PHASE 0: UI Legacy Path Inventory

**Date:** January 19, 2026 11:30 UTC  
**Status:** AUDIT COMPLETE

---

## Step 1: All invoke() Calls in UI

### Main invoke path (forgeInvoke wrapper):
- **File:** `src/gadget-ui/src/main.ts`
- **Line 2560:** `invokeWithUiReqId('ping', { uiReqId: FT_UI_REQ_ID })`
  - **Status:** LEGACY - ping resolver fallback path

### Wrapper references:
- **File:** `src/gadget-ui/src/main.ts`
- **Line 332:** Comment about invoke() error handling
- **Line 506:** Documentation about invoke() calls
- **Line 570:** Error panel rendering if invoke not available
- **Line 2568:** Comment about invoke() throwing

### Parser references:
- **File:** `src/gadget-ui/src/pingResponseParser.ts`
- Multiple lines referencing invoke() in comments and parser logic

---

## Step 2: Ping Resolver References (LEGACY PATH)

### Active ping usage:
- **File:** `src/gadget-ui/src/main.ts`
- **Lines 2551-2612:** FULL PING FALLBACK BLOCK
  - Line 2554: `// PHASE 5C: First call ping to verify backend is responsive`
  - Line 2556: `let pingResult: any = null;`
  - Line 2560: `pingResult = await invokeWithUiReqId('ping', { uiReqId: FT_UI_REQ_ID });`
  - Line 2561-2584: Extensive ping error handling
  - Line 2589-2612: Ping response parsing and display
  - Line 2729-2731: Ping used as fallback if buildInfo fails

### Legacy mode references:
- **File:** `src/gadget-ui/src/pingResponseParser.ts`
- **Line 16:** `mode: 'TRUTH_ENVELOPE' | 'LEGACY' | 'INVALID';`
  - Supports legacy response parsing
- **Line 27:** Documentation: "Parses ping response from backend into standardized format"
- **Line 79:** `mode: 'LEGACY',` - explicit LEGACY mode handling
- **Line 84:** `code: obj.error?.code || 'LEGACY_REJECTED',`

### Ping-related imports:
- **File:** `src/gadget-ui/src/main.ts`
- **Line 156-157:** `import { parsePingResponse, shouldShowBackendNotResponding, type ParsedPingResponse } from './pingResponseParser';`

---

## Step 3: Forbidden Legacy State Strings (OUTSIDE TESTS)

### UNKNOWN string usage:
- **File:** `src/gadget-ui/src/main.ts`
- **Lines:** 380, 405, 632, 652, 673, 674, 680, 685, 793, 827, 853, 855, 856, 866, 880, 895, 898, 1093, 1126, 1172, 1191, 1210, 1389, 2081, 2084, 2085, 2100, 2101, 2202, 2357, 2498, 2686
  - Used as placeholder/fallback when data unavailable
  - Example (line 632): `data = EMPTY_STATUS_V1("UNKNOWN", "unknown", UI_BUILD_VERSION);`
  - Example (line 680): `storageStatus: data.storage?.status || 'UNKNOWN',`

- **File:** `src/gadget-ui/src/enterprise/statusModel.ts`
- **Lines:** 5, 10, 41, 51, 152, 202
  - Type definition: `type Severity = 'OK' | 'WARNING' | 'DEGRADED' | 'ERROR' | 'UNKNOWN';`

- **File:** `src/gadget-ui/src/traceDiagnostics.ts`
- **Lines:** 121, 243
  - `UNKNOWN: 'Unable to determine storage state'`
  - `value: model.errorCode || 'UNKNOWN'`

- **File:** `src/gadget-ui/src/statusFormatter.ts`
- **Lines:** 41, 47, 53, 54, 56, 59, 61, 64, 66
  - Used in freshness computation when schedule is null

- **File:** `src/gadget-ui/src/truthModel.ts`
- **Lines:** 73, 77, 92, 101, 104
  - Type definitions: `tenantIdentityStatus: "OK" | "MISSING" | "UNKNOWN";`
  - Storage status includes UNKNOWN

- **File:** `src/gadget-ui/src/freshness_invariants.ts`
- **Lines:** 11, 27, 64, 79, 89, 148
  - Freshness type includes UNKNOWN

### INITIALIZING string usage:
- **File:** `src/gadget-ui/src/enterprise/renderKpiTiles.ts`
- **Line 25:** `reasonCode: "INITIALIZING_NO_DATA"`
  - Placeholder for loading state

- **File:** `src/gadget-ui/src/main.ts`
- **Line 795:** `'INITIALIZING': 'initializing',`
  - Mapping for initializing state

### NOT_AVAILABLE string usage:
- **File:** `src/gadget-ui/src/main.ts`
- **Line 819:** `} else if (data.freshnessStatus === 'NOT_AVAILABLE') {`
  - Freshness status rendering

- **File:** `src/gadget-ui/src/traceDiagnostics.ts`
- **Line 122:** `NOT_AVAILABLE: 'Storage is not available',`
  - Diagnostic message

---

## Summary of Issues

1. **Active Legacy Ping Path:** Main.ts lines 2551-2612 calls 'ping' resolver as fallback
2. **Ping Response Parser:** Full LEGACY mode support maintained in pingResponseParser.ts
3. **Placeholder Strings in Production Code:** UNKNOWN/INITIALIZING/NOT_AVAILABLE appear in:
   - Main dashboard rendering (main.ts)
   - Status models (enterprise/statusModel.ts)
   - State models (truthModel.ts, freshness_invariants.ts)
4. **No Single Source of Truth:** UI uses ft_getDashboardState_v1 response but has fallback ping path

---

## Required Actions

1. Remove ping resolver path (lines 2551-2612 in main.ts)
2. Delete pingResponseParser.ts entirely
3. Remove LEGACY mode support
4. Replace UNKNOWN/INITIALIZING/NOT_AVAILABLE with render-time guards
5. Add fail-closed error panel for backend unavailability
6. Implement structured trace return from backend
7. Add CI guards to prevent reintroduction
