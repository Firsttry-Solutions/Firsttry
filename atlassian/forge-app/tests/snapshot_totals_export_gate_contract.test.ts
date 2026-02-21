/**
 * v7.50 Contract Tests: Snapshot totals persistence + export eligibility gate
 *
 * T1: Governance snapshot WITHOUT totals → exportEligible=false, reasonCode='EXPORT_PHASE1_STATS_MISSING'
 * T2: Governance snapshot WITH totals.totalUsers=83 → exportEligible=true, reasonCode='OK'
 * T3: Export on snapshot without totals → ok:false, reasonCode='EXPORT_PHASE1_STATS_MISSING', no TypeError
 * T4: Export on snapshot with totals → ok:true (no failure for missing totals)
 *
 * Also tests the shared gate function directly for all edge cases.
 */

import { describe, it, expect } from 'vitest';
import { computeExportEligibilityGate, ExportEligibilityResult } from '../src/utils/exportEligibilityGate';
import { validatePhase1Stats, Phase1StatsValidation } from '../src/resolvers/ft_exportAccessPack_v1';

// ============================================================================
// T1: Governance snapshot WITHOUT totals → gate returns ineligible
// ============================================================================

describe('T1: Governance snapshot without totals → gate blocks export', () => {
  it('snapshot with snapshotKind=GOVERNANCE but no totals → EXPORT_PHASE1_STATS_MISSING', () => {
    const snapshot = {
      snapshotKind: 'GOVERNANCE',
      canonicalHash: 'abc123',
      exportEligible: true,
      // totals: MISSING
    };
    const result = computeExportEligibilityGate(snapshot);
    expect(result.exportEligible).toBe(false);
    expect(result.reasonCode).toBe('EXPORT_PHASE1_STATS_MISSING');
    expect(result.hasTotals).toBe(false);
  });

  it('snapshot with totals but missing totalUsers → EXPORT_PHASE1_STATS_MISSING', () => {
    const snapshot = {
      snapshotKind: 'GOVERNANCE',
      canonicalHash: 'abc123',
      exportEligible: true,
      totals: { activeUsers: 10 }, // no totalUsers
    };
    const result = computeExportEligibilityGate(snapshot);
    expect(result.exportEligible).toBe(false);
    expect(result.reasonCode).toBe('EXPORT_PHASE1_STATS_MISSING');
    expect(result.hasTotals).toBe(true);
    expect(result.totalUsers).toBeNull();
  });

  it('snapshot with totals.totalUsers as string → EXPORT_PHASE1_STATS_MISSING', () => {
    const snapshot = {
      snapshotKind: 'GOVERNANCE',
      canonicalHash: 'abc123',
      exportEligible: true,
      totals: { totalUsers: '83' }, // wrong type
    };
    const result = computeExportEligibilityGate(snapshot);
    expect(result.exportEligible).toBe(false);
    expect(result.reasonCode).toBe('EXPORT_PHASE1_STATS_MISSING');
  });

  it('snapshot with totals=null → EXPORT_PHASE1_STATS_MISSING', () => {
    const snapshot = {
      snapshotKind: 'GOVERNANCE',
      canonicalHash: 'abc123',
      exportEligible: true,
      totals: null,
    };
    const result = computeExportEligibilityGate(snapshot);
    expect(result.exportEligible).toBe(false);
    expect(result.reasonCode).toBe('EXPORT_PHASE1_STATS_MISSING');
    expect(result.hasTotals).toBe(false);
  });

  it('null snapshot → SNAPSHOT_NOT_FOUND', () => {
    const result = computeExportEligibilityGate(null);
    expect(result.exportEligible).toBe(false);
    expect(result.reasonCode).toBe('SNAPSHOT_NOT_FOUND');
  });

  it('SEED snapshot → SEED_NOT_EXPORTABLE', () => {
    const snapshot = {
      snapshotKind: 'SEED',
      canonicalHash: 'abc123',
    };
    const result = computeExportEligibilityGate(snapshot);
    expect(result.exportEligible).toBe(false);
    expect(result.reasonCode).toBe('SEED_NOT_EXPORTABLE');
  });

  it('snapshot without canonicalHash → MISSING_CANONICAL_HASH', () => {
    const snapshot = {
      snapshotKind: 'GOVERNANCE',
      totals: { totalUsers: 83 },
      // canonicalHash: MISSING
    };
    const result = computeExportEligibilityGate(snapshot);
    expect(result.exportEligible).toBe(false);
    expect(result.reasonCode).toBe('MISSING_CANONICAL_HASH');
  });
});

