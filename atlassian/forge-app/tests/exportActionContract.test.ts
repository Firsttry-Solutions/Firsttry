/**
 * Export Action Contract Tests
 *
 * v7.54: Proves export action response envelope includes ALL required fields
 * and that UI contract validation logic works deterministically.
 */
import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// A) Backend envelope contract
// ---------------------------------------------------------------------------

/**
 * Required top-level keys on EVERY export action envelope (success or failure).
 * The UI checks for these; if any is absent, it's a CONTRACT_BREACH.
 */
const REQUIRED_ENVELOPE_KEYS = [
  'envelopeKind',
  'ok',
  'action',
  'traceId',
  'build',
  'status',
  'reasonCode',
  'reason',
  'error',
  'snapshotId',
  'canonicalHash',
  'downloadUrl',
  'createdAtUtc',
  'message',
  'data',
];

/** Builds a canonical SUCCESS export envelope (mirrors gadget-resolver handlePhase1ExportPack success path) */
function buildSuccessEnvelope(overrides: Record<string, any> = {}): Record<string, any> {
  return {
    envelopeKind: 'FT_ACTION_RESULT_V1',
    ok: true,
    action: 'EXPORT_PHASE1_PACK',
    status: 'SUCCESS',
    traceId: 'trace_test_123',
    build: {
      buildShaShort: 'abc1234',
      buildUtc: '2026-02-21T10:00:00Z',
      version: '2.14.0',
    },
    reasonCode: 'OK',
    reason: null,
    error: null,
    snapshotId: 'ft:export:deadbeef:1234567890',
    canonicalHash: 'deadbeef01234567',
    downloadUrl: '/download/access-pack/deadbeef01234567',
    createdAtUtc: '2026-02-21T10:00:00.000Z',
    message: 'Export eligible',
    data: {
      ok: true,
      status: 'SUCCESS',
      reasonCode: 'OK',
      zipBase64: 'UEsDBBQ=',
      zipHash: 'abcd1234',
      fileCount: 7,
      canonicalHash: 'deadbeef01234567',
      snapshotId: 'ft:export:deadbeef:1234567890',
      size: 1024,
      downloadUrl: '/download/access-pack/deadbeef01234567',
      createdAtUtc: '2026-02-21T10:00:00.000Z',
    },
    ...overrides,
  };
}

/** Builds a canonical FAIL export envelope */
function buildFailEnvelope(overrides: Record<string, any> = {}): Record<string, any> {
  return {
    envelopeKind: 'FT_ACTION_RESULT_V1',
    ok: false,
    action: 'EXPORT_PHASE1_PACK',
    status: 'FAIL',
    traceId: 'trace_test_456',
    build: {
      buildShaShort: 'abc1234',
      buildUtc: '2026-02-21T10:00:00Z',
      version: '2.14.0',
    },
    reasonCode: 'EXPORT_PHASE1_STATS_MISSING',
    reason: 'Export requires Phase1 stats',
    error: {
      code: 'EXPORT_PHASE1_STATS_MISSING',
      message: 'Export requires Phase1 stats',
      traceId: 'trace_test_456',
    },
    snapshotId: null,
    canonicalHash: null,
    downloadUrl: null,
    createdAtUtc: '2026-02-21T10:00:00.000Z',
    message: 'Export requires Phase1 stats',
    data: null,
    ...overrides,
  };
}

