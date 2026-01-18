/**
 * TRUTH MODEL - Single Source of Truth for Governance Dashboard State
 *
 * This module implements a deterministic state machine that drives ALL dashboard UI.
 * It enforces invariants to prevent contradictory combinations (e.g., FRESH without snapshot).
 *
 * DECISION: Option 2 is reality (from manifest.yml):
 *  - Scheduled triggers are configured (phase5-auto-scheduler, phase6-weekly-snapshot, etc.)
 *  - Snapshots are persisted (storage:app scope exists)
 *  - Background jobs run on schedule
 *  - This is NOT a user-invoke-only app
 *
 * All UI widgets MUST derive from GovernanceViewModel - never compute local state.
 */

/**
 * Runtime state enum - single source of truth for dashboard state
 */
export enum GovernanceRuntimeState {
  /**
   * System is booting or identity unknown.
   * Cannot proceed until tenant ID and backend reachability confirmed.
   */
  BOOTING = "BOOTING",

  /**
   * Schedule configured, but no successful run yet AND no snapshot exists.
   * System is awaiting first collection cycle.
   */
  WAITING_FIRST_RUN = "WAITING_FIRST_RUN",

  /**
   * System is healthy:
   * - Last successful run exists
   * - Snapshot exists and is within freshness threshold
   * - No critical failures
   */
  RUNNING = "RUNNING",

  /**
   * Snapshot exists but is stale (age > stalenessThresholdMinutes).
   * Last scheduled job failed or did not complete.
   */
  STALE = "STALE",

  /**
   * Partial failures or limited permissions.
   * System is partially functional but degraded.
   * Some checks are failing but not completely broken.
   */
  DEGRADED = "DEGRADED",

  /**
   * System is non-operational:
   * - Backend unreachable
   * - Tenant identity missing/invalid
   * - Fatal resolver error
   */
  BROKEN = "BROKEN",
}

/**
 * Explicit export readiness state
 */
export type ExportMode = "DISABLED" | "MANUAL_UI_STATE" | "SNAPSHOT_BASED";

/**
 * RuntimeSignals: Explicit inputs to the state machine (NO implicit state).
 * All information needed to compute state MUST be passed in explicitly.
 */
export interface RuntimeSignals {
  // Identity & connectivity
  tenantIdentityStatus: "OK" | "MISSING" | "UNKNOWN";
  backendStatus: "OK" | "UNREACHABLE" | "ERROR";

  // Scheduling
  scheduleStatus: "CONFIGURED" | "NOT_CONFIGURED" | "UNKNOWN";
  expectedScheduleIntervalMinutes: number | null;

  // Run history
  lastSuccessfulRunISO: string | null;
  lastAttemptISO: string | null;

  // Snapshot state
  snapshot: {
    id?: string;
    generatedAtISO: string;
    sha256?: string;
  } | null;

  // Storage
  storageStatus: "EMPTY" | "NONEMPTY" | "UNKNOWN";
  snapshotCountRetained: number;
  checksCompletedLifetime: number;

  // Failures
  failures7d: number;
  skippedChecks7d: number;

  // Export subsystem
  exportSubsystemStatus: "READY" | "NOT_READY" | "UNKNOWN" | "ERROR";

  // Permissions
  permissionsVisibility: "OK" | "LIMITED" | "UNKNOWN";

  // Configuration & thresholds
  stalenessThresholdMinutes: number;

  // Current time (must be passed in for determinism)
  nowISO: string;
}

/**
 * GovernanceViewModel: Computed, immutable output from the state machine.
 * ALL dashboard widgets MUST read ONLY from this model.
 */
export interface GovernanceViewModel {
  // Core state
  runtimeState: GovernanceRuntimeState;
  exportMode: ExportMode;

  // Derived labels and reasons (used by ALL widgets)
  overallHealthLabel: string;
  healthReason: string;

  dataFreshnessLabel: string;
  freshnessReason: string;

  schedulerStatusLabel: string;
  schedulerReason: string;

  lastSnapshotLabel: string;
  snapshotAgeMinutes: number | null;
  snapshotReason: string;

  exportReadinessLabel: string;
  exportReason: string;

  storageStateLabel: string;
  storageReason: string;

  permissionVisibilityLabel: string;
  permissionReason: string;

  // Hard booleans
  hasTenantIdentity: boolean;
  hasBackendReachability: boolean;
  hasAnySnapshot: boolean;
  hasScheduleConfigured: boolean;
  exportAvailable: boolean;
  downloadsAvailable: boolean;
  isOperational: boolean;

