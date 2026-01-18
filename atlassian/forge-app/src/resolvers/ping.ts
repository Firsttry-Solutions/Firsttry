/**
 * BACKBONE LAYER 0: PING RESOLVER
 * 
 * Hardened health check with correlation support:
 * 1. Accepts ui_req_id from caller (for correlation)
 * 2. ALWAYS includes ui_req_id in meta on success AND error
 * 3. NEVER returns "no-trace" - always has trace_id_stable on error
 * 4. Returns meta: { ui_req_id, backend_build_sha, now_iso }
 * 5. Emits JSON log (PING_OK or PING_ERR) for grepping
 */

import { emitResolverErrorLog, classifyError } from "./backbone_error_handling";
import { BACKEND_BUILD_SHA } from "../build/backend_build";

export interface PingResponseMeta {
  ui_req_id: string;
  backend_build_sha: string;
  now_iso: string;
}

export interface PingErrorResponse {
  code: string;
  message: string;
  trace_id_stable: string;
  trace_id_instance?: string;
}

export interface PingResponse {
  ok: boolean;
  meta: PingResponseMeta;
  error?: PingErrorResponse;
}

/**
 * Ping resolver: Health check with correlation
 * Accepts { ui_req_id } from UI
 * Always returns meta with ui_req_id for log grepping
 * Uses BACKEND_BUILD_SHA injected at build time (never "unknown")
 */
export async function ping(req?: any): Promise<PingResponse> {
  const resolverName = "ping";
  const backendBuildSha = BACKEND_BUILD_SHA; // Injected at build time, never fallback
  const nowIso = new Date().toISOString();
  
  // Extract ui_req_id from request (may be undefined, we'll generate one if needed)
  const uiReqId = req?.payload?.ui_req_id || req?.ui_req_id || `req_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
  
  try {
    const meta: PingResponseMeta = {
      ui_req_id: uiReqId,
      backend_build_sha: backendBuildSha,
      now_iso: nowIso
    };
    
    // Log successful ping as JSON (grepable)
    console.log(JSON.stringify({
      marker: "PING_OK",
      ui_req_id: uiReqId,
      backend_build_sha: backendBuildSha,
      timestamp_iso: nowIso
    }));

    return {
      ok: true,
      meta
    };
  } catch (err) {
    // CRITICAL: Never let ping error go unhandled
    // Must ALWAYS generate trace_id_stable (never "no-trace")
    const errorMsg = err instanceof Error ? err.message : String(err);
    const errorCode = classifyError(err, "internal");
    
    // Generate stable + instance trace IDs
    const traceIdStable = `ping-error-${Date.now()}`;
    const traceIdInstance = `${traceIdStable}-${Math.random().toString(36).substring(7)}`;
    
    // Emit error log
    emitResolverErrorLog(
      traceIdStable,
      traceIdInstance,
      errorCode,
      errorMsg,
      backendBuildSha,
      uiReqId,
      resolverName
    );

    // Log error as JSON (grepable) - includes trace_id_stable
    console.log(JSON.stringify({
      marker: "PING_ERR",
      ui_req_id: uiReqId,
      backend_build_sha: backendBuildSha,
      timestamp_iso: nowIso,
      error_code: errorCode,
      trace_id_stable: traceIdStable
    }));

    const meta: PingResponseMeta = {
      ui_req_id: uiReqId,
      backend_build_sha: backendBuildSha,
      now_iso: nowIso
    };

    return {
      ok: false,
      meta,
      error: {
        code: errorCode,
        message: errorMsg,
        trace_id_stable: traceIdStable,
        trace_id_instance: traceIdInstance
      }
    };
  }
}
