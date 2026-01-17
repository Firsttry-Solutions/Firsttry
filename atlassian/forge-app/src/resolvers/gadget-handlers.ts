/**
 * Canonical Gadget Handler Dispatcher
 * 
 * SINGLE ENTRY POINT for all gadget UI invocations.
 * 
 * BACKBONE LAYER 0 ENFORCEMENT (Handler Level):
 * 1. Extracts ui_req_id from payload (canonical field)
 * 2. Guarantees all error responses include trace_id_stable
 * 3. Logs RESOLVER_ENTER and RESOLVER_OK/RESOLVER_ERR with ui_req_id for grepping
 * 4. Normalizes meta across all responses: { ui_req_id, backend_build_sha, now_iso }
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

// ============================================================================
// BACKBONE LAYER 0: Canonical correlation + trace enforcement functions
// ============================================================================

/**
 * Extract ui_req_id from payload using fallback chain
 * Tries: payload.ui_req_id → payload.meta?.ui_req_id → payload.uiReqId → payload.requestId
 */
export function extractUiReqId(payload: any): string | null {
  if (typeof payload?.ui_req_id === 'string') {
    return payload.ui_req_id;
  }
  if (typeof payload?.meta?.ui_req_id === 'string') {
    return payload.meta.ui_req_id;
  }
  if (typeof payload?.uiReqId === 'string') {
    return payload.uiReqId;
  }
  if (typeof payload?.requestId === 'string') {
    return payload.requestId;
  }
  return null;
}

/**
 * Create base meta structure for all responses
 */
export function metaBase(ui_req_id: string | null): { ui_req_id: string | null; backend_build_sha: string; now_iso: string } {
  return {
    ui_req_id,
    backend_build_sha: process.env.BACKEND_BUILD_SHA || "unknown",
    now_iso: new Date().toISOString()
  };
}

/**
 * Enforce trace_id_stable on error responses
 * Rules:
 * - If ok:false, ensure error.trace_id_stable is non-empty
 * - If missing, generate: trace_${resolverName}_${ui_req_id ?? "no_ui_req_id"}
 * - Ensure error.code and error.message exist (with defaults)
 * - Ensure meta exists (merge with existing or create)
 */
export function ensureTraceOnError(
  res: any,
  resolverName: string,
  ui_req_id: string | null
): any {
  // If ok:true, just ensure meta exists
  if (res?.ok !== false) {
    if (!res) {
      return { ok: true, meta: metaBase(ui_req_id) };
    }
    if (!res.meta) {
      res.meta = metaBase(ui_req_id);
    } else {
      // Merge with base
      res.meta = { ...metaBase(ui_req_id), ...res.meta };
    }
    return res;
  }

  // ok:false - must have error with trace_id_stable
  if (!res.error) {
    res.error = {};
  }

  // Ensure error.code
  if (!res.error.code || typeof res.error.code !== 'string') {
    res.error.code = "RESOLVER_UNHANDLED_EXCEPTION";
  }

  // Ensure error.message
  if (!res.error.message || typeof res.error.message !== 'string') {
    res.error.message = "Resolver failed";
  }

  // Ensure error.trace_id_stable - CRITICAL
  if (!res.error.trace_id_stable || typeof res.error.trace_id_stable !== 'string' || res.error.trace_id_stable.trim() === '') {
    res.error.trace_id_stable = `trace_${resolverName}_${ui_req_id ?? "no_ui_req_id"}_${Date.now()}`;
  }

  // Ensure meta
  if (!res.meta) {
    res.meta = metaBase(ui_req_id);
  } else {
    res.meta = { ...metaBase(ui_req_id), ...res.meta };
  }

  return res;
}

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
 * 
 * BACKBONE LAYER 0 ENFORCEMENT:
 * 1. Extract ui_req_id from payload
 * 2. Log RESOLVER_ENTER with ui_req_id (grepable)
 * 3. Execute resolver in try/catch
 * 4. Normalize all responses: ensure trace_id_stable on errors, meta on all
 * 5. Log RESOLVER_OK or RESOLVER_ERR with ui_req_id
 * 
 * Dispatcher pattern: UI passes resolverName in payload
 */
export async function handler(req: any) {
  const payload = req.payload || req;
  const resolverName = payload.resolverName || payload.resolver || "getStatusSnapshot";
  
  // BACKBONE LAYER 0: Extract ui_req_id using canonical fallback chain
  const ui_req_id = extractUiReqId(payload);
  
  // Log entry point (machine-readable)
  console.log(
    JSON.stringify({
      marker: "RESOLVER_ENTER",
      resolver: resolverName,
      ui_req_id,
      backend_build_sha: process.env.BACKEND_BUILD_SHA || "unknown",
      ts: new Date().toISOString()
    })
  );

  // Enforce allowlist
  if (!(resolverName in ALLOWED_RESOLVERS)) {
    const deniedResponse = {
      ok: false,
      error: {
        code: "INVOKE_KEY_NOT_ALLOWED",
        message: `Resolver '${resolverName}' is not in the allowlist`
      }
    };

    // Normalize error (ensure trace_id_stable)
    const normalized = ensureTraceOnError(deniedResponse, resolverName, ui_req_id);

    console.log(
      JSON.stringify({
        marker: "RESOLVER_ERR",
        resolver: resolverName,
        ui_req_id,
        backend_build_sha: process.env.BACKEND_BUILD_SHA || "unknown",
        error_code: normalized.error.code,
        trace_id_stable: normalized.error.trace_id_stable,
        ts: new Date().toISOString()
      })
    );

    return normalized;
  }

  // Execute resolver with proper error handling
  try {
    const resolverFunc = ALLOWED_RESOLVERS[resolverName];

    // Pass ui_req_id to resolver in standard locations
    const wrappedReq = {
      ...req,
      payload: {
        ...(req.payload || {}),
        ui_req_id
      },
      ui_req_id
    };

    const result = await resolverFunc(wrappedReq);

    // Normalize response: ensure trace_id_stable on errors, meta on all
    const normalized = ensureTraceOnError(result, resolverName, ui_req_id);

    // Log success
    console.log(
      JSON.stringify({
        marker: normalized.ok ? "RESOLVER_OK" : "RESOLVER_ERR",
        resolver: resolverName,
        ui_req_id,
        backend_build_sha: process.env.BACKEND_BUILD_SHA || "unknown",
        ...(normalized.ok ? {} : { error_code: normalized.error?.code, trace_id_stable: normalized.error?.trace_id_stable }),
        ts: new Date().toISOString()
      })
    );

    return normalized;
  } catch (err) {
    // Resolver threw an exception
    const errorMsg = err instanceof Error ? err.message : String(err);

    const errorResponse = {
      ok: false,
      error: {
        code: "RESOLVER_UNHANDLED_EXCEPTION",
        message: errorMsg
      }
    };

    // Normalize (enforces trace_id_stable)
    const normalized = ensureTraceOnError(errorResponse, resolverName, ui_req_id);

    console.log(
      JSON.stringify({
        marker: "RESOLVER_ERR",
        resolver: resolverName,
        ui_req_id,
        backend_build_sha: process.env.BACKEND_BUILD_SHA || "unknown",
        error_code: normalized.error.code,
        trace_id_stable: normalized.error.trace_id_stable,
        exception_message: errorMsg,
        ts: new Date().toISOString()
      })
    );

    return normalized;
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
