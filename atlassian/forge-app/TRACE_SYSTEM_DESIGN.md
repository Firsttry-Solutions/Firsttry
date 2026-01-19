---
title: Structured Trace and Error-Code Propagation System
version: 1.0.0
date: January 19, 2026
---

# Structured Trace & Error-Code Propagation System

## Overview

This system provides comprehensive tracing and error-code propagation throughout the Firsttry resolver architecture, enabling the UI to display detailed diagnostic information about resolver execution failures.

## Architecture Components

### 1. Error Code Enums (`src/ops/structured_trace.ts`)

**Comprehensive error codes organized by category:**

- **Correlation & Request Validation (1000-1099)**
  - `MISSING_UI_REQ_ID`: UI request ID not provided (FAIL CLOSED)
  - `INVALID_UI_REQ_ID_FORMAT`: UI request ID format invalid
  - `REQUEST_BODY_PARSING_FAILED`: Request body could not be parsed

- **Tenant/Authorization (1100-1199)**
  - `MISSING_TENANT_CONTEXT`: Tenant context not available
  - `TENANT_CONTEXT_EXTRACTION_FAILED`: Failed to extract tenant context
  - `UNAUTHORIZED_TENANT`: Tenant not authorized

- **Storage Access (1200-1299)**
  - `STORAGE_UNAVAILABLE`: Storage service not available
  - `STORAGE_READ_FAILED`: Failed to read from storage
  - `STORAGE_WRITE_FAILED`: Failed to write to storage
  - `STORAGE_VERIFICATION_FAILED`: Storage verification failed

- **External APIs (1300-1499)**
  - `FORGE_INVOKE_FAILED`: Forge API invocation failed
  - `JIRA_API_ERROR`: Generic Jira API error

- **Internal Errors (1700-1799)**
  - `INTERNAL_ERROR`: Generic internal error
  - `INVARIANT_VIOLATED`: Internal contract violation
  - `TIMEOUT`: Operation timeout

### 2. Structured Trace Type

```typescript
interface StructuredTrace {
  resolverName: string;           // "ping", "probe", etc.
  uiReqId: string;               // From UI request
  forgeRequestId?: string;        // From Forge context
  traceId: string | null;         // Stable trace ID
  steps: TraceStep[];             // Execution steps
  finalErrorCode?: ErrorCode;     // If error occurred
  storageState?: StorageProof;    // Storage verification
  buildSha?: string;              // Version tracking
  executionTimeMs?: number;       // Performance data
}

interface TraceStep {
  stepId: StepId;                 // Execution step ID
  startedAt: string;              // ISO timestamp
  completedAt?: string;           // ISO timestamp
  success: boolean;               // Step outcome
  errorCode?: ErrorCode;          // If step failed
  message: string;                // Human-readable message
  metadata?: Record<string, any>; // Additional context
}

interface StorageProof {
  state: StorageState;            // EXISTS | EMPTY | UNKNOWN | NOT_AVAILABLE
  checkedAt: string;              // ISO timestamp
  keyAccessed?: string;           // Safe to log
  verificationPassed?: boolean;   // For probe operations
  proofDetails?: string;          // e.g., "verified write-then-read"
}
```

### 3. Step IDs for Execution Flow

**22 step IDs for fine-grained tracing:**

```
REQUEST_RECEIVED → REQUEST_PARSED
  ↓
EXTRACT_UI_REQ_ID → VALIDATE_UI_REQ_ID
  ↓
EXTRACT_TENANT_CONTEXT → VALIDATE_TENANT_CONTEXT
  ↓
CHECK_STORAGE_AVAILABILITY
  ↓
STORAGE_READ_INITIATED → STORAGE_READ_COMPLETED
  ↓
(optional) STORAGE_VERIFICATION_INITIATED → STORAGE_VERIFICATION_COMPLETED
  ↓
DATA_PROCESSING_STARTED → DATA_NORMALIZATION_STARTED → DATA_NORMALIZATION_COMPLETED
  ↓
TRUTH_ENVELOPE_BUILDING → RESPONSE_SERIALIZATION
```

### 4. Integration with TruthEnvelope

The `ErrorPayload` now includes optional trace information:

