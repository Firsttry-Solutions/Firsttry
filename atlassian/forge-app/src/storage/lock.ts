/**
 * Phase 2: Storage-backed distributed lock for drift scanning.
 * Hardened for stability: fail-closed semantics, no best-effort paths.
 * TTL 330s prevents overlapping scans.
 *
 * GUARANTEE: acquireLock() either succeeds (returns true) or fails hard (throws).
 *            releaseLock() idempotent (safe to call multiple times).
 */

import api from "@forge/api";
import crypto from "crypto";
import { FTError, ftFailClosed } from "../errors";

const LOCK_KEY = "phase2.lock";
const LOCK_TTL_SECONDS = 330;

interface LockRecord {
  acquiredAtUtc: string;
  expiresAtUtc: string;
  holderId: string;
}

/**
 * Deterministic holderId: sha256(buildShaShort + "|" + invocationStartUtc)
 * Determinism: same inputs always yield same holderId.
 */
function getHolderId(buildShaShort: string, invocationStartUtc: string): string {
  const input = `${buildShaShort}|${invocationStartUtc}`;
  return crypto.createHash("sha256").update(input).digest("hex");
}

/**
 * Parse and validate lock record structure.
 * Throws FTError if invalid JSON or missing required fields.
 */
function parseLockRecord(json: string): LockRecord {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (err) {
    throw ftFailClosed("FT_LOCK_CORRUPTED", "Lock state corrupted (invalid JSON)", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  const record = parsed as Record<string, unknown>;
  if (
    typeof record.acquiredAtUtc !== "string" ||
    typeof record.expiresAtUtc !== "string" ||
    typeof record.holderId !== "string"
  ) {
    throw ftFailClosed("FT_LOCK_CORRUPTED", "Lock state corrupted (missing fields)", {
      keys: Object.keys(record),
    });
  }

  return {
    acquiredAtUtc: record.acquiredAtUtc,
    expiresAtUtc: record.expiresAtUtc,
    holderId: record.holderId,
  };
}

/**
 * Check if lock is still valid (not expired).
 */
function isLockValid(lock: LockRecord): boolean {
  const expiresAtMs = new Date(lock.expiresAtUtc).getTime();
  const nowMs = Date.now();
  return nowMs < expiresAtMs;
}

/**
 * Acquire lock (fail-closed).
 *
 * Returns true if acquired.
 * Throws FTError if:
 * - Lock held by another holder
 * - Storage GET/SET fails
 * - Lock state corrupted
 *
 * DETERMINISTIC: Uses provided invocationStartUtc, no Date.now() in holderId.
 */
export async function acquireLock(
  invocationStartUtc: string,
  buildShaShort: string,
  ttlSeconds = LOCK_TTL_SECONDS
): Promise<boolean> {
  const storage = api.asApp().requestStorage();
  const holderId = getHolderId(buildShaShort, invocationStartUtc);

  let existingLockJson: string | undefined;
  try {
    existingLockJson = await storage.get(LOCK_KEY);
  } catch (err) {
    throw ftFailClosed("FT_LOCK_GET_FAILED", "Failed to read lock from storage", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Check if someone else holds the lock
  if (existingLockJson) {
    const lock = parseLockRecord(existingLockJson);

    if (isLockValid(lock)) {
      // Lock still held by another
      throw ftFailClosed("FT_LOCK_HELD", "Lock already held by another invocation", {
        holderId: lock.holderId,
        expiresAtUtc: lock.expiresAtUtc,
      });
    }
    // Lock expired, proceed to acquire
  }

  // Acquire lock
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

  const newLock: LockRecord = {
    acquiredAtUtc: now.toISOString(),
    expiresAtUtc: expiresAt.toISOString(),
    holderId,
  };

  try {
    await storage.set(LOCK_KEY, JSON.stringify(newLock));
    console.log(
      `[FT_LOCK_ACQUIRE_START] holderId=${holderId} ttl=${ttlSeconds}s acquiredAtUtc=${newLock.acquiredAtUtc}`
    );
    return true;
  } catch (err) {
    throw ftFailClosed("FT_LOCK_ACQUIRE_FAILED", "Failed to acquire lock", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Release lock (idempotent, fail-closed).
 *
 * If lock not present: succeeds silently (idempotent guarantee).
 * If lock deletion fails: throws FTError.
 */
export async function releaseLock(): Promise<void> {
  const storage = api.asApp().requestStorage();
  try {
    // Check if lock exists first
    const lockJson = await storage.get(LOCK_KEY);

    if (lockJson) {
      // Parse to validate structure before deleting
      parseLockRecord(lockJson);
      await storage.delete(LOCK_KEY);
      console.log(`[FT_LOCK_RELEASE_OK]`);
    } else {
      // Not held, idempotent
      console.log(`[FT_LOCK_RELEASE_IDEMPOTENT]`);
    }
  } catch (err) {
    if (err instanceof FTError) {
      throw err; // Re-throw FTError (e.g., corrupted lock)
    }
    throw ftFailClosed("FT_LOCK_RELEASE_FAILED", "Failed to release lock", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
