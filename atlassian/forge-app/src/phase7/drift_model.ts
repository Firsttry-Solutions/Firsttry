/**
 * PHASE 7 v2: DRIFT DETECTION DATA MODEL
 * 
 * Interfaces and types for drift events representing observed changes
 * between consecutive Phase-6 snapshots.
 * 
 * Principles:
 * - Immutable: drift events never modified after creation
 * - Deterministic: same snapshot pair → identical drift list
 * - Tenant-isolated: all drift keyed by tenant_id
 * - Unknown-friendly: actor/source default to unknown when not evidenced
 * - Factual: records what changed, not why or scope
 * 
 * Forbidden text (violations cause build failure):
 * See PHASE_7_V2_SPEC.md for complete list of prohibited words
 */

/**
 * Change type: what happened to the object
 */
export enum ChangeType {
  ADDED = 'added',
  REMOVED = 'removed',
  MODIFIED = 'modified',
}

/**
 * Classification: category of change
 */
export enum Classification {
  // Config change: workflow, automation rule added/removed/modified
  CONFIG_CHANGE = 'CONFIG_CHANGE',
  
  // Structural change: field, project, scope added/removed
  STRUCTURAL = 'STRUCTURAL',
  
  // Visibility change: object presence differs due to missing_data change
  DATA_VISIBILITY_CHANGE = 'DATA_VISIBILITY_CHANGE',
  
  // Cannot confidently classify
  UNKNOWN = 'UNKNOWN',
}

/**
 * Object type: what kind of object changed
 */
export enum ObjectType {
  FIELD = 'field',
  WORKFLOW = 'workflow',
  AUTOMATION_RULE = 'automation_rule',
  PROJECT = 'project',
  SCOPE = 'scope',
  UNKNOWN = 'unknown',
}

/**
 * Actor: who/what made the change (if evidenced)
 */
export type Actor = 'user' | 'automation' | 'app' | 'unknown';

/**
 * Source: how the change was made (if evidenced)
 */
export type Source = 'ui' | 'api' | 'app' | 'unknown';

/**
 * Confidence level: how certain is the actor/source classification
 */
export type ActorConfidence = 'high' | 'medium' | 'low' | 'none';

/**
 * Missing data reference: which datasets impacted visibility of this drift
 */
export interface MissingDataReference {
  // Dataset keys that changed between snapshots
  dataset_keys: string[];
  
  // Reason codes from missing_data items
  reason_codes: string[];
}

/**
 * Canonical subset of an object state
 * Specific fields depend on object_type and are stable/deterministic
 */
export interface CanonicalSubset {
  [key: string]: any;
}

/**
 * Change patch: deterministic list of JSON-patch-like operations
 * Ordered by path for stability
 */
export interface ChangePatch {
  op: 'add' | 'remove' | 'replace';
  path: string;
  from?: any;
  value?: any;
}

/**
 * Time window for a drift event
 */
export interface TimeWindow {
  // When first snapshot was captured (ISO 8601)
  from_captured_at: string;
  
  // When second snapshot was captured (ISO 8601)
  to_captured_at: string;
}

/**
 * A single observed drift event
 * Represents one detected change between consecutive snapshots
 */
export interface DriftEvent {
  // ===== IDENTIFICATION (tenant-isolated) =====
  tenant_id: string;
  cloud_id: string;
  drift_event_id: string; // UUID, unique per tenant

  // ===== SNAPSHOT LINKING =====
  from_snapshot_id: string; // Older snapshot
  to_snapshot_id: string;   // Newer snapshot

  // ===== TIME WINDOW =====
  time_window: TimeWindow;

  // ===== WHAT CHANGED =====
  object_type: ObjectType;
  object_id: string;
  change_type: ChangeType;

  // ===== CLASSIFICATION =====
  classification: Classification;

  // ===== STATE DELTAS =====
  // Canonical representation of object state before/after
  before_state: CanonicalSubset | null; // null if added or unavailable
  after_state: CanonicalSubset | null;  // null if removed or unavailable

  // Deterministic patch for modifications (optional, for efficiency)
  change_patch?: ChangePatch[];

  // ===== ACTOR/SOURCE (unknown by default) =====
  // Only set if evidenced in snapshot payload; never guessed
  actor: Actor;
  source: Source;
  actor_confidence: ActorConfidence;

  // ===== COMPLETENESS =====
  // Percentage (0-100) indicating data availability for this drift
  // 100 = both states available, no missing_data scope
  // <100 = partial visibility or missing datasets
  completeness_percentage: number;

  // ===== MISSING DATA SCOPE =====
  // Which datasets changed visibility and affected this drift classification
  missing_data_reference?: MissingDataReference;

  // ===== DENSITY TRACKING =====
  // Count of consecutive identical changes (for clustering)
  repeat_count: number;

  // ===== SCHEMA & INTEGRITY =====
  schema_version: string; // "7.0"
  canonical_hash: string; // SHA256 of canonical representation
  hash_algorithm: 'sha256';

  // ===== TIMESTAMPS (for audit trail) =====
  created_at: string; // ISO 8601, when drift event was created
}

/**
 * Drift event list response (with pagination support)
 */
export interface DriftEventListResponse {
  items: DriftEvent[];
  has_more: boolean;
  total_count?: number; // Optional if storage supports it
  page?: number;
  limit?: number;
}

/**
 * Drift list filters for queries
 */
export interface DriftListFilters {
  from_date?: string; // ISO 8601
  to_date?: string;   // ISO 8601
  object_type?: ObjectType;
  classification?: Classification;
  change_type?: ChangeType;
  actor?: Actor;
}

/**
 * Canonical field representation (for field diffs)
 */
export interface CanonicalField extends CanonicalSubset {
  id: string;
  name: string;
  type: string;
  custom: boolean;
  searchable: boolean;
}

/**
 * Canonical workflow representation (for workflow diffs)
 */
export interface CanonicalWorkflow extends CanonicalSubset {
  name: string;
  scope: 'global' | 'project' | 'unknown';
  is_default?: boolean;
  status_count: number;
}

/**
 * Canonical automation rule representation (for automation diffs)
 */
export interface CanonicalAutomationRule extends CanonicalSubset {
  id: string;
  name: string;
  enabled: boolean;
  trigger_type: string;
}

/**
 * Canonical project representation (for project diffs)
 */
export interface CanonicalProject extends CanonicalSubset {
  key: string;
  name: string;
  type: 'software' | 'service_desk' | 'business' | 'unknown';
}

/**
 * Drift computation result (intermediate)
 */
export interface DriftComputeResult {
  events: DriftEvent[];
  error?: {
    code: string;
    message: string;
  };
}
