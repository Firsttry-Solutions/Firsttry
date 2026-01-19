# Structured Trace Integration Guide

## Quick Start

This guide shows how to integrate the structured trace system into resolvers to provide rich diagnostic information to the UI.

## Step 1: Import Trace Utilities

```typescript
import {
  initializeResolverTrace,
  recordSuccessStep,
  recordFailureStep,
  recordStorageOperation,
  completeTrace,
  traceToErrorPayloadDetails,
} from '../resolvers/trace_integration';

import {
  ERROR_CODES,
  STEP_IDS,
  STORAGE_STATES,
} from '../ops/structured_trace';
```

## Step 2: Initialize Trace at Resolver Entry

```typescript
export async function ping(req?: any): Promise<TruthEnvelope<PingData>> {
  const startTime = Date.now();

  // Extract trace context (uiReqId, forgeRequestId)
  const { uiReqId, forgeRequestId } = extractTraceContext(req);

  // Initialize trace
  const trace = initializeResolverTrace(
    'ping',           // resolver name
    uiReqId,          // from UI
    generateTraceId(), // stable ID
    forgeRequestId    // from Forge context
  );

  // ... rest of resolver implementation
}
```

## Step 3: Record Steps During Execution

### Successful Step

```typescript
try {
  // Do validation work
  validateRequest(req);

  recordSuccessStep(
    trace,
    STEP_IDS.REQUEST_PARSED,
    'Request body parsed successfully'
  );
} catch (err) {
  recordFailureStep(
    trace,
    STEP_IDS.REQUEST_PARSED,
    ERROR_CODES.REQUEST_BODY_PARSING_FAILED,
    'Request body could not be parsed: ' + err.message
  );
  // ... return error
}
```

### Storage Operations

```typescript
try {
  const data = await storage.read('probe:user123:snapshot');

  // Create proof with verification status
  const proof = createStorageProof(
    STORAGE_STATES.EXISTS,
    'probe:user123:snapshot',
    true, // verification passed
    'write-then-read verified'
  );

  recordStorageOperation(
    trace,
    'READ',      // operation type
    true,        // success
    proof        // storage proof
  );
} catch (err) {
  recordFailureStep(
    trace,
    STEP_IDS.STORAGE_READ_COMPLETED,
    ERROR_CODES.STORAGE_READ_FAILED,
    'Storage read failed: ' + err.message
  );
}
```

### External API Calls

```typescript
try {
  const result = await jiraAPI.issue.get(issueKey);

  recordExternalApiCall(
    trace,
    'JIRA_GET_ISSUE',
    true,
    { issueKey, status: 'success' }
  );
} catch (err) {
  recordFailureStep(
    trace,
    STEP_IDS.JIRA_API_CALL,
    ERROR_CODES.JIRA_API_ERROR,
    'Jira API error: ' + err.message
  );
}
```

## Step 4: Complete Trace Before Return

```typescript
// Always call this before returning, whether success or error
completeTrace(
  trace,
  startTime,           // milliseconds since epoch when started
  BACKEND_BUILD_SHA    // current build version
);
```

## Step 5: Include Trace in Error Responses

When returning an error, include the trace data:

```typescript
if (!uiReqId) {
  recordFailureStep(
    trace,
    STEP_IDS.VALIDATE_UI_REQ_ID,
    ERROR_CODES.MISSING_UI_REQ_ID,
    'UI request ID is required'
  );

  completeTrace(trace, startTime, BACKEND_BUILD_SHA);

  // Include trace in ErrorPayload
  return createErrorEnvelope<PingData>(
    'ping',
    uiReqId,
    null,
    ERROR_CODES.MISSING_UI_REQ_ID,
    'UI request ID is required',
    BACKEND_BUILD_SHA,
    null,
    trace.traceId,
    trace  // Include structured trace here
  );
}
```

## Complete Resolver Example

```typescript
export async function ping(req?: any): Promise<TruthEnvelope<PingData>> {
  const startTime = Date.now();
  
  // 1. Extract context
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
      
      return createErrorEnvelope(
        'ping',
        uiReqId,
        null,
        ERROR_CODES.MISSING_UI_REQ_ID,
        'UI request ID is required',
        BACKEND_BUILD_SHA,
        null,
        trace.traceId,
        trace
      );
    }
    
    recordSuccessStep(
      trace,
      STEP_IDS.VALIDATE_UI_REQ_ID,
      'UI request ID validated'
    );

    // 3. Extract tenant
    const tenantContext = await extractTenantContext(req);
    if (!tenantContext) {
      recordFailureStep(
        trace,
        STEP_IDS.VALIDATE_TENANT_CONTEXT,
        ERROR_CODES.MISSING_TENANT_CONTEXT,
        'Tenant context not available'
      );
      
      completeTrace(trace, startTime, BACKEND_BUILD_SHA);
      
      return createErrorEnvelope(
        'ping',
        uiReqId,
        null,
        ERROR_CODES.MISSING_TENANT_CONTEXT,
        'Tenant context not available',
        BACKEND_BUILD_SHA,
        null,
        trace.traceId,
        trace
      );
    }
    
    recordSuccessStep(
      trace,
      STEP_IDS.VALIDATE_TENANT_CONTEXT,
      'Tenant context validated'
    );

    // 4. Check storage
    const storageAvailable = await checkStorage();
    if (!storageAvailable) {
      recordFailureStep(
        trace,
        STEP_IDS.CHECK_STORAGE_AVAILABILITY,
        ERROR_CODES.STORAGE_UNAVAILABLE,
        'Storage service not available'
      );
      
      completeTrace(trace, startTime, BACKEND_BUILD_SHA);
      
      return createErrorEnvelope(
        'ping',
        uiReqId,
        null,
        ERROR_CODES.STORAGE_UNAVAILABLE,
        'Storage service not available',
        BACKEND_BUILD_SHA,
        null,
        trace.traceId,
        trace
      );
    }

    recordSuccessStep(
      trace,
      STEP_IDS.CHECK_STORAGE_AVAILABILITY,
      'Storage available'
    );

    // 5. Success response
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
    // 6. Catch-all error handling
    const errorCode = classifyErrorCode(err);
    
    recordFailureStep(
      trace,
      STEP_IDS.INTERNAL_ERROR_CLASSIFIED,
      errorCode,
      err.message
    );

    completeTrace(trace, startTime, BACKEND_BUILD_SHA);

    return createErrorEnvelope(
      'ping',
      uiReqId,
      null,
      errorCode,
      getErrorMessage(errorCode),
      BACKEND_BUILD_SHA,
      null,
      trace.traceId,
      trace
    );
  }
}
```

