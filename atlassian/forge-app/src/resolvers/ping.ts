/**
 * LAYER-0: PING RESOLVER (with TruthEnvelope contract)
 * 
 * Hardened health check with mandatory correlation:
 * 1. REQUIRES ui_req_id from caller (FAIL CLOSED if missing)
 * 2. ECHOES back ui_req_id in correlation for verification
 * 3. Uses TruthEnvelope<PingData> canonical structure
 * 4. All responses wrapped in envelope (ok, kind, schemaVersion, correlation, build, trace, data, error)
 * 5. Ensures no undefined fields (normalizes to null)
 * 6. Emits JSON log (PING_OK or PING_ERR) for grepping
 * 
 * CONTRACT GUARANTEE:
 * - If ui_req_id provided → envelope.correlation.uiReqId === provided ui_req_id (exact echo)
 * - If ui_req_id missing → return error envelope (FAIL CLOSED, NOT "ui_missing_")
 */

import { emitResolverErrorLog, classifyError } from "./backbone_error_handling";
import { BACKEND_BUILD_SHA } from "../build/backend_build";
import {
  TruthEnvelope,
  PingData,
  createErrorEnvelope,
  createSuccessEnvelope,
  normalizeUndefinedToNull,
} from "../shared/truth_contract";
import { buildInvocationMeta } from "../security/invocationMeta";
import { traceOk, traceFail } from "../security/stepTrace";
import { checkStorageProof } from "../security/storageProof";
import { makeErrorEnvelope } from "../security/errorEnvelope";
import type { ErrorEnvelopeV1 } from "../shared/invocationEnvelope";

/**
 * Ping resolver: Health check with MANDATORY correlation
 * 
 * Accepts uiReqId from request (via payload or headers)
 * FAIL CLOSED: Returns error envelope if uiReqId missing
 * Always returns TruthEnvelope<PingData> with exact uiReqId echo
 * 
 * Response Structure (TruthEnvelope):
 * {
 *   ok: boolean
 *   kind: "ping"
 *   schemaVersion: "1"
 *   generatedAt: ISO timestamp
 *   correlation: { uiReqId: "...", probeNonce: null }
 *   build: { backendSha: "...", uiArtifactSha: null }
 *   trace: { traceId: "...", instanceId: "..." }
 *   data: PingData | null
 *   error: ErrorPayload | null
 * }
 */
