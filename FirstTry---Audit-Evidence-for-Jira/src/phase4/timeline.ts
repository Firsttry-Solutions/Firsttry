/**
 * Phase 4: Change Timeline Storage & Detection (SEALED SPECIFICATION)
 * 
 * Provides append-only timeline storage and change detection from Phase 2 deltas.
 * 
 * SEALED SPEC CONSTRAINTS:
 * - Append-only, immutable storage (no updates/deletes)
 * - Detect changes ONLY from Phase 2 metric deltas
 * - NO Jira API calls, NO config mutations
 * - DAILY schedule only
 * - Returns immutable timeline for read-only display
 */

import { storage } from '@forge/api';
import {
  Phase4ChangeEvent,
  Phase4Timeline,
  Phase4SchedulerState,
  Phase4SchedulerResult,
  Phase4TimelinePayload,
} from './types';

/**
 * Get the storage key for Phase 4 timeline (tenant-scoped)
 */
function getTimelineKey(cloudId: string): string {
  return `phase4:timeline:${cloudId}`;
}

/**
 * Get the storage key for Phase 4 scheduler state (tenant-scoped)
 */
function getSchedulerStateKey(cloudId: string): string {
  return `phase4:scheduler:${cloudId}`;
}

/**
 * Get the storage key for Phase 2 metrics snapshot (for delta detection)
 */
function getPhase2MetricsKey(cloudId: string): string {
  return `phase2:metrics:${cloudId}`;
}

/**
 * Fetch current timeline for a tenant.
 * Returns immutable, read-only timeline data.
 */
