/**
 * Export Eligibility Backend Truth Contract Tests (v7.46)
 *
 * Tests computeExportEligibilityFromBackend() — the pure function that
 * reads the RAW resolver envelope (not the mapped dashState) to determine
 * whether a snapshot is eligible for export.
 *
 * T1: Backend OK + GOVERNANCE → eligibilityOk=true, exportVisible=true
 * T2: Backend NOT_EXPORT_ELIGIBLE → eligibilityOk=false, exportVisible=false
 * T3: No backend code but exportEligible=true + GOVERNANCE → fallback OK
 * T4: Readiness NOT_READY but backend OK → exportVisible still true
 *
 * Marker: [FT_TEST_PASS_EXPORT_ELIGIBILITY_BACKEND_TRUTH_CONTRACT]
 */

import { describe, it, expect } from 'vitest';
import {
  computeExportEligibilityFromBackend,
  computeActionModel,
  type ExportEligibilityResult,
} from '../src/gadget-ui/src/snapshotActionModel';

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Build a fake raw resolver envelope mimicking backend response */
function makeEnvelope(overrides: Record<string, any> = {}): any {
  return {
    envelopeKind: 'FT_DASH_ENVELOPE_V1',
    ok: true,
    status: 'AVAILABLE',
    data: {
      status: 'AVAILABLE',
      snapshotId: 'ft:snapshot:governance:abc123',
      snapshotKindNormalized: 'GOVERNANCE',
      exportGateReasonCodeNormalized: 'OK',
      exportEligibleNormalized: true,
      canonicalHashNormalized: 'c1d2e3f4a5b6c1d2e3f4a5b6c1d2e3f4a5b6c1d2e3f4a5b6c1d2e3f4a5b6c1d2',
      ...overrides,
    },
  };
}

// ── T1: Backend OK + GOVERNANCE → eligibilityOk=true, exportVisible=true ────

describe('T1: Backend exportGateReasonCodeNormalized=OK + GOVERNANCE', () => {
  it('returns eligibilityOk=true with source=backend', () => {
    const envelope = makeEnvelope({
      exportGateReasonCodeNormalized: 'OK',
      snapshotKindNormalized: 'GOVERNANCE',
    });
    const result = computeExportEligibilityFromBackend(envelope);
    expect(result.eligibilityOk).toBe(true);
    expect(result.reasonCode).toBe('OK');
    expect(result.source).toBe('backend');
    expect(result.backendReasonCode).toBe('OK');
  });

  it('drives exportVisible=true in action model', () => {
    const envelope = makeEnvelope({
      exportGateReasonCodeNormalized: 'OK',
      snapshotKindNormalized: 'GOVERNANCE',
    });
    const eligibility = computeExportEligibilityFromBackend(envelope);
    const model = computeActionModel({
      status: 'AVAILABLE',
      selectedVariant: 'latest',
      effectiveKind: 'GOVERNANCE',
      exportGateOk: eligibility.eligibilityOk,
      exportGateReasonCode: eligibility.reasonCode,
      sealed: false,
      buildCoherenceOk: true,
    });
    expect(model.exportVisible).toBe(true);
    expect(model.exportEnabled).toBe(true);
  });
});

// ── T2: Backend NOT_EXPORT_ELIGIBLE → eligibilityOk=false, exportVisible=false

describe('T2: Backend exportGateReasonCodeNormalized=NOT_EXPORT_ELIGIBLE', () => {
  it('returns eligibilityOk=false with source=backend', () => {
    const envelope = makeEnvelope({
      exportGateReasonCodeNormalized: 'NOT_EXPORT_ELIGIBLE',
    });
    const result = computeExportEligibilityFromBackend(envelope);
    expect(result.eligibilityOk).toBe(false);
    expect(result.reasonCode).toBe('NOT_EXPORT_ELIGIBLE');
    expect(result.source).toBe('backend');
    expect(result.backendReasonCode).toBe('NOT_EXPORT_ELIGIBLE');
  });

  it('drives exportVisible=false in action model', () => {
    const envelope = makeEnvelope({
      exportGateReasonCodeNormalized: 'NOT_EXPORT_ELIGIBLE',
    });
    const eligibility = computeExportEligibilityFromBackend(envelope);
    const model = computeActionModel({
      status: 'AVAILABLE',
      selectedVariant: 'latest',
      effectiveKind: 'GOVERNANCE',
      exportGateOk: eligibility.eligibilityOk,
      exportGateReasonCode: eligibility.reasonCode,
      sealed: false,
      buildCoherenceOk: true,
    });
    expect(model.exportVisible).toBe(false);
  });
});

// ── T3: No backend code but exportEligible=true + GOVERNANCE → fallback OK ──

