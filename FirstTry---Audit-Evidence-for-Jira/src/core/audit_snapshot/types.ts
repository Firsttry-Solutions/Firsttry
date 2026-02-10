/**
 * Phase 5 Audit Snapshot Types
 * 
 * TrustSnapshot: Point-in-time immutable record of operational state
 * SnapshotRecord: Metadata and canonical JSON for storage
 * 
 * These types are sealed and must not be modified without protocol revision.
 */

export interface TrustSnapshot {
  generatedAtISO: string;
  window: 'point-in-time';

  operationalState: {
    status: 'RUNNING' | 'DEGRADED' | 'NOT_RUNNING';
    lastSuccessfulRunAtISO: string | null;
    consecutiveDaysOperational: number | null;
  };

  monitoringContinuity: {
    schedulerActive: boolean;
    lastRunAtISO: string | null;
    dataCompleteness: 'COMPLETE' | 'PARTIAL' | 'EMPTY';
  };

  configurationRiskSummary: {
    riskBand: 'LOW' | 'MEDIUM' | 'HIGH';
    metricsIncluded: string[];
    evaluatedAtISO: string | null;
  };

  changeSummary: {
    window: 'last-30d';
    eventCount: number;
    categoriesPresent: string[];
    lastChangeAtISO: string | null;
  };

  appBehaviorGuarantees: {
    readOnly: true;
    noJiraWrites: true;
    noConfigChanges: true;
    noEnforcement: true;
  };

  versioning: {
    appVersion: string;
    environment: 'production' | 'staging' | 'development';
    deployedAtISO: string | null;
  };

  completeness: 'COMPLETE' | 'PARTIAL' | 'EMPTY';
  issues: { source: string; reason: string; errorCode: string }[];
}

export interface SnapshotRecord {
  snapshotId: string;
  generatedAtISO: string;
  jsonSha256: string;
  jsonCanonicalText: string;
  appVersion: string;
  environment: 'production' | 'staging' | 'development';
}
