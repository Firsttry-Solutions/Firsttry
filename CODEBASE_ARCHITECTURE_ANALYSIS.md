# Firsttry Codebase Architecture Analysis

## Executive Summary

The Firsttry codebase uses a **LAYER-0 backbone architecture** with deterministic correlation IDs, TruthEnvelope contract validation, and fail-closed error handling. The system enforces strict contracts between UI and Backend through a shared canonical data structure and comprehensive error classification system.

---

## 1. RESOLVER ARCHITECTURE & IMPLEMENTATION

### 1.1 Resolver Structure

**Location:** [`src/resolvers/`](src/resolvers/)

All resolvers follow the **NO-THROW contract**: they never throw exceptions. Instead, they always return structured responses with explicit error codes.

**Key Resolver Files:**

| File | Purpose | Key Contract |
|------|---------|--------------|
| [ping.ts](atlassian/forge-app/src/resolvers/ping.ts) | Health check with correlation | REQUIRES `ui_req_id`, echoes back exactly |
| [probe.ts](atlassian/forge-app/src/resolvers/probe.ts) | Forensic correlation proof | REQUIRES `ui_req_id`, optional `probeNonce` |
| [getBuildInfo.ts](atlassian/forge-app/src/resolvers/getBuildInfo.ts) | Build metadata | Returns `FT_BUILD_SHA` and timestamp, NEVER "unknown" |
| [getStatusSnapshot.ts](atlassian/forge-app/src/resolvers/getStatusSnapshot.ts) | Current operational snapshot | Returns normalized `GovernanceStatusV1`, no throws |
| [getOperationalState.ts](atlassian/forge-app/src/resolvers/getOperationalState.ts) | Operational metrics | Performs storage probe (write+read), returns deterministic state |
| [getSnapshotDebug.ts](atlassian/forge-app/src/resolvers/getSnapshotDebug.ts) | Debug info for UI proof panel | Shows storage state, snapshot count, timestamps |

### 1.2 Resolver Pattern: ping.ts Example

```typescript
// ping.ts (lines 46-194)
export async function ping(req?: any): Promise<TruthEnvelope<PingData>> {
  const resolverName = "ping";
  const backendBuildSha = BACKEND_BUILD_SHA;  // Injected at build time
  const nowIso = new Date().toISOString();

  // STEP 1: Extract uiReqId (REQUIRED for correlation)
  const uiReqId = req?.payload?.ui_req_id || req?.headers?.["x-firsttry-ui-req-id"] || req?.ui_req_id;

  // STEP 2: Generate stable trace ID
  const traceIdStable = `ping-${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;

  // STEP 3: Log entry marker (for grep verification)
  console.log(JSON.stringify({
    marker: "FT_PING_ENTRY",
    trace_id_stable: traceIdStable,
    ui_req_id: uiReqId || "MISSING",
    resolver_name: resolverName,
    timestamp_iso: nowIso,
  }));

  // STEP 4: FAIL CLOSED - uiReqId is REQUIRED
  if (!uiReqId) {
    const emptyData: PingData = { respondedAt: nowIso, env: "unknown" };
    const errorEnvelope = createErrorEnvelope<PingData>(
      "ping",
      "NO_CORRELATION_ID",  // Placeholder when truly missing
      null,
      "MISSING_UI_REQ_ID",
      "UI request ID is required for correlation"
    );
    return errorEnvelope;
  }

  // STEP 5: Create success response (TruthEnvelope-wrapped)
  const pingData: PingData = { respondedAt: nowIso, env: process.env.NODE_ENV || "unknown" };
  return createSuccessEnvelope<PingData>(
    "ping",
    uiReqId,         // Echo back exact ui_req_id
    null,
    pingData,
    backendBuildSha,
    null,
    traceIdStable
  );
}
```

**Key Patterns:**
- Extract `ui_req_id` with defined precedence
- Log entry/exit with JSON markers for grep verification
- Use `BACKEND_BUILD_SHA` (injected at build time, never "unknown")
- Return `TruthEnvelope<T>` wrapper (not raw data)
- Echo back `ui_req_id` for correlation proof
- FAIL CLOSED on missing required IDs (return error envelope, don't fallback)

### 1.3 How Resolvers Are Called

**From UI ([main.ts](atlassian/forge-app/src/gadget-ui/src/main.ts#L408-L442)):**

```typescript
// invokeWithUiReqId wrapper (guarantees every call includes ui_req_id)
async function invokeWithUiReqId<T>(
  resolverName: string,
  payload?: any
): Promise<T> {
  const enrichedPayload = {
    ...(payload || {}),
    ui_req_id: FT_UI_REQ_ID  // Single source of truth: FT_UI_REQ_ID
  };
  return await invoke<T>(resolverName, enrichedPayload);
}

