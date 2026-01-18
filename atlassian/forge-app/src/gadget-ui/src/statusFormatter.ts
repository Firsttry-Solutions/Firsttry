/**
 * L2: Status Formatter Module
 * 
 * Pure functions for formatting status display fields with mandatory null safety.
 * 
 * REQUIRED INVARIANTS:
 * 1. If expectedScheduleIntervalMinutes === null → freshness MUST be UNKNOWN (never FRESH/STALE)
 * 2. If snapshot age missing/null → display N/A (never "undefined minutes")
 * 3. If snapshotCountRetained === 0 → freshness must not be FRESH
 */

/**
 * formatSnapshotAge: Display age in minutes, or N/A if null
 * 
 * @param ageMinutes The snapshot age in minutes, or null if unknown
 * @returns Formatted string like "5 min" or "N/A"
 */
export function formatSnapshotAge(ageMinutes: number | null | undefined): string {
  if (ageMinutes === null || ageMinutes === undefined) {
    return 'N/A';
  }
  return `${ageMinutes} min`;
}

/**
 * formatScheduleInterval: Display schedule interval or "N/A (unscheduled)"
 * 
 * @param intervalMinutes The expected schedule interval in minutes, or null if unscheduled
 * @returns Formatted string like "60 min" or "N/A (unscheduled)"
 */
export function formatScheduleInterval(intervalMinutes: number | null | undefined): string {
  if (intervalMinutes === null || intervalMinutes === undefined) {
    return 'N/A (unscheduled)';
  }
  return `${intervalMinutes} min`;
}

/**
 * computeFreshness: Determine freshness label with mandatory null safety
 * 
 * CRITICAL: If schedule is null, freshness MUST be UNKNOWN.
 * This prevents claims of "FRESH" when we don't know if a schedule exists.
 * 
 * @param intervalMinutes The expected schedule interval, or null if unscheduled/unknown
 * @param isStale Whether the data is stale, or null if unknown
 * @param snapshotCount Number of retained snapshots (0 means no data yet)
 * @returns "FRESH" | "STALE" | "UNKNOWN"
 */
export function computeFreshness(
  intervalMinutes: number | null | undefined,
  isStale: boolean | null | undefined,
  snapshotCount: number = 0
): 'FRESH' | 'STALE' | 'UNKNOWN' {
  // INVARIANT 1: If schedule is null/undefined, freshness is UNKNOWN
  if (intervalMinutes === null || intervalMinutes === undefined) {
    return 'UNKNOWN';
  }

  // INVARIANT 3: If no snapshots, freshness is UNKNOWN (not FRESH)
  if (snapshotCount === 0) {
    return 'UNKNOWN';
  }

  // INVARIANT 2: If isStale is null/undefined, freshness is UNKNOWN
  if (isStale === null || isStale === undefined) {
    return 'UNKNOWN';
  }

  // All conditions met: return actual freshness
  return isStale ? 'STALE' : 'FRESH';
}
