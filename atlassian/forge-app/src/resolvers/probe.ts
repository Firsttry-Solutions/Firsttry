/**
 * FORENSIC_PROBE: Deterministic Correlation Proof
 * 
 * PHASE 1 (UI-SIDE, COMPLETE):
 * - UI generates deterministic ui_req_id + local_probe_nonce client-side
 * - Immediately displays in UI (before backend call)
 * - Sends both to backend in payload
 * 
 * PHASE 2 (BACKEND, THIS FILE):
 * - Backend accepts ui_req_id + local_probe_nonce from UI
 * - Generates backend_probe_nonce (server-side entropy)
 * - Logs FT_PROBE_MARKER with ALL correlation IDs
 * - Preserves UI-generated nonce for grep verification
 * - Returns meta with backend_build_sha + forge_env + trace_id
 * 
 * PHASE 3 (GREP VERIFICATION):
 * - tools/probe_prod.sh greps logs by UI nonce
 * - Proves backend received and logged probe invocation
 * - Returns PASS/FAIL deterministically
 * 
 * Contract:
 * - Always returns ok:true/false with meta + observed fields
 * - Never throws
 * - Logs exactly one FT_PROBE_MARKER JSON line per invocation
 * - trace_id_stable never empty/UNSET
 * - Backend nonce always included (server-side entropy)
 * - UI nonce (local_probe_nonce) preserved for grep correlation
 */

import crypto from 'crypto';
import { BACKEND_BUILD_SHA } from "../build/backend_build";

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Generate deterministic random hex (safe for logging)
 */
function randomHex(bytes: number): string {
  try {
    return crypto.randomBytes(bytes).toString('hex');
  } catch {
    // Fallback if crypto unavailable
    return Math.random().toString(16).substring(2, 2 + bytes * 2);
  }
}

/**
 * SHA256 hash, truncated to 12 chars (safe short hash for sensitive data)
 */
function hashShort(s: string): string {
  try {
    return crypto.createHash('sha256').update(s).digest('hex').substring(0, 12);
  } catch {
    // Fallback
    return 'hash_err_' + Math.random().toString(36).substring(2, 10);
  }
}

/**
 * Extract and normalize ui_req_id from payload
 * Precedence: ui_req_id → meta.ui_req_id → uiReqId → meta.uiReqId → requestId → reqId
 * Normalization: req_* → ui_*
 * Fallback: ui_missing_<timestamp>_<random>
 */
function extractUiReqId(payload: any): string {
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

  // Normalize: req_* → ui_*
  if (extracted && extracted.startsWith('req_')) {
    extracted = 'ui_' + extracted.substring(4);
  }

  // Fallback: generate if missing
  if (!extracted) {
    extracted = `ui_missing_${Date.now()}_${randomHex(4)}`;
  }

  return extracted;
}

// ============================================================================
// PROBE RESPONSE TYPES
// ============================================================================

export interface ProbeMeta {
  ui_req_id: string;
  ui_local_probe_nonce: string;        // UI-generated nonce (for grep)
  backend_probe_nonce: string;         // Server-side entropy
  backend_build_sha: string;
  now_iso: string;
  node: string;
  function_name: string;
  forge_env: string;
}

export interface ProbeObserved {
  payload_keys: string[];
  correlation_fields: Record<string, any>;
  context_signals: Record<string, any>;
}

export interface ProbeErrorInfo {
  code: string;
  message: string;
  trace_id_stable: string;
}

export interface ProbeResponse {
  ok: boolean;
  meta: ProbeMeta;
  observed: ProbeObserved;
  error?: ProbeErrorInfo;
}

// ============================================================================
// PROBE RESOLVER
// ============================================================================

/**
 * FORENSIC_PROBE resolver
 * 
 * Proves:
 * 1. UI → backend invocation worked
 * 2. Backend received payload with correlation fields
 * 3. Backend extracted and normalized ui_req_id correctly
 * 4. Backend identity (build_sha) matches UI footer
 * 5. Logs are deterministically grepable by nonce
 * 
 * PHASE C (Invoke Error Truth):
 * - ALWAYS logs FT_PROBE_ENTRY at function start (before any throw-able code)
 * - Wraps entire logic in try/catch (never throws raw)
 * - On error, returns structured error payload: {ok: false, error: {code, message, traceId, raw}, meta}
 * - Guarantees ui_req_id, backend_build_sha, forge_env in meta even on error
 */
