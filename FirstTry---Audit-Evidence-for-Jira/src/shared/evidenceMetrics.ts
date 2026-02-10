/**
 * Enterprise Evidence Metrics Utilities
 * 
 * Canonical functions for evidence age and freshness calculation.
 * These functions ensure consistent, enterprise-grade calculation across the UI.
 * 
 * FAIL-CLOSED: Invalid timestamps return null (not 0) to prevent misleading "0 days" display.
 */

/**
 * Compute evidence age in days from created timestamp.
 * 
 * Enterprise requirements:
 * - UTC only (no timezone ambiguity)
 * - Floor to whole days (user-friendly)
 * - Return 0 only when < 24h difference
 * - FAIL-CLOSED: Return null for invalid dates (no misleading "0 days")
 * 
 * @param createdAtUtcIso - ISO 8601 UTC timestamp (e.g., "2026-02-07T10:00:00.000Z")
 * @param nowUtcIso - Optional current time (defaults to Date.now() for testing)
 * @returns Age in days (floored to whole number), or null if invalid
 */
export function computeEvidenceAgeDays(createdAtUtcIso: string, nowUtcIso?: string): number | null {
  // Fail-closed: reject empty/null/undefined
  if (!createdAtUtcIso || typeof createdAtUtcIso !== 'string' || createdAtUtcIso.trim() === '') {
    return null;
  }
  
  try {
    const createdDate = new Date(createdAtUtcIso);
    const nowDate = nowUtcIso ? new Date(nowUtcIso) : new Date();
    
    // Validate dates - FAIL-CLOSED: return null for invalid
    if (isNaN(createdDate.getTime()) || isNaN(nowDate.getTime())) {
      return null;
    }
    
    // Compute difference in milliseconds
    const diffMs = nowDate.getTime() - createdDate.getTime();
    
    // Convert to days and floor
    // 1 day = 86400000 milliseconds
    const ageDays = Math.floor(diffMs / 86400000);
    
    // Ensure non-negative (in case nowDate < createdDate)
    return Math.max(0, ageDays);
  } catch (error) {
    // Parse error - FAIL-CLOSED: return null
    return null;
  }
}

/**
 * Compute freshness status from evidence age.
 * 
 * Enterprise thresholds (mandatory):
 * - ageDays <= 1  => "Fresh"
 * - 2-7           => "Stale"
 * - > 7           => "Out of date"
 * - null          => "Unknown" (FAIL-CLOSED)
 * 
 * @param ageDays - Age in days (from computeEvidenceAgeDays), or null if invalid
 * @returns Freshness label
 */
export function computeFreshness(ageDays: number | null): "Fresh" | "Stale" | "Out of date" | "Unknown" {
  if (ageDays === null) {
    return "Unknown";
  }
  
  if (ageDays <= 1) {
    return "Fresh";
  } else if (ageDays <= 7) {
    return "Stale";
  } else {
    return "Out of date";
  }
}

/**
 * Format evidence age for display with fail-closed invalid handling.
 * 
 * @param ageDays - Age in days, or null if invalid
 * @returns Formatted string (e.g., "Unknown", "1 day", "5 days")
 */
export function formatEvidenceAge(ageDays: number | null): string {
  if (ageDays === null) {
    return "Unknown";
  }
  
  if (ageDays === 1) {
    return "1 day";
  }
  
  return `${ageDays} days`;
}

/**
 * @deprecated Use formatEvidenceAge instead - this function does not handle null
 */
export function formatAgeDays(ageDays: number): string {
  if (ageDays === 1) {
    return "1 day";
  }
  return `${ageDays} days`;
}
