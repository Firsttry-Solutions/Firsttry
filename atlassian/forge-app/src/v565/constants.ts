import * as crypto from "crypto";
import { makeGlobalStorageKey } from "../shared/storageKey";

export const V565_SCHEMA_VERSION = "5.6.5";

export const MAX_REASON_CHARS = 220;
export const HMAC_BYTES = 32;

// AUDIT: Phase05 remediation - Global keys for tenant secrets (no tenant data, just metadata)
// Tenant secret - These keys store tenant secret metadata and references, not the secrets themselves
export const TENANT_SECRET_ID_KEY = makeGlobalStorageKey("ft_v565_tenantSecretId");
export const TENANT_SECRET_PREFIX = "ft:v565:tenantSecret:"; // Used as prefix only
export const TENANT_SECRET_META_KEY = makeGlobalStorageKey("ft_v565_tenantSecretMeta");

// AUDIT: Phase05 remediation - Global keys for schedule control (affects all tenants, no tenant-specific data)
// Scheduling - These keys control global scheduled job behavior (weekly trigger scheduling)
export const SCHEDULE_ENABLED_KEY = makeGlobalStorageKey("ft_v565_schedule_enabled");
export const SCHEDULE_STATUS_KEY = makeGlobalStorageKey("ft_v565_schedule_lastStatus");
export const SCHEDULE_LOCK_PREFIX = "ft:v565:schedule:lock:"; // + YYYY-WW (lock is global per week)
export const DEPLOY_OBSERVED_AT_KEY = makeGlobalStorageKey("ft_v565_deploy_observedAtUtc");

// LOCK TTL (8 days) — plus stale lock deletion if lock object is missing expiry
export const SCHEDULE_LOCK_TTL_MS = 8 * 24 * 60 * 60 * 1000;

// AUDIT: Phase05 remediation - Job status keys use prefix pattern, will be fixed with helper function
// Job status keys (EXPLICIT)
// AUDIT-ALLOWLIST FT-ALW-05-044
export const JOB_STATUS_PREFIX = "ft:v565:job:status:";                // + jobId
// AUDIT-ALLOWLIST FT-ALW-05-045
export const JOB_FAILURE_EXPORT_PREFIX = "ft:v565:job:failureExport:"; // + jobId
// Job meta key (EXPLICIT) — stored separately so status updates never overwrite meta
// AUDIT-ALLOWLIST FT-ALW-05-046
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
