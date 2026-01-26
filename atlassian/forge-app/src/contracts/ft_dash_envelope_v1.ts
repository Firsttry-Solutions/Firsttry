/**
 * FT_DASH_ENVELOPE_V1 - Canonical L0 Dashboard Contract
 * 
 * CRITICAL CONTRACT: All dashboard resolvers MUST return responses wrapped
 * with this envelope marker. The UI validates for "FT_DASH_ENVELOPE_V1" presence
 * and FAIL-CLOSES if marker is missing.
 * 
 * This ensures:
 * - UI cannot accidentally display unwrapped/partial backend responses
 * - Version mismatch is caught early
 * - Error paths are always structured consistently
 */

export const FT_DASH_ENVELOPE_MARKER_V1 = "FT_DASH_ENVELOPE_V1" as const;

export type FtDashStatus =
  | "AVAILABLE"
  | "NOT_AVAILABLE"
  | "HARD_ERROR";

export type FtDashErrorV1 = {
  code: string;
  message: string;
  details?: unknown;
};

export interface FtDashEnvelopeV1<T = unknown> {
  envelopeKind: typeof FT_DASH_ENVELOPE_MARKER_V1;
  schemaVersion: 'v1';
  ok: boolean;
  status: FtDashStatus;
  data?: T;
  error?: FtDashErrorV1;
}

/**
 * Success envelope - wraps valid dashboard state
 */
export function okEnvelope<T>(data: T): FtDashEnvelopeV1<T> {
  return {
    envelopeKind: FT_DASH_ENVELOPE_MARKER_V1,
    schemaVersion: 'v1',
    ok: true,
    status: "AVAILABLE",
    data,
  };
}

/**
 * Not available - snapshot missing, but no error
 */
export function notAvailableEnvelope(
  code: string,
  message: string,
  details?: unknown
): FtDashEnvelopeV1<null> {
  return {
    envelopeKind: FT_DASH_ENVELOPE_MARKER_V1,
    schemaVersion: 'v1',
    ok: false,
    status: "NOT_AVAILABLE",
    data: null,
    error: { code, message, details },
  };
}

/**
 * Hard error - resolver or backend failed
 */
export function hardErrorEnvelope(
  code: string,
  message: string,
  details?: unknown
): FtDashEnvelopeV1<null> {
  return {
    envelopeKind: FT_DASH_ENVELOPE_MARKER_V1,
    schemaVersion: 'v1',
    ok: false,
    status: "HARD_ERROR",
    data: null,
    error: { code, message, details },
  };
}

/**
 * Normalizer - ensures all responses are wrapped (fail-closed)
 * 
 * If a backend function accidentally returns an unwrapped {status,error,schemaVersion},
 * this normalizer wraps it into the proper envelope format.
 */
export function normalizeFtDashEnvelopeV1(raw: any): FtDashEnvelopeV1 {
  try {
    // Already wrapped correctly
    if (
      raw &&
      typeof raw === "object" &&
      raw.envelopeKind === FT_DASH_ENVELOPE_MARKER_V1 &&
      (raw.schemaVersion === 'v1' || raw.schemaVersion === 1) &&
      typeof raw.ok === 'boolean'
    ) {
      // Normalize schemaVersion to string if needed
      if (raw.schemaVersion === 1) {
        return { ...raw, schemaVersion: 'v1' };
      }
      return raw;
    }

    // Partially wrapped (has status/error but missing envelopeKind or ok) - wrap it
    if (raw && typeof raw === "object" && ("status" in raw)) {
      const status = String(raw.status || "NOT_AVAILABLE") as FtDashStatus;
      const error = (raw as any).error;
      const code = error?.code ? String(error.code) : "UNWRAPPED_RESPONSE";
      const msg = error?.message
        ? String(error.message)
        : "Backend returned response without FT_DASH_ENVELOPE_V1 envelopeKind";

      if (status === "AVAILABLE") {
        return okEnvelope((raw as any).data ?? raw);
      }
      if (status === "HARD_ERROR") {
        return hardErrorEnvelope(code, msg, raw);
      }
      return notAvailableEnvelope(code, msg, raw);
    }

    // Completely unknown response shape - wrap as hard error (fail-closed)
    return hardErrorEnvelope(
      "INVALID_BACKEND_RESPONSE_SHAPE",
      "Backend returned unexpected payload shape (missing envelopeKind and status)",
      raw
    );
  } catch (e: any) {
    // Even normalization failed - fail-closed
    return hardErrorEnvelope(
      "ENVELOPE_NORMALIZATION_FAILED",
      "Failed to normalize backend response into FT_DASH_ENVELOPE_V1",
      { raw, error: String(e) }
    );
  }
}

