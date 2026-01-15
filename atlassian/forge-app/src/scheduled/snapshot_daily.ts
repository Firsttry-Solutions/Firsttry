/**
 * PHASE 6 v2: DAILY SNAPSHOT HANDLER
 * 
 * Scheduled function that runs daily (via Forge scheduledTrigger).
 * 
 * Principles:
 * - Idempotent (same input always produces same output)
 * - Atomic (all-or-nothing: either snapshot succeeds or fails cleanly)
 * - Tenant-isolated (all keys prefixed by tenant_id)
 * - Deterministic (same Jira state → same hash)
 * - READ-ONLY Jira access (no write endpoints)
 */

import { scheduled } from '@forge/api';
import {
  SnapshotRunStorage,
  SnapshotStorage,
  RetentionEnforcer,
} from '../phase6/snapshot_storage';
import { SnapshotCapturer } from '../phase6/snapshot_capture';
import {
  getIdempotencyKey,
} from '../phase6/constants';

/**
 * Core handler logic (extracted to prevent top-level side effects)
 */
async function dailySnapshotLogic(tenantId: string, cloudId: string): Promise<void> {
  try {
    // Idempotency: use window start date
    const windowStart = new Date();
    windowStart.setHours(0, 0, 0, 0);
    const windowStartISO = windowStart.toISOString().split('T')[0];
    const idempotencyKey = getIdempotencyKey(tenantId, 'daily', windowStartISO);

    // Check if already ran today
    const runStorage = new SnapshotRunStorage(tenantId, cloudId);
    const existingRuns = await runStorage.listRuns(
      { snapshot_type: 'daily' },
      0,
      100
    );

    const alreadyRan = existingRuns.items.some(run =>
      run.scheduled_for.startsWith(windowStartISO)
    );

    if (alreadyRan) {
      console.log(`Daily snapshot already ran for ${idempotencyKey}, skipping`);
      return;
    }

    // Capture snapshot
    const capturer = new SnapshotCapturer(tenantId, cloudId, 'daily');
    const { run, snapshot } = await capturer.capture();

    // Save run record
    await runStorage.createRun(run);

    // Save snapshot if successful
    if (snapshot) {
      const snapshotStorage = new SnapshotStorage(tenantId, cloudId);
      await snapshotStorage.createSnapshot(snapshot);

      // Enforce retention
      const enforcer = new RetentionEnforcer(tenantId, cloudId);
      const { deleted_count, reason } = await enforcer.enforceRetention('daily');
      if (deleted_count > 0) {
        console.log(`Retention enforcement: ${reason}`);
      }
    }

    console.log(`Daily snapshot completed: ${run.run_id}, status=${run.status}`);
  } catch (error) {
    console.error('Daily snapshot handler error:', error);
    throw error;
  }
}

/**
 * Register the scheduled event handler (safe initialization)
 * Called during app startup to set up the event listener
 */
export function registerScheduledHandler(): void {
  if (!scheduled || !scheduled.on) {
    console.warn('[snapshot_daily] scheduled.on not available during init; skipping registration');
    return;
  }
  
  scheduled.on('phase6:daily', async (request) => {
    const { tenantId, cloudId } = request.payload;
    await dailySnapshotLogic(tenantId, cloudId);
  });
}

/**
 * Exported handler for Forge manifest compatibility
 */
export async function handle(event: any, context: any) {
  const { cloudId } = context;
  const tenantId = cloudId; // Forge uses cloudId as tenant identifier

  try {
    await dailySnapshotLogic(tenantId, cloudId);
    return { statusCode: 200, body: 'Daily snapshot completed' };
  } catch (error) {
    console.error('Daily snapshot handler error:', error);
    return { statusCode: 500, body: `Error: ${error}` };
  }
}