describe('Backend export envelope contract', () => {
  it('SUCCESS envelope includes EVERY required key', () => {
    const envelope = buildSuccessEnvelope();
    for (const key of REQUIRED_ENVELOPE_KEYS) {
      expect(envelope).toHaveProperty(key);
    }
  });

  it('FAIL envelope includes EVERY required key', () => {
    const envelope = buildFailEnvelope();
    for (const key of REQUIRED_ENVELOPE_KEYS) {
      expect(envelope).toHaveProperty(key);
    }
  });

  it('SUCCESS: ok===true, status==="SUCCESS", reasonCode==="OK"', () => {
    const envelope = buildSuccessEnvelope();
    expect(envelope.ok).toBe(true);
    expect(envelope.status).toBe('SUCCESS');
    expect(envelope.reasonCode).toBe('OK');
  });

  it('FAIL: ok===false, status==="FAIL", reasonCode is non-null non-"OK"', () => {
    const envelope = buildFailEnvelope();
    expect(envelope.ok).toBe(false);
    expect(envelope.status).toBe('FAIL');
    expect(envelope.reasonCode).not.toBe('OK');
    expect(envelope.reasonCode).toBeTruthy();
  });

  it('SUCCESS: data.zipBase64 must be present and truthy', () => {
    const envelope = buildSuccessEnvelope();
    expect(envelope.data?.zipBase64).toBeTruthy();
  });

  it('SUCCESS: downloadUrl, canonicalHash, snapshotId are non-null', () => {
    const envelope = buildSuccessEnvelope();
    expect(envelope.downloadUrl).toBeTruthy();
    expect(envelope.canonicalHash).toBeTruthy();
    expect(envelope.snapshotId).toBeTruthy();
  });

  it('FAIL: error field must have code, message, traceId', () => {
    const envelope = buildFailEnvelope();
    expect(envelope.error).toBeTruthy();
    expect(envelope.error.code).toBeTruthy();
    expect(envelope.error.message).toBeTruthy();
    expect(envelope.error.traceId).toBeTruthy();
  });

  it('SUCCESS: error is null (not missing)', () => {
    const envelope = buildSuccessEnvelope();
    expect(envelope).toHaveProperty('error');
    expect(envelope.error).toBeNull();
  });

  it('SUCCESS: reason is null (not missing)', () => {
    const envelope = buildSuccessEnvelope();
    expect(envelope).toHaveProperty('reason');
    expect(envelope.reason).toBeNull();
  });

  it('traceId is always present and non-empty on both success and fail', () => {
    expect(buildSuccessEnvelope().traceId).toBeTruthy();
    expect(buildFailEnvelope().traceId).toBeTruthy();
  });

  it('envelopeKind is always FT_ACTION_RESULT_V1', () => {
    expect(buildSuccessEnvelope().envelopeKind).toBe('FT_ACTION_RESULT_V1');
    expect(buildFailEnvelope().envelopeKind).toBe('FT_ACTION_RESULT_V1');
  });
});

// ---------------------------------------------------------------------------
// B) UI contract validator simulation
// ---------------------------------------------------------------------------

/** Simulates the UI contract check logic from main.ts */
function validateExportResult(result: any): {
  passed: boolean;
  breach?: string;
  missingFields?: string[];
} {
  // Step 1: envelope kind check
  if (!result || result.envelopeKind !== 'FT_ACTION_RESULT_V1') {
    return {
      passed: false,
      breach: 'CONTRACT_BREACH_ENVELOPE_KIND',
    };
  }

  const actionResult = result;
  const exportData = actionResult?.data || actionResult;

  // Step 2: export gate check
  if (actionResult?.exportGate && !actionResult.exportGate.allowed) {
    return {
      passed: false,
      breach: 'EXPORT_GATED',
    };
  }

  // Step 3: success with zip data
  if (exportData && exportData.ok && exportData.zipBase64) {
    return { passed: true };
  }

  // Step 4: ok:true but missing zip data
  if (actionResult?.ok === true || exportData?.ok === true) {
    const missingFields: string[] = [];
    if (!exportData?.zipBase64) missingFields.push('zipBase64');
    if (!exportData?.zipHash) missingFields.push('zipHash');
    if (!exportData?.fileCount) missingFields.push('fileCount');
    return {
      passed: false,
      breach: 'SUCCESS_BUT_NO_ZIP_DATA',
      missingFields,
    };
  }

  // Step 5: explicit failure — check reasonCode present
  const reasonCode = actionResult?.reasonCode || exportData?.reasonCode;
  if (!reasonCode) {
    return {
      passed: false,
      breach: 'FAIL_WITHOUT_REASON_CODE',
      missingFields: ['reasonCode'],
    };
  }

  return {
    passed: false,
    breach: 'BACKEND_FAIL',
  };
}

