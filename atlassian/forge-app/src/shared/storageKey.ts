/**
 * Central deterministic storage key builder
 * 
 * AUDIT REQUIREMENT (Phase 05):
 * - NO usage of process.env in key construction
 * - ALL segments must be validated and sanitized
 * - Keys must be deterministic across runs
 * - Tenant binding required for all keys
 */

import { failClosed } from './failClosed';

/**
 * Maximum length for individual key segments
 */
const MAX_SEGMENT_LENGTH = 80;

/**
 * Valid characters for storage key segments: alphanumeric, dot, underscore, hyphen
 */
const VALID_SEGMENT_REGEX = /^[A-Za-z0-9._-]+$/;

/**
 * Sanitize and validate a storage key segment
 * 
 * @param segment - The segment to sanitize
 * @param context - Context for error messages (e.g., "tenantKey", "namespace")
 * @returns The validated segment
 * @throws FailClosedError if segment is invalid
 */
export function sanitizeKeySegment(segment: string, context: string = 'segment'): string {
  if (typeof segment !== 'string') {
    throw failClosed(
      'FT_STORAGE_KEY_INVALID_TYPE',
      `Storage key ${context} must be a string, got ${typeof segment}`,
      { segment, context }
    );
  }

  const trimmed = segment.trim();

  if (trimmed.length === 0) {
    throw failClosed(
      'FT_STORAGE_KEY_EMPTY',
      `Storage key ${context} cannot be empty`,
      { segment, context }
    );
  }

  if (trimmed.length > MAX_SEGMENT_LENGTH) {
    throw failClosed(
      'FT_STORAGE_KEY_TOO_LONG',
      `Storage key ${context} exceeds maximum length of ${MAX_SEGMENT_LENGTH} characters (got ${trimmed.length})`,
      { segment: trimmed, context, length: trimmed.length }
    );
  }

  if (!VALID_SEGMENT_REGEX.test(trimmed)) {
    throw failClosed(
      'FT_STORAGE_KEY_INVALID_CHARS',
      `Storage key ${context} contains forbidden characters (only alphanumeric, dot, underscore, hyphen allowed)`,
      { segment: trimmed, context }
    );
  }

  return trimmed;
}

/**
 * Build a deterministic storage key with tenant binding
 * 
 * Pattern: `${tenantKey}:${namespace}:${segment1}:${segment2}:...`
 * 
 * Requirements:
 * - tenantKey: Required, identifies the tenant (from context.accountId or similar)
 * - namespace: Required, module-specific literal constant (e.g., "metrics", "evidence", "ledger")
 * - segments: Optional additional segments for hierarchical keys
 * 
 * NO process.env usage allowed.
 * ALL segments must be deterministic at call time.
 * 
 * @param tenantKey - Tenant identifier (e.g., accountId from Forge context)
 * @param namespace - Module namespace (must be a literal constant at call site)
 * @param segments - Additional key segments (all must be deterministic)
 * @returns Deterministic storage key
 * @throws FailClosedError if any segment is invalid
 * 
 * @example
 * ```ts
 * // Good: deterministic, tenant-bound, literal namespace
 * const key = makeStorageKey(accountId, "metrics", "heartbeat", "v1");
 * // Result: "acct123:metrics:heartbeat:v1"
 * 
 * // Bad: using process.env (will fail audit)
 * const key = makeStorageKey(accountId, process.env.ENV_VAR!, "data");
 * 
 * // Bad: dynamic namespace (defeats audit classification)
 * const key = makeStorageKey(accountId, someVariable, "data");
 * ```
 */
export function makeStorageKey(
  tenantKey: string,
  namespace: string,
  ...segments: string[]
): string {
  // Validate required fields
  const validatedTenant = sanitizeKeySegment(tenantKey, 'tenantKey');
  const validatedNamespace = sanitizeKeySegment(namespace, 'namespace');

  // Validate optional segments
  const validatedSegments = segments.map((seg, idx) =>
    sanitizeKeySegment(seg, `segment[${idx}]`)
  );

  // Build key with colon separator
  const parts = [validatedTenant, validatedNamespace, ...validatedSegments];
  return parts.join(':');
}

/**
 * Build a global (non-tenant) storage key
 * 
 * USE SPARINGLY: Most keys should be tenant-bound via makeStorageKey().
 * Only use for truly global configuration that applies across all tenants.
 * 
 * Pattern: `__global__:${namespace}:${segment1}:...`
 * 
 * @param namespace - Module namespace (must be a literal constant)
 * @param segments - Additional key segments
 * @returns Global storage key
 * @throws FailClosedError if any segment is invalid
 * 
 * @example
 * ```ts
 * // Global rate limit counter (shared across tenants)
 * const key = makeGlobalStorageKey("ratelimit", "api", "counter");
 * // Result: "__global__:ratelimit:api:counter"
 * ```
 */
export function makeGlobalStorageKey(
  namespace: string,
  ...segments: string[]
): string {
  return makeStorageKey('__global__', namespace, ...segments);
}
