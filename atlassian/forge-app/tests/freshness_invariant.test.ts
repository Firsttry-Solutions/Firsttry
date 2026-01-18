/**
 * tests/freshness_invariant.test.ts
 * 
 * PHASE 5 BACKBONE FIX: Freshness Invariant Tests
 * 
 * Enforce: FRESH status MUST have a valid timestamp (never null/undefined)
 * - If lastSnapshotAtISO is null/undefined => freshness must be "Never", not "Fresh"
 * - If ageMinutes is null => freshness must be "Never", not "Fresh"
 * - ageMinutes must be number or null (never undefined)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { computeGovernanceViewModel, GovernanceRuntimeState, type RuntimeSignals } from '../src/gadget-ui/src/truthModel';

describe('Freshness Invariant: FRESH only with valid timestamp', () => {
  let baseSignals: RuntimeSignals;

  beforeEach(() => {
    baseSignals = {
      tenantIdentityStatus: "OK",
      backendStatus: "OK",
      scheduleStatus: "CONFIGURED",
      lastSuccessfulRunISO: null,
      snapshot: null,
      snapshotAgeMinutes: null,
      storageStatus: "EMPTY",
      storageRecordCount: 0,
      exportSubsystemStatus: "READY",
      exportLastAttemptISO: null,
      limitedPermissions: false,
      probeErrors: [],
      nowISO: new Date().toISOString(),
      expectedScheduleIntervalMinutes: 1440,
      stalenessThresholdMinutes: 240,
      snapshotCountRetained: 0,
      checksCompletedLifetime: 0,
      failures7d: 0,
      skippedChecks7d: 0,
      generatedAtISO: new Date().toISOString(),
      lastAttemptISO: null,
      permissionsVisibility: "OK"
    };
  });

  describe('When snapshot is null', () => {
    it('should return "Never" for freshness, not "Fresh"', () => {
      const signals = { ...baseSignals, snapshot: null };
      const vm = computeGovernanceViewModel(signals);
      
      expect(vm.dataFreshnessLabel).toBe("Never");
      expect(vm.dataFreshnessLabel).not.toBe("Fresh");
    });

    it('should have null snapshotAgeMinutes', () => {
      const signals = { ...baseSignals, snapshot: null };
      const vm = computeGovernanceViewModel(signals);
      
      expect(vm.snapshotAgeMinutes).toBeNull();
      expect(vm.snapshotAgeMinutes).not.toBeUndefined();
    });

    it('should NOT violate invariant (freshness=Never, age=null)', () => {
      const signals = { ...baseSignals, snapshot: null };
      const vm = computeGovernanceViewModel(signals);
      
      // Invariant: if age is null, freshness cannot be "Fresh"
      if (vm.snapshotAgeMinutes === null) {
        expect(vm.dataFreshnessLabel).not.toBe("Fresh");
      }
    });
  });

  describe('When snapshot exists but age is null (edge case)', () => {
    it('should return "Never" freshness if age cannot be computed', () => {
      const now = new Date();
      const signals = {
        ...baseSignals,
        snapshot: {
          generatedAtISO: now.toISOString(),
          snapshotId: "test-snap-1",
          checks: [],
          evidenceCount: 0,
          mode: "scheduled" as const
        },
        snapshotAgeMinutes: null  // Age explicitly null
      };
      const vm = computeGovernanceViewModel(signals);
      
      // If age is null, freshness should be "Never" not "Fresh"
      if (vm.snapshotAgeMinutes === null) {
        expect(vm.dataFreshnessLabel).toBe("Never");
      }
    });
  });

  describe('When snapshot exists and age is valid', () => {
    it('should return "Fresh" only when age <= 25% of threshold', () => {
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
      const signals = {
        ...baseSignals,
        snapshotCountRetained: 1, // CRITICAL: match snapshot presence
        stalenessThresholdMinutes: 240,  // 4 hours
        snapshotCountRetained: 1,
        snapshot: {
          generatedAtISO: fiveMinutesAgo.toISOString(),
          snapshotId: "test-snap-fresh",
          checks: [],
          evidenceCount: 0,
          mode: "scheduled" as const
        },
        nowISO: now.toISOString()
      };
      const vm = computeGovernanceViewModel(signals);
      
      expect(vm.dataFreshnessLabel).toBe("Fresh");
      expect(vm.snapshotAgeMinutes).not.toBeNull();
      expect(vm.snapshotAgeMinutes).toBeLessThanOrEqual(60); // 5 min
    });

    it('should return "Current" when age is 25-75% of threshold', () => {
      const now = new Date();
      const ninetyMinutesAgo = new Date(now.getTime() - 90 * 60 * 1000);
      const signals = {
        ...baseSignals,
        stalenessThresholdMinutes: 240,  // 4 hours
        snapshotCountRetained: 1,
        snapshot: {
          generatedAtISO: ninetyMinutesAgo.toISOString(),
          snapshotId: "test-snap-current",
          checks: [],
          evidenceCount: 0,
          mode: "scheduled" as const
        },
        nowISO: now.toISOString()
      };
      const vm = computeGovernanceViewModel(signals);
      
      expect(vm.dataFreshnessLabel).toBe("Current");
      expect(vm.snapshotAgeMinutes).not.toBeNull();
      expect(vm.snapshotAgeMinutes).toBeGreaterThanOrEqual(60);
    });

    it('should return "Stale" when age > threshold', () => {
      const now = new Date();
      const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
      const signals = {
        ...baseSignals,
        stalenessThresholdMinutes: 240,  // 4 hours
        snapshotCountRetained: 1,
        snapshot: {
          generatedAtISO: fiveDaysAgo.toISOString(),
          snapshotId: "test-snap-stale",
          checks: [],
          evidenceCount: 0,
          mode: "scheduled" as const
        },
        nowISO: now.toISOString()
      };
      const vm = computeGovernanceViewModel(signals);
      
      expect(vm.dataFreshnessLabel).toBe("Stale");
      expect(vm.snapshotAgeMinutes).not.toBeNull();
      expect(vm.snapshotAgeMinutes).toBeGreaterThan(240);
    });
  });

  describe('Contract: age must be number or null (never undefined)', () => {
    it('should never set snapshotAgeMinutes to undefined', () => {
      const signals = { ...baseSignals, snapshot: null };
      const vm = computeGovernanceViewModel(signals);
      
      expect(typeof vm.snapshotAgeMinutes === 'number' || vm.snapshotAgeMinutes === null).toBe(true);
      expect(vm.snapshotAgeMinutes === undefined).toBe(false);
    });

    it('should compute valid age when snapshot exists', () => {
      const now = new Date();
      const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
      const signals = {
        ...baseSignals,
        snapshotCountRetained: 1,
        snapshot: {
          generatedAtISO: tenMinutesAgo.toISOString(),
          snapshotId: "test-snap-age",
          checks: [],
          evidenceCount: 0,
          mode: "scheduled" as const
        },
        nowISO: now.toISOString()
      };
      const vm = computeGovernanceViewModel(signals);
      
      expect(typeof vm.snapshotAgeMinutes).toBe('number');
      expect(vm.snapshotAgeMinutes).toBeGreaterThanOrEqual(9);
      expect(vm.snapshotAgeMinutes).toBeLessThanOrEqual(11);
    });
  });

  describe('Invariant tests (should FAIL if violated)', () => {
    it('SHOULD FAIL if freshness=Fresh and age=null', () => {
      // This test is a canary: if it passes, the code is broken
      // We construct an invalid state and verify it's impossible
      const signals = { ...baseSignals, snapshot: null };
      const vm = computeGovernanceViewModel(signals);
      
      // This assertion should ALWAYS pass
      // If it fails, the invariant is violated and we have a bug
      const violatesInvariant = (vm.dataFreshnessLabel === "Fresh" && vm.snapshotAgeMinutes === null);
      expect(violatesInvariant).toBe(false);
    });

    it('SHOULD FAIL if freshness=Fresh and age=undefined', () => {
      const signals = { ...baseSignals, snapshot: null };
      const vm = computeGovernanceViewModel(signals);
      
      const violatesInvariant = (vm.dataFreshnessLabel === "Fresh" && vm.snapshotAgeMinutes === undefined);
      expect(violatesInvariant).toBe(false);
    });

    it('SHOULD FAIL if age is undefined (must be number or null)', () => {
      const signals = { ...baseSignals, snapshot: null };
      const vm = computeGovernanceViewModel(signals);
      
      expect(vm.snapshotAgeMinutes === undefined).toBe(false);
    });
  });

  describe('Freshness label consistency', () => {
    it('should map age ranges to consistent labels', () => {
      const testCases = [
        { ageMinutes: 0, expectedLabel: "Fresh", threshold: 240 },
        { ageMinutes: 30, expectedLabel: "Fresh", threshold: 240 },  // 30 <= 60 (25% of 240)
        { ageMinutes: 50, expectedLabel: "Fresh", threshold: 240 },  // 50 <= 60 (25% of 240)
        { ageMinutes: 70, expectedLabel: "Current", threshold: 240 }, // 70 > 60 but <= 180
        { ageMinutes: 150, expectedLabel: "Current", threshold: 240 }, // 150 <= 180 (75% of 240)
        { ageMinutes: 200, expectedLabel: "Aging", threshold: 240 },  // 200 > 180 but <= 240
        { ageMinutes: 300, expectedLabel: "Stale", threshold: 240 },  // 300 > 240
      ];

      for (const tc of testCases) {
        const now = new Date();
        const snapshotTime = new Date(now.getTime() - tc.ageMinutes * 60 * 1000);
        const signals = {
          ...baseSignals,
          stalenessThresholdMinutes: tc.threshold,
          snapshotCountRetained: 1,
          snapshot: {
            generatedAtISO: snapshotTime.toISOString(),
            snapshotId: `test-${tc.ageMinutes}`,
            checks: [],
            evidenceCount: 0,
            mode: "scheduled" as const
          },
          nowISO: now.toISOString()
        };
        const vm = computeGovernanceViewModel(signals);
        
        expect(vm.dataFreshnessLabel).toBe(tc.expectedLabel);
      }
    });
  });
});
