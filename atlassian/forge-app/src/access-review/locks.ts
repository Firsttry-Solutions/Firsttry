/**
 * PHASE 3 SOR v1.1 - Lock Mechanism (STRICT)
 * Single acquisition, fail-fast, 330s TTL
 * No retry loops. Write must complete within 10s.
 */

import { LockState, ReviewError } from "./types";
import {
  buildLockKey,
  calculateLockExpiry,
  isLockValid,
  validateSiteId,
  validateQuarter,
  LOCK_TTL_SECONDS,
  WRITE_BUDGET_SECONDS,
} from "./storageKeys";

// Simulated storage backend (in real Forge, would use @forge/api storage)
const lockStorage: Record<string, LockState | null> = {};

// ============================================================================
// LOCK ACQUISITION (SINGLE ATTEMPT, FAIL-FAST)
// ============================================================================

/**
 * Acquire lock for quarterly review operation
 * - Single attempt, no retry
 * - TTL: 330 seconds
 * - Throws if cannot acquire
 * - Write must complete within 10s budget
 */
export async function acquireLock(
  siteId: string,
  quarter: string,
  actorAccountId: string
): Promise<string> {
  // Validation (fail-fast)
  validateSiteId(siteId);
  validateQuarter(quarter);

  const lockKey = buildLockKey(siteId, quarter);
  const nowUtc = new Date().toISOString();
  const expiresUtc = calculateLockExpiry(nowUtc);

  // Check current lock state
  const existingLock = lockStorage[lockKey];

  // If lock exists and is still valid, fail immediately (no retry)
  if (existingLock && isLockValid(existingLock.expiresUtc, nowUtc)) {
    throw new ReviewError(
      "LOCK_UNAVAILABLE",
      `Lock unavailable for ${siteId}:${quarter}. Held by ${existingLock.holderAccountId} until ${existingLock.expiresUtc}`,
      {
        lockKey,
        holder: existingLock.holderAccountId,
        expiresUtc: existingLock.expiresUtc,
      }
    );
  }

  // Attempt acquisition (single, atomic operation)
  const startTime = Date.now();
  const newLock: LockState = {
    lockKey,
    acquiredUtc: nowUtc,
    expiresUtc,
    holderAccountId: actorAccountId,
  };

  try {
    // Simulate atomic write
    lockStorage[lockKey] = newLock;

    const elapsedMs = Date.now() - startTime;
    const elapsedSec = elapsedMs / 1000;

    // Check budget
    if (elapsedSec > WRITE_BUDGET_SECONDS) {
      // Release lock if write exceeded budget
      releaseLockUnsafe(lockKey);
      throw new ReviewError(
        "LOCK_TIMEOUT",
        `Lock acquisition exceeded budget (${elapsedSec.toFixed(2)}s > ${WRITE_BUDGET_SECONDS}s)`,
        { elapsedSec, budget: WRITE_BUDGET_SECONDS }
      );
    }

    return lockKey;
  } catch (err) {
    // Any error during lock acquisition → fail-closed
    if (err instanceof ReviewError) throw err;
    throw new ReviewError(
      "LOCK_UNAVAILABLE",
      `Failed to acquire lock: ${String(err)}`,
      { originalError: String(err) }
    );
  }
}

/**
 * Release lock (must be held by same actor)
 */
export async function releaseLock(
  siteId: string,
  quarter: string,
  actorAccountId: string
): Promise<void> {
  const lockKey = buildLockKey(siteId, quarter);
  const lock = lockStorage[lockKey];

  if (!lock) {
    // Already released, no-op
    return;
  }

  // Verify actor holds lock
  if (lock.holderAccountId !== actorAccountId) {
    throw new ReviewError(
      "LOCK_UNAVAILABLE",
      `Cannot release: lock held by ${lock.holderAccountId}, not ${actorAccountId}`,
      { holder: lock.holderAccountId, actor: actorAccountId }
    );
  }

  releaseLockUnsafe(lockKey);
}

/**
 * Internal: Release lock without validation (for cleanup)
 */
function releaseLockUnsafe(lockKey: string): void {
  lockStorage[lockKey] = null;
}

/**
 * Check if lock is currently held (for diagnostics)
 */
export function isLockHeld(siteId: string, quarter: string): boolean {
  const lockKey = buildLockKey(siteId, quarter);
  const lock = lockStorage[lockKey];

  if (!lock) return false;

  const nowUtc = new Date().toISOString();
  return isLockValid(lock.expiresUtc, nowUtc);
}

/**
 * Get current lock state (for diagnostics)
 */
export function getLockState(siteId: string, quarter: string): LockState | null {
  const lockKey = buildLockKey(siteId, quarter);
  return lockStorage[lockKey] || null;
}

// ============================================================================
// LOCK-AWARE OPERATION WRAPPER
// ============================================================================

/**
 * Execute callback within lock scope
 * - Acquires lock
 * - Runs callback
 * - Releases lock
 * - Propagates lock/callback errors
 */
export async function withLock<T>(
  siteId: string,
  quarter: string,
  actorAccountId: string,
  callback: () => Promise<T>
): Promise<T> {
  let lockKey: string | null = null;

  try {
    // Acquire lock
    lockKey = await acquireLock(siteId, quarter, actorAccountId);

    // Execute callback (within lock)
    const result = await callback();

    // Release lock
    await releaseLock(siteId, quarter, actorAccountId);
    lockKey = null;

    return result;
  } catch (err) {
    // Release lock if still held (cleanup on error)
    if (lockKey) {
      try {
        releaseLockUnsafe(buildLockKey(siteId, quarter));
      } catch {
        // Ignore cleanup errors
      }
    }

    // Propagate original error
    throw err;
  }
}

// ============================================================================
// LOCK EXPIRY CLEANUP (MAINTENANCE)
// ============================================================================

/**
 * Clean up expired locks (can be run periodically)
 * Returns count of locks cleaned up
 */
export function cleanupExpiredLocks(): number {
  const nowUtc = new Date().toISOString();
  let cleanedCount = 0;

  for (const [lockKey, lock] of Object.entries(lockStorage)) {
    if (lock && !isLockValid(lock.expiresUtc, nowUtc)) {
      lockStorage[lockKey] = null;
      cleanedCount++;
    }
  }

  return cleanedCount;
}
