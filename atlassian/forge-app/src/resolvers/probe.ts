/**
 * LAYER-0: FORENSIC_PROBE (with TruthEnvelope contract)
 * 
 * Deterministic Correlation Proof with MANDATORY correlation:
 * 
 * PHASE 1 (UI-SIDE):
 * - UI generates deterministic ui_req_id + probeNonce client-side
 * - Sends both to backend in request
 * 
 * PHASE 2 (BACKEND, THIS FILE):
 * - Backend REQUIRES ui_req_id (FAIL CLOSED if missing)
 * - Accepts optional probeNonce from UI
 * - Generates backend-specific nonce (server-side entropy)
 * - Returns TruthEnvelope<ProbeData> with all correlation IDs echoed
 * 
 * PHASE 3 (GREP VERIFICATION):
 * - Tools grep logs by UI nonce
 * - Proves backend received and logged probe invocation
 * 
 * Contract Guarantee:
 * - If ui_req_id provided → envelope.correlation.uiReqId === provided ui_req_id (exact echo)
 * - If ui_req_id missing → return error envelope (FAIL CLOSED)
 * - All responses wrapped in TruthEnvelope<ProbeData>
 * - No undefined fields (normalizes to null)
 * - Logs FT_PROBE_ENTRY, FT_PROBE_MARKER, FT_PROBE_OK/ERR for tracing
 */

import * as crypto from 'crypto';
import { BACKEND_BUILD_SHA } from "../build/backend_build";
import {
  TruthEnvelope,
  ProbeData,
  createErrorEnvelope,
  createSuccessEnvelope,
  normalizeUndefinedToNull,
} from "../shared/truth_contract";
import { buildInvocationMeta } from "../security/invocationMeta";
import { traceOk, traceFail } from "../security/stepTrace";
import { checkStorageProof } from "../security/storageProof";
import { makeErrorEnvelope } from "../security/errorEnvelope";
import type { ErrorEnvelopeV1 } from "../shared/invocationEnvelope";
import { failClosed } from '../shared/failClosed';

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Generate deterministic random hex (safe for logging)
 */
function randomHex(bytes: number): string {
  try {
    return crypto.randomBytes(bytes).toString('hex');
  } catch (err) {
    throw failClosed('FT_PROBE_CRYPTO_FAILED', 'Cannot generate random bytes', err);
  }
}

/**
 * SHA256 hash, truncated to 12 chars (safe short hash for sensitive data)
 */
function hashShort(s: string): string {
  try {
    return crypto.createHash('sha256').update(s).digest('hex').substring(0, 12);
  } catch (err) {
    throw failClosed('FT_PROBE_HASH_FAILED', 'Cannot compute SHA256 hash', err);
  }
}

/**
 * Extract ui_req_id from request
 * Precedence:
 * 1. payload.ui_req_id
 * 2. payload.meta.ui_req_id
 * 3. payload.uiReqId
 * 4. payload.meta.uiReqId
 * 5. payload.requestId
 * 6. payload.reqId
 * 7. payload.ui_request_id
 * 8. payload.context.ui_req_id
 * 9. headers['x-firsttry-ui-req-id'] (if headers provided)
 * 
 * FAIL CLOSED: Returns null if not found (caller must handle)
 * NO ui_missing_ fallback (that pattern is deprecated)
 */
