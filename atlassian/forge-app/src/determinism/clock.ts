/**
 * Deterministic Clock Module
 *
 * Provides controlled timestamps for deterministic output.
 * - Default: real time (new Date().toISOString())
 * - Override: via FT_FIXED_UTC environment variable (for tests + repeatability)
 *
 * NEVER use Date.now() or new Date() directly in export paths.
 * Use this module instead.
 */

/**
 * Get current UTC timestamp in ISO 8601 format.
 * Can be overridden by FT_FIXED_UTC environment variable.
 *
 * @returns ISO 8601 timestamp (e.g., "2026-02-14T08:00:00.000Z")
 */
export function nowIsoUtc(): string {
  const fixed = process.env.FT_FIXED_UTC;
  if (fixed) {
    // Validate ISO 8601 format
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(fixed)) {
      throw new Error(`FT_FIXED_UTC must be ISO 8601: got "${fixed}"`);
    }
    return fixed;
  }
  return new Date().toISOString();
}

/**
 * Get current millisecond timestamp.
 * Primarily for non-deterministic use (e.g., performance logging).
 * AVOID in export paths, snapshot hashes, filenames.
 *
 * @returns Milliseconds since Unix epoch
 */
export function nowMillis(): number {
  const fixed = process.env.FT_FIXED_UTC;
  if (fixed) {
    return new Date(fixed).getTime();
  }
  return Date.now();
}
