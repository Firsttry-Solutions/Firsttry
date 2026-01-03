/**
 * GOVERNANCE STATUS RESOLVER
 * 
 * Provides real-time governance monitoring status to the dashboard gadget.
 * 
 * Contract:
 * - Always returns a snapshot (never null)
 * - Tenant-scoped (storage key includes cloudId)
 * - Shows app name, monitoring state, boundaries, and check availability
 * - Returns INITIALIZING state if no snapshot yet (first run pending)
 */

import { storage } from '@forge/api';
import { resolveTenantIdentity } from '../core/tenant_identity';

// Storage key for governance status snapshot (tenant-scoped)
const SNAPSHOT_KEY_PREFIX = 'governance:status:snapshot';

function getSnapshotKey(cloudId: string): string {
  // Fail-safe: do not create key with empty cloudId
  if (!cloudId || cloudId.trim() === '') {
    return '';
  }
  return `${SNAPSHOT_KEY_PREFIX}:${cloudId}`;
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
 * Main resolver handler
 * Invoked by dashboard gadget to display real-time governance status
 */
export async function get(request: any, context: any): Promise<Record<string, unknown>> {
  try {
    // Resolve tenant identity from Forge context
    const tenantId = await resolveTenantIdentity(context);

    if (!tenantId || !tenantId.cloudId) {
      return createErrorSnapshot('Unable to resolve tenant cloudId from Forge context');
    }

    const cloudId = tenantId.cloudId;
    const key = getSnapshotKey(cloudId);

    if (!key) {
      return createErrorSnapshot('Invalid cloudId: cannot create storage key');
    }

    // Attempt to load existing snapshot
    const snapshot = await storage.get(key);

    if (snapshot) {
      // Return existing snapshot
      return snapshot as Record<string, unknown>;
    }

    // No snapshot exists yet; return INITIALIZING state
    return createInitializingSnapshot();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return createErrorSnapshot(errorMessage);
  }
}
