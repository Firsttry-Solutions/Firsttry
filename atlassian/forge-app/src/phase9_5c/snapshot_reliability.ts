/**
 * PHASE 9.5-C: SNAPSHOT RELIABILITY SLA
 *
 * Measures FirstTry's own reliability in capturing governance evidence.
 * Computes reliability metrics purely from snapshot_runs table.
 * Does NOT measure Jira reliability - only FirstTry's ability to snapshot.
 *
 * Core invariants:
 * - Metrics derived ONLY from snapshot_runs
 * - No good/bad threshold labels (no interpretation)
 * - Reliability windows: 7/30/90 day rolling
 * - Auto-notification ONLY for FirstTry failures (not Jira issues)
 * - Last successful run must be < X days ago to trigger alert
 */

import crypto from 'crypto';

// ============================================================================
// TYPE DEFINITIONS: SNAPSHOT RUN TRACKING
// ============================================================================

/**
 * Outcome of a single snapshot attempt
 */
export type SnapshotRunStatus =
  | 'scheduled'   // Task scheduled but not yet run
  | 'successful'  // Snapshot captured all required data
  | 'partial'     // Snapshot captured some data (degraded service)
  | 'failed';     // Snapshot failed entirely

/**
 * Record of a single snapshot execution
 */
export interface SnapshotRun {
  run_id: string;
  tenant_id: string;
  scheduled_at: string;         // ISO 8601 UTC - when job was scheduled
  started_at: string;           // ISO 8601 UTC - when execution began
  completed_at: string;         // ISO 8601 UTC - when execution ended
  status: SnapshotRunStatus;
  duration_ms: number;          // Wall-clock execution time
  rate_limit_hit: boolean;      // True if Jira rate limiting occurred
  error_code?: string;          // Error code if failed
  error_message?: string;       // Human-readable error
}

// ============================================================================
// TYPE DEFINITIONS: RELIABILITY METRICS
// ============================================================================

/**
 * Reliability metrics for a time window
 */
export interface WindowReliabilityMetrics {
  window_days: 7 | 30 | 90;
  window_start: string;         // ISO 8601 UTC
  window_end: string;           // ISO 8601 UTC
  total_scheduled: number;      // All scheduled runs in window
  successful_runs: number;      // status === 'successful'
  partial_runs: number;         // status === 'partial'
  failed_runs: number;          // status === 'failed'
  success_rate: number;         // (successful_runs / total_scheduled) * 100
  success_or_partial_rate: number;  // (successful_runs + partial_runs) / total_scheduled
  mean_duration_ms: number;     // Average duration of all runs
  rate_limit_incidents: number; // Count of runs with rate_limit_hit
}

/**
 * FirstTry's snapshot reliability status
 */
export interface SnapshotReliabilityStatus {
  tenant_id: string;
  computed_at: string;          // ISO 8601 UTC
  
  // Last run information
  last_scheduled_run_at: string | 'NEVER';  // ISO 8601 UTC or never
  last_completed_run_at: string | 'NEVER';  // ISO 8601 UTC or never
  last_run_status: SnapshotRunStatus | 'NEVER';
  last_run_days_ago: number | null;  // Days since last completed run (null if never)
  
  // Reliability windows
  metrics_7_day: WindowReliabilityMetrics;
  metrics_30_day: WindowReliabilityMetrics;
  metrics_90_day: WindowReliabilityMetrics;
  
  // Alert conditions (NOT thresholds - just factual tracking)
  no_successful_run_days: number;  // Days since last successful run
  consecutive_failures: number;    // Count of consecutive failed runs at end
  
  // Integrity
  canonical_hash: string;        // SHA-256 for integrity
  schema_version: '1.0';
}

/**
 * Alert trigger condition (factual, not evaluated)
 */
export interface ReliabilityAlertCondition {
  name: string;  // 'no_successful_run_since_X_days' | 'consecutive_failures_count'
  is_triggered: boolean;
  details: Record<string, unknown>;
}

/**
 * Notification sent when FirstTry reliability degrades
 */
export interface ReliabilityNotification {
  notification_id: string;
  tenant_id: string;
  created_at: string;            // ISO 8601 UTC
  alert_conditions: ReliabilityAlertCondition[];
  reliability_status_snapshot: SnapshotReliabilityStatus;
  notification_channel: 'admin_ui' | 'email';
  sent_at: string | null;        // ISO 8601 UTC or null if pending
  acknowledged_at: string | null; // ISO 8601 UTC or null if unacknowledged
}

