/**
 * Phase 2: Continuous Drift Monitoring — Type Definitions
 * Deterministic canonical JSON serialization for all persisted objects.
 */

export type DriftType =
  | "new_global_admin"
  | "admin_removed"
  | "external_elevated"
  | "project_became_widely_browsable"
  | "permission_scheme_modified";

export interface DriftEvent {
  eventId: string; // sha256(snapshotHash + "|" + entity + "|" + type)
  timestampUtc: string; // ISO UTC
  type: DriftType;
  entity: string; // accountId, email, or schemeId
  severity: "low" | "medium" | "high";
  explanation: string;
  snapshotHash: string;
}

export interface DriftBufferEntry {
  snapshotHash: string;
  timestampUtc: string;
  drifts: DriftEvent[];
}

export interface MonitoringHealth {
  lastScanUtc: string;
  nextScanUtc: string;
  status: "initializing" | "healthy" | "degraded" | "failed";
  estimatedUsageBytes: number;
  estimatedQuotaBytes: number; // constant 8 MiB, not platform quota
  driftCountLast30d: number;
  lastFailureCode?: "FT_DRIFT_SCAN_ABORT_REQUIRED_DATA_MISSING" | "FT_DRIFT_LOCKED" | "FT_DRIFT_TIME_BUDGET_EXCEEDED";
}

export interface MonitoringConfig {
  allowedDomains: string[]; // Canonical sorted unique array, lowercase
  webhooks: {
    slackWebhookUrl?: string;
    genericWebhookUrl?: string;
  };
}

export interface LockObject {
  acquiredAtUtc: string;
  expiresAtUtc: string;
  holderId: string; // sha256(buildShaShort + "|" + invocationStartUtc)
}

export interface DriftScanResult {
  drifts: DriftEvent[];
  baselineInitialized: boolean;
  scanDurationMs: number;
}
