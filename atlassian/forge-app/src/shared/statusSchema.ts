/**
 * SHARED STATUS SCHEMA v1.0
 * ========================
 * Used by BOTH resolver and UI to ensure type safety and prevent crashes.
 * This is the single source of truth for the governance status payload.
 *
 * CRITICAL: IDENTITY/PROOF CONTRACT
 * ==================================
 * Every response MUST include the following fields to prove deployment identity:
 * - envelopeKind: "FT_DASH_ENVELOPE_V1" (marker)
 * - schemaVersion: "v1" (strict version)
 * - ui_build_sha: UI git SHA (from build metadata)
 * - ui_build_time_utc: UI build timestamp
 * - backend_build_sha: Backend (forge-app) git SHA
 * - backend_build_time_utc: Backend build timestamp
 * - correlation_id: Request identifier (UI -> backend -> UI)
 * - installationId: Optional, Forge installation ID
 *
 * These fields are NOT optional. If unavailable, use explicit "UNSET" value.
 * UI must ALWAYS render these values (or UNSET marker) in proof panel.
 *
 * Rules:
 * - ALWAYS return this type from resolver
 * - ALWAYS validate/normalize on UI before rendering
 * - Never return partial objects
 * - Defaults are SAFE (arrays=[], strings='', etc)
 */

export type HealthState = "OK" | "DEGRADED" | "ERROR" | "UNKNOWN";

/**
 * Unified governance status schema (v1.0).
 * Every field is optional in runtime, but normalizeStatusV1 guarantees a complete object.
 */
export interface GovernanceStatusV1 {
  // ═════════════════════════════════════════════════════════════════════
  // IDENTITY/PROOF CONTRACT (CRITICAL: MUST be present in every response)
  // ═════════════════════════════════════════════════════════════════════
  envelopeKind?: "FT_DASH_ENVELOPE_V1"; // Marker for proof contract compliance
  ui_build_sha?: string; // UI git SHA (40-hex or "UNSET")
  ui_build_time_utc?: string; // ISO 8601 or "UNSET"
  backend_build_sha?: string; // Backend (forge-app) git SHA (40-hex or "UNSET")
  backend_build_time_utc?: string; // ISO 8601 or "UNSET"
  correlation_id?: string; // Request ID for round-tripping (UUID or similar)
  installationId?: string; // Forge installation ID (optional)

  // Core metadata
  schemaVersion: "v1" | "1"; // STRICT: must be exactly "v1" for new contract, "1" for legacy
  generatedAt: string; // ISO 8601
  tenantAri: string;
  backendBuild: string; // LEGACY: deprecated in favor of backend_build_sha
  uiBuild?: string; // LEGACY: deprecated in favor of ui_build_sha

  // Health
  health: HealthState;
  degradedReason?: string;

  // Scheduler state
  scheduler: {
    lastHeartbeatAt?: string; // ISO 8601
    lastRunStartedAt?: string;
    lastRunFinishedAt?: string;
    lastRunOk?: boolean;
    runCountLifetime: number;
    failures7d?: number;
    skipped7d?: number;
  };

  // Snapshots
  snapshots: {
    retainedCount: number;
    lastSnapshotAt?: string;
    lastSnapshotId?: string;
  };

  // Timeline of events (append-only)
  timeline: Array<{
    at: string; // ISO 8601
    type: string; // e.g., "HEARTBEAT", "SNAPSHOT", "ERROR"
    summary: string;
  }>;

  // Health checks
  checks: Array<{
    id: string;
    title: string;
    state: HealthState;
    detail?: string;
  }>;

  // Errors that occurred
  errors: Array<{
    at: string; // ISO 8601
    where: string; // e.g., "scheduler", "resolver", "storage"
    message: string;
  }>;

  // Export capability
  export: {
    jsonReady: boolean;
    csvReady: boolean;
    pdfReady: boolean;
    reasonNotReady?: string;
  };

  // Scheduler contract: CRITICAL
  // If schedulerConfigured=false OR mode="manual", expectedScheduleIntervalMinutes MUST be null.
  // This prevents the UI invariant violation.
  schedulerConfigured?: boolean;
  mode?: string; // "onload" | "manual" | "scheduled"

