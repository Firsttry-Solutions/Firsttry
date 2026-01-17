# FORENSIC_PROBE Technical Design Document

## Document Purpose

This document provides a comprehensive technical specification of the FORENSIC_PROBE feature, which proves that the Firsttry UI can invoke the backend and receive responses that are traceable in production logs.

---

## 1. Overview

### Goal

Provide **undeniable proof** that:
- ✅ UI successfully invokes the backend probe resolver
- ✅ Backend generates a unique, non-guessable nonce
- ✅ The nonce can be found in production logs
- ✅ The same nonce exists in both UI response and backend logs (correlation)

### Why This Matters

For regulatory/compliance scenarios, we need to prove that the application is functioning end-to-end. The probe provides:
- **Deterministic proof** - not probabilistic or heuristic-based
- **Grepped from production logs** - definitive source of truth
- **Unforgeable nonce** - cryptographically random
- **Timestamped** - exact point-in-time proof

### Non-Goal

The probe does NOT:
- Mutate any data
- Trigger jobs/pipelines
- Generate audit trails
- Create compliance artifacts
- Perform authentication/authorization checks

---

## 2. Architecture

### Component Diagram

```
┌─────────────────────────────────────────────┐
│ FRONTEND (Browser)                          │
│ ┌──────────────────────────────────────┐   │
│ │ Gadget UI (Vite Bundle)             │   │
│ │ ┌─────────────────────────────────┐ │   │
│ │ │ main.ts: runProbe()            │ │   │
│ │ │ - Builds payload                │ │   │
│ │ │ - Calls invoke('probe', ...)    │ │   │
│ │ │ - Displays nonce + grep cmd    │ │   │
│ └─────────────────────────────────┘ │   │
│ └──────────────────────────────────┘   │
└─────────────────┬──────────────────────┘
                  │
        ┌─────────▼─────────┐
        │  @forge/bridge    │
        │  invoke('probe')  │
        └─────────┬─────────┘
                  │
        ┌─────────▼─────────────────────┐
        │ Atlassian Forge Platform      │
        │ (Network, Auth, Routing)      │
        └─────────┬─────────────────────┘
                  │
┌─────────────────▼──────────────────────┐
│ BACKEND (Node.js)                      │
│ ┌──────────────────────────────────┐  │
│ │ gadget-handlers.ts               │  │
│ │ (Handler Dispatcher)             │  │
│ │ ┌────────────────────────────┐  │  │
│ │ │ ALLOWED_RESOLVERS          │  │  │
│ │ │ - probe ← FORENSIC_PROBE   │  │  │
│ │ │ - other resolvers...       │  │  │
│ │ └────────────────┬───────────┘  │  │
│ │                  │               │  │
│ │                  ▼               │  │
│ │ ┌────────────────────────────┐  │  │
│ │ │ probe.ts: probe()          │  │  │
│ │ │ - Extract ui_req_id        │  │  │
│ │ │ - Generate nonce           │  │  │
│ │ │ - Log JSON marker          │  │  │
│ │ │ - Return meta + observed   │  │  │
│ │ └────────────────┬───────────┘  │  │
│ └────────────────┼───────────────┘  │
└──────────────────┼──────────────────┘
                   │
        ┌──────────▼──────────┐
        │ console.log({       │
        │   marker: 'PROBE',  │
        │   probe_nonce: ..., │
        │   ...               │
        │ })                  │
        └────────────┬────────┘
                     │
        ┌────────────▼────────────┐
        │ Production Logs (Forge) │
        │ (Grepable by nonce)     │
        └─────────────────────────┘
```

### Data Flow Sequence

