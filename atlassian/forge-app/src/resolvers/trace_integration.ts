/**
 * RESOLVER TRACE INTEGRATION
 * 
 * Helpers for integrating structured tracing into resolvers.
 * Provides utilities to:
 * 1. Extract trace context from requests
 * 2. Build traces throughout resolver execution
 * 3. Attach traces to error payloads
 * 4. Format trace data for UI display
 */

import {
  StructuredTrace,
  createStructuredTrace,
  addTraceStep,
  setStorageProof,
  traceToErrorDetails,
  ERROR_CODES,
  ErrorCode,
  STEP_IDS,
  StepId,
  StorageProof,
} from './structured_trace';

/**
 * Extract trace context from resolver request
 */
export interface TraceContextFromRequest {
  uiReqId: string;
  forgeRequestId?: string;
}

/**
 * Extract trace context from incoming request
 */
export function extractTraceContext(req?: any): TraceContextFromRequest {
  return {
    uiReqId:
      req?.payload?.ui_req_id ||
      req?.headers?.['x-firsttry-ui-req-id'] ||
      req?.ui_req_id ||
      'UNKNOWN',
    forgeRequestId:
      req?.headers?.['x-forge-request-id'] ||
      req?.forgeRequestId ||
      undefined,
  };
}

/**
 * Initialize trace for a resolver
 */
export function initializeResolverTrace(
  resolverName: string,
  uiReqId: string,
  traceId?: string,
  forgeRequestId?: string
): StructuredTrace {
  const trace = createStructuredTrace(
    resolverName,
    uiReqId,
    traceId,
    forgeRequestId
  );

  addTraceStep(
    trace,
    STEP_IDS.REQUEST_RECEIVED,
    true,
    `Request received for ${resolverName}`,
    undefined,
    { forgeRequestId }
  );

  return trace;
}

/**
 * Record a successful step
 */
export function recordSuccessStep(
  trace: StructuredTrace,
  stepId: StepId,
  message: string,
  metadata?: Record<string, any>
): void {
  addTraceStep(trace, stepId, true, message, undefined, metadata);
}

/**
 * Record a failed step
 */
export function recordFailureStep(
  trace: StructuredTrace,
  stepId: StepId,
  errorCode: ErrorCode,
  message: string,
  metadata?: Record<string, any>
): void {
  addTraceStep(trace, stepId, false, message, errorCode, metadata);
}

/**
 * Record storage operation result
 */
export function recordStorageOperation(
  trace: StructuredTrace,
  operation: 'READ' | 'WRITE' | 'DELETE' | 'VERIFY',
  success: boolean,
  proof: StorageProof,
  errorCode?: ErrorCode
): void {
  const stepMap: Record<string, StepId> = {
    READ: STEP_IDS.STORAGE_READ_COMPLETED,
    WRITE: STEP_IDS.STORAGE_WRITE_COMPLETED,
    DELETE: STEP_IDS.STORAGE_DELETE_FAILED,
    VERIFY: STEP_IDS.STORAGE_VERIFICATION_COMPLETED,
  };

  const message = `Storage ${operation} ${success ? 'succeeded' : 'failed'}: ${proof.state}`;
  const stepId = stepMap[operation];

  addTraceStep(
    trace,
    stepId,
    success,
    message,
    errorCode,
    {
      storageState: proof.state,
      keyAccessed: proof.keyAccessed,
      verificationPassed: proof.verificationPassed,
    }
  );

  setStorageProof(trace, proof);
}

/**
 * Record external API call
 */
export function recordExternalApiCall(
  trace: StructuredTrace,
  service: 'JIRA' | 'FORGE',
  endpoint: string,
  success: boolean,
  statusCode?: number,
  errorCode?: ErrorCode
): void {
  const stepMap: Record<string, StepId> = {
    JIRA: STEP_IDS.JIRA_API_RESPONSE_RECEIVED,
    FORGE: STEP_IDS.FORGE_APP_REQUEST_FAILED,
  };

  const message = `${service} API call to ${endpoint} ${success ? 'succeeded' : 'failed'}`;

  addTraceStep(trace, stepMap[service], success, message, errorCode, {
    service,
    endpoint,
    statusCode,
  });
}

/**
 * Complete trace execution with timing
 */
export function completeTrace(
  trace: StructuredTrace,
  startTimeMs: number,
  buildSha?: string
): void {
  const endTimeMs = Date.now();
  trace.executionTimeMs = endTimeMs - startTimeMs;
  if (buildSha) {
    trace.buildSha = buildSha;
  }
}

/**
 * Convert trace to error payload details
 * Safe for inclusion in error responses to UI
 */
export function traceToErrorPayloadDetails(
  trace: StructuredTrace
): Record<string, any> {
  const details = traceToErrorDetails(trace);

  return {
    ...details,
    // Add step information for UI display
    steps: trace.steps.map(step => ({
      stepId: step.stepId,
      success: step.success,
      errorCode: step.errorCode,
    })),
  };
}

/**
 * Format trace info for UI display
 * Includes all non-sensitive debug information
 */
export function formatTraceForUI(trace: StructuredTrace): Record<string, any> {
  return {
    resolverName: trace.resolverName,
    uiReqId: trace.uiReqId,
    traceId: trace.traceId,
    forgeRequestId: trace.forgeRequestId,
    stepCount: trace.steps.length,
    failedStepId: trace.steps.find(s => !s.success)?.stepId ?? null,
    storageState: trace.storageState?.state ?? null,
    executionTimeMs: trace.executionTimeMs,
    buildSha: trace.buildSha,
  };
}

/**
 * Validate trace for completeness
 */
export function validateTrace(trace: StructuredTrace): string[] {
  const errors: string[] = [];

  if (!trace.resolverName) {
    errors.push('Missing resolverName');
  }

  if (!trace.uiReqId) {
    errors.push('Missing uiReqId');
  }

  if (trace.steps.length === 0) {
    errors.push('No steps recorded');
  }

  if (trace.finalErrorCode && !trace.steps.find(s => !s.success)) {
    errors.push('finalErrorCode set but no failed steps found');
  }

  return errors;
}
