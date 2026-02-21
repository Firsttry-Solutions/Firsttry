/**
 * Export Eligibility Gate - Unit Tests
 *
 * v7.53: Added to prove Phase-1 stats flow through to the gate correctly.
 * Covers all 5 gate rules and the specific EXPORT_PHASE1_STATS_MISSING fix.
 */
import { describe, it, expect } from 'vitest';
import { computeExportEligibilityGate } from '../src/utils/exportEligibilityGate';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal governance snapshot that passes all gate rules */
function makeGovSnapshot(overrides: Record<string, any> = {}): Record<string, any> {
  return {
    snapshotId: 'ft:snapshot:governance:1234567890',
    snapshotKind: 'GOVERNANCE',
    canonicalHash: 'deadbeef01234567',
    totals: {
      totalUsers: 83,
      activeUsers: 71,
      externalUsers: 4,
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Rule 1: snapshot must exist
// ---------------------------------------------------------------------------
describe('Rule 1 — snapshot must exist', () => {
  it('returns SNAPSHOT_NOT_FOUND for null', () => {
    const r = computeExportEligibilityGate(null);
    expect(r.exportEligible).toBe(false);
    expect(r.reasonCode).toBe('SNAPSHOT_NOT_FOUND');
  });

  it('returns SNAPSHOT_NOT_FOUND for undefined', () => {
    const r = computeExportEligibilityGate(undefined);
    expect(r.exportEligible).toBe(false);
    expect(r.reasonCode).toBe('SNAPSHOT_NOT_FOUND');
  });

  it('returns SNAPSHOT_NOT_FOUND for non-object', () => {
    const r = computeExportEligibilityGate('not an object');
    expect(r.exportEligible).toBe(false);
    expect(r.reasonCode).toBe('SNAPSHOT_NOT_FOUND');
  });
});

// ---------------------------------------------------------------------------
// Rule 2: must be GOVERNANCE (not SEED)
// ---------------------------------------------------------------------------
describe('Rule 2 — must be GOVERNANCE', () => {
  it('rejects SEED snapshots', () => {
    const r = computeExportEligibilityGate(makeGovSnapshot({ snapshotKind: 'SEED' }));
    expect(r.exportEligible).toBe(false);
    expect(r.reasonCode).toBe('SEED_NOT_EXPORTABLE');
  });

  it('rejects UNKNOWN snapshots', () => {
    const r = computeExportEligibilityGate(makeGovSnapshot({ snapshotKind: 'UNKNOWN' }));
    expect(r.exportEligible).toBe(false);
    expect(r.reasonCode).toBe('SEED_NOT_EXPORTABLE');
  });

  it('rejects snapshot with missing snapshotKind (defaults to UNKNOWN)', () => {
    const snap = makeGovSnapshot();
    delete snap.snapshotKind;
    const r = computeExportEligibilityGate(snap);
    expect(r.exportEligible).toBe(false);
    expect(r.reasonCode).toBe('SEED_NOT_EXPORTABLE');
  });
});

// ---------------------------------------------------------------------------
// Rule 3: Phase-1 totals — the EXPORT_PHASE1_STATS_MISSING gate
// ---------------------------------------------------------------------------
describe('Rule 3 — Phase-1 totals (EXPORT_PHASE1_STATS_MISSING)', () => {
  it('returns EXPORT_PHASE1_STATS_MISSING when totals is null', () => {
    const r = computeExportEligibilityGate(makeGovSnapshot({ totals: null }));
    expect(r.exportEligible).toBe(false);
    expect(r.reasonCode).toBe('EXPORT_PHASE1_STATS_MISSING');
    expect(r.hasTotals).toBe(false);
  });

  it('returns EXPORT_PHASE1_STATS_MISSING when totals is undefined', () => {
    const snap = makeGovSnapshot();
    delete snap.totals;
    const r = computeExportEligibilityGate(snap);
    expect(r.exportEligible).toBe(false);
    expect(r.reasonCode).toBe('EXPORT_PHASE1_STATS_MISSING');
  });

  it('returns EXPORT_PHASE1_STATS_MISSING when totals is empty object', () => {
    const r = computeExportEligibilityGate(makeGovSnapshot({ totals: {} }));
    expect(r.exportEligible).toBe(false);
    expect(r.reasonCode).toBe('EXPORT_PHASE1_STATS_MISSING');
    expect(r.hasTotals).toBe(true); // totals IS an object
    expect(r.totalUsers).toBeNull(); // but totalUsers is not a number
  });

  it('returns EXPORT_PHASE1_STATS_MISSING when totalUsers is NaN', () => {
    const r = computeExportEligibilityGate(
      makeGovSnapshot({ totals: { totalUsers: 'not-a-number' } }),
    );
    expect(r.exportEligible).toBe(false);
    expect(r.reasonCode).toBe('EXPORT_PHASE1_STATS_MISSING');
    expect(r.totalUsers).toBeNull();
  });

  it('passes when totals.totalUsers is 0 (edge case: empty tenant)', () => {
    const r = computeExportEligibilityGate(
      makeGovSnapshot({ totals: { totalUsers: 0 } }),
    );
    // 0 is a valid number — gate should pass Rule 3
    expect(r.reasonCode).not.toBe('EXPORT_PHASE1_STATS_MISSING');
    expect(r.totalUsers).toBe(0);
  });

  it('passes when totals.totalUsers is 83', () => {
    const r = computeExportEligibilityGate(makeGovSnapshot());
    expect(r.reasonCode).not.toBe('EXPORT_PHASE1_STATS_MISSING');
    expect(r.hasTotals).toBe(true);
    expect(r.totalUsers).toBe(83);
  });
});

// ---------------------------------------------------------------------------
// Rule 4: canonical hash
// ---------------------------------------------------------------------------
describe('Rule 4 — canonicalHash', () => {
  it('returns MISSING_CANONICAL_HASH when canonicalHash is null', () => {
    const r = computeExportEligibilityGate(makeGovSnapshot({ canonicalHash: null }));
    expect(r.exportEligible).toBe(false);
    expect(r.reasonCode).toBe('MISSING_CANONICAL_HASH');
  });

  it('returns MISSING_CANONICAL_HASH when canonicalHash is empty string', () => {
    const r = computeExportEligibilityGate(makeGovSnapshot({ canonicalHash: '' }));
    expect(r.exportEligible).toBe(false);
    expect(r.reasonCode).toBe('MISSING_CANONICAL_HASH');
  });
});

// ---------------------------------------------------------------------------
// Rule 5: All pass → OK
// ---------------------------------------------------------------------------
describe('Rule 5 — All pass → OK', () => {
  it('returns OK and exportEligible=true for valid governance snapshot', () => {
    const r = computeExportEligibilityGate(makeGovSnapshot());
    expect(r.exportEligible).toBe(true);
    expect(r.reasonCode).toBe('OK');
    expect(r.hasTotals).toBe(true);
    expect(r.totalUsers).toBe(83);
    expect(r.message).toBe('Export eligible');
  });
});

// ---------------------------------------------------------------------------
// v7.53 regression test: simulates the dashboard snapshot object shape
// that previously MISSED totals (the exact bug being fixed)
// ---------------------------------------------------------------------------
describe('v7.53 regression: dashboard snapshot with totals carried through', () => {
  it('passes when snapshot has exact shape produced by fixed gadget-resolver', () => {
    // This mirrors the object shape produced by snapshotsArray.unshift() AFTER the fix
    const dashboardSnapshot = {
      snapshotId: 'ft:snapshot:governance:1740000000000',
      snapshotKind: 'GOVERNANCE',
      origin: 'ON_DEMAND',
      initiator: 'user',
      triggerReason: 'Phase 1 Access Intelligence Scan',
      createdAtUtc: '2026-02-21T10:00:00.000Z',
      immutabilityStatement: 'Timestamp recorded at snapshot creation (UTC) and cannot be modified.',
      integrity: { algorithm: 'sha256', value: 'a'.repeat(64) },
      scope: { included: [], excluded: [] },
      controls: [],
      exportEligible: true,
      exportDeclaration: 'This export contains governance evidence collected from a live Jira tenant.',
      // v7.53 FIX: these two fields are now carried through
      totals: { totalUsers: 83, activeUsers: 71, externalUsers: 4 },
      canonicalHash: 'deadbeef01234567',
    };

    const r = computeExportEligibilityGate(dashboardSnapshot);
    expect(r.exportEligible).toBe(true);
    expect(r.reasonCode).toBe('OK');
    expect(r.totalUsers).toBe(83);
  });

  it('FAILS when snapshot is missing totals (pre-v7.53 shape — the bug)', () => {
    // This mirrors the BROKEN shape that existed BEFORE the fix
    const brokenDashboardSnapshot = {
      snapshotId: 'ft:snapshot:governance:1740000000000',
      snapshotKind: 'GOVERNANCE',
      origin: 'ON_DEMAND',
      initiator: 'user',
      createdAtUtc: '2026-02-21T10:00:00.000Z',
      integrity: { algorithm: 'sha256', value: 'a'.repeat(64) },
      scope: { included: [], excluded: [] },
      controls: [],
      exportEligible: true,
      exportDeclaration: 'This export contains governance evidence collected from a live Jira tenant.',
      // NO totals — this is the bug
      // NO canonicalHash — also missing
    };

    const r = computeExportEligibilityGate(brokenDashboardSnapshot);
    expect(r.exportEligible).toBe(false);
    expect(r.reasonCode).toBe('EXPORT_PHASE1_STATS_MISSING');
  });
});
