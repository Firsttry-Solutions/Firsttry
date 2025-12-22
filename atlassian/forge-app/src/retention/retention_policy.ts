/**
 * P1.2: RETENTION POLICY SCHEMA
 *
 * Defines and enforces data retention TTLs for FirstTry Governance.
 * 
 * Requirements:
 * - Clear retention policy: 90-day TTL for all data
 * - Automated cleanup: scheduled job runs daily
 * - Enforcement: all storage writes respect retention boundaries
 * - Audit trail: cleanup results logged and metrics tracked
 * - Manifest config: retention job declared in manifest.yml
 *
 * Policy:
 * - Raw shards (raw/*): 90 days (deleted automatically)
 * - Daily aggregates (agg/daily/*): 90 days (deleted automatically)
 * - Weekly aggregates (agg/weekly/*): 90 days (deleted automatically)
 * - Metadata (index/*): kept indefinitely (tracks what was deleted)
 * - Config/install markers: kept indefinitely (required for operation)
 *
 * Safety:
 * - Only indexed keys are deleted (prevents accidental deletion of unrelated data)
 * - Errors are tracked and reported (never silent failures)
 * - Cleanup results are immutable (audit trail)
 * - TTL is version-controlled (policy_version in metadata)
 */

/**
 * Retention policy configuration
 */
export interface RetentionPolicy {
  // Policy versioning
  policy_version: string; // e.g., "1.0" - used for policy drift detection
  effective_date: string; // ISO date when policy became effective
  
  // TTL definitions (in days)
  raw_shard_ttl_days: number; // TTL for raw data shards
  daily_aggregate_ttl_days: number; // TTL for daily aggregates
  weekly_aggregate_ttl_days: number; // TTL for weekly aggregates
  
  // Cleanup schedule
  cleanup_schedule: string; // Cron expression (e.g., "0 2 * * *" = daily at 2 AM UTC)
  cleanup_timezone: string; // Timezone for cron execution
  
  // Retention scope
  scope: {
    delete_raw_shards: boolean; // Should raw data be deleted?
    delete_daily_aggregates: boolean; // Should daily aggs be deleted?
    delete_weekly_aggregates: boolean; // Should weekly aggs be deleted?
    preserve_metadata: boolean; // Always preserve index/* and config/*?
  };
  
  // Audit & compliance
  audit_mode: boolean; // If true, log what WOULD be deleted but don't delete
  require_approval: boolean; // If true, require manual approval for cleanup
}

/**
 * Default P1.2 retention policy (90-day TTL, daily cleanup at 2 AM UTC)
 */
export const DEFAULT_RETENTION_POLICY: RetentionPolicy = {
  policy_version: '1.0',
  effective_date: new Date().toISOString().split('T')[0],
  
  raw_shard_ttl_days: 90,
  daily_aggregate_ttl_days: 90,
  weekly_aggregate_ttl_days: 90,
  
  cleanup_schedule: '0 2 * * *', // Daily at 2 AM UTC
  cleanup_timezone: 'UTC',
  
  scope: {
    delete_raw_shards: true,
    delete_daily_aggregates: true,
    delete_weekly_aggregates: true,
    preserve_metadata: true,
  },
  
  audit_mode: false,
  require_approval: false,
};

/**
 * Cleanup execution result
 */
export interface CleanupExecutionResult {
  // Execution details
  execution_id: string; // Unique ID for this cleanup run
  executed_at: string; // ISO timestamp when cleanup ran
  policy_version: string; // Policy version used for this run
  
  // Results
  keys_deleted: string[]; // List of deleted keys
  keys_delete_failed: Array<{ key: string; error: string }>; // Failed deletions
  
  // Counts
  total_keys_scanned: number; // How many keys were evaluated
  total_keys_deleted: number; // How many keys were actually deleted
  total_errors: number; // How many deletions failed
  
  // Status
  status: 'success' | 'partial_success' | 'failed' | 'audit_mode'; // Execution status
  message: string; // Human-readable summary
  
  // Audit trail
  cutoff_date: string; // ISO date: data older than this was deleted
  duration_ms: number; // How long cleanup took
}

/**
 * Retention metadata (stored in storage, tracks policy and cleanup history)
 */
export interface RetentionMetadata {
  // Current policy
  active_policy: RetentionPolicy;
  policy_updated_at: string; // When policy was last updated
  
  // Cleanup history (last N runs)
  last_cleanup_execution: CleanupExecutionResult | null;
  cleanup_history: CleanupExecutionResult[]; // Last 10 executions
  
  // Metrics
  total_keys_deleted_all_time: number; // Cumulative count
  total_cleanup_executions: number; // Total runs (including failures)
  
  // Policy drift detection
  policy_drift_detected: boolean; // Flag if policy changed unexpectedly
  policy_drift_details?: string; // What changed
}

/**
 * Validate retention policy
 *
 * @param policy Policy to validate
 * @throws Error if policy is invalid
 */
export function validateRetentionPolicy(policy: RetentionPolicy): void {
  if (!policy.policy_version) {
    throw new Error('policy_version is required');
  }
  
  if (policy.raw_shard_ttl_days <= 0 || policy.raw_shard_ttl_days > 365 * 10) {
    throw new Error('raw_shard_ttl_days must be between 1 and 3650 days');
  }
  
  if (policy.daily_aggregate_ttl_days <= 0) {
    throw new Error('daily_aggregate_ttl_days must be positive');
  }
  
  if (policy.weekly_aggregate_ttl_days <= 0) {
    throw new Error('weekly_aggregate_ttl_days must be positive');
  }
  
  // TTLs should be compatible (e.g., weekly >= daily)
  if (policy.weekly_aggregate_ttl_days < policy.daily_aggregate_ttl_days) {
    console.warn('Warning: weekly_aggregate_ttl_days < daily_aggregate_ttl_days, weekly data may not exist');
  }
}

