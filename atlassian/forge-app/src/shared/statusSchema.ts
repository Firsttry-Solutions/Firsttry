/**
 * SHARED STATUS SCHEMA v1.0
 * ========================
 * Used by BOTH resolver and UI to ensure type safety and prevent crashes.
 * This is the single source of truth for the governance status payload.
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
  // Core metadata
  schemaVersion: "1";
  generatedAt: string; // ISO 8601
  tenantAri: string;
  backendBuild: string;
  uiBuild?: string;

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
  expectedScheduleIntervalMinutes?: number;
  staleIfAgeMinutesGreaterThan?: number;
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
  mode?: string | null;
  lastSuccessAt?: string | null;
  lastCheckAt?: string | null;
  dataFreshness?: string | null;
}

/**
 * Create an empty, safe status object with all defaults.
 * This is used when storage is empty or resolver encounters an error.
 */
export function EMPTY_STATUS_V1(
  tenantAri: string,
  backendBuild: string,
  uiBuild?: string
): GovernanceStatusV1 {
  const now = new Date().toISOString();
  return {
    schemaVersion: "1",
    generatedAt: now,
    tenantAri,
    backendBuild,
    uiBuild,
    health: "UNKNOWN",
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
    // Legacy compat fields
    coverageIncluded: [],
    coverageExcluded: [],
    knownDataGaps: [],
    retentionPolicy: { effectiveRuleText: "Not available yet" },
    completenessStatus: "UNKNOWN",
    systemStatus: "INITIALIZING",
    failureCount7d: 0,
    freshnessStatus: "NOT_AVAILABLE",
    skippedChecksCount7d: 0,
    expectedScheduleIntervalMinutes: 60,
    staleIfAgeMinutesGreaterThan: 120,
    snapshotAgeMinutes: undefined,
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
    schemaVersion: "1",
    generatedAt: typeof obj.generatedAt === "string" ? obj.generatedAt : new Date().toISOString(),
    tenantAri: typeof obj.tenantAri === "string" ? obj.tenantAri : tenantAri,
    backendBuild: typeof obj.backendBuild === "string" ? obj.backendBuild : backendBuild,
    uiBuild,
    health: (["OK", "DEGRADED", "ERROR", "UNKNOWN"].includes(obj.health) ? obj.health : "UNKNOWN") as HealthState,
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
    completenessStatus: typeof obj.completenessStatus === "string" ? obj.completenessStatus : "UNKNOWN",
    systemStatus: typeof obj.systemStatus === "string" ? obj.systemStatus : "INITIALIZING",
    failureCount7d: typeof obj.failureCount7d === "number" ? obj.failureCount7d : 0,
    freshnessStatus: typeof obj.freshnessStatus === "string" ? obj.freshnessStatus : "NOT_AVAILABLE",
    skippedChecksCount7d: typeof obj.skippedChecksCount7d === "number" ? obj.skippedChecksCount7d : 0,
    skippedChecksPrimaryReason7d: typeof obj.skippedChecksPrimaryReason7d === "string" ? obj.skippedChecksPrimaryReason7d : undefined,
    expectedScheduleIntervalMinutes: typeof obj.expectedScheduleIntervalMinutes === "number" ? obj.expectedScheduleIntervalMinutes : 60,
    staleIfAgeMinutesGreaterThan: typeof obj.staleIfAgeMinutesGreaterThan === "number" ? obj.staleIfAgeMinutesGreaterThan : 120,
    snapshotAgeMinutes: typeof obj.snapshotAgeMinutes === "number" ? obj.snapshotAgeMinutes : undefined,
    isStale: typeof obj.isStale === "boolean" ? obj.isStale : undefined,
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
