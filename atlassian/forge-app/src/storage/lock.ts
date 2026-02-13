/**
 * Phase 2: Storage-backed distributed lock for drift scanning.
 * TTL 330s prevents overlapping scans.
 */

import { getSecret } from "@forge/api";
import * as api from "@forge/api";
import crypto from "crypto";

const LOCK_KEY = "phase2.lock";
const LOCK_TTL_SECONDS = 330;

// Deterministic holderId: sha256(buildShaShort + "|" + invocationStartUtc)
function getHolderId(buildShaShort: string, invocationStartUtc: string): string {
  const input = `${buildShaShort}|${invocationStartUtc}`;
  return crypto.createHash("sha256").update(input).digest("hex");
}

// Returns true if lock acquired successfully
export async function acquireLock(
  invocationStartUtc: string,
  buildShaShort: string,
  ttlSeconds = LOCK_TTL_SECONDS
): Promise<boolean> {
  const storage = api.asApp().requestStorage();
  const holderId = getHolderId(buildShaShort, invocationStartUtc);

  // Try to read existing lock
  const existingLock = await storage.get(LOCK_KEY);

  if (existingLock) {
    const lock = JSON.parse(existingLock);
    const now = new Date();
    const expiresAt = new Date(lock.expiresAtUtc);

    // Lock still valid
    if (now < expiresAt) {
      console.log(`[FT_DRIFT_LOCK_EXISTS_ABORT] Lock held by ${lock.holderId} until ${lock.expiresAtUtc}`);
      return false;
    }
    // Lock expired, proceed to acquire
  }

  // Acquire lock
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

  const newLock = {
    acquiredAtUtc: now.toISOString(),
    expiresAtUtc: expiresAt.toISOString(),
    holderId,
  };

  try {
    await storage.set(LOCK_KEY, JSON.stringify(newLock));
    console.log(`[FT_DRIFT_LOCK_ACQUIRED] holderId=${holderId} ttl=${ttlSeconds}s`);
    return true;
  } catch (err) {
    console.error(`[FT_DRIFT_LOCK_ACQUIRE_FAILED]`, err);
    return false;
  }
}

// Best-effort release
export async function releaseLock(): Promise<void> {
  const storage = api.asApp().requestStorage();
  try {
    await storage.delete(LOCK_KEY);
    console.log(`[FT_DRIFT_LOCK_RELEASED]`);
  } catch (err) {
    console.error(`[FT_DRIFT_LOCK_RELEASE_FAILED]`, err);
  }
}