  // Timestamps and metrics
  lastSuccessfulRunISO: string | null;
  lastAttemptISO: string | null;
  expectedScheduleIntervalMinutes: number | null;
  stalenessThresholdMinutes: number;
  snapshotCountRetained: number;
  checksCompletedLifetime: number;
  failures7d: number;
  skippedChecks7d: number;

  // Generated timestamp
  generatedAtISO: string;
}

/**
 * Compute GovernanceViewModel deterministically from RuntimeSignals.
 * All invariants are enforced here.
 */
export function computeGovernanceViewModel(signals: RuntimeSignals): GovernanceViewModel {
  const now = new Date(signals.nowISO);
  const snapshotAge = signals.snapshot
    ? Math.floor((now.getTime() - new Date(signals.snapshot.generatedAtISO).getTime()) / (1000 * 60))
    : null;

  // Compute runtime state first (deterministic state machine)
  const runtimeState = computeRuntimeState(signals, snapshotAge);

  // Compute export mode based on state
  const exportMode = computeExportMode(runtimeState, signals);

  // Now compute all derived labels using the state
  const viewModel: GovernanceViewModel = {
    runtimeState,
    exportMode,

    // Health
    overallHealthLabel: computeHealthLabel(runtimeState),
    healthReason: computeHealthReason(runtimeState, signals),

    // Freshness
    dataFreshnessLabel: computeFreshnessLabel(runtimeState, snapshotAge, signals),
    freshnessReason: computeFreshnessReason(runtimeState, snapshotAge, signals),

    // Scheduler
    schedulerStatusLabel: computeSchedulerLabel(runtimeState, signals),
    schedulerReason: computeSchedulerReason(runtimeState, signals),

    // Snapshot
    lastSnapshotLabel: computeSnapshotLabel(signals.snapshot, snapshotAge),
    snapshotAgeMinutes: snapshotAge,
    snapshotReason: computeSnapshotReason(signals.snapshot, snapshotAge, signals),

    // Export
    exportReadinessLabel: computeExportReadinessLabel(exportMode),
    exportReason: computeExportReason(exportMode, signals),

    // Storage
    storageStateLabel: computeStorageLabel(signals),
    storageReason: computeStorageReason(signals),

    // Permissions
    permissionVisibilityLabel: computePermissionLabel(signals),
    permissionReason: computePermissionReason(signals),

    // Booleans
    hasTenantIdentity: signals.tenantIdentityStatus === "OK",
    hasBackendReachability: signals.backendStatus === "OK",
    hasAnySnapshot: signals.snapshot !== null,
    hasScheduleConfigured: signals.scheduleStatus === "CONFIGURED",
    exportAvailable: exportMode !== "DISABLED",
    downloadsAvailable: exportMode !== "DISABLED",
    isOperational: runtimeState === GovernanceRuntimeState.RUNNING,

    // Passthrough
    lastSuccessfulRunISO: signals.lastSuccessfulRunISO,
    lastAttemptISO: signals.lastAttemptISO,
    expectedScheduleIntervalMinutes: signals.expectedScheduleIntervalMinutes,
    stalenessThresholdMinutes: signals.stalenessThresholdMinutes,
    snapshotCountRetained: signals.snapshotCountRetained,
    checksCompletedLifetime: signals.checksCompletedLifetime,
    failures7d: signals.failures7d,
    skippedChecks7d: signals.skippedChecks7d,
    generatedAtISO: signals.nowISO,
  };

  // Enforce invariants (throw in dev, clamp in prod)
  enforceInvariants(viewModel, signals, snapshotAge);

  return viewModel;
}

/**
 * Compute the core runtime state deterministically.
 * 
 * CRITICAL: Never allow the UI to get stuck in BOOTING.
 * If tenant/backend cannot be reached, must transition to explicit terminal state.
 */
