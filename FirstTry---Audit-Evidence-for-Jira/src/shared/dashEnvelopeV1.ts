/**
 * BACKBONE #2: Dashboard Envelope V1 Builder
 *
 * CRITICAL: This is the ONLY place where dashboard/probe response envelopes
 * are created. All dashboard gadget resolvers MUST use these functions.
 *
 * Guarantees:
 * - schemaVersion is ALWAYS exactly "v1" (never "1", never other values)
 * - meta includes backend_build_sha, ui_build_sha, ui_req_id, probe_nonce, ts_utc
 * - All success + error responses have the same schemaVersion
 * - Never undefined fields (normalize to null or "UNSET")
 *
 * Usage:
 * - For dashboard success: dashOk({ data, meta })
 * - For dashboard error: dashErr({ error, meta })
 * - For probe success: dashOk({ data: probeData, meta })
 * - For probe error: dashErr({ error: probeError, meta })
 *
 * The UI validates schemaVersion === "v1" and fails closed if not.
 * This ensures deterministic error detection with no silent failures.
 */

import { BACKEND_BUILD_SHA } from '../build/backend_build';

/**
 * Dashboard envelope meta information
 * MUST include backend_build_sha, ui_req_id, timestamp
 */
export interface DashMetaV1 {
  /** Backend build SHA (40 hex chars or "UNSET") */
  backend_build_sha: string;
  
  /** UI build SHA if provided (40 hex chars, or null if not available) */
  ui_build_sha: string | null;
  
  /** UI request ID for correlation (string, or "UNSET" if not provided) */
  ui_req_id: string;
  
  /** Probe nonce if provided (string, or null if not a probe call) */
  probe_nonce: string | null;
  
  /** ISO timestamp (UTC) when response was generated */
  ts_utc: string;
}

/**
 * Dashboard envelope success response
 * Guarantees: ok=true, schemaVersion="v1", data is object, envelope marker present
 */
export interface DashEnvelopeOkV1<T = any> {
  // BACKBONE: Wrapper-only marker (not in data, never masqueraded)
  envelopeKind: 'FT_DASH_ENVELOPE_V1';
  envelopeVersion: 1;
  
  ok: true;
  schemaVersion: 'v1';
  meta: DashMetaV1;
  data: T;
  trace?: Record<string, any>;
  error?: undefined;
  errors?: undefined;
}

/**
 * Dashboard envelope error response
 * Guarantees: ok=false, schemaVersion="v1", error has code+message, envelope marker present
 */
export interface DashEnvelopeErrV1 {
  // BACKBONE: Wrapper-only marker (not in data, never masqueraded)
  envelopeKind: 'FT_DASH_ENVELOPE_V1';
  envelopeVersion: 1;
  
  ok: false;
  schemaVersion: 'v1';
  meta: DashMetaV1;
  data?: undefined;
  error: {
    code: string;
    message: string;
    traceId?: string;
  };
  errors?: Array<{ code: string; message: string; traceId?: string }>;
}

export type DashEnvelopeV1<T = any> = DashEnvelopeOkV1<T> | DashEnvelopeErrV1;

/**
 * Create success dashboard envelope
 * Ensures schemaVersion="v1", all required meta fields set
 */
export function dashOk<T = any>(args: {
  data: T;
  meta: {
    backend_build_sha?: string;
    ui_build_sha?: string | null;
    ui_req_id?: string;
    probe_nonce?: string | null;
    ts_utc?: string;
  };
  trace?: Record<string, any>;
}): DashEnvelopeOkV1<T> {
  const {
    data,
    meta: {
      backend_build_sha = BACKEND_BUILD_SHA || 'UNSET',
      ui_build_sha = null,
      ui_req_id = 'UNSET',
      probe_nonce = null,
      ts_utc = new Date().toISOString(),
    } = {},
    trace,
  } = args;

  // Normalize meta fields (never null for required fields)
  const normalizedMeta: DashMetaV1 = {
    backend_build_sha: typeof backend_build_sha === 'string' && backend_build_sha.length > 0 ? backend_build_sha : 'UNSET',
    ui_build_sha: typeof ui_build_sha === 'string' && ui_build_sha.length > 0 ? ui_build_sha : null,
    ui_req_id: typeof ui_req_id === 'string' && ui_req_id.length > 0 ? ui_req_id : 'UNSET',
    probe_nonce: typeof probe_nonce === 'string' && probe_nonce.length > 0 ? probe_nonce : null,
    ts_utc: typeof ts_utc === 'string' && ts_utc.length > 0 ? ts_utc : new Date().toISOString(),
  };

  return {
    // BACKBONE: Wrapper-only marker (unforgeable by data)
    envelopeKind: 'FT_DASH_ENVELOPE_V1',
    envelopeVersion: 1,
    
    ok: true,
    schemaVersion: 'v1', // FIXED: Always 'v1', never '1'
    meta: normalizedMeta,
    data,
    ...(trace ? { trace } : {}),
  };
}

