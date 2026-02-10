/**
 * L2 FIX: Unit tests for status formatter logic
 * 
 * Tests the fixes for:
 * - "Snapshot Age undefined minutes" → "N/A"
 * - "Expected Schedule Interval UNKNOWN" → "N/A (unscheduled)"
 * - "Data Freshness FRESH based on null min" → "UNKNOWN"
 */

import { describe, it, expect } from 'vitest';
import { formatScheduleInterval, formatSnapshotAge, computeFreshness } from './statusFormatter';

// ============================================================================
// TESTS
// ============================================================================

describe('L2: Status Formatter Fixes', () => {
  describe('formatScheduleInterval', () => {
    it('should format null as "N/A (unscheduled)"', () => {
      expect(formatScheduleInterval(null)).toBe('N/A (unscheduled)');
    });

    it('should format 0 as "0 min"', () => {
      expect(formatScheduleInterval(0)).toBe('0 min');
    });

    it('should format positive number', () => {
      expect(formatScheduleInterval(15)).toBe('15 min');
      expect(formatScheduleInterval(60)).toBe('60 min');
    });
  });

  describe('formatSnapshotAge', () => {
    it('should format null as "N/A" (not "No snapshots yet")', () => {
      expect(formatSnapshotAge(null)).toBe('N/A');
    });

    it('should never return "undefined minutes"', () => {
      const result = formatSnapshotAge(undefined as any);
      expect(result).not.toContain('undefined');
    });

    it('should format 0 as "0 min"', () => {
      expect(formatSnapshotAge(0)).toBe('0 min');
    });

    it('should format positive number', () => {
      expect(formatSnapshotAge(5)).toBe('5 min');
      expect(formatSnapshotAge(120)).toBe('120 min');
    });
  });

  describe('formatFreshness', () => {
    it('should return UNKNOWN if scheduleIntervalMinutes is null', () => {
      // This is the critical L2 fix: if schedule is unknown, freshness must be unknown
      expect(computeFreshness(null, false, 1)).toBe('UNKNOWN');
      expect(computeFreshness(null, true, 1)).toBe('UNKNOWN');
      expect(computeFreshness(null, null, 1)).toBe('UNKNOWN');
    });

    it('should return UNKNOWN if isStale is null (but schedule is set)', () => {
      expect(computeFreshness(15, null, 1)).toBe('UNKNOWN');
    });

    it('should return STALE if isStale is true', () => {
      expect(computeFreshness(15, true, 1)).toBe('STALE');
    });

    it('should return FRESH if isStale is false', () => {
      expect(computeFreshness(15, false, 1)).toBe('FRESH');
    });

    it('should handle edge case: schedule=0, fresh=true', () => {
      expect(computeFreshness(0, false, 1)).toBe('FRESH');
    });

    it('should return UNKNOWN if snapshotCount is 0 (no data yet)', () => {
      expect(computeFreshness(15, false, 0)).toBe('UNKNOWN');
      expect(computeFreshness(15, true, 0)).toBe('UNKNOWN');
    });
  });
});
