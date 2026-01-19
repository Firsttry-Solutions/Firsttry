/**
 * LAYER-0 CANONICAL CONTRACT MODULE
 * 
 * Defines the immutable contract between UI and Backend for ping/probe operations.
 * Used by BOTH:
 * - UI: To construct requests and validate responses
 * - Backend: To format responses
 * - Tests: To verify contract compliance
 * 
 * NON-NEGOTIABLE REQUIREMENTS:
 * 1. All responses use TruthEnvelope<T> wrapper
 * 2. No field may be undefined (convert to null)
 * 3. Correlation IDs (uiReqId, probeNonce) MUST be echoed back
 * 4. Build metadata MUST be present
 * 5. All error paths use explicit codes
 */

/**
 * Schema version for this contract.
 * Increment when BREAKING changes made to TruthEnvelope or core types.
 */
export const SCHEMA_VERSION = "1";

/**
 * Correlation metadata that MUST be present on every response
 */
export interface CorrelationData {
  /** UI-generated request ID (REQUIRED, echoed from request) */
  uiReqId: string;
  /** UI-generated probe nonce (optional, echoed from request if provided) */
  probeNonce?: string | null;
}

/**
 * Build metadata identifying code version for both UI and backend
 */
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

/**
 * Trace metadata for debugging and correlation
 */
export interface TraceData {
  /** Stable trace ID from backend (null if generation failed) */
  traceId: string | null;
  /** Optional instance ID for this resolver invocation */
  instanceId?: string | null;
}

/**
 * Error payload when response fails
 */
export interface ErrorPayload {
  /** Machine-readable error code (e.g., "MISSING_UI_REQ_ID", "INTERNAL_ERROR") */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Optional details object (must not contain undefined fields) */
  details?: Record<string, any> | null;
}

/**
 * THE CANONICAL ENVELOPE
 * Every ping/probe response from backend MUST match this structure.
 * Generic <T> allows different payload types (PingData, ProbeData, etc.)
 * 
 * INVARIANTS:
 * - ok: true means success AND data is populated
 * - ok: false means error is populated
 * - correlation.uiReqId MUST be echoed back exactly as received
 * - No field (at any depth) may be undefined (use null instead)
 * - schemaVersion MUST be "1"
 */
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

/**
 * Payload for ping responses (when ok=true)
 */
export interface PingData {
  /** Proof that backend responded at this timestamp */
  respondedAt: string;
  /** Optional backend environment info */
  env?: string | null;
}

/**
 * Payload for probe responses (when ok=true)
 */
export interface ProbeData {
  /** Proof that probe executed at this timestamp */
  executedAt: string;
  /** Probe results (varies by probe type) */
  result: Record<string, any> | null;
}

/**
 * UTILITY: Convert all undefined values recursively to null
 * This ensures no response contains undefined at any level
 * 
 * @param obj Any object (typically a TruthEnvelope instance)
 * @returns Same object with all undefined values replaced by null
 */
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
      value = null;
    } else if (typeof value === "object" && value !== null) {
      value = normalizeUndefinedToNull(value);
    }
    result[key] = value;
  }

  return result as T;
}

/**
 * UTILITY: Verify no undefined values at any depth in an object
 * Used in tests and assertions to catch contract violations
 * 
 * @param obj Object to check
 * @param path Current path (for error reporting)
 * @throws Error if any undefined value found
 */
export function assertNoUndefinedFields(
  obj: any,
  path: string = "root"
): void {
  if (obj === null || obj === undefined) {
    if (obj === undefined) {
      throw new Error(
        `Undefined value at path: ${path}`
      );
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
      throw new Error(
        `Undefined field at path: ${path}.${key}`
      );
    }
    if (typeof value === "object" && value !== null) {
      assertNoUndefinedFields(value, `${path}.${key}`);
    }
  }
}

/**
 * UTILITY: Create a well-formed TruthEnvelope for error responses
 * Ensures consistency across all error paths
 */
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

/**
 * UTILITY: Create a well-formed TruthEnvelope for success responses
 * Ensures consistency across all success paths
 */
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
