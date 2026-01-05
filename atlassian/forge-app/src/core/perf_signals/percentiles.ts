/**
 * PERCENTILE COMPUTATION
 * 
 * Compute p50, p95, and max from a sorted array of latencies (ms).
 * Used for LatencySummary.
 */

/**
 * Compute percentile from sorted array.
 * @param sorted - array of numbers sorted in ascending order
 * @param percentile - 0-100
 * @returns interpolated percentile value, or null if empty
 */
export function computePercentile(sorted: number[], percentile: number): number | null {
  if (sorted.length === 0) {
    return null;
  }

  if (percentile < 0 || percentile > 100) {
    return null;
  }

  if (percentile === 0) {
    return sorted[0];
  }

  if (percentile === 100) {
    return sorted[sorted.length - 1];
  }

  // Linear interpolation method (NIST recommended)
  const idx = (percentile / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  const weight = idx - lower;

  if (lower === upper) {
    return sorted[lower];
  }

  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

/**
 * Compute p50, p95, and max from duration samples.
 */
export function computeLatencySummary(durations: number[]) {
  if (!durations || durations.length === 0) {
    return {
      count: 0,
      p50ms: null,
      p95ms: null,
      maxMs: null,
    };
  }

  // Sort in ascending order
  const sorted = [...durations].sort((a, b) => a - b);

  return {
    count: durations.length,
    p50ms: computePercentile(sorted, 50),
    p95ms: computePercentile(sorted, 95),
    maxMs: sorted[sorted.length - 1],
  };
}
