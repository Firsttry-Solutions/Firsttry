/**
 * PHASE P3.5: OPERATION HANDLER WRAPPER
 * 
 * Wraps all Forge handlers to ensure:
 * - Every operation gets a unique correlation ID
 * - All errors are classified  
 * - All outcomes are recorded as metric events
 * - Health can be computed from metric stream
 *
 * Usage:
 * ```
 * export const myHandler = wrapHandler(async (req, ctx) => {
 *   return { status: 200, body: 'ok' };
 * }, 'my_operation');
 * ```
 */

import { createTraceContext, TraceContext } from './trace';
import { classifyError } from './errors';
import { recordMetricEvent, OperationOutcome } from './metrics';
import { TenantContext } from '../security/tenant_context';

export interface OperationRequest {
  [key: string]: unknown;
}

export interface OperationResponse {
  status: number;
  body: string | object;
  headers?: Record<string, string>;
}

/**
 * Options for handler wrapping behavior
 */
export interface HandlerWrapperOptions {
  /**
   * Should we record metrics? (default: true)
   */
  recordMetrics?: boolean;

  /**
   * Custom error handler (instead of default error response)
   */
  onError?: (
    error: unknown,
    ctx: TraceContext,
    tenantContext?: TenantContext
  ) => OperationResponse;

  /**
   * Custom success handler (wraps response)
   */
  onSuccess?: (response: OperationResponse, ctx: TraceContext) => OperationResponse;

  /**
   * Extract tenant context from request (for metric scoping)
   */
  extractTenantContext?: (request: OperationRequest) => TenantContext | null;
}

/**
 * Wraps a Forge handler to add tracing, error classification, and metrics
 *
 * @param handler - Async function handling the request
 * @param operationName - Name of the operation (for metrics)
 * @param options - Wrapping options
 * @returns Wrapped handler
 */
export function wrapHandler(
  handler: (request: OperationRequest) => Promise<OperationResponse | any>,
  operationName: string,
  options: HandlerWrapperOptions = {}
) {
  const {
    recordMetrics = true,
    onError,
    onSuccess,
    extractTenantContext,
  } = options;

  return async (request: OperationRequest): Promise<OperationResponse> => {
    const ctx = createTraceContext(operationName);
    let tenantContext: TenantContext | null = null;
    let outcome: OperationOutcome = 'FAIL';
    let errorClass: string | undefined;

    try {
      // Extract tenant context if provided
      if (extractTenantContext) {
        tenantContext = extractTenantContext(request);
      }

      // Call the actual handler
      const response = await handler(request);

      // Mark as success
      outcome = 'SUCCESS';

      // Wrap response if needed
      if (onSuccess) {
        return onSuccess(response, ctx);
      }

      return response;
    } catch (error) {
      // Classify the error
      const classified = classifyError(error, ctx.correlationId);
      errorClass = classified.errorClass;

      // Mark outcome based on error type
      if (classified.errorClass === 'VALIDATION') {
        outcome = 'BLOCKED';
      } else if (classified.errorClass === 'INVARIANT') {
        outcome = 'FAIL'; // INVARIANT is serious failure
      }

      // Custom error handler?
      if (onError) {
        return onError(error, ctx, tenantContext || undefined);
      }

      // Default error response
      return {
        status: statusCodeForErrorClass(classified.errorClass),
        body: JSON.stringify({
          error: classified.errorClass,
          message: classified.safeMessage,
          correlationId: ctx.correlationId,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      };
    } finally {
      // Record metric event
      if (recordMetrics && tenantContext) {
        try {
          await recordMetricEvent(
            tenantContext,
            {
              tsISO: new Date().toISOString(),
              durationMs: Date.now() - ctx.startTimeMs,
              tenantToken: '', // Computed by recordMetricEvent
              opName: operationName,
              outcome,
              correlationId: ctx.correlationId,
              flags: errorClass ? [errorClass] : [],
            }
          );
        } catch (metricErr) {
          // Don't let metric recording failure break the response
          console.error('[HandlerWrapper] Failed to record metric:', metricErr);
        }
      }
    }
  };
}

/**
 * Get HTTP status code for error class
 */
function statusCodeForErrorClass(errorClass: string): number {
  switch (errorClass) {
    case 'AUTHZ':
      return 401; // Unauthorized
    case 'VALIDATION':
      return 400; // Bad Request
    case 'DEPENDENCY':
      return 503; // Service Unavailable
    case 'STORAGE':
      return 503; // Service Unavailable
    case 'INVARIANT':
      return 500; // Internal Server Error
    case 'UNKNOWN':
    default:
      return 500; // Internal Server Error
  }
}

/**
 * Type-safe handler wrapper for operations without request body
 */
export function wrapSimpleHandler(
  handler: (ctx: TraceContext) => Promise<OperationResponse | any>,
  operationName: string,
  extractTenantContext?: () => TenantContext | null
) {
  return wrapHandler(
    () => handler(createTraceContext(operationName)),
    operationName,
    { extractTenantContext: () => extractTenantContext?.() || null }
  );
}