```
1. USER: Clicks "Run Probe" button
   └─> Triggers window.runProbe()

2. UI: Build correlation payload
   Payload = {
     ui_req_id: 'ui_1768...',           (primary field)
     uiReqId: 'req_compat_1768...',     (compat format)
     requestId: 'rid_1768...',          (legacy field)
     meta: {
       ui_req_id: 'ui_1768...',
       uiReqId: 'req_compat_1768...'
     }
   }

3. UI: Call invoke('probe', payload)
   └─> Sends HTTP request to backend

4. BACKEND: gadget-handlers.handler() receives request
   ├─> Extract resolverName = 'probe' (from payload)
   ├─> Extract ui_req_id using canonical precedence
   ├─> Log RESOLVER_ENTER marker (grepable)
   └─> Call probe() resolver

5. BACKEND: probe() executes
   ├─> Generate nonce: 'probe_1768..._af14b920'
   ├─> Extract ui_req_id from payload (same precedence)
   ├─> Capture observed fields (payload_keys, correlation_fields)
   ├─> Log JSON marker with PROBE + nonce
   ├─> Return response { ok:true, meta:{nonce,...}, observed:{...} }
   └─> Log RESOLVER_OK marker (grepable)

6. BACKEND: console.log emitted
   Output: {"marker":"PROBE","probe_nonce":"probe_...","ui_req_id":"ui_..."}
   └─> Captured by Forge log system
   └─> Stored in production logs (searchable/grepable)

7. UI: Response arrives
   ├─> Extract meta.probe_nonce
   ├─> Extract meta.ui_req_id
   ├─> Display in UI panel
   ├─> Generate grep command: "bash tools/probe_prod.sh --nonce <nonce>"
   └─> Show to user

8. USER: Runs verification script
   command: bash tools/probe_prod.sh --nonce probe_1768..._af14b920
   ├─> Capture Forge production logs
   ├─> Grep for nonce in logs
   ├─> Find JSON marker with exact nonce
   ├─> Verify ui_req_id matches
   ├─> Extract build SHA (verify consistency)
   └─> Output: PASS / FAIL

9. RESULT: Proof complete ✅
   - Nonce exists in UI response
   - Same nonce found in production logs
   - Correlation established
   - QED: End-to-end invocation worked
```

---

## 3. Component Specifications

### 3.1 Frontend: runProbe()

**File:** `src/gadget-ui/src/main.ts` (line ~1452)

**Function Signature:**
```typescript
window.runProbe = async function(): Promise<void>
```

**Purpose:**
- Expose globally for button onclick handlers
- Build correlation payload
- Invoke probe resolver
- Display results in UI

**Payload Structure:**
```typescript
{
  ui_req_id: string,           // Primary (format: ui_<ts>_<hex>)
  uiReqId: string,             // Compat (format: req_compat_...)
  requestId: string,           // Legacy (format: rid_<ts>)
  meta: {
    ui_req_id: string,
    uiReqId: string
  }
}
```

**Error Handling:**
- Try/catch wraps entire function
- Catches invoke() errors
- Catches element manipulation errors
- Displays user-friendly error in panel

**Response Handling:**
```typescript
if (response.ok && response.meta) {
  // Extract key fields
  meta.ui_req_id       → Display in "UI Req ID" field
  meta.probe_nonce     → Display in "Probe Nonce" field
  meta.backend_build_sha → Display in "Backend Build SHA" field
  meta.forge_env       → Display in "Forge Env" field
  
  // Generate grep commands
  grep "${meta.ui_req_id}" <logs>
  bash tools/probe_prod.sh --nonce ${meta.probe_nonce}
}
```

**UI Elements Updated:**
- `#probe-status` - Status text ("Running probe..." → "✅ Probe completed...")
- `#probe-run-btn` - Button state (enable/disable)
- `#probe-response-panel` - Full JSON response
- `#probe-ui-req-id` - Extracted UI request ID
- `#probe-nonce` - Extracted nonce (primary proof artifact)
- `#probe-backend-build-sha` - Build metadata
- `#probe-forge-env` - Environment metadata
- `#probe-grep-ui-req-id` - Grep command for UI req ID
- `#probe-grep-nonce` - Grep command for nonce (definitive)

---

### 3.2 Backend: probe() Resolver

**File:** `src/resolvers/probe.ts`

**Function Signature:**
```typescript
export async function probe(req?: any): Promise<ProbeResponse>
```

**Input Parameters:**
```typescript
req: {
  payload?: any;  // From gadget-handlers
  context?: any;  // Forge context (cloudId, accountId, etc.)
}
```

**Algorithm:**

1. **Extract Parameters**
   ```typescript
   const payload = req?.payload || req || {}
   const nowIso = new Date().toISOString()
   const probeNonce = `probe_${Date.now()}_${randomHex(8)}`
   const backendBuildSha = getBackendBuildSha()
   const forgeEnv = process.env.FORGE_ENV || 'unknown'
   ```

2. **Extract ui_req_id (Canonical Precedence Chain)**
   ```
   Precedence:
   1. payload.ui_req_id
   2. payload.meta.ui_req_id
   3. payload.uiReqId
   4. payload.meta.uiReqId
   5. payload.requestId
   6. payload.reqId
   7. (generated fallback)
   
   Normalization:
   - If starts with "req_" → convert to "ui_"
   - If missing → generate "ui_missing_<ts>_<random>"
   ```