```typescript
interface ErrorPayload {
  code: string;           // Error code (e.g., "STORAGE_READ_FAILED")
  message: string;        // Error message
  details?: Record<...>;  // Optional details
  trace?: {               // NEW: Structured trace information
    resolverName?: string;
    stepCount?: number;
    failedStepId?: string;
    storageState?: string;
    executionTimeMs?: number;
  };
}
```

## Implementation Guide

### For Backend Resolvers

```typescript
import {
  initializeResolverTrace,
  recordSuccessStep,
  recordFailureStep,
  recordStorageOperation,
  completeTrace,
} from '../resolvers/trace_integration';

export async function ping(req?: any): Promise<TruthEnvelope<PingData>> {
  const startTime = Date.now();
  
  // 1. Initialize trace
  const { uiReqId, forgeRequestId } = extractTraceContext(req);
  const trace = initializeResolverTrace(
    'ping',
    uiReqId,
    generateTraceId(),
    forgeRequestId
  );

  try {
    // 2. Validate uiReqId
    if (!uiReqId) {
      recordFailureStep(
        trace,
        STEP_IDS.VALIDATE_UI_REQ_ID,
        ERROR_CODES.MISSING_UI_REQ_ID,
        'UI request ID is required'
      );
      
      completeTrace(trace, startTime, BACKEND_BUILD_SHA);
      
      return createErrorEnvelope<PingData>(
        'ping',
        uiReqId,
        null,
        ERROR_CODES.MISSING_UI_REQ_ID,
        'UI request ID is required',
        BACKEND_BUILD_SHA,
        null,
        trace.traceId
      );
    }
    
    recordSuccessStep(
      trace,
      STEP_IDS.VALIDATE_UI_REQ_ID,
      'UI request ID validated'
    );

    // 3. Check tenant context
    const tenantContext = await extractTenantContext(req);
    if (!tenantContext) {
      recordFailureStep(
        trace,
        STEP_IDS.VALIDATE_TENANT_CONTEXT,
        ERROR_CODES.MISSING_TENANT_CONTEXT,
        'Tenant context not available'
      );
      
      completeTrace(trace, startTime, BACKEND_BUILD_SHA);
      
      return createErrorEnvelopeWithTrace(...);
    }

    recordSuccessStep(
      trace,
      STEP_IDS.VALIDATE_TENANT_CONTEXT,
      'Tenant context validated'
    );

    // 4. Success case
    recordSuccessStep(
      trace,
      STEP_IDS.TRUTH_ENVELOPE_BUILDING,
      'Truth envelope building'
    );

    completeTrace(trace, startTime, BACKEND_BUILD_SHA);

    return createSuccessEnvelope<PingData>(
      'ping',
      uiReqId,
      null,
      { respondedAt: new Date().toISOString() },
      BACKEND_BUILD_SHA,
      null,
      trace.traceId
    );

  } catch (err) {
    // 5. Error handling
    const errorCode = classifyErrorCode(err);
    
    recordFailureStep(
      trace,
      STEP_IDS.ERROR_CLASSIFIED,
      errorCode,
      err.message
    );

    completeTrace(trace, startTime, BACKEND_BUILD_SHA);

    return createErrorEnvelopeWithTrace(
      'ping',
      uiReqId,
      null,
      errorCode,
      getErrorMessage(errorCode),
      BACKEND_BUILD_SHA,
      null,
      trace.traceId,
      trace  // Include structured trace in error
    );
  }
}
```

### For UI Error Display

```typescript
import {
  buildTraceDisplayModel,
  formatTraceForErrorDisplay,
  getTraceInfoBlocks,
} from './traceDiagnostics';

// When error response received:
function handleResolverError(envelope: TruthEnvelope<any>) {
  if (!envelope.ok && envelope.error) {
    const traceData = envelope.error.trace;
    
    // Build display model
    const model = buildTraceDisplayModel(
      traceData?.resolverName || 'unknown',
      envelope.correlation.uiReqId,
      envelope.trace.traceId,
      undefined, // forgeRequestId not in envelope
      envelope.error.code,
      traceData?.steps,
      traceData?.storageState,
      traceData?.executionTimeMs,
      envelope.build.backendSha
    );

    // Format for display
    const diagnosticsText = formatTraceForErrorDisplay(model);
    const infoBlocks = getTraceInfoBlocks(model);

    // Show in error dialog
    showErrorDialog({
      title: `${model.resolverName} Failed`,
      message: envelope.error.message,
      diagnostics: diagnosticsText,
      infoBlocks: infoBlocks,
    });
  }
}
```

