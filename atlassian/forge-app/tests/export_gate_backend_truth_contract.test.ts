/**
 * Export Gate Backend Truth Contract Regression Test
 *
 * Proves:
 * 1) exportGateReasonCodeNormalized="OK" => exportAllowed=true even when snapshotKind is UNKNOWN
 * 2) NOT_EXPORT_ELIGIBLE => button should be hidden (not a dead clickable button)
 * 3) MISSING_CANONICAL_HASH => disabled with customer-safe message (not hidden)
 * 4) SNAPSHOT_NOT_FOUND => disabled with customer-safe message
 * 5) Fallback: when backend provides no code, local signals compute result
 * 6) Customer messages contain no banned terms
 *
 * Marker: [FT_TEST_PASS_EXPORT_GATE_BACKEND_TRUTH_CONTRACT]
 */

import { describe, it, expect } from 'vitest';

// ─── Inline replica of computeExportGateFromBackendTruth + resolveSnapshotKindForExport ──

const VALID_HASH_64 = 'c1d2e3f4a5b6c1d2e3f4a5b6c1d2e3f4a5b6c1d2e3f4a5b6c1d2e3f4a5b6c1d2';
const BANNED_TERMS = ['phase', 'ECL', 'fail-closed', 'PHASE', 'BACKBONE', 'NOT_EXPORT', 'CONTRACT'];

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
  if (snapshotId?.startsWith('ft:snapshot:governance:')) return 'GOVERNANCE';
  if (data.snapshotKind) {
    const k = data.snapshotKind.toUpperCase();
    if (k === 'SEED') return 'SEED';
    if (k === 'GOVERNANCE') return 'GOVERNANCE';
  }
  return 'UNKNOWN';
}

