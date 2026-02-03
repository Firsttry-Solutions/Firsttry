/**
 * DashboardSnapshotV1 - Enterprise-Ready Dashboard Contract
 *
 * This contract defines the complete data structure returned by getDashboardSnapshotV1()
 * resolver for the enterprise dashboard gadget UI.
 *
 * Contract Guarantees:
 * - READ-ONLY: No mutations allowed on any data
 * - DETERMINISTIC: Same input → same output, always
 * - FAIL-CLOSED: Errors return FAIL state with error details
 * - NO-WRITES: No storage, API, or mutation calls
 * - SERIALIZABLE: All fields JSON-serializable, no PII or secrets
 *
 * Version: v1 (stable)
 * Last Updated: 2026-02-03
 */

/**
 * Health status indicators
 */
export type HealthStatus = 'OK' | 'DEGRADED' | 'FAIL' | 'INITIALIZING';

/**
 * Evidence snapshot from build system
 */
export interface EvidenceSnapshot {
  schemaVersion: string; // 'v1'
  capturedAtUtc: string; // ISO-8601 timestamp
  buildIdentifier: {
    gitSha: string; // Full 40-char SHA (immutable)
    gitShaShort: string; // 7-char short form
    buildTimeUtc: string; // Build time (immutable)
    appVersion: string; // Release version
  };
  uiBundleIdentity: {
    gitSha: string; // UI git SHA from build
    gitShaShort: string; // UI git SHA short
    buildTimeUtc: string; // UI build time
  };
}

/**
 * Read-only proof section - guarantees no mutations
 */
export interface ReadOnlyProof {
  guaranteed: boolean; // Always true - if false, contract is invalid
  reason: string; // Why this gadget is read-only
  scope: {
    canRead: boolean; // Always true
    canWrite: boolean; // Always false
    canExecuteJql: boolean; // Always false
    canCallApis: boolean; // Always false
  };
}

/**
 * Integrity check section - determinism & stability proof
 */
export interface IntegrityProof {
  type: 'DETERMINISTIC' | 'SNAPSHOT_BASED' | 'UNKNOWN';
  method: string; // How determinism is guaranteed
  checksum?: string; // Optional SHA256 of content
  frozenAt?: string; // When content was frozen (UTC)
}

/**
 * Health and diagnostics section
 */
export interface HealthDiagnostics {
  status: HealthStatus;
  resolverLatencyMs: number; // Time to execute resolver
  backendAvailable: boolean; // Backend connectivity
  storageAvailable: boolean; // Storage available
  uiConnected: boolean; // UI to resolver bridge working
  errors: Array<{
    code: string; // Error code (e.g., BACKEND_TIMEOUT)
    message: string; // Human-readable message
    timestamp: string; // When error occurred (UTC)
  }>;
  warnings: Array<{
    code: string; // Warning code
    message: string; // Human-readable warning
  }>;
}

/**
 * Action links for users
 */
export interface ActionLink {
  id: string; // 'export_evidence', 'refresh_snapshot', 'view_logs', etc.
  label: string; // Display text
  description: string; // Tooltip
  action: 'INTERNAL' | 'EXTERNAL'; // How to handle the action
  target?: string; // URL for external, function name for internal
  disabled?: boolean; // If action is unavailable
  disabledReason?: string; // Why it's disabled
}

/**
 * Complete snapshot contract
 *
 * Rendering sections:
 * 1. Header (title, badges, status)
 * 2. Evidence Snapshot (build identifiers, timestamps)
 * 3. Read-Only Proof (scope guarantees)
 * 4. Integrity (determinism proof)
 * 5. Health & Diagnostics (backend status, errors)
 * 6. Actions (export, refresh, etc.)
 */
export interface DashboardSnapshotV1 {
  // Contract metadata
  schemaVersion: 'v1'; // Locked to v1 - no nested versioning
  contractType: 'DashboardSnapshotV1'; // Contract type identifier
  generatedAtUtc: string; // When this contract was generated (ISO-8601)

  // Core snapshot data
  state: HealthStatus; // Overall health: OK | DEGRADED | FAIL | INITIALIZING

  // Read-only flag - MUST be true, else entire contract is invalid
  readOnly: ReadOnlyProof;

  // Evidence from build system
  evidence: EvidenceSnapshot;

  // Integrity guarantees
  integrity: IntegrityProof;

  // Health and diagnostics
  health: HealthDiagnostics;

  // Available actions
  actions: ActionLink[];

  // Correlation ID for tracing
  correlationId: string;

  // Request metadata (for debugging)
  request?: {
    userEmail?: string; // Anonymized/hashed if present
    timestamp?: string;
    userAgent?: string;
  };
}

