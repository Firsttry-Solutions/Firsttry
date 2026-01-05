/**
 * GOVERNANCE STATUS RESOLVER
 * 
 * Provides comprehensive governance monitoring status to the dashboard gadget.
 * 
 * Contract (v2.14.0):
 * - Always returns a complete payload (never null)
 * - Tenant-scoped (storage key includes cloudId)
 * - Returns all required fields per spec
 * - Fields with missing data are null; completeness status reflects truth
 * - All timestamps ISO 8601 UTC
 * - Returns DEGRADED if tenant identity unavailable
 * 
 * NOTE: Contract version comments are documentation-only.
 * They do not affect runtime behavior, exports, UI rendering, or version reporting.
 */

import { storage } from '@forge/api';
import { resolveTenantIdentity } from '../core/tenant_identity';
import { getTenantIdentityFromContext } from '../core/health/tenant';
import { getRunRecord } from '../core/health/storage';
import { computeHealth } from '../core/health/compute';
import { getTimeline } from '../phase4/timeline';
import {
  EXPECTED_SCHEDULE_INTERVAL_MINUTES,
  STALENESS_MULTIPLIER,
  RETENTION_MAX_SNAPSHOTS,
  RETENTION_MAX_DAYS,
  APP_VERSION,
  APP_ENVIRONMENT,
} from '../core/constants';

// Storage key prefixes
const SNAPSHOT_KEY_PREFIX = 'governance:status:snapshot';
const METRICS_KEY_PREFIX = 'governance:metrics';

function getSnapshotKey(cloudId: string): string {
  if (!cloudId || cloudId.trim() === '') {
    return '';
  }
  return `${SNAPSHOT_KEY_PREFIX}:${cloudId}`;
}

function getMetricsKey(cloudId: string): string {
  if (!cloudId || cloudId.trim() === '') {
    return '';
  }
  return `${METRICS_KEY_PREFIX}:${cloudId}`;
}

/**
 * PHASE 1 LOCK-IN: Compute 7-day failure aggregates
 * Uses only structured signals from existing telemetry.
 */
function computeFailureCount7d(snapshot: any, metrics: any): { count: number; buckets: Record<string, number> } {
  // Initialize buckets
  const buckets: Record<string, number> = {
    IDENTITY: 0,
    PERMISSION: 0,
    SCHEDULER: 0,
    API: 0,
    UNKNOWN: 0,
  };

  // Rolling window: last 7 days in seconds
  const now = Date.now();
  const sevenDaysAgoMs = now - 7 * 24 * 60 * 60 * 1000;

  // Parse failures from snapshot checks (if available)
  if (snapshot?.checks && Array.isArray(snapshot.checks)) {
    snapshot.checks.forEach((check: any) => {
      // Only count failures
      if (check.status !== 'FAIL') return;

      // Check timestamp
      const checkTime = check.lastAttemptAt ? new Date(check.lastAttemptAt).getTime() : 0;
      if (checkTime < sevenDaysAgoMs) return; // Outside window

      // Categorize by reasonCode
      const code = check.reasonCode || 'UNKNOWN';
      if (code.includes('IDENTITY')) {
        buckets['IDENTITY']++;
      } else if (code.includes('PERMISSION')) {
        buckets['PERMISSION']++;
      } else if (code.includes('SCHEDULER')) {
        buckets['SCHEDULER']++;
      } else if (code.includes('API') || code.includes('THROTTL')) {
        buckets['API']++;
      } else {
        buckets['UNKNOWN']++;
      }
    });
  }

  const count = Object.values(buckets).reduce((a, b) => a + b, 0);
  return { count, buckets };
}

/**
 * PHASE 1 LOCK-IN: Compute degraded reason (single sentence, priority-based)
 * Only returns a reason if state is DEGRADED; otherwise null.
 */
