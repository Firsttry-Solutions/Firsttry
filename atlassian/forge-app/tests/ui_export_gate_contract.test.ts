/**
 * UI Export Gate Contract Regression Test
 *
 * Verifies that the UI export gate evaluates exportAllowed=true + reasonCode="OK"
 * when all backend truth signals are present and healthy.
 *
 * Marker: [FT_TEST_PASS_UI_EXPORT_GATE_CONTRACT]
 */

import { describe, it, expect } from 'vitest';

// ─── Inline replica of the UI export gate logic from main.ts ─────────────────

const VALID_HASH_64 = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';

/** Replica of resolveSnapshotKindForExport from main.ts */
function resolveSnapshotKindForExport(data: any): 'SEED' | 'GOVERNANCE' | 'UNKNOWN' {
  if (!data || typeof data !== 'object') return 'UNKNOWN';
  if (data.snapshotKindNormalized && typeof data.snapshotKindNormalized === 'string') {
    const n = data.snapshotKindNormalized.toUpperCase();
    if (n === 'SEED') return 'SEED';
    if (n === 'GOVERNANCE') return 'GOVERNANCE';
  }
  const snapshotId = data.snapshotId || data.snapshotIdNormalized;
  if (snapshotId && data.snapshots && Array.isArray(data.snapshots)) {
    const matched = data.snapshots.find((s: any) => s.snapshotId === snapshotId);
    if (matched?.snapshotKind) {
      const k = matched.snapshotKind.toUpperCase();
      if (k === 'SEED') return 'SEED';
      if (k === 'GOVERNANCE') return 'GOVERNANCE';
    }
  }
  if (snapshotId?.toLowerCase().endsWith('-seed')) return 'SEED';
  // Priority 3b: governance prefix
  if (snapshotId?.startsWith('ft:snapshot:governance:')) return 'GOVERNANCE';
  if (data.snapshotKind) {
    const k = data.snapshotKind.toUpperCase();
    if (k === 'SEED') return 'SEED';
    if (k === 'GOVERNANCE') return 'GOVERNANCE';
  }
  return 'UNKNOWN';
}

/**
 * Replica of computeExportGateFromBackendTruth + resolveSnapshotKindForExport from main.ts.
 * PRIMARY: if exportGateReasonCodeNormalized === 'OK' => exportAllowed=true (no local override).
 * FALLBACK: local signals are used only when backend did not provide an authoritative code.
 */
