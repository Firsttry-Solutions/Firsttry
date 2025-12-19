/**
 * Backfill Selector - Deterministic Date Range Selection
 * PHASE 3: Select which dates to backfill for daily aggregation
 *
 * Rules:
 * 1. If lastSuccessISO is null: return last maxDays days (including today)
 * 2. If lastSuccessISO exists: return dates from (last_success + 1 day) to today, max maxDays
 * 3. All dates are UTC-based, returned sorted ascending
 * 4. If result is empty: return []
 */

import { MAX_DAILY_BACKFILL_DAYS } from './config/constants';

/**
 * Parse ISO date string to Date object (UTC)
 */
function parseISODate(isoString: string | null): Date | null {
  if (!isoString) return null;
  try {
    return new Date(isoString);
  } catch {
    return null;
  }
}

/**
 * Convert Date to yyyy-mm-dd (UTC)
 */
function dateToYYYYMMDD(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Add days to a Date object
 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/**
 * Select backfill dates deterministically
 * 
 * @param lastSuccessISO - Last successful pipeline run timestamp (ISO 8601), or null
 * @param nowISO - Current timestamp (ISO 8601, UTC)
 * @param maxDays - Maximum days to backfill (default: MAX_DAILY_BACKFILL_DAYS)
 * @returns Array of dates in yyyy-mm-dd format, sorted ascending
 */
export function select_backfill_dates(
  lastSuccessISO: string | null,
  nowISO: string,
  maxDays: number = MAX_DAILY_BACKFILL_DAYS
): string[] {
  try {
    const now = parseISODate(nowISO);
    if (!now) {
      console.error('[BackfillSelector] Invalid nowISO:', nowISO);
      return [];
    }

    let startDate: Date;

    if (!lastSuccessISO) {
      // No previous success: backfill last maxDays days (including today)
      startDate = addDays(now, -(maxDays - 1));
    } else {
      const lastSuccess = parseISODate(lastSuccessISO);
      if (!lastSuccess) {
        console.error('[BackfillSelector] Invalid lastSuccessISO:', lastSuccessISO);
        return [];
      }

      // Start from day after last success
      startDate = addDays(lastSuccess, 1);

      // Cap to maxDays back from now
      const maxStart = addDays(now, -(maxDays - 1));
      if (startDate < maxStart) {
        startDate = maxStart;
      }
    }

    // Sanity: don't backfill future dates
    if (startDate > now) {
      return [];
    }

    // Generate all dates from startDate to now (inclusive)
    const result: string[] = [];
    let current = new Date(startDate);
    while (current <= now) {
      result.push(dateToYYYYMMDD(current));
      current = addDays(current, 1);
    }

    // Verify sorted (should be by construction)
    result.sort();

    return result;
  } catch (error) {
    console.error('[BackfillSelector] Unexpected error:', error);
    return [];
  }
}