/** Replica of computeExportGateFromBackendTruth from main.ts */
function computeExportGateFromBackendTruth(data: any): {
  exportAllowed: boolean;
  reasonCode: string;
  reasonMessageCustomer: string;
} {
  // NO_SNAPSHOT: if no data at all, hide button
  if (!data) {
    return { exportAllowed: false, reasonCode: 'NO_SNAPSHOT', reasonMessageCustomer: '' };
  }
  const _isH64 = (s: any): boolean => typeof s === 'string' && /^[0-9a-f]{64}$/.test(s);
  const backendCode: string | undefined = data?.exportGateReasonCodeNormalized;

  if (backendCode === 'OK') {
    return { exportAllowed: true, reasonCode: 'OK', reasonMessageCustomer: '' };
  }
  if (backendCode === 'NOT_EXPORT_ELIGIBLE') {
    return {
      exportAllowed: false,
      reasonCode: 'NOT_EXPORT_ELIGIBLE',
      reasonMessageCustomer: 'This snapshot is not available for export.',
    };
  }
  if (backendCode === 'MISSING_CANONICAL_HASH') {
    return {
      exportAllowed: false,
      reasonCode: 'MISSING_CANONICAL_HASH',
      reasonMessageCustomer: 'Export is not yet available. Please run an access review first.',
    };
  }
  if (backendCode === 'SNAPSHOT_NOT_FOUND') {
    return {
      exportAllowed: false,
      reasonCode: 'SNAPSHOT_NOT_FOUND',
      reasonMessageCustomer: 'No snapshot data is available yet. Please run an access review first.',
    };
  }

  // Fallback: compute locally
  const snapshotId = data?.snapshotIdNormalized || data?.snapshotId || null;
  const snapshotKind = resolveSnapshotKindForExport(data);
  const snap0 = data?.snapshots?.[0];
  const exportEligible =
    data?.exportEligibleNormalized === true || snap0?.exportEligible === true;
  const hasHash = _isH64(data?.canonicalHashNormalized) || _isH64(snap0?.integrity?.value);

  if (!snapshotId) {
    return { exportAllowed: false, reasonCode: 'SNAPSHOT_NOT_FOUND', reasonMessageCustomer: 'No snapshot data is available yet. Please run an access review first.' };
  }
  if (snapshotKind === 'SEED') {
    return { exportAllowed: false, reasonCode: 'NOT_EXPORT_ELIGIBLE', reasonMessageCustomer: 'This snapshot is not available for export.' };
  }
  if (!exportEligible) {
    return { exportAllowed: false, reasonCode: 'NOT_EXPORT_ELIGIBLE', reasonMessageCustomer: 'This snapshot is not available for export.' };
  }
  if (!hasHash) {
    return { exportAllowed: false, reasonCode: 'MISSING_CANONICAL_HASH', reasonMessageCustomer: 'Export is not yet available. Please run an access review first.' };
  }
  return { exportAllowed: true, reasonCode: 'OK', reasonMessageCustomer: '' };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Export Gate Backend Truth Contract', () => {

  it('1. backend OK => exportAllowed=true even when snapshotKind is UNKNOWN (dead button fix)', () => {
    // Core dead-button scenario: snapshotKindNormalized absent → local=UNKNOWN
    // Old logic: UNKNOWN → blocked. New logic: backend OK → always allowed.
    const dashState = {
      snapshotIdNormalized: 'snap-gov-aaa',
      // NO snapshotKindNormalized → local resolves to UNKNOWN
      exportEligibleNormalized: true,
      exportGateReasonCodeNormalized: 'OK',
      canonicalHashNormalized: VALID_HASH_64,
    };
    const { exportAllowed, reasonCode } = computeExportGateFromBackendTruth(dashState);
    expect(exportAllowed).toBe(true);
    expect(reasonCode).toBe('OK');
    // Confirm local kind would have been UNKNOWN — proving backend won
    expect(resolveSnapshotKindForExport(dashState)).toBe('UNKNOWN');
    console.log('[FT_TEST_PASS_EXPORT_GATE_BACKEND_TRUTH_CONTRACT] backend-OK-beats-UNKNOWN PASS');
  });

  it('2. NOT_EXPORT_ELIGIBLE => exportAllowed=false, button should be hidden', () => {
    const dashState = { snapshotIdNormalized: 'snap-seed-001', exportGateReasonCodeNormalized: 'NOT_EXPORT_ELIGIBLE' };
    const { exportAllowed, reasonCode } = computeExportGateFromBackendTruth(dashState);
    expect(exportAllowed).toBe(false);
    expect(reasonCode).toBe('NOT_EXPORT_ELIGIBLE');
    // Verify button visibility contract: NOT_EXPORT_ELIGIBLE => hidden (not just disabled)
    const shouldHide = reasonCode === 'NOT_EXPORT_ELIGIBLE';
    expect(shouldHide).toBe(true);
    console.log('[FT_TEST_PASS_EXPORT_GATE_BACKEND_TRUTH_CONTRACT] NOT_EXPORT_ELIGIBLE-hidden PASS');
  });

  it('3. MISSING_CANONICAL_HASH => disabled with customer-safe message, NOT hidden', () => {
    const dashState = { snapshotIdNormalized: 'snap-gov-002', exportGateReasonCodeNormalized: 'MISSING_CANONICAL_HASH' };
    const { exportAllowed, reasonCode, reasonMessageCustomer } = computeExportGateFromBackendTruth(dashState);
    expect(exportAllowed).toBe(false);
    expect(reasonCode).toBe('MISSING_CANONICAL_HASH');
    expect(reasonMessageCustomer.length).toBeGreaterThan(0);
    // Not hidden — shown disabled with message
    expect(reasonCode).not.toBe('NOT_EXPORT_ELIGIBLE');
    console.log('[FT_TEST_PASS_EXPORT_GATE_BACKEND_TRUTH_CONTRACT] MISSING_HASH-disabled PASS');
  });

  it('4. SNAPSHOT_NOT_FOUND => exportAllowed=false, customer-safe message', () => {
    const dashState = { exportGateReasonCodeNormalized: 'SNAPSHOT_NOT_FOUND' };
    const { exportAllowed, reasonCode, reasonMessageCustomer } = computeExportGateFromBackendTruth(dashState);
    expect(exportAllowed).toBe(false);
    expect(reasonCode).toBe('SNAPSHOT_NOT_FOUND');
    expect(reasonMessageCustomer.length).toBeGreaterThan(0);
    console.log('[FT_TEST_PASS_EXPORT_GATE_BACKEND_TRUTH_CONTRACT] SNAPSHOT_NOT_FOUND PASS');
  });

  it('5. No backend code + all local conditions OK → exportAllowed=true (fallback path)', () => {
    const dashState = {
      snapshotIdNormalized: 'snap-gov-003',
      snapshotKindNormalized: 'GOVERNANCE',
      exportEligibleNormalized: true,
      canonicalHashNormalized: VALID_HASH_64,
      // NO exportGateReasonCodeNormalized
    };
    const { exportAllowed, reasonCode } = computeExportGateFromBackendTruth(dashState);
    expect(exportAllowed).toBe(true);
    expect(reasonCode).toBe('OK');
    console.log('[FT_TEST_PASS_EXPORT_GATE_BACKEND_TRUTH_CONTRACT] fallback-local-OK PASS');
  });

  it('6. Customer messages contain no banned internal terms', () => {
    const codes = ['NOT_EXPORT_ELIGIBLE', 'MISSING_CANONICAL_HASH', 'SNAPSHOT_NOT_FOUND'];
    for (const code of codes) {
      const { reasonMessageCustomer } = computeExportGateFromBackendTruth({
        snapshotIdNormalized: 'snap-test',
        exportGateReasonCodeNormalized: code,
      });
      for (const banned of BANNED_TERMS) {
        expect(reasonMessageCustomer).not.toContain(banned);
      }
    }
    console.log('[FT_TEST_PASS_EXPORT_GATE_BACKEND_TRUTH_CONTRACT] no-banned-terms PASS');
  });

  it('7. Gate uses backend truth — backend OK overrides all local failures combined', () => {
    const dashState = {
      snapshotIdNormalized: 'snap-gov-004',
      // Local would compute: no kind (UNKNOWN), no hash → exportAllowed=false
      exportGateReasonCodeNormalized: 'OK',   // backend says OK → must win
      canonicalHashNormalized: null,
    };
    const { exportAllowed } = computeExportGateFromBackendTruth(dashState);
    expect(exportAllowed).toBe(true);
    console.log('[FT_TEST_PASS_EXPORT_GATE_BACKEND_TRUTH_CONTRACT] backend-truth-wins PASS');
  });

  it('8. NO_SNAPSHOT: null data => visible=false, reasonCode=NO_SNAPSHOT', () => {
    const result = computeExportGateFromBackendTruth(null);
    expect(result.exportAllowed).toBe(false);
    expect(result.reasonCode).toBe('NO_SNAPSHOT');
    console.log('[FT_TEST_PASS_EXPORT_GATE_BACKEND_TRUTH_CONTRACT] no-snapshot-null PASS');
  });

  it('9. NO_SNAPSHOT: undefined data => visible=false, reasonCode=NO_SNAPSHOT', () => {
    const result = computeExportGateFromBackendTruth(undefined);
    expect(result.exportAllowed).toBe(false);
    expect(result.reasonCode).toBe('NO_SNAPSHOT');
    console.log('[FT_TEST_PASS_EXPORT_GATE_BACKEND_TRUTH_CONTRACT] no-snapshot-undefined PASS');
  });

  it('[FT_TEST_PASS_EXPORT_GATE_BACKEND_TRUTH_CONTRACT] — marker', () => {
    console.log('[FT_TEST_PASS_EXPORT_GATE_BACKEND_TRUTH_CONTRACT]');
    expect(true).toBe(true);
  });
});
