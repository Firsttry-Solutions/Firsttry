/**
 * EventV1 Validator - Strict Schema Validation
 * PHASE 1: Event ingestion validation with forbidden field detection
 *
 * Required fields (all must be present):
 * - schema_version: "event.v1"
 * - event_id: UUID v4
 * - timestamp: ISO 8601
 * - org_key: non-empty string
 * - repo_key: non-empty string
 * - profile: one of ["fast", "strict", "ci"]
 * - gates: array of non-empty strings
 * - duration_ms: integer >= 0
 * - status: one of ["success", "fail"]
 * - cache_hit: boolean
 * - retry_count: integer >= 0
 *
 * Forbidden fields (HARD BAN - reject if present):
 * - log, stdout, stderr, payload, secrets, token
 * - Any field starting with __
 * - Any unknown field (strict allow-list only)
 */

// UUID v4 regex pattern
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ISO 8601 regex pattern (basic)
const ISO_8601_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/;

// Allowed profile values
const ALLOWED_PROFILES = new Set(['fast', 'strict', 'ci']);

// Allowed status values
const ALLOWED_STATUSES = new Set(['success', 'fail']);

// Forbidden fields (hard ban)
const FORBIDDEN_FIELDS = new Set([
  'log', 'stdout', 'stderr', 'payload', 'secrets', 'token',
  'synthetic_flag', 'mock_data', 'estimation_confidence', 'forecast_value'
]);

// Allowed fields (strict allow-list)
const ALLOWED_FIELDS = new Set([
  'schema_version', 'event_id', 'timestamp', 'org_key', 'repo_key',
  'profile', 'gates', 'duration_ms', 'status', 'cache_hit', 'retry_count'
]);

/**
 * Validation error structure
 */
interface ValidationError {
  code: string;
  message: string;
  fields?: Record<string, string>;
}

/**
 * Validate EventV1 schema
 * @returns {ValidationError | null} Null if valid, ValidationError if invalid
 */
export function validateEventV1(input: unknown): ValidationError | null {
  // Check if input is an object
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return {
      code: 'INVALID_TYPE',
      message: 'Event must be a JSON object',
    };
  }

  const event = input as Record<string, unknown>;
  const fieldErrors: Record<string, string> = {};

  // Check for unknown fields (strict allow-list)
  for (const key of Object.keys(event)) {
    if (!ALLOWED_FIELDS.has(key)) {
      fieldErrors[key] = 'Unknown field (not in allow-list)';
    }
  }

  // Check for forbidden fields
  for (const forbiddenField of FORBIDDEN_FIELDS) {
    if (forbiddenField in event) {
      fieldErrors[forbiddenField] = `Forbidden field (hard ban): ${forbiddenField}`;
    }
  }

  // Check for fields starting with __
  for (const key of Object.keys(event)) {
    if (key.startsWith('__')) {
      fieldErrors[key] = 'Reserved field name (starts with __)';
    }
  }

  // If any unknown/forbidden/reserved fields found, reject
  if (Object.keys(fieldErrors).length > 0) {
    return {
      code: 'INVALID_FIELDS',
      message: 'Event contains unknown, forbidden, or reserved fields',
      fields: fieldErrors,
    };
  }

  // Validate required fields

  // schema_version
  if (event.schema_version !== 'event.v1') {
    fieldErrors.schema_version = event.schema_version
      ? `Invalid schema_version: ${event.schema_version} (expected "event.v1")`
      : 'Missing required field: schema_version';
  }

  // event_id (UUID v4)
  if (typeof event.event_id !== 'string' || !UUID_V4_PATTERN.test(event.event_id)) {
    fieldErrors.event_id = event.event_id
      ? `Invalid event_id: must be UUID v4`
      : 'Missing required field: event_id';
  }

  // timestamp (ISO 8601)
  if (typeof event.timestamp !== 'string' || !ISO_8601_PATTERN.test(event.timestamp)) {
    fieldErrors.timestamp = event.timestamp
      ? `Invalid timestamp: must be ISO 8601`
      : 'Missing required field: timestamp';
  }

  // org_key (non-empty string)
  if (typeof event.org_key !== 'string' || event.org_key.trim() === '') {
    fieldErrors.org_key = event.org_key
      ? `Invalid org_key: must be non-empty string`
      : 'Missing required field: org_key';
  }

  // repo_key (non-empty string)
  if (typeof event.repo_key !== 'string' || event.repo_key.trim() === '') {
    fieldErrors.repo_key = event.repo_key
      ? `Invalid repo_key: must be non-empty string`
      : 'Missing required field: repo_key';
  }

  // profile (allowed enum)
  if (!ALLOWED_PROFILES.has(event.profile as string)) {
    fieldErrors.profile = event.profile
      ? `Invalid profile: ${event.profile} (allowed: fast, strict, ci)`
      : 'Missing required field: profile';
  }

  // gates (array of non-empty strings)
  if (!Array.isArray(event.gates)) {
    fieldErrors.gates = event.gates
      ? `Invalid gates: must be array of strings`
      : 'Missing required field: gates';
  } else {
    const invalidGates = (event.gates as unknown[]).filter(
      (g) => typeof g !== 'string' || g.trim() === ''
    );
    if (invalidGates.length > 0) {
      fieldErrors.gates = 'All gates must be non-empty strings';
    }
  }

  // duration_ms (integer >= 0)
  if (typeof event.duration_ms !== 'number' || event.duration_ms < 0 || !Number.isInteger(event.duration_ms)) {
    fieldErrors.duration_ms = event.duration_ms !== undefined
      ? `Invalid duration_ms: must be integer >= 0`
      : 'Missing required field: duration_ms';
  }

  // status (allowed enum)
  if (!ALLOWED_STATUSES.has(event.status as string)) {
    fieldErrors.status = event.status
      ? `Invalid status: ${event.status} (allowed: success, fail)`
      : 'Missing required field: status';
  }

  // cache_hit (boolean)
  if (typeof event.cache_hit !== 'boolean') {
    fieldErrors.cache_hit = event.cache_hit !== undefined
      ? `Invalid cache_hit: must be boolean`
      : 'Missing required field: cache_hit';
  }

  // retry_count (integer >= 0)
  if (typeof event.retry_count !== 'number' || event.retry_count < 0 || !Number.isInteger(event.retry_count)) {
    fieldErrors.retry_count = event.retry_count !== undefined
      ? `Invalid retry_count: must be integer >= 0`
      : 'Missing required field: retry_count';
  }

  // If validation errors exist, return error
  if (Object.keys(fieldErrors).length > 0) {
    return {
      code: 'VALIDATION_FAILED',
      message: 'Event validation failed',
      fields: fieldErrors,
    };
  }

  // All validations passed
  return null;
}

/**
 * Redact sensitive information from logs
 */
export function redactSecret(secret: string, prefixChars: number = 4): string {
  if (secret.length <= prefixChars) return '****';
  return secret.substring(0, prefixChars) + '****';
}

/**
 * Extract date from ISO 8601 timestamp
 */
export function extractDateFromTimestamp(timestamp: string): string {
  // Format: YYYY-MM-DD from ISO 8601
  return timestamp.substring(0, 10);
}
