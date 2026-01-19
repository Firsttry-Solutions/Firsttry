/**
 * STRUCTURED TRACE & ERROR CODE PROPAGATION
 * 
 * Enhanced tracing system that provides:
 * 1. Resolver name identification
 * 2. Internal step IDs for debugging
 * 3. Machine-readable error codes (enums)
 * 4. Forge requestId/traceId propagation
 * 5. Storage state verification with proof
 * 
 * All trace data flows through:
 * - Backend resolvers (ping, probe, etc.)
 * - UI error handlers
 * - Diagnostic displays
 */

import { CorrelationId } from './trace';

/**
 * COMPREHENSIVE ERROR CODE ENUM
 * Every error in the system must map to one of these codes.
 * Used for:
 * - Deterministic error classification
 * - UI error display
 * - Metrics and monitoring
 * - Support diagnosis
 */
export const ERROR_CODES = {
  // Correlation & Request Validation (1000-1099)
  MISSING_UI_REQ_ID: 'MISSING_UI_REQ_ID',
  INVALID_UI_REQ_ID_FORMAT: 'INVALID_UI_REQ_ID_FORMAT',
  INVALID_REQUEST_BODY: 'INVALID_REQUEST_BODY',
  REQUEST_BODY_PARSING_FAILED: 'REQUEST_BODY_PARSING_FAILED',

  // Tenant/Authorization (1100-1199)
  MISSING_TENANT_CONTEXT: 'MISSING_TENANT_CONTEXT',
  TENANT_CONTEXT_EXTRACTION_FAILED: 'TENANT_CONTEXT_EXTRACTION_FAILED',
  UNAUTHORIZED_TENANT: 'UNAUTHORIZED_TENANT',
  MISSING_APP_CONTEXT: 'MISSING_APP_CONTEXT',

  // Storage Access (1200-1299)
  STORAGE_UNAVAILABLE: 'STORAGE_UNAVAILABLE',
  STORAGE_READ_FAILED: 'STORAGE_READ_FAILED',
  STORAGE_WRITE_FAILED: 'STORAGE_WRITE_FAILED',
  STORAGE_DELETE_FAILED: 'STORAGE_DELETE_FAILED',
  STORAGE_EMPTY: 'STORAGE_EMPTY',
  STORAGE_KEY_MISMATCH: 'STORAGE_KEY_MISMATCH',
  STORAGE_VERIFICATION_FAILED: 'STORAGE_VERIFICATION_FAILED',

  // Forge API (1300-1399)
  FORGE_INVOKE_FAILED: 'FORGE_INVOKE_FAILED',
  FORGE_CONTEXT_NOT_AVAILABLE: 'FORGE_CONTEXT_NOT_AVAILABLE',
  FORGE_APP_REQUEST_FAILED: 'FORGE_APP_REQUEST_FAILED',

  // Jira API (1400-1499)
  JIRA_API_ERROR: 'JIRA_API_ERROR',
  JIRA_API_UNAUTHORIZED: 'JIRA_API_UNAUTHORIZED',
  JIRA_API_RATE_LIMITED: 'JIRA_API_RATE_LIMITED',
  JIRA_API_NOT_FOUND: 'JIRA_API_NOT_FOUND',
  JIRA_CONNECTION_FAILED: 'JIRA_CONNECTION_FAILED',

  // Data Processing (1500-1599)
  DATA_NORMALIZATION_FAILED: 'DATA_NORMALIZATION_FAILED',
  DATA_SERIALIZATION_FAILED: 'DATA_SERIALIZATION_FAILED',
  INVALID_DATA_FORMAT: 'INVALID_DATA_FORMAT',

  // Build & Deployment (1600-1699)
  BUILD_METADATA_MISSING: 'BUILD_METADATA_MISSING',
  BUILD_METADATA_INVALID: 'BUILD_METADATA_INVALID',
  VERSION_MISMATCH: 'VERSION_MISMATCH',

  // Internal Errors (1700-1799)
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  INVARIANT_VIOLATED: 'INVARIANT_VIOLATED',
  UNHANDLED_EXCEPTION: 'UNHANDLED_EXCEPTION',
  TIMEOUT: 'TIMEOUT',

  // Unknown/Generic (1800-1899)
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

/**
 * Step enum for tracking execution flow within resolvers
 */
export const STEP_IDS = {
  // Request entry
  REQUEST_RECEIVED: 'REQUEST_RECEIVED',
  REQUEST_PARSED: 'REQUEST_PARSED',

  // Correlation & validation
  EXTRACT_UI_REQ_ID: 'EXTRACT_UI_REQ_ID',
  VALIDATE_UI_REQ_ID: 'VALIDATE_UI_REQ_ID',

  // Tenant context
  EXTRACT_TENANT_CONTEXT: 'EXTRACT_TENANT_CONTEXT',
  VALIDATE_TENANT_CONTEXT: 'VALIDATE_TENANT_CONTEXT',

  // Storage operations
  CHECK_STORAGE_AVAILABILITY: 'CHECK_STORAGE_AVAILABILITY',
  STORAGE_READ_INITIATED: 'STORAGE_READ_INITIATED',
  STORAGE_READ_COMPLETED: 'STORAGE_READ_COMPLETED',
  STORAGE_WRITE_INITIATED: 'STORAGE_WRITE_INITIATED',
  STORAGE_WRITE_COMPLETED: 'STORAGE_WRITE_COMPLETED',
  STORAGE_VERIFICATION_INITIATED: 'STORAGE_VERIFICATION_INITIATED',
  STORAGE_VERIFICATION_COMPLETED: 'STORAGE_VERIFICATION_COMPLETED',

  // Jira API
  JIRA_API_CALL_INITIATED: 'JIRA_API_CALL_INITIATED',
  JIRA_API_RESPONSE_RECEIVED: 'JIRA_API_RESPONSE_RECEIVED',

  // Data processing
  DATA_PROCESSING_STARTED: 'DATA_PROCESSING_STARTED',
  DATA_NORMALIZATION_STARTED: 'DATA_NORMALIZATION_STARTED',
  DATA_NORMALIZATION_COMPLETED: 'DATA_NORMALIZATION_COMPLETED',

  // Response building
  TRUTH_ENVELOPE_BUILDING: 'TRUTH_ENVELOPE_BUILDING',
  RESPONSE_SERIALIZATION: 'RESPONSE_SERIALIZATION',

  // Error handling
  ERROR_CLASSIFIED: 'ERROR_CLASSIFIED',
  ERROR_RESPONSE_BUILDING: 'ERROR_RESPONSE_BUILDING',
} as const;

export type StepId = typeof STEP_IDS[keyof typeof STEP_IDS];

/**
 * Storage state enum for UI display
 */
export const STORAGE_STATES = {
  EXISTS: 'EXISTS',
  EMPTY: 'EMPTY',
  UNKNOWN: 'UNKNOWN',
  NOT_AVAILABLE: 'NOT_AVAILABLE',
} as const;

export type StorageState = typeof STORAGE_STATES[keyof typeof STORAGE_STATES];

/**
 * Storage proof includes the evidence that storage was accessed
 * Safe to include in responses (no PII, no sensitive data)
 */
export interface StorageProof {
  state: StorageState;
  /** Timestamp when storage was checked */
  checkedAt: string;
  /** Key that was attempted to be accessed (safe to log) */
  keyAccessed?: string | null;
  /** Whether verification passed (for probe operations) */
  verificationPassed?: boolean | null;
  /** Proof details (e.g., "verified write-then-read", "found existing data") */
  proofDetails?: string | null;
}

/**
 * Detailed trace step for structured logging
 */
export interface TraceStep {
  /** Step identifier from STEP_IDS */
  stepId: StepId;
  /** Timestamp when step started */
  startedAt: string;
  /** Timestamp when step completed (if applicable) */
  completedAt?: string | null;
  /** Whether step succeeded */
  success: boolean;
  /** Error code if step failed */
  errorCode?: ErrorCode | null;
  /** Human-readable message */
  message: string;
  /** Optional metadata for this step */
  metadata?: Record<string, any> | null;
}

/**
 * Complete structured trace for resolver execution
 * Flows from backend through to UI
 */
export interface StructuredTrace {
  /** Resolver name (ping, probe, etc.) */
  resolverName: string;
  /** Forge invocation requestId (if available) */
  forgeRequestId?: string | null;
  /** Trace ID for correlation */
  traceId: string | null;
  /** Correlation ID from UI request */
  uiReqId: string;
  /** Execution steps in order */
  steps: TraceStep[];
  /** Final error code (if error occurred) */
  finalErrorCode?: ErrorCode | null;
  /** Storage state at time of execution */
  storageState?: StorageProof | null;
  /** Build SHA for version correlation */
  buildSha?: string | null;
  /** Total execution time in ms */
  executionTimeMs?: number | null;
}

/**
 * Create a new structured trace for a resolver
 */
export function createStructuredTrace(
  resolverName: string,
  uiReqId: string,
  traceId?: string | null,
  forgeRequestId?: string | null
): StructuredTrace {
  return {
    resolverName,
    uiReqId,
    traceId: traceId ?? null,
    forgeRequestId: forgeRequestId ?? undefined,
    steps: [],
    finalErrorCode: undefined,
    storageState: undefined,
    buildSha: undefined,
    executionTimeMs: undefined,
  };
}

/**
 * Add a step to the trace
 */
export function addTraceStep(
  trace: StructuredTrace,
  stepId: StepId,
  success: boolean,
  message: string,
  errorCode?: ErrorCode,
  metadata?: Record<string, any>
): void {
  const now = new Date().toISOString();
  trace.steps.push({
    stepId,
    startedAt: now,
    completedAt: now,
    success,
    errorCode: errorCode ?? null,
    message,
    metadata: metadata ?? null,
  });

  if (!success && errorCode) {
    trace.finalErrorCode = errorCode;
  }
}

/**
 * Set storage proof on trace
 */
export function setStorageProof(
  trace: StructuredTrace,
  proof: StorageProof
): void {
  trace.storageState = proof;
}

/**
 * Create storage proof for successful read
 */
export function createStorageProof(
  state: StorageState,
  keyAccessed?: string,
  verificationPassed?: boolean,
  proofDetails?: string
): StorageProof {
  return {
    state,
    checkedAt: new Date().toISOString(),
    keyAccessed: keyAccessed ?? null,
    verificationPassed: verificationPassed ?? null,
    proofDetails: proofDetails ?? null,
  };
}

/**
 * Convert structured trace to safe error details for response
 * Filters out sensitive information, keeps diagnostic value
 */
export function traceToErrorDetails(trace: StructuredTrace): Record<string, any> {
  return {
    resolverName: trace.resolverName,
    uiReqId: trace.uiReqId,
    traceId: trace.traceId,
    finalErrorCode: trace.finalErrorCode,
    stepCount: trace.steps.length,
    failedStepId: trace.steps.find(s => !s.success)?.stepId ?? null,
    storageState: trace.storageState?.state ?? null,
    executionTimeMs: trace.executionTimeMs,
  };
}

/**
 * Format structured trace for console logging
 * Single-line JSON for easy parsing by log aggregation systems
 */
export function formatTraceForLogging(trace: StructuredTrace): string {
  return JSON.stringify({
    type: 'STRUCTURED_TRACE',
    resolverName: trace.resolverName,
    uiReqId: trace.uiReqId,
    traceId: trace.traceId,
    finalErrorCode: trace.finalErrorCode,
    stepCount: trace.steps.length,
    failedStep: trace.steps.find(s => !s.success)?.stepId ?? null,
    executionTimeMs: trace.executionTimeMs,
  });
}
