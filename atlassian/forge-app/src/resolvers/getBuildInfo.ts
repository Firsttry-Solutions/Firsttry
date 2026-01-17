/**
 * Resolver: getBuildInfo
 * Returns build metadata for dashboard verification and cache-bust proof.
 * Single source of truth: FT_BUILD_SHA and FT_BUILD_TIME_UTC from build_meta.ts.
 * 
 * REQUIREMENTS:
 * - Always returns actual backend build SHA and time (NEVER "unknown")
 * - NEVER throws. Always returns structured BuildInfo.
 * - On error: returns ok=false with stable error_code and deterministic trace_id
 * - Emits single-line JSON log on failure with trace_id and ui_req_id
 */

import { resolveTenantKeyOrNull } from "../security/resolveTenantKey";
import { FT_BUILD_SHA, FT_BUILD_TIME_UTC } from "../shared/build_meta";
import {
  classifyError,
  generateTraceIdStable,
  generateTraceIdInstance,
  emitResolverErrorLog,
  extractUiReqId,
} from "./backbone_error_handling";

/**
 * BuildInfo interface - structured response from getBuildInfo resolver
 */
export interface BuildInfo {
  ok: boolean;
  FT_BUILD_SHA: string;
  FT_BUILD_TIME_UTC: string;
  backendEnv: string;
  nodeEnv: string;
  resolvedAt: string;
  uiReqIdEcho?: string;
  tenantPresent?: boolean;
  tenantKeyHash?: string;
  error?: { name: string; message: string };
}

export async function getBuildInfo_resolver(req: any): Promise<BuildInfo> {
  // BACKBONE NO-THROW CONTRACT: This resolver NEVER throws.
  // It always returns BuildInfo shape with ok flag and error details if something fails.
  
  try {
    // Build metadata is not tenant data; must work even when tenant context is missing.
    // This resolver is called from UI (untrusted, cross-tenant) contexts and must always return.
    const uiReqId = extractUiReqId(req);
    const context = req.context || req;
    const resolvedAt = new Date().toISOString();

    // LOG_CANARY: Proof that we are reading the correct production log stream.
    // MUST execute before any throw to guarantee visibility.
    // 
    // PROOF STEPS:
    // 1. Deploy to production
    // 2. Reload gadget in dashboard
    // 3. Run: timeout 90 forge logs --environment production --since 10m | grep -F "LOG_CANARY" | head -50
    // If zero lines found -> not reading correct logs OR resolver never executed OR deploy not active.
    //
    // Includes: resolver name, build SHA, ISO timestamp, UI request ID for correlation
    console.log(`LOG_CANARY resolver=getBuildInfo build=${FT_BUILD_SHA} ts=${resolvedAt} ui_req_id=${uiReqId || 'UNSET'}`);

    // Best-effort tenant resolution (safe, non-throwing)
    let tenantKeyHash: string | undefined;
    let tenantPresent = false;
    try {
      const tenantInfo = resolveTenantKeyOrNull(context);
      if (tenantInfo) {
        tenantKeyHash = tenantInfo.tenantKeyHash;
        tenantPresent = true;
        // TENANT_PROOF: log on entry with actual tenant resolution
        console.log("TENANT_PROOF", JSON.stringify({
          resolver: "getBuildInfo",
          tenantKeyHash,
          source: tenantInfo.source,
          ts: new Date().toISOString()
        }));
      }
    } catch (_) {
      // Ignore tenant detection errors - getBuildInfo works cross-tenant
      console.log("TENANT_PROOF", JSON.stringify({
        resolver: "getBuildInfo",
        tenantKeyHash: "unknown",
        source: "unavailable",
        ts: new Date().toISOString()
      }));
    }

    // CRITICAL: Resolve build SHA - MUST NOT return "unknown" or fallback
    let buildSha = FT_BUILD_SHA;
    let buildTimeUtc = FT_BUILD_TIME_UTC;
    
    if (!buildSha || buildSha === "unknown") {
      // Try alternative source
      buildSha = process.env.FORGE_APP_VERSION || null;
    }
    
    if (!buildSha) {
      // FAIL CLOSED: throw if we cannot resolve build SHA
      throw new Error("BUILD_SHA_MISSING_IN_RUNTIME: neither FT_BUILD_SHA nor FORGE_APP_VERSION available");
    }
    
    if (!buildTimeUtc) {
      // FAIL CLOSED: throw if we cannot resolve build time
      throw new Error("BUILD_TIME_MISSING_IN_RUNTIME: FT_BUILD_TIME_UTC not available");
    }

    const buildInfo: BuildInfo = {
      ok: true,
      FT_BUILD_SHA: buildSha,
      FT_BUILD_TIME_UTC: buildTimeUtc,
      backendEnv: process.env.FORGE_ENV || "UNKNOWN",
      nodeEnv: process.env.NODE_ENV || "UNKNOWN",
      resolvedAt,
      uiReqIdEcho: uiReqId || "(none)",
      tenantPresent,
      tenantKeyHash,
    };

    // BUILDINFO_PROOF: log after resolving the SHA (never unknown)
    console.log("BUILDINFO_PROOF", JSON.stringify({
      buildSha,
      buildTimeUtc,
      tenantPresent,
      trace_id_stable: generateTraceIdStable("RESOLVER_UNHANDLED_EXCEPTION", {}, buildSha), // success trace for correlation
      ts: new Date().toISOString()
    }));
    
    return buildInfo;
  } catch (err) {
    // CATCH-ALL: Ensure we never throw. Extract error details and return error payload.
    const errorCode = classifyError(err, "getBuildInfo");
    const traceIdStable = generateTraceIdStable(errorCode, err, FT_BUILD_SHA);
    const traceIdInstance = generateTraceIdInstance(traceIdStable, err);
    const errorMsg = err instanceof Error ? err.message : String(err);
    const uiReqId = extractUiReqId(req);

    // Emit single-line JSON log (includes both trace IDs)
    emitResolverErrorLog(
      traceIdStable,
      traceIdInstance,
      errorCode,
      errorMsg,
      FT_BUILD_SHA,
      uiReqId,
      "getBuildInfo"
    );
    
    // Return structured error (never throw)
    return {
      ok: false,
      FT_BUILD_SHA: "ERROR_EXCEPTION",
      FT_BUILD_TIME_UTC: "ERROR_EXCEPTION",
      backendEnv: process.env.FORGE_ENV || "UNKNOWN",
      nodeEnv: process.env.NODE_ENV || "UNKNOWN",
      resolvedAt: new Date().toISOString(),
      uiReqIdEcho: uiReqId || "(none)",
      tenantPresent: false,
      error: {
        name: errorCode,
        message: errorMsg.substring(0, 200),
      }
    };
  }
}