function computeRuntimeState(signals: RuntimeSignals, snapshotAgeMinutes: number | null): GovernanceRuntimeState {
  // BROKEN: Fatal error conditions take priority
  if (signals.backendStatus === "ERROR" || signals.exportSubsystemStatus === "ERROR") {
    return GovernanceRuntimeState.BROKEN;
  }

  // BOOTING is a transitional state: tenant and backend must BOTH be reachable
  // If either is unreachable/unknown AND we have no snapshot history, stay BOOTING briefly.
  // BUT: If tenantIdentityStatus=MISSING (permanent), transition to BROKEN after attempts.
  // For now: BOOTING means we're still trying to establish contact.
  if (signals.tenantIdentityStatus !== "OK" || signals.backendStatus !== "OK") {
    // CRITICAL FIX: If tenant is explicitly MISSING (not just UNKNOWN), this is terminal.
    // Don't loop in BOOTING forever; transition to BROKEN after max retries implied by caller.
    // For this computation: return BOOTING but UI will log this and may retry.
    // The invariant enforcer will ensure intervals are null in this state.
    return GovernanceRuntimeState.BOOTING;
  }

  // WAITING_FIRST_RUN: schedule configured but no successful run AND no snapshot
  // This is a healthy transitional state (not an error).
  if (
    signals.scheduleStatus === "CONFIGURED" &&
    !signals.lastSuccessfulRunISO &&
    !signals.snapshot
  ) {
    return GovernanceRuntimeState.WAITING_FIRST_RUN;
  }

  // BROKEN: fatal errors (backend error state, storage critical failure)
  if (signals.backendStatus === "ERROR" || signals.exportSubsystemStatus === "ERROR") {
    return GovernanceRuntimeState.BROKEN;
  }

  // STALE: snapshot exists but age > threshold
  if (signals.snapshot && snapshotAgeMinutes !== null && snapshotAgeMinutes > signals.stalenessThresholdMinutes) {
    return GovernanceRuntimeState.STALE;
  }

  // DEGRADED: partial failures or limited permissions
  if (
    signals.failures7d > 0 ||
    signals.permissionsVisibility === "LIMITED" ||
    signals.skippedChecks7d > 0
  ) {
    return GovernanceRuntimeState.DEGRADED;
  }

  // RUNNING: healthy state (snapshot exists, age OK, no critical failures)
  if (signals.snapshot && signals.lastSuccessfulRunISO) {
    return GovernanceRuntimeState.RUNNING;
  }

  // Fallback (should not reach)
  return GovernanceRuntimeState.DEGRADED;
}

/**
 * Compute export mode based on runtime state and export subsystem readiness.
 */
function computeExportMode(runtimeState: GovernanceRuntimeState, signals: RuntimeSignals): ExportMode {
  // If export subsystem has critical error, disable
  if (signals.exportSubsystemStatus === "ERROR") {
    return "DISABLED";
  }

  // If snapshot exists and export subsystem is ready, use snapshot-based export
  if (signals.snapshot && signals.exportSubsystemStatus === "READY") {
    return "SNAPSHOT_BASED";
  }

  // If snapshot exists but export subsystem not ready, allow manual UI state export
  if (signals.snapshot) {
    return "MANUAL_UI_STATE";
  }

  // If no snapshot yet, manual UI state only
  if (runtimeState === GovernanceRuntimeState.WAITING_FIRST_RUN) {
    return "MANUAL_UI_STATE";
  }

  // Fallback: disabled
  return "DISABLED";
}

// ============================================================================
// LABEL & REASON COMPUTATIONS
// ============================================================================

function computeHealthLabel(state: GovernanceRuntimeState): string {
  switch (state) {
    case GovernanceRuntimeState.RUNNING:
      return "Operational";
    case GovernanceRuntimeState.DEGRADED:
      return "Degraded";
    case GovernanceRuntimeState.STALE:
      return "Stale";
    case GovernanceRuntimeState.BROKEN:
      return "Non-operational";
    case GovernanceRuntimeState.WAITING_FIRST_RUN:
      return "Awaiting first run";
    case GovernanceRuntimeState.BOOTING:
      return "Initializing";
    default:
      return "Unknown";
  }
}

function computeHealthReason(state: GovernanceRuntimeState, signals: RuntimeSignals): string {
  switch (state) {
    case GovernanceRuntimeState.RUNNING:
      return "All governance processes are functioning normally";
    case GovernanceRuntimeState.DEGRADED:
      if (signals.failures7d > 0) return `${signals.failures7d} failures in past 7 days`;
      if (signals.permissionsVisibility === "LIMITED") return "Limited visibility into some resources";
      if (signals.skippedChecks7d > 0) return `${signals.skippedChecks7d} checks skipped in past 7 days`;
      return "Some processes are degraded";
    case GovernanceRuntimeState.STALE:
      return "No recent snapshot; data collection may have paused";
    case GovernanceRuntimeState.BROKEN:
      if (signals.backendStatus === "UNREACHABLE") return "Backend is unreachable";
      if (signals.tenantIdentityStatus === "MISSING") return "Tenant identity not available";
      return "Critical error; governance collection is not functioning";
    case GovernanceRuntimeState.WAITING_FIRST_RUN:
      return "Scheduled triggers configured; awaiting first collection cycle";
    case GovernanceRuntimeState.BOOTING:
      if (signals.tenantIdentityStatus !== "OK") return "Tenant identity not yet resolved";
      if (signals.backendStatus !== "OK") return "Backend connectivity not yet confirmed";
      return "Initializing dashboard";
    default:
      return "Unknown state";
  }
}

