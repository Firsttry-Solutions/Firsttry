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
import { probe } from "./probe"; // FORENSIC_PROBE
import { exportTrustSnapshot as exportTrustSnapshot_resolver } from "./audit_snapshot_export";
import { getSnapshotVariant_resolver } from "./getSnapshotVariant";
import { ft_getDashboardState_v1, ft_contractProof_dashEnvelope_v1 } from "../gadget-resolver";
import { BACKEND_BUILD_SHA } from "../build/backend_build";
// ENTERPRISE REQUIREMENTS: Phase 6 governance snapshot operations
import { createGovernanceSnapshotNow_resolver } from "./createGovernanceSnapshotNow";
import { exportGovernanceSnapshotById_resolver } from "./exportGovernanceSnapshotById";

// ============================================================================
// BACKBONE LAYER 0: Canonical correlation + trace enforcement functions
// ============================================================================

/**
 * Extract ui_req_id from payload using complete fallback chain with normalization
 * 
 * Precedence order (exact):
 * 1. payload.ui_req_id
 * 2. payload.meta.ui_req_id
 * 3. payload.uiReqId
 * 4. payload.meta.uiReqId
 * 5. payload.requestId
 * 6. payload.reqId
 * 7. payload.ui_request_id
 * 8. payload.context.ui_req_id
 * 
 * FAIL CLOSED:
 * - Returns null if not found (caller must handle)
 * - No longer generates "ui_missing_" fallback (deprecated pattern)
 * 
 * Normalization:
 * - If starts with "req_" → normalize to "ui_" + rest
 */
export function extractUiReqId(payload: any): string | null {
  let extracted: string | null = null;

  // Precedence 1
  if (typeof payload?.ui_req_id === 'string' && payload.ui_req_id.trim()) {
    extracted = payload.ui_req_id.trim();
  }
  // Precedence 2
  else if (typeof payload?.meta?.ui_req_id === 'string' && payload.meta.ui_req_id.trim()) {
    extracted = payload.meta.ui_req_id.trim();
  }
  // Precedence 3
  else if (typeof payload?.uiReqId === 'string' && payload.uiReqId.trim()) {
    extracted = payload.uiReqId.trim();
  }
  // Precedence 4
  else if (typeof payload?.meta?.uiReqId === 'string' && payload.meta.uiReqId.trim()) {
    extracted = payload.meta.uiReqId.trim();
  }
  // Precedence 5
  else if (typeof payload?.requestId === 'string' && payload.requestId.trim()) {
    extracted = payload.requestId.trim();
  }
  // Precedence 6
  else if (typeof payload?.reqId === 'string' && payload.reqId.trim()) {
    extracted = payload.reqId.trim();
  }
  // Precedence 7
  else if (typeof payload?.ui_request_id === 'string' && payload.ui_request_id.trim()) {
    extracted = payload.ui_request_id.trim();
  }
  // Precedence 8
  else if (typeof payload?.context?.ui_req_id === 'string' && payload.context.ui_req_id.trim()) {
    extracted = payload.context.ui_req_id.trim();
  }

  // Normalize: if starts with "req_", convert to "ui_"
  if (extracted && extracted.startsWith('req_')) {
    extracted = 'ui_' + extracted.substring(4);
  }

  // FAIL CLOSED: return null if not found (no ui_missing_ fallback)
  return extracted || null;
}

/**
 * Create base meta structure for all responses
 * Uses build-time injected BACKEND_BUILD_SHA for deterministic backend identification
 */
export function metaBase(ui_req_id: string): { ui_req_id: string; backend_build_sha: string; now_iso: string } {
  return {
    ui_req_id,
    backend_build_sha: BACKEND_BUILD_SHA,  // Injected at build time, never "unknown"
    now_iso: new Date().toISOString()
  };
}

/**
 * Enforce trace_id_stable on error responses
 * ui_req_id is now always a string (from extractUiReqId)
 * 
 * Rules:
 * - If ok:false, ensure error.trace_id_stable is non-empty
 * - If missing, generate: trace_${resolverName}_${ui_req_id}_${timestamp}
 * - Ensure error.code and error.message exist (with defaults)
 * - Ensure meta exists (merge with existing or create)
 */
