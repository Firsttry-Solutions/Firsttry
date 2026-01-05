/**
 * Phase 4: Change Awareness Timeline - Types & Storage Schema (SEALED SPECIFICATION)
 * 
 * This module defines the immutable data structures for Phase 4 change detection.
 * 
 * SEALED SPEC CONSTRAINTS:
 * - Read-only timeline (append-only storage, no updates/deletes)
 * - NO severity indicators, stats panels, or stats computation
 * - NO interactive buttons, filters, or user actions
 * - NO Jira API calls (uses Phase 2 deltas only)
 * - DAILY schedule only (no hourly, no manual triggers)
 * - Static chronological list for display
 */

/**
 * A single change event in the timeline.
 * Events are APPEND-ONLY and IMMUTABLE.
 */
export interface Phase4ChangeEvent {
  /** Unique identifier for this event (ISO timestamp + UUID suffix) */
  id: string;

  /** When this change was detected (ISO 8601 UTC) */
  detectedAt: string;

  /** Type of change detected */
  changeType: 'JIRA_SETTING_CHANGED';

  /**  The specific Jira setting that changed */
  settingKey: string;

  /** Human-readable description of the change */
  description: string;

  /** Previous value (from Phase 2 delta) */
  previousValue: string | number | boolean | null;

  /** Current value (from Phase 2 delta) */
  currentValue: string | number | boolean | null;

  /** Which Phase 2 metric detected this change */
  sourceMetric: string;

  /** ISO timestamp of when this change was recorded in storage */
  recordedAt: string;
}

/**
 * The complete change timeline for a tenant.
 * This is the read-only, append-only event log.
 */
export interface Phase4Timeline {
  /** Cloud ID of the tenant (tenant-scoped) */
  cloudId: string;

  /** Chronological list of all detected changes (most recent first) */
  events: Phase4ChangeEvent[];

  /** When this timeline was last updated */
  lastUpdatedAt: string;

  /** Total number of events recorded */
  totalEvents: number;
}

/**
 * Scheduler state for Phase 4 DAILY snapshot detection.
 * This tracks when the last daily run occurred and any errors.
 */
export interface Phase4SchedulerState {
  /** Cloud ID of the tenant */
  cloudId: string;

  /** When the last scheduled run executed */
  lastRunAt: string | null;

  /** When the last run succeeded */
  lastSuccessAt: string | null;

  /** If last run failed, the reason */
  lastFailureReason: string | null;

  /** Number of changes detected in last run */
  lastDetectedChanges: number;

  /** ISO timestamp of when this state was recorded */
  recordedAt: string;
}

/**
 * Result of Phase 4 scheduler execution.
 * Returned after each DAILY run.
 */
export interface Phase4SchedulerResult {
  /** Whether the run succeeded */
  success: boolean;

  /** Number of changes detected */
  changesDetected: number;

  /** Array of changes that were appended to timeline */
  events: Phase4ChangeEvent[];

  /** If failed, the error reason */
  errorReason?: string;

  /** ISO timestamp of execution */
  executedAt: string;
}

/**
 * Timeline display payload for gadget UI.
 * Contains only immutable, read-only data for display.
 */
export interface Phase4TimelinePayload {
  /** Chronological events (most recent first) */
  events: Phase4ChangeEvent[];

  /** Total count of all events */
  totalEventCount: number;

  /** When timeline was last updated */
  lastUpdatedAt: string;

  /** Whether data is complete/available */
  isAvailable: boolean;

  /** If unavailable, the reason */
  unavailableReason?: string;
}