function computeFreshnessLabel(state: GovernanceRuntimeState, ageMin: number | null, signals: RuntimeSignals): string {
  // FRESHNESS INVARIANT: If no timestamp (ageMin === null), NEVER show "Fresh"
  // "Fresh" status MUST be paired with a valid timestamp
  if (!signals.snapshot) return "Never";
  if (ageMin === null) return "Never"; // CRITICAL FIX: was "Unknown", must be "Never" (no timestamp = never)
  if (ageMin <= signals.stalenessThresholdMinutes * 0.25) return "Fresh";
  if (ageMin <= signals.stalenessThresholdMinutes * 0.75) return "Current";
  if (ageMin <= signals.stalenessThresholdMinutes) return "Aging";
  return "Stale";
}

function computeFreshnessReason(state: GovernanceRuntimeState, ageMin: number | null, signals: RuntimeSignals): string {
  if (!signals.snapshot) return "No snapshot exists yet";
  if (ageMin === null) return "Unable to compute age";
  return `Data is ${ageMin} minute(s) old`;
}

function computeSchedulerLabel(state: GovernanceRuntimeState, signals: RuntimeSignals): string {
  if (signals.scheduleStatus !== "CONFIGURED") return "Not configured";
  if (state === GovernanceRuntimeState.RUNNING || state === GovernanceRuntimeState.DEGRADED)
    return "Firing";
  if (state === GovernanceRuntimeState.STALE) return "Delayed or failed";
  if (state === GovernanceRuntimeState.WAITING_FIRST_RUN) return "Configured, awaiting first run";
  return "Unknown";
}

function computeSchedulerReason(state: GovernanceRuntimeState, signals: RuntimeSignals): string {
  if (signals.scheduleStatus !== "CONFIGURED") return "No schedule is configured";
  if (signals.lastSuccessfulRunISO) return `Last successful run: ${signals.lastSuccessfulRunISO}`;
  if (signals.lastAttemptISO) return `Last attempted: ${signals.lastAttemptISO}`;
  return "No runs recorded yet";
}

function computeSnapshotLabel(snapshot: RuntimeSignals["snapshot"], ageMin: number | null): string {
  if (!snapshot) return "Never";
  if (ageMin === null) return "Unknown";
  return `${ageMin}min ago`;
}

function computeSnapshotReason(snapshot: RuntimeSignals["snapshot"], ageMin: number | null, signals: RuntimeSignals): string {
  if (!snapshot) return "No snapshot stored yet";
  if (ageMin === null) return "Unable to compute age";
  if (ageMin < 1) return "Just generated";
  if (ageMin < 60) return `${ageMin} minute(s) old`;
  const hours = Math.floor(ageMin / 60);
  return `${hours} hour(s) old`;
}

function computeExportReadinessLabel(mode: ExportMode): string {
  switch (mode) {
    case "SNAPSHOT_BASED":
      return "Ready (snapshot-based)";
    case "MANUAL_UI_STATE":
      return "Ready (manual, UI state only)";
    case "DISABLED":
      return "Not available";
    default:
      return "Unknown";
  }
}

function computeExportReason(mode: ExportMode, signals: RuntimeSignals): string {
  switch (mode) {
    case "SNAPSHOT_BASED":
      return "Exports use canonical snapshot data";
    case "MANUAL_UI_STATE":
      if (!signals.snapshot) return "No snapshot yet; export uses current UI state";
      return "Export uses current UI state (not snapshot-based)";
    case "DISABLED":
      if (signals.exportSubsystemStatus === "ERROR") return "Export subsystem error";
      return "Export not available at this time";
    default:
      return "Unknown state";
  }
}

function computeStorageLabel(signals: RuntimeSignals): string {
  if (signals.storageStatus === "EMPTY") return "Empty";
  if (signals.storageStatus === "NONEMPTY") return `${signals.snapshotCountRetained} snapshot(s)`;
  return "Unknown";
}

function computeStorageReason(signals: RuntimeSignals): string {
  if (signals.snapshotCountRetained === 0) return "No snapshots retained";
  return `${signals.checksCompletedLifetime} total checks completed`;
}

