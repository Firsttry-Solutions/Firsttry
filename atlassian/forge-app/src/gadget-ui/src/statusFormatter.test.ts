/**
 * L2 FIX: Unit tests for status formatter logic
 * 
 * Tests the fixes for:
 * - "Snapshot Age undefined minutes" → "N/A"
 * - "Expected Schedule Interval UNKNOWN" → "N/A (unscheduled)"
 * - "Data Freshness FRESH based on null min" → "UNKNOWN"
 */

import { describe, it, expect } from 'vitest';

// ============================================================================
// STATUS FORMATTER FUNCTIONS (extracted from main.ts for testing)
// ============================================================================

function formatScheduleInterval(intervalMinutes: number | null): string {
  return intervalMinutes !== null 
    ? intervalMinutes + ' min'
    : 'N/A (unscheduled)';
}

function formatSnapshotAge(ageMinutes: number | null): string {
  return ageMinutes !== null 
    ? ageMinutes + ' min'
    : 'N/A';
}

function formatFreshness(
  isStale: boolean | null,
  scheduleIntervalMinutes: number | null
): string {
  // FIX L2: If schedule interval is null, freshness must be UNKNOWN
  if (scheduleIntervalMinutes === null) {
    return 'UNKNOWN';
  }
  return isStale === null ? 'UNKNOWN' : (isStale ? 'STALE' : 'FRESH');
}

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
      expect(formatFreshness(false, null)).toBe('UNKNOWN');
      expect(formatFreshness(true, null)).toBe('UNKNOWN');
      expect(formatFreshness(null, null)).toBe('UNKNOWN');
    });

    it('should return UNKNOWN if isStale is null (but schedule is set)', () => {
      expect(formatFreshness(null, 15)).toBe('UNKNOWN');
    });

    it('should return STALE if isStale is true', () => {
      expect(formatFreshness(true, 15)).toBe('STALE');
    });

    it('should return FRESH if isStale is false', () => {
      expect(formatFreshness(false, 15)).toBe('FRESH');
    });

    it('should handle edge case: schedule=0, fresh=true', () => {
      expect(formatFreshness(false, 0)).toBe('FRESH');
    });
  });
});
