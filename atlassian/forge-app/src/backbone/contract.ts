import { FtErrorCode, FtReasonCode } from "./errorCodes";

export type FtStorageState = "MISSING" | "PRESENT" | "ERROR";
export type FtStatus = "BOOTSTRAP" | "OK" | "DEGRADED" | "FAILED";

export interface FtLastError {
  code: FtErrorCode;
  step: string;
  message_short: string;
  request_id: string | null;
  at_utc: string;
}

export interface FtLedgerV1 {
  version: 1;
  install_id: string;
  installed_at_utc: string;

  build_sha_last_seen_ui: string | null;
  build_sha_last_seen_backend: string | null;

  storage_verified_at_utc: string | null;

  scheduler_last_attempt_at_utc: string | null;
  scheduler_last_success_at_utc: string | null;
  scheduler_consecutive_failures: number;
  scheduler_last_error: FtLastError | null;

  snapshot_count: number;
  snapshot_last_id: string | null;
  snapshot_last_at_utc: string | null;
  snapshot_last_build_sha: string | null;
  snapshot_last_hash: string | null;
}

export interface FtResolverResponseV1 {
  ok: boolean;
  resolver: string;
  step: string;
  now_utc: string;
  request_id: string | null;
  build_sha_backend: string | null;

  storage_state: FtStorageState;
  status: FtStatus;
  reason_code: FtReasonCode;
  mode?: string | null;

  ledger: FtLedgerV1;
}

export function assertNoUnknownStrings(obj: unknown): void {
  const bad = new Set(["UNKNOWN", "INITIALIZING", "NOT_AVAILABLE"]);
  const walk = (v: any): void => {
    if (v === null || v === undefined) return;
    if (typeof v === "string") {
      if (bad.has(v)) throw new Error(`${FtErrorCode.CONTRACT_VIOLATION}: forbidden string "${v}"`);
      return;
    }
    if (Array.isArray(v)) {
      for (const x of v) walk(x);
      return;
    }
    if (typeof v === "object") {
      for (const k of Object.keys(v)) walk(v[k]);
    }
  };
  walk(obj);
}