/**
 * Create error dashboard envelope
 * Ensures schemaVersion="v1", error has code+message, meta fields set
 */
export function dashErr(args: {
  error: {
    code: string;
    message: string;
    traceId?: string;
  };
  meta: {
    backend_build_sha?: string;
    ui_build_sha?: string | null;
    ui_req_id?: string;
    probe_nonce?: string | null;
    ts_utc?: string;
  };
  errors?: Array<{ code: string; message: string; traceId?: string }>;
}): DashEnvelopeErrV1 {
  const {
    error,
    meta: {
      backend_build_sha = BACKEND_BUILD_SHA || 'UNSET',
      ui_build_sha = null,
      ui_req_id = 'UNSET',
      probe_nonce = null,
      ts_utc = new Date().toISOString(),
    } = {},
    errors,
  } = args;

  // Normalize meta fields (never null for required fields)
  const normalizedMeta: DashMetaV1 = {
    backend_build_sha: typeof backend_build_sha === 'string' && backend_build_sha.length > 0 ? backend_build_sha : 'UNSET',
    ui_build_sha: typeof ui_build_sha === 'string' && ui_build_sha.length > 0 ? ui_build_sha : null,
    ui_req_id: typeof ui_req_id === 'string' && ui_req_id.length > 0 ? ui_req_id : 'UNSET',
    probe_nonce: typeof probe_nonce === 'string' && probe_nonce.length > 0 ? probe_nonce : null,
    ts_utc: typeof ts_utc === 'string' && ts_utc.length > 0 ? ts_utc : new Date().toISOString(),
  };

  // Normalize error (ensure code + message are strings)
  const normalizedError = {
    code: (typeof error?.code === 'string' && error.code.length > 0) ? error.code : 'UNKNOWN',
    message: (typeof error?.message === 'string' && error.message.length > 0) ? error.message : 'Unknown error',
    ...(typeof error?.traceId === 'string' && error.traceId.length > 0 ? { traceId: error.traceId } : {}),
  };

  return {
    // BACKBONE: Wrapper-only marker (unforgeable by data)
    envelopeKind: 'FT_DASH_ENVELOPE_V1',
    envelopeVersion: 1,
    
    ok: false,
    schemaVersion: 'v1', // FIXED: Always 'v1', never '1'
    meta: normalizedMeta,
    error: normalizedError,
    ...(Array.isArray(errors) && errors.length > 0 ? { errors } : {}),
  };
}

/**
 * BACKBONE: Strict validation helper
 * Returns true ONLY if x is a valid wrapped envelope (not unwrapped data)
 * 
 * This is the ONLY way to detect wrapped vs unwrapped responses.
 * NO other heuristics allowed (e.g., checking for specific data fields).
 */
export function isDashEnvelopeV1(x: any): boolean {
  // Must be object
  if (!x || typeof x !== 'object') return false;
  
  // Must have wrapper marker
  if (x.envelopeKind !== 'FT_DASH_ENVELOPE_V1') return false;
  
  // Must have strict schema version
  if (x.schemaVersion !== 'v1') return false;
  
  // Must have ok as boolean
  if (typeof x.ok !== 'boolean') return false;
  
  // If ok=true, must have data
  if (x.ok === true && !('data' in x)) return false;
  
  // If ok=false, must have error
  if (x.ok === false && !('error' in x)) return false;
  
  return true;
}