/**
 * Calculate cutoff date for retention
 *
 * @param nowISO Current date (ISO format)
 * @param ttl_days Number of days to retain
 * @returns Cutoff date (ISO format): delete data older than this
 */
export function calculateRetentionCutoffDate(nowISO: string, ttl_days: number): string {
  const now = new Date(nowISO);
  now.setUTCDate(now.getUTCDate() - ttl_days);
  
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * Check if a date is older than TTL
 *
 * @param dateStr Date to check (ISO format)
 * @param cutoffStr Cutoff date (ISO format)
 * @returns true if dateStr < cutoffStr (older than TTL)
 */
export function isDateOlderThanTTL(dateStr: string, cutoffStr: string): boolean {
  return dateStr < cutoffStr;
}

/**
 * Generate cleanup execution result
 *
 * @param execution_id Unique ID for this run
 * @param keys_deleted Keys that were deleted
 * @param failed_deletions Keys that failed to delete
 * @param cutoff_date Data older than this was deleted
 * @param duration_ms How long cleanup took
 * @returns Execution result
 */
export function createCleanupExecutionResult(
  execution_id: string,
  keys_deleted: string[],
  failed_deletions: Array<{ key: string; error: string }>,
  cutoff_date: string,
  duration_ms: number,
  policy_version: string = '1.0'
): CleanupExecutionResult {
  const total_keys_deleted = keys_deleted.length;
  const total_errors = failed_deletions.length;
  
  let status: 'success' | 'partial_success' | 'failed';
  if (total_errors === 0) {
    status = 'success';
  } else if (total_keys_deleted > 0) {
    status = 'partial_success';
  } else {
    status = 'failed';
  }
  
  const message = status === 'success'
    ? `Cleanup successful: deleted ${total_keys_deleted} keys`
    : status === 'partial_success'
    ? `Cleanup partially successful: deleted ${total_keys_deleted} keys, ${total_errors} errors`
    : `Cleanup failed: ${total_errors} errors, 0 keys deleted`;
  
  return {
    execution_id,
    executed_at: new Date().toISOString(),
    policy_version,
    keys_deleted,
    keys_delete_failed: failed_deletions,
    total_keys_scanned: keys_deleted.length + failed_deletions.length,
    total_keys_deleted,
    total_errors,
    status,
    message,
    cutoff_date,
    duration_ms,
  };
}

/**
 * Initialize retention metadata with default policy
 *
 * @returns Initial metadata
 */
export function initializeRetentionMetadata(): RetentionMetadata {
  return {
    active_policy: DEFAULT_RETENTION_POLICY,
    policy_updated_at: new Date().toISOString(),
    last_cleanup_execution: null,
    cleanup_history: [],
    total_keys_deleted_all_time: 0,
    total_cleanup_executions: 0,
    policy_drift_detected: false,
  };
}

/**
 * Update retention metadata after cleanup execution
 *
 * @param metadata Current metadata
 * @param result Cleanup execution result
 * @returns Updated metadata
 */
export function updateRetentionMetadata(
  metadata: RetentionMetadata,
  result: CleanupExecutionResult
): RetentionMetadata {
  return {
    ...metadata,
    last_cleanup_execution: result,
    cleanup_history: [result, ...metadata.cleanup_history].slice(0, 10), // Keep last 10
    total_keys_deleted_all_time: metadata.total_keys_deleted_all_time + result.total_keys_deleted,
    total_cleanup_executions: metadata.total_cleanup_executions + 1,
  };
}

/**
 * Detect policy drift
 *
 * Compare policy version and scope against baseline
 *
 * @param currentPolicy Current policy
 * @param baselinePolicy Baseline (from POLICY_BASELINE.txt)
 * @returns { drifted: boolean, details?: string }
 */
export function detectPolicyDrift(
  currentPolicy: RetentionPolicy,
  baselinePolicy: RetentionPolicy
): { drifted: boolean; details?: string } {
  // Check version
  if (currentPolicy.policy_version !== baselinePolicy.policy_version) {
    return {
      drifted: true,
      details: `Policy version changed: ${baselinePolicy.policy_version} → ${currentPolicy.policy_version}`,
    };
  }
  
  // Check TTLs
  if (currentPolicy.raw_shard_ttl_days !== baselinePolicy.raw_shard_ttl_days) {
    return {
      drifted: true,
      details: `raw_shard_ttl_days changed: ${baselinePolicy.raw_shard_ttl_days} → ${currentPolicy.raw_shard_ttl_days}`,
    };
  }
  
  if (currentPolicy.daily_aggregate_ttl_days !== baselinePolicy.daily_aggregate_ttl_days) {
    return {
      drifted: true,
      details: `daily_aggregate_ttl_days changed: ${baselinePolicy.daily_aggregate_ttl_days} → ${currentPolicy.daily_aggregate_ttl_days}`,
    };
  }
  
  // Check scope
  const baselineScope = JSON.stringify(baselinePolicy.scope);
  const currentScope = JSON.stringify(currentPolicy.scope);
  if (baselineScope !== currentScope) {
    return {
      drifted: true,
      details: `Retention scope changed`,
    };
  }
  
  return { drifted: false };
}
