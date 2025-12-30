/**
 * PHASE-5 SCHEDULER STATE MANAGEMENT
 * 
 * Manages per-tenant scheduler state in Forge Storage:
 * - last_run_at: ISO 8601 timestamp of last scheduler invocation
 * - auto_12h_generated_at: ISO 8601 timestamp when AUTO_12H report generated (null if not yet)
 * - auto_24h_generated_at: ISO 8601 timestamp when AUTO_24H report generated (null if not yet)
 * - last_error: Structured error info from last failure (null if no error)
 * - last_backoff_until: ISO 8601 timestamp until which we should backoff (null if no backoff)
 * 
 * Storage keys:
 * - phase5:scheduler:state:{cloudId} → JSON blob
 * - phase5:scheduler:{cloudId}:AUTO_12H:DONE → completion marker (write-once)
 * - phase5:scheduler:{cloudId}:AUTO_24H:DONE → completion marker (write-once)
 * - phase5:scheduler:{cloudId}:AUTO_12H:ATTEMPT → timestamp of last attempt
 * - phase5:scheduler:{cloudId}:AUTO_24H:ATTEMPT → timestamp of last attempt
 */

import api from '@forge/api';

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
 */
export async function loadSchedulerState(cloudId: string): Promise<SchedulerState> {
  try {
    const stateKey = `phase5:scheduler:state:${cloudId}`;
    const state = await api.asApp().requestStorage(async (storage) => {
      return await storage.get(stateKey);
    });

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
 */
export async function saveSchedulerState(cloudId: string, state: SchedulerState): Promise<void> {
  try {
    const stateKey = `phase5:scheduler:state:${cloudId}`;
    await api.asApp().requestStorage(async (storage) => {
      // TTL: 90 days (in seconds)
      await storage.set(stateKey, state, { ttl: 7776000 });
    });
  } catch (error) {
    console.error(`[SchedulerState] Error saving state for ${cloudId}:`, error);
    throw error;
  }
}

/**
 * Check if a trigger has already completed successfully (write-once marker)
 * Returns true if DONE marker exists
 */
export async function hasCompletionMarker(
  cloudId: string,
  trigger: 'AUTO_12H' | 'AUTO_24H'
): Promise<boolean> {
  try {
    const doneKey = `phase5:scheduler:${cloudId}:${trigger}:DONE`;
    const marker = await api.asApp().requestStorage(async (storage) => {
      return await storage.get(doneKey);
    });
    return marker !== undefined;
  } catch (error) {
    console.error(`[SchedulerState] Error checking completion marker for ${trigger}:`, error);
    throw error;
  }
}

/**
 * Write completion marker (write-once, idempotent)
 * Only written after successful generation
 */
export async function writeCompletionMarker(
  cloudId: string,
  trigger: 'AUTO_12H' | 'AUTO_24H'
): Promise<void> {
  try {
    const doneKey = `phase5:scheduler:${cloudId}:${trigger}:DONE`;
    await api.asApp().requestStorage(async (storage) => {
      // Only write if not already present
      const existing = await storage.get(doneKey);
      if (!existing) {
        await storage.set(doneKey, { completed_at: new Date().toISOString() }, { ttl: 7776000 });
      }
    });
  } catch (error) {
    console.error(`[SchedulerState] Error writing completion marker for ${trigger}:`, error);
    throw error;
  }
}

/**
 * Get timestamp of last attempt for a trigger
 * Used for backoff calculation
 */
export async function getLastAttemptTime(
  cloudId: string,
  trigger: 'AUTO_12H' | 'AUTO_24H'
): Promise<string | null> {
  try {
    const attemptKey = `phase5:scheduler:${cloudId}:${trigger}:ATTEMPT`;
    const timestamp = await api.asApp().requestStorage(async (storage) => {
      return await storage.get(attemptKey);
    });
    return timestamp as string | null;
  } catch (error) {
    console.error(`[SchedulerState] Error getting last attempt time for ${trigger}:`, error);
    throw error;
  }
}

/**
 * Record attempt timestamp (every time we try to generate, including retries)
 */
export async function recordAttemptTime(
  cloudId: string,
  trigger: 'AUTO_12H' | 'AUTO_24H'
): Promise<void> {
  try {
    const attemptKey = `phase5:scheduler:${cloudId}:${trigger}:ATTEMPT`;
    await api.asApp().requestStorage(async (storage) => {
      await storage.set(attemptKey, new Date().toISOString(), { ttl: 7776000 });
    });
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
    const installationEvidence = await api.asApp().requestStorage(async (storage) => {
      return await storage.get(`phase4:evidence:installation:${cloudId}`);
    });

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