function computeDegradedReason(
  health: any,
  snapshot: any,
  metrics: any,
  failureCount7d: number
): string | null {
  // Only set if state is DEGRADED
  if (health?.state !== 'DEGRADED') {
    return null;
  }

  // Priority 1: Identity missing/invalid (fail-closed)
  if (!health?.cloudId || health.cloudId === 'unknown') {
    return 'Tenant identity is unavailable or invalid.';
  }

  // Priority 2: Scheduler missed run / scheduler error
  if (health?.reasons?.some((r: any) => r.code === 'SCHEDULER')) {
    return 'Scheduler failed to execute the last check.';
  }

  // Priority 3: Partial check failures
  if (failureCount7d > 0) {
    return `${failureCount7d} check(s) failed in the last 7 days.`;
  }

  // Priority 4: Dependency unavailable
  if (health?.reasons?.some((r: any) => r.code?.includes('DEPENDENCY'))) {
    return 'A required dependency is unavailable.';
  }

  // Priority 5: Unknown system error
  if (health?.reasons?.some((r: any) => r.code === 'RUNTIME_EXCEPTION')) {
    return 'An unexpected system error occurred.';
  }

  // Fallback (should rarely reach here)
  return 'System is degraded; see operational status for details.';
}

/**
 * PHASE 1 LOCK-IN: Compute skipped checks count and primary reason
 * Only counts checks explicitly marked as SKIPPED in snapshot.
 */
function computeSkippedChecks7d(snapshot: any): { count: number; primaryReason: string } {
  const now = Date.now();
  const sevenDaysAgoMs = now - 7 * 24 * 60 * 60 * 1000;

  let count = 0;
  const reasonCodes: Map<string, number> = new Map();

  // Parse skipped checks from snapshot
  if (snapshot?.checks && Array.isArray(snapshot.checks)) {
    snapshot.checks.forEach((check: any) => {
      if (check.status !== 'SKIPPED') return;

      const checkTime = check.lastAttemptAt ? new Date(check.lastAttemptAt).getTime() : 0;
      if (checkTime < sevenDaysAgoMs) return;

      count++;

      // Track reason codes
      const reason = check.reasonCode || 'UNKNOWN';
      reasonCodes.set(reason, (reasonCodes.get(reason) || 0) + 1);
    });
  }

  // Determine primary reason (most frequent)
  let primaryReason = 'NOT_AVAILABLE';
  if (count > 0) {
    const mostFrequent = Array.from(reasonCodes.entries()).sort((a, b) => b[1] - a[1])[0];
    const code = mostFrequent[0];

    if (code.includes('PERMISSION')) {
      primaryReason = 'PERMISSION_UNAVAILABLE';
    } else if (code.includes('IDENTITY')) {
      primaryReason = 'IDENTITY_UNAVAILABLE';
    } else if (code.includes('THROTTL')) {
      primaryReason = 'API_THROTTLED';
    } else if (code.includes('DEPENDENCY')) {
      primaryReason = 'DEPENDENCY_UNAVAILABLE';
    } else if (code.includes('SAFETY')) {
      primaryReason = 'SAFETY_BLOCK';
    } else {
      primaryReason = 'NOT_AVAILABLE';
    }
  }

  return { count, primaryReason };
}

/**
 * PHASE 1 LOCK-IN: Compute data freshness status label
 * Based on time since lastSuccessAt.
 */
function computeFreshnessStatus(lastSuccessAt: string | null): {
  status: 'FRESH' | 'AGING' | 'STALE' | 'NOT_AVAILABLE';
  ageSeconds: number | null;
} {
  if (!lastSuccessAt) {
    return { status: 'NOT_AVAILABLE', ageSeconds: null };
  }

  const lastSuccessMs = new Date(lastSuccessAt).getTime();
  const nowMs = Date.now();
  const ageSeconds = Math.floor((nowMs - lastSuccessMs) / 1000);

  const hours24 = 24 * 60 * 60;
  const hours72 = 72 * 60 * 60;

  let status: 'FRESH' | 'AGING' | 'STALE';
  if (ageSeconds < hours24) {
    status = 'FRESH';
  } else if (ageSeconds <= hours72) {
    status = 'AGING';
  } else {
    status = 'STALE';
  }

  return { status, ageSeconds };
}

/**
 * Initialize status snapshot with defaults
 */