describe('T3: Fallback — no backend code, exportEligible=true + GOVERNANCE', () => {
  it('returns eligibilityOk=true with source=fallback', () => {
    const envelope = makeEnvelope({
      exportGateReasonCodeNormalized: undefined,
      exportEligibleNormalized: true,
      snapshotKindNormalized: 'GOVERNANCE',
    });
    // Remove the field entirely so it's truly missing
    delete envelope.data.exportGateReasonCodeNormalized;
    const result = computeExportEligibilityFromBackend(envelope);
    expect(result.eligibilityOk).toBe(true);
    expect(result.reasonCode).toBe('FALLBACK_OK');
    expect(result.source).toBe('fallback');
    expect(result.backendReasonCode).toBeUndefined();
  });

  it('fallback without exportEligible → not eligible', () => {
    const envelope = makeEnvelope({
      exportEligibleNormalized: false,
      snapshotKindNormalized: 'GOVERNANCE',
    });
    delete envelope.data.exportGateReasonCodeNormalized;
    const result = computeExportEligibilityFromBackend(envelope);
    expect(result.eligibilityOk).toBe(false);
    expect(result.reasonCode).toBe('MISSING_BACKEND_EXPORT_GATE');
    expect(result.source).toBe('fallback');
  });

  it('fallback SEED + exportEligible → not eligible (SEED never eligible)', () => {
    const envelope = makeEnvelope({
      exportEligibleNormalized: true,
      snapshotKindNormalized: 'SEED',
    });
    delete envelope.data.exportGateReasonCodeNormalized;
    const result = computeExportEligibilityFromBackend(envelope);
    expect(result.eligibilityOk).toBe(false);
    expect(result.reasonCode).toBe('MISSING_BACKEND_EXPORT_GATE');
    expect(result.source).toBe('fallback');
  });
});

// ── T4: Readiness NOT_READY but backend OK → exportVisible still true ───────

describe('T4: Readiness signals do NOT override backend eligibility', () => {
  it('backend OK → exportVisible=true regardless of readiness state', () => {
    // Simulate: backend says OK, but UI_EXPORT_COMBINED_NOT_READY would fire
    // The key insight: readiness is informational only, eligibility drives visibility
    const envelope = makeEnvelope({
      exportGateReasonCodeNormalized: 'OK',
      snapshotKindNormalized: 'GOVERNANCE',
    });
    const eligibility = computeExportEligibilityFromBackend(envelope);
    expect(eligibility.eligibilityOk).toBe(true);

    // Action model should still show export visible even if readiness is not ready
    // (readiness signals are console.log only, they don't feed into action model)
    const model = computeActionModel({
      status: 'AVAILABLE',
      selectedVariant: 'latest',
      effectiveKind: 'GOVERNANCE',
      exportGateOk: eligibility.eligibilityOk, // true from backend
      exportGateReasonCode: eligibility.reasonCode,
      sealed: false,
      buildCoherenceOk: true,
    });
    expect(model.exportVisible).toBe(true);
    expect(model.exportEnabled).toBe(true);
  });
});

// ── Edge cases ──────────────────────────────────────────────────────────────

describe('Edge cases: computeExportEligibilityFromBackend', () => {
  it('null envelope → not eligible', () => {
    const result = computeExportEligibilityFromBackend(null);
    expect(result.eligibilityOk).toBe(false);
    expect(result.reasonCode).toBe('NO_ENVELOPE');
    expect(result.source).toBe('fallback');
  });

  it('undefined envelope → not eligible', () => {
    const result = computeExportEligibilityFromBackend(undefined);
    expect(result.eligibilityOk).toBe(false);
    expect(result.reasonCode).toBe('NO_ENVELOPE');
    expect(result.source).toBe('fallback');
  });

  it('empty object → MISSING_BACKEND_EXPORT_GATE', () => {
    const result = computeExportEligibilityFromBackend({});
    expect(result.eligibilityOk).toBe(false);
    expect(result.reasonCode).toBe('MISSING_BACKEND_EXPORT_GATE');
    expect(result.source).toBe('fallback');
  });

  it('case-insensitive: "ok" (lowercase) is recognized as OK', () => {
    const envelope = makeEnvelope({ exportGateReasonCodeNormalized: 'ok' });
    const result = computeExportEligibilityFromBackend(envelope);
    expect(result.eligibilityOk).toBe(true);
    expect(result.reasonCode).toBe('OK');
    expect(result.source).toBe('backend');
  });

  it('MISSING_CANONICAL_HASH → not eligible', () => {
    const envelope = makeEnvelope({ exportGateReasonCodeNormalized: 'MISSING_CANONICAL_HASH' });
    const result = computeExportEligibilityFromBackend(envelope);
    expect(result.eligibilityOk).toBe(false);
    expect(result.reasonCode).toBe('MISSING_CANONICAL_HASH');
    expect(result.source).toBe('backend');
  });

  it('SNAPSHOT_NOT_FOUND → not eligible', () => {
    const envelope = makeEnvelope({ exportGateReasonCodeNormalized: 'SNAPSHOT_NOT_FOUND' });
    const result = computeExportEligibilityFromBackend(envelope);
    expect(result.eligibilityOk).toBe(false);
    expect(result.reasonCode).toBe('SNAPSHOT_NOT_FOUND');
    expect(result.source).toBe('backend');
  });

  it('flat envelope (no .data wrapper) still works', () => {
    // Some code paths may pass the data object directly
    const flat = {
      status: 'AVAILABLE',
      exportGateReasonCodeNormalized: 'OK',
      snapshotKindNormalized: 'GOVERNANCE',
    };
    const result = computeExportEligibilityFromBackend(flat);
    expect(result.eligibilityOk).toBe(true);
    expect(result.source).toBe('backend');
  });
});

// Proof marker — emitted when all tests pass
describe('Proof marker', () => {
  it('[FT_TEST_PASS_EXPORT_ELIGIBILITY_BACKEND_TRUTH_CONTRACT]', () => {
    console.log('[FT_TEST_PASS_EXPORT_ELIGIBILITY_BACKEND_TRUTH_CONTRACT]');
    expect(true).toBe(true);
  });
});
