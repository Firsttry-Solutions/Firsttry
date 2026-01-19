/**
 * Structured trace types for ft_getDashboardState_v1 and ft_probe_v1 resolvers
 * Provides deterministic error code propagation and end-to-end correlation
 */

export enum FtErrorCode {
  OK = "OK",
  TENANT_CONTEXT_MISSING = "TENANT_CONTEXT_MISSING",
  STORAGE_EMPTY = "STORAGE_EMPTY",
  STORAGE_READ_FAILED = "STORAGE_READ_FAILED",
  LEDGER_MISSING = "LEDGER_MISSING",
  ENSURE_FIRST_SNAPSHOT_FAILED = "ENSURE_FIRST_SNAPSHOT_FAILED",
  RESOLVER_THROW = "RESOLVER_THROW",
  SCHEMA_INVALID = "SCHEMA_INVALID",
}

export type FtTrace = {
  ok: boolean;
  resolver: string;
  stepId: string;
  errorCode: FtErrorCode;
  message?: string;
  uiReqId?: string;
  nonce?: string;
  
  forge: {
    environment?: string;
    installContext?: string;
    cloudId?: string;
    siteUrl?: string;
    moduleKey?: string;
    accountId?: string;
    contextKeys: string[];
    requestId?: string;  // only if exists in context; do not fake
    traceId?: string;    // only if exists; do not fake
  };
  
  storageProof: {
    ledgerKey: string;
    ledgerExists: boolean;
    lockKey: string;
    lockExists: boolean;
    sentinelKey: string;
    sentinelExists: boolean;
    snapshotCountKey: string;
    snapshotCountValue?: number | null;
  };
  
  build: {
    backendGitSha: string;
    backendBuildTime: string;
    uiBundleHash?: string;
    uiGitSha?: string;
  };
};
