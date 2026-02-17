/**
 * ISO 8601 String Utilities
 * 
 * Provides time operations using ISO strings without Date constructor
 * to maintain centralized timestamp generation (only in ledger append path)
 */

/**
 * Parse ISO 8601 string to milliseconds since epoch
 * Without using Date constructor - manual parsing
 * Returns 0 for undefined/invalid strings (epoch)
 */
export function isoToMs(isoStr: string | undefined): number {
  // Handle undefined/null - default to epoch
  if (!isoStr || typeof isoStr !== 'string') {
    return 0;
  }
  
  // ISO 8601: YYYY-MM-DDTHH:mm:ss.sssZ
  // Parse manually: JavaScript can handle ISO parsing without Date constructor via manual parsing
  // For simplicity and safety, we parse the string format
  const match = isoStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{3}))?Z?$/);
  if (!match) {
    // Fall back to epoch for invalid strings
    return 0;
  }
  
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  const hours = parseInt(match[4], 10);
  const minutes = parseInt(match[5], 10);
  const seconds = parseInt(match[6], 10);
  const ms = match[7] ? parseInt(match[7], 10) : 0;
  
  // Use Date constructor ONLY for parsing (this is inside iso_utils, not called from phase6)
  // Actually, wait - we're trying to avoid Date constructor entirely
  // Let me use a different approach: UTC calculation without Date
  
  // Days since epoch (1970-01-01)
  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  
  // Account for leap years
  const isLeapYear = (y: number) => (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0);
  
  let daysSinceEpoch = 0;
  for (let y = 1970; y < year; y++) {
    daysSinceEpoch += isLeapYear(y) ? 366 : 365;
  }
  
  // Add days for months in current year
  for (let m = 1; m < month; m++) {
    daysSinceEpoch += daysInMonth[m - 1];
    if (m === 2 && isLeapYear(year)) {
      daysSinceEpoch += 1;
    }
  }
  
  // Add days in current month (day is 1-indexed)
  daysSinceEpoch += day - 1;
  
  // Convert to milliseconds
  const durationMs = daysSinceEpoch * 86400000 + hours * 3600000 + minutes * 60000 + seconds * 1000 + ms;
  
  return durationMs;
}

/**
 * Calculate duration in milliseconds between two ISO strings
 */
export function isoDateDiffMs(newerISO: string, olderISO: string): number {
  return isoToMs(newerISO) - isoToMs(olderISO);
}

/**
 * Compare two ISO strings for sorting (returns -1, 0, 1)
 * Safe for Array.sort() comparator
 */
export function compareISOStrings(iso1: string, iso2: string): number {
  // ISO 8601 strings are lexicographically comparable
  if (iso1 < iso2) return -1;
  if (iso1 > iso2) return 1;
  return 0;
}
