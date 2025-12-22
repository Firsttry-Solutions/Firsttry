/**
 * PHASE P3.3: HEALTH SUMMARY & DIAGNOSTICS
 *
 * Exposes internal health signals for admin diagnostics without PII.
 * 
 * Health summary includes:
 * - Last snapshot/export/error timestamps
 * - Recent success rates (windowed)
 * - Drift status summary
 * - Explicit UNKNOWN reasons when data missing
 *
 * Non-negotiable:
 * - Never includes raw cloudId or user IDs
 * - Explicit about missing data (no guessing)
 * - All timestamps are ISO format
 * - Ready for admin UI and JSON endpoints
 */

import { TenantContext } from '../security/tenant_context';

/**
 * Health status enum
 */
export type HealthStatus =
  | 'HEALTHY'      // All systems nominal
  | 'DEGRADED'     // Some issues but operational
  | 'UNHEALTHY'    // Major issues
  | 'UNKNOWN';     // Cannot determine (missing data)

/**
 * Drift summary
 */
export type DriftSummary =
  | 'NO_DRIFT'
  | 'DRIFT_DETECTED'
  | 'UNKNOWN';

/**
 * Health summary for a tenant
 * Safe to expose in admin UI without PII
 */
export interface HealthSummary {
  // Temporal context
  computedAtISO: string;     // When this summary was computed
  windowEndISO: string;      // End of aggregation window
  windowStartISO: string;    // Start of aggregation window
  
  // Overall status
  status: HealthStatus;
  notes: string[];           // Explicit explanations of status
  
  // Last activity timestamps (or null if no data)
  lastSnapshotAtISO: string | null;
  lastExportAtISO: string | null;
  lastErrorAtISO: string | null;
  
  // Recent SLI metrics (windowed, e.g. last 24h)
  recentSuccessRate: number | null;        // Percentage (0-100)
  recentDegradedExportRate: number | null; // Percentage of exports that were DEGRADED
  
  // Drift status summary
  driftStatusSummary: DriftSummary;
  
  // Explicit about missing data
  hasCompleteData: boolean;
  missingDataExplanation?: string; // Populated if hasCompleteData is false
}

/**
 * Compute health summary for a tenant
 * Placeholder implementation; real version queries metric events and audit events
 *
 * @param tenantContext - Tenant context
 * @param windowSeconds - Aggregation window (default 86400 = 24h)
 * @returns HealthSummary with explicit UNKNOWN explanations
 */
export async function computeHealthSummary(
  tenantContext: TenantContext,
  windowSeconds: number = 86400 // 24 hours default
): Promise<HealthSummary> {
  const now = new Date();
  const nowISO = now.toISOString();
  const windowStartISO = new Date(now.getTime() - (windowSeconds * 1000)).toISOString();

  // Placeholder implementation
  // Real version:
  // 1. Queries metric events for this tenant
  // 2. Queries audit events (OUTPUT_GENERATED, OUTPUT_EXPORTED, ERROR_OCCURRED)
  // 3. Computes derived metrics (success rate, degraded %, etc.)
  // 4. Returns explicit UNKNOWN reasons if data missing

  return {
    computedAtISO: nowISO,
    windowEndISO: nowISO,
    windowStartISO,
    
    // Status (would be computed from metrics)
    status: 'UNKNOWN',
    notes: [
      'Health summary computation requires metric events to be implemented.',
      'For now, all metrics return UNKNOWN to indicate missing implementation.',
    ],
    
    // Last activity (null indicates no data)
    lastSnapshotAtISO: null,
    lastExportAtISO: null,
    lastErrorAtISO: null,
    
    // SLI metrics (null indicates no data)
    recentSuccessRate: null,
    recentDegradedExportRate: null,
    
    // Drift (null indicates no data)
    driftStatusSummary: 'UNKNOWN',
    
    // Explicit about missing data
    hasCompleteData: false,
    missingDataExplanation: 'Metric events have not been recorded yet or are not yet available for query.',
  };
}

/**
 * Health check endpoint response
 * Can be used for /health endpoints or admin diagnostics
 */
export interface HealthCheckResponse {
  status: number;  // HTTP status (200)
  body: string;    // JSON-serialized HealthSummary
  headers?: Record<string, string>;
}

/**
 * Generate health check response for HTTP endpoint
 *
 * @param summary - HealthSummary
 * @returns HealthCheckResponse safe for JSON serialization
 */
export function createHealthCheckResponse(summary: HealthSummary): HealthCheckResponse {
  return {
    status: 200,
    body: JSON.stringify({
      healthy: summary.status === 'HEALTHY',
      status: summary.status,
      summary,
      timestamp: new Date().toISOString(),
    }),
    headers: {
      'Content-Type': 'application/json',
    },
  };
}