export async function getTimeline(cloudId: string): Promise<Phase4TimelinePayload> {
  if (!cloudId || typeof cloudId !== 'string' || cloudId.trim() === '') {
    return {
      events: [],
      totalEventCount: 0,
      lastUpdatedAt: new Date().toISOString(),
      isAvailable: false,
      unavailableReason: 'Invalid cloud ID',
    };
  }

  try {
    const timelineKey = getTimelineKey(cloudId);
    const timeline = (await storage.get(timelineKey)) as Phase4Timeline | null;

    if (!timeline) {
      return {
        events: [],
        totalEventCount: 0,
        lastUpdatedAt: new Date().toISOString(),
        isAvailable: true,
        unavailableReason: undefined,
      };
    }

    // Return immutable copy
    return {
      events: timeline.events.slice(), // Shallow copy of events array
      totalEventCount: timeline.totalEvents,
      lastUpdatedAt: timeline.lastUpdatedAt,
      isAvailable: true,
    };
  } catch (error) {
    return {
      events: [],
      totalEventCount: 0,
      lastUpdatedAt: new Date().toISOString(),
      isAvailable: false,
      unavailableReason: `Failed to retrieve timeline: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Detect changes in Jira settings by comparing Phase 2 metric deltas.
 * Returns array of detected changes (or empty array if none).
 * 
 * SEALED SPEC: Only detects changes from Phase 2 deltas.
 * Does NOT call Jira API directly.
 */
export async function detectChanges(
  cloudId: string,
  currentMetrics: Record<string, any>
): Promise<Phase4ChangeEvent[]> {
  if (!cloudId || typeof cloudId !== 'string' || cloudId.trim() === '') {
    return [];
  }

  try {
    const metricsKey = getPhase2MetricsKey(cloudId);
    const previousMetrics = (await storage.get(metricsKey)) as Record<string, any> | null;

    // No previous snapshot means no deltas to detect
    if (!previousMetrics) {
      return [];
    }

    const changes: Phase4ChangeEvent[] = [];
    const now = new Date().toISOString();

    // Detect delta changes in key Jira configuration metrics
    const metricsToTrack = [
      'customFieldCount',
      'workflowCount',
      'workflowSchemeCount',
      'screenCount',
      'permissionSchemeCount',
      'maxWorkflowsPerScheme',
      'maxProjectsPerPermissionScheme',
    ];

    for (const metricKey of metricsToTrack) {
      const prevValue = previousMetrics[metricKey];
      const currValue = currentMetrics[metricKey];

      // Only record if value actually changed
      if (prevValue !== currValue && currValue !== undefined) {
        changes.push({
          id: `${now}_${metricKey}`,
          detectedAt: now,
          changeType: 'JIRA_SETTING_CHANGED',
          settingKey: metricKey,
          description: `Jira setting "${metricKey}" changed`,
          previousValue: prevValue ?? null,
          currentValue: currValue ?? null,
          sourceMetric: `phase2:${metricKey}`,
          recordedAt: now,
        });
      }
    }

    return changes;
  } catch (error) {
    // Fail silently - do not propagate errors to scheduler
    console.error(`[Phase4] Error detecting changes: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

/**
 * Append changes to the timeline (append-only operation).
 * Creates timeline if it doesn't exist.
 * Returns the updated timeline.
 */
export async function appendChanges(
  cloudId: string,
  newEvents: Phase4ChangeEvent[]
): Promise<Phase4Timeline> {
  if (!cloudId || typeof cloudId !== 'string' || cloudId.trim() === '') {
    throw new Error('Invalid cloud ID for Phase 4 timeline append');
  }

  if (!Array.isArray(newEvents) || newEvents.length === 0) {
    // No changes to append - return current timeline
    const timelineKey = getTimelineKey(cloudId);
    const existing = (await storage.get(timelineKey)) as Phase4Timeline | null;
    return existing || {
      cloudId,
      events: [],
      lastUpdatedAt: new Date().toISOString(),
      totalEvents: 0,
    };
  }

  try {
    const timelineKey = getTimelineKey(cloudId);
    const now = new Date().toISOString();

    // Fetch current timeline
    let timeline = (await storage.get(timelineKey)) as Phase4Timeline | null;
    if (!timeline) {
      timeline = {
        cloudId,
        events: [],
        lastUpdatedAt: now,
        totalEvents: 0,
      };
    }

    // Append new events (most recent first)
    timeline.events = [...newEvents, ...timeline.events];
    timeline.lastUpdatedAt = now;
    timeline.totalEvents = timeline.events.length;

    // Store updated timeline
    await storage.set(timelineKey, timeline);

    return timeline;
  } catch (error) {
    throw new Error(
      `Failed to append changes to Phase 4 timeline: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get scheduler state for Phase 4 DAILY run.
 */
export async function getSchedulerState(cloudId: string): Promise<Phase4SchedulerState> {
  if (!cloudId || typeof cloudId !== 'string' || cloudId.trim() === '') {
    return {
      cloudId,
      lastRunAt: null,
      lastSuccessAt: null,
      lastFailureReason: null,
      lastDetectedChanges: 0,
      recordedAt: new Date().toISOString(),
    };
  }

  try {
    const stateKey = getSchedulerStateKey(cloudId);
    const state = (await storage.get(stateKey)) as Phase4SchedulerState | null;

    if (!state) {
      return {
        cloudId,
        lastRunAt: null,
        lastSuccessAt: null,
        lastFailureReason: null,
        lastDetectedChanges: 0,
        recordedAt: new Date().toISOString(),
      };
    }

    return state;
  } catch (error) {
    return {
      cloudId,
      lastRunAt: null,
      lastSuccessAt: null,
      lastFailureReason: `Error retrieving state: ${error instanceof Error ? error.message : String(error)}`,
      lastDetectedChanges: 0,
      recordedAt: new Date().toISOString(),
    };
  }
}

/**
 * Update scheduler state after DAILY run.
 * Records success/failure and number of changes detected.
 */
export async function updateSchedulerState(
  cloudId: string,
  result: Phase4SchedulerResult
): Promise<void> {
  if (!cloudId || typeof cloudId !== 'string' || cloudId.trim() === '') {
    return;
  }

  try {
    const stateKey = getSchedulerStateKey(cloudId);
    const now = new Date().toISOString();

    const state: Phase4SchedulerState = {
      cloudId,
      lastRunAt: now,
      lastSuccessAt: result.success ? now : null,
      lastFailureReason: result.success ? null : (result.errorReason || 'Unknown error'),
      lastDetectedChanges: result.changesDetected,
      recordedAt: now,
    };

    await storage.set(stateKey, state);
  } catch (error) {
    console.error(
      `[Phase4] Error updating scheduler state: ${error instanceof Error ? error.message : String(error)}`
    );
    // Fail silently - do not propagate
  }
}

/**
 * Save current metrics snapshot for next delta detection.
 * Must be called AFTER changes are detected and appended.
 */
export async function updateMetricsSnapshot(
  cloudId: string,
  metrics: Record<string, any>
): Promise<void> {
  if (!cloudId || typeof cloudId !== 'string' || cloudId.trim() === '') {
    return;
  }

  try {
    const metricsKey = getPhase2MetricsKey(cloudId);
    await storage.set(metricsKey, metrics);
  } catch (error) {
    console.error(
      `[Phase4] Error updating metrics snapshot: ${error instanceof Error ? error.message : String(error)}`
    );
    // Fail silently
  }
}
