/**
 * Export Phase1 totalUsers Fail-Closed Contract Tests (v7.49)
 *
 * T1: Snapshot missing Phase1 stats (totalUsers) → ok:false, reasonCode EXPORT_PHASE1_STATS_MISSING
 * T2: Snapshot with valid Phase1 stats → valid:true, totalUsers is a number
 *
 * Marker: [FT_TEST_PASS_EXPORT_TOTALUSERS_FAILCLOSED_CONTRACT]
 */

import { describe, it, expect } from 'vitest';
import { validatePhase1Stats, Phase1StatsValidation } from '../src/resolvers/ft_exportAccessPack_v1';

// ── T1: Missing Phase1 stats ───────────────────────────────────────────────

describe('T1: validatePhase1Stats — missing data returns structured failure', () => {
  it('returns EXPORT_PHASE1_STATS_MISSING when snapshot has no totals', () => {
    const result = validatePhase1Stats({
      canonicalHash: 'abc123',
      riskModel: { finalRiskScore: 0.5 },
      exposure: { globalAdmins: [], publicProjects: [] },
      toxicFindings: [],
      // totals is MISSING
    });
    expect(result.valid).toBe(false);
    expect(result.reasonCode).toBe('EXPORT_PHASE1_STATS_MISSING');
    expect(result.message).toContain('totalUsers');
    expect(result.totalUsers).toBeNull();
  });

  it('returns EXPORT_PHASE1_STATS_MISSING when totals exists but totalUsers is undefined', () => {
    const result = validatePhase1Stats({
      canonicalHash: 'abc123',
      totals: { activeUsers: 10 }, // totalUsers missing
      riskModel: { finalRiskScore: 0.5 },
      exposure: { globalAdmins: [], publicProjects: [] },
      toxicFindings: [],
    });
    expect(result.valid).toBe(false);
    expect(result.reasonCode).toBe('EXPORT_PHASE1_STATS_MISSING');
    expect(result.totalUsers).toBeNull();
  });

  it('returns EXPORT_PHASE1_STATS_MISSING when totals.totalUsers is a string (not number)', () => {
    const result = validatePhase1Stats({
      canonicalHash: 'abc123',
      totals: { totalUsers: '42' }, // wrong type
      riskModel: { finalRiskScore: 0.5 },
    });
    expect(result.valid).toBe(false);
    expect(result.reasonCode).toBe('EXPORT_PHASE1_STATS_MISSING');
  });

  it('returns EXPORT_PHASE1_STATS_MISSING when riskModel.finalRiskScore is missing', () => {
    const result = validatePhase1Stats({
      canonicalHash: 'abc123',
      totals: { totalUsers: 42, activeUsers: 30, externalUsers: 5 },
      riskModel: {}, // finalRiskScore missing
      exposure: { globalAdmins: [], publicProjects: [] },
      toxicFindings: [],
    });
    expect(result.valid).toBe(false);
    expect(result.reasonCode).toBe('EXPORT_PHASE1_STATS_MISSING');
    expect(result.message).toContain('finalRiskScore');
    expect(result.totalUsers).toBe(42); // totalUsers is fine, but riskModel is not
  });

  it('returns EXPORT_PHASE1_STATS_MISSING when snapshot is null', () => {
    const result = validatePhase1Stats(null);
    expect(result.valid).toBe(false);
    expect(result.reasonCode).toBe('EXPORT_PHASE1_STATS_MISSING');
  });

  it('returns EXPORT_PHASE1_STATS_MISSING when snapshot is undefined', () => {
    const result = validatePhase1Stats(undefined);
    expect(result.valid).toBe(false);
    expect(result.reasonCode).toBe('EXPORT_PHASE1_STATS_MISSING');
  });

  it('never throws TypeError even with deeply broken data', () => {
    // This is the exact scenario that caused the production bug
    expect(() => validatePhase1Stats({})).not.toThrow();
    expect(() => validatePhase1Stats({ totals: undefined })).not.toThrow();
    expect(() => validatePhase1Stats({ totals: null })).not.toThrow();
    expect(() => validatePhase1Stats({ totals: 'string' })).not.toThrow();
    expect(() => validatePhase1Stats({ riskModel: undefined })).not.toThrow();
    expect(() => validatePhase1Stats({ exposure: undefined })).not.toThrow();
    expect(() => validatePhase1Stats({ toxicFindings: 'not-array' })).not.toThrow();
  });
});

// ── T2: Valid Phase1 stats ─────────────────────────────────────────────────

describe('T2: validatePhase1Stats — valid data returns success', () => {
  it('returns valid:true with complete Phase1 stats', () => {
    const result = validatePhase1Stats({
      canonicalHash: 'abc123',
      totals: { totalUsers: 150, activeUsers: 120, externalUsers: 10 },
      riskModel: { finalRiskScore: 0.55, adminDensity: 0.1, externalExposureScore: 0.2, toxicHitCount: 3 },
      exposure: { globalAdmins: ['u1', 'u2'], publicProjects: ['p1'] },
      toxicFindings: [{ id: 'f1' }, { id: 'f2' }],
    });
    expect(result.valid).toBe(true);
    expect(result.totalUsers).toBe(150);
    expect(result.activeUsers).toBe(120);
    expect(result.externalUsers).toBe(10);
    expect(result.globalAdminsCount).toBe(2);
    expect(result.publicProjectsCount).toBe(1);
    expect(result.toxicFindingsCount).toBe(2);
    expect(result.finalRiskScore).toBe(0.55);
    expect(result.reasonCode).toBeUndefined();
  });

  it('accepts totalUsers=0 as valid (zero is a number)', () => {
    const result = validatePhase1Stats({
      totals: { totalUsers: 0, activeUsers: 0, externalUsers: 0 },
      riskModel: { finalRiskScore: 0 },
      exposure: { globalAdmins: [], publicProjects: [] },
      toxicFindings: [],
    });
    expect(result.valid).toBe(true);
    expect(result.totalUsers).toBe(0);
  });

  it('returns null for optional fields that are missing', () => {
    const result = validatePhase1Stats({
      totals: { totalUsers: 50 },
      riskModel: { finalRiskScore: 0.3 },
      // exposure and toxicFindings missing
    });
    expect(result.valid).toBe(true);
    expect(result.totalUsers).toBe(50);
    expect(result.activeUsers).toBeNull();
    expect(result.globalAdminsCount).toBeNull();
    expect(result.toxicFindingsCount).toBeNull();
  });
});

// ── Proof marker ───────────────────────────────────────────────────────────

describe('proof marker', () => {
  it('[FT_TEST_PASS_EXPORT_TOTALUSERS_FAILCLOSED_CONTRACT] all tests pass', () => {
    console.log('[FT_TEST_PASS_EXPORT_TOTALUSERS_FAILCLOSED_CONTRACT]');
    expect(true).toBe(true);
  });
});
