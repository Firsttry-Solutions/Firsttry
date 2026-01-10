/**
 * PERF SIGNALS SCHEDULER
 * 
 * Scheduled trigger that computes and stores PerfSignalsSnapshot.
 * 
 * Rules:
 * - Tenant identity guard (fail-closed)
 * - Requires scheduler data from storage
 * - Reads Jira request records from global buffer
 * - Stores latest snapshot in tenant-scoped key
 * 
 * Last failure reason:
 * - max 160 chars
 * - remove stack traces
 * - remove secrets
 * - plain text only
 */

import { storage } from '@forge/api';
import { resolveTenantIdentity } from '../core/tenant_identity';
import { getRecordedRequests } from '../core/perf_signals/jira_get_wrapper';
import { computePerfSignalsSnapshot } from '../core/perf_signals/computeSnapshot';

const PERF_SNAPSHOT_KEY_PREFIX = 'perf_signals:snapshot';
const SCHEDULER_DATA_KEY_PREFIX = 'perf_signals:scheduler_data';

function getSnapshotKey(cloudId: string): string {
  if (!cloudId || cloudId.trim() === '') {
    return '';
  }
  return `${PERF_SNAPSHOT_KEY_PREFIX}:${cloudId}`;
}

function getSchedulerDataKey(cloudId: string): string {
  if (!cloudId || cloudId.trim() === '') {
    return '';
  }
  return `${SCHEDULER_DATA_KEY_PREFIX}:${cloudId}`;
}

/**
 * Sanitize failure reason to max 160 chars, remove traces/secrets.
 */
function sanitizeFailureReason(reason: string): string {
  if (!reason) {
    return '';
  }

  // Remove stack traces (lines with at, stack, etc)
  let sanitized = reason.split('\n')[0]; // Take first line only

  // Remove common secret patterns
  sanitized = sanitized.replace(/bearer\s+[a-z0-9]+/gi, 'bearer ***');
  sanitized = sanitized.replace(/token[=:]\s*[a-z0-9]+/gi, 'token=***');
  sanitized = sanitized.replace(/key[=:]\s*[a-z0-9]+/gi, 'key=***');

  // Truncate to 160 chars
  if (sanitized.length > 160) {
    sanitized = sanitized.substring(0, 157) + '...';
  }

  return sanitized;
}

/**
 * Run the scheduler.
 */
export async function run(request: any, context: any): Promise<void> {
  try {
    // Tenant identity guard
    const tenantId = resolveTenantIdentity(context);
    if (!tenantId || !tenantId.cloudId) {
      console.warn('[PerfSignals] Tenant identity unavailable. Skipping run.');
      return;
    }

    const cloudId = tenantId.cloudId;
    const nowISO = new Date().toISOString();

    // Load scheduler data from storage
    const schedulerDataKey = getSchedulerDataKey(cloudId);
    const schedulerData = await storage.get(schedulerDataKey);

    // Get Jira request records from buffer
    const jiraRecords = getRecordedRequests();

    // Compute snapshot
    const snapshot = computePerfSignalsSnapshot(
      nowISO,
      schedulerData || null,
      jiraRecords
    );

    // Store snapshot
    const snapshotKey = getSnapshotKey(cloudId);
    if (snapshotKey) {
      await storage.set(snapshotKey, snapshot);
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[PerfSignals] Scheduler error:', errorMsg);
    // Fail silently - do not throw
  }
}

/**
 * Store scheduler data (called by other components).
 * Used to record last run, success, duration, and failure reason.
 */
export async function storeSchedulerData(
  cloudId: string,
  data: {
    lastRunAtISO?: string;
    lastSuccessAtISO?: string;
    lastDurationMs?: number;
    consecutiveSuccessDays?: number;
    lastFailureReason?: string;
  }
): Promise<void> {
  try {
    const key = getSchedulerDataKey(cloudId);
    if (!key) {
      return;
    }

    // Sanitize failure reason
    const sanitized = {
      ...data,
      lastFailureReason: data.lastFailureReason
        ? sanitizeFailureReason(data.lastFailureReason)
        : null,
    };

    await storage.set(key, sanitized);
  } catch (error) {
    console.error('[PerfSignals] Failed to store scheduler data:', error);
  }
}
