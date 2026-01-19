export enum FtReasonCode {
  NO_LEDGER = "NO_LEDGER",
  STORAGE_UNVERIFIED = "STORAGE_UNVERIFIED",
  SCHEDULER_NEVER_RAN = "SCHEDULER_NEVER_RAN",
  LAST_RUN_FAILED = "LAST_RUN_FAILED",
  NO_SNAPSHOT_YET = "NO_SNAPSHOT_YET",
  OK = "OK",
}

export enum FtErrorCode {
  STORAGE_READ_FAILED = "STORAGE_READ_FAILED",
  STORAGE_WRITE_FAILED = "STORAGE_WRITE_FAILED",
  STORAGE_RATE_LIMIT = "STORAGE_RATE_LIMIT",
  LOCK_BUSY = "LOCK_BUSY",
  LOCK_ACQUIRE_FAILED = "LOCK_ACQUIRE_FAILED",
  SCHEDULER_STEP_FAILED = "SCHEDULER_STEP_FAILED",
  SNAPSHOT_WRITE_FAILED = "SNAPSHOT_WRITE_FAILED",
  CONTRACT_VIOLATION = "CONTRACT_VIOLATION",
  UNKNOWN_INTERNAL = "UNKNOWN_INTERNAL",
}

export function normalizeErrorCode(e: unknown): FtErrorCode {
  const msg = (e instanceof Error ? e.message : String(e ?? "")).toLowerCase();
  if (msg.includes("rate") || msg.includes("429") || msg.includes("rate_limit")) return FtErrorCode.STORAGE_RATE_LIMIT;
  return FtErrorCode.UNKNOWN_INTERNAL;
}
