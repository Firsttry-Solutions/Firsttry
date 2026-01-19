/**
 * Backward-compatible ping response parser.
 * 
 * Handles both:
 * 1. New TruthEnvelope format: { ok: boolean, kind: string, build: {...} }
 * 2. Legacy format: { schemaVersion: "1", backendBuild: string, ... }
 * 3. Invalid: anything else
 * 
 * CRITICAL FIX for production bug:
 * - UI must NEVER mark ping as failed if JSON was successfully received and parsed
 * - Only fail if invoke() threw (no response at all) OR if ok === false in parsed response
 * - If ok === undefined but JSON exists, treat as backend responded
 */

export interface ParsedPingResponse {
  mode: 'TRUTH_ENVELOPE' | 'LEGACY' | 'INVALID';
  ok: boolean;
  data: any;
  error?: {
    message: string;
    code: string;
    trace_id_stable?: string;
  };
}

/**
 * Parses ping response from backend into standardized format.
 * 
 * Returns:
 * - mode: detection of response format (TruthEnvelope, Legacy, or Invalid)
 * - ok: whether the ping succeeded (true for valid responses with ok field)
 * - data: the full response object
 * - error: structured error if present
 * 
 * Key invariant:
 * - ok=false only if response.ok field explicitly exists and is false
 * - ok=true if response is valid JSON (even if ok field missing)
 * - Only ok=false triggers PING_FAILED label
 */
export function parsePingResponse(raw: unknown): ParsedPingResponse {
  // If raw is not an object, it's definitely invalid (network error, etc)
  if (typeof raw !== 'object' || raw === null) {
    return {
      mode: 'INVALID',
      ok: false,
      data: null,
      error: {
        message: 'Ping invoke did not return JSON object',
        code: 'INVALID_PING_RESPONSE',
        trace_id_stable: 'no-trace'
      }
    };
  }

  const obj = raw as Record<string, any>;

  // Detect TruthEnvelope format
  // Signature: has 'kind' field and (has 'ok' or has 'build' with structure)
  if (typeof obj.kind === 'string' && (typeof obj.ok === 'boolean' || obj.build)) {
    return {
      mode: 'TRUTH_ENVELOPE',
      ok: obj.ok === true,
      data: obj,
      error: obj.ok !== true ? {
        message: obj.error?.message || 'Backend rejected ping',
        code: obj.error?.code || 'TRUTH_ENVELOPE_REJECTED',
        trace_id_stable: obj.error?.trace_id_stable || obj.trace_id_stable || 'no-trace'
      } : undefined
    };
  }

  // Detect Legacy format
  // Signature: has schemaVersion="1" or has backendBuild string
  if (obj.schemaVersion === '1' || (typeof obj.backendBuild === 'string')) {
    // Legacy format - treat as success because JSON was parsed
    // The ok field may be missing, but that's OK - JSON arrived means backend responded
    const isOk = obj.ok !== false; // default true if field missing
    return {
      mode: 'LEGACY',
      ok: isOk,
      data: obj,
      error: isOk ? undefined : {
        message: obj.error?.message || 'Backend ping rejected (legacy format)',
        code: obj.error?.code || 'LEGACY_REJECTED',
        trace_id_stable: obj.error?.trace_id_stable || 'no-trace'
      }
    };
  }

  // If it looks like it might be a response object but doesn't match known formats
  // still treat as received (JSON was parsed), but invalid structure
  if (Object.keys(obj).length > 0) {
    return {
      mode: 'INVALID',
      ok: false,
      data: obj,
      error: {
        message: 'Ping response has unexpected structure',
        code: 'INVALID_PING_STRUCTURE',
        trace_id_stable: obj.trace_id_stable || obj.traceIdStable || 'no-trace'
      }
    };
  }

  // Completely empty object - treat as invalid
  return {
    mode: 'INVALID',
    ok: false,
    data: obj,
    error: {
      message: 'Ping response is empty',
      code: 'EMPTY_PING_RESPONSE',
      trace_id_stable: 'no-trace'
    }
  };
}

/**
 * Determines if a ping invoke failure should show "Backend not responding"
 * vs a structured error message.
 * 
 * "Backend not responding" only if:
 * - invoke() threw an exception (no response at all)
 * 
 * Otherwise (JSON was received), use the structured error from parsePingResponse().
 */
export function shouldShowBackendNotResponding(
  invokeThrew: boolean,
  parsedResponse: ParsedPingResponse | null
): boolean {
  // If invoke threw, definitely no response
  if (invokeThrew) return true;
  
  // If we parsed a response, backend was responding
  if (parsedResponse) return false;
  
  // Edge case: invoke didn't throw, but we have no parsed response (shouldn't happen)
  return false;
}
