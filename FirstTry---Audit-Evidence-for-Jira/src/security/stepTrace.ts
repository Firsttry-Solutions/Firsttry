/**
 * STEP TRACE HELPERS
 * 
 * Utilities for creating trace steps (success and failure)
 * Used to build the trace array that records execution path
 */

import type { StepTraceV1, ErrorCode } from '../shared/invocationEnvelope';

/**
 * Create a successful step trace entry
 * 
 * @param resolverName e.g., "probe.run", "status.ping"
 * @param stepId e.g., "S1_TENANT_CONTEXT"
 * @param message Human-readable step description
 * @returns StepTraceV1 with ok=true
 */
export function traceOk(
  resolverName: string,
  stepId: string,
  message: string
): StepTraceV1 {
  return {
    resolverName,
    stepId,
    atIso: new Date().toISOString(),
    ok: true,
    errorCode: null,
    message,
  };
}

/**
 * Create a failed step trace entry
 * 
 * @param resolverName e.g., "probe.run", "status.ping"
 * @param stepId e.g., "S2_STORAGE_CHECK"
 * @param errorCode Machine-readable error code
 * @param message Human-readable error message
 * @returns StepTraceV1 with ok=false
 */
export function traceFail(
  resolverName: string,
  stepId: string,
  errorCode: ErrorCode,
  message: string
): StepTraceV1 {
  return {
    resolverName,
    stepId,
    atIso: new Date().toISOString(),
    ok: false,
    errorCode,
    message,
  };
}