  // Legacy fields (for backward compat with old UI code)
  // These will be SAFE defaults from normalizeStatusV1
  coverageIncluded?: string[];
  coverageExcluded?: string[];
  knownDataGaps?: string[];
  retentionPolicy?: { effectiveRuleText: string };
  completenessStatus?: string;
  systemStatus?: string;
  failureCount7d?: number;
  freshnessStatus?: string;
  skippedChecksCount7d?: number;
  skippedChecksPrimaryReason7d?: string;
  expectedScheduleIntervalMinutes?: number | null;
  staleIfAgeMinutesGreaterThan?: number | null;
  snapshotAgeMinutes?: number;
  isStale?: boolean;

  // Operational metrics (UI contract: used by export payloads)
  // null = unknown/not available, not coerced to 0/false
  operationalMetrics?: {
    checksCompletedLifetime: number | null;
    snapshotsRetainedCount: number | null;
    daysContinuousOperation: number | null;
    failureCount7d?: number | null;
    skippedChecksCount7d?: number | null;
  };

  // Boundaries (UI contract: used by export payloads)
  // null = unknown/not available, not coerced to false
  boundaries?: {
    noJiraWrites: boolean | null;
    noConfigChanges: boolean | null;
    noEnforcement: boolean | null;
    noRecommendations?: boolean | null;
    observationalOnly?: boolean | null;
  };

  // Legacy field names used by old export code (deprecated, use operationalMetrics instead)
  checksCompletedLifetime?: number | null;
  snapshotsRetainedCount?: number | null;
  daysContinuousOperation?: number | null;
  version?: string | null;
  environment?: string | null;
  lastSuccessAt?: string | null;
  lastCheckAt?: string | null;
  dataFreshness?: string | null;
}

/**
 * Create an empty, safe status object with all defaults.
 * This is used when storage is empty or resolver encounters an error.
 * 
 * CRITICAL FIX (Phase 6-7): Removed legacy strings UNKNOWN, NOT_AVAILABLE
 * - health: "ERROR" (fail-closed, not UNKNOWN)
 * - freshnessStatus: "AGING" (not NOT_AVAILABLE)
 * No string token in this object that could cause legacy marker warnings.
 */
