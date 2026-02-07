/**
 * Enterprise Evidence Metrics Utilities
 * 
 * Canonical functions for evidence age and freshness calculation.
 * These functions ensure consistent, enterprise-grade calculation across the UI.
 */

/**
 * Compute evidence age in days from created timestamp.
 * 
 * Enterprise requirements:
 * - UTC only (no timezone ambiguity)
 * - Floor to whole days (user-friendly)
 * - Return 0 only when < 24h difference
 * - Safe ISO parsing with fallback
 * 
 * @param createdAtUtcIso - ISO 8601 UTC timestamp (e.g., "2026-02-07T10:00:00.000Z")
 * @param nowUtcIso - Optional current time (defaults to Date.now() for testing)
 * @returns Age in days (floored to whole number)
 */
export function computeEvidenceAgeDays(createdAtUtcIso: string, nowUtcIso?: string): number {
  try {
    const createdDate = new Date(createdAtUtcIso);
    const nowDate = nowUtcIso ? new Date(nowUtcIso) : new Date();
    
    // Validate dates
    if (isNaN(createdDate.getTime()) || isNaN(nowDate.getTime())) {
      // Invalid date - return 0 as safe fallback
      return 0;
    }
    
    // Compute difference in milliseconds
    const diffMs = nowDate.getTime() - createdDate.getTime();
    
    // Convert to days and floor
    // 1 day = 86400000 milliseconds
    const ageDays = Math.floor(diffMs / 86400000);
    
    // Ensure non-negative (in case nowDate < createdDate)
    return Math.max(0, ageDays);
  } catch (error) {
    // Parse error - return 0 as safe fallback
    return 0;
  }
}

/**
 * Compute freshness status from evidence age.
 * 
 * Enterprise thresholds (mandatory):
 * - ageDays <= 1  => "Fresh"
 * - 2-7           => "Stale"
 * - > 7           => "Out of date"
 * 
 * @param ageDays - Age in days (from computeEvidenceAgeDays)
 * @returns Freshness label
 */
export function computeFreshness(ageDays: number): "Fresh" | "Stale" | "Out of date" {
  if (ageDays <= 1) {
    return "Fresh";
  } else if (ageDays <= 7) {
    return "Stale";
  } else {
    return "Out of date";
  }
}

/**
 * Format age with correct pluralization.
 * @param ageDays - Age in days
 * @returns Formatted string (e.g., "0 days", "1 day", "5 days")
 */
export function formatAgeDays(ageDays: number): string {
  if (ageDays === 1) {
    return "1 day";
  }
  return `${ageDays} days`;
}