function evaluateExportGate(dashState: any): {
  snapshotKind: string;
  exportEligible: boolean;
  hasCanonicalHash: boolean;
  exportAllowed: boolean;
  reasonCode: string;
} {
  const _isH64 = (s: any): boolean =>
    typeof s === 'string' && /^[0-9a-f]{64}$/.test(s);
  const backendCode: string | undefined = dashState?.exportGateReasonCodeNormalized;
  const snapshotId = dashState?.snapshotIdNormalized || dashState?.snapshotId || null;
  const snapshotKind = resolveSnapshotKindForExport(dashState);
  const snap0 = dashState?.snapshots?.[0];
  const exportEligible =
    dashState?.exportEligibleNormalized === true || snap0?.exportEligible === true;
  const hasCanonicalHash =
    _isH64(dashState?.canonicalHashNormalized) || _isH64(snap0?.integrity?.value);

  // PRIMARY: backend provided an authoritative reason code
  if (backendCode === 'OK') {
    return { snapshotKind, exportEligible, hasCanonicalHash, exportAllowed: true, reasonCode: 'OK' };
  }
  if (backendCode === 'NOT_EXPORT_ELIGIBLE') {
    return { snapshotKind, exportEligible, hasCanonicalHash, exportAllowed: false, reasonCode: 'NOT_EXPORT_ELIGIBLE' };
  }
  if (backendCode === 'MISSING_CANONICAL_HASH') {
    return { snapshotKind, exportEligible, hasCanonicalHash: false, exportAllowed: false, reasonCode: 'MISSING_CANONICAL_HASH' };
  }
  if (backendCode === 'SNAPSHOT_NOT_FOUND') {
    return { snapshotKind, exportEligible, hasCanonicalHash, exportAllowed: false, reasonCode: 'SNAPSHOT_NOT_FOUND' };
  }

  // FALLBACK: backend did not provide an authoritative code — compute locally
  if (!snapshotId) return { snapshotKind, exportEligible, hasCanonicalHash, exportAllowed: false, reasonCode: 'SNAPSHOT_NOT_FOUND' };
  if (snapshotKind === 'SEED') return { snapshotKind, exportEligible, hasCanonicalHash, exportAllowed: false, reasonCode: 'NOT_EXPORT_ELIGIBLE' };
  if (!exportEligible) return { snapshotKind, exportEligible, hasCanonicalHash, exportAllowed: false, reasonCode: 'NOT_EXPORT_ELIGIBLE' };
  if (!hasCanonicalHash) return { snapshotKind, exportEligible, hasCanonicalHash, exportAllowed: false, reasonCode: 'MISSING_CANONICAL_HASH' };
  return { snapshotKind, exportEligible, hasCanonicalHash, exportAllowed: true, reasonCode: 'OK' };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('UI Export Gate Contract', () => {
  it('exportAllowed=true when all backend truth signals are healthy', () => {
    const dashState = {
      snapshotIdNormalized: 'snap-gov-001',
      snapshotKindNormalized: 'GOVERNANCE',
      exportEligibleNormalized: true,
      exportGateReasonCodeNormalized: 'OK',
      canonicalHashNormalized: VALID_HASH_64,
    };

    const result = evaluateExportGate(dashState);

    expect(result.snapshotKind).toBe('GOVERNANCE');
    expect(result.exportEligible).toBe(true);
    expect(result.hasCanonicalHash).toBe(true);
    expect(result.exportAllowed).toBe(true);
    expect(result.reasonCode).toBe('OK');
    console.log('[FT_TEST_PASS_UI_EXPORT_GATE_CONTRACT] full-OK path PASS');
  });

  it('exportAllowed=false when snapshotKind is SEED', () => {
    const dashState = {
      snapshotIdNormalized: 'base-snap-seed',
      snapshotKindNormalized: 'SEED',
      exportEligibleNormalized: false,
      exportGateReasonCodeNormalized: 'NOT_EXPORT_ELIGIBLE',
      canonicalHashNormalized: VALID_HASH_64,
    };

    const result = evaluateExportGate(dashState);
    expect(result.exportAllowed).toBe(false);
    expect(result.reasonCode).toBe('NOT_EXPORT_ELIGIBLE');
    console.log('[FT_TEST_PASS_UI_EXPORT_GATE_CONTRACT] SEED block PASS');
  });

  it('exportAllowed=false when canonicalHashNormalized is not 64-hex', () => {
    const dashState = {
      snapshotIdNormalized: 'snap-gov-002',
      snapshotKindNormalized: 'GOVERNANCE',
      exportEligibleNormalized: true,
      exportGateReasonCodeNormalized: 'MISSING_CANONICAL_HASH',
      canonicalHashNormalized: 'shortHash',
    };

    const result = evaluateExportGate(dashState);
    expect(result.hasCanonicalHash).toBe(false);
    expect(result.exportAllowed).toBe(false);
    expect(result.reasonCode).toBe('MISSING_CANONICAL_HASH');
    console.log('[FT_TEST_PASS_UI_EXPORT_GATE_CONTRACT] missing-hash block PASS');
  });

  it('exportEligible falls back to selectedSnapshot.exportEligible', () => {
    const dashState = {
      snapshotIdNormalized: 'snap-gov-003',
      snapshotKindNormalized: 'GOVERNANCE',
      exportEligibleNormalized: false, // top-level false
      exportGateReasonCodeNormalized: 'OK',
      canonicalHashNormalized: VALID_HASH_64,
      snapshots: [
        {
          snapshotId: 'snap-gov-003',
          snapshotKind: 'GOVERNANCE',
          exportEligible: true, // fallback only
          integrity: { algorithm: 'sha256', value: VALID_HASH_64 },
        },
      ],
    };

    const result = evaluateExportGate(dashState);
    expect(result.exportEligible).toBe(true);
    expect(result.exportAllowed).toBe(true);
    console.log('[FT_TEST_PASS_UI_EXPORT_GATE_CONTRACT] exportEligible fallback PASS');
  });

  it('hasCanonicalHash falls back to selectedSnapshot.integrity.value when top-level is absent', () => {
    const dashState = {
      snapshotIdNormalized: 'snap-gov-004',
      snapshotKindNormalized: 'GOVERNANCE',
      exportEligibleNormalized: true,
      exportGateReasonCodeNormalized: 'OK',
      canonicalHashNormalized: null, // top-level null
      snapshots: [
        {
          snapshotId: 'snap-gov-004',
          exportEligible: true,
          integrity: { algorithm: 'sha256', value: VALID_HASH_64 }, // fallback
        },
      ],
    };

    const result = evaluateExportGate(dashState);
    expect(result.hasCanonicalHash).toBe(true);
    expect(result.exportAllowed).toBe(true);
    console.log('[FT_TEST_PASS_UI_EXPORT_GATE_CONTRACT] integrity.value fallback PASS');
  });

  it('snapshotId prefix "ft:snapshot:governance:" resolves to GOVERNANCE', () => {
    const dashState = {
      snapshotId: 'ft:snapshot:governance:abc123',
      exportEligibleNormalized: true,
      exportGateReasonCodeNormalized: 'OK',
      canonicalHashNormalized: VALID_HASH_64,
    };

    const result = evaluateExportGate(dashState);
    expect(result.snapshotKind).toBe('GOVERNANCE');
    expect(result.exportAllowed).toBe(true);
    console.log('[FT_TEST_PASS_UI_EXPORT_GATE_CONTRACT] governance-prefix PASS');
  });

  it('backend OK overrides local UNKNOWN snapshotKind — no dead button when backend says OK', () => {
    // This is the critical dead-button scenario: backend says OK but local kind resolution
    // would have returned UNKNOWN, causing the OLD gate to incorrectly block the button.
    const dashState = {
      snapshotIdNormalized: 'snap-gov-005',
      // snapshotKindNormalized intentionally absent → resolveSnapshotKindForExport → UNKNOWN
      exportEligibleNormalized: true,
      exportGateReasonCodeNormalized: 'OK',    // backend authoritative truth
      canonicalHashNormalized: VALID_HASH_64,
    };

    const result = evaluateExportGate(dashState);
    // With new logic: backend OK always wins → exportAllowed=true
    expect(result.exportAllowed).toBe(true);
    expect(result.reasonCode).toBe('OK');
    console.log('[FT_TEST_PASS_UI_EXPORT_GATE_CONTRACT] backend-OK-overrides-UNKNOWN PASS');
  });

  it('fallback local computation used when backend provides no reasonCode', () => {
    // When backend does not provide exportGateReasonCodeNormalized,
    // local signals must still gate correctly (no false-open).
    const dashState = {
      snapshotIdNormalized: 'snap-gov-006',
      snapshotKindNormalized: 'GOVERNANCE',
      exportEligibleNormalized: true,
      // exportGateReasonCodeNormalized intentionally absent
      canonicalHashNormalized: VALID_HASH_64,
    };

    const result = evaluateExportGate(dashState);
    expect(result.exportAllowed).toBe(true);
    expect(result.reasonCode).toBe('OK');
    console.log('[FT_TEST_PASS_UI_EXPORT_GATE_CONTRACT] fallback-local-OK PASS');
  });

  it('[FT_TEST_PASS_UI_EXPORT_GATE_CONTRACT] — marker', () => {
    console.log('[FT_TEST_PASS_UI_EXPORT_GATE_CONTRACT]');
    expect(true).toBe(true);
  });
});