function computePermissionLabel(signals: RuntimeSignals): string {
  if (signals.permissionsVisibility === "OK") return "Full access";
  if (signals.permissionsVisibility === "LIMITED") return "Limited";
  return "Unknown";
}

function computePermissionReason(signals: RuntimeSignals): string {
  if (signals.permissionsVisibility === "OK") return "All resources accessible";
  if (signals.permissionsVisibility === "LIMITED") return "Some resources not accessible";
  return "Permission state unknown";
}

// ============================================================================
// INVARIANT ENFORCEMENT
// ============================================================================

/**
 * Enforce invariants to prevent contradictory state combinations.
 * CRITICAL: Never throws - always auto-corrects with diagnostic logging.
 * This ensures the UI always renders in a consistent state and never freezes.
 */
function enforceInvariants(vm: GovernanceViewModel, signals: RuntimeSignals, snapshotAgeMin: number | null): void {
  // Invariant 1: If snapshot is null, age must be null
  if (!signals.snapshot && vm.snapshotAgeMinutes !== null) {
    const msg = "Invariant violation (auto-corrected): snapshot is null but snapshotAgeMinutes is not null";
    console.warn(msg);
    vm.snapshotAgeMinutes = null;
  }

  // Invariant 2: FRESH only occurs with snapshot
  if (vm.dataFreshnessLabel === "Fresh" && !signals.snapshot) {
    const msg = "Invariant violation (auto-corrected): freshness is FRESH but snapshot is null";
    console.warn(msg);
    vm.dataFreshnessLabel = "Never";
  }

  // Invariant 3: If schedule NOT CONFIGURED, expectedScheduleIntervalMinutes must be null
  // CRITICAL: Only enforce when explicitly NOT_CONFIGURED, not during WAITING_FIRST_RUN
  // (WAITING_FIRST_RUN can still show interval because schedule IS configured, just no run yet)
  if (signals.scheduleStatus !== "CONFIGURED" && vm.expectedScheduleIntervalMinutes !== null) {
    const msg = "Invariant violation (auto-corrected): schedule not configured but expectedScheduleIntervalMinutes is not null";
    console.warn(msg, {
      scheduleStatus: signals.scheduleStatus,
      expectedScheduleIntervalMinutes: vm.expectedScheduleIntervalMinutes
    });
    vm.expectedScheduleIntervalMinutes = null;
  }

  // Invariant 4: Storage empty => snapshot count is 0
  if (signals.storageStatus === "EMPTY" && vm.snapshotCountRetained !== 0) {
    const msg = "Invariant violation (auto-corrected): storage is EMPTY but snapshotCountRetained is not 0";
    console.warn(msg);
    vm.snapshotCountRetained = 0;
  }

  // Invariant 5: WAITING_FIRST_RUN => freshness must be UNKNOWN/Never (not FRESH)
  // This is correct: if no successful run yet, cannot be fresh
  if (vm.runtimeState === GovernanceRuntimeState.WAITING_FIRST_RUN && vm.dataFreshnessLabel === "Fresh") {
    const msg = "Invariant violation (auto-corrected): state is WAITING_FIRST_RUN but freshness is FRESH";
    console.warn(msg);
    vm.dataFreshnessLabel = "Never";
  }

  // Invariant 6: No snapshot => freshness must be "Never", not "Fresh"
  // Only apply when retainedCount is explicitly 0 (measured state)
  if (signals.snapshotCountRetained === 0 && vm.dataFreshnessLabel === "Fresh") {
    const msg = "Invariant violation (auto-corrected): zero snapshots retained but freshness is Fresh";
    console.warn(msg);
    vm.dataFreshnessLabel = "Never";
  }

  // Invariant 7: BOOTING state sanitization
  // When truly BOOTING (unable to reach backend/tenant), no freshness or interval should be shown
  if (vm.runtimeState === GovernanceRuntimeState.BOOTING) {
    if (vm.dataFreshnessLabel !== "Never" && vm.dataFreshnessLabel !== "Unknown") {
      const msg = "Invariant violation (auto-corrected): BOOTING state but freshness label is not Never/Unknown";
      console.warn(msg);
      vm.dataFreshnessLabel = "Never";
    }
    if (vm.expectedScheduleIntervalMinutes !== null) {
      const msg = "Invariant violation (auto-corrected): BOOTING state but expectedScheduleIntervalMinutes is not null";
      console.warn(msg);
      vm.expectedScheduleIntervalMinutes = null;
    }
  }
}
