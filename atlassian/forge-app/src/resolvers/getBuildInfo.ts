/**
 * Resolver: getBuildInfo
 * Returns build metadata for dashboard verification and cache-bust proof.
 * Single source of truth: FT_BUILD_SHA and FT_BUILD_TIME_UTC from build_meta.ts.
 * 
 * PHASE 2 FIX:
 * - Now properly exported from gadget-handlers for UI invocation
 * - Always returns structured BuildInfo response (never undefined)
 * - Includes deterministic logging for production verification
 * - Proper error handling with structured error responses
 */

import { FT_BUILD_SHA, FT_BUILD_TIME_UTC } from "../shared/build_meta";

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
  error?: { name: string; message: string };
}

export async function getBuildInfo_resolver(request: any, context: any): Promise<BuildInfo> {
  // PHASE 2 FIX: Structured error handling - always return BuildInfo shape, never throw or undefined
  try {
    // SAFE RESOLVER: build meta is not tenant data; must work even when tenant context is missing.
    // This resolver is called from UI (untrusted, cross-tenant) contexts and must always return.
    const uiReqId = request?.payload?.uiReqId || request?.uiReqId || "(none)";
    const resolvedAt = new Date().toISOString();

    // Best-effort tenant presence detection (do NOT fail if missing)
    let tenantPresent = false;
    try {
      tenantPresent = Boolean(
        (context as any)?.cloudId ||
        (context as any)?.siteUrl ||
        (request as any)?.context?.cloudId
      );
    } catch (_) {
      // Ignore detection errors
    }

    // PHASE 2 FIX: Validate build meta is not empty
    if (!FT_BUILD_SHA || !FT_BUILD_TIME_UTC) {
      const errorMsg = `Build metadata missing: SHA=${!FT_BUILD_SHA ? 'empty' : 'ok'}, TIME=${!FT_BUILD_TIME_UTC ? 'empty' : 'ok'}`;
      console.error(`[BUILDINFO_UI_ERROR] uiReqId=${uiReqId} ${errorMsg}`);
      return {
        ok: false,
        FT_BUILD_SHA: FT_BUILD_SHA || "",
        FT_BUILD_TIME_UTC: FT_BUILD_TIME_UTC || "",
        backendEnv: process.env.FORGE_ENV || "unknown",
        nodeEnv: process.env.NODE_ENV || "unknown",
        resolvedAt,
        uiReqIdEcho: uiReqId,
        tenantPresent,
        error: { name: "MissingBuildMetadata", message: errorMsg }
      };
    }

    const buildInfo: BuildInfo = {
      ok: true,
      FT_BUILD_SHA,
      FT_BUILD_TIME_UTC,
      backendEnv: process.env.FORGE_ENV || "unknown",
      nodeEnv: process.env.NODE_ENV || "unknown",
      resolvedAt,
      uiReqIdEcho: uiReqId,
      tenantPresent,
    };

    // Unmissable logging: proof of resolver invocation in production with UI request tracing
    console.log(`[BUILDINFO_UI_CALLED] uiReqId=${uiReqId} tenantPresent=${tenantPresent} resolvedAt=${resolvedAt}`);
    console.log(`[BUILDINFO_UI_PROOF] uiReqId=${uiReqId} FT_BUILD_SHA=${FT_BUILD_SHA} FT_BUILD_TIME_UTC=${FT_BUILD_TIME_UTC} resolvedAt=${resolvedAt}`);
    console.log("[BUILDINFO_CALLED]", buildInfo);
    console.log(`BUILDINFO_PROOF FT_BUILD_SHA=${FT_BUILD_SHA} FT_BUILD_TIME_UTC=${FT_BUILD_TIME_UTC} resolvedAt=${resolvedAt}`);
    
    return buildInfo;
  } catch (err) {
    // PHASE 2 FIX: Catch-all to ensure we never throw or return undefined
    const errorName = err instanceof Error ? err.name : "UnknownError";
    const errorMsg = err instanceof Error ? err.message : String(err);
    const uiReqId = request?.payload?.uiReqId || request?.uiReqId || "(none)";
    
    console.error(`[BUILDINFO_UI_ERROR] uiReqId=${uiReqId} error=${errorName}: ${errorMsg}`);
    
    return {
      ok: false,
      FT_BUILD_SHA: FT_BUILD_SHA || "",
      FT_BUILD_TIME_UTC: FT_BUILD_TIME_UTC || "",
      backendEnv: process.env.FORGE_ENV || "unknown",
      nodeEnv: process.env.NODE_ENV || "unknown",
      resolvedAt: new Date().toISOString(),
      uiReqIdEcho: uiReqId,
      tenantPresent: false,
      error: { name: errorName, message: errorMsg }
    };
  }
}
