/**
 * Gadget Handler Resolver Wrapper
 * 
 * PHASE 2 FIX: Consolidates all gadget-accessible resolvers in one module.
 * This allows the gadget UI to invoke multiple resolvers from a single handler function.
 * 
 * Exports:
 * - getStatusSnapshot (required gadget load)
 * - getBuildInfo (optional runtime build verification)
 * 
 * Manifest reference:
 * function:
 *   - key: get-status-snapshot-fn
 *     handler: resolvers/gadget-handlers.getStatusSnapshot
 * 
 * UI invocation:
 *   invoke('getStatusSnapshot', {...}) // returns GovernanceStatusV1
 *   invoke('getBuildInfo', { uiReqId: ... }) // returns BuildInfo
 */

import { getStatusSnapshot_resolver } from "./getStatusSnapshot";
import { getBuildInfo_resolver } from "./getBuildInfo";

/**
 * Main gadget resolver: getStatusSnapshot
 * Entry point when gadget loads; returns current governance status snapshot.
 * 
 * PHASE 2 FIX: Wrapped to ensure error handling at handler boundary
 */
export async function getStatusSnapshot(request: any, context: any) {
  try {
    return await getStatusSnapshot_resolver(request, context);
  } catch (err) {
    console.error("[gadget-handlers.getStatusSnapshot] Unexpected error:", err);
    // Return minimal valid response instead of throwing
    return {
      workspaceKey: "UNKNOWN",
      health: "ERROR",
      degradedReason: `Handler error: ${err instanceof Error ? err.message : String(err)}`,
      generatedAt: new Date().toISOString(),
      counts: { total: 0, issues: 0, repos: 0, orgs: 0 },
      evidence: [],
    };
  }
}

/**
 * Build info resolver: getBuildInfo
 * Called by UI to verify backend build metadata in real-time.
 * Provides correlation via uiReqId for tracing.
 * 
 * PHASE 2 FIX: Wrapped to ensure error handling at handler boundary
 */
export async function getBuildInfo(request: any, context: any) {
  try {
    return await getBuildInfo_resolver(request, context);
  } catch (err) {
    console.error("[gadget-handlers.getBuildInfo] Unexpected error:", err);
    // Return minimal valid BuildInfo response instead of throwing
    const uiReqId = request?.payload?.uiReqId || request?.uiReqId || "(none)";
    return {
      ok: false,
      FT_BUILD_SHA: "",
      FT_BUILD_TIME_UTC: "",
      backendEnv: process.env.FORGE_ENV || "unknown",
      nodeEnv: process.env.NODE_ENV || "unknown",
      resolvedAt: new Date().toISOString(),
      uiReqIdEcho: uiReqId,
      tenantPresent: false,
      error: { 
        name: err instanceof Error ? err.name : "UnknownError",
        message: err instanceof Error ? err.message : String(err)
      }
    };
  }
}
