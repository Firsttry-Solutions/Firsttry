/**
 * PHASE-5 SCHEDULER STATE MANAGEMENT (WITH LEGACY COMPATIBILITY)
 * 
 * Manages per-tenant scheduler state in Forge Storage with:
 * - Collision-safe tenant encoding (base64url)
 * - Automatic migration from legacy key formats
 * - Backward compatibility with ALL previous releases
 * 
 * Storage keys (NEW canonical format):
 * - phase5:scheduler:state:tenant:{base64url(tenantId)} → JSON blob
 * - phase5:scheduler:tenant:{base64url(tenantId)}:{trigger}:DONE → completion marker (write-once)
 * - phase5:scheduler:tenant:{base64url(tenantId)}:{trigger}:ATTEMPT → timestamp of last attempt
 * 
 * Legacy formats (read-only, with auto-migration to NEW format):
 * - V1 (original): phase5:scheduler:state:{rawTenantId} (may contain invalid characters)
 * - V2 (intermediate patch): scheduler:state:{safeKey(tenantId)} (lossy, no collision-safety)
 */

import api from '@forge/api';
import { storage } from '@forge/api';

/**
 * Forge storage key pattern (required by Forge API)
 */
const KEY_PATTERN = /^(?!\s+$)[a-zA-Z0-9:._\s-#]+$/;

/**
 * Assert that a key matches the Forge storage pattern
 * Throws if key is invalid (development safety check)
 */
function assertKey(key: string): void {
  if (!KEY_PATTERN.test(key)) {
    throw new Error(`INVALID_STORAGE_KEY: ${key}`);
  }
}

/**
 * Encode tenant ID using base64url encoding for collision-safety
 * Output only contains [A-Za-z0-9_-] which are Forge-allowed characters
 * 
 * @param raw Raw tenant identifier (e.g., cloudId)
 * @returns Encoded token like "tenant:XXXXXXX_XXXXXXX"
 */
function tenantToken(raw: string): string {
  const s = (raw ?? '').trim();
  if (!s) {
    return 'tenant:unknown';
  }

  // base64url encoding
  const b64 = Buffer.from(s, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')    // url-safe: + → -
    .replace(/\//g, '_')    // url-safe: / → _
    .replace(/=+$/g, '');   // strip padding

  return `tenant:${b64}`;
}

/**
 * LEGACY safeKey from intermediate patch (v2)
 * Kept for READING old keys only; DO NOT use for new writes
 * This is the exact implementation from the previous patch
 */
function legacySafeKey(raw: string): string {
  let result = raw.trim();

  if (result.length === 0) {
    return 'unknown';
  }

  result = result.replace(/[^a-zA-Z0-9:._\s\-#]/g, '_');
  result = result.replace(/_+/g, '_');

  if (result.length === 0) {
    return 'unknown';
  }

  return result;
}

/**
 * NEW canonical key builders (preferred format)
 */
function keyState(tenantId: string): string {
  const key = `phase5:scheduler:state:${tenantToken(tenantId)}`;
  assertKey(key);
  return key;
}

function keyDone(tenantId: string, triggerKey: string): string {
  const key = `phase5:scheduler:${tenantToken(tenantId)}:${triggerKey}:DONE`;
  assertKey(key);
  return key;
}

function keyAttempt(tenantId: string, triggerKey: string): string {
  const key = `phase5:scheduler:${tenantToken(tenantId)}:${triggerKey}:ATTEMPT`;
  assertKey(key);
  return key;
}

/**
 * LEGACY V1 key builders (original format, pre-hotfix)
 * Used ONLY for reading old keys; may contain invalid characters
 */
function legacyKeyStateV1(tenantId: string): string {
  return `phase5:scheduler:state:${tenantId}`;
}

function legacyKeyDoneV1(tenantId: string, triggerKey: string): string {
  return `phase5:scheduler:${tenantId}:${triggerKey}:DONE`;
}

function legacyKeyAttemptV1(tenantId: string, triggerKey: string): string {
  return `phase5:scheduler:${tenantId}:${triggerKey}:ATTEMPT`;
}

/**
 * LEGACY V2 key builders (intermediate patch format)
 * Used ONLY for reading old keys created by the safeKey patch
 */
function legacyKeyStateV2(tenantId: string): string {
  return `scheduler:state:${legacySafeKey(tenantId)}`;
}

function legacyKeyDoneV2(tenantId: string, triggerKey: string): string {
  return `scheduler:${legacySafeKey(tenantId)}:${triggerKey}:DONE`;
}

function legacyKeyAttemptV2(tenantId: string, triggerKey: string): string {
  return `scheduler:${legacySafeKey(tenantId)}:${triggerKey}:ATTEMPT`;
}

/**
 * Read with automatic migration pattern
 * Tries NEW key first, then falls back to legacy keys
 * If found in legacy key, migrates value to NEW key
 * 
 * @param tenantId Tenant identifier
 * @param keyBuilder Function that builds the NEW key
 * @param legacyKeyBuilders Array of legacy key builder functions
 * @param migrationKind Type label for logging ("state", "done", or "attempt")
 * @returns The value, or undefined if not found anywhere
 */
async function readWithMigrate<T>(
  tenantId: string,
  keyBuilder: (tid: string) => string,
  legacyKeyBuilders: Array<(tid: string) => string>,
  migrationKind: string
): Promise<T | undefined> {
  const newKey = keyBuilder(tenantId);

  // Try NEW key first
  try {
    const value = await storage.get(newKey);
    if (value !== undefined) {
      return value as T;
    }
  } catch (e) {
    // Fall through to legacy reads
  }

  // Try legacy keys in order
  for (let i = 0; i < legacyKeyBuilders.length; i++) {
    const legacyKey = legacyKeyBuilders[i](tenantId);
    try {
      const value = await storage.get(legacyKey);
      if (value !== undefined) {
        // Found in legacy key; migrate to NEW key
        try {
          await storage.set(newKey, value, { ttl: 7776000 });
          console.warn('[SchedulerState] migrated legacy key -> new key', {
            kind: migrationKind,
            from: `V${i + 1}`,
            keyLen: newKey.length,
          });
        } catch (migrationError) {
          console.error('[SchedulerState] failed to migrate legacy key', {
            kind: migrationKind,
            from: `V${i + 1}`,
            error: migrationError,
          });
          // Don't re-throw; return the legacy value anyway
        }
        return value as T;
      }
    } catch (e) {
      // Ignore read errors on legacy keys; keep trying next
    }
  }

  return undefined;
}

/**
 * Read with automatic migration for trigger-based keys (DONE, ATTEMPT)
 */
async function readWithMigrateTrigger<T>(
  tenantId: string,
  triggerKey: string,
  keyBuilder: (tid: string, trig: string) => string,
  legacyKeyBuilders: Array<(tid: string, trig: string) => string>,
  migrationKind: string
): Promise<T | undefined> {
  const newKey = keyBuilder(tenantId, triggerKey);

  // Try NEW key first
  try {
    const value = await storage.get(newKey);
    if (value !== undefined) {
      return value as T;
    }
  } catch (e) {
    // Fall through to legacy reads
  }

  // Try legacy keys in order
  for (let i = 0; i < legacyKeyBuilders.length; i++) {
    const legacyKey = legacyKeyBuilders[i](tenantId, triggerKey);
    try {
      const value = await storage.get(legacyKey);
      if (value !== undefined) {
        // Found in legacy key; migrate to NEW key
        try {
          await storage.set(newKey, value, { ttl: 7776000 });
          console.warn('[SchedulerState] migrated legacy key -> new key', {
            kind: migrationKind,
            from: `V${i + 1}`,
            keyLen: newKey.length,
          });
        } catch (migrationError) {
          console.error('[SchedulerState] failed to migrate legacy key', {
            kind: migrationKind,
            from: `V${i + 1}`,
            error: migrationError,
          });
          // Don't re-throw; return the legacy value anyway
        }
        return value as T;
      }
    } catch (e) {
      // Ignore read errors on legacy keys; keep trying next
    }
  }

  return undefined;
}

export interface SchedulerState {
  last_run_at: string; // ISO 8601
  auto_12h_generated_at: string | null; // ISO 8601, null if not yet generated
  auto_24h_generated_at: string | null; // ISO 8601, null if not yet generated
  last_error: {
    timestamp: string; // ISO 8601
    message: string;
    trigger: 'AUTO_12H' | 'AUTO_24H';
    attempt_count: number; // How many times this trigger has been attempted
  } | null;
  last_backoff_until: string | null; // ISO 8601, null if no active backoff
  auto_12h_attempt_count: number; // Total attempts for AUTO_12H
  auto_24h_attempt_count: number; // Total attempts for AUTO_24H
}

/**
 * Load scheduler state for a tenant
 * If not found, returns default state
 * Automatically migrates from legacy keys if present
 */
export async function loadSchedulerState(cloudId: string): Promise<SchedulerState> {
  try {
    const state = await readWithMigrate(
      cloudId,
      keyState,
      [legacyKeyStateV2, legacyKeyStateV1],
      'state'
    );

    if (state && typeof state === 'object') {
      return state as SchedulerState;
    }

    // Return default state
    return {
      last_run_at: new Date().toISOString(),
      auto_12h_generated_at: null,
      auto_24h_generated_at: null,
      last_error: null,
      last_backoff_until: null,
      auto_12h_attempt_count: 0,
      auto_24h_attempt_count: 0,
    };
  } catch (error) {
    console.error(`[SchedulerState] Error loading state for ${cloudId}:`, error);
    throw error;
  }
}

/**
 * Save scheduler state for a tenant
 * Writes ONLY to NEW canonical key
 */
export async function saveSchedulerState(cloudId: string, state: SchedulerState): Promise<void> {
  try {
    const stateKey = keyState(cloudId);
    // TTL: 90 days (in seconds)
    await storage.set(stateKey, state, { ttl: 7776000 });
  } catch (error) {
    console.error(`[SchedulerState] Error saving state for ${cloudId}:`, error);
    throw error;
  }
}

/**
 * Check if a trigger has already completed successfully (write-once marker)
 * Returns true if DONE marker exists
 * Automatically migrates from legacy keys if present
 */
export async function hasCompletionMarker(
  cloudId: string,
  trigger: 'AUTO_12H' | 'AUTO_24H'
): Promise<boolean> {
  try {
    const marker = await readWithMigrateTrigger(
      cloudId,
      trigger,
      keyDone,
      [legacyKeyDoneV2, legacyKeyDoneV1],
      'done'
    );
    return marker !== undefined;
  } catch (error) {
    console.error(`[SchedulerState] Error checking completion marker for ${trigger}:`, error);
    throw error;
  }
}

/**
 * Write completion marker (write-once, idempotent)
 * Only written after successful generation
 * Writes ONLY to NEW canonical key
 */
export async function writeCompletionMarker(
  cloudId: string,
  trigger: 'AUTO_12H' | 'AUTO_24H'
): Promise<void> {
  try {
    const doneKey = keyDone(cloudId, trigger);
    // Only write if not already present
    const existing = await storage.get(doneKey);
    if (!existing) {
      await storage.set(doneKey, { completed_at: new Date().toISOString() }, { ttl: 7776000 });
    }
  } catch (error) {
    console.error(`[SchedulerState] Error writing completion marker for ${trigger}:`, error);
    throw error;
  }
}

/**
 * Get timestamp of last attempt for a trigger
 * Used for backoff calculation
 * Automatically migrates from legacy keys if present
 */
export async function getLastAttemptTime(
  cloudId: string,
  trigger: 'AUTO_12H' | 'AUTO_24H'
): Promise<string | null> {
  try {
    const timestamp = await readWithMigrateTrigger(
      cloudId,
      trigger,
      keyAttempt,
      [legacyKeyAttemptV2, legacyKeyAttemptV1],
      'attempt'
    );
    return (timestamp as string | null) ?? null;
  } catch (error) {
    console.error(`[SchedulerState] Error getting last attempt time for ${trigger}:`, error);
    throw error;
  }
}

/**
 * Record attempt timestamp (every time we try to generate, including retries)
 * Writes ONLY to NEW canonical key
 */
export async function recordAttemptTime(
  cloudId: string,
  trigger: 'AUTO_12H' | 'AUTO_24H'
): Promise<void> {
  try {
    const attemptKey = keyAttempt(cloudId, trigger);
    await storage.set(attemptKey, new Date().toISOString(), { ttl: 7776000 });
  } catch (error) {
    console.error(`[SchedulerState] Error recording attempt time for ${trigger}:`, error);
    throw error;
  }
}

/**
 * Check if backoff period is still active
 * Returns true if we should wait before retrying
 */
export async function isBackoffActive(cloudId: string): Promise<boolean> {
  try {
    const state = await loadSchedulerState(cloudId);
    if (!state.last_backoff_until) {
      return false;
    }

    const backoffUntil = new Date(state.last_backoff_until).getTime();
    const now = new Date().getTime();

    return now < backoffUntil;
  } catch (error) {
    console.error(`[SchedulerState] Error checking backoff for ${cloudId}:`, error);
    throw error;
  }
}

/**
 * Calculate next backoff time based on attempt count (3-tier strategy)
 * - 1st attempt: wait 30 minutes
 * - 2nd attempt: wait 120 minutes (2 hours)
 * - 3rd+ attempts: wait 1440 minutes (24 hours)
 */
export function calculateBackoffUntil(attemptCount: number): Date {
  const now = new Date();
  let backoffMinutes = 30; // Default: 1st attempt

  if (attemptCount >= 3) {
    backoffMinutes = 1440; // 24 hours
  } else if (attemptCount >= 2) {
    backoffMinutes = 120; // 2 hours
  }

  return new Date(now.getTime() + backoffMinutes * 60 * 1000);
}

/**
 * Load installation timestamp from Phase-4 evidence storage.
 * 
 * FAIL CLOSED: If timestamp cannot be loaded from Phase-4, return null.
 * No fixtures, no fallbacks, no inferred timestamps.
 * 
 * @returns ISO 8601 timestamp, or null if not found in Phase-4 evidence
 */
export async function loadInstallationTimestamp(cloudId: string): Promise<string | null> {
  try {
    // Production: Read from Phase-4 append-only evidence storage
    // Path: `phase4:evidence:installation:${cloudId}`
    const installationEvidence = await storage.get(`phase4:evidence:installation:${cloudId}`);

    if (!installationEvidence || !installationEvidence.installed_at) {
      console.warn(
        `[SchedulerState] FAIL_CLOSED: Installation timestamp not found in Phase-4 evidence for ${cloudId}`
      );
      return null;
    }

    const timestamp = installationEvidence.installed_at as string;
    // Validate ISO 8601 format
    const parsed = new Date(timestamp);
    if (isNaN(parsed.getTime())) {
      console.error(
        `[SchedulerState] FAIL_CLOSED: Invalid timestamp format from Phase-4 evidence: ${timestamp}`
      );
      return null;
    }

    return timestamp;
  } catch (error) {
    console.error(
      `[SchedulerState] FAIL_CLOSED: Error loading installation timestamp from Phase-4 for ${cloudId}:`,
      error
    );
    return null;
  }
}