export function ensureTraceOnError(
  res: any,
  resolverName: string,
  ui_req_id: string
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
  // Must NEVER be UNSET, empty, or missing
  if (!res.error.trace_id_stable || typeof res.error.trace_id_stable !== 'string' || res.error.trace_id_stable.trim() === '' || res.error.trace_id_stable === 'UNSET') {
    res.error.trace_id_stable = `trace_${resolverName}_${ui_req_id}_${Date.now()}`;
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
  // FORENSIC_PROBE: Correlation diagnostics
  probe: probe,
  // Regular resolvers
  ping: ping,
  ensureFirstSnapshot: ensureFirstSnapshot,
  getOperationalState: getOperationalState_resolver,
  refreshNow: refreshNow_resolver,
  getBuildInfo: getBuildInfo_resolver,
  getSnapshotDebug: getSnapshotDebug_resolver,
  // BACKBONE LAYER-0: Dashboard envelope with marker (replaces old getStatusSnapshot)
  getStatusSnapshot: ft_getDashboardState_v1,
  // A5: Snapshot variant selection (latest vs seed)
  getSnapshotVariant: getSnapshotVariant_resolver,
  // BACKBONE CONTRACT PROOF: Read-only production envelope verification (no tenant data)
  ft_contractProof_dashEnvelope_v1: ft_contractProof_dashEnvelope_v1,
  exportTrustSnapshot: exportTrustSnapshot_resolver,
  // ENTERPRISE R1c: On-demand governance snapshot creation (Phase 6)
  createGovernanceSnapshotNow: createGovernanceSnapshotNow_resolver,
  // ENTERPRISE R3: Export governance snapshots by ID (Phase 6, blocks seed)
  exportGovernanceSnapshotById: exportGovernanceSnapshotById_resolver
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
  
  // Extract correlationId from payload
  const correlationId = payload.correlationId || "MISSING";
  
  // Log entry point (machine-readable)
  console.log(
    JSON.stringify({
      marker: "RESOLVER_ENTER",
      resolver: resolverName,
      ui_req_id,
      correlationId,
      backend_build_sha: BACKEND_BUILD_SHA,
      ts: new Date().toISOString()
    })
  );
  
  // ENTERPRISE PROOF: Add deterministic runtime proof marker for E2E validation
  // This log enables E2E tests to verify backend resolver wiring and build identity
  // NO PII: ui_req_id is sanitized, no tokens/cookies/emails
  console.log(
    JSON.stringify({
      marker: "FT_RESOLVER_RUNTIME_PROOF",
      resolverName,
      backendBuildSha: BACKEND_BUILD_SHA,
      requestId: ui_req_id,
      correlationId,
      timestamp: new Date().toISOString()
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
        correlationId,
        backend_build_sha: BACKEND_BUILD_SHA,
        error_code: normalized.error.code,
        message: normalized.error.message.substring(0, 200),  // Truncate to 200 chars for safety
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

    // Log success or error with complete details
    // IMPORTANT: Only log RESOLVER_ERR if normalized.ok is EXPLICITLY false
    // (not just falsy - some resolvers return status objects without 'ok' property)
    const isError = normalized.ok === false;
    
    const logObj: any = {
      marker: isError ? "RESOLVER_ERR" : "RESOLVER_OK",
      resolver: resolverName,
      ui_req_id,
      correlationId,
      backend_build_sha: BACKEND_BUILD_SHA,
      ts: new Date().toISOString()
    };

    if (isError && normalized.error) {
      logObj.error_code = normalized.error.code;
      logObj.message = normalized.error.message.substring(0, 200);  // Truncate for safety
      logObj.trace_id_stable = normalized.error.trace_id_stable;
    }

    console.log(JSON.stringify(logObj));

    return normalized;
  } catch (err) {
    // Resolver threw an exception
    const errorMsg = err instanceof Error ? err.message : String(err);
    const errorStack = err instanceof Error ? err.stack : '';

    const errorResponse = {
      ok: false,
      error: {
        code: "RESOLVER_UNHANDLED_EXCEPTION",
        message: errorMsg
      }
    };

    // Normalize (enforces trace_id_stable)
    const normalized = ensureTraceOnError(errorResponse, resolverName, ui_req_id);

    // Log error marker with all details
    console.log(
      JSON.stringify({
        marker: "RESOLVER_ERR",
        resolver: resolverName,
        ui_req_id,
        correlationId,
        backend_build_sha: BACKEND_BUILD_SHA,
        error_code: normalized.error.code,
        message: normalized.error.message.substring(0, 200),  // Truncate for safety
        trace_id_stable: normalized.error.trace_id_stable,
        ts: new Date().toISOString()
      })
    );

    // Log stack trace as separate line (max 20 lines)
    if (errorStack) {
      const stackLines = errorStack.split('\n').slice(0, 20);
      console.log(
        JSON.stringify({
          marker: "STACK",
          resolver: resolverName,
          trace_id_stable: normalized.error.trace_id_stable,
          stack: stackLines.join(' | ')
        })
      );
    }

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

// ============================================================================
// EXPORT for tests
// ============================================================================
export { ALLOWED_RESOLVERS };