/**
 * Validate that a contract conforms to DashboardSnapshotV1
 *
 * Fails if:
 * - schemaVersion !== 'v1'
 * - contractType !== 'DashboardSnapshotV1'
 * - readOnly.guaranteed !== true
 * - Any required field is missing
 * - state is not a valid HealthStatus
 */
export function validateDashboardSnapshotV1(obj: any): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check required fields
  if (obj.schemaVersion !== 'v1') {
    errors.push(
      `schemaVersion must be 'v1', got '${obj.schemaVersion}'`
    );
  }

  if (obj.contractType !== 'DashboardSnapshotV1') {
    errors.push(
      `contractType must be 'DashboardSnapshotV1', got '${obj.contractType}'`
    );
  }

  if (!obj.readOnly || obj.readOnly.guaranteed !== true) {
    errors.push('readOnly.guaranteed must be true');
  }

  if (!obj.generatedAtUtc) {
    errors.push('generatedAtUtc is required');
  }

  if (!obj.evidence || !obj.evidence.schemaVersion) {
    errors.push('evidence.schemaVersion is required');
  }

  if (!obj.health || !obj.health.status) {
    errors.push('health.status is required');
  }

  if (!obj.correlationId) {
    errors.push('correlationId is required');
  }

  // Validate state is a valid HealthStatus
  const validStates: HealthStatus[] = [
    'OK',
    'DEGRADED',
    'FAIL',
    'INITIALIZING',
  ];
  if (!validStates.includes(obj.state)) {
    errors.push(
      `state must be one of ${validStates.join(
        ', '
      )}, got '${obj.state}'`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Create a FAIL state contract (fail-closed)
 *
 * Used when resolver encounters an error and needs to return safely.
 */
export function createFailStateContract(
  errorCode: string,
  errorMessage: string,
  correlationId: string
): DashboardSnapshotV1 {
  return {
    schemaVersion: 'v1',
    contractType: 'DashboardSnapshotV1',
    generatedAtUtc: new Date().toISOString(),
    state: 'FAIL',
    readOnly: {
      guaranteed: true,
      reason: 'Dashboard gadget is read-only to prevent accidental modifications',
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
        gitSha: 'UNKNOWN',
        gitShaShort: 'UNKNOWN',
        buildTimeUtc: 'UNKNOWN',
        appVersion: 'UNKNOWN',
      },
      uiBundleIdentity: {
        gitSha: 'UNKNOWN',
        gitShaShort: 'UNKNOWN',
        buildTimeUtc: 'UNKNOWN',
      },
    },
    integrity: {
      type: 'UNKNOWN',
      method: 'Unknown due to error',
    },
    health: {
      status: 'FAIL',
      resolverLatencyMs: 0,
      backendAvailable: false,
      storageAvailable: false,
      uiConnected: true,
      errors: [
        {
          code: errorCode,
          message: errorMessage,
          timestamp: new Date().toISOString(),
        },
      ],
      warnings: [],
    },
    actions: [
      {
        id: 'refresh_snapshot',
        label: 'Try Again',
        description: 'Attempt to refresh the snapshot',
        action: 'INTERNAL',
        target: 'refreshSnapshot',
      },
    ],
    correlationId,
  };
}

/**
 * Create an INITIALIZING state contract
 *
 * Used on first load while waiting for snapshot.
 */
export function createInitializingStateContract(
  correlationId: string
): DashboardSnapshotV1 {
  return {
    schemaVersion: 'v1',
    contractType: 'DashboardSnapshotV1',
    generatedAtUtc: new Date().toISOString(),
    state: 'INITIALIZING',
    readOnly: {
      guaranteed: true,
      reason: 'Dashboard gadget is read-only to prevent accidental modifications',
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
        gitSha: 'INITIALIZING',
        gitShaShort: 'INIT',
        buildTimeUtc: 'INITIALIZING',
        appVersion: 'INITIALIZING',
      },
      uiBundleIdentity: {
        gitSha: 'INITIALIZING',
        gitShaShort: 'INIT',
        buildTimeUtc: 'INITIALIZING',
      },
    },
    integrity: {
      type: 'UNKNOWN',
      method: 'Snapshot not yet loaded',
    },
    health: {
      status: 'INITIALIZING',
      resolverLatencyMs: 0,
      backendAvailable: false,
      storageAvailable: false,
      uiConnected: true,
      errors: [],
      warnings: [
        {
          code: 'SNAPSHOT_LOADING',
          message: 'Loading snapshot from backend...',
        },
      ],
    },
    actions: [],
    correlationId,
  };
}
