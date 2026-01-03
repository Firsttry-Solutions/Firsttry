/**
 * CADENCE GATE
 * 
 * Implements a deterministic 15-minute "meaningful check cadence" gate
 * while the Forge scheduler triggers every 5 minutes.
 * 
 * On every 5-minute trigger ping:
 * 1. Record the platform ping
 * 2. Check if a meaningful check is due (every 15 minutes)
 * 3. Skip the check if not due, run if due
 * 
 * This ensures:
 * - We leverage Forge's 5-minute scheduling precision
 * - We clearly declare a 15-minute "check cadence" for optics/trust
 * - We avoid misleading "every 5 minutes" in the UI
 * - Staleness is based on cadence (30 min threshold), not ping (10 min)
 * 
 * Design:
 * - Gate is purely storage-based (deterministic: based on last cadence time)
 * - No complex locking; concurrency conflicts result in 2x runs (acceptable)
 * - Must not crash or deadlock
 * - Must not change the actual check logic
 */

import api from '@forge/api';
import { getHeartbeat } from './heartbeat_recorder';

const CADENCE_INTERVAL_MINUTES = 15;

/**
 * Check if a meaningful check is due
 * 
 * Returns true if:
 * - No cadence check has ever run (lastCadenceCheckAt missing), OR
 * - Last cadence check was >= 15 minutes ago
 * 
 * @param cloudId - Tenant identifier
 * @returns true if meaningful check is due
 */
export async function isCadenceDue(cloudId: string): Promise<boolean> {
  if (!cloudId) {
    // Without cloudId, we can't determine if due; assume yes (run the check)
    return true;
  }

  try {
    const record = await getHeartbeat(cloudId);

    // If no record, first run ever => due
    if (!record) {
      return true;
    }

    // Check using lastCadenceCheckAt (new field)
    let lastCadenceTime: string | undefined = record.lastCadenceCheckAt;

    // Backward compat: if lastCadenceCheckAt missing but lastCheckAt exists, use that
    if (!lastCadenceTime && record.lastCheckAt) {
      lastCadenceTime = record.lastCheckAt;
    }

    // If still no cadence time recorded => due
    if (!lastCadenceTime) {
      return true;
    }

    // Check if due based on interval
    const lastTime = new Date(lastCadenceTime).getTime();
    const now = Date.now();
    const elapsedMs = now - lastTime;
    const cadenceIntervalMs = CADENCE_INTERVAL_MINUTES * 60 * 1000;

    return elapsedMs >= cadenceIntervalMs;
  } catch (error) {
    console.error('[CadenceGate] Error checking if due:', error);
    // On error, assume due (fail-safe: run the check)
    return true;
  }
}

/**
 * Get the cadence interval (for disclosure in UI)
 * 
 * @returns Cadence interval in minutes
 */
export function getCadenceIntervalMinutes(): number {
  return CADENCE_INTERVAL_MINUTES;
}

/**
 * Get the staleness threshold (2 × cadence interval)
 * 
 * @returns Staleness threshold in minutes
 */
export function getStaleThresholdMinutes(): number {
  return 2 * CADENCE_INTERVAL_MINUTES;
}