function extractUiReqId(payload: any, headers?: Record<string, string>): string | null {
  // Precedence 1: payload.ui_req_id
  if (typeof payload?.ui_req_id === 'string' && payload.ui_req_id.trim()) {
    return payload.ui_req_id.trim();
  }

  // Precedence 2: payload.meta.ui_req_id
  if (typeof payload?.meta?.ui_req_id === 'string' && payload.meta.ui_req_id.trim()) {
    return payload.meta.ui_req_id.trim();
  }

  // Precedence 3: payload.uiReqId
  if (typeof payload?.uiReqId === 'string' && payload.uiReqId.trim()) {
    return payload.uiReqId.trim();
  }

  // Precedence 4: payload.meta.uiReqId
  if (typeof payload?.meta?.uiReqId === 'string' && payload.meta.uiReqId.trim()) {
    return payload.meta.uiReqId.trim();
  }

  // Precedence 5: payload.requestId
  if (typeof payload?.requestId === 'string' && payload.requestId.trim()) {
    return payload.requestId.trim();
  }

  // Precedence 6: payload.reqId
  if (typeof payload?.reqId === 'string' && payload.reqId.trim()) {
    return payload.reqId.trim();
  }

  // Precedence 7: payload.ui_request_id
  if (typeof payload?.ui_request_id === 'string' && payload.ui_request_id.trim()) {
    return payload.ui_request_id.trim();
  }

  // Precedence 8: payload.context.ui_req_id
  if (typeof payload?.context?.ui_req_id === 'string' && payload.context.ui_req_id.trim()) {
    return payload.context.ui_req_id.trim();
  }

  // Precedence 9: headers (if provided)
  if (typeof headers?.['x-firsttry-ui-req-id'] === 'string' && headers['x-firsttry-ui-req-id'].trim()) {
    return headers['x-firsttry-ui-req-id'].trim();
  }

  // FAIL CLOSED: not found
  return null;
}

/**
 * Extract probe nonce from request (optional)
 * Precedence: headers → payload.probe_nonce → payload.probeNonce → payload.meta.local_probe_nonce
 */
function extractProbeNonce(payload: any, headers?: Record<string, string>): string | null {
  // Try headers first (highest precedence)
  if (typeof headers?.['x-firsttry-probe-nonce'] === 'string' && headers['x-firsttry-probe-nonce'].trim()) {
    return headers['x-firsttry-probe-nonce'].trim();
  }

  // Try payload direct fields
  if (typeof payload?.probe_nonce === 'string' && payload.probe_nonce.trim()) {
    return payload.probe_nonce.trim();
  }

  if (typeof payload?.probeNonce === 'string' && payload.probeNonce.trim()) {
    return payload.probeNonce.trim();
  }

  // Try meta.local_probe_nonce (for backward compatibility with UI)
  if (typeof payload?.meta?.local_probe_nonce === 'string' && payload.meta.local_probe_nonce.trim()) {
    return payload.meta.local_probe_nonce.trim();
  }

  // Optional field, return null if not provided
  return null;
}


// ============================================================================
// PROBE RESOLVER
// ============================================================================

/**
 * LAYER-0 Probe resolver with TruthEnvelope contract
 * 
 * REQUIRES ui_req_id from caller (FAIL CLOSED if missing)
 * Returns TruthEnvelope<ProbeData> with exact ui_req_id + probeNonce echo
 * 
 * Response Structure:
 * {
 *   ok: boolean
 *   kind: "probe"
 *   schemaVersion: "1"
 *   generatedAt: ISO timestamp
 *   correlation: { uiReqId: "...", probeNonce: "..." | null }
 *   build: { backendSha: "...", uiArtifactSha: null }
 *   trace: { traceId: "...", instanceId: "..." }
 *   data: ProbeData | null
 *   error: ErrorPayload | null
 * }
 */