function createInitializingSnapshot() {
  return {
    appName: 'FirstTry',
    version: null,
    environment: null,
    mode: 'Scheduled monitoring (read-only)',
    boundaries: {
      monitoringActive: true,
      readOnlyMode: true,
      noJiraWrites: true,
      noConfigChanges: true,
      noEnforcement: true,
    },
    lastAttemptAt: null,
    lastSuccessAt: null,
    lastFailureAt: null,
    lastFailureReason: null,
    checks: [
      {
        id: 'phase4-evidence',
        name: 'Phase-4 Evidence Collection',
        source: 'Scheduled Phase-4 snapshot (daily)',
        status: 'PENDING',
        lastAttemptAt: null,
        lastSuccessAt: null,
        reasonCode: 'NO_SNAPSHOT_YET',
        reasonMessage: 'Monitoring active. First snapshot will appear after the next scheduled run.',
      },
      {
        id: 'phase5-report',
        name: 'Phase-5 Trust Report Generation',
        source: 'Scheduled Phase-5 trigger (every 5 minutes)',
        status: 'PENDING',
        lastAttemptAt: null,
        lastSuccessAt: null,
        reasonCode: 'NO_SNAPSHOT_YET',
        reasonMessage: 'Monitoring active. Report generation starts after initial evidence collection.',
      },
      {
        id: 'jira-scope',
        name: 'Jira Metadata Access',
        source: 'App manifest (read:jira-work scope)',
        status: 'READY',
        lastAttemptAt: null,
        lastSuccessAt: null,
        reasonCode: null,
        reasonMessage: null,
      },
    ],
    counters: {
      checksCompleted: 0,
      snapshotsCount: 0,
      daysContinuousOperation: 0, // Best-effort; requires registration timestamp
    },
  };
}

/**
 * Create error snapshot for resolver failures
 */
function createErrorSnapshot(errorMessage: string) {
  const initializing = createInitializingSnapshot();
  return {
    ...initializing,
    lastFailureAt: new Date().toISOString(),
    lastFailureReason: {
      code: 'RESOLVER_ERROR',
      message: errorMessage,
    },
    checks: initializing.checks.map((check) => ({
      ...check,
      status: 'ERROR',
      reasonCode: 'RESOLVER_ERROR',
      reasonMessage: `Resolver encountered an error: ${errorMessage}`,
    })),
  };
}

/**
 * Build comprehensive resolver payload per v2.14.0 spec
 */