// ============================================================================
// RELIABILITY COMPUTATION ENGINE
// ============================================================================

/**
 * Computes reliability metrics for a single window
 */
export function computeWindowMetrics(
  tenant_id: string,
  runs: SnapshotRun[],
  window_days: 7 | 30 | 90
): WindowReliabilityMetrics {
  const now = new Date();
  const windowStart = new Date(now.getTime() - window_days * 24 * 60 * 60 * 1000);
  const windowStartISO = windowStart.toISOString();
  const windowEndISO = now.toISOString();

  // Filter runs in window
  const windowRuns = runs.filter(run => {
    const runTime = new Date(run.completed_at);
    return runTime >= windowStart && runTime <= now;
  });

  // Count statuses
  const successful = windowRuns.filter(r => r.status === 'successful').length;
  const partial = windowRuns.filter(r => r.status === 'partial').length;
  const failed = windowRuns.filter(r => r.status === 'failed').length;
  const total = successful + partial + failed;

  // Compute rates
  const successRate = total > 0 ? (successful / total) * 100 : 0;
  const successOrPartialRate = total > 0 ? ((successful + partial) / total) * 100 : 0;

  // Mean duration
  const meanDuration = windowRuns.length > 0
    ? windowRuns.reduce((sum, r) => sum + r.duration_ms, 0) / windowRuns.length
    : 0;

  // Rate limit incidents
  const rateLimitIncidents = windowRuns.filter(r => r.rate_limit_hit).length;

  return {
    window_days,
    window_start: windowStartISO,
    window_end: windowEndISO,
    total_scheduled: windowRuns.length,
    successful_runs: successful,
    partial_runs: partial,
    failed_runs: failed,
    success_rate: Math.round(successRate * 100) / 100,
    success_or_partial_rate: Math.round(successOrPartialRate * 100) / 100,
    mean_duration_ms: Math.round(meanDuration),
    rate_limit_incidents: rateLimitIncidents,
  };
}

/**
 * Computes snapshot reliability status from run history
 */
