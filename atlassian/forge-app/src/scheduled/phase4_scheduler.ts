/**
 * Phase 4: DAILY Change Detection Scheduler (SEALED SPECIFICATION)
 * 
 * Runs DAILY to detect changes in Jira settings from Phase 2 metric deltas.
 * 
 * SEALED SPEC CONSTRAINTS:
 * - Schedule: DAILY ONLY (not hourly, not manual)
 * - Data source: Phase 2 metrics ONLY (no Jira API calls)
 * - Operations: Append-only timeline updates
 * - No side effects: No config mutations, no recommendations
 * - Fail-closed: Errors do not prevent app operation
 */

import { storage } from '@forge/api';
import {
  detectChanges,
  appendChanges,
  getSchedulerState,
  updateSchedulerState,
  updateMetricsSnapshot,
} from '../phase4/timeline';
import { Phase4SchedulerResult } from '../phase4/types';

/**
 * Retrieve current Phase 2 metrics from storage.
 * These are the metrics used to detect Phase 4 changes.
 */
async function getCurrentPhase2Metrics(cloudId: string): Promise<Record<string, any> | null> {
  try {
    // Phase 2 stores configuration visibility metrics under this key
    const metricsKey = `phase2:metrics:${cloudId}`;
    const metrics = (await storage.get(metricsKey)) as Record<string, any> | null;
    return metrics;
  } catch (error) {
    console.error(
      `[Phase4_Scheduler] Error retrieving Phase 2 metrics: ${error instanceof Error ? error.message : String(error)}`
    );
    return null;
  }
}

/**
 * Main scheduler handler for Phase 4 DAILY run.
 * 
 * Called daily by Forge scheduler.
 * Detects changes in Jira settings from Phase 2 deltas.
 * Appends changes to immutable timeline.
 * 
 * This is the ONLY way Phase 4 timeline gets updated (fully scheduled, no manual triggers).
 */
export async function runDaily(request: any, context: any): Promise<void> {
  // Get tenant identity from context
  const cloudId = context?.cloudId;

  if (!cloudId || typeof cloudId !== 'string') {
    console.error('[Phase4_Scheduler] Missing or invalid cloud ID in context');
    return;
  }

  const executedAt = new Date().toISOString();
  let result: Phase4SchedulerResult = {
    success: false,
    changesDetected: 0,
    events: [],
    errorReason: 'Not yet executed',
    executedAt,
  };

  try {
    // Fetch current Phase 2 metrics
    const currentMetrics = await getCurrentPhase2Metrics(cloudId);

    if (!currentMetrics) {
      // No Phase 2 metrics available yet
      result = {
        success: true,
        changesDetected: 0,
        events: [],
        executedAt,
      };
      await updateSchedulerState(cloudId, result);
      console.log(`[Phase4_Scheduler] No Phase 2 metrics available for ${cloudId}, skipping detection`);
      return;
    }

    // Detect changes from Phase 2 deltas
    const detectedEvents = await detectChanges(cloudId, currentMetrics);

    // Append changes to timeline (if any)
    if (detectedEvents.length > 0) {
      const timeline = await appendChanges(cloudId, detectedEvents);
      console.log(
        `[Phase4_Scheduler] Appended ${detectedEvents.length} changes to timeline for ${cloudId}, total events now: ${timeline.totalEvents}`
      );
    } else {
      console.log(`[Phase4_Scheduler] No changes detected for ${cloudId}`);
    }

    // Update metrics snapshot for next run's delta detection
    await updateMetricsSnapshot(cloudId, currentMetrics);

    // Mark run as successful
    result = {
      success: true,
      changesDetected: detectedEvents.length,
      events: detectedEvents,
      executedAt,
    };

    await updateSchedulerState(cloudId, result);

    console.log(
      `[Phase4_Scheduler] DAILY run completed for ${cloudId}: detected ${detectedEvents.length} changes`
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[Phase4_Scheduler] DAILY run failed for ${cloudId}: ${errorMsg}`);

    result = {
      success: false,
      changesDetected: 0,
      events: [],
      errorReason: errorMsg,
      executedAt,
    };

    await updateSchedulerState(cloudId, result);

    // Fail gracefully - do not rethrow
    // This ensures scheduler remains operational even if Phase 4 fails
  }
}

/**
 * Alternative name for the main scheduler handler (for manifest compatibility).
 * Some Forge tooling may expect .handle instead of .runDaily
 */
export const handle = runDaily;
