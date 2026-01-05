/**
 * CONFIG VISIBILITY SCHEDULER
 * 
 * Scheduled trigger that runs periodically to compute and store config complexity metrics.
 * 
 * Design:
 * - Validates tenant identity (fail-closed if missing)
 * - Calls config_visibility_resolver to fetch metrics (GET-only)
 * - Stores latest snapshot in tenant-scoped key
 * - Records lastSuccessAtISO and lastRunAtISO
 * - Gracefully handles failures (no throw, all state stored)
 * 
 * Storage keys:
 * - config_visibility:snapshot:{cloudId} → Latest ConfigRiskSnapshot
 * - config_visibility:lastRun:{cloudId} → Last run timestamp
 * - config_visibility:lastSuccess:{cloudId} → Last success timestamp
 */

import { storage } from '@forge/api';
import { resolveTenantIdentity } from '../core/tenant_identity';
import { computeSnapshot } from '../resolvers/config_visibility_resolver';

const SNAPSHOT_KEY_PREFIX = 'config_visibility:snapshot';
const LAST_RUN_KEY_PREFIX = 'config_visibility:lastRun';
const LAST_SUCCESS_KEY_PREFIX = 'config_visibility:lastSuccess';

/**
 * Get storage key for snapshot (tenant-scoped)
 */
function getSnapshotKey(cloudId: string): string {
  if (!cloudId || cloudId.trim() === '') {
    return '';
  }
  return `${SNAPSHOT_KEY_PREFIX}:${cloudId}`;
}

/**
 * Get storage key for last run time
 */
function getLastRunKey(cloudId: string): string {
  if (!cloudId || cloudId.trim() === '') {
    return '';
  }
  return `${LAST_RUN_KEY_PREFIX}:${cloudId}`;
}

/**
 * Get storage key for last success time
 */
function getLastSuccessKey(cloudId: string): string {
  if (!cloudId || cloudId.trim() === '') {
    return '';
  }
  return `${LAST_SUCCESS_KEY_PREFIX}:${cloudId}`;
}

/**
 * Scheduled trigger handler
 * Called periodically by Forge scheduler.
 */
export async function run(request: any, context: any): Promise<void> {
  try {
    // Resolve tenant identity
    const tenantId = resolveTenantIdentity(context);

    if (!tenantId || !tenantId.cloudId) {
      // Fail-closed: do not process without valid tenant
      console.warn('[ConfigVisibility] Tenant identity unavailable. Skipping run.');
      return;
    }

    const cloudId = tenantId.cloudId;

    // Record run time
    const nowISO = new Date().toISOString();
    await recordRunTime(cloudId, nowISO);

    // Compute snapshot
    const snapshot = await computeSnapshot(cloudId);

    // Store snapshot
    await storeSnapshot(cloudId, snapshot);

    // If successful (not all nulls), record success time
    if (snapshot.completeness !== 'EMPTY') {
      await recordSuccessTime(cloudId, nowISO);
    }
  } catch (error) {
    // Log error but don't throw (Forge scheduler doesn't retry on throw)
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[ConfigVisibility] Scheduler error:', errorMsg);
  }
}

/**
 * Store the latest snapshot
 */
async function storeSnapshot(cloudId: string, snapshot: any): Promise<void> {
  try {
    const key = getSnapshotKey(cloudId);
    if (!key) {
      return;
    }

    await storage.set(key, snapshot);
  } catch (error) {
    console.error('[ConfigVisibility] Failed to store snapshot:', error);
    // Fail silently; do not throw
  }
}

/**
 * Record last run time
 */
async function recordRunTime(cloudId: string, iso: string): Promise<void> {
  try {
    const key = getLastRunKey(cloudId);
    if (!key) {
      return;
    }

    await storage.set(key, iso);
  } catch (error) {
    console.error('[ConfigVisibility] Failed to record run time:', error);
  }
}

/**
 * Record last success time
 */
async function recordSuccessTime(cloudId: string, iso: string): Promise<void> {
  try {
    const key = getLastSuccessKey(cloudId);
    if (!key) {
      return;
    }

    await storage.set(key, iso);
  } catch (error) {
    console.error('[ConfigVisibility] Failed to record success time:', error);
  }
}
