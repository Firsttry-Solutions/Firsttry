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
 */

import { storage } from '@forge/api';
import { resolveTenantIdentity } from '../core/tenant_identity';
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
      systemStatus,
      mode: 'Scheduled monitoring (read-only)',
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
      systemStatus: 'DEGRADED',
      mode: 'Scheduled monitoring (read-only)',
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
    systemStatus: 'DEGRADED',
    mode: 'Scheduled monitoring (read-only)',
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
