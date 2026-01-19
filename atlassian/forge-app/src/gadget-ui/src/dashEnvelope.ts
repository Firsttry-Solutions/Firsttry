/**
 * Dashboard Envelope Mapping & Validation Module
 * 
 * CRITICAL: This is the SINGLE SOURCE OF TRUTH for:
 * - Backend response envelope validation (schemaVersion v1)
 * - Dashboard state extraction and mapping
 * - Pre-commit state assertions (fail-closed)
 * 
 * Both UI and tests MUST use these functions, not duplicates.
 * 
 * Violations:
 * - If UI defines its own mapDashEnvelopeV1 → state corruption
 * - If tests duplicate these functions → fake test coverage
 * - If UI uses raw resp without mapping → undefined state possible
 */

/**
 * Maps backend v1 envelope to dashboard state.
 * Enforces strict schema and fail-closed behavior.
 * 
 * ONLY function allowed to map backend response → state.
 */
export function mapDashEnvelopeV1(resp: any): Record<string, any> {
  // FAIL-CLOSED: Invalid envelope structure (null, undefined, non-object, or array)
  if (resp === null || resp === undefined || typeof resp !== 'object' || Array.isArray(resp)) {
    console.error('[DASH_ENVELOPE_INVALID_FAIL_CLOSED]', { 
      received: typeof resp, 
      isArray: Array.isArray(resp), 
      value: resp 
    });
    throw new Error('DASH_ENVELOPE_INVALID_FAIL_CLOSED: resp must be object');
  }

  // FAIL-CLOSED: Wrong schema version
  if (resp.schemaVersion !== 'v1') {
    console.error('[DASH_SCHEMA_VERSION_UNSUPPORTED_FAIL_CLOSED]', { 
      schemaVersion: resp.schemaVersion 
    });
    throw new Error(`DASH_SCHEMA_VERSION_UNSUPPORTED_FAIL_CLOSED: expected v1, got ${resp.schemaVersion}`);
  }

  // FAIL-CLOSED: Backend reported error
  if (resp.ok !== true) {
    console.warn('[DASH_ENVELOPE_BACKEND_ERROR]', { 
      ok: resp.ok, 
      error: resp.error 
    });
    return {
      status: 'ERROR',
      reason: 'DASH_REQUEST_FAILED',
      error: resp.error ?? { code: 'UNKNOWN', message: 'Unknown error' },
      canonical_envelope_applied: true,
    };
  }

  // FAIL-CLOSED: Missing or invalid data
  if (!resp.data || typeof resp.data !== 'object' || Array.isArray(resp.data)) {
    console.error('[DASH_ENVELOPE_MISSING_DATA_FAIL_CLOSED]', { 
      hasData: !!resp.data, 
      dataType: typeof resp.data,
      isArray: Array.isArray(resp.data)
    });
    throw new Error('DASH_ENVELOPE_MISSING_DATA_FAIL_CLOSED: data must be object');
  }

  // SUCCESS: Return data with envelope marker
  const mapped = {
    ...resp.data,
    canonical_envelope_applied: true,
    envelope_schema_version: 'v1',
  };

  return mapped;
}

/**
 * Asserts that dashboard state is valid before store commit.
 * Logs diagnostic info if state is invalid.
 * 
 * CRITICAL: This is the ONLY function allowed to validate state before commit.
 * If state is invalid, throws immediately (fail-closed).
 */
export function assertNonNullDashboardState(
  state: any,
  ctx: any
): asserts state is Record<string, any> {
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    console.error('[BACKBONE_STATE_SET_FAIL]', {
      ctx,
      typeofState: typeof state,
      stateIsNull: state === null,
      stateKeys: state && typeof state === 'object' ? Object.keys(state) : null,
      stack: new Error().stack,
    });
    throw new Error('DASHBOARD_STATE_UNDEFINED_FAIL_CLOSED: state must be non-null object');
  }

  console.log('[BACKBONE_STATE_SET_OK]', {
    ctx,
    stateType: typeof state,
    keys: Object.keys(state).slice(0, 60),
    hasCanonicalMarker: !!state.canonical_envelope_applied,
  });
}

/**
 * Logs raw envelope shape before processing.
 * Proves envelope structure is canonical before mapping.
 */
export function logRawDashboardEnvelope(resp: any): void {
  try {
    console.log('[UI_DASH_RAW_ENVELOPE]', {
      topKeys: resp && typeof resp === 'object' && !Array.isArray(resp) ? Object.keys(resp) : [],
      ok: resp?.ok ?? null,
      schemaVersion: resp?.schemaVersion ?? null,
      hasData: !!resp?.data,
      dataKeys: resp?.data && typeof resp.data === 'object' && !Array.isArray(resp.data) ? Object.keys(resp.data).slice(0, 60) : null,
      mode: resp?.data?.mode ?? resp?.mode ?? null,
      error: resp?.error ? { code: resp.error.code, message: resp.error.message } : null,
    });
  } catch (e) {
    console.error('[UI_DASH_RAW_ENVELOPE_ERROR]', e);
  }
}