async function buildPayload(cloudId: string): Promise<Record<string, unknown>> {
  try {
    // Load snapshot and metrics
    const snapshotKey = getSnapshotKey(cloudId);
    const metricsKey = getMetricsKey(cloudId);

    const snapshot = await storage.get(snapshotKey);
    const metrics = await storage.get(metricsKey);

    // Load config visibility snapshot (Phase 2)
    const configVisibilitySnapshotKey = `config_visibility:snapshot:${cloudId}`;
    const configVisibility = await storage.get(configVisibilitySnapshotKey);

    // Load perf signals snapshot (Phase 3)
    const perfSignalsSnapshotKey = `perf_signals:snapshot:${cloudId}`;
    const perfSignals = await storage.get(perfSignalsSnapshotKey);

    // Load Phase 4 change timeline (append-only)
    const phase4Timeline = await getTimeline(cloudId);

    // Load run record and compute health
    const runRecord = await getRunRecord(cloudId);
    const health = computeHealth(runRecord);

    // Calculate staleness
    const lastSuccessAt = snapshot?.lastSuccessAt || metrics?.lastSuccessAt || null;
    const lastCheckAt = snapshot?.lastAttemptAt || metrics?.lastCheckAt || null;

    let snapshotAgeMinutes: number | null = null;
    let isStale: boolean | null = null;
    let systemStatus = 'INITIALIZING';
    let staleIfAgeMinutesGreaterThan: number | null = null;

    if (lastSuccessAt) {
      const ageMs = Date.now() - new Date(lastSuccessAt).getTime();
      snapshotAgeMinutes = Math.floor(ageMs / 60000);
      staleIfAgeMinutesGreaterThan = EXPECTED_SCHEDULE_INTERVAL_MINUTES * STALENESS_MULTIPLIER;
      isStale = snapshotAgeMinutes > staleIfAgeMinutesGreaterThan;
      systemStatus = isStale ? 'DEGRADED' : 'RUNNING';
    } else if (lastCheckAt) {
      const ageMs = Date.now() - new Date(lastCheckAt).getTime();
      snapshotAgeMinutes = Math.floor(ageMs / 60000);
      staleIfAgeMinutesGreaterThan = EXPECTED_SCHEDULE_INTERVAL_MINUTES * STALENESS_MULTIPLIER;
      isStale = snapshotAgeMinutes > staleIfAgeMinutesGreaterThan;
      systemStatus = isStale ? 'DEGRADED' : 'RUNNING';
    }

    // Compute checks completed lifetime
    const checksCompletedLifetime = metrics?.checksCompletedLifetime || null;
    const snapshotsRetainedCount = metrics?.snapshotsRetainedCount || null;
    const continuousSince = metrics?.continuousSince || null;
    const daysContinuousOperation = metrics?.daysContinuousOperation || null;

    // Determine completeness
    let completenessStatus: 'COMPLETE' | 'PARTIAL' | 'INCOMPLETE' = 'COMPLETE';
    const coverageIncluded: string[] = [];
    const coverageExcluded: string[] = [];
    const knownDataGaps: string[] = [];

    if (lastSuccessAt && lastCheckAt) {
      coverageIncluded.push('Last successful run timestamp', 'Last check timestamp');
    }
    if (checksCompletedLifetime !== null) {
      coverageIncluded.push('Lifetime checks completed count');
    } else {
      coverageExcluded.push('Lifetime checks completed count');
      knownDataGaps.push('Lifetime counts not yet available');
      completenessStatus = 'PARTIAL';
    }
    if (snapshotsRetainedCount !== null) {
      coverageIncluded.push('Retained snapshots count');
    } else {
      coverageExcluded.push('Retained snapshots count');
      completenessStatus = 'PARTIAL';
    }
    if (daysContinuousOperation !== null) {
      coverageIncluded.push('Days of continuous operation');
    } else {
      coverageExcluded.push('Days of continuous operation');
      completenessStatus = 'PARTIAL';
    }

    // Parse checks from snapshot
    const checks: any[] = [];
    if (snapshot?.checks && Array.isArray(snapshot.checks)) {
      snapshot.checks.slice(0, 20).forEach((check: any) => {
        checks.push({
          name: check.name || 'Unknown',
          status: check.status || 'UNKNOWN',
          lastRunAt: check.lastSuccessAt || check.lastAttemptAt || null,
          reasonCode: check.reasonCode || '—',
          impact: check.reasonMessage || '—',
          severityRank: check.status === 'FAIL' ? 1 : check.status === 'WARN' ? 2 : 3,
        });
      });
    }

    // PHASE 1 LOCK-IN: Compute 7-day metrics
    const failureCount7d = computeFailureCount7d(snapshot, metrics);
    const skippedChecks7d = computeSkippedChecks7d(snapshot);
    const freshness = computeFreshnessStatus(lastSuccessAt);
    const degradedReason = computeDegradedReason(health, snapshot, metrics, failureCount7d.count);

    return {
      // App Identity (Diagnostic)
      appId: process.env.FORGE_APP_ID || 'UNKNOWN',
      environment: APP_ENVIRONMENT,
      cloudId: cloudId || 'UNKNOWN',
      installationId: process.env.FORGE_INSTALLATION_ID || 'UNKNOWN',
      serverBuildStamp: 'SERVER_BUILD__2026-01-03T154524',
      
      // Identity & availability
      tenantIdentity: {
        available: true,
      },
      permissionVisibility: {
        determined: true,
      },

      // Schedule + staleness
      expectedScheduleIntervalMinutes: EXPECTED_SCHEDULE_INTERVAL_MINUTES,
      stalenessMultiplier: STALENESS_MULTIPLIER,
      staleIfAgeMinutesGreaterThan,
      lastCheckAt,
      lastSuccessAt,
      snapshotAgeMinutes,
      isStale,

      // Counts + continuity
      checksCompletedLifetime,
      snapshotsRetainedCount,
      continuousSince,
      daysContinuousOperation,

      // PHASE 1 LOCK-IN: 7-day aggregates
      failureCount7d: failureCount7d.count,
      failureBuckets7d: failureCount7d.buckets,
      degradedReason,
      skippedChecksCount7d: skippedChecks7d.count,
      skippedChecksPrimaryReason7d: skippedChecks7d.primaryReason,
      freshnessStatus: freshness.status,
      freshnessAgeSeconds: freshness.ageSeconds,

      // Data quality
      completenessStatus,
      coverageIncluded,
      coverageExcluded,
      knownDataGaps,
      retentionPolicy: {
        maxSnapshots: RETENTION_MAX_SNAPSHOTS,
        maxDays: RETENTION_MAX_DAYS,
        effectiveRuleText: `Last ${RETENTION_MAX_SNAPSHOTS} snapshots OR last ${RETENTION_MAX_DAYS} days (whichever is smaller)`,
      },

      // Checks
      checks,
      checksTotalCount: snapshot?.checks?.length || 0,

      // Config Visibility (Phase 2)
      configVisibility: configVisibility || null,

      // Performance Signals (Phase 3)
      perfSignals: perfSignals || null,

      // Change Awareness Timeline (Phase 4 - SEALED SPEC: Read-only, Append-only)
      phase4Timeline: phase4Timeline || null,

      // Health Status (minimal, deterministic)
      health,

      // Boundaries
      boundaries: {
        noJiraWrites: true,
        noConfigChanges: true,
        noEnforcement: true,
        noRecommendations: true,
        noExternalEgress: true,
        observationalOnly: true,
        failClosedOnMissingTenantIdentity: true,
      },

      // Metadata
      schemaVersion: '2.14.0',
      generatedAt: new Date().toISOString(),
      version: APP_VERSION,
      uiExpectedBuild: `UI_${APP_VERSION}`,
      systemStatus,
      mode: 'Scheduled monitoring (read-only)',
      
      // This resolver is read-only:
      // - No Jira writes
      // - No configuration mutation
      // - No enforcement
      // - No recommendations
      // Version/environment fields are informational only.
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      // App Identity (Diagnostic)
      appId: process.env.FORGE_APP_ID || 'UNKNOWN',
      environment: APP_ENVIRONMENT,
      cloudId: 'UNKNOWN',
      installationId: process.env.FORGE_INSTALLATION_ID || 'UNKNOWN',
      serverBuildStamp: 'SERVER_BUILD__2026-01-03T154524',
      
      // Identity & availability
      tenantIdentity: { available: true },
      permissionVisibility: { determined: false, reasonCode: 'RESOLVER_ERROR' },
      expectedScheduleIntervalMinutes: EXPECTED_SCHEDULE_INTERVAL_MINUTES,
      stalenessMultiplier: STALENESS_MULTIPLIER,
      staleIfAgeMinutesGreaterThan: null,
      lastCheckAt: null,
      lastSuccessAt: null,
      snapshotAgeMinutes: null,
      isStale: null,
      checksCompletedLifetime: null,
      snapshotsRetainedCount: null,
      continuousSince: null,
      daysContinuousOperation: null,

      // PHASE 1 LOCK-IN: 7-day aggregates (all unavailable on error)
      failureCount7d: 0,
      failureBuckets7d: { IDENTITY: 0, PERMISSION: 0, SCHEDULER: 0, API: 0, UNKNOWN: 0 },
      degradedReason: null,
      skippedChecksCount7d: 0,
      skippedChecksPrimaryReason7d: 'NOT_AVAILABLE',
      freshnessStatus: 'NOT_AVAILABLE' as const,
      freshnessAgeSeconds: null,

      completenessStatus: 'INCOMPLETE',
      coverageIncluded: [],
      coverageExcluded: ['All operational metrics'],
      knownDataGaps: [errorMessage],
      retentionPolicy: {
        maxSnapshots: RETENTION_MAX_SNAPSHOTS,
        maxDays: RETENTION_MAX_DAYS,
        effectiveRuleText: `Last ${RETENTION_MAX_SNAPSHOTS} snapshots OR last ${RETENTION_MAX_DAYS} days (whichever is smaller)`,
      },
      checks: [],
      checksTotalCount: 0,
      configVisibility: null,
      perfSignals: null,
      phase4Timeline: null,
      boundaries: {
        noJiraWrites: true,
        noConfigChanges: true,
        noEnforcement: true,
        noRecommendations: true,
        noExternalEgress: true,
        observationalOnly: true,
        failClosedOnMissingTenantIdentity: true,
      },
      schemaVersion: '2.14.0',
      generatedAt: new Date().toISOString(),
      version: APP_VERSION,
      uiExpectedBuild: `UI_${APP_VERSION}`,
      systemStatus: 'DEGRADED',
      mode: 'Scheduled monitoring (read-only)',
      
      // This resolver is read-only:
      // - No Jira writes
      // - No configuration mutation
      // - No enforcement
      // - No recommendations
      // Version/environment fields are informational only.
    };
  }
}

