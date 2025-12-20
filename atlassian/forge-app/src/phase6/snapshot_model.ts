/**
 * PHASE 6 v2: SNAPSHOT DATA MODEL
 * 
 * Interfaces for:
 * - Snapshot runs (execution records)
 * - Snapshots (immutable evidence)
 * - Retention policies (deletion rules)
 * - Missing data disclosures
 */

import {
  ErrorCode,
  CoverageStatus,
  SnapshotType,
  SnapshotRunStatus,
  ClockSource,
  DeletionStrategy,
  UninstallBehavior,
  MissingDataReasonCode,
} from './constants';

/**
 * Explicit missing-data disclosure
 * When a dataset is expected but not available, document why
 */
export interface MissingDataItem {
  dataset_name: string;
  coverage_status: CoverageStatus;
  reason_code: MissingDataReasonCode;
  reason_detail: string;
  last_attempt_at?: string; // ISO 8601
  retry_count: number;
}

/**
 * Input provenance: what was queried and what scope was used
 */
export interface InputProvenance {
  // Endpoints queried
  endpoints_queried: string[];
  // Scopes available to this app
  available_scopes: string[];
  // Filters applied (e.g., "active projects only", "enabled workflows only")
  filters_applied: string[];
  // Sampling info (if any)
  sampling?: {
    strategy: 'none' | 'random' | 'stratified';
    sample_size?: number;
  };
}

/**
 * Snapshot run: execution record
 * One record created per scheduled run (daily or weekly)
 */
export interface SnapshotRun {
  // Identification
  tenant_id: string;
  cloud_id: string;
  run_id: string; // UUID
  
  // Scheduling
  scheduled_for: string; // ISO 8601 datetime (what time it was scheduled for)
  snapshot_type: SnapshotType;
  
  // Timing
  started_at: string; // ISO 8601
  finished_at: string; // ISO 8601
  
  // Outcome
  status: SnapshotRunStatus;
  error_code: ErrorCode;
  error_detail?: string;
  
  // Execution metrics
  api_calls_made: number;
  rate_limit_hits_count: number;
  duration_ms: number;
  
  // Output
  produced_snapshot_id?: string; // UUID if status = success or partial
  
  // Schema versioning
  schema_version: string;
  
  // Idempotency
  produced_canonical_hash?: string; // SHA256 of snapshot payload (deterministic)
  hash_algorithm: 'sha256';
  
  // Clock source (for audit trail)
  clock_source: ClockSource;
}

/**
 * Snapshot: immutable evidence record
 * Never modified after creation; only appended to storage
 */
export interface Snapshot {
  // Identification
  tenant_id: string;
  cloud_id: string;
  snapshot_id: string; // UUID
  
  // Metadata
  captured_at: string; // ISO 8601
  snapshot_type: SnapshotType;
  
  // Schema versioning
  schema_version: string;
  
  // Canonicalization (deterministic hashing)
  canonical_hash: string; // SHA256
  hash_algorithm: 'sha256';
  
  // Clock source
  clock_source: ClockSource;
  
  // Scope information
  scope: {
    projects_included: string[]; // Project keys or IDs (can be "ALL")
    projects_excluded: string[]; // Project keys to exclude
  };
  
  // Input provenance
  input_provenance: InputProvenance;
  
  // Missing data disclosure
  missing_data: MissingDataItem[];
  
  // The actual payload (JSON object)
  // Structure depends on snapshot_type:
  // - daily: { projects, fields, workflows, automation }
  // - weekly: { projects, fields, workflows, automation, workflow_structures, field_requirements, automation_definitions }
  payload: Record<string, any>;
}

/**
 * Retention policy: governs when snapshots are auto-deleted
 */
export interface RetentionPolicy {
  // Identification
  tenant_id: string;
  
  // Deletion limits
  max_days: number;
  max_records_daily: number;
  max_records_weekly: number;
  deletion_strategy: DeletionStrategy;
  
  // Uninstall behavior
  uninstall_behavior: UninstallBehavior;
  uninstall_retain_days?: number; // Days to retain after uninstall (v2 uses this)
  
  // Metadata
  created_at: string; // ISO 8601
  updated_at: string; // ISO 8601
}

/**
 * Snapshot storage layer response
 * Used for paginated queries
 */
export interface SnapshotPageResult<T> {
  items: T[];
  total_count: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

/**
 * Snapshot run query filters
 */
export interface SnapshotRunFilters {
  snapshot_type?: SnapshotType;
  status?: SnapshotRunStatus;
  error_code?: ErrorCode;
  date_from?: string; // ISO 8601
  date_to?: string; // ISO 8601
}

/**
 * Snapshot query filters
 */
export interface SnapshotFilters {
  snapshot_type?: SnapshotType;
  captured_from?: string; // ISO 8601
  captured_to?: string; // ISO 8601
}
