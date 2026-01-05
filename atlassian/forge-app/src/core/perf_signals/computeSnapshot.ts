/**
 * PERF SIGNALS SNAPSHOT COMPUTATION
 * 
 * Computes PerfSignalsSnapshot from:
 * - Scheduler data (if available from storage)
 * - Jira API request records (from buffer)
 * 
 * Rules:
 * - EMPTY: no scheduler data AND no Jira API data
 * - PARTIAL: scheduler XOR Jira API
 * - COMPLETE: both
 */

import { PerfSignalsSnapshot, LatencySummary, RateLimitSignal } from './types';
import { computeLatencySummary } from './percentiles';
import { RequestRecord } from './jira_get_wrapper';

/**
 * Compute rate limit signal from request records.
 */
function computeRateLimitSignal(records: RequestRecord[]): RateLimitSignal {
  // Find the most recent rate limit info
  let remaining: number | null = null;
  let limit: number | null = null;
  let resetEpoch: number | null = null;

  for (let i = records.length - 1; i >= 0; i--) {
    const rec = records[i];
    if (!remaining && rec.rateLimitRemaining !== undefined) {
      remaining = rec.rateLimitRemaining;
    }
    if (!limit && rec.rateLimitLimit !== undefined) {
      limit = rec.rateLimitLimit;
    }
    if (!resetEpoch && rec.rateLimitResetEpochSeconds !== undefined) {
      resetEpoch = rec.rateLimitResetEpochSeconds;
    }
    if (remaining && limit) {
      break;
    }
  }

  // Determine availability
  const available = remaining !== null || limit !== null || resetEpoch !== null;
  const note = available ? 'available' : 'Not available';

  return {
    available,
    remaining,
    limit,
    resetEpochSeconds: resetEpoch || null,
    note,
  };
}

/**
 * Compute latency summary from request records.
 */
function computeLatency(records: RequestRecord[]): LatencySummary {
  const durations = records.map((r) => r.durationMs);
  return computeLatencySummary(durations);
}

/**
 * Compute completeness.
 */
function computeCompleteness(
  hasSchedulerData: boolean,
  hasJiraApiData: boolean
): 'COMPLETE' | 'PARTIAL' | 'EMPTY' {
  if (!hasSchedulerData && !hasJiraApiData) {
    return 'EMPTY';
  }
  if (hasSchedulerData && hasJiraApiData) {
    return 'COMPLETE';
  }
  return 'PARTIAL';
}

/**
 * Compute snapshot.
 */
export function computePerfSignalsSnapshot(
  nowISO: string,
  schedulerData: {
    lastRunAtISO: string | null;
    lastSuccessAtISO: string | null;
    lastDurationMs: number | null;
    consecutiveSuccessDays: number | null;
    lastFailureReason: string | null;
  } | null,
  jiraRequestRecords: RequestRecord[]
): PerfSignalsSnapshot {
  const hasSchedulerData = schedulerData !== null;
  const hasJiraApiData = jiraRequestRecords.length > 0;

  // Build Jira API section
  const okCount = jiraRequestRecords.filter((r) => r.ok).length;
  const errorCount = jiraRequestRecords.length - okCount;

  const snapshot: PerfSignalsSnapshot = {
    evaluatedAtISO: nowISO,

    scheduler: schedulerData || {
      lastRunAtISO: null,
      lastSuccessAtISO: null,
      lastDurationMs: null,
      successCount7d: null,
      failureCount7d: null,
      consecutiveSuccessDays: null,
      lastFailureReason: null,
    },

    jiraApi: {
      window: 'last-24h',
      requestCount: jiraRequestRecords.length,
      errorCount,
      latency: computeLatency(jiraRequestRecords),
      rateLimit: computeRateLimitSignal(jiraRequestRecords),
    },

    mode: 'scheduled-read-only',
    boundaries: {
      noJiraWrites: true,
      noConfigChanges: true,
      noEnforcement: true,
    },
    completeness: computeCompleteness(hasSchedulerData, hasJiraApiData),
    issues: [],
  };

  return snapshot;
}
