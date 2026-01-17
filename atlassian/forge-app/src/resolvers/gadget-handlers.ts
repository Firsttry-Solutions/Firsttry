/**
 * Canonical Gadget Handler Dispatcher
 * 
 * SINGLE ENTRY POINT for all gadget UI invocations.
 * Enforces allowlist: only registered resolvers are callable.
 * All resolvers wrapped with error handling at handler boundary.
 * 
 * Registered resolvers:
 * - ping (health check, returns backend_build_sha)
 * - getOperationalState (authoritative system status)
 * - refreshNow (trigger snapshot collection)
 * - getBuildInfo (build metadata)
 * - getSnapshotDebug (debug info)
 * - getStatusSnapshot (status snapshot)
 * - exportSnap (export JSON/CSV)
 */

import { getStatusSnapshot_resolver } from "./getStatusSnapshot";
import { getBuildInfo_resolver } from "./getBuildInfo";
import { getSnapshotDebug_resolver } from "./getSnapshotDebug";
import { getOperationalState_resolver } from "./getOperationalState";
import { refreshNow_resolver } from "./refreshNow";
import { ping } from "./ping";
import { ensureFirstSnapshot } from "./ensureFirstSnapshot";

// TODO: Replace with actual export resolver
// For now, use a stub that returns error if no snapshots
async function exportSnap_resolver(req: any) {
  const opState = await getOperationalState_resolver(req);
  if (!opState.export.enabled) {
    return {
      ok: false,
      code: "NO_SNAPSHOTS",
      reason: opState.export.reasonDisabled
    };
  }
  // In production, this would generate and return JSON/CSV
  return {
    ok: true,
    code: "EXPORT_READY",
    message: "Export functionality to be implemented"
  };
}

/**
 * Resolver allowlist: Only these can be invoked by UI
 */
const ALLOWED_RESOLVERS: Record<string, (req: any) => Promise<any>> = {
  ping: ping,
  ensureFirstSnapshot: ensureFirstSnapshot,
  getOperationalState: getOperationalState_resolver,
  refreshNow: refreshNow_resolver,
  getBuildInfo: getBuildInfo_resolver,
  getSnapshotDebug: getSnapshotDebug_resolver,
  getStatusSnapshot: getStatusSnapshot_resolver,
  exportSnap: exportSnap_resolver
};

/**
 * Single canonical handler entry point (referenced by manifest as gadget-resolver.handler)
 * Dispatcher pattern: UI passes resolverName in payload
 */
export async function handler(req: any) {
  const payload = req.payload || req;
  const resolverName = payload.resolverName || payload.resolver || "getStatusSnapshot";
  const uiReqId = payload.uiReqId || `req_${Date.now()}`;

  console.log(
    "GADGET_INVOKE_REQUEST",
    JSON.stringify({
      uiReqId,
      resolverName,
      ts: new Date().toISOString()
    })
  );

  // Enforce allowlist
  if (!(resolverName in ALLOWED_RESOLVERS)) {
    console.error(
      "GADGET_INVOKE_DENIED",
      JSON.stringify({
        uiReqId,
        resolverName,
        reason: "INVOKE_KEY_NOT_ALLOWED",
        ts: new Date().toISOString()
      })
    );
    return {
      ok: false,
      error: {
        code: "INVOKE_KEY_NOT_ALLOWED",
        message: `Resolver '${resolverName}' is not in the allowlist`
      }
    };
  }

  // Resolve and invoke
  try {
    const resolverFunc = ALLOWED_RESOLVERS[resolverName];
    
    // BACKBONE LAYER 0: Pass ui_req_id to resolver
    // Create a wrapped request that includes ui_req_id in a standard location
    const wrappedReq = {
      ...req,
      payload: {
        ...req.payload,
        ui_req_id: uiReqId
      },
      ui_req_id: uiReqId
    };
    
    const result = await resolverFunc(wrappedReq);

    console.log(
      "GADGET_INVOKE_SUCCESS",
      JSON.stringify({
        uiReqId,
        resolverName,
        ts: new Date().toISOString()
      })
    );

    return result;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(
      "GADGET_INVOKE_ERROR",
      JSON.stringify({
        uiReqId,
        resolverName,
        error: errorMsg,
        ts: new Date().toISOString()
      })
    );

    return {
      ok: false,
      error: {
        code: "RESOLVER_ERROR",
        message: errorMsg
      }
    };
  }
}

// ============ BACKWARD COMPATIBILITY ==========
// These exported functions are for direct testing/calling if needed

export async function getStatusSnapshot(req: any) {
  try {
    return await getStatusSnapshot_resolver(req);
  } catch (err) {
    console.error("[gadget-handlers.getStatusSnapshot] Unexpected error:", err);
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

export async function getBuildInfo(req: any) {
  try {
    return await getBuildInfo_resolver(req);
  } catch (err) {
    console.error("[gadget-handlers.getBuildInfo] Unexpected error:", err);
    const uiReqId = req?.payload?.uiReqId || req?.uiReqId || "(none)";
    return {
      ok: false,
      FT_BUILD_SHA: "ERROR_EXCEPTION",
      FT_BUILD_TIME_UTC: "ERROR_EXCEPTION",
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
