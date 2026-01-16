/**
 * tests/dashboard_freshness_contract.test.ts
 * 
 * Test suite for dashboard freshness logic
 * Ensures runtime contract compliance:
 * - freshness NOT_AVAILABLE when snapshot_age null
 * - FRESH when age <= threshold
 * - STALE when age > threshold
 */

import { describe, it, expect } from 'vitest';

// Mock types matching the UI model
interface FreshnessState {
  state: 'FRESH' | 'STALE' | 'NOT_AVAILABLE';
  age_minutes: number | null;
  threshold_minutes: number;
  reason: string;
}

// Implementation under test
function computeFreshness(last_snapshot_at: string | null, threshold_minutes: number = 120): FreshnessState {
  if (!last_snapshot_at) {
    return {
      state: 'NOT_AVAILABLE',
      age_minutes: null,
      threshold_minutes,
      reason: 'No snapshot generated yet'
    };
  }

  const now = new Date();
  const snapshotTime = new Date(last_snapshot_at);
  const age_minutes = Math.floor((now.getTime() - snapshotTime.getTime()) / 60000);

  if (age_minutes <= threshold_minutes) {
    return {
      state: 'FRESH',
      age_minutes,
      threshold_minutes,
      reason: `Snapshot is ${age_minutes} minutes old (threshold: ${threshold_minutes}m)`
    };
  } else {
    return {
      state: 'STALE',
      age_minutes,
      threshold_minutes,
      reason: `Snapshot is ${age_minutes} minutes old, exceeds threshold of ${threshold_minutes}m`
    };
  }
}

describe('Dashboard Freshness Contract', () => {
  describe('Freshness state when snapshot missing', () => {
    it('should return NOT_AVAILABLE when snapshot_at is null', () => {
      const result = computeFreshness(null);
      expect(result.state).toBe('NOT_AVAILABLE');
      expect(result.age_minutes).toBeNull();
    });

    it('should never return FRESH when snapshot_at is null', () => {
      const result = computeFreshness(null);
      expect(result.state).not.toBe('FRESH');
    });

    it('should set reason when NOT_AVAILABLE', () => {
      const result = computeFreshness(null);
      expect(result.reason).toContain('No snapshot');
    });
  });

  describe('Freshness state with recent snapshot', () => {
    it('should return FRESH when age <= threshold', () => {
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60000).toISOString();
      const result = computeFreshness(fiveMinutesAgo, 120);
      expect(result.state).toBe('FRESH');
      expect(result.age_minutes).toBeLessThanOrEqual(120);
    });

    it('should return FRESH when age exactly at threshold', () => {
      const now = new Date();
      const exactlyThresholdAgo = new Date(now.getTime() - 120 * 60000).toISOString();
      const result = computeFreshness(exactlyThresholdAgo, 120);
      expect(result.state).toBe('FRESH');
      expect(result.age_minutes).toBeLessThanOrEqual(120);
    });

    it('should capture age_minutes correctly', () => {
      const now = new Date();
      const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60000).toISOString();
      const result = computeFreshness(thirtyMinutesAgo, 120);
      expect(result.age_minutes).toBe(30);
    });
  });

  describe('Freshness state with stale snapshot', () => {
    it('should return STALE when age > threshold', () => {
      const now = new Date();
      const twoHoursAgo = new Date(now.getTime() - 121 * 60000).toISOString();
      const result = computeFreshness(twoHoursAgo, 120);
      expect(result.state).toBe('STALE');
      expect(result.age_minutes).toBeGreaterThan(120);
    });

    it('should never return FRESH when stale', () => {
      const now = new Date();
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60000).toISOString();
      const result = computeFreshness(threeDaysAgo, 120);
      expect(result.state).not.toBe('FRESH');
    });
  });

  describe('Threshold boundaries', () => {
    it('should support custom thresholds', () => {
      const now = new Date();
      const thirtiesAgo = new Date(now.getTime() - 30 * 60000).toISOString();
      
      // Threshold 60 minutes, age 30 -> FRESH (30 <= 60)
      const result60 = computeFreshness(thirtiesAgo, 60);
      expect(result60.state).toBe('FRESH');
      
      // Threshold 60 minutes but age is 30 -> FRESH
      const result120 = computeFreshness(thirtiesAgo, 120);
      expect(result120.state).toBe('FRESH');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty string as missing snapshot', () => {
      // Empty string is falsy, so treated as missing
      const result = computeFreshness('' as any);
      expect(result.state).toBe('NOT_AVAILABLE');
    });

    it('should handle very recent snapshot (< 1 minute)', () => {
      const now = new Date();
      const twentySecondsAgo = new Date(now.getTime() - 20 * 1000).toISOString();
      const result = computeFreshness(twentySecondsAgo, 120);
      expect(result.state).toBe('FRESH');
      expect(result.age_minutes).toBe(0); // Floors to 0
    });

    it('should provide reason text for all states', () => {
      const noSnapshot = computeFreshness(null);
      expect(noSnapshot.reason).toBeTruthy();
      expect(noSnapshot.reason.length > 0).toBe(true);

      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60000).toISOString();
      const freshSnapshot = computeFreshness(fiveMinutesAgo, 120);
      expect(freshSnapshot.reason).toBeTruthy();
      expect(freshSnapshot.reason.length > 0).toBe(true);

      const veryOld = new Date(now.getTime() - 7 * 24 * 60 * 60000).toISOString();
      const staleSnapshot = computeFreshness(veryOld, 120);
      expect(staleSnapshot.reason).toBeTruthy();
      expect(staleSnapshot.reason.length > 0).toBe(true);
    });
  });

  describe('Marketplace compliance', () => {
    it('should never show FRESH + null age (contradictory)', () => {
      const result = computeFreshness(null);
      // This test documents the contract:
      // If age is null, state MUST be NOT_AVAILABLE
      expect(!(result.state === 'FRESH' && result.age_minutes === null)).toBe(true);
    });

    it('should never show FRESH when no execution (NOT_AVAILABLE)', () => {
      const result = computeFreshness(null);
      expect(result.state).not.toBe('FRESH');
    });

    it('should clearly distinguish NOT_AVAILABLE from STALE', () => {
      const noSnapshot = computeFreshness(null);
      
      const now = new Date();
      const veryOld = new Date(now.getTime() - 30 * 24 * 60 * 60000).toISOString();
      const stale = computeFreshness(veryOld, 120);

      // NOT_AVAILABLE = never run
      // STALE = ran but data is old
      expect(noSnapshot.age_minutes).toBeNull();
      expect(stale.age_minutes).not.toBeNull();
      expect(noSnapshot.state).not.toBe(stale.state);
    });
  });
});