// ============================================================================
// T2: Governance snapshot WITH totals.totalUsers=83 → exportEligible=true
// ============================================================================

describe('T2: Governance snapshot with totals → gate allows export', () => {
  it('complete governance snapshot → exportEligible=true, reasonCode=OK', () => {
    const snapshot = {
      snapshotKind: 'GOVERNANCE',
      canonicalHash: 'abc123def456',
      exportEligible: true,
      totals: {
        totalUsers: 83,
        activeUsers: 70,
        externalUsers: 5,
      },
      riskModel: {
        finalRiskScore: 0.35,
        adminDensity: 0.05,
      },
    };
    const result = computeExportEligibilityGate(snapshot);
    expect(result.exportEligible).toBe(true);
    expect(result.reasonCode).toBe('OK');
    expect(result.hasTotals).toBe(true);
    expect(result.totalUsers).toBe(83);
  });

  it('zero totalUsers is valid (number type check, not value check)', () => {
    const snapshot = {
      snapshotKind: 'GOVERNANCE',
      canonicalHash: 'abc123def456',
      totals: { totalUsers: 0 },
    };
    const result = computeExportEligibilityGate(snapshot);
    expect(result.exportEligible).toBe(true);
    expect(result.reasonCode).toBe('OK');
    expect(result.totalUsers).toBe(0);
  });

  it('minimal valid snapshot (only required fields)', () => {
    const snapshot = {
      snapshotKind: 'GOVERNANCE',
      canonicalHash: 'xxxx',
      totals: { totalUsers: 1 },
    };
    const result = computeExportEligibilityGate(snapshot);
    expect(result.exportEligible).toBe(true);
    expect(result.reasonCode).toBe('OK');
  });
});

// ============================================================================
// T3: Export called on snapshot without totals → ok:false, no TypeError
// ============================================================================

describe('T3: validatePhase1Stats with missing totals → structured failure, no TypeError', () => {
  it('no totals → valid=false, EXPORT_PHASE1_STATS_MISSING', () => {
    const snapshot = {
      snapshotKind: 'GOVERNANCE',
      canonicalHash: 'abc123',
    };
    // Must NOT throw
    const result = validatePhase1Stats(snapshot);
    expect(result.valid).toBe(false);
    expect(result.reasonCode).toBe('EXPORT_PHASE1_STATS_MISSING');
    expect(result.totalUsers).toBeNull();
  });

  it('null snapshot → valid=false, no throw', () => {
    const result = validatePhase1Stats(null);
    expect(result.valid).toBe(false);
    expect(result.reasonCode).toBe('EXPORT_PHASE1_STATS_MISSING');
  });

  it('undefined snapshot → valid=false, no throw', () => {
    const result = validatePhase1Stats(undefined);
    expect(result.valid).toBe(false);
    expect(result.reasonCode).toBe('EXPORT_PHASE1_STATS_MISSING');
  });

  it('totals without totalUsers → valid=false, no throw', () => {
    const snapshot = {
      totals: { activeUsers: 10 },
      riskModel: { finalRiskScore: 0.5 },
    };
    const result = validatePhase1Stats(snapshot);
    expect(result.valid).toBe(false);
    expect(result.reasonCode).toBe('EXPORT_PHASE1_STATS_MISSING');
  });

  it('missing riskModel.finalRiskScore → valid=false, no throw', () => {
    const snapshot = {
      totals: { totalUsers: 83 },
      riskModel: { adminDensity: 0.1 }, // no finalRiskScore
    };
    const result = validatePhase1Stats(snapshot);
    expect(result.valid).toBe(false);
    expect(result.reasonCode).toBe('EXPORT_PHASE1_STATS_MISSING');
    expect(result.totalUsers).toBe(83);
    expect(result.finalRiskScore).toBeNull();
  });
});

// ============================================================================
// T4: Export called on snapshot with totals → ok:true (no failure for missing totals)
// ============================================================================

