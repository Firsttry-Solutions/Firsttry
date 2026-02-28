/**
 * PHASE 3 SOR v1.1 - Storage Key Patterns
 * Canonical storage keys for Forge App Storage
 * All keys follow deterministic, sharded patterns
 */

import { makeStorageKey } from '../shared/storageKey';

// ============================================================================
// KEY PREFIXES (LOCKED)
// ============================================================================

export const KEY_PREFIX_REVIEW = "ar.v1:state";
export const KEY_PREFIX_LEDGER = "ar.v1:ledger";
export const KEY_PREFIX_INDEX = "ar.v1:idx";
export const KEY_PREFIX_AUDIT = "ar.v1:audit";
export const KEY_PREFIX_LOCK = "ar.v1:lock";

// ============================================================================
// SHARD CONSTANTS
// ============================================================================

export const MAX_LEDGER_ITEMS_PER_SHARD = 400;
export const MAX_AUDIT_ENTRIES_PER_SHARD = 500;
export const LOCK_TTL_SECONDS = 330;
export const WRITE_BUDGET_SECONDS = 10;

// ============================================================================
// STORAGE KEY BUILDERS (DETERMINISTIC)
// ============================================================================

/**
 * Review state storage key
 * Pattern: ar.v1:state:<siteId>:<reviewId>
 * AUDIT: Phase05 remediation - keys must be deterministic + tenant-bound
 */
export function buildReviewKey(siteId: string, reviewId: string): string {
  if (!siteId || !reviewId) throw new Error("siteId and reviewId required");
  return makeStorageKey(siteId, "ar_v1_state", reviewId);
}

/**
 * Review ledger storage key (references review state + export hashes)
 * Pattern: ar.v1:ledger:<siteId>:<reviewId>
 * AUDIT: Phase05 remediation - keys must be deterministic + tenant-bound
 */
export function buildLedgerKey(siteId: string, reviewId: string): string {
  if (!siteId || !reviewId) throw new Error("siteId and reviewId required");
  return makeStorageKey(siteId, "ar_v1_ledger", reviewId);
}

/**
 * Index key for shard lookup (points to ledger entries)
 * Pattern: ar.v1:idx:<siteId>:<year>:<shard>
 * Max 400 reviewIds per shard
 * AUDIT: Phase05 remediation - keys must be deterministic + tenant-bound
 */
export function buildIndexKey(siteId: string, year: number, shard: number): string {
  if (!siteId || !year || shard === undefined) {
    throw new Error("siteId, year, and shard required");
  }
  return makeStorageKey(siteId, "ar_v1_idx", String(year), String(shard));
}

/**
 * Audit log storage key (append-only events)
 * Pattern: ar.v1:audit:<siteId>:<reviewId>:<shard>
 * Max 500 entries per shard
 * AUDIT: Phase05 remediation - keys must be deterministic + tenant-bound
 */
export function buildAuditLogKey(
  siteId: string,
  reviewId: string,
  shard: number
): string {
  if (!siteId || !reviewId || shard === undefined) {
    throw new Error("siteId, reviewId, and shard required");
  }
  return makeStorageKey(siteId, "ar_v1_audit", reviewId, String(shard));
}

/**
 * Lock key for quarterly review operations
 * Pattern: ar.v1:lock:<siteId>:<quarter>
 * TTL: 330 seconds
 * AUDIT: Phase05 remediation - keys must be deterministic + tenant-bound
 */
export function buildLockKey(siteId: string, quarter: string): string {
  if (!siteId || !quarter) throw new Error("siteId and quarter required");
  return makeStorageKey(siteId, "ar_v1_lock", quarter);
}

// ============================================================================
// SHARD CALCULATION (DETERMINISTIC)
// ============================================================================

/**
 * Calculate which shard a reviewId should be stored in
 * Deterministic: reviewId hash mod shard count
 */
