/**
 * PHASE P3: OPERABILITY & RELIABILITY INFRASTRUCTURE
 * 
 * Public API for Phase 3 operability:
 * - Correlation IDs and request tracing
 * - Error classification and safe messaging
 * - Metrics recording and SLI computation
 * - Health status diagnostics
 * - Truth determinism verification
 * - Handler wrapping and instrumentation
 * 
 * All exports are tenant-scoped, PII-free, and deterministic
 */

// Trace: Correlation IDs for request tracing
export {
  CorrelationId,
  TraceContext,
  newCorrelationId,
  createTraceContext,
  getElapsedMs,
  getOrCreateCorrelationId,
} from './trace';

// Errors: Classification and safe messaging
export {
  ErrorClass,
  ClassifiedError,
  classifyError,
  isClassifiedError,
  errorResponse,
} from './errors';

// Metrics: Operational metrics and SLIs
export {
  OperationOutcome,
  MetricEvent,
  SLIReport,
  computeTenantToken,
  recordMetricEvent,
  computeSLIs,
  isValidOutcome,
} from './metrics';

// Health: Health status and diagnostics
export {
  HealthStatus,
  DriftSummary,
  HealthSummary,
  HealthCheckResponse,
  computeHealthSummary,
  createHealthCheckResponse,
} from './health';

// Determinism: Truth verification
export {
  DeterminismResult,
  DeterminismDifference,
  verifyTruthDeterminism,
  verifyAndRecordDeterminism,
} from './determinism';

// Handler wrapper: Instrumentation
export {
  OperationRequest,
  OperationResponse,
  HandlerWrapperOptions,
  wrapHandler,
  wrapSimpleHandler,
} from './handler_wrapper';
