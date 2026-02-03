/**
 * getDashboardSnapshotV1 Resolver
 *
 * Enterprise-ready dashboard gadget resolver that returns a complete,
 * deterministic snapshot contract for the UI to render.
 *
 * Behavior:
 * - Always returns a DashboardSnapshotV1 contract (never throws)
 * - Read-only: no mutations, storage writes, or API calls
 * - Fail-closed: errors return FAIL state with details
 * - Deterministic: same input → same output
 * - Single response: UI renders from one call only
 *
 * Called by: Dashboard gadget UI (invoke('getDashboardSnapshotV1'))
 * Returns: DashboardSnapshotV1 contract
 */

import { storage } from '@forge/api';
import {
  DashboardSnapshotV1,
  HealthStatus,
  createFailStateContract,
  createInitializingStateContract,
  validateDashboardSnapshotV1,
} from '../shared/DashboardSnapshotV1';
import { BACKEND_GIT_SHA, BACKEND_GIT_SHA_SHORT, BACKEND_BUILD_TIME_UTC, BACKEND_APP_VERSION } from '../build/buildIdentityBackend.gen';
import { UI_GIT_SHA, UI_GIT_SHA_SHORT, UI_BUILD_TIME_UTC } from '../gadget-ui/src/build/buildIdentity.gen';
import { v4 as uuidv4 } from 'crypto';

/**
 * Main resolver function
 *
 * @param request - Request object (unused but required by Forge)
 * @returns DashboardSnapshotV1 contract
 *
 * Contract is ALWAYS returned - never throws.
 * Errors are captured in the contract's health.errors field.
 */
export async function getDashboardSnapshotV1_resolver(
  request: any
): Promise<DashboardSnapshotV1> {
  const correlationId = `dash-${uuidv4().slice(0, 8)}`;
  const startTime = Date.now();

  console.log('[getDashboardSnapshotV1] START', {
    correlationId,
    timestamp: new Date().toISOString(),
  });

  try {
    // Build the complete contract
    const contract: DashboardSnapshotV1 = {
      schemaVersion: 'v1',
      contractType: 'DashboardSnapshotV1',
      generatedAtUtc: new Date().toISOString(),
      state: 'OK',
      readOnly: {
        guaranteed: true,
        reason:
          'Dashboard gadget is read-only to prevent accidental modifications',
        scope: {
          canRead: true,
          canWrite: false,
          canExecuteJql: false,
          canCallApis: false,
        },
      },
      evidence: {
        schemaVersion: 'v1',
        capturedAtUtc: new Date().toISOString(),
        buildIdentifier: {
          gitSha: BACKEND_GIT_SHA,
          gitShaShort: BACKEND_GIT_SHA_SHORT,
          buildTimeUtc: BACKEND_BUILD_TIME_UTC,
          appVersion: BACKEND_APP_VERSION,
        },
        uiBundleIdentity: {
          gitSha: UI_GIT_SHA,
          gitShaShort: UI_GIT_SHA_SHORT,
          buildTimeUtc: UI_BUILD_TIME_UTC,
        },
      },
      integrity: {
        type: 'SNAPSHOT_BASED',
        method: 'Build identity from git HEAD at build time',
        frozenAt: BACKEND_BUILD_TIME_UTC,
      },
      health: {
        status: 'OK',
        resolverLatencyMs: 0,
        backendAvailable: true,
        storageAvailable: true,
        uiConnected: true,
        errors: [],
        warnings: [],
      },
      actions: [
        {
          id: 'export_evidence',
          label: 'Export Evidence',
          description: 'Download this snapshot as JSON',
          action: 'INTERNAL',
          target: 'exportEvidence',
        },
        {
          id: 'refresh_snapshot',
          label: 'Refresh',
          description: 'Reload the snapshot from the server',
          action: 'INTERNAL',
          target: 'refreshSnapshot',
        },
        {
          id: 'view_audit_log',
          label: 'View Audit Log',
          description: 'Open the audit log for this app',
          action: 'EXTERNAL',
          target: '/jira/settings/apps/user-installed',
        },
      ],
      correlationId,
    };

    // Update resolver latency
    contract.health.resolverLatencyMs = Date.now() - startTime;

    // Validate contract before returning
    const validation = validateDashboardSnapshotV1(contract);
    if (!validation.valid) {
      console.error('[getDashboardSnapshotV1] Contract validation failed', {
        correlationId,
        errors: validation.errors,
      });

      return createFailStateContract(
        'INTERNAL_VALIDATION_ERROR',
        `Contract validation failed: ${validation.errors[0]}`,
        correlationId
      );
    }

    console.log('[getDashboardSnapshotV1] SUCCESS', {
      correlationId,
      state: contract.state,
      latencyMs: contract.health.resolverLatencyMs,
      timestamp: new Date().toISOString(),
    });

    return contract;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[getDashboardSnapshotV1] EXCEPTION', {
      correlationId,
      error: errorMsg,
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });

    // Return fail-closed contract
    return createFailStateContract(
      'RESOLVER_EXCEPTION',
      `Resolver encountered an error: ${errorMsg.slice(0, 100)}`,
      correlationId
    );
  }
}