export function calculateShard(
  reviewId: string,
  shardSize: number = MAX_LEDGER_ITEMS_PER_SHARD
): number {
  if (!reviewId) throw new Error("reviewId required");
  
  // Hash the reviewId deterministically
  let hash = 0;
  for (let i = 0; i < reviewId.length; i++) {
    const char = reviewId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  // Map to shard (results in shard 0 to N)
  return Math.abs(hash) % Math.ceil(MAX_LEDGER_ITEMS_PER_SHARD / shardSize);
}

/**
 * Calculate audit log shard for a given eventCount
 * New shard every MAX_AUDIT_ENTRIES_PER_SHARD entries
 */
export function calculateAuditShard(existingEventCount: number): number {
  return Math.floor(existingEventCount / MAX_AUDIT_ENTRIES_PER_SHARD);
}

/**
 * Check if audit shard is at capacity
 */
export function isAuditShardFull(eventCountInShard: number): boolean {
  return eventCountInShard >= MAX_AUDIT_ENTRIES_PER_SHARD;
}

/**
 * Check if ledger index shard is at capacity
 */
export function isLedgerShardFull(reviewCountInShard: number): boolean {
  return reviewCountInShard >= MAX_LEDGER_ITEMS_PER_SHARD;
}

// ============================================================================
// QUARTER PARSING (DETERMINISTIC)
// ============================================================================

/**
 * Parse quarter string to year and quarter number
 * Format: YYYY-Q#
 */
export function parseQuarter(quarter: string): { year: number; qNum: number } {
  const match = quarter.match(/^(\d{4})-Q([1-4])$/);
  if (!match) throw new Error(`Invalid quarter format: ${quarter}`);
  return { year: parseInt(match[1]), qNum: parseInt(match[2]) };
}

/**
 * Get current quarter string (YYYY-Q#)
 */
export function getCurrentQuarter(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-11
  const q = Math.floor(month / 3) + 1; // Q1-Q4
  return `${year}-Q${q}`;
}

/**
 * Get quarter from timestamp (ISO 8601 UTC string or Date)
 */
export function getQuarterFromTimestamp(timestamp: string | Date): string {
  const date = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-11
  const q = Math.floor(month / 3) + 1; // Q1-Q4
  return `${year}-Q${q}`;
}

// ============================================================================
// LOCK LIFECYCLE (TRANSIENT)
// ============================================================================

/**
 * Calculate lock expiration time (server time + TTL)
 */
export function calculateLockExpiry(nowUtc: string): string {
  const now = new Date(nowUtc);
  const expiry = new Date(now.getTime() + LOCK_TTL_SECONDS * 1000);
  return expiry.toISOString();
}

/**
 * Check if lock is still valid (not expired)
 */
export function isLockValid(expiresUtc: string, nowUtc: string): boolean {
  const expiry = new Date(expiresUtc);
  const now = new Date(nowUtc);
  return now < expiry;
}

// ============================================================================
// REVIEW KEY COMPOSITION (DETERMINISTIC)
// ============================================================================

/**
 * Build canonical review key for identity computation
 * Pattern: ${siteId}:${quarter}:ar.v1:phase3.v1
 * AUDIT: Phase05 remediation - keys must be deterministic + tenant-bound
 */
export function buildReviewKeyForIdentity(siteId: string, quarter: string): string {
  if (!siteId || !quarter) throw new Error("siteId and quarter required");
  return makeStorageKey(siteId, quarter, "ar_v1_phase3_v1");
}

// ============================================================================
// VALIDATION (STRICT)
// ============================================================================

/**
 * Validate storage key format (fail-closed)
 */
export function validateStorageKey(key: string): void {
  if (!key || typeof key !== "string") {
    throw new Error("Storage key must be non-empty string");
  }
  if (key.length > 1024) {
    throw new Error("Storage key exceeds maximum length (1024)");
  }
  if (!/^[a-z0-9:._-]+$/.test(key)) {
    throw new Error("Storage key contains invalid characters");
  }
}

/**
 * Validate quarter format
 */
export function validateQuarter(quarter: string): void {
  if (!/^(\d{4})-Q[1-4]$/.test(quarter)) {
    throw new Error(`Invalid quarter format: ${quarter} (expected YYYY-Q#)`);
  }
}

/**
 * Validate siteId format (non-empty alphanumeric)
 */
export function validateSiteId(siteId: string): void {
  if (!siteId || !/^[a-z0-9-]+$/i.test(siteId)) {
    throw new Error("Invalid siteId format");
  }
}