// Usage:
try {
  rawData = await invokeWithUiReqId('getStatusSnapshot', { ui_req_id: FT_UI_REQ_ID });
} catch (e) {
  invokeError = e instanceof Error ? e.message : String(e);
  invokeErrorThrown = true;
  console.error('Bridge.invoke threw exception:', invokeError);
}
```

---

## 2. ERROR HANDLING PATTERNS

### 2.1 Error Handling Architecture

**Location:** [src/resolvers/backbone_error_handling.ts](atlassian/forge-app/src/resolvers/backbone_error_handling.ts)

All errors follow a **deterministic classification system** with three IDs:

| ID Type | Purpose | Generation |
|---------|---------|-----------|
| `error_code` | Machine-readable classification | `classifyError()` function |
| `trace_id_stable` | Deterministic (groups same error types) | SHA256(code + name + message + sha) |
| `trace_id_instance` | Unique per invocation | SHA256(trace_id_stable + stack) |

### 2.2 Error Classification: classifyError()

```typescript
// backbone_error_handling.ts (lines 57-97)
export function classifyError(error: any, context?: string): ErrorCode {
  const msg = error instanceof Error ? error.message : String(error);
  const name = error instanceof Error ? error.name : "UnknownError";

  // Tenant errors
  if (msg.includes("tenant") || msg.includes("Tenant") || msg.includes("TenantContextError")) {
    return "TENANT_CONTEXT_MISSING";
  }

  // Storage errors
  if (name.includes("Storage") || msg.includes("storage")) {
    return "STORAGE_ERROR";
  }

  // Jira API errors
  if (msg.includes("Jira") || msg.includes("jira") || msg.includes("401") || msg.includes("403")) {
    return "JIRA_API_ERROR";
  }

  // Permission errors
  if (msg.includes("permission") || msg.includes("forbidden") || msg.includes("denied")) {
    return "PERMISSION_DENIED";
  }

  // Network/timeout
  if (msg.includes("ECONNREFUSED") || msg.includes("timeout")) {
    return "NETWORK_ERROR";
  }

  // Build metadata errors
  if (msg.includes("BUILD_") || msg.includes("build")) {
    return "BUILD_METADATA_MISSING";
  }

  // Default: unhandled
  return "RESOLVER_UNHANDLED_EXCEPTION";
}

export type ErrorCode =
  | "TENANT_CONTEXT_MISSING"
  | "STORAGE_ERROR"
  | "JIRA_API_ERROR"
  | "RESOLVER_UNHANDLED_EXCEPTION"
  | "BUILD_METADATA_MISSING"
  | "PERMISSION_DENIED"
  | "NETWORK_ERROR"
  | "TIMEOUT";
```

### 2.3 Trace ID Generation

```typescript
// Generate stable trace ID (same for same error type)
export function generateTraceIdStable(
  errorCode: ErrorCode,
  error: any,
  backendBuildSha: string | null
): string {
  const errorName = error instanceof Error ? error.name : "UnknownError";
  const errorMsg = error instanceof Error ? error.message : String(error);
  // Deterministic input: code + name + message + sha (NO stack, so stable across instances)
  const input = [errorCode, errorName, errorMsg, backendBuildSha || "no-sha"].join("|");
  const fullHash = createHash("sha256").update(input).digest("hex");
  return fullHash.substring(0, 16);
}

