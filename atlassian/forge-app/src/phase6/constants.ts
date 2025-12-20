/**
 * PHASE 6 v2: SNAPSHOT EVIDENCE LEDGER
 * 
 * Core constants and enumerations for snapshot capture.
 * 
 * Principles:
 * - Immutable append-only evidence ledger
 * - Deterministic canonicalization + sha256 hashing
 * - Explicit missing-data disclosure
 * - Tenant isolation (all keys prefixed by tenant_id)
 * - READ-ONLY Jira access (no write endpoints)
 */

/**
 * Snapshot run error codes
 * Used in snapshot_runs to indicate why capture failed or was partial
 */
export enum ErrorCode {
  NONE = 'NONE',
  RATE_LIMIT = 'RATE_LIMIT',
  PERMISSION_REVOKED = 'PERMISSION_REVOKED',
  API_ERROR = 'API_ERROR',
  TIMEOUT = 'TIMEOUT',
  PARTIAL_CAPTURE = 'PARTIAL_CAPTURE',
  UNKNOWN = 'UNKNOWN',
}

/**
 * Dataset coverage status
 * Explains why a dataset is missing from snapshot
 */
export enum CoverageStatus {
  AVAILABLE = 'AVAILABLE',
  PARTIAL = 'PARTIAL',
  MISSING = 'MISSING',
  NOT_PERMITTED_BY_SCOPE = 'NOT_PERMITTED_BY_SCOPE',
}

/**
 * Snapshot type: daily or weekly
 * Determines which datasets are captured
 */
export type SnapshotType = 'daily' | 'weekly';

/**
 * Run status
 */
export type SnapshotRunStatus = 'success' | 'partial' | 'failed';

/**
 * Clock source: where timestamp came from
 */
export type ClockSource = 'system' | 'jira' | 'unknown';

/**
 * Deletion strategy for retention
 */
export type DeletionStrategy = 'FIFO';

/**
 * Uninstall behavior
 */
export type UninstallBehavior = 'purge_immediate' | 'retain_for_days' | 'admin_confirmed_purge';

/**
 * Reason code for missing data
 */
export enum MissingDataReasonCode {
  PERMISSION_DENIED = 'permission_denied',
  NOT_CONFIGURED = 'not_configured',
  API_UNAVAILABLE = 'api_unavailable',
  EMPTY = 'empty',
  RATE_LIMITED = 'rate_limited',
  UNKNOWN = 'unknown',
}

/**
 * Default retention policy limits
 */
export const DEFAULT_RETENTION_POLICY = {
  max_days: 90,
  max_records_daily: 90,
  max_records_weekly: 52,
  deletion_strategy: 'FIFO' as DeletionStrategy,
  uninstall_behavior: 'retain_for_days' as UninstallBehavior,
  uninstall_retain_days: 90,
};

/**
 * Timeout limits per snapshot type
 */
export const TIMEOUT_LIMITS = {
  daily: 2 * 60 * 1000,    // 2 minutes
  weekly: 5 * 60 * 1000,   // 5 minutes
} as const;

/**
 * Per-API-call timeout
 */
export const API_CALL_TIMEOUT = 10 * 1000; // 10 seconds

/**
 * Max retries per API endpoint
 */
export const MAX_RETRIES = 3;

/**
 * Backoff durations in milliseconds
 */
export const BACKOFF_DURATIONS = {
  first: 30 * 60 * 1000,    // 30 minutes
  second: 120 * 60 * 1000,  // 120 minutes
  third: 24 * 60 * 60 * 1000, // 24 hours
} as const;

/**
 * Hash algorithm (must be sha256 for determinism)
 */
export const HASH_ALGORITHM = 'sha256' as const;

/**
 * Storage key prefixes
 */
export const STORAGE_PREFIXES = {
  snapshot_run: 'phase6:snapshot_run',
  snapshot: 'phase6:snapshot',
  retention_policy: 'phase6:retention_policy',
  snapshot_index: 'phase6:snapshot_index', // For pagination
} as const;

/**
 * Idempotency key for scheduled runs
 * Format: {tenant_id}:{snapshot_type}:{window_start_date}
 */
export function getIdempotencyKey(
  tenantId: string,
  snapshotType: SnapshotType,
  windowStartISO: string
): string {
  return `${tenantId}:${snapshotType}:${windowStartISO}`;
}

/**
 * Storage key for snapshot run
 */
export function getSnapshotRunKey(tenantId: string, runId: string): string {
  return `${STORAGE_PREFIXES.snapshot_run}:${tenantId}:${runId}`;
}

/**
 * Storage key for snapshot
 */
export function getSnapshotKey(tenantId: string, snapshotId: string): string {
  return `${STORAGE_PREFIXES.snapshot}:${tenantId}:${snapshotId}`;
}

/**
 * Storage key for retention policy
 */
export function getRetentionPolicyKey(tenantId: string): string {
  return `${STORAGE_PREFIXES.retention_policy}:${tenantId}`;
}

/**
 * Storage key for snapshot index (for pagination)
 * Format: {prefix}:{tenantId}:{type}:{page}
 */
export function getSnapshotIndexKey(tenantId: string, snapshotType: SnapshotType, page: number = 0): string {
  return `${STORAGE_PREFIXES.snapshot_index}:${tenantId}:${snapshotType}:${page}`;
}

/**
 * Jira API endpoints whitelisted for read-only access
 * Used for no-write enforcement tests
 */
export const ALLOWED_JIRA_ENDPOINTS = [
  '/rest/api/3/projects',
  '/rest/api/3/projects/{projectIdOrKey}',
  '/rest/api/3/issuetypes',
  '/rest/api/3/statuses',
  '/rest/api/3/fields',
  '/rest/api/3/issues/search',
  '/rest/api/3/workflows',
  '/rest/api/3/automation/rules',
  // Add others as discovered from Phase 4-5
] as const;

/**
 * Daily snapshot datasets
 * Must include: Projects, Fields, Workflows, Automation
 */
export const DAILY_SNAPSHOT_DATASETS = [
  'project_inventory',      // IDs + names
  'field_metadata',         // IDs + basic metadata
  'workflow_inventory',     // Names/IDs (not full definitions)
  'automation_inventory',   // IDs + names only
] as const;

/**
 * Weekly snapshot datasets
 * Includes everything from daily PLUS full definitions
 */
export const WEEKLY_SNAPSHOT_DATASETS = [
  ...DAILY_SNAPSHOT_DATASETS,
  'workflow_structures',    // Full read-only definitions
  'field_requirements',     // Requirement flags
  'automation_definitions', // Full definitions as allowed
] as const;