/**
 * Handle missing tenant identity
 */
function createDegradedPayload(reasonCode: string): Record<string, unknown> {
  return {
    // App Identity (Diagnostic)
    appId: process.env.FORGE_APP_ID || 'UNKNOWN',
    environment: APP_ENVIRONMENT,
    cloudId: 'UNKNOWN',
    installationId: process.env.FORGE_INSTALLATION_ID || 'UNKNOWN',
    serverBuildStamp: 'SERVER_BUILD__2026-01-03T154524',
    
    // Identity & availability
    tenantIdentity: { available: false, reasonCode },
    permissionVisibility: { determined: false },
    expectedScheduleIntervalMinutes: EXPECTED_SCHEDULE_INTERVAL_MINUTES,
    stalenessMultiplier: STALENESS_MULTIPLIER,
    staleIfAgeMinutesGreaterThan: null,
    lastCheckAt: null,
    lastSuccessAt: null,
    snapshotAgeMinutes: null,
    isStale: null,
    checksCompletedLifetime: null,
    snapshotsRetainedCount: null,
    continuousSince: null,
    daysContinuousOperation: null,

    // PHASE 1 LOCK-IN: 7-day aggregates (all unavailable when identity missing)
    failureCount7d: 0,
    failureBuckets7d: { IDENTITY: 0, PERMISSION: 0, SCHEDULER: 0, API: 0, UNKNOWN: 0 },
    degradedReason: 'Tenant identity is unavailable or invalid.',
    skippedChecksCount7d: 0,
    skippedChecksPrimaryReason7d: 'NOT_AVAILABLE',
    freshnessStatus: 'NOT_AVAILABLE' as const,
    freshnessAgeSeconds: null,

    completenessStatus: 'INCOMPLETE',
    coverageIncluded: [],
    coverageExcluded: ['All operational metrics'],
    knownDataGaps: [`Tenant identity unavailable: ${reasonCode}`],
    retentionPolicy: {
      maxSnapshots: RETENTION_MAX_SNAPSHOTS,
      maxDays: RETENTION_MAX_DAYS,
      effectiveRuleText: `Last ${RETENTION_MAX_SNAPSHOTS} snapshots OR last ${RETENTION_MAX_DAYS} days (whichever is smaller)`,
    },
    checks: [],
    checksTotalCount: 0,
    boundaries: {
      noJiraWrites: true,
      noConfigChanges: true,
      noEnforcement: true,
      noRecommendations: true,
      noExternalEgress: true,
      observationalOnly: true,
      failClosedOnMissingTenantIdentity: true,
    },
    schemaVersion: '2.14.0',
    generatedAt: new Date().toISOString(),
    version: APP_VERSION,
    uiExpectedBuild: `UI_${APP_VERSION}`,
    systemStatus: 'DEGRADED',
    mode: 'Scheduled monitoring (read-only)',
    
    // This resolver is read-only:
    // - No Jira writes
    // - No configuration mutation
    // - No enforcement
    // - No recommendations
    // Version/environment fields are informational only.
  };
}

/**
 * Main resolver handler (v2.14.0)
 * Invoked by dashboard gadget to display comprehensive governance status
 */
export async function get(request: any, context: any): Promise<Record<string, unknown>> {
  try {
    // Resolve tenant identity from Forge context
    const tenantId = await resolveTenantIdentity(context);

    if (!tenantId || !tenantId.cloudId) {
      return createDegradedPayload('TENANT_IDENTITY_UNAVAILABLE');
    }

    const cloudId = tenantId.cloudId;

    // Build comprehensive payload
    return await buildPayload(cloudId);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return createDegradedPayload(`RESOLVER_ERROR: ${errorMessage}`);
  }
}
