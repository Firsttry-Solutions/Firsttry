export interface LatencySummary {
  count: number;
  p50ms: number | null;
  p95ms: number | null;
  maxMs: number | null;
}

export interface RateLimitSignal {
  available: boolean;
  remaining: number | null;
  limit: number | null;
  resetEpochSeconds: number | null;
  note: string;
}

export interface PerfSignalsSnapshot {
  evaluatedAtISO: string;

  scheduler: {
    lastRunAtISO: string | null;
    lastSuccessAtISO: string | null;
    lastDurationMs: number | null;
    successCount7d: null;
    failureCount7d: null;
    consecutiveSuccessDays: number | null;
    lastFailureReason: string | null;
  };

  jiraApi: {
    window: 'last-24h';
    requestCount: number;
    errorCount: number;
    latency: LatencySummary;
    rateLimit: RateLimitSignal;
  };

  mode: 'scheduled-read-only';
  boundaries: {
    noJiraWrites: true;
    noConfigChanges: true;
    noEnforcement: true;
  };
  completeness: 'COMPLETE' | 'PARTIAL' | 'EMPTY';
  issues: { component: string; reason: string; errorCode: string }[];
}