// Generate instance trace ID (unique per stack trace)
export function generateTraceIdInstance(
  traceIdStable: string,
  error: any
): string {
  const stackTop = error instanceof Error && error.stack ? error.stack.substring(0, 500) : "";
  const input = [traceIdStable, stackTop].join("|");
  const fullHash = createHash("sha256").update(input).digest("hex");
  return fullHash.substring(0, 16);
}
```

### 2.4 Error Logging

```typescript
// backbone_error_handling.ts (lines 168-209)
export function emitResolverErrorLog(
  traceIdStable: string,
  traceIdInstance: string | null,
  errorCode: ErrorCode,
  errorMsg: string,
  backendBuildSha: string | null,
  uiReqId: string | null,
  resolverName: string
): void {
  // ENFORCEMENT: backendBuildSha must not be null
  if (!backendBuildSha || backendBuildSha === "unknown") {
    throw new Error(
      `BACKBONE_BUILD_SHA_NOT_PROVIDED: Resolver "${resolverName}" must import BACKEND_BUILD_SHA`
    );
  }

  const logObject = {
    level: "error",
    component: "resolver",
    resolver: resolverName,
    trace_id_stable: traceIdStable,
    trace_id_instance: traceIdInstance || undefined,
    error_code: errorCode,
    message: errorMsg.substring(0, 200),
    ui_req_id: uiReqId || "unknown",
    backend_build_sha: backendBuildSha,  // Never "unknown"
    timestamp_iso: new Date().toISOString(),
  };

  console.error(JSON.stringify(logObject));
}
```

### 2.5 Error Propagation in Resolvers

**From [getStatusSnapshot.ts](atlassian/forge-app/src/resolvers/getStatusSnapshot.ts#L32-L75):**

```typescript
try {
  const tenantInfo = resolveTenantKey(context);
  tenantKey = tenantInfo.tenantKey;
  tenantKeyHash = tenantInfo.tenantKeyHash;
  tenantStatus = "OK";
} catch (err) {
  // Classify error
  const errorCode = classifyError(err, "getStatusSnapshot");
  
  // Generate stable and instance trace IDs
  const traceIdStable = generateTraceIdStable(errorCode, err, FT_BUILD_SHA);
  const traceIdInstance = generateTraceIdInstance(traceIdStable, err);
  const errorMsg = err instanceof Error ? err.message : String(err);

  // Emit single-line JSON log
  emitResolverErrorLog(
    traceIdStable,
    traceIdInstance,
    errorCode,
    errorMsg,
    FT_BUILD_SHA,
    uiReqId,
    "getStatusSnapshot"
  );

  // Return error status (NOT throw)
  tenantStatus = "MISSING";
  const errorStatus = EMPTY_STATUS_V1("UNKNOWN", FT_BUILD_SHA, "UI_v2.14.0");
  errorStatus.health = "ERROR";
  errorStatus.degradedReason = "Could not resolve tenant context";
  return normalizeStatusV1(errorStatus, "UNKNOWN", FT_BUILD_SHA, "UI_v2.14.0");
}
```

### 2.6 UI Error Handling

**From [main.ts](atlassian/forge-app/src/gadget-ui/src/main.ts#L300-L395):**

```typescript
interface NormalizedError {
    kind: string;           // err.name or "UnknownError"
    message: string;        // err.message with fallbacks
    stack: string;          // err.stack or ""
    code: string;           // extracted from nested paths
    traceId: string;        // extracted from nested paths
    raw: string;            // full serialization via safeJsonStringify
}

function normalizeInvokeError(err: any): NormalizedError {
    // Extract code from nested paths (probe/ping may nest error details)
    let code = 'UNKNOWN';
    const codeSearchPaths = [
        () => err?.code,
        () => err?.errorCode,
        () => err?.details?.code,
        () => err?.error?.code,
        () => err?.statusCode
    ];
    
    for (const pathFn of codeSearchPaths) {
        try {
            const val = pathFn();
            if (val && (typeof val === 'string' || typeof val === 'number')) {
                code = String(val);
                break;
            }
        } catch {}
    }

    // Extract traceId from nested paths
    let traceId = 'UNKNOWN';
    const traceSearchPaths = [
        () => err?.traceId,
        () => err?.details?.traceId,
        () => err?.error?.trace_id_stable
    ];
    
    for (const pathFn of traceSearchPaths) {
        try {
            const val = pathFn();
            if (val && (typeof val === 'string' || typeof val === 'number')) {
                traceId = String(val);
                break;
            }
        } catch {}
    }

    // Serialize raw error (safe, handles circulars + bigints)
    const raw = safeJsonStringify(err);
    
    return { kind, message, stack, code, traceId, raw };
}
```

---

## 3. TRUTHENVELOPE CONTRACT

### 3.1 TruthEnvelope Structure

**Location:** [src/shared/truth_contract.ts](atlassian/forge-app/src/shared/truth_contract.ts)

The **TruthEnvelope** is the canonical wrapper for all ping/probe responses:

```typescript
export interface TruthEnvelope<T> {
  /** Operation success: true=ok/data populated, false=error populated */
  ok: boolean;
  /** Operation kind (used for routing and logging) */
  kind: "ping" | "probe";
  /** Schema version (for forward compatibility) */
  schemaVersion: "1";
  /** ISO timestamp when response was generated */
  generatedAt: string;
  /** Correlation IDs for matching with UI logs */
  correlation: CorrelationData;
  /** Build metadata (UI + backend versions) */
  build: BuildMetadata;
  /** Trace metadata for debugging */
  trace: TraceData;
  /** Success payload (non-null if ok=true, null if ok=false) */
  data: T | null;
  /** Error payload (non-null if ok=false, null if ok=true) */
  error: ErrorPayload | null;
}
```

### 3.2 Supporting Interfaces

```typescript
// Correlation metadata (REQUIRED on every response)
export interface CorrelationData {
  /** UI-generated request ID (REQUIRED, echoed from request) */
  uiReqId: string;
  /** UI-generated probe nonce (optional, echoed from request if provided) */
  probeNonce?: string | null;
}

