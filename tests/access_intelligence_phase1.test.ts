/**
 * Unit Tests - Access Intelligence Engine PHASE 1
 * 
 * Tests:
 * - Deterministic snapshot hash
 * - Rule ordering stability
 * - Risk score math verification
 * - Canonical JSON key order
 * - Fail-closed behavior on API errors
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  AccessSurfaceSnapshot,
  ToxicFinding,
} from '../access-intelligence/types';
import {
  canonicalStringify,
  computeCanonicalHash,
} from '../export/exportPack';
import {
  calculateRiskScore,
  RISK_WEIGHTS,
} from '../access-intelligence/risk';
import {
  ToxicRulesEngine,
  evaluateToxicRules,
} from '../access-intelligence/rules';

describe('Access Intelligence Engine - Unit Tests', () => {
  let mockSnapshot: AccessSurfaceSnapshot;

  beforeEach(() => {
    mockSnapshot = {
      schemaVersion: '1.0',
      buildShaShort: 'abc123',
      buildUtc: '2026-02-12T10:00:00Z',
      siteId: 'test-site',
      privilegeContext: 'read-only',
      ruleSetVersion: '1.0',
      totals: {
        totalUsers: 100,
        activeUsers: 95,
        externalUsers: 15,
      },
      exposure: {
        globalAdmins: ['admin1', 'admin2', 'admin3'],
        projectAdmins: {
          'PROJ1': ['admin1', 'padmin1'],
          'PROJ2': ['admin2', 'padmin2'],
        },
        publicProjects: ['PROJ1', 'PROJ2'],
        externalElevatedUsers: ['ext1'],
      },
      toxicFindings: [],
      riskModel: {
        adminDensity: 3.0,
        externalExposureScore: 1,
        toxicHitCount: 0,
        publicProjectCount: 2,
        finalRiskScore: 0,
      },
      canonicalHash: '',
    };
  });

  describe('Deterministic Snapshot Hash', () => {
    it('should compute identical hash for same snapshot', () => {
      const { canonicalHash, ...snapshotWithoutHash } = mockSnapshot;
      const hash1 = computeCanonicalHash(snapshotWithoutHash as any);
      const hash2 = computeCanonicalHash(snapshotWithoutHash as any);

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/); // SHA-256 format
    });

    it('should produce different hash for different snapshot data', () => {
      const { canonicalHash: _, ...snap1 } = mockSnapshot;
      const { canonicalHash: __, ...snap2 } = {
        ...mockSnapshot,
        totals: { ...mockSnapshot.totals, totalUsers: 101 },
      };

      const hash1 = computeCanonicalHash(snap1 as any);
      const hash2 = computeCanonicalHash(snap2 as any);

      expect(hash1).not.toBe(hash2);
    });

    it('should be consistent across multiple runs', () => {
      const { canonicalHash, ...snapWithoutHash } = mockSnapshot;
      const hashes = Array.from({ length: 5 }, () =>
        computeCanonicalHash(snapWithoutHash as any)
      );

      const allIdentical = hashes.every(h => h === hashes[0]);
      expect(allIdentical).toBe(true);
    });
  });

  describe('Canonical JSON Serialization', () => {
    it('should produce sorted keys', () => {
      const obj = { z: 1, a: 2, m: 3 };
      const serialized = canonicalStringify(obj);
      const parsedKeys = Object.keys(JSON.parse(serialized));

      expect(parsedKeys).toEqual(['a', 'm', 'z']);
    });

    it('should recursively sort nested keys', () => {
      const obj = {
        z: { y: 1, a: 2 },
        a: { z: 3, b: 4 },
      };
      const serialized = canonicalStringify(obj);
      const parsed = JSON.parse(serialized);

      const outerKeys = Object.keys(parsed);
      expect(outerKeys).toEqual(['a', 'z']);

      const innerAKeys = Object.keys(parsed.a);
      expect(innerAKeys).toEqual(['b', 'z']);

      const innerZKeys = Object.keys(parsed.z);
      expect(innerZKeys).toEqual(['a', 'y']);
    });

    it('should maintain array order (not sort)', () => {
      const obj = { arr: ['z', 'a', 'm'] };
      const serialized = canonicalStringify(obj);
      const parsed = JSON.parse(serialized);

      expect(parsed.arr).toEqual(['z', 'a', 'm']);
    });

    it('should be deterministic across multiple calls', () => {
      const obj = mockSnapshot;
      const s1 = canonicalStringify(obj);
      const s2 = canonicalStringify(obj);

      expect(s1).toBe(s2);
    });
  });

  describe('Risk Score Calculation', () => {
    it('should calculate correct admin density component', () => {
      // 3 admins / 100 users = 3%
      const calc = calculateRiskScore(mockSnapshot);

      expect(calc.adminDensity).toBe(3);
      expect(calc.adminDensityScore).toBe(3 * RISK_WEIGHTS.ADMIN_DENSITY);
    });

    it('should calculate correct external exposure component', () => {
      // 1 external elevated user
      const calc = calculateRiskScore(mockSnapshot);

      expect(calc.externalExposureScore).toBe(1);
      expect(calc.externalExposureScoreComponent).toBe(
        1 * RISK_WEIGHTS.EXTERNAL_EXPOSURE
      );
    });

    it('should calculate correct public projects component', () => {
      // 2 public projects
      const calc = calculateRiskScore(mockSnapshot);

      expect(calc.publicProjectCount).toBe(2);
      expect(calc.publicProjectScore).toBe(
        2 * RISK_WEIGHTS.PUBLIC_PROJECTS
      );
    });

    it('should sum components into final score', () => {
      const calc = calculateRiskScore(mockSnapshot);

      const expected =
        calc.adminDensityScore +
        calc.externalExposureScoreComponent +
        calc.toxicHitScore +
        calc.publicProjectScore;

      expect(calc.finalRiskScore).toBe(expected);
    });

    it('should categorize risks correctly', () => {
      // Low risk (< 20)
      let calc = calculateRiskScore({
        ...mockSnapshot,
        exposure: {
          ...mockSnapshot.exposure,
          globalAdmins: ['admin1'],
          externalElevatedUsers: [],
          publicProjects: [],
        },
      });
      expect(calc.riskTier).toBe('low');

      // Medium risk (21-50)
      calc = calculateRiskScore({
        ...mockSnapshot,
        exposure: {
          ...mockSnapshot.exposure,
          globalAdmins: Array.from({ length: 10 }, (_, i) => `admin${i}`),
          externalElevatedUsers: [],
          publicProjects: ['PROJ1', 'PROJ2', 'PROJ3', 'PROJ4', 'PROJ5'],
        },
      });
      expect(calc.riskTier).toBe('medium');

      // High risk (> 50)
      calc = calculateRiskScore({
        ...mockSnapshot,
        exposure: {
          ...mockSnapshot.exposure,
          globalAdmins: Array.from({ length: 30 }, (_, i) => `admin${i}`),
          externalElevatedUsers: Array.from({ length: 10 }, (_, i) => `ext${i}`),
          publicProjects: Array.from({ length: 20 }, (_, i) => `proj${i}`),
        },
      });
      expect(calc.riskTier).toBe('high');
    });
  });

  describe('Toxic Rules Engine', () => {
    it('should maintain fixed rule order', () => {
      const engine = new ToxicRulesEngine();
      // Call evaluateAll multiple times and verify ordering is consistent
      const findings1 = engine.evaluateAll(mockSnapshot);
      const findings2 = engine.evaluateAll(mockSnapshot);

      expect(findings1.map(f => f.ruleId)).toEqual(
        findings2.map(f => f.ruleId)
      );
    });

    it('should detect external global admin rule', () => {
      const snapshot = {
        ...mockSnapshot,
        exposure: {
          ...mockSnapshot.exposure,
          globalAdmins: ['admin1', 'ext_admin'],
          externalElevatedUsers: ['ext_admin'],
        },
      };

      const findings = evaluateToxicRules(snapshot);
      const externalAdminFinding = findings.find(
        f => f.ruleId === 'RULE_EXTERNAL_GLOBAL_ADMIN'
      );

      expect(externalAdminFinding).toBeDefined();
      expect(externalAdminFinding?.severity).toBe('high');
      expect(externalAdminFinding?.impactedEntities).toContain('ext_admin');
    });

    it('should detect public project browse rule', () => {
      const snapshot = {
        ...mockSnapshot,
        exposure: {
          ...mockSnapshot.exposure,
          publicProjects: ['PUBLIC1', 'PUBLIC2'],
        },
      };

      const findings = evaluateToxicRules(snapshot);
      const publicProjectFinding = findings.find(
        f => f.ruleId === 'RULE_PUBLIC_PROJECT_BROWSE'
      );

      expect(publicProjectFinding).toBeDefined();
      expect(publicProjectFinding?.severity).toBe('medium');
      expect(publicProjectFinding?.impactedEntities.length).toBe(2);
    });

    it('should detect admin density rule when > 5%', () => {
      const snapshot = {
        ...mockSnapshot,
        totals: { ...mockSnapshot.totals, totalUsers: 100 },
        exposure: {
          ...mockSnapshot.exposure,
          globalAdmins: Array.from({ length: 6 }, (_, i) => `admin${i}`),
        },
      };

      const findings = evaluateToxicRules(snapshot);
      const densityFinding = findings.find(
        f => f.ruleId === 'RULE_ADMIN_DENSITY'
      );

      expect(densityFinding).toBeDefined();
      expect(densityFinding?.severity).toBe('medium');
    });

    it('should not detect admin density rule when <= 5%', () => {
      const snapshot = {
        ...mockSnapshot,
        totals: { ...mockSnapshot.totals, totalUsers: 100 },
        exposure: {
          ...mockSnapshot.exposure,
          globalAdmins: ['admin1', 'admin2', 'admin3', 'admin4', 'admin5'],
        },
      };

      const findings = evaluateToxicRules(snapshot);
      const densityFinding = findings.find(
        f => f.ruleId === 'RULE_ADMIN_DENSITY'
      );

      expect(densityFinding).toBeUndefined();
    });
  });

  describe('Fail-Closed Behavior', () => {
    it('should handle null critical field gracefully', () => {
      // Test that missing required fields are caught
      const invalidSnapshot = { ...mockSnapshot };
      // @ts-ignore
      delete invalidSnapshot.totals;

      // This should be caught by TypeScript or runtime validation
      expect(() => {
        calculateRiskScore(invalidSnapshot as any);
      }).toThrow();
    });

    it('should compute hash with embedded hash field', () => {
      mockSnapshot.canonicalHash = 'dummy';
      const { canonicalHash, ...snapWithout } = mockSnapshot;
      const hash = computeCanonicalHash(snapWithout as any);

      // Hash should not include the canonicalHash field itself
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('Integration', () => {
    it('should produce consistent full export flow', () => {
      // Simulate the full export flow
      const { canonicalHash: _, ...snap1 } = mockSnapshot;
      snap1.canonicalHash = computeCanonicalHash(snap1 as any);

      const { canonicalHash: __, ...snap2 } = {
        ...snap1,
        totalUsers: snap1.totals.totalUsers,
      };
      snap2.canonicalHash = computeCanonicalHash(snap2 as any);

      expect(snap1.canonicalHash).toBe(snap2.canonicalHash);
    });

    it('should calculate full risk model', () => {
      const snapshot = {
        ...mockSnapshot,
        exposure: {
          ...mockSnapshot.exposure,
          globalAdmins: Array.from({ length: 8 }, (_, i) => `admin${i}`),
          externalElevatedUsers: Array.from({ length: 3 }, (_, i) => `ext${i}`),
          publicProjects: Array.from({ length: 5 }, (_, i) => `proj${i}`),
        },
        toxicFindings: [
          {
            ruleId: 'TEST_RULE',
            severity: 'high',
            impactedEntities: ['entity1'],
            explanation: 'Test finding',
          },
        ],
      };

      const findings = evaluateToxicRules(snapshot);
      const riskCalc = calculateRiskScore(snapshot);

      expect(findings.length).toBeGreaterThan(0);
      expect(riskCalc.finalRiskScore).toBeGreaterThan(0);
      expect(riskCalc.riskTier).toBeDefined();
    });
  });
});
