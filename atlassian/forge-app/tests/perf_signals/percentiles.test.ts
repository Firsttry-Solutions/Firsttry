/**
 * PERCENTILE COMPUTATION TESTS
 * 
 * Verify p50, p95, max correctness.
 */

import { describe, it, expect } from 'vitest';
import { computePercentile, computeLatencySummary } from '../../src/core/perf_signals/percentiles';

describe('Percentile Computation', () => {
  describe('computePercentile', () => {
    it('returns null for empty array', () => {
      expect(computePercentile([], 50)).toBeNull();
    });

    it('computes p0 (min)', () => {
      const data = [10, 20, 30, 40, 50];
      expect(computePercentile(data, 0)).toBe(10);
    });

    it('computes p100 (max)', () => {
      const data = [10, 20, 30, 40, 50];
      expect(computePercentile(data, 100)).toBe(50);
    });

    it('computes p50 (median) for odd-length array', () => {
      const data = [10, 20, 30, 40, 50];
      const result = computePercentile(data, 50);
      expect(result).toBe(30); // exactly in middle
    });

    it('computes p50 (median) for even-length array', () => {
      const data = [10, 20, 30, 40];
      const result = computePercentile(data, 50);
      expect(result).toBe(25); // interpolated between 20 and 30
    });

    it('computes p95 correctly', () => {
      const data = Array.from({ length: 100 }, (_, i) => i + 1); // 1..100
      const result = computePercentile(data, 95);
      // p95 should be near 95
      expect(result).toBeCloseTo(95, 0);
    });

    it('returns null for invalid percentile', () => {
      expect(computePercentile([1, 2, 3], -1)).toBeNull();
      expect(computePercentile([1, 2, 3], 101)).toBeNull();
    });
  });

  describe('computeLatencySummary', () => {
    it('returns zeros for empty array', () => {
      const result = computeLatencySummary([]);
      expect(result.count).toBe(0);
      expect(result.p50ms).toBeNull();
      expect(result.p95ms).toBeNull();
      expect(result.maxMs).toBeNull();
    });

    it('computes all metrics from valid data', () => {
      const data = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
      const result = computeLatencySummary(data);
      expect(result.count).toBe(10);
      expect(result.p50ms).not.toBeNull();
      expect(result.p95ms).not.toBeNull();
      expect(result.maxMs).toBe(100);
    });

    it('handles single value', () => {
      const result = computeLatencySummary([42]);
      expect(result.count).toBe(1);
      expect(result.p50ms).toBe(42);
      expect(result.p95ms).toBe(42);
      expect(result.maxMs).toBe(42);
    });

    it('handles unsorted input', () => {
      const data = [100, 50, 75, 25, 10];
      const result = computeLatencySummary(data);
      expect(result.maxMs).toBe(100);
      expect(result.p50ms).not.toBeNull();
    });

    it('p95 >= p50', () => {
      const data = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
      const result = computeLatencySummary(data);
      expect(result.p95ms).toBeGreaterThanOrEqual(result.p50ms!);
    });

    it('maxMs >= p95', () => {
      const data = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
      const result = computeLatencySummary(data);
      expect(result.maxMs).toBeGreaterThanOrEqual(result.p95ms!);
    });
  });
});