// Build metadata
export interface BuildMetadata {
  /** UI artifact SHA (from entry script filename like app.f1c06fb.js) */
  uiArtifactSha: string | null;
  /** Backend build SHA (injected at build time) */
  backendSha: string | null;
  /** UI version (e.g., "2.115.0") */
  uiVersion: string | null;
  /** Backend environment (e.g., "production", "dev", null for unknown) */
  backendEnv: string | null;
}

// Trace metadata for debugging
export interface TraceData {
  /** Stable trace ID from backend (null if generation failed) */
  traceId: string | null;
  /** Optional instance ID for this resolver invocation */
  instanceId?: string | null;
}

// Error payload when response fails
export interface ErrorPayload {
  /** Machine-readable error code (e.g., "MISSING_UI_REQ_ID", "INTERNAL_ERROR") */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Optional details object (must not contain undefined fields) */
  details?: Record<string, any> | null;
}

// Success payload types
export interface PingData {
  /** Proof that backend responded at this timestamp */
  respondedAt: string;
  /** Optional backend environment info */
  env?: string | null;
}

export interface ProbeData {
  /** Proof that probe executed at this timestamp */
  executedAt: string;
  /** Probe results (varies by probe type) */
  result: Record<string, any> | null;
}
```

### 3.3 TruthEnvelope Factory Functions

```typescript
// Create error envelope
export function createErrorEnvelope<T>(
  kind: "ping" | "probe",
  uiReqId: string,
  probeNonce: string | null | undefined,
  errorCode: string,
  errorMessage: string,
  buildSha: string | null,
  uiArtifactSha: string | null,
  traceId: string | null
): TruthEnvelope<T> {
  return {
    ok: false,
    kind,
    schemaVersion: "1",
    generatedAt: new Date().toISOString(),
    correlation: {
      uiReqId,
      probeNonce: probeNonce || null,
    },
    build: {
      uiArtifactSha: uiArtifactSha || null,
      backendSha: buildSha || null,
      uiVersion: null,
      backendEnv: null,
    },
    trace: {
      traceId: traceId || null,
    },
    data: null,
    error: {
      code: errorCode,
      message: errorMessage,
      details: null,
    },
  };
}

// Create success envelope
export function createSuccessEnvelope<T>(
  kind: "ping" | "probe",
  uiReqId: string,
  probeNonce: string | null | undefined,
  data: T,
  buildSha: string | null,
  uiArtifactSha: string | null,
  traceId: string | null
): TruthEnvelope<T> {
  return {
    ok: true,
    kind,
    schemaVersion: "1",
    generatedAt: new Date().toISOString(),
    correlation: {
      uiReqId,
      probeNonce: probeNonce || null,
    },
    build: {
      uiArtifactSha: uiArtifactSha || null,
      backendSha: buildSha || null,
      uiVersion: null,
      backendEnv: null,
    },
    trace: {
      traceId: traceId || null,
    },
    data,
    error: null,
  };
}
```

### 3.4 Undefined Normalization

All responses must have **zero undefined fields**:

```typescript
// Normalize all undefined values recursively to null
export function normalizeUndefinedToNull<T extends Record<string, any>>(
  obj: T
): T {
  if (obj === null || obj === undefined) {
    return null as any;
  }

  if (typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item =>
      typeof item === "object" && item !== null
        ? normalizeUndefinedToNull(item)
        : item === undefined
        ? null
        : item
    ) as any;
  }

  const result: Record<string, any> = {};
  for (const key in obj) {
    let value = obj[key];
    if (value === undefined) {
      value = null;  // Convert undefined to null
    } else if (typeof value === "object" && value !== null) {
      value = normalizeUndefinedToNull(value);
    }
    result[key] = value;
  }

  return result as T;
}

// Assert no undefined fields (for testing)
export function assertNoUndefinedFields(
  obj: any,
  path: string = "root"
): void {
  if (obj === null || obj === undefined) {
    if (obj === undefined) {
      throw new Error(`Undefined value at path: ${path}`);
    }
    return;
  }

  if (typeof obj !== "object") {
    return;
  }

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      assertNoUndefinedFields(obj[i], `${path}[${i}]`);
    }
    return;
  }

  for (const key in obj) {
    const value = obj[key];
    if (value === undefined) {
      throw new Error(`Undefined field at path: ${path}.${key}`);
    }
    if (typeof value === "object" && value !== null) {
      assertNoUndefinedFields(value, `${path}.${key}`);
    }
  }
}
```

---

## 4. UI DATA FLOW

### 4.1 UI Entry Point

**Location:** [src/gadget-ui/src/main.ts](atlassian/forge-app/src/gadget-ui/src/main.ts)

The UI follows a **deterministic boot sequence**:

```typescript
// LAYER-0: UI ENTRY RUNTIME PROOF (runs immediately before any other code)
declare const __FT_BUILD_SHA__: string | undefined;
declare const __FT_BUILD_TIME__: string | undefined;

