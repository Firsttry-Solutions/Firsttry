/**
 * HEARTBEAT RECORDER
 * 
 * Updates heartbeat record in Forge Storage whenever a scheduled check executes.
 * 
 * Supports TWO timing layers:
 * 1. PLATFORM TRIGGER PING (Forge, 5 minutes): Records lastTriggerAt every invocation
 * 2. MEANINGFUL CHECK (FirstTry cadence, 15 minutes): Records lastCadenceCheckAt only when cadence runs
 * 
 * Called by phase5_scheduler on every 5-min trigger ping.
 * The scheduler uses a storage-based gate to skip 2 out of 3 pings.
 * 
 * Storage key: firsttry:heartbeat:<cloudId>
 * 
 * Principles:
 * - Increments platform trigger counter on every ping (best-effort)
 * - Increments cadence check counter only when meaningful check runs (best-effort)
 * - Stores only what is known with certainty
 * - Never invents values
 * - Handles concurrent updates safely (best-effort counters, eventual consistency)
 * - Tenant-scoped via cloudId
 * 
 * Heartbeat Record Shape (missing fields remain missing):
 * {
 *   status: "RUNNING" | "INITIALIZING" | "DEGRADED",
 *   lastSuccessAt?: string,     // UTC ISO 8601, when meaningful check succeeded
 *   lastCheckAt?: string,       // DEPRECATED: use lastCadenceCheckAt. Kept for backward compat.
 *   lastCadenceCheckAt?: string, // UTC ISO 8601, when meaningful check executed (success or fail)
 *   lastTriggerAt?: string,      // UTC ISO 8601, when platform trigger last pinged
 *   firstSuccessAt?: string,    // UTC ISO 8601, when first meaningful check succeeded
 *   runCount?: number,          // count of meaningful checks executed
 *   triggerCount?: number,      // count of platform trigger pings
 *   snapshotCount?: number,
 *   cadenceIntervalMinutes?: number, // fixed: 15
 *   lastError?: string,         // max 300 chars, single line, no secrets
 *   updatedAt?: string          // UTC ISO 8601
 * }
 */

import api from '@forge/api';

interface HeartbeatRecord {
  status: 'RUNNING' | 'INITIALIZING' | 'DEGRADED';
  lastSuccessAt?: string;
  lastCheckAt?: string;              // deprecated; use lastCadenceCheckAt
  lastCadenceCheckAt?: string;        // meaningful check time
  lastTriggerAt?: string;             // platform trigger ping time
  firstSuccessAt?: string;
  runCount?: number;                  // meaningful checks
  triggerCount?: number;              // platform pings
  snapshotCount?: number;
  cadenceIntervalMinutes?: number;    // fixed: 15
  lastError?: string;
  updatedAt?: string;
}

interface CheckResult {
  success: boolean;
  error?: string;
  snapshotCount?: number; // If snapshots were created in this check
}

/**
 * Truncate error message to 300 chars, ensure single-line, no secrets
 */
function sanitizeError(error: string | undefined): string | undefined {
  if (!error) {
    return undefined;
  }

  // Remove newlines
  let cleaned = error.replace(/\n/g, ' ').replace(/\r/g, ' ');

  // Remove common secret patterns (tokens, API keys, etc)
  cleaned = cleaned.replace(/[a-zA-Z0-9_]{20,}/g, '[REDACTED]');
  cleaned = cleaned.replace(/token|key|secret|password/i, '[REDACTED]');

  // Truncate to 300 chars
  return cleaned.length > 300 ? cleaned.substring(0, 297) + '...' : cleaned;
}

/**
 * Record a cadence check result (meaningful check execution)
 * 
 * Should be called by phase5_scheduler.run after each meaningful check completes.
 * Only called when cadence gate allows (every 15 minutes, not every 5-minute ping).
 * 
 * @param cloudId - Tenant identifier
 * @param result - Check result with success status, optional error, optional snapshotCount
 */
