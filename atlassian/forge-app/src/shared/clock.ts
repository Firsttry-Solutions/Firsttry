/**
 * Clock abstraction for deterministic testing and canonical proof generation.
 * 
 * **RULE:** NEVER use SystemClock in canonical/hashed code paths.
 * Use FixedClock in tests and for deterministic canonical output.
 * 
 * Canonical paths include:
 * - Evidence packs, ledger entries, trust snapshots
 * - Any data that goes into SHA-256 hashes or signatures
 * - Proof bundles, governance seals
 * 
 * Non-canonical paths (SystemClock OK):
 * - UI timestamps, log messages, metadata envelopes
 * - Job scheduling, backoff timers
 * - Storage TTLs, retention calculations
 */

export interface Clock {
  /**
   * Returns current time as ISO 8601 string (UTC).
   * For deterministic builds, inject FixedClock.
   * For production runtime, use SystemClock.
   */
  nowISO(): string;
}

/**
 * Production clock using wall-clock time.
 * NEVER use this in canonical/hashed code paths.
 */
export const SystemClock: Clock = {
  nowISO: () => new Date().toISOString(),
};

/**
 * Fixed clock for deterministic testing and canonical builds.
 * Use this in tests and for canonical proof generation.
 * @param iso - Fixed ISO 8601 timestamp to return
 */
export function FixedClock(iso: string): Clock {
  return { nowISO: () => iso };
}

/**
 * Default clock for most code paths.
 * For canonical paths, explicitly pass FixedClock.
 */
export const DefaultClock: Clock = SystemClock;