// Immediately capture proof before any other module executes
(() => {
  const ui_git_sha = typeof __FT_BUILD_SHA__ !== 'undefined' ? __FT_BUILD_SHA__ : 'UNSET';
  const ui_git_time = typeof __FT_BUILD_TIME__ !== 'undefined' ? __FT_BUILD_TIME__ : 'UNSET';
  
  // Extract entry bundle URL and hash
  const proof = {
    marker: 'UI_ENTRY_RUNTIME_PROOF',
    ui_git_sha,
    ui_git_time,
    ui_entry_bundle_url,
    ui_entry_bundle_hash,
    script_srcs: scripts,
    href: window.location.href,
    iso: new Date().toISOString(),
  };

  (window as any).__FT_RUNTIME_ENTRY_PROOF__ = proof;
  console.log('[UI_ENTRY_RUNTIME_PROOF]', JSON.stringify(proof));
})();

// Import invoke from @forge/bridge
import { invoke } from '@forge/bridge';

// UI Request ID: Unique per page load
const FT_UI_REQ_ID = `ui_${Date.now()}_${Math.random().toString(16).slice(2).substring(0, 8)}`;
```

### 4.2 UI Boot Proof Logging

```typescript
// Log to console immediately on module load
(function captureBootProof() {
  try {
    const scriptUrls: string[] = [];
    for (const script of document.scripts) {
      if (script.src) {
        scriptUrls.push(script.src);
      }
    }
    
    // Single-line proof: git SHA, time, and loaded script(s)
    console.log(
      `[UI_BOOT_PROOF] ui_git_sha=${UI_GIT_SHA} time=${UI_BUILD_TIME_UTC} ` +
      `scripts=[${scriptUrls.join('; ')}] uiReqId=${FT_UI_REQ_ID}`
    );
    
    for (let i = 0; i < scriptUrls.length; i++) {
      console.log(`[UI_BOOT_SCRIPT_${i}] ${scriptUrls[i]}`);
    }
  } catch (err) {
    console.error('[UI_BOOT_PROOF] Error capturing boot proof:', err);
  }
})();
```

### 4.3 Main Load Function

**Key Sequence:**

1. **CSS Canary Check** - Verify styles are applied
2. **Self-Tests** - Check bridge availability
3. **Invoke Resolver** - Call `getStatusSnapshot` with correlation ID
4. **Normalize Data** - Convert to `GovernanceStatusV1`
5. **Compute View Model** - Build deterministic state from signals
6. **Render Widgets** - Display UI components

```typescript
async function loadStatus() {
  // STEP 0: Report Bridge mode
  setText('ui-selftest-bridge-mode', BRIDGE_MODE);
  setText('ui-selftest-invoke-available', INVOKE_AVAILABLE ? 'YES' : 'NO');

  // STEP 1: CSS canary check
  if (!checkCSSCanary()) {
    throw new Error('CSS_NOT_APPLIED: UI CSS not applied');
  }

  // STEP 2: Run self-tests BEFORE invoke
  setText('ui-selftest-marker', 'FOUND');
  setText('ui-selftest-css', cssOk ? 'OK' : 'FAIL');
  setText('ui-selftest-js', 'OK (JS executed)');

  // STEP 3: Invoke resolver with error handling
  let rawData: any = null;
  let invokeError: string | null = null;

  try {
    rawData = await invokeWithUiReqId('getStatusSnapshot', { ui_req_id: FT_UI_REQ_ID });
  } catch (e) {
    invokeError = e instanceof Error ? e.message : String(e);
    console.error('Bridge.invoke threw exception:', invokeError);
  }

  // CRITICAL: Normalize data immediately after receiving it
  let data: GovernanceStatusV1;
  if (!rawData || invokeError) {
    data = EMPTY_STATUS_V1("UNKNOWN", "unknown", UI_BUILD_VERSION);
    data.health = "ERROR";
    data.degradedReason = invokeError || 'No data returned';
    // ... show error panel
    return;
  }

  data = normalizeStatusV1(rawData, ...);
  lastPayload = data;

  // PHASE 4: Compute deterministic view model
  let viewModel: GovernanceViewModel;
  try {
    const signals: RuntimeSignals = {
      tenantIdentityStatus: data.tenantStatus || 'UNKNOWN',
      backendStatus: data.systemStatus || 'UNKNOWN',
      scheduleStatus: data.scheduler?.status || 'NOT_CONFIGURED',
      expectedScheduleIntervalMinutes: ...,
      lastSuccessfulRunISO: data.lastSuccessAt || null,
      lastAttemptISO: data.lastAttemptAt || null,
      snapshot: data.snapshotData || null,
      storageStatus: data.storage?.status || 'UNKNOWN',
      snapshotCountRetained: data.snapshotCountRetained || 0,
      // ... more signals
    };
    
    viewModel = computeGovernanceViewModel(signals);
  } catch (vmError) {
    console.error('[TruthModel] Compute failed:', vmError);
    // ... fall back to error state
    return;
  }

  // PHASE 5: Render UI components
  // ... render KPI tiles, status banner, trust section, etc.
}
```

### 4.4 Response Normalization

**From [statusSchema.ts](atlassian/forge-app/src/shared/statusSchema.ts):**

The UI normalizes all responses to `GovernanceStatusV1`:

```typescript
export function normalizeStatusV1(
  input: any,
  tenantAri: string,
  backendBuild: string,
  uiBuild: string
): GovernanceStatusV1 {
  // Normalize all arrays and provide safe defaults
  const result: GovernanceStatusV1 = {
    tenantStatus: input?.tenantStatus || "UNKNOWN",
    systemStatus: input?.systemStatus || "UNKNOWN",
    health: input?.health || "UNKNOWN",
    backendBuild: backendBuild || "unknown",
    uiBuild: uiBuild || "ui_unknown",
    
    // Arrays: always array or empty
    checks: Array.isArray(input?.checks) ? input.checks : [],
    coverageIncluded: Array.isArray(input?.coverageIncluded) ? input.coverageIncluded : [],
    coverageExcluded: Array.isArray(input?.coverageExcluded) ? input.coverageExcluded : [],
    knownDataGaps: Array.isArray(input?.knownDataGaps) ? input.knownDataGaps : [],
    
    // Objects: provide safe defaults
    storage: input?.storage || { status: "UNKNOWN", snapshotCountRetained: 0 },
    scheduler: input?.scheduler || { status: "NOT_CONFIGURED" },
    
    // Timestamps
    lastSuccessAt: typeof input?.lastSuccessAt === 'string' ? input.lastSuccessAt : null,
    lastAttemptAt: typeof input?.lastAttemptAt === 'string' ? input.lastAttemptAt : null,
    
    // ... more fields
  };
  
  return result;
}