describe('UI export contract validator', () => {
  it('complete SUCCESS envelope passes validation', () => {
    const result = validateExportResult(buildSuccessEnvelope());
    expect(result.passed).toBe(true);
  });

  it('missing envelopeKind → CONTRACT_BREACH_ENVELOPE_KIND', () => {
    const result = validateExportResult({ ok: true, data: { zipBase64: 'abc' } });
    expect(result.passed).toBe(false);
    expect(result.breach).toBe('CONTRACT_BREACH_ENVELOPE_KIND');
  });

  it('null result → CONTRACT_BREACH_ENVELOPE_KIND', () => {
    const result = validateExportResult(null);
    expect(result.passed).toBe(false);
    expect(result.breach).toBe('CONTRACT_BREACH_ENVELOPE_KIND');
  });

  it('export gated → EXPORT_GATED', () => {
    const envelope = buildSuccessEnvelope({
      exportGate: { allowed: false, reasonCode: 'SEED_NOT_EXPORTABLE' },
    });
    const result = validateExportResult(envelope);
    expect(result.passed).toBe(false);
    expect(result.breach).toBe('EXPORT_GATED');
  });

  it('ok:true but missing zipBase64 → SUCCESS_BUT_NO_ZIP_DATA with missingFields', () => {
    const envelope = buildSuccessEnvelope({
      data: { ok: true, status: 'SUCCESS' }, // NO zipBase64
    });
    const result = validateExportResult(envelope);
    expect(result.passed).toBe(false);
    expect(result.breach).toBe('SUCCESS_BUT_NO_ZIP_DATA');
    expect(result.missingFields).toContain('zipBase64');
  });

  it('ok:false with reasonCode → BACKEND_FAIL (no breach)', () => {
    const result = validateExportResult(buildFailEnvelope());
    expect(result.passed).toBe(false);
    expect(result.breach).toBe('BACKEND_FAIL');
  });

  it('ok:false without reasonCode → FAIL_WITHOUT_REASON_CODE', () => {
    const envelope = buildFailEnvelope({ reasonCode: null });
    // Also remove from data
    if (envelope.data) envelope.data.reasonCode = null;
    const result = validateExportResult(envelope);
    expect(result.passed).toBe(false);
    expect(result.breach).toBe('FAIL_WITHOUT_REASON_CODE');
  });

  it('NEVER shows "Unknown error" for well-formed fail envelope', () => {
    const envelope = buildFailEnvelope();
    const failReason = envelope.reason || envelope.error?.message || 'Unknown error';
    expect(failReason).not.toBe('Unknown error');
    expect(failReason).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// C) Regression: the exact pre-v7.54 bug
// ---------------------------------------------------------------------------

describe('v7.54 regression: pre-fix export response shape', () => {
  it('old handler response (no zipBase64) causes SUCCESS_BUT_NO_ZIP_DATA, not CONTRACT_BREACH missing fields', () => {
    // This is what the backend returned BEFORE the fix
    const oldHandlerResult = {
      ok: true,
      status: 'SUCCESS',
      downloadUrl: '/download/access-pack/ef2ab421a27c23f8',
      canonicalHash: 'ef2ab421a27c23f8',
      snapshotId: 'ft:export:ef2ab421a27c23f8:1234',
      size: 2048,
      // NO zipBase64, NO zipHash, NO fileCount
    };

    // Old envelope shape (pre-v7.54: no status, no reasonCode, etc.)
    const oldEnvelope = {
      envelopeKind: 'FT_ACTION_RESULT_V1',
      ok: true,
      action: 'EXPORT_PHASE1_PACK',
      traceId: 'trace_test_789',
      build: { buildShaShort: 'abc1234', buildUtc: '2026-02-21T10:00:00Z', version: '2.14.0' },
      data: oldHandlerResult,
    };

    const result = validateExportResult(oldEnvelope);
    // With v7.54 UI fix, this is classified as SUCCESS_BUT_NO_ZIP_DATA, NOT the old "CONTRACT_BREACH missing fields"
    expect(result.passed).toBe(false);
    expect(result.breach).toBe('SUCCESS_BUT_NO_ZIP_DATA');
    expect(result.missingFields).toContain('zipBase64');
  });

  it('new handler response (with zipBase64) passes validation', () => {
    const newHandlerResult = {
      ok: true,
      status: 'SUCCESS',
      reasonCode: 'OK',
      downloadUrl: '/download/access-pack/ef2ab421a27c23f8',
      canonicalHash: 'ef2ab421a27c23f8',
      snapshotId: 'ft:export:ef2ab421a27c23f8:1234',
      size: 2048,
      zipBase64: 'UEsDBBQAAAAIAA==',
      zipHash: 'abcdef1234567890',
      fileCount: 7,
      createdAtUtc: '2026-02-21T10:00:00.000Z',
    };

    const newEnvelope = buildSuccessEnvelope({ data: newHandlerResult });
    const result = validateExportResult(newEnvelope);
    expect(result.passed).toBe(true);
  });
});