3. **Capture Observations**
   ```typescript
   observed: {
     payload_keys: Object.keys(payload),
     correlation_fields: {
       ui_req_id: payload?.ui_req_id,
       uiReqId: payload?.uiReqId,
       // ...other correlation fields
     },
     context_signals: {
       cloudId: req?.context?.cloudId,
       accountId_hash: hashShort(req?.context?.accountId),
       // ...environment signals
     }
   }
   ```

4. **Build Meta**
   ```typescript
   meta: ProbeMeta = {
     ui_req_id: uiReqId,          // Extracted from payload
     probe_nonce: probeNonce,      // Generated by backend
     backend_build_sha: buildSha,  // From env/config
     now_iso: nowIso,              // Current timestamp
     node: process.version,        // Node version
     function_name: 'probe-resolver',
     forge_env: forgeEnv
   }
   ```

5. **Log JSON Marker** ⭐ **CRITICAL**
   ```typescript
   console.log(JSON.stringify({
     marker: 'PROBE',
     ui_req_id: uiReqId,
     probe_nonce: probeNonce,
     backend_build_sha: backendBuildSha,
     forge_env: forgeEnv,
     function_name: functionName,
     observed: observed
   }))
   ```
   
   **Why JSON format?**
   - Machine-readable
   - Grepable by nonce
   - Parseable by verification script
   - Searchable in log aggregation systems

6. **Return Response**
   ```typescript
   return {
     ok: true,
     meta,
     observed
   }
   ```

**Error Handling:**
- Catches any exception during execution
- Returns `ok: false` with error details
- Logs error marker with trace_id_stable
- Never throws (always returns gracefully)

**Response Type:**
```typescript
interface ProbeResponse {
  ok: boolean;
  meta: ProbeMeta;
  observed: ProbeObserved;
  error?: ProbeErrorInfo;
}
```

---

### 3.3 Backend: Handler Registration

**File:** `src/resolvers/gadget-handlers.ts`

**Allowlist Registration:**
```typescript
const ALLOWED_RESOLVERS: Record<string, (req: any) => Promise<any>> = {
  probe: probe,              // ← FORENSIC_PROBE
  ping: ping,
  ensureFirstSnapshot: ensureFirstSnapshot,
  getOperationalState: getOperationalState_resolver,
  refreshNow: refreshNow_resolver,
  getBuildInfo: getBuildInfo_resolver,
  getSnapshotDebug: getSnapshotDebug_resolver,
  getStatusSnapshot: getStatusSnapshot_resolver,
  exportSnap: exportSnap_resolver
};
```

**Invocation:**
```typescript
export async function handler(req: any) {
  const payload = req.payload || req
  const resolverName = payload.resolverName || 'getStatusSnapshot'
  
  // Check allowlist
  if (!(resolverName in ALLOWED_RESOLVERS)) {
    return { ok: false, error: { code: 'INVOKE_KEY_NOT_ALLOWED' } }
  }
  
  // Execute resolver
  const resolver = ALLOWED_RESOLVERS[resolverName]
  const response = await resolver(req)
  
  // Normalize response (ensure trace_id_stable, meta)
  return ensureTraceOnError(response, resolverName, ui_req_id)
}
```

---

### 3.4 Verification Script: probe_prod.sh

**File:** `tools/probe_prod.sh`

**Usage:**
```bash
bash tools/probe_prod.sh --nonce <PROBE_NONCE> [--ui <UI_REQ_ID>]
# OR (legacy)
bash tools/probe_prod.sh <UI_REQ_ID> <PROBE_NONCE>
```

**Algorithm:**

1. **Parse Arguments**
   - Support both `--nonce` and legacy positional formats
   - Extract PROBE_NONCE (required)
   - Extract UI_REQ_ID (optional)

2. **Capture Logs** (Step 1-2)
   - Run `forge whoami` (identity proof)
   - Run `forge install list --environment production` (version proof)
   - Capture git HEAD (code version)
   - Capture production logs (5000 lines + 2-hour window)

3. **Search for Nonce** (Step 3)
   - Grep for exact nonce in logs
   - Count occurrences
   - Extract full log line(s)

