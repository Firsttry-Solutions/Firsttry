/**
 * PHASE 6 v2: WEEKLY SNAPSHOT HANDLER
 * 
 * Scheduled function that runs weekly (via Forge scheduledTrigger).
 * 
 * Principles:
 * - Idempotent (same input always produces same output)
 * - Atomic (all-or-nothing)
 * - Tenant-isolated
 * - Deterministic (same Jira state → same hash)
 * - READ-ONLY Jira access
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
 * Weekly snapshot scheduled handler
 */
scheduled.on('phase6:weekly', async (request) => {
  const { tenantId, cloudId } = request.payload;

  try {
    // Idempotency: use week start date (Monday)
    const windowStart = new Date();
    windowStart.setHours(0, 0, 0, 0);
    const dayOfWeek = windowStart.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    windowStart.setDate(windowStart.getDate() - daysToMonday);
    const windowStartISO = windowStart.toISOString().split('T')[0];
    const idempotencyKey = getIdempotencyKey(tenantId, 'weekly', windowStartISO);

    // Check if already ran this week
    const runStorage = new SnapshotRunStorage(tenantId, cloudId);
    const existingRuns = await runStorage.listRuns(
      { snapshot_type: 'weekly' },
      0,
      100
    );

    const alreadyRan = existingRuns.items.some(run => {
      const runDate = new Date(run.scheduled_for);
      const runDay = runDate.getDay();
      const runDaysToMonday = runDay === 0 ? 6 : runDay - 1;
      runDate.setDate(runDate.getDate() - runDaysToMonday);
      return runDate.toISOString().split('T')[0] === windowStartISO;
    });

    if (alreadyRan) {
      console.log(`Weekly snapshot already ran for ${idempotencyKey}, skipping`);
      return;
    }

    // Capture snapshot
    const capturer = new SnapshotCapturer(tenantId, cloudId, 'weekly');
    const { run, snapshot } = await capturer.capture();

    // Save run record
    await runStorage.createRun(run);

    // Save snapshot if successful
    if (snapshot) {
      const snapshotStorage = new SnapshotStorage(tenantId, cloudId);
      await snapshotStorage.createSnapshot(snapshot);

      // Enforce retention
      const enforcer = new RetentionEnforcer(tenantId, cloudId);
      const { deleted_count, reason } = await enforcer.enforceRetention('weekly');
      if (deleted_count > 0) {
        console.log(`Retention enforcement: ${reason}`);
      }
    }

    console.log(`Weekly snapshot completed: ${run.run_id}, status=${run.status}`);
  } catch (error) {
    console.error('Weekly snapshot handler error:', error);
    throw error;
  }
});