// Empty status (for error states)
export const EMPTY_STATUS_V1 = (tenantAri: string, backendBuild: string, uiBuild: string): GovernanceStatusV1 => ({
  tenantStatus: "UNKNOWN",
  systemStatus: "UNKNOWN",
  health: "UNKNOWN",
  backendBuild,
  uiBuild,
  checks: [],
  coverageIncluded: [],
  coverageExcluded: [],
  knownDataGaps: [],
  // ... all other fields as null/empty/defaults
});
```

### 4.5 Build Information Display

**From [buildInfo.ts](atlassian/forge-app/src/gadget-ui/src/buildInfo.ts):**

```typescript
// Uses ui_build_meta.ts (auto-generated at build time)
import { UI_GIT_SHA, UI_BUILD_TIME_UTC } from './ui_build_meta';

export function getBuildIdentifier(): string {
  return `Build: ${UI_GIT_SHA} • ${UI_BUILD_TIME_UTC}`;
}

export function isDevBuild(): boolean {
  return buildShaShort === 'dev' || buildTimeUtc === 'dev';
}
```

**UI displays:**
- Git SHA from bundled code
- Build time (UTC)
- Loaded script URLs
- UI Request ID (for correlation)

---

## 5. STORAGE ACCESS PATTERNS

### 5.1 Storage API Usage

**Location:** [src/resolvers/getOperationalState.ts](atlassian/forge-app/src/resolvers/getOperationalState.ts)

Storage is accessed via Forge API:

```typescript
import { storage } from "@forge/api";

// Perform storage probe: write nonce, read it back, clean up
async function probeStorage(): Promise<{
  canWrite: boolean;
  canRead: boolean;
  errorCode?: string;
  errorMessage?: string;
}> {
  const probeKey = `probe:${Date.now()}`;
  const probeValue = `nonce_${Math.random().toString(16).substring(2)}`;

  try {
    // Write to storage
    await storage.set(probeKey, probeValue);

    // Read back immediately
    const readBack = await storage.get(probeKey);

    if (readBack === probeValue) {
      // Success: storage is working
      return { canWrite: true, canRead: true };
    } else {
      // Read back failed: data corrupted or not written
      return {
        canWrite: false,
        canRead: false,
        errorCode: "PROBE_READ_MISMATCH",
        errorMessage: "Written data could not be read back correctly"
      };
    }
  } catch (err) {
    // Write or read failed
    try {
      await storage.delete(probeKey);  // Cleanup
    } catch (_) {}

    return {
      canWrite: false,
      canRead: false,
      errorCode: "STORAGE_PROBE_FAILED",
      errorMessage: err instanceof Error ? err.message : String(err)
    };
  }
}
```

### 5.2 Storage Key Patterns

**Key Convention:** `t/{tenantKeyHash}:{type}:{id}`

```typescript
function getStoragePrefix(tenantKeyHash: string): string {
  return `t/${tenantKeyHash}`;
}

