/**
 * FORENSIC_PROBE: Deterministic Correlation Proof
 * 
 * This resolver proves UI → backend correlation works end-to-end:
 * 1. UI sends ui_req_id in multiple formats (intentionally)
 * 2. Backend extracts and normalizes (proves extraction logic)
 * 3. Backend logs probe marker with nonce (proves backend execution)
 * 4. UI displays nonce + ui_req_id (user can grep logs)
 * 5. tools/probe_prod.sh greps logs by nonce (definitive proof)
 * 
 * Contract:
 * - Always returns ok:true/false with meta + observed fields
 * - Never throws
 * - Logs exactly one JSON line per invocation
 * - trace_id_stable never empty/UNSET
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
  probe_nonce: string;
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
 */
export async function probe(req?: any): Promise<ProbeResponse> {
  const payload = req?.payload || req || {};
  const nowIso = new Date().toISOString();
  const probeNonce = `probe_${Date.now()}_${randomHex(8)}`;
  const backendBuildSha = BACKEND_BUILD_SHA; // Injected at build time, never "unknown"
  const functionName = process.env.FORGE_FUNCTION_NAME || 'probe-resolver';
  const forgeEnv = process.env.FORGE_ENV || 'unknown';

  // Extract ui_req_id (same extraction used by handler)
  const uiReqId = extractUiReqId(payload);

  // Capture observations for diagnostics
  const observed: ProbeObserved = {
    payload_keys: Object.keys(payload || {}),
    correlation_fields: {
      ui_req_id: payload?.ui_req_id ?? null,
      uiReqId: payload?.uiReqId ?? null,
      reqId: payload?.reqId ?? null,
      requestId: payload?.requestId ?? null,
      meta_ui_req_id: payload?.meta?.ui_req_id ?? null,
      meta_uiReqId: payload?.meta?.uiReqId ?? null
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

  // Build meta (must be rendered in UI for proof grepping)
  const meta: ProbeMeta = {
    ui_req_id: uiReqId,
    probe_nonce: probeNonce,
    backend_build_sha: backendBuildSha,
    now_iso: nowIso,
    node: process.version,
    function_name: functionName,
    forge_env: forgeEnv
  };

  try {
    // ENTRY: Backend received invocation
    // Plain text (unmissable, grepable)
    console.log(`PROBE_ENTRY nonce=${probeNonce} ui=${uiReqId} build=${backendBuildSha} ts=${nowIso}`);
    
    // SUCCESS: Backend executed successfully
    // Plain text (unmissable, primary proof)
    console.log(`PROBE_OK nonce=${probeNonce} ui=${uiReqId} build=${backendBuildSha} ts=${nowIso}`);
    
    // JSON marker (structured log, secondary proof)
    console.log(
      JSON.stringify({
        marker: 'PROBE',
        ui_req_id: uiReqId,
        probe_nonce: probeNonce,
        backend_build_sha: backendBuildSha,
        forge_env: forgeEnv,
        function_name: functionName,
        observed: observed
      })
    );

    // Success response
    return {
      ok: true,
      meta,
      observed
    };
  } catch (err) {
    // Error path (should rarely happen, but capture it)
    const errorMsg = err instanceof Error ? err.message : String(err);
    const traceIdStable = `trace_probe_${hashShort(errorMsg)}_${Date.now()}`;

    // ERROR: Plain text (unmissable, primary proof of error)
    console.log(`PROBE_ERR nonce=${probeNonce} ui=${uiReqId} code=PROBE_EXCEPTION trace=${traceIdStable} ts=${nowIso}`);
    
    // JSON marker (structured log, secondary proof)
    console.error(
      JSON.stringify({
        marker: 'PROBE_ERR',
        ui_req_id: uiReqId,
        probe_nonce: probeNonce,
        backend_build_sha: backendBuildSha,
        error_code: 'PROBE_EXCEPTION',
        message: errorMsg,
        trace_id_stable: traceIdStable
      })
    );

    return {
      ok: false,
      meta,
      observed,
      error: {
        code: 'PROBE_EXCEPTION',
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
