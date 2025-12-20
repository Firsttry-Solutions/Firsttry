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
 * Daily snapshot scheduled handler
 */
scheduled.on('phase6:daily', async (request) => {
  const { tenantId, cloudId } = request.payload;

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
});