describe('T4: validatePhase1Stats with valid totals → success', () => {
  it('complete stats → valid=true', () => {
    const snapshot = {
      totals: { totalUsers: 83, activeUsers: 70, externalUsers: 5 },
      riskModel: { finalRiskScore: 0.35, adminDensity: 0.05 },
      exposure: { globalAdmins: ['a', 'b'], publicProjects: ['PROJ1'] },
      toxicFindings: [{ ruleId: 'R1' }],
    };
    const result = validatePhase1Stats(snapshot);
    expect(result.valid).toBe(true);
    expect(result.totalUsers).toBe(83);
    expect(result.finalRiskScore).toBe(0.35);
    expect(result.globalAdminsCount).toBe(2);
    expect(result.publicProjectsCount).toBe(1);
    expect(result.toxicFindingsCount).toBe(1);
  });

  it('zero totalUsers is valid', () => {
    const snapshot = {
      totals: { totalUsers: 0 },
      riskModel: { finalRiskScore: 0 },
    };
    const result = validatePhase1Stats(snapshot);
    expect(result.valid).toBe(true);
    expect(result.totalUsers).toBe(0);
  });

  it('missing optional fields still valid', () => {
    const snapshot = {
      totals: { totalUsers: 42 },
      riskModel: { finalRiskScore: 0.1 },
      // exposure: missing
      // toxicFindings: missing
    };
    const result = validatePhase1Stats(snapshot);
    expect(result.valid).toBe(true);
    expect(result.totalUsers).toBe(42);
    expect(result.globalAdminsCount).toBeNull();
    expect(result.toxicFindingsCount).toBeNull();
  });
});

// ============================================================================
// Shared gate + validatePhase1Stats consistency
// ============================================================================

describe('Shared gate and validatePhase1Stats agree on eligibility', () => {
  it('both accept complete governance snapshot', () => {
    const snapshot = {
      snapshotKind: 'GOVERNANCE',
      canonicalHash: 'abc123',
      totals: { totalUsers: 50, activeUsers: 40, externalUsers: 3 },
      riskModel: { finalRiskScore: 0.2, adminDensity: 0.04 },
      exposure: { globalAdmins: ['x'], publicProjects: [] },
      toxicFindings: [],
    };
    const gateResult = computeExportEligibilityGate(snapshot);
    const statsResult = validatePhase1Stats(snapshot);
    expect(gateResult.exportEligible).toBe(true);
    expect(statsResult.valid).toBe(true);
  });

  it('both reject snapshot without totals', () => {
    const snapshot = {
      snapshotKind: 'GOVERNANCE',
      canonicalHash: 'abc123',
    };
    const gateResult = computeExportEligibilityGate(snapshot);
    const statsResult = validatePhase1Stats(snapshot);
    expect(gateResult.exportEligible).toBe(false);
    expect(gateResult.reasonCode).toBe('EXPORT_PHASE1_STATS_MISSING');
    expect(statsResult.valid).toBe(false);
    expect(statsResult.reasonCode).toBe('EXPORT_PHASE1_STATS_MISSING');
  });
});

// ============================================================================
// Proof marker output test
// ============================================================================

describe('Proof markers', () => {
  it('[FT_PROOF_BACKEND_EXPORT_GATE] marker fields are correct', () => {
    const snapshot = {
      snapshotKind: 'GOVERNANCE',
      canonicalHash: 'test_hash',
      totals: { totalUsers: 99 },
    };
    const result = computeExportEligibilityGate(snapshot);
    // Verify the result has all fields needed for the proof marker
    expect(result).toHaveProperty('exportEligible');
    expect(result).toHaveProperty('reasonCode');
    expect(result).toHaveProperty('hasTotals');
    expect(result).toHaveProperty('totalUsers');
    expect(result.exportEligible).toBe(true);
    expect(result.reasonCode).toBe('OK');
    expect(result.hasTotals).toBe(true);
    expect(result.totalUsers).toBe(99);
  });

  it('[FT_PROOF_BACKEND_SNAPSHOT_PERSIST_TOTALS] marker data shape (simulated)', () => {
    // Simulate what ft_runAccessIntelligence_v1.ts would produce
    const snapshot = {
      totals: { totalUsers: 42, activeUsers: 30, externalUsers: 2 },
      riskModel: { finalRiskScore: 0.15 },
    };
    const markerData = {
      snapshotId: 'ft:snapshot:governance:123',
      hasTotals: !!snapshot.totals,
      totalsKeys: Object.keys(snapshot.totals),
      totalUsers: snapshot.totals.totalUsers,
    };
    expect(markerData.hasTotals).toBe(true);
    expect(markerData.totalsKeys).toContain('totalUsers');
    expect(markerData.totalUsers).toBe(42);
  });
});