export async function recordHeartbeatCheck(
  cloudId: string,
  result: CheckResult
): Promise<void> {
  if (!cloudId || typeof cloudId !== 'string' || cloudId.trim() === '') {
    console.warn('[Heartbeat] Invalid cloudId, skipping record');
    return;
  }

  try {
    const storageKey = `firsttry:heartbeat:${cloudId}`;
    const now = new Date().toISOString();

    await api.asApp().requestStorage(async (storage) => {
      // Load existing record (or initialize)
      let record = (await storage.get(storageKey)) as HeartbeatRecord | null;

      if (!record) {
        record = {
          status: 'INITIALIZING',
        };
      }

      // Update cadence check timestamps
      record.lastCadenceCheckAt = now;
      record.lastCheckAt = now; // Backward compat
      record.updatedAt = now;

      // Update cadence interval if not set
      if (!record.cadenceIntervalMinutes) {
        record.cadenceIntervalMinutes = 15;
      }

      // Update cadence run count (meaningful checks)
      if (!record.runCount) {
        record.runCount = 1;
      } else {
        record.runCount += 1;
      }

      // Update success state
      if (result.success) {
        record.status = 'RUNNING';
        record.lastSuccessAt = now;

        // Set firstSuccessAt only on first success
        if (!record.firstSuccessAt) {
          record.firstSuccessAt = now;
        }

        // Clear error if successful
        record.lastError = undefined;

        // Update snapshot count if provided
        if (result.snapshotCount !== undefined) {
          record.snapshotCount = result.snapshotCount;
        }
      } else {
        // Mark as degraded if check failed
        record.status = 'DEGRADED';
        record.lastError = sanitizeError(result.error);
      }

      // Persist back to storage
      await storage.set(storageKey, record);
    });
  } catch (error) {
    console.error('[Heartbeat] Error recording check:', error);
    // Do not throw - we never want heartbeat failures to disrupt the main app
  }
}

/**
 * Record snapshot creation
 * 
 * Should be called by snapshot handlers (daily/weekly) after a snapshot is created.
 * Increments snapshotCount in the heartbeat record.
 * 
 * @param cloudId - Tenant identifier
 */
export async function recordSnapshot(cloudId: string): Promise<void> {
  if (!cloudId || typeof cloudId !== 'string' || cloudId.trim() === '') {
    console.warn('[Heartbeat] Invalid cloudId, skipping snapshot record');
    return;
  }

  try {
    const storageKey = `firsttry:heartbeat:${cloudId}`;
    const now = new Date().toISOString();

    await api.asApp().requestStorage(async (storage) => {
      let record = (await storage.get(storageKey)) as HeartbeatRecord | null;

      if (!record) {
        record = {
          status: 'INITIALIZING',
        };
      }

      record.updatedAt = now;

      // Increment snapshot count
      if (!record.snapshotCount) {
        record.snapshotCount = 1;
      } else {
        record.snapshotCount += 1;
      }

      await storage.set(storageKey, record);
    });
  } catch (error) {
    console.error('[Heartbeat] Error recording snapshot:', error);
    // Do not throw
  }
}

/**
 * Record a platform trigger ping (called on every 5-min trigger)
 * 
 * This records that the platform trigger fired, regardless of whether
 * the meaningful check ran.
 * 
 * @param cloudId - Tenant identifier
 */
export async function recordPlatformPing(cloudId: string): Promise<void> {
  if (!cloudId || typeof cloudId !== 'string' || cloudId.trim() === '') {
    console.warn('[Heartbeat] Invalid cloudId, skipping platform ping');
    return;
  }

  try {
    const storageKey = `firsttry:heartbeat:${cloudId}`;
    const now = new Date().toISOString();

    await api.asApp().requestStorage(async (storage) => {
      let record = (await storage.get(storageKey)) as HeartbeatRecord | null;

      if (!record) {
        record = {
          status: 'INITIALIZING',
        };
      }

      // Update platform trigger fields
      record.lastTriggerAt = now;
      record.updatedAt = now;

      if (!record.triggerCount) {
        record.triggerCount = 1;
      } else {
        record.triggerCount += 1;
      }

      // Set cadence interval if not set
      if (!record.cadenceIntervalMinutes) {
        record.cadenceIntervalMinutes = 15; // Fixed constant
      }

      await storage.set(storageKey, record);
    });
  } catch (error) {
    console.error('[Heartbeat] Error recording platform ping:', error);
    // Do not throw
  }
}

/**
 * Get current heartbeat record (read-only)
 * 
 * Used by gadget and admin pages to display status.
 * 
 * @param cloudId - Tenant identifier
 * @returns Heartbeat record or null if not yet created
 */
export async function getHeartbeat(cloudId: string): Promise<HeartbeatRecord | null> {
  if (!cloudId || typeof cloudId !== 'string' || cloudId.trim() === '') {
    console.warn('[Heartbeat] Invalid cloudId, returning null');
    return null;
  }

  try {
    const storageKey = `firsttry:heartbeat:${cloudId}`;

    return await api.asApp().requestStorage(async (storage) => {
      const record = await storage.get(storageKey);
      return (record as HeartbeatRecord) || null;
    });
  } catch (error) {
    console.error('[Heartbeat] Error reading record:', error);
    return null;
  }
}
