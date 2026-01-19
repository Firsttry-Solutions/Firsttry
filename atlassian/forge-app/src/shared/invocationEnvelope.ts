/**
 * LAYER-0 INVOCATION ENVELOPE TYPES
 * 
 * Defines canonical error envelope and tracing types for all backend invocations.
 * Shared between UI and Backend for deterministic error handling.
 * 
 * INVARIANTS:
 * - All fields are either string/number/boolean or null (NO undefined)
 * - errorCode must be from the ErrorCode enum
 * - meta is always populated (nowIso, uiReqId, traceId, requestId all nullable but present)
 * - storage is null unless explicitly set (not a default)
 * - trace is append-only array of steps
 */

/**
 * Machine-readable error codes for all backend failures
 * Must be explicitly handled by UI
 */
export type ErrorCode =
  | 'ENSURE_FIRST_SNAPSHOT_FAILED'
  | 'PROBE_FAILED'
  | 'PING_FAILED'
  | 'TENANT_CONTEXT_MISSING'
  | 'STORAGE_READ_FAILED'
  | 'STORAGE_WRITE_FAILED'
  | 'UNKNOWN_ERROR'
  | 'INTERNAL_ERROR'
  | 'MISSING_UI_REQ_ID';

/**
 * Invocation metadata extracted from Forge context and request
 * NO invented values: missing data → null, not placeholder strings
 */
export interface InvocationMetaV1 {
  /** Stable trace ID from Forge context, if available (null otherwise) */
  traceId: string | null;

  /** Request ID from Forge context, if available (null otherwise) */
  requestId: string | null;

  /** Invocation ID from Forge context, if available (null otherwise) */
  invocationId: string | null;

  /** UI-generated request ID, propagated from request (null if missing) */
  uiReqId: string | null;

  /** ISO timestamp when this metadata was generated (always set) */
  nowIso: string;
}

/**
 * Storage verification proof: deterministic evidence of storage state
 * Used to prove whether data EXISTS or is EMPTY
 */
export interface StorageProofV1 {
  /** Storage state: EMPTY (all keys missing), EXISTS (found data), UNKNOWN (error during check) */
  state: 'EMPTY' | 'EXISTS' | 'UNKNOWN';

  /** ISO timestamp when storage was checked */
  checkedAtIso: string;

  /** Reproducible proof string (e.g., "MISSING_ALL", "FOUND:snapshots/latest") */
  proof: string | null;

  /** Which keys were checked during storage verification */
  keysChecked: string[];

  /** Any errors encountered while checking storage (empty if successful) */
  errors: string[];
}

/**
 * Single step in resolver execution trace
 * Append-only: steps record the execution path up to failure
 */
export interface StepTraceV1 {
  /** Resolver name (e.g., "probe.run", "status.ping", "snapshot.ensureFirst") */
  resolverName: string;

  /** Step ID (e.g., "S1_TENANT_CONTEXT", "S2_STORAGE_CHECK", "S3_EXECUTE") */
  stepId: string;

  /** ISO timestamp when this step executed */
  atIso: string;

  /** Whether step succeeded (true) or failed (false) */
  ok: boolean;

  /** Error code if step failed (null if ok === true) */
  errorCode: ErrorCode | null;

  /** Human-readable message about this step */
  message: string;
}

/**
 * THE ERROR ENVELOPE
 * Returned by backend when any resolver fails
 * Contains complete diagnostic information for UI display
 */
export interface ErrorEnvelopeV1 {
  /** Always "ERROR" (discriminator) */
  kind: 'ERROR';

  /** Always "1" (schema version for this envelope format) */
  schemaVersion: '1';

  /** Resolver name where error occurred (e.g., "probe.run") */
  resolverName: string;

  /** Step ID where error occurred (e.g., "S2_STORAGE_CHECK") */
  stepId: string;

  /** Machine-readable error code (from ErrorCode enum) */
  errorCode: ErrorCode;

  /** Human-readable error message (safe for display) */
  message: string;

  /** Invocation metadata: trace IDs, timestamps, correlation IDs */
  meta: InvocationMetaV1;

  /** Storage verification proof (null if not checked) */
  storage: StorageProofV1 | null;

  /** Execution trace: append-only steps up to failure */
  trace: StepTraceV1[];

  /** Additional error details (developer-facing, null if none) */
  details: Record<string, unknown> | null;
}

/**
 * Type guard: Check if value is an ErrorEnvelopeV1
 * Used by UI to distinguish between error envelope and other response types
 */
export function isErrorEnvelopeV1(x: any): x is ErrorEnvelopeV1 {
  if (typeof x !== 'object' || x === null) return false;

  // Check required discriminator fields
  if (x.kind !== 'ERROR') return false;
  if (x.schemaVersion !== '1') return false;

  // Check required string fields
  if (typeof x.resolverName !== 'string') return false;
  if (typeof x.stepId !== 'string') return false;
  if (typeof x.errorCode !== 'string') return false;
  if (typeof x.message !== 'string') return false;

  // Check meta structure
  if (typeof x.meta !== 'object' || x.meta === null) return false;
  if (typeof x.meta.nowIso !== 'string') return false;
  if (x.meta.traceId !== null && typeof x.meta.traceId !== 'string') return false;
  if (x.meta.requestId !== null && typeof x.meta.requestId !== 'string') return false;
  if (x.meta.invocationId !== null && typeof x.meta.invocationId !== 'string') return false;
  if (x.meta.uiReqId !== null && typeof x.meta.uiReqId !== 'string') return false;

  // Check storage (if present)
  if (x.storage !== null) {
    if (typeof x.storage !== 'object') return false;
    const validStates = ['EMPTY', 'EXISTS', 'UNKNOWN'];
    if (!validStates.includes(x.storage.state)) return false;
    if (typeof x.storage.checkedAtIso !== 'string') return false;
    if (!Array.isArray(x.storage.keysChecked)) return false;
    if (!Array.isArray(x.storage.errors)) return false;
  }

  // Check trace (must be array)
  if (!Array.isArray(x.trace)) return false;
  for (const step of x.trace) {
    if (typeof step !== 'object' || step === null) return false;
    if (typeof step.resolverName !== 'string') return false;
    if (typeof step.stepId !== 'string') return false;
    if (typeof step.atIso !== 'string') return false;
    if (typeof step.ok !== 'boolean') return false;
    if (step.errorCode !== null && typeof step.errorCode !== 'string') return false;
    if (typeof step.message !== 'string') return false;
  }

  // Check details (if present)
  if (x.details !== null && typeof x.details !== 'object') return false;

  return true;
}

/**
 * Validate that an ErrorEnvelopeV1 has all required fields set (no null)
 * Used for strict validation before sending to UI
 */
export function validateErrorEnvelope(env: ErrorEnvelopeV1): string | null {
  // Meta must have nowIso
  if (!env.meta.nowIso) return 'meta.nowIso is required';

  // Trace must have at least one step (the failure point)
  if (env.trace.length === 0) return 'trace must have at least one step';

  // All trace steps must have valid data
  for (let i = 0; i < env.trace.length; i++) {
    const step = env.trace[i];
    if (!step.resolverName) return `trace[${i}].resolverName is required`;
    if (!step.stepId) return `trace[${i}].stepId is required`;
    if (!step.atIso) return `trace[${i}].atIso is required`;
  }

  return null; // All validations passed
}