## Storage State Tracking

Storage operations are tracked with proof:

```typescript
// When storage read succeeds
const proof = createStorageProof(
  STORAGE_STATES.EXISTS,
  'probe:user123:snapshot',
  true,
  'verified write-then-read'
);
recordStorageOperation(trace, 'READ', true, proof);

// When storage is empty
const emptyProof = createStorageProof(
  STORAGE_STATES.EMPTY,
  'probe:user123:snapshot',
  undefined,
  'key does not exist'
);
recordStorageOperation(trace, 'READ', false, emptyProof, ERROR_CODES.STORAGE_EMPTY);
```

## UI Display Format

### Error Info Block
```
📊 Resolver: ping
   UI Request ID: a1f2b3c4d5e6f7g8...
   Trace ID: h9i0j1k2l3m4n5o6...
   Error Code: STORAGE_READ_FAILED
   Steps: 7 (failed at step 5)
   Storage State: EMPTY
   Execution Time: 142ms
   Build SHA: f1c06fb
```

### Execution Steps
```
✓ [1/7] Request Received
✓ [2/7] Request Parsed
✓ [3/7] Extract UI Request ID
✓ [4/7] Validate UI Request ID
✗ [5/7] Storage Read Completed
      Error: STORAGE_READ_FAILED
✓ [6/7] Error Classified
✓ [7/7] Error Response Building
```

## Testing

### Unit Tests for Trace Creation
```typescript
describe('StructuredTrace', () => {
  it('should initialize trace with resolver name', () => {
    const trace = createStructuredTrace('ping', 'req123', 'trace456');
    expect(trace.resolverName).toBe('ping');
    expect(trace.uiReqId).toBe('req123');
  });

  it('should add steps to trace', () => {
    const trace = createStructuredTrace('ping', 'req123');
    addTraceStep(trace, STEP_IDS.REQUEST_RECEIVED, true, 'Received');
    expect(trace.steps).toHaveLength(1);
    expect(trace.steps[0].stepId).toBe('REQUEST_RECEIVED');
  });

  it('should set finalErrorCode when step fails', () => {
    const trace = createStructuredTrace('ping', 'req123');
    addTraceStep(
      trace,
      STEP_IDS.VALIDATE_UI_REQ_ID,
      false,
      'Failed',
      ERROR_CODES.MISSING_UI_REQ_ID
    );
    expect(trace.finalErrorCode).toBe(ERROR_CODES.MISSING_UI_REQ_ID);
  });
});
```

### Integration Tests with Resolvers
```typescript
describe('Ping Resolver with Tracing', () => {
  it('should include trace in error response', async () => {
    const response = await ping({});
    
    expect(response.ok).toBe(false);
    expect(response.error).toBeDefined();
    expect(response.error.trace).toBeDefined();
    expect(response.error.trace.resolverName).toBe('ping');
    expect(response.error.code).toBe(ERROR_CODES.MISSING_UI_REQ_ID);
  });

  it('should track storage operations in trace', async () => {
    const response = await ping({ 
      payload: { ui_req_id: 'req123' }
    });
    
    expect(response.error.trace.storageState).toEqual('EXISTS');
  });
});
```

## Best Practices

1. **Always initialize trace at resolver entry**
2. **Record steps in order of execution**
3. **Fail fast and record error code immediately**
4. **Include metadata for debugging**
5. **Complete trace with execution time before returning**
6. **Never include PII in trace metadata**
7. **Use consistent error codes across all resolvers**
8. **Normalize trace data before serialization**

## Migration Path

For existing resolvers:

1. Add `initializeResolverTrace` at start
2. Replace error handling with `recordFailureStep`
3. Add step recording at key decision points
4. Call `completeTrace` before returning
5. Update error envelope creation to include trace

## Performance Impact

- **Minimal overhead**: ~1-2ms per trace
- **Memory usage**: ~5-10KB per trace (minimal in error cases)
- **Serialization**: Trace data compresses well (JSON)

## Related Files

- `/src/ops/structured_trace.ts` - Core trace types and utilities
- `/src/resolvers/trace_integration.ts` - Integration helpers
- `/src/gadget-ui/src/traceDiagnostics.ts` - UI display logic
- `/src/shared/truth_contract.ts` - Updated ErrorPayload structure