4. **Verify Correlation** (Step 4)
   - Parse JSON from matching line(s)
   - Extract ui_req_id from log
   - Compare with UI_REQ_ID (if provided)
   - Extract backend_build_sha

5. **Generate Report** (Step 5)
   - PASS: Nonce found, fields verified
   - FAIL: Nonce not found or fields missing
   - Exit code 0 (success) or 1 (failure)

**Output Example (Success):**
```
================================
FORENSIC_PROBE Production Capture
================================

UI_REQ_ID:   ui_1768662844441_af14b920
PROBE_NONCE: probe_1768662844441_af14b920
Output dir:  /tmp/ft_probe_20250117_143522

... (log capture) ...

=== VERIFICATION RESULTS ===

✓ PROBE nonce found in logs (1 occurrence)

Log entry:
{
  "marker": "PROBE",
  "ui_req_id": "ui_1768662844441_af14b920",
  "probe_nonce": "probe_1768662844441_af14b920",
  "backend_build_sha": "cdfa04fba064",
  "forge_env": "production"
}

✓ Backend processed the probe invocation
✓ Correlation ID verified (ui_1768662844441_af14b920)
✓ Build SHA extracted (cdfa04fba064)
✓ All required fields present

SUCCESS: Probe verification complete!
```

---

## 4. Data Structures

### 4.1 ProbeMeta

```typescript
interface ProbeMeta {
  ui_req_id: string;             // Extracted from UI payload
  probe_nonce: string;           // Generated by backend
  backend_build_sha: string;     // From deployment
  now_iso: string;               // Timestamp (ISO 8601)
  node: string;                  // Node version
  function_name: string;         // "probe-resolver"
  forge_env: string;             // "production" or other
}
```

**Example:**
```json
{
  "ui_req_id": "ui_1768662844441_af14b920",
  "probe_nonce": "probe_1768662844441_af14b920",
  "backend_build_sha": "cdfa04fba064",
  "now_iso": "2025-01-17T14:35:22.123Z",
  "node": "v20.10.0",
  "function_name": "probe-resolver",
  "forge_env": "production"
}
```

### 4.2 ProbeObserved

```typescript
interface ProbeObserved {
  payload_keys: string[];
  correlation_fields: Record<string, any>;
  context_signals: Record<string, any>;
}
```

**Example:**
```json
{
  "payload_keys": ["ui_req_id", "uiReqId", "requestId", "meta"],
  "correlation_fields": {
    "ui_req_id": "ui_1768662844441_af14b920",
    "uiReqId": "req_compat_1768662844441_af14b920",
    "requestId": "rid_1768662844441",
    "meta_ui_req_id": "ui_1768662844441_af14b920",
    "meta_uiReqId": "req_compat_1768662844441_af14b920"
  },
  "context_signals": {
    "cloudId": "...",
    "accountId_hash": "abc123...",
    "environment": "production"
  }
}
```

### 4.3 ProbeResponse

```typescript
interface ProbeResponse {
  ok: boolean;
  meta: ProbeMeta;
  observed: ProbeObserved;
  error?: ProbeErrorInfo;
}
```

**Success Example:**
```json
{
  "ok": true,
  "meta": { ... },
  "observed": { ... }
}
```

**Error Example:**
```json
{
  "ok": false,
  "meta": { ... },
  "observed": { ... },
  "error": {
    "code": "PROBE_EXCEPTION",
    "message": "...",
    "trace_id_stable": "trace_probe_abc123_1768662844441"
  }
}
```

---

## 5. Security Considerations

### 5.1 Nonce Generation

**Method:** `crypto.randomBytes(8).toString('hex')`
- 64-bit entropy (8 bytes)
- Cryptographically secure random
- Unforgeable by users
- Format: 16 hex characters

**Not Sensitive:**
- Nonce is not a secret
- Safe to display in UI
- Safe to include in logs
- Safe to share publicly (contains no PII)

### 5.2 Information Disclosure

**Safe to Log:**
- `probe_nonce` - random, no sensitivity
- `ui_req_id` - user-generated, public
- `backend_build_sha` - deployment info (public)
- `forge_env` - environment name (public)

**Not Logged:**
- Account IDs (hashed with SHA256)
- Cloud IDs (passed through but not displayed)
- Installation contexts (hashed)
- User PII (never captured)

### 5.3 Allowlist Enforcement

**Critical:** Probe is in the `ALLOWED_RESOLVERS` allowlist
- UI cannot invoke non-whitelisted resolvers
- Prevents arbitrary function invocation
- Added at deployment time

