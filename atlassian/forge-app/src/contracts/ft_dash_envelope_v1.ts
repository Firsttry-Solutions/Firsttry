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
