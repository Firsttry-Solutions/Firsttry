export type RiskBand = 'LOW' | 'MEDIUM' | 'HIGH';

export interface ConfigMetrics {
  customFieldCount: number | null;
  workflowCount: number | null;
  workflowSchemeCount: number | null;
  maxWorkflowsPerScheme: number | null;
  screenCount: number | null;
  permissionSchemeCount: number | null;
  maxProjectsPerPermissionScheme: number | null;
}

export interface MetricIssue {
  metric: keyof ConfigMetrics;
  reason: string;          // human-readable, no jargon
  errorCode: string;       // stable code like "JIRA_403", "JIRA_404", "JIRA_TIMEOUT", "JIRA_UNKNOWN"
}

export interface ConfigRiskSnapshot {
  metrics: ConfigMetrics;
  riskBand: RiskBand;
  evaluatedAtISO: string;          // ISO string
  completeness: 'COMPLETE' | 'PARTIAL' | 'EMPTY';
  issues: MetricIssue[];           // empty if COMPLETE
  mode: 'scheduled-read-only';     // constant literal value
  boundaries: {
    noJiraWrites: true;
    noConfigChanges: true;
    noEnforcement: true;
  };
}