---

## 6. Error Handling

### 6.1 Probe Error Paths

| Scenario | Response | Error Code |
|----------|----------|-----------|
| Invoke fails (HTTP error) | catch block | varies |
| Backend offline | timeout | N/A |
| Resolver exception | ok:false | PROBE_EXCEPTION |
| Resolver not in allowlist | ok:false | INVOKE_KEY_NOT_ALLOWED |
| Malformed payload | ok:true (tolerant) | (none) |

### 6.2 Recovery Strategies

**If Probe Fails:**
1. Check backend is deployed: `forge install list --environment production`
2. Check logs for resolver errors: `forge logs | grep -i probe`
3. Verify allowlist: `grep -A 5 "ALLOWED_RESOLVERS" src/resolvers/gadget-handlers.ts`
4. Redeploy: `forge deploy --environment production`

---

## 7. Performance Characteristics

### 7.1 Latency

| Component | Typical Latency | Max Latency |
|-----------|-----------------|-------------|
| UI invoke() call | 0-50ms | 100ms |
| Backend resolve | 10-50ms | 100ms |
| JSON logging | 1-5ms | 10ms |
| Total roundtrip | 50-150ms | 300ms |

### 7.2 Resource Usage

| Resource | Usage |
|----------|-------|
| CPU | Negligible (< 1%) |
| Memory | ~1MB (response size) |
| Network | ~5KB (request + response) |
| Logs | ~500 bytes per invocation |

---

## 8. Testing Strategy

### 8.1 Unit Tests

**File:** `src/resolvers/probe.test.ts` (if created)

```typescript
describe('probe resolver', () => {
  it('generates valid nonce format', () => {
    // Nonce matches: probe_<timestamp>_<hex>
    expect(nonce).toMatch(/^probe_\d+_[a-f0-9]{16}$/)
  })
  
  it('extracts ui_req_id from payload', () => {
    // Tests precedence chain
    expect(extracted).toBe(payload.ui_req_id)
  })
  
  it('normalizes req_ to ui_ prefix', () => {
    // req_* → ui_*
    expect(normalized).toBe('ui_...')
  })
  
  it('returns valid response structure', () => {
    // Check ok, meta, observed fields
    expect(response).toHaveProperty('meta.probe_nonce')
  })
})
```

### 8.2 Integration Tests

**Manual Flow:**
1. Click "Run Probe" in UI
2. Wait for response
3. Copy nonce
4. Run verification script
5. Verify PASS

---

## 9. Deployment Checklist

- [ ] `probe()` function implemented in `src/resolvers/probe.ts`
- [ ] `probe` imported in `src/resolvers/gadget-handlers.ts`
- [ ] `probe` added to `ALLOWED_RESOLVERS`
- [ ] `runProbe()` function added to `src/gadget-ui/src/main.ts`
- [ ] HTML elements added to `src/gadget-ui/index.html`
- [ ] UI builds without errors: `npm run build`
- [ ] Backend compiles: TypeScript no errors
- [ ] Verification script present: `tools/probe_prod.sh`
- [ ] Manifest includes probe handler (via `gadget-handlers`)
- [ ] App deploys successfully: `forge deploy --environment production`
- [ ] Probe widget visible in deployed gadget
- [ ] "Run Probe" button works and returns response
- [ ] Nonce can be grepped from production logs

---

## 10. Future Enhancements (Out of Scope)

- [ ] Rate limiting on probe endpoint
- [ ] Audit logging of probe invocations
- [ ] Dashboard widget for probe history
- [ ] Automated probe scheduling
- [ ] Probe result webhooks
- [ ] Multi-nonce correlation tracking

---

## References

- [PROBE_RUNBOOK.md](./PROBE_RUNBOOK.md) - User guide
- [FRONTEND_PROBE_DEPLOYMENT.md](./FRONTEND_PROBE_DEPLOYMENT.md) - Deployment guide
- [src/resolvers/probe.ts](./src/resolvers/probe.ts) - Implementation
- [src/gadget-ui/src/main.ts](./src/gadget-ui/src/main.ts#L1452) - UI code
- [src/resolvers/gadget-handlers.ts](./src/resolvers/gadget-handlers.ts) - Handler

---

**Document Version:** 1.0
**Last Updated:** 2025-01-17
**Status:** ✅ Complete
**Owner:** Governance Team