// Usage:
const prefix = getStoragePrefix(tenantKeyHash);
const lastFiredKey = `${prefix}:scheduler:lastFired`;
const lastRunResultKey = `${prefix}:scheduler:lastRunResult`;
const snapshotCountKey = `${prefix}:snapshots:count`;
const latestIdKey = `${prefix}:snapshots:latestId`;

// Read from storage
const fired = await storage.get(lastFiredKey);
const result = await storage.get(lastRunResultKey);
const countObj = await storage.get(snapshotCountKey);
const latestIdObj = await storage.get(latestIdKey);
```

### 5.3 Storage State Checking

**From [getStatusSnapshot.ts](atlassian/forge-app/src/resolvers/getStatusSnapshot.ts):**

```typescript
// Read current snapshot from storage
async function readSnapshot(tenantKey: string): Promise<GovernanceStatusV1 | null> {
  try {
    const snapshotMeta = await storage.get(`snapshot:meta:${tenantKey}`);
    if (!snapshotMeta) {
      return null;
    }
    return snapshotMeta;
  } catch (err) {
    // Storage read failed
    return null;
  }
}

// Write snapshot to storage
async function putStatusSnapshot(snapshot: GovernanceStatusV1): Promise<void> {
  try {
    await storage.set(`snapshot:meta:${snapshot.tenantKey}`, snapshot);
  } catch (err) {
    throw new Error(`STORAGE_WRITE_FAILED: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// Create on-load snapshot if storage is empty
let snapshot = await readSnapshot(tenantKey);
if (!snapshot) {
  snapshot = createNoSchedulerSnapshot(tenantKey);
  await putStatusSnapshot(snapshot);
  console.info(`Created on-load snapshot for ${tenantKey}`);
}

// Verify write was successful (catch tenant key mismatches immediately)
const readBack = await readSnapshot(tenantKey);
if (!readBack) {
  throw new Error(`SNAPSHOT_VERIFICATION_FAILED: snapshot not readable after write`);
}
```

### 5.4 Storage Signals in UI

**From [main.ts](atlassian/forge-app/src/gadget-ui/src/main.ts#L1119-L1150):**

```typescript
// Safe read: snapshotAgeMinutes
const snapshotAge = data?.snapshotAgeMinutes;
let storageBadgeClass: string;
let storageLabel: string;
let storageImpact: string;

if (snapshotAge !== null && snapshotAge !== undefined) {
  storageBadgeClass = 'signal-available';
  storageLabel = 'HAS_DATA';
  storageImpact = 'Full metrics available';
} else {
  storageBadgeClass = 'signal-unavailable';
  storageLabel = 'EMPTY';
  storageImpact = 'First run pending';
}

// Render storage status signal
const signalsHtml = `
  <div class="signal-item">
    <span class="signal-label">Storage State</span>
    <span class="signal-badge ${storageBadgeClass}">${storageLabel}</span>
  </div>
  <div class="signal-impact">Impact: ${storageImpact}</div>
`;
```

---

## 6. CORRELATION ID FLOW (End-to-End)

### 6.1 UI Generates ui_req_id

```typescript
// main.ts (line ~102)
const FT_UI_REQ_ID = `ui_${Date.now()}_${Math.random().toString(16).slice(2).substring(0, 8)}`;

// Example: ui_1705330552123_a4f2c8d1
```

### 6.2 UI Injects into Every Resolver Call

```typescript
// main.ts (lines 408-442)
async function invokeWithUiReqId<T>(
  resolverName: string,
  payload?: any
): Promise<T> {
  const enrichedPayload = {
    ...(payload || {}),
    ui_req_id: FT_UI_REQ_ID  // ALWAYS injected
  };
  return await invoke<T>(resolverName, enrichedPayload);
}

// Usage:
await invokeWithUiReqId('getStatusSnapshot', { ui_req_id: FT_UI_REQ_ID });
```

### 6.3 Backend Extracts and Validates

```typescript
// backbone_error_handling.ts (line 256)
export function extractUiReqId(req: any): string | null {
  return req?.payload?.uiReqId || req?.uiReqId || req?.ui_req_id || null;
}

// Usage in ping.ts:
const uiReqId = req?.payload?.ui_req_id || 
                req?.headers?.["x-firsttry-ui-req-id"] || 
                req?.ui_req_id;

if (!uiReqId) {
  // FAIL CLOSED: return error envelope
  return createErrorEnvelope<PingData>(
    "ping",
    "NO_CORRELATION_ID",
    null,
    "MISSING_UI_REQ_ID",
    "UI request ID is required for correlation"
  );
}
```

### 6.4 Backend Echoes Back in Response

```typescript
// ping.ts (line ~135)
const pingData: PingData = { respondedAt: nowIso, env: process.env.NODE_ENV };
return createSuccessEnvelope<PingData>(
  "ping",
  uiReqId,  // ← ECHO BACK exact ui_req_id
  null,
  pingData,
  backendBuildSha,
  null,
  traceIdStable
);
```

### 6.5 UI Validates Echo

**From [ping response parser](atlassian/forge-app/src/gadget-ui/src/pingResponseParser.ts):**

```typescript
export function parsePingResponse(response: any): ParsedPingResponse {
  return {
    ok: response?.ok || false,
    correlation: {
      uiReqId: response?.correlation?.uiReqId || "MISSING",
      probeNonce: response?.correlation?.probeNonce || null
    },
    build: {
      backendSha: response?.build?.backendSha || "UNKNOWN",
      uiArtifactSha: response?.build?.uiArtifactSha || null
    },
    trace: {
      traceId: response?.trace?.traceId || "UNKNOWN"
    },
    error: response?.error || null
  };
}
```

### 6.6 Log Correlation for Grep Verification

**Backend logs:**
```json
{
  "marker": "FT_PING_ENTRY",
  "ui_req_id": "ui_1705330552123_a4f2c8d1",
  "trace_id_stable": "ping-1705330552_3a2b9c",
  "resolver_name": "ping",
  "timestamp_iso": "2025-01-19T..Z"
}
```

**UI verification:**
```bash
# Grep for specific ui_req_id in production logs
timeout 90 forge logs --environment production --since 10m | grep "ui_1705330552123_a4f2c8d1"
```

---

## 7. SUMMARY TABLE

| Aspect | Implementation | Location |
|--------|----------------|----------|
| **Correlation ID** | Generated client-side on page load | [main.ts#L102](atlassian/forge-app/src/gadget-ui/src/main.ts#L102) |
| **Injection** | `invokeWithUiReqId` wrapper (guaranteed) | [main.ts#L408](atlassian/forge-app/src/gadget-ui/src/main.ts#L408) |
| **Extraction** | `extractUiReqId(req)` with precedence | [backbone_error_handling.ts#L256](atlassian/forge-app/src/resolvers/backbone_error_handling.ts#L256) |
| **Response Wrapping** | `TruthEnvelope<T>` (immutable contract) | [truth_contract.ts](atlassian/forge-app/src/shared/truth_contract.ts) |
| **Error Classification** | `classifyError()` → `ErrorCode` enum | [backbone_error_handling.ts#L57](atlassian/forge-app/src/resolvers/backbone_error_handling.ts#L57) |
| **Trace ID Generation** | Stable (deterministic) + Instance (unique) | [backbone_error_handling.ts#L113](atlassian/forge-app/src/resolvers/backbone_error_handling.ts#L113) |
| **Error Logging** | Single-line JSON with all correlation IDs | [backbone_error_handling.ts#L168](atlassian/forge-app/src/resolvers/backbone_error_handling.ts#L168) |
| **Storage Access** | `storage` API via `@forge/api` | [getOperationalState.ts#L16](atlassian/forge-app/src/resolvers/getOperationalState.ts#L16) |
| **Storage Probe** | Write + Read + Delete (verifies connectivity) | [getOperationalState.ts#L95](atlassian/forge-app/src/resolvers/getOperationalState.ts#L95) |
| **Data Normalization** | `normalizeStatusV1()` (safe defaults) | [statusSchema.ts](atlassian/forge-app/src/shared/statusSchema.ts) |
| **Build Info** | Injected at build time (never "unknown") | [backend_build_meta.ts](atlassian/forge-app/src/shared/backend_build_meta.ts) |
| **No-Throw Contract** | All resolvers return structured responses | [getStatusSnapshot.ts#L32](atlassian/forge-app/src/resolvers/getStatusSnapshot.ts#L32) |
| **UI Error Handling** | `normalizeInvokeError()` safe serialization | [main.ts#L300](atlassian/forge-app/src/gadget-ui/src/main.ts#L300) |

---

## Key Architectural Principles

1. **FAIL CLOSED**: Missing required IDs → error envelope (never fallback)
2. **NO UNDEFINED**: All responses normalize undefined → null
3. **DETERMINISTIC TRACING**: Same error type → same stable trace ID
4. **SINGLE SOURCE OF TRUTH**: FT_UI_REQ_ID for UI, BACKEND_BUILD_SHA for backend
5. **NEVER THROWS**: All resolvers return structured responses with error codes
6. **GREP VERIFIABLE**: JSON logs include correlation IDs for production debugging
7. **CONTRACT-ENFORCED**: TruthEnvelope immutable structure for all responses
8. **STORAGE PROBE**: Write+Read+Delete to verify connectivity and tenant key accuracy

