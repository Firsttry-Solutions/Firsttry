/**
 * Backbone Error Handling & Logging Utilities
 * 
 * Enforces:
 * - Deterministic trace IDs from error content
 * - Stable error codes (not "Unknown error")
 * - Single-line JSON logging on failure
 * - Never throws; always returns structured payload
 */

import { createHash } from "crypto";

/**
 * Error code classifier: maps errors to stable, debuggable codes
 */
export type ErrorCode =
  | "TENANT_CONTEXT_MISSING"
  | "STORAGE_ERROR"
  | "JIRA_API_ERROR"
  | "RESOLVER_UNHANDLED_EXCEPTION"
  | "BUILD_METADATA_MISSING"
  | "PERMISSION_DENIED"
  | "NETWORK_ERROR"
  | "TIMEOUT";

/**
 * Standard resolver error payload structure
 */
export interface ResolverErrorPayload {
  resolver_ok: boolean;
  error: {
    code: ErrorCode | null;
    message: string | null;
    trace_id_stable: string | null;  // Stable across same error type (for grouping)
    trace_id_instance?: string | null; // Unique per invocation (for debugging)
  };
  meta: {
    backend_build_sha: string | null;
    ui_build_sha: string | null;
    ui_req_id: string | null;
    generated_at_iso: string;
  };
  signals: {
    tenant_identity: "OK" | "MISSING" | "UNKNOWN";
    storage_state: "OK" | "EMPTY" | "ERROR" | "UNKNOWN";
  };
}

/**
 * Classify error into stable error code
 */
export function classifyError(error: any, context?: string): ErrorCode {
  const msg = error instanceof Error ? error.message : String(error);
  const name = error instanceof Error ? error.name : "UnknownError";

  // Tenant errors
  if (
    msg.includes("tenant") ||
    msg.includes("Tenant") ||
    msg.includes("TenantContextError") ||
    msg.includes("tenant identity")
  ) {
    return "TENANT_CONTEXT_MISSING";
  }

  // Storage errors
  if (
    name.includes("Storage") ||
    msg.includes("storage") ||
    msg.includes("Storage") ||
    msg.includes("putStatusSnapshot") ||
    msg.includes("readSnapshot")
  ) {
    return "STORAGE_ERROR";
  }

  // Jira API errors
  if (
    msg.includes("Jira") ||
    msg.includes("jira") ||
    msg.includes("401") ||
    msg.includes("403") ||
    msg.includes("permission")
  ) {
    return "JIRA_API_ERROR";
  }

  // Permission errors
  if (
    msg.includes("permission") ||
    msg.includes("forbidden") ||
    msg.includes("denied")
  ) {
    return "PERMISSION_DENIED";
  }

  // Network/timeout
  if (msg.includes("ECONNREFUSED") || msg.includes("timeout")) {
    return "NETWORK_ERROR";
  }

  // Build metadata errors
  if (msg.includes("BUILD_") || msg.includes("build") || context?.includes("build")) {
    return "BUILD_METADATA_MISSING";
  }

  // Default: unhandled
  return "RESOLVER_UNHANDLED_EXCEPTION";
}

/**
 * Generate stable trace ID: deterministic ACROSS all occurrences of same error type
 * 
 * Input: error_code + error.name + error.message + backend_build_sha (NOT stack)
 * Output: First 16 hex chars of SHA256
 * 
 * Invariant: Same error type/message/code = same trace_id_stable (even different Error objects)
 * This enables grouping in logs/dashboards
 */
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

/**
 * Generate instance trace ID: CHANGES across different stack traces for same error
 * 
 * Input: trace_id_stable + first 500 chars of stack
 * Output: First 16 hex chars of SHA256
 * 
 * Use case: Logs can capture both stable (for grouping) and instance (for unique invocation)
 */
export function generateTraceIdInstance(
  traceIdStable: string,
  error: any
): string {
  const stackTop = error instanceof Error && error.stack ? error.stack.substring(0, 500) : "";
  const input = [traceIdStable, stackTop].join("|");
  const fullHash = createHash("sha256").update(input).digest("hex");

  return fullHash.substring(0, 16);
}

/**
 * Emit single-line JSON log on resolver failure
 * 
 * This is the ONLY place resolver failures are logged. Log line includes:
 * - trace_id_stable for grouping related errors
 * - trace_id_instance for unique invocation tracking
 * - ui_req_id for correlating with UI requests
 * - error_code for stable classification
 * - backend_build_sha for version tracking
 */
export function emitResolverErrorLog(
  traceIdStable: string,
  traceIdInstance: string | null,
  errorCode: ErrorCode,
  errorMsg: string,
  backendBuildSha: string | null,
  uiReqId: string | null,
  resolverName: string
): void {
  const logObject = {
    level: "error",
    component: "resolver",
    resolver: resolverName,
    trace_id_stable: traceIdStable,
    trace_id_instance: traceIdInstance || undefined,
    error_code: errorCode,
    message: errorMsg.substring(0, 200), // limit length
    ui_req_id: uiReqId || "unknown",
    backend_build_sha: backendBuildSha || "unknown",
    timestamp_iso: new Date().toISOString(),
  };

  console.error(JSON.stringify(logObject));
}

/**
 * Create standard error payload for resolver returns
 * 
 * Always returns this shape; never throws.
 */
export function createResolverErrorPayload(
  error: any,
  backendBuildSha: string | null,
  uiReqId: string | null,
  tenantStatus: "OK" | "MISSING" | "UNKNOWN" = "UNKNOWN",
  storageStatus: "OK" | "EMPTY" | "ERROR" | "UNKNOWN" = "UNKNOWN",
  resolverName: string = "unknown"
): ResolverErrorPayload {
  const errorCode = classifyError(error, resolverName);
  const traceIdStable = generateTraceIdStable(errorCode, error, backendBuildSha);
  const traceIdInstance = generateTraceIdInstance(traceIdStable, error);
  const errorMsg = error instanceof Error ? error.message : String(error);

  // Emit single-line JSON log (includes both trace IDs)
  emitResolverErrorLog(
    traceIdStable,
    traceIdInstance,
    errorCode,
    errorMsg,
    backendBuildSha,
    uiReqId,
    resolverName
  );

  return {
    resolver_ok: false,
    error: {
      code: errorCode,
      message: errorMsg.substring(0, 200),
      trace_id_stable: traceIdStable,
      trace_id_instance: traceIdInstance,
    },
    meta: {
      backend_build_sha: backendBuildSha,
      ui_build_sha: "UI_v2.14.0",
      ui_req_id: uiReqId,
      generated_at_iso: new Date().toISOString(),
    },
    signals: {
      tenant_identity: tenantStatus,
      storage_state: storageStatus,
    },
  };
}

/**
 * Helper: extract uiReqId from various request formats
 */
export function extractUiReqId(req: any): string | null {
  return req?.payload?.uiReqId || req?.uiReqId || req?.ui_req_id || null;
}