export async function probe(
  req?: any
): Promise<TruthEnvelope<ProbeData>> {
  const payload = req?.payload || req || {};
  const headers = (req?.headers || {}) as Record<string, string>;
  const nowIso = new Date().toISOString();
  const backendBuildSha = BACKEND_BUILD_SHA;
  const forgeEnv = process.env.FORGE_ENV || "unknown";

  // Generate stable trace ID
  const traceIdStable = `probe-${Date.now()}_${randomHex(4)}`;
  const traceIdInstance = `${traceIdStable}_inst_${randomHex(4)}`;

  // Extract correlation IDs early (for logging in entry marker)
  const uiReqId = extractUiReqId(payload, headers);
  const probeNonce = extractProbeNonce(payload, headers);

  // Build invocation metadata
  const meta = buildInvocationMeta({ ctx: { payload, headers } as any, uiReqId });

  // STEP 1: Log entry with correlation IDs
  console.log(
    JSON.stringify({
      marker: "FT_PROBE_ENTRY",
      trace_id_stable: traceIdStable,
      ui_req_id: uiReqId || "MISSING",
      ui_local_probe_nonce: probeNonce || "none",
      timestamp_iso: nowIso,
    })
  );

  // Generate backend-side entropy nonce (even if UI nonce was provided)
  const backendProbeNonce = `backend_probe_${Date.now()}_${randomHex(8)}`;

  // STEP 2: FAIL CLOSED - uiReqId is REQUIRED
  if (!uiReqId) {
    console.log(
      JSON.stringify({
        marker: "FT_PROBE_ERR",
        trace_id_stable: traceIdStable,
        ui_req_id: "MISSING",
        error_code: "MISSING_UI_REQ_ID",
        timestamp_iso: nowIso,
      })
    );

    // Create error envelope with trace
    const errorTrace = [
      traceFail("probe", "uiReqId_validation", "MISSING_UI_REQ_ID", "UI request ID is required for correlation")
    ];

    const errorEnvelopeV1 = makeErrorEnvelope({
      resolverName: "probe",
      stepId: "uiReqId_validation",
      errorCode: "MISSING_UI_REQ_ID",
      message: "UI request ID is required for correlation",
      meta,
      trace: errorTrace,
    }) as ErrorEnvelopeV1;

    const errorTruthEnvelope = createErrorEnvelope<ProbeData>(
      "probe",
      "NO_CORRELATION_ID", // Placeholder when truly missing
      null,
      "MISSING_UI_REQ_ID",
      "UI request ID is required for correlation",
      backendBuildSha,
      null,
      traceIdStable
    );

    // Attach error envelope for UI parsing
    (errorTruthEnvelope as any)._errorEnvelopeV1 = errorEnvelopeV1;

    const normalized = normalizeUndefinedToNull(errorTruthEnvelope);
    return normalized;
  }

  // STEP 3: Success - log probe marker and return envelope
  try {
    // Log deterministic marker with all correlation IDs (for grep verification)
    console.log(
      JSON.stringify({
        marker: "FT_PROBE_MARKER",
        trace_id_stable: traceIdStable,
        ui_req_id: uiReqId,
        ui_local_probe_nonce: probeNonce || "none",  // UI-provided nonce (for grep)
        backend_probe_nonce: backendProbeNonce,
        backend_build_sha: backendBuildSha,
        forge_env: forgeEnv,
        timestamp_iso: nowIso,
      })
    );

    console.log(
      JSON.stringify({
        marker: "FT_PROBE_OK",
        trace_id_stable: traceIdStable,
        ui_req_id: uiReqId,
        ui_local_probe_nonce: probeNonce || "none",  // Include nonce in OK marker too
        timestamp_iso: nowIso,
      })
    );

    // Create success trace
    const successTrace = [
      traceOk("probe", "execution", "Probe executed successfully")
    ];

    // Build ProbeData payload
    const probeData: ProbeData = {
      executedAt: nowIso,
      result: { status: "ok" },
    };

    // Create success envelope with error trace data
    const errorEnvelopeV1 = makeErrorEnvelope({
      resolverName: "probe",
      stepId: "execution",
      errorCode: "OK" as any, // Success
      message: "Probe executed successfully",
      meta,
      trace: successTrace,
    }) as ErrorEnvelopeV1;

    // Create success envelope with exact correlation echo
    const successTruthEnvelope = createSuccessEnvelope<ProbeData>(
      "probe",
      uiReqId, // ECHO back exact uiReqId
      probeNonce, // ECHO back probeNonce (or null if not provided)
      probeData,
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
    throw failClosed('FT_PROBE_FAILED', 'Forensic probe execution failed', err);
  }
}
/**
 * Export extraction helpers for tests
 */
export { extractUiReqId, extractProbeNonce, randomHex, hashShort };