export function computeReliabilityStatus(
  tenant_id: string,
  runs: SnapshotRun[]
): SnapshotReliabilityStatus {
  // Sort by completion time
  const sortedRuns = [...runs].sort(
    (a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()
  );

  // Find last completed run
  const lastRun = sortedRuns[0];
  const lastCompletedAt = lastRun ? lastRun.completed_at : 'NEVER';
  const lastDaysAgo = lastRun
    ? Math.floor(
        (new Date().getTime() - new Date(lastRun.completed_at).getTime()) / (24 * 60 * 60 * 1000)
      )
    : null;

  // Find last successful run
  const lastSuccessful = sortedRuns.find(r => r.status === 'successful');
  const noSuccessfulDays = lastSuccessful
    ? Math.floor(
        (new Date().getTime() - new Date(lastSuccessful.completed_at).getTime()) /
          (24 * 60 * 60 * 1000)
      )
    : runs.length > 0 ? 999999 : 0; // If runs exist but none successful, high count

  // Count consecutive failures at end of runs
  let consecutiveFailures = 0;
  for (const run of sortedRuns) {
    if (run.status === 'failed') {
      consecutiveFailures++;
    } else {
      break;
    }
  }

  // Find first scheduled run in history
  const allScheduled = runs.map(r => new Date(r.scheduled_at)).sort((a, b) => a.getTime() - b.getTime());
  const firstScheduledAt = allScheduled.length > 0 ? allScheduled[0].toISOString() : 'NEVER';

  // Compute windows
  const metrics7 = computeWindowMetrics(tenant_id, runs, 7);
  const metrics30 = computeWindowMetrics(tenant_id, runs, 30);
  const metrics90 = computeWindowMetrics(tenant_id, runs, 90);

  const status: SnapshotReliabilityStatus = {
    tenant_id,
    computed_at: new Date().toISOString(),
    last_scheduled_run_at: firstScheduledAt, // Will be overridden below if we have runs
    last_completed_run_at: lastCompletedAt,
    last_run_status: lastRun?.status || 'NEVER',
    last_run_days_ago: lastDaysAgo,
    metrics_7_day: metrics7,
    metrics_30_day: metrics30,
    metrics_90_day: metrics90,
    no_successful_run_days: noSuccessfulDays,
    consecutive_failures: consecutiveFailures,
    canonical_hash: '', // Will be set after JSON serialization
    schema_version: '1.0',
  };

  // Update last_scheduled_run_at with actual value
  const lastScheduled = sortedRuns[0]?.scheduled_at;
  if (lastScheduled) {
    status.last_scheduled_run_at = lastScheduled;
  }

  // Compute hash
  const canonical = JSON.stringify(
    {
      tenant_id: status.tenant_id,
      metrics_7_day: status.metrics_7_day,
      metrics_30_day: status.metrics_30_day,
      metrics_90_day: status.metrics_90_day,
      no_successful_run_days: status.no_successful_run_days,
      consecutive_failures: status.consecutive_failures,
    },
    null,
    0
  );
  status.canonical_hash = crypto.createHash('sha256').update(canonical).digest('hex');

  return status;
}

// ============================================================================
// ALERT CONDITION DETECTION (FACTUAL)
// ============================================================================

/**
 * Detects alert conditions without threshold judgment
 * Returns conditions that should trigger notifications
 */
export function detectReliabilityAlertConditions(
  status: SnapshotReliabilityStatus,
  config: {
    no_successful_run_threshold_days: number;  // Alert if no successful run since X days
    consecutive_failures_threshold: number;     // Alert if X consecutive failures
  }
): ReliabilityAlertCondition[] {
  const conditions: ReliabilityAlertCondition[] = [];

  // Condition 1: No successful run since threshold
  conditions.push({
    name: 'no_successful_run_since_X_days',
    is_triggered: status.no_successful_run_days > config.no_successful_run_threshold_days,
    details: {
      threshold_days: config.no_successful_run_threshold_days,
      actual_days: status.no_successful_run_days,
    },
  });

  // Condition 2: Consecutive failures
  conditions.push({
    name: 'consecutive_failures_count',
    is_triggered: status.consecutive_failures >= config.consecutive_failures_threshold,
    details: {
      threshold_count: config.consecutive_failures_threshold,
      actual_count: status.consecutive_failures,
    },
  });

  return conditions;
}

// ============================================================================
// NOTIFICATION GENERATION
// ============================================================================

/**
 * Creates a reliability notification from alert conditions
 * Only called when at least one condition is triggered
 */
export function createReliabilityNotification(
  tenant_id: string,
  conditions: ReliabilityAlertCondition[],
  status: SnapshotReliabilityStatus,
  channel: 'admin_ui' | 'email' = 'admin_ui'
): ReliabilityNotification {
  const notificationId = crypto.randomBytes(16).toString('hex');

  return {
    notification_id: notificationId,
    tenant_id,
    created_at: new Date().toISOString(),
    alert_conditions: conditions.filter(c => c.is_triggered),
    reliability_status_snapshot: status,
    notification_channel: channel,
    sent_at: null,
    acknowledged_at: null,
  };
}

/**
 * Marks notification as sent
 */
export function markNotificationSent(
  notification: ReliabilityNotification
): ReliabilityNotification {
  return {
    ...notification,
    sent_at: new Date().toISOString(),
  };
}

/**
 * Acknowledges a notification (admin action)
 */
export function acknowledgeNotification(
  notification: ReliabilityNotification
): ReliabilityNotification {
  return {
    ...notification,
    acknowledged_at: new Date().toISOString(),
  };
}

// ============================================================================
// ENFORCEMENT: FirstTry-ONLY ALERTS
// ============================================================================

/**
 * CRITICAL RULE: Reliability alerts are ONLY about FirstTry's snapshot capability.
 * Filters conditions to ensure no Jira-related alerts are included.
 * Only FirstTry execution failures trigger alerts.
 */
export function enforceFirstTryOnlyAlerts(
  conditions: ReliabilityAlertCondition[]
): ReliabilityAlertCondition[] {
  // Only return conditions about FirstTry's snapshot runs
  // (not about Jira issues, permission problems, etc.)
  return conditions.filter(cond => {
    // Accept only FirstTry execution metrics
    return (
      cond.name === 'no_successful_run_since_X_days' ||
      cond.name === 'consecutive_failures_count'
    );
  });
}

/**
 * Validates that a notification contains only FirstTry failures
 */
export function validateFirstTryOnlyNotification(
  notification: ReliabilityNotification
): { valid: boolean; reason?: string } {
  const triggeredConditions = notification.alert_conditions.filter(c => c.is_triggered);

  // All conditions must be FirstTry execution metrics
  for (const cond of triggeredConditions) {
    if (
      !['no_successful_run_since_X_days', 'consecutive_failures_count'].includes(cond.name)
    ) {
      return {
        valid: false,
        reason: `Invalid condition for FirstTry alert: ${cond.name}`,
      };
    }
  }

  return { valid: true };
}