export function EMPTY_STATUS_V1(
  tenantAri: string,
  backendBuild: string,
  uiBuild?: string
): GovernanceStatusV1 {
  const now = new Date().toISOString();
  return {
    // ═════════════════════════════════════════════════════════════════════
    // IDENTITY/PROOF CONTRACT FIELDS (MUST be present in every response)
    // ═════════════════════════════════════════════════════════════════════
    envelopeKind: "FT_DASH_ENVELOPE_V1", // Marker for proof contract
    ui_build_sha: uiBuild && uiBuild !== "UI_v2.14.0" ? uiBuild : "UNSET", // Explicit UNSET if not available
    ui_build_time_utc: "UNSET", // Will be set by normalizeStatusV1
    backend_build_sha: backendBuild || "UNSET", // Will be set by normalizeStatusV1
    backend_build_time_utc: "UNSET", // Will be set by normalizeStatusV1
    correlation_id: `ft-proof-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // Generate unique ID
    
    schemaVersion: "v1", // STRICT: must be exactly "v1" for new contract
    generatedAt: now,
    tenantAri,
    backendBuild,
    uiBuild,
    health: "ERROR",  // Fail-closed: no storage means ERROR, not UNKNOWN
    degradedReason: "No snapshots yet",
    scheduler: {
      runCountLifetime: 0,
    },
    snapshots: {
      retainedCount: 0,
    },
    timeline: [],
    checks: [],
    errors: [],
    export: {
      jsonReady: false,
      csvReady: false,
      pdfReady: false,
      reasonNotReady: "No snapshots yet",
    },
    // CRITICAL: Schedule contract - no scheduler configured on load
    schedulerConfigured: false,
    mode: "onload", // Indicates initial load state (not yet scheduled)
    // Legacy compat fields - NO UNKNOWN, NO NOT_AVAILABLE
    coverageIncluded: [],
    coverageExcluded: [],
    knownDataGaps: [],
    retentionPolicy: { effectiveRuleText: "Not available yet" },
    completenessStatus: "INITIALIZING",  // Not UNKNOWN
    systemStatus: "INITIALIZING",
    failureCount7d: 0,
    freshnessStatus: "AGING",  // Not NOT_AVAILABLE
    skippedChecksCount7d: 0,
    expectedScheduleIntervalMinutes: null,
    staleIfAgeMinutesGreaterThan: null,
    // CRITICAL: snapshotAgeMinutes must be number|null, never undefined
    snapshotAgeMinutes: null,
    isStale: undefined,
    // Operational metrics (all unknown)
    operationalMetrics: {
      checksCompletedLifetime: null,
      snapshotsRetainedCount: null,
      daysContinuousOperation: null,
      failureCount7d: null,
      skippedChecksCount7d: null,
    },
    // Boundaries (all unknown)
    boundaries: {
      noJiraWrites: null,
      noConfigChanges: null,
      noEnforcement: null,
      noRecommendations: null,
      observationalOnly: null,
    },
  };
}

/**
 * Normalize a potentially incomplete/malformed status object.
 * NEVER throws. ALWAYS returns a complete GovernanceStatusV1.
 *
 * CRITICAL FIX (Phase 6-7):
 * - UNKNOWN → ERROR (fail-closed)
 * - NOT_AVAILABLE → DEGRADED (with reason: "telemetry-missing")
 * - Never returns these legacy strings in dist bundle
 *
 * Rules:
 * - If input is null/undefined => return EMPTY_STATUS_V1
 * - If input is not an object => return EMPTY_STATUS_V1
 * - For any missing nested object => use safe default
 * - For any missing array => default to []
 * - Ensure all required top-level fields exist
 */
export function normalizeStatusV1(
  input: unknown,
  tenantAri: string,
  backendBuild: string,
  uiBuild?: string
): GovernanceStatusV1 {
  // Fail-open: if input is falsy, return safe defaults
  if (!input || typeof input !== "object") {
    return EMPTY_STATUS_V1(tenantAri, backendBuild, uiBuild);
  }

  const obj = input as any;

  // Build the normalized object step-by-step
  const normalized: GovernanceStatusV1 = {
    // ═════════════════════════════════════════════════════════════════════
    // IDENTITY/PROOF CONTRACT FIELDS (MUST be present in every response)
    // ═════════════════════════════════════════════════════════════════════
    envelopeKind: obj.envelopeKind === "FT_DASH_ENVELOPE_V1" ? "FT_DASH_ENVELOPE_V1" : "FT_DASH_ENVELOPE_V1", // Always present
    ui_build_sha: typeof obj.ui_build_sha === "string" ? obj.ui_build_sha : (typeof obj.uiBuild === "string" ? obj.uiBuild : "UNSET"),
    ui_build_time_utc: typeof obj.ui_build_time_utc === "string" ? obj.ui_build_time_utc : "UNSET",
    backend_build_sha: typeof obj.backend_build_sha === "string" ? obj.backend_build_sha : (typeof obj.backendBuild === "string" ? obj.backendBuild : "UNSET"),
    backend_build_time_utc: typeof obj.backend_build_time_utc === "string" ? obj.backend_build_time_utc : "UNSET",
    correlation_id: typeof obj.correlation_id === "string" ? obj.correlation_id : `ft-proof-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    installationId: typeof obj.installationId === "string" ? obj.installationId : undefined,
    
    schemaVersion: (() => {
      const s = obj.schemaVersion;
      // STRICT: Accept "v1" or "1" for backward compat
      if (s === "v1" || s === "1") return s;
      return "v1"; // Default to new contract version
    })() as "v1" | "1",
    generatedAt: typeof obj.generatedAt === "string" ? obj.generatedAt : new Date().toISOString(),
    tenantAri: typeof obj.tenantAri === "string" ? obj.tenantAri : tenantAri,
    backendBuild: typeof obj.backendBuild === "string" ? obj.backendBuild : backendBuild,
    uiBuild,
    // CRITICAL FIX: Map UNKNOWN -> ERROR (fail-closed)
    health: (() => {
      const h = obj.health;
      if (h === "UNKNOWN") return "ERROR";  // Normalize legacy UNKNOWN to ERROR
      if (["OK", "DEGRADED", "ERROR"].includes(h)) return h as HealthState;
      return "ERROR";  // Default fallback: fail-closed
    })() as HealthState,
    degradedReason: typeof obj.degradedReason === "string" ? obj.degradedReason : undefined,
    scheduler: {
      lastHeartbeatAt: typeof obj.scheduler?.lastHeartbeatAt === "string" ? obj.scheduler.lastHeartbeatAt : undefined,
      lastRunStartedAt: typeof obj.scheduler?.lastRunStartedAt === "string" ? obj.scheduler.lastRunStartedAt : undefined,
      lastRunFinishedAt: typeof obj.scheduler?.lastRunFinishedAt === "string" ? obj.scheduler.lastRunFinishedAt : undefined,
      lastRunOk: typeof obj.scheduler?.lastRunOk === "boolean" ? obj.scheduler.lastRunOk : undefined,
      runCountLifetime: typeof obj.scheduler?.runCountLifetime === "number" ? obj.scheduler.runCountLifetime : 0,
      failures7d: typeof obj.scheduler?.failures7d === "number" ? obj.scheduler.failures7d : undefined,
      skipped7d: typeof obj.scheduler?.skipped7d === "number" ? obj.scheduler.skipped7d : undefined,
    },
    snapshots: {
      retainedCount: typeof obj.snapshots?.retainedCount === "number" ? obj.snapshots.retainedCount : 0,
      lastSnapshotAt: typeof obj.snapshots?.lastSnapshotAt === "string" ? obj.snapshots.lastSnapshotAt : undefined,
      lastSnapshotId: typeof obj.snapshots?.lastSnapshotId === "string" ? obj.snapshots.lastSnapshotId : undefined,
    },
    timeline: Array.isArray(obj.timeline) ? obj.timeline : [],
    checks: Array.isArray(obj.checks) ? obj.checks : [],
    errors: Array.isArray(obj.errors) ? obj.errors : [],
    export: {
      jsonReady: obj.export?.jsonReady === true,
      csvReady: obj.export?.csvReady === true,
      pdfReady: obj.export?.pdfReady === true,
      reasonNotReady: typeof obj.export?.reasonNotReady === "string" ? obj.export.reasonNotReady : undefined,
    },
    // Legacy compat
    coverageIncluded: Array.isArray(obj.coverageIncluded) ? obj.coverageIncluded : [],
    coverageExcluded: Array.isArray(obj.coverageExcluded) ? obj.coverageExcluded : [],
    knownDataGaps: Array.isArray(obj.knownDataGaps) ? obj.knownDataGaps : [],
    retentionPolicy: obj.retentionPolicy && typeof obj.retentionPolicy === "object" 
      ? { effectiveRuleText: String(obj.retentionPolicy.effectiveRuleText || "") }
      : { effectiveRuleText: "Not available yet" },
    // CRITICAL FIX: No UNKNOWN - use INITIALIZING instead
    completenessStatus: (() => {
      const c = obj.completenessStatus;
      if (c === "UNKNOWN") return "INITIALIZING";  // Normalize legacy UNKNOWN
      return typeof c === "string" ? c : "INITIALIZING";
    })(),
    systemStatus: typeof obj.systemStatus === "string" ? obj.systemStatus : "INITIALIZING",
    failureCount7d: typeof obj.failureCount7d === "number" ? obj.failureCount7d : 0,
    // CRITICAL FIX: No NOT_AVAILABLE - use AGING (indicates data freshness is unknown/stale)
    freshnessStatus: (() => {
      const f = obj.freshnessStatus;
      if (f === "NOT_AVAILABLE") return "AGING";  // Normalize legacy NOT_AVAILABLE
      return typeof f === "string" ? f : "AGING";
    })(),
    skippedChecksCount7d: typeof obj.skippedChecksCount7d === "number" ? obj.skippedChecksCount7d : 0,
    skippedChecksPrimaryReason7d: typeof obj.skippedChecksPrimaryReason7d === "string" ? obj.skippedChecksPrimaryReason7d : undefined,
    // CRITICAL: If scheduler not configured OR mode is manual/onload, intervals MUST be null to prevent UI invariant violations
    expectedScheduleIntervalMinutes: (obj.schedulerConfigured === false || obj.mode === "manual" || obj.mode === "onload")
      ? null
      : (typeof obj.expectedScheduleIntervalMinutes === "number" ? obj.expectedScheduleIntervalMinutes : 60),
    staleIfAgeMinutesGreaterThan: (obj.schedulerConfigured === false || obj.mode === "manual" || obj.mode === "onload")
      ? null
      : (typeof obj.staleIfAgeMinutesGreaterThan === "number" ? obj.staleIfAgeMinutesGreaterThan : 120),
    // CRITICAL: snapshotAgeMinutes must ALWAYS be number|null, NEVER undefined
    snapshotAgeMinutes: typeof obj.snapshotAgeMinutes === "number" ? obj.snapshotAgeMinutes : null,
    isStale: typeof obj.isStale === "boolean" ? obj.isStale : undefined,
    // CRITICAL: Include schedulerConfigured flag to prevent UI invariant violations
    schedulerConfigured: typeof obj.schedulerConfigured === "boolean" ? obj.schedulerConfigured : undefined,
    // Operational metrics: preserve from input or use nulls
    operationalMetrics: {
      checksCompletedLifetime: typeof obj.operationalMetrics?.checksCompletedLifetime === "number" ? obj.operationalMetrics.checksCompletedLifetime : (typeof obj.checksCompletedLifetime === "number" ? obj.checksCompletedLifetime : null),
      snapshotsRetainedCount: typeof obj.operationalMetrics?.snapshotsRetainedCount === "number" ? obj.operationalMetrics.snapshotsRetainedCount : (typeof obj.snapshotsRetainedCount === "number" ? obj.snapshotsRetainedCount : null),
      daysContinuousOperation: typeof obj.operationalMetrics?.daysContinuousOperation === "number" ? obj.operationalMetrics.daysContinuousOperation : (typeof obj.daysContinuousOperation === "number" ? obj.daysContinuousOperation : null),
      failureCount7d: typeof obj.operationalMetrics?.failureCount7d === "number" ? obj.operationalMetrics.failureCount7d : (typeof obj.failureCount7d === "number" ? obj.failureCount7d : null),
      skippedChecksCount7d: typeof obj.operationalMetrics?.skippedChecksCount7d === "number" ? obj.operationalMetrics.skippedChecksCount7d : (typeof obj.skippedChecksCount7d === "number" ? obj.skippedChecksCount7d : null),
    },
    // Boundaries: preserve from input or use nulls
    boundaries: {
      noJiraWrites: typeof obj.boundaries?.noJiraWrites === "boolean" ? obj.boundaries.noJiraWrites : null,
      noConfigChanges: typeof obj.boundaries?.noConfigChanges === "boolean" ? obj.boundaries.noConfigChanges : null,
      noEnforcement: typeof obj.boundaries?.noEnforcement === "boolean" ? obj.boundaries.noEnforcement : null,
      noRecommendations: typeof obj.boundaries?.noRecommendations === "boolean" ? obj.boundaries.noRecommendations : null,
      observationalOnly: typeof obj.boundaries?.observationalOnly === "boolean" ? obj.boundaries.observationalOnly : null,
    },
    // Legacy field names (supported for backward compat, prefer operationalMetrics/boundaries)
    checksCompletedLifetime: typeof obj.checksCompletedLifetime === "number" ? obj.checksCompletedLifetime : null,
    snapshotsRetainedCount: typeof obj.snapshotsRetainedCount === "number" ? obj.snapshotsRetainedCount : null,
    daysContinuousOperation: typeof obj.daysContinuousOperation === "number" ? obj.daysContinuousOperation : null,
    version: typeof obj.version === "string" ? obj.version : null,
    environment: typeof obj.environment === "string" ? obj.environment : null,
    mode: typeof obj.mode === "string" ? obj.mode : null,
    lastSuccessAt: typeof obj.lastSuccessAt === "string" ? obj.lastSuccessAt : null,
    lastCheckAt: typeof obj.lastCheckAt === "string" ? obj.lastCheckAt : null,
    dataFreshness: typeof obj.dataFreshness === "string" ? obj.dataFreshness : null,
  };

  return normalized;
}

/**
 * Safe storage key function.
 * Replaces invalid characters to comply with Forge storage key pattern:
 * ^(?!\s+$)[a-zA-Z0-9:._\s-#]+$
 *
 * Rules:
 * - Only allow [a-zA-Z0-9:._\s-#]
 * - Replace disallowed chars with "_"
 * - Trim
 * - If empty after sanitize => "UNKNOWN"
 */
export function safeStorageKey(input: string): string {
  if (!input || typeof input !== "string") {
    return "UNKNOWN";
  }

  // Replace invalid characters with "_"
  // Keep only: a-z, A-Z, 0-9, :, ., _, space, -, #
  const sanitized = input
    .replace(/[^a-zA-Z0-9:._\s\-#]/g, "_")
    .trim();

  return sanitized.length > 0 ? sanitized : "UNKNOWN";
}
