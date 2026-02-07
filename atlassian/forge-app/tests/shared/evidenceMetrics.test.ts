/**
 * Unit tests for Enterprise Evidence Metrics utilities
 */

import { describe, it, expect } from 'vitest';
import { computeEvidenceAgeDays, computeFreshness, formatEvidenceAge, formatAgeDays } from '../../src/shared/evidenceMetrics';

describe('computeEvidenceAgeDays', () => {
  it('should return 0 for newly created snapshot (< 24h)', () => {
    const now = '2026-02-07T12:00:00.000Z';
    const created = '2026-02-07T11:00:00.000Z'; // 1 hour ago
    expect(computeEvidenceAgeDays(created, now)).toBe(0);
  });

  it('should return 0 for snapshot created exactly now', () => {
    const timestamp = '2026-02-07T12:00:00.000Z';
    expect(computeEvidenceAgeDays(timestamp, timestamp)).toBe(0);
  });

  it('should return 1 for snapshot created 25 hours ago', () => {
    const now = '2026-02-08T13:00:00.000Z';
    const created = '2026-02-07T12:00:00.000Z'; // 25 hours ago
    expect(computeEvidenceAgeDays(created, now)).toBe(1);
  });

  it('should return 1 for snapshot created 24 hours ago', () => {
    const now = '2026-02-08T12:00:00.000Z';
    const created = '2026-02-07T12:00:00.000Z'; // 24 hours ago
    expect(computeEvidenceAgeDays(created, now)).toBe(1);
  });

  it('should return 7 for snapshot created 7 days + 1 minute ago', () => {
    const now = '2026-02-14T12:01:00.000Z';
    const created = '2026-02-07T12:00:00.000Z'; // 7 days + 1 minute ago
    expect(computeEvidenceAgeDays(created, now)).toBe(7);
  });

  it('should return 30 for snapshot created 30 days ago', () => {
    const now = '2026-03-09T12:00:00.000Z';
    const created = '2026-02-07T12:00:00.000Z'; // 30 days ago
    expect(computeEvidenceAgeDays(created, now)).toBe(30);
  });

  it('should return null for invalid created date string (FAIL-CLOSED)', () => {
    const now = '2026-02-07T12:00:00.000Z';
    const invalidCreated = 'not-a-date';
    expect(computeEvidenceAgeDays(invalidCreated, now)).toBe(null);
  });

  it('should return null for invalid now date (FAIL-CLOSED)', () => {
    const created = '2026-02-07T12:00:00.000Z';
    const invalidNow = 'not-a-date';
    expect(computeEvidenceAgeDays(created, invalidNow)).toBe(null);
  });

  it('should return null for empty string (FAIL-CLOSED)', () => {
    const now = '2026-02-07T12:00:00.000Z';
    expect(computeEvidenceAgeDays('', now)).toBe(null);
  });

  it('should return null for whitespace-only string (FAIL-CLOSED)', () => {
    const now = '2026-02-07T12:00:00.000Z';
    expect(computeEvidenceAgeDays('   ', now)).toBe(null);
  });

  it('should return 0 when now is before created (future timestamp)', () => {
    const now = '2026-02-07T12:00:00.000Z';
    const futureCreated = '2026-02-08T12:00:00.000Z';
    expect(computeEvidenceAgeDays(futureCreated, now)).toBe(0);
  });

  it('should work with real Date.now() when nowUtcIso is omitted', () => {
    // This test verifies the function works without explicit nowUtcIso
    const recentPast = new Date(Date.now() - 1000 * 60 * 60).toISOString(); // 1 hour ago
    const age = computeEvidenceAgeDays(recentPast);
    expect(age).toBe(0); // Should be 0 since < 24h
  });
});

describe('computeFreshness', () => {
  it('should return "Fresh" for age 0 days', () => {
    expect(computeFreshness(0)).toBe('Fresh');
  });

  it('should return "Fresh" for age 1 day', () => {
    expect(computeFreshness(1)).toBe('Fresh');
  });

  it('should return "Stale" for age 2 days', () => {
    expect(computeFreshness(2)).toBe('Stale');
  });

  it('should return "Stale" for age 7 days', () => {
    expect(computeFreshness(7)).toBe('Stale');
  });

  it('should return "Out of date" for age 8 days', () => {
    expect(computeFreshness(8)).toBe('Out of date');
  });

  it('should return "Out of date" for age 30 days', () => {
    expect(computeFreshness(30)).toBe('Out of date');
  });

  it('should return "Out of date" for age 365 days', () => {
    expect(computeFreshness(365)).toBe('Out of date');
  });

  it('should return "Unknown" for null age (FAIL-CLOSED)', () => {
    expect(computeFreshness(null)).toBe('Unknown');
  });
});

describe('formatEvidenceAge', () => {
  it('should format 0 days correctly', () => {
    expect(formatEvidenceAge(0)).toBe('0 days');
  });

  it('should format 1 day correctly (singular)', () => {
    expect(formatEvidenceAge(1)).toBe('1 day');
  });

  it('should format 2 days correctly (plural)', () => {
    expect(formatEvidenceAge(2)).toBe('2 days');
  });

  it('should format 30 days correctly', () => {
    expect(formatEvidenceAge(30)).toBe('30 days');
  });

  it('should return "Unknown" for null (FAIL-CLOSED)', () => {
    expect(formatEvidenceAge(null)).toBe('Unknown');
  });
});

describe('formatAgeDays (deprecated)', () => {
  it('should format 0 days correctly', () => {
    expect(formatAgeDays(0)).toBe('0 days');
  });

  it('should format 1 day correctly (singular)', () => {
    expect(formatAgeDays(1)).toBe('1 day');
  });

  it('should format 2 days correctly (plural)', () => {
    expect(formatAgeDays(2)).toBe('2 days');
  });

  it('should format 30 days correctly', () => {
    expect(formatAgeDays(30)).toBe('30 days');
  });
});