## Error Codes Reference

**Correlation & Request (1000-1099)**
- `MISSING_UI_REQ_ID`
- `INVALID_UI_REQ_ID_FORMAT`
- `REQUEST_BODY_PARSING_FAILED`

**Tenant (1100-1199)**
- `MISSING_TENANT_CONTEXT`
- `TENANT_CONTEXT_EXTRACTION_FAILED`
- `UNAUTHORIZED_TENANT`

**Storage (1200-1299)**
- `STORAGE_UNAVAILABLE`
- `STORAGE_READ_FAILED`
- `STORAGE_WRITE_FAILED`
- `STORAGE_VERIFICATION_FAILED`
- `STORAGE_EMPTY`
- `STORAGE_KEY_MISMATCH`

**External APIs (1300-1499)**
- `FORGE_INVOKE_FAILED`
- `JIRA_API_ERROR`

**Data (1500-1599)**
- `DATA_NORMALIZATION_FAILED`
- `DATA_SERIALIZATION_FAILED`
- `INVALID_DATA_FORMAT`

**Build (1600-1699)**
- `BUILD_METADATA_MISSING`
- `VERSION_MISMATCH`

**Internal (1700-1799)**
- `INTERNAL_ERROR`
- `INVARIANT_VIOLATED`
- `TIMEOUT`

## Step IDs Reference

- `REQUEST_RECEIVED`
- `REQUEST_PARSED`
- `EXTRACT_UI_REQ_ID`
- `VALIDATE_UI_REQ_ID`
- `EXTRACT_TENANT_CONTEXT`
- `VALIDATE_TENANT_CONTEXT`
- `CHECK_STORAGE_AVAILABILITY`
- `STORAGE_READ_INITIATED`
- `STORAGE_READ_COMPLETED`
- `STORAGE_VERIFICATION_INITIATED`
- `STORAGE_VERIFICATION_COMPLETED`
- `DATA_PROCESSING_STARTED`
- `DATA_NORMALIZATION_STARTED`
- `DATA_NORMALIZATION_COMPLETED`
- `TRUTH_ENVELOPE_BUILDING`
- `RESPONSE_SERIALIZATION`

## Testing

Tests are located in `tests/structured_trace_simple.test.ts` with 33 test cases covering:

- Initialization
- Step recording (success/failure)
- Storage proof creation and assignment
- Error code coverage
- Step ID coverage
- Trace conversion and formatting
- Complete execution flows
- Edge cases

Run tests with:
```bash
npm test -- tests/structured_trace_simple.test.ts --run
```

## Best Practices

1. **Always initialize trace at resolver entry**
   - Ensures uiReqId is captured for correlation

2. **Record steps in execution order**
   - Enables debugging of where failures occur

3. **Use appropriate step IDs**
   - Makes trace meaningful for support

4. **Include meaningful messages**
   - Messages appear in UI error diagnostics

5. **Fail fast**
   - Record first failure and exit early

6. **Complete trace before return**
   - Ensures execution time is captured

7. **Never include PII in trace**
   - Trace data flows to user-visible UI

8. **Use error codes consistently**
   - Same error should always use same code

## Migration Checklist

For each resolver:

- [ ] Add trace initialization at function entry
- [ ] Add step recording at major checkpoints
- [ ] Add error code assignment on failure
- [ ] Call completeTrace before return
- [ ] Include trace in ErrorPayload
- [ ] Add test cases for trace recording
- [ ] Verify error codes are from enum
- [ ] Test end-to-end with UI

## Troubleshooting

### Trace not appearing in error response
- Verify `completeTrace()` is called before return
- Check that trace is included in error envelope creation
- Ensure ErrorPayload includes `trace` field

### Error code not showing in UI
- Verify ERROR_CODES enum value is used
- Check that step has `errorCode` set
- Verify error payload is serialized correctly

### Storage proof always null
- Call `createStorageProof()` with correct STORAGE_STATES
- Call `recordStorageOperation()` or `setStorageProof()` to attach proof
- Verify proof is set before `completeTrace()`

### Missing step IDs
- Import STEP_IDS from structured_trace.ts
- Use enum value, not string literal
- Verify step ID exists in enum