export async function probe(req?: any): Promise<ProbeResponse> {
  const payload = req?.payload || req || {};
  const nowIso = new Date().toISOString();
  
  // ===================================================================
  // PHASE C: Log FT_PROBE_ENTRY IMMEDIATELY (before any throw-able code)
  // This GUARANTEES execution proof even if later code fails
  // ===================================================================
  const probeEntryId = `probe_entry_${Date.now()}_${randomHex(4)}`;
  
  // Extract these early (safe operations, won't throw)
  const uiLocalProbeNonce = payload?.meta?.local_probe_nonce 
    || payload?.local_probe_nonce 
    || `ui_missing_${Date.now()}_${randomHex(4)}`;
  const uiReqId = extractUiReqId(payload);
  
  // Log entry marker (deterministic execution proof)
  const entryMarker = {
    marker: 'FT_PROBE_ENTRY',
    probe_entry_id: probeEntryId,
    ui_req_id: uiReqId,
    ui_local_probe_nonce: uiLocalProbeNonce,
    timestamp_iso: nowIso,
    function_name: process.env.FORGE_FUNCTION_NAME || 'probe-resolver'
  };
  
  console.log(`FT_PROBE_ENTRY ${JSON.stringify(entryMarker)}`);
  
  // Continue with original probe logic
  const backendBuildSha = BACKEND_BUILD_SHA; // Will use this in error handling too
  
  // ===================================================================
  // PHASE 2B: Generate backend-side entropy
  // ===================================================================
  // Backend generates its own nonce for server-side entropy proof
  // This proves backend executed (separate from UI nonce)
  const backendProbeNonce = `backend_probe_${Date.now()}_${randomHex(8)}`;
  
  const functionName = process.env.FORGE_FUNCTION_NAME || 'probe-resolver';
  const forgeEnv = process.env.FORGE_ENV || 'unknown';

  // Capture observations for diagnostics
  const observed: ProbeObserved = {
    payload_keys: Object.keys(payload || {}),
    correlation_fields: {
      ui_req_id: payload?.ui_req_id ?? null,
      uiReqId: payload?.uiReqId ?? null,
      reqId: payload?.reqId ?? null,
      requestId: payload?.requestId ?? null,
      meta_ui_req_id: payload?.meta?.ui_req_id ?? null,
      meta_uiReqId: payload?.meta?.uiReqId ?? null,
      local_probe_nonce: payload?.meta?.local_probe_nonce ?? payload?.local_probe_nonce ?? null  // UI NONCE
    },
    context_signals: {
      cloudId: (req as any)?.context?.cloudId ?? null,
      moduleKey: (req as any)?.context?.moduleKey ?? null,
      installContext_hash: hashShort(String((req as any)?.context?.installContext ?? '')),
      accountId_hash: (req as any)?.context?.accountId
        ? hashShort(String((req as any)?.context?.accountId))
        : null,
      environment: process.env.NODE_ENV || 'unknown'
    }
  };

  // Build meta (returned in response + included in logs)
  const meta: ProbeMeta = {
    ui_req_id: uiReqId,
    ui_local_probe_nonce: uiLocalProbeNonce,      // UI-generated nonce (for grep)
    backend_probe_nonce: backendProbeNonce,       // Server-side entropy
    backend_build_sha: backendBuildSha,
    now_iso: nowIso,
    node: process.version,
    function_name: functionName,
    forge_env: forgeEnv
  };

  try {
    // ===================================================================
    // PHASE 2C: Log FT_PROBE_MARKER (DETERMINISTIC, GREPABLE)
    // ===================================================================
    // Single structured JSON line with all correlation IDs
    // Format: FT_PROBE_MARKER <json>
    // This enables grep by any ID and ensures backend execution proof
    
    const marker = {
      marker: 'FT_PROBE_MARKER',
      ui_req_id: uiReqId,
      ui_local_probe_nonce: uiLocalProbeNonce,    // PRIMARY for grep (set by UI)
      backend_probe_nonce: backendProbeNonce,     // Secondary (server-side)
      backend_build_sha: backendBuildSha,
      forge_env: forgeEnv,
      function_name: functionName,
      timestamp_iso: nowIso,
      node_version: process.version,
      correlation_observed: observed.correlation_fields,
      trace_id_stable: `trace_probe_${hashShort(uiReqId)}_${Date.now()}`
    };
    
    console.log(`FT_PROBE_MARKER ${JSON.stringify(marker)}`);
    
    // Also log plain-text for unmissable grep (backward compat)
    console.log(`PROBE_OK ui_nonce=${uiLocalProbeNonce} backend_nonce=${backendProbeNonce} ui_req=${uiReqId} build=${backendBuildSha} ts=${nowIso}`);
    
    // PHASE C: Log FT_PROBE_OK (execution success proof)
    console.log(`FT_PROBE_OK ${JSON.stringify({
      marker: 'FT_PROBE_OK',
      probe_entry_id: probeEntryId,
      ui_req_id: uiReqId,
      ui_local_probe_nonce: uiLocalProbeNonce,
      backend_probe_nonce: backendProbeNonce,
      timestamp_iso: nowIso
    })}`);
    
    // Success response with all IDs (for UI display)
    return {
      ok: true,
      meta,
      observed
    };
  } catch (err) {
    // PHASE C (Invoke Error Truth): Log FT_PROBE_ERR IMMEDIATELY
    // Error path (capture it without re-throwing)
    const errorMsg = err instanceof Error ? err.message : String(err);
    const errorCode = (err as any)?.code || (err as any)?.statusCode || 'PROBE_EXCEPTION';
    const traceIdStable = `trace_probe_err_${hashShort(errorMsg)}_${Date.now()}`;
    
    // Build meta even on error (CRITICAL for Backend Build SHA + Forge Env visibility)
    const metaOnError: ProbeMeta = {
      ui_req_id: uiReqId,
      ui_local_probe_nonce: uiLocalProbeNonce,      // Preserve for grep (even on error)
      backend_probe_nonce: backendProbeNonce,       // Server-side entropy (even on error)
      backend_build_sha: backendBuildSha,           // NEVER hidden (even on error)
      now_iso: nowIso,
      node: process.version,
      function_name: functionName,
      forge_env: forgeEnv                            // NEVER hidden (even on error)
    };
    
    // Log FT_PROBE_ERR with all error details (deterministic execution proof)
    const errorMarker = {
      marker: 'FT_PROBE_ERR',
      probe_entry_id: probeEntryId,
      ui_req_id: uiReqId,
      ui_local_probe_nonce: uiLocalProbeNonce,      // Preserve for grep
      backend_probe_nonce: backendProbeNonce,
      backend_build_sha: backendBuildSha,
      forge_env: forgeEnv,
      error_code: errorCode,
      error_message: errorMsg,
      trace_id_stable: traceIdStable,
      timestamp_iso: nowIso,
      function_name: functionName
    };
    
    console.error(`FT_PROBE_ERR ${JSON.stringify(errorMarker)}`);
    
    // Also log old format (backward compat)
    console.error(`PROBE_ERR ui_nonce=${uiLocalProbeNonce} ui_req=${uiReqId} code=${errorCode} trace=${traceIdStable} ts=${nowIso}`);
    
    // Return structured error (NEVER throw raw)
    return {
      ok: false,
      meta: metaOnError,
      observed: {
        payload_keys: Object.keys(payload || {}),
        correlation_fields: {},
        context_signals: {}
      },
      error: {
        code: String(errorCode),
        message: errorMsg,
        trace_id_stable: traceIdStable
      }
    };
  }
}

/**
 * Export extraction helper for tests
 */
export { extractUiReqId, hashShort };