export async function ping(
  req?: any
): Promise<TruthEnvelope<PingData>> {
  const resolverName = "ping";
  const backendBuildSha = BACKEND_BUILD_SHA; // Injected at build time
  const nowIso = new Date().toISOString();

  // STEP 1: Extract uiReqId from request (payload takes precedence, then headers)
  const uiReqId =
    req?.payload?.ui_req_id ||
    req?.headers?.["x-firsttry-ui-req-id"] ||
    req?.ui_req_id;

  // Generate stable trace ID (for logging)
  const traceIdStable = `ping-${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
  const traceIdInstance = `${traceIdStable}_inst_${Math.random().toString(36).substring(7)}`;

  // Build invocation metadata (extract trace context from Forge)
  const meta = buildInvocationMeta({ ctx: req as any, uiReqId });

  // STEP 2: Log entry
  console.log(
    JSON.stringify({
      marker: "FT_PING_ENTRY",
      trace_id_stable: traceIdStable,
      ui_req_id: uiReqId || "MISSING",
      resolver_name: resolverName,
      timestamp_iso: nowIso,
    })
  );

  // STEP 3: FAIL CLOSED - uiReqId is REQUIRED
  if (!uiReqId) {
    console.log(
      JSON.stringify({
        marker: "FT_PING_ERR",
        trace_id_stable: traceIdStable,
        ui_req_id: "MISSING",
        resolver_name: resolverName,
        error_code: "MISSING_UI_REQ_ID",
        error_message: "UI request ID is required for correlation",
        timestamp_iso: nowIso,
      })
    );

    // Create error envelope with trace
    const errorTrace = [
      traceFail(resolverName, "uiReqId_validation", "MISSING_UI_REQ_ID", "UI request ID is required for correlation")
    ];

    const errorEnvelopeV1 = makeErrorEnvelope({
      resolverName,
      stepId: "uiReqId_validation",
      errorCode: "MISSING_UI_REQ_ID",
      message: "UI request ID is required for correlation",
      meta,
      trace: errorTrace,
    }) as ErrorEnvelopeV1;

    // Also return legacy TruthEnvelope for backward compatibility
    const emptyData: PingData = {
      respondedAt: nowIso,
      env: "unknown",
    };

    const errorTruthEnvelope = createErrorEnvelope<PingData>(
      "ping",
      "NO_CORRELATION_ID", // Placeholder when truly missing
      null,
      "MISSING_UI_REQ_ID",
      "UI request ID is required for correlation",
      backendBuildSha,
      null,
      traceIdStable
    );

    // Attach error envelope as metadata for UI parsing
    (errorTruthEnvelope as any)._errorEnvelopeV1 = errorEnvelopeV1;

    const normalized = normalizeUndefinedToNull(errorTruthEnvelope);
    return normalized;
  }

  // STEP 4: Healthy ping - return success envelope
  try {
    console.log(
      JSON.stringify({
        marker: "PING_OK",
        ui_req_id: uiReqId,
        backend_build_sha: backendBuildSha,
        trace_id_stable: traceIdStable,
        timestamp_iso: nowIso,
      })
    );

    console.log(
      JSON.stringify({
        marker: "FT_PING_OK",
        trace_id_stable: traceIdStable,
        ui_req_id: uiReqId,
        resolver_name: resolverName,
        timestamp_iso: nowIso,
      })
    );

    // Create success trace
    const successTrace = [
      traceOk(resolverName, "health_check", "Ping successful")
    ];

    // Build PingData payload
    const pingData: PingData = {
      respondedAt: nowIso,
      env: process.env.NODE_ENV || "unknown",
    };

    // Create success envelope
    const errorEnvelopeV1 = makeErrorEnvelope({
      resolverName,
      stepId: "health_check",
      errorCode: "OK" as any, // Success case - will be handled in UI
      message: "Ping successful",
      meta,
      trace: successTrace,
    }) as ErrorEnvelopeV1;

    // Create success envelope with exact uiReqId echo
    const successTruthEnvelope = createSuccessEnvelope<PingData>(
      "ping",
      uiReqId, // ECHO back exact uiReqId
      null, // probeNonce not used in ping
      pingData,
      backendBuildSha,
      null, // uiArtifactSha not available in backend
      traceIdStable
    );

    // Attach error envelope (even on success, for trace data)
    (successTruthEnvelope as any)._errorEnvelopeV1 = errorEnvelopeV1;

    // Normalize to ensure no undefined fields
    const normalized = normalizeUndefinedToNull(successTruthEnvelope);
    return normalized;
  } catch (err) {
    // STEP 5: Error handling
    const errorMsg = err instanceof Error ? err.message : String(err);
    const errorCode = classifyError(err, "internal");

    console.log(
      JSON.stringify({
        marker: "FT_PING_ERR",
        trace_id_stable: traceIdStable,
        ui_req_id: uiReqId,
        resolver_name: resolverName,
        error_code: errorCode,
        error_message: errorMsg,
        timestamp_iso: nowIso,
      })
    );

    emitResolverErrorLog(
      traceIdStable,
      traceIdInstance,
      errorCode,
      errorMsg,
      backendBuildSha,
      uiReqId,
      resolverName
    );

    // Create error trace
    const errorTrace = [
      traceFail(resolverName, "execution", errorCode as any, errorMsg)
    ];

    const errorEnvelopeV1 = makeErrorEnvelope({
      resolverName,
      stepId: "execution",
      errorCode: errorCode as any,
      message: errorMsg,
      meta,
      trace: errorTrace,
    }) as ErrorEnvelopeV1;

    const errorTruthEnvelope = createErrorEnvelope<PingData>(
      "ping",
      uiReqId,
      null,
      errorCode,
      errorMsg,
      backendBuildSha,
      null,
      traceIdStable
    );

    // Attach error envelope for UI parsing
    (errorTruthEnvelope as any)._errorEnvelopeV1 = errorEnvelopeV1;

    const normalized = normalizeUndefinedToNull(errorTruthEnvelope);
    return normalized;
  }
}