/**
 * RUNTIME INVARIANT ENFORCER - ft_getDashboardState_v1 Boundary Guard
 * 
 * CRITICAL: This function GUARANTEES that ANY envelope returned from
 * ft_getDashboardState_v1 resolver ALWAYS has:
 * - envelopeKind: 'FT_DASH_ENVELOPE_V1'
 * - schemaVersion: 'v1'
 * - ok: boolean (never undefined)
 * - status: one of 'AVAILABLE' | 'NOT_AVAILABLE' | 'HARD_ERROR' (NEVER undefined)
 * - data/error mutual exclusivity: ok=true => data only, ok=false => error only
 * 
 * If the candidate envelope violates any requirement, it is replaced with
 * a HARD_ERROR envelope that satisfies all requirements.
 * 
 * This makes it IMPOSSIBLE for status to ever be undefined in production.
 */
export function enforceDashEnvelopeV1Invariant(candidate: unknown): FtDashEnvelopeV1 {
  try {
    // NULL/UNDEFINED CHECK
    if (!candidate || typeof candidate !== 'object') {
      return hardErrorEnvelope(
        "CANDIDATE_INVALID_TYPE",
        `Envelope candidate is not an object (got ${typeof candidate})`
      );
    }

    const c = candidate as any;

    // STATUS PRESENCE & TYPE CHECK (CRITICAL)
    if (c.status === null || c.status === undefined) {
      return hardErrorEnvelope(
        "STATUS_MISSING",
        "Envelope candidate has no status field (status is null or undefined)"
      );
    }

    // STATUS VALUE CHECK (must be one of 3 allowed values)
    const allowedStatuses = ["AVAILABLE", "NOT_AVAILABLE", "HARD_ERROR"];
    if (typeof c.status !== 'string' || !allowedStatuses.includes(c.status)) {
      return hardErrorEnvelope(
        "STATUS_INVALID_VALUE",
        `Status must be one of ${allowedStatuses.join("|")}, got "${c.status}"`
      );
    }

    // OK FIELD CHECK (must be boolean)
    if (typeof c.ok !== 'boolean') {
      return hardErrorEnvelope(
        "OK_INVALID_TYPE",
        `ok field must be boolean, got ${typeof c.ok}`
      );
    }

    // ENVELOPE KIND CHECK
    if (c.envelopeKind !== FT_DASH_ENVELOPE_MARKER_V1) {
      return hardErrorEnvelope(
        "ENVELOPE_KIND_MISMATCH",
        `envelopeKind must be "${FT_DASH_ENVELOPE_MARKER_V1}", got "${c.envelopeKind}"`
      );
    }

    // SCHEMA VERSION CHECK (normalize 1 to 'v1' if needed)
    if (c.schemaVersion !== 'v1' && c.schemaVersion !== 1) {
      return hardErrorEnvelope(
        "SCHEMA_VERSION_INVALID",
        `schemaVersion must be 'v1' or 1, got "${c.schemaVersion}"`
      );
    }

    // MUTUAL EXCLUSIVITY: ok=true => has data only, NO error
    if (c.ok === true) {
      if ('error' in c && c.error != null) {
        return hardErrorEnvelope(
          "DATA_ERROR_BOTH_PRESENT",
          "Envelope has ok=true but error field is also present (should be omitted for success)"
        );
      }
      if (!('data' in c) || c.data === undefined) {
        return hardErrorEnvelope(
          "SUCCESS_NO_DATA",
          "Envelope has ok=true but data field is missing or undefined"
        );
      }
    }

    // MUTUAL EXCLUSIVITY: ok=false => has error only, NO data
    if (c.ok === false) {
      if ('data' in c && c.data != null) {
        return hardErrorEnvelope(
          "ERROR_WITH_DATA",
          "Envelope has ok=false but data field is also present (should be omitted for error)"
        );
      }
      if (!('error' in c) || !c.error || typeof c.error !== 'object') {
        return hardErrorEnvelope(
          "ERROR_NO_ERROR_DETAIL",
          "Envelope has ok=false but error field is missing or invalid"
        );
      }
      if (typeof c.error.code !== 'string' || typeof c.error.message !== 'string') {
        return hardErrorEnvelope(
          "ERROR_STRUCTURE_INVALID",
          "error.code and error.message must both be strings"
        );
      }
    }

    // SCHEMA VERSION NORMALIZATION
    if (c.schemaVersion === 1) {
      return {
        ...c,
        schemaVersion: 'v1' as const,
      } as FtDashEnvelopeV1;
    }

    // If we get here, the candidate is valid and passes all checks
    return c as FtDashEnvelopeV1;
  } catch (e: any) {
    // Even the invariant check threw - fail-closed
    return hardErrorEnvelope(
      "INVARIANT_CHECK_EXCEPTION",
      `Invariant enforcement threw exception: ${String(e).slice(0, 100)}`
    );
  }
}
