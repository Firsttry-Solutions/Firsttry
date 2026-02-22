import * as crypto from "crypto";

export const V565_SCHEMA_VERSION = "5.6.5";

export const MAX_REASON_CHARS = 220;
export const HMAC_BYTES = 32;

// Tenant secret
export const TENANT_SECRET_ID_KEY = "ft:v565:tenantSecretId";
export const TENANT_SECRET_PREFIX = "ft:v565:tenantSecret:";
export const TENANT_SECRET_META_KEY = "ft:v565:tenantSecretMeta";

// Scheduling
export const SCHEDULE_ENABLED_KEY = "ft:v565:schedule:enabled";
export const SCHEDULE_STATUS_KEY = "ft:v565:schedule:lastStatus";
export const SCHEDULE_LOCK_PREFIX = "ft:v565:schedule:lock:"; // + YYYY-WW
export const DEPLOY_OBSERVED_AT_KEY = "ft:v565:deploy:observedAtUtc";

// LOCK TTL (8 days) — plus stale lock deletion if lock object is missing expiry
export const SCHEDULE_LOCK_TTL_MS = 8 * 24 * 60 * 60 * 1000;

// Job status keys (EXPLICIT)
export const JOB_STATUS_PREFIX = "ft:v565:job:status:";                // + jobId
export const JOB_FAILURE_EXPORT_PREFIX = "ft:v565:job:failureExport:"; // + jobId
// Job meta key (EXPLICIT) — stored separately so status updates never overwrite meta
export const JOB_META_PREFIX = "ft:v565:job:meta:";                    // + jobId
export type JobStatus = "NEW" | "RUNNING" | "FAILED" | "DONE";

export const ORPHAN_MAX_DEPTH = 3;
export const ORPHAN_NODE_CAP = 200;

export function nowUtcIso(): string { return new Date().toISOString(); }
export function nowEpochMs(): number { return Date.now(); }
export function capReason(s: string): string { return s.length > MAX_REASON_CHARS ? s.slice(0, MAX_REASON_CHARS) : s; }
export function shortFingerprint16(inputB64: string): string {
  return crypto.createHash("sha256").update(inputB64, "utf8").digest("hex").slice(0, 16);
}
