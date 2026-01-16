/**
 * Resolver: getBuildInfo
 * Returns build metadata for dashboard verification and cache-bust proof.
 * Single source of truth: FT_BUILD_SHA and FT_BUILD_TIME_UTC from build_meta.ts.
 * 
 * REQUIREMENTS:
 * - Always returns actual backend build SHA and time (NEVER "unknown")
 * - Logs TENANT_PROOF on entry (safe tenant detection for cross-tenant context)
 * - Logs BUILDINFO_PROOF with build identifiers
 * - Returns error if build metadata is missing
 */

import { resolveTenantKeyOrNull } from "../security/resolveTenantKey";
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
  tenantKeyHash?: string;
  error?: { name: string; message: string };
}

export async function getBuildInfo_resolver(req: any): Promise<BuildInfo> {
  // Structured error handling - always return BuildInfo shape, never throw or undefined
  try {
    // Build metadata is not tenant data; must work even when tenant context is missing.
    // This resolver is called from UI (untrusted, cross-tenant) contexts and must always return.
    const uiReqId = req?.payload?.uiReqId || req?.uiReqId || "(none)";
    const context = req.context || req;
    const resolvedAt = new Date().toISOString();

    // Best-effort tenant resolution (safe, non-throwing)
    let tenantKeyHash: string | undefined;
    let tenantPresent = false;
    try {
      const tenantInfo = resolveTenantKeyOrNull(context);
      if (tenantInfo) {
        tenantKeyHash = tenantInfo.tenantKeyHash;
        tenantPresent = true;
        // TENANT_PROOF: log on entry with actual tenant resolution
        console.log(`TENANT_PROOF resolver=getBuildInfo tenantKeyHash=${tenantKeyHash} source=${tenantInfo.source}`);
      }
    } catch (_) {
      // Ignore tenant detection errors - getBuildInfo works cross-tenant
      console.log(`TENANT_PROOF resolver=getBuildInfo tenantKeyHash=unknown source=unavailable`);
    }

    // CRITICAL: Validate build meta is not empty (MUST fail if missing)
    if (!FT_BUILD_SHA || !FT_BUILD_TIME_UTC) {
      const errorMsg = `Build metadata missing: SHA=${!FT_BUILD_SHA ? 'MISSING' : 'ok'}, TIME=${!FT_BUILD_TIME_UTC ? 'MISSING' : 'ok'}`;
      console.error(`[BUILDINFO_ERROR] uiReqId=${uiReqId} ${errorMsg}`);
      return {
        ok: false,
        FT_BUILD_SHA: FT_BUILD_SHA || "ERROR_MISSING",
        FT_BUILD_TIME_UTC: FT_BUILD_TIME_UTC || "ERROR_MISSING",
        backendEnv: process.env.FORGE_ENV || "UNKNOWN",
        nodeEnv: process.env.NODE_ENV || "UNKNOWN",
        resolvedAt,
        uiReqIdEcho: uiReqId,
        tenantPresent,
        tenantKeyHash,
        error: { name: "MissingBuildMetadata", message: errorMsg }
      };
    }

    const buildInfo: BuildInfo = {
      ok: true,
      FT_BUILD_SHA,
      FT_BUILD_TIME_UTC,
      backendEnv: process.env.FORGE_ENV || "UNKNOWN",
      nodeEnv: process.env.NODE_ENV || "UNKNOWN",
      resolvedAt,
      uiReqIdEcho: uiReqId,
      tenantPresent,
      tenantKeyHash,
    };

    // BUILDINFO_PROOF: undeniable proof of backend build SHA
    console.log(`BUILDINFO_PROOF tenantKeyHash=${tenantKeyHash || 'cross-tenant'} backendBuildSha=${FT_BUILD_SHA} uiReqId=${uiReqId} ok=true resolvedAt=${resolvedAt}`);
    console.log(`FT_PROOF_MARKER uiReqId=${uiReqId} buildSha=${FT_BUILD_SHA} backendBuildSha=${FT_BUILD_SHA} ok=true tenantKeyHash=${tenantKeyHash || 'unknown'}`);
    
    console.log(
      "FT_PROOF_MARKER",
      JSON.stringify({
        uiReqId,
        buildSha: FT_BUILD_SHA,
        tenantPresent
      })
    );

    console.log(
      "BUILDINFO_PROOF",
      JSON.stringify({
        buildSha: FT_BUILD_SHA,
        buildTimeUtc: FT_BUILD_TIME_UTC,
        tenantPresent
      })
    );
    
    return buildInfo;
  } catch (err) {
    // Catch-all to ensure we never throw or return undefined
    const errorName = err instanceof Error ? err.name : "UnknownError";
    const errorMsg = err instanceof Error ? err.message : String(err);
    const reqUiReqId = req?.payload?.uiReqId || req?.uiReqId || "(none)";
    
    console.error(`[BUILDINFO_ERROR] uiReqId=${reqUiReqId} error=${errorName}: ${errorMsg}`);
    console.log(`FT_PROOF_MARKER_ERROR uiReqId=${reqUiReqId} ok=false errorName=${errorName}`);
    
    return {
      ok: false,
      FT_BUILD_SHA: "ERROR_EXCEPTION",
      FT_BUILD_TIME_UTC: "ERROR_EXCEPTION",
      backendEnv: process.env.FORGE_ENV || "UNKNOWN",
      nodeEnv: process.env.NODE_ENV || "UNKNOWN",
      resolvedAt: new Date().toISOString(),
      uiReqIdEcho: reqUiReqId,
      tenantPresent: false,
      error: { name: errorName, message: errorMsg }
    };
  }
}
