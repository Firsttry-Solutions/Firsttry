/**
 * PHASE-5 AUTOMATIC TRIGGER SCHEDULER
 * 
 * Orchestrates automatic report generation for Phase-5 trust reports.
 * 
 * Triggers:
 * - AUTO_12H: Generates once when install_age >= 12h and < 24h
 * - AUTO_24H: Generates once when install_age >= 24h
 * 
 * Design:
 * - Identifies due trigger based on installation age
 * - Checks idempotency markers (DONE keys) to prevent duplicates
 * - Uses atomic locks (ATTEMPT vs DONE) to handle concurrency
 * - Implements exponential backoff on failures (30min, then 120min)
 * - Calls handleAutoTrigger() only if due (single code path, same as Phase-5 design)
 * - Never throws uncaught exceptions (Forge doesn't retry on throw)
 * 
 * Storage keys:
 * - phase5:scheduler:state:{cloudId} → Main state JSON blob
 * - phase5:scheduler:{cloudId}:AUTO_12H:DONE → Write-once completion marker
 * - phase5:scheduler:{cloudId}:AUTO_24H:DONE → Write-once completion marker
 * - phase5:scheduler:{cloudId}:AUTO_12H:ATTEMPT → Last attempt timestamp
 * - phase5:scheduler:{cloudId}:AUTO_24H:ATTEMPT → Last attempt timestamp
 */

import {
  loadSchedulerState,
  saveSchedulerState,
  hasCompletionMarker,
  writeCompletionMarker,
  getLastAttemptTime,
  recordAttemptTime,
  isBackoffActive,
  calculateBackoffUntil,
  loadInstallationTimestamp,
} from './scheduler_state';

import { handleAutoTrigger } from '../phase5_report_generator';
import { resolveTenantIdentity, type TenantIdentity } from '../core/tenant_identity';
import { storage } from '@forge/api';
import {
  EXPECTED_SCHEDULE_INTERVAL_MINUTES,
  RETENTION_MAX_SNAPSHOTS,
  RETENTION_MAX_DAYS,
} from '../core/constants';

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Calculate backoff duration in milliseconds based on attempt count.
 * Bounded: 30min (1st), 120min (2nd), 1440min (24h for 3rd+)
 */
function calculateBackoffMs(attemptCount: number): number {
  let minutes = 30; // Default: 1st attempt
  if (attemptCount >= 3) {
    minutes = 1440; // 24 hours
  } else if (attemptCount >= 2) {
    minutes = 120; // 2 hours
  }
  return minutes * 60 * 1000;
}

/**
 * Write governance status snapshot (tenant-scoped)
 * Fails silently to not block scheduler execution
 */
async function writeStatusSnapshot(
  cloudId: string | undefined,
  lastAttemptAt: string,
  lastSuccessAt: string | null = null,
  lastFailureReason: { code: string; message: string } | null = null
): Promise<void> {
  try {
    // Fail-safe: do not write with empty cloudId
    if (!cloudId || cloudId.trim() === '') {
      return;
    }

    const key = `governance:status:snapshot:${cloudId}`;
    const snapshot = {
      appName: 'FirstTry',
      version: null,
      environment: null,
      mode: 'Scheduled monitoring (read-only)',
      boundaries: {
        monitoringActive: true,
        readOnlyMode: true,
        noJiraWrites: true,
        noConfigChanges: true,
        noEnforcement: true,
      },
      lastAttemptAt,
      lastSuccessAt,
      lastFailureAt: lastFailureReason ? lastAttemptAt : null,
      lastFailureReason,
      checks: [
        {
          id: 'phase4-evidence',
          name: 'Phase-4 Evidence Collection',
          source: 'Scheduled Phase-4 snapshot (daily)',
          status: lastSuccessAt ? 'READY' : 'PENDING',
          lastAttemptAt,
          lastSuccessAt,
          reasonCode: lastSuccessAt ? null : 'COLLECTING',
          reasonMessage: lastSuccessAt ? null : 'Collecting initial evidence snapshots.',
        },
        {
          id: 'phase5-report',
          name: 'Phase-5 Trust Report Generation',
          source: 'Scheduled Phase-5 trigger (every 5 minutes)',
          status: lastSuccessAt ? 'READY' : 'PENDING',
          lastAttemptAt,
          lastSuccessAt,
          reasonCode: lastSuccessAt ? null : 'PENDING_EVIDENCE',
          reasonMessage: lastSuccessAt ? null : 'Waiting for Phase-4 evidence collection.',
        },
        {
          id: 'jira-scope',
          name: 'Jira Metadata Access',
          source: 'App manifest (read:jira-work scope)',
          status: 'READY',
          lastAttemptAt: null,
          lastSuccessAt: null,
          reasonCode: null,
          reasonMessage: null,
        },
      ],
      counters: {
        checksCompleted: lastSuccessAt ? 1 : 0,
        snapshotsCount: lastSuccessAt ? 1 : 0,
        daysContinuousOperation: 0,
      },
    };

    await storage.set(key, snapshot);
  } catch (error) {
    // Silently fail; this is informational write and should not block scheduler
    console.warn(
      `[Phase5Scheduler] Failed to write status snapshot: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Update metrics storage (lifetime counts, continuity, retention tracking)
 * Called after successful runs to persist metrics for resolver
 */
async function updateMetrics(
  cloudId: string | undefined,
  isSuccess: boolean,
  installationTimestamp?: string
): Promise<void> {
  try {
    if (!cloudId || cloudId.trim() === '') {
      return;
    }

    const metricsKey = `governance:metrics:${cloudId}`;
    const existing = (await storage.get(metricsKey)) || {};

    // Update on success
    if (isSuccess) {
      const now = new Date().toISOString();
      const checksCompletedLifetime = (existing.checksCompletedLifetime || 0) + 1;
      const snapshotsRetainedCount = Math.min((existing.snapshotsRetainedCount || 0) + 1, RETENTION_MAX_SNAPSHOTS);

      let continuousSince = existing.continuousSince || now;
      let daysContinuousOperation = 0;

      if (installationTimestamp) {
        continuousSince = installationTimestamp;
        const installTime = new Date(installationTimestamp).getTime();
        const ageMs = Date.now() - installTime;
        daysContinuousOperation = Math.floor(ageMs / (1000 * 60 * 60 * 24));
      }

      const metrics = {
        ...existing,
        lastCheckAt: now,
        lastSuccessAt: now,
        checksCompletedLifetime,
        snapshotsRetainedCount,
        continuousSince,
        daysContinuousOperation,
        updatedAt: now,
      };

      await storage.set(metricsKey, metrics);
    } else {
      // Update on failure
      const now = new Date().toISOString();
      const metrics = {
        ...existing,
        lastCheckAt: now,
        updatedAt: now,
      };
      await storage.set(metricsKey, metrics);
    }
  } catch (error) {
    // Silently fail
    console.warn(
      `[Phase5Scheduler] Failed to update metrics: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// ============================================================================
// TYPES
// ============================================================================

/**
 * Scheduler invocation result
 */
export interface SchedulerResult {
  success: boolean;
  message: string;
  cloudId?: string;
  due_trigger?: 'AUTO_12H' | 'AUTO_24H' | null;
  report_generated?: boolean;
  timestamp: string;
}

// ============================================================================
// ============================================================================
// DUE TRIGGER LOGIC
// ============================================================================

/**
 * Decide which trigger (if any) should run based on installation age
 * 
 * Logic:
 * - If AUTO_12H not yet done AND install_age >= 12h AND install_age < 24h → "AUTO_12H"
 * - Else if AUTO_24H not yet done AND install_age >= 24h → "AUTO_24H"
 * - Else → null (nothing due)
 * 
 * @returns 'AUTO_12H' | 'AUTO_24H' | null
 */
async function decideDueTrigger(
  tenantKey: string,
  installationTimestamp: string,
): Promise<'AUTO_12H' | 'AUTO_24H' | null> {
  try {
    const installTime = new Date(installationTimestamp).getTime();
    const now = Date.now(); // Use Date.now() which respects fake timers
    const ageMs = now - installTime;
    const ageHours = ageMs / (1000 * 60 * 60);

    // Check AUTO_12H
    const auto12hDone = await hasCompletionMarker(tenantKey, 'AUTO_12H');
    if (!auto12hDone && ageHours >= 12 && ageHours < 24) {
      return 'AUTO_12H';
    }

    // Check AUTO_24H
    const auto24hDone = await hasCompletionMarker(tenantKey, 'AUTO_24H');
    if (!auto24hDone && ageHours >= 24) {
      return 'AUTO_24H';
    }

    // Nothing due
    return null;
  } catch (error) {
    console.error(`[Phase5Scheduler] Error deciding due trigger for ${tenantKey}:`, error);
    return null;
  }
}

// ============================================================================
// BACKOFF LOGIC
// ============================================================================

/**
 * Check if we should retry after previous failure
 * 
 * Returns true if:
 * - Last attempt was > backoff duration ago
 * 
 * Returns false if:
 * - No prior failure
 * - Backoff period still active
 */
async function shouldRetryAfterFailure(tenantKey: string): Promise<boolean> {
  try {
    const state = await loadSchedulerState(tenantKey);

    // No prior error: always proceed
    if (!state.last_error) {
      return true;
    }

    // Check if backoff is still active
    const active = await isBackoffActive(tenantKey);
    return !active;
  } catch (error) {
    console.error(`[Phase5Scheduler] Error checking backoff for ${tenantKey}:`, error);
    return false;
  }
}

// ============================================================================
// MAIN SCHEDULER HANDLER
// ============================================================================

/**
 * Main scheduler invocation
 * Called by Forge scheduled trigger (fiveMinute or hour interval)
 * 
 * Identifies tenant context (cloudId), loads state, decides due trigger,
 * and calls handleAutoTrigger() if needed.
 * 
 * Never throws; catches all errors and returns structured result.
 */
export async function phase5SchedulerHandler(
  request: any,
  context: any,
): Promise<{ statusCode: number; body: string }> {
  const startTime = new Date().toISOString();

  try {
    // ====================================================================
    // 1. Get Tenant Context - FAIL CLOSED
    // ====================================================================

    const tenantId = resolveTenantIdentity(context);

    // FAIL CLOSED: Only if tenant identity completely unavailable
    if (!tenantId) {
      const contextKeys = Object.keys(context || {});
      const debugInfo = {
        context_keys: contextKeys,
        context_installContext: context?.installContext ? (typeof context.installContext === 'string' ? context.installContext.substring(0, 100) : 'object') : null,
        context_workspaceId: context?.workspaceId || null,
        context_installation: context?.installation ? 'present' : null,
        context_principal: context?.principal ? 'present' : null,
      };
      console.error(
        '[Phase5Scheduler] FAIL_CLOSED: No tenant identity available. Context debug:',
        JSON.stringify(debugInfo, null, 2)
      );
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error_code: 'TENANT_CONTEXT_UNAVAILABLE',
          message: 'No tenant identity available in Forge context (installContext, installationContext, or cloudId required)',
          severity: 'ERROR',
          timestamp: startTime,
        } as SchedulerResult),
      };
    }

    // Use tenantKey as primary tenant identifier
    const tenantKey = tenantId.tenantKey;
    const cloudId = tenantId.cloudId;
    
    console.info(
      `[Phase5Scheduler] Starting for tenantKey: ${tenantKey} (source: ${tenantId.source}) at ${startTime}` +
      (cloudId ? ` [cloudId: ${cloudId}]` : ' [no cloudId available]')
    );

    // Write status snapshot at start (for dashboard transparency)
    await writeStatusSnapshot(cloudId, startTime);

    // ====================================================================
    // 2. Load Installation Timestamp
    // ====================================================================

    const installationTimestamp = await loadInstallationTimestamp(cloudId);

    if (!installationTimestamp) {
      console.warn(`[Phase5Scheduler] Installation timestamp not found for ${tenantKey}`);
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: 'Installation timestamp not available; skipping generation',
          cloudId: cloudId || tenantKey,
          report_generated: false,
          timestamp: startTime,
        } as SchedulerResult),
      };
    }

    // ====================================================================
    // 3. Load Current Scheduler State
    // ====================================================================

    const state = await loadSchedulerState(tenantKey);

    // ====================================================================
    // 5. Decide Due Trigger (with authoritative DONE check)
    // ====================================================================

    // AUTHORITATIVE CHECK: If DONE_KEY exists, never run again
    const auto12hDone = await hasCompletionMarker(tenantKey, 'AUTO_12H');
    const auto24hDone = await hasCompletionMarker(tenantKey, 'AUTO_24H');

    const dueTrigger = await decideDueTrigger(tenantKey, installationTimestamp);

    if (!dueTrigger) {
      // Check if a DONE_KEY exists (trigger already generated)
      if (auto12hDone || auto24hDone) {
        const doneTrigger = auto12hDone ? 'AUTO_12H' : 'AUTO_24H';
        console.info(
          `[Phase5Scheduler] ${doneTrigger} has already been generated for ${tenantKey}`
        );
        // Update last_run_at
        state.last_run_at = startTime;
        await saveSchedulerState(tenantKey, state);
        return {
          statusCode: 200,
          body: JSON.stringify({
            success: true,
            message: `${doneTrigger} has already been generated`,
            reason: 'DONE_KEY_EXISTS',
            cloudId: cloudId || tenantKey,
            due_trigger: null,
            report_generated: false,
            timestamp: startTime,
          } as SchedulerResult),
        };
      }

      console.info(
        `[Phase5Scheduler] No trigger due for ${tenantKey}; ` +
        `auto_12h_done=${auto12hDone}, auto_24h_done=${auto24hDone}`
      );
      // Update last_run_at
      state.last_run_at = startTime;
      await saveSchedulerState(tenantKey, state);
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: 'No trigger due at this time',
          cloudId: cloudId || tenantKey,
          due_trigger: null,
          report_generated: false,
          timestamp: startTime,
        } as SchedulerResult),
      };
    }

    // ====================================================================
    // 6. Check Authoritative DONE Marker (MUST PREVENT REGENERATION)
    // ====================================================================

    const triggerDone = await hasCompletionMarker(tenantKey, dueTrigger);
    if (triggerDone) {
      console.info(
        `[Phase5Scheduler] AUTHORITATIVE: ${dueTrigger} DONE_KEY exists; never regenerating for ${tenantKey}`
      );
      // Update last_run_at
      state.last_run_at = startTime;
      await saveSchedulerState(tenantKey, state);
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: `${dueTrigger} has already been generated (authoritative DONE marker exists)`,
          cloudId: cloudId || tenantKey,
          due_trigger: dueTrigger,
          report_generated: false,
          reason: 'DONE_KEY_EXISTS',
          timestamp: startTime,
        } as SchedulerResult),
      };
    }

    // ====================================================================
    // 7. Check Backoff (based on attempt count, not generic failure count)
    // ====================================================================

    const attemptCount = dueTrigger === 'AUTO_12H' ? state.auto_12h_attempt_count : state.auto_24h_attempt_count;
    const canRetry = !state.last_backoff_until || new Date(state.last_backoff_until).getTime() < Date.now();

    if (!canRetry) {
      const backoffExpiresAt = new Date(state.last_backoff_until!);
      const minutesRemaining = Math.ceil((backoffExpiresAt.getTime() - Date.now()) / (60 * 1000));
      console.info(
        `[Phase5Scheduler] Backoff active for ${dueTrigger} (${minutesRemaining} min remaining); skipping for ${tenantKey}`
      );
      // Update last_run_at but don't attempt
      state.last_run_at = startTime;
      await saveSchedulerState(tenantKey, state);
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: `Backoff period active for ${dueTrigger}; deferring to next run`,
          cloudId: cloudId || tenantKey,
          due_trigger: dueTrigger,
          report_generated: false,
          backoff_expires_at: state.last_backoff_until,
          timestamp: startTime,
        } as SchedulerResult),
      };
    }

    // ====================================================================
    // 8. Increment Attempt Count and Record Attempt
    // ====================================================================

    console.info(
      `[Phase5Scheduler] Attempting ${dueTrigger} generation for ${tenantKey} (attempt #${attemptCount + 1})`
    );
    const newAttemptCount = attemptCount + 1;
    if (dueTrigger === 'AUTO_12H') {
      state.auto_12h_attempt_count = newAttemptCount;
    } else {
      state.auto_24h_attempt_count = newAttemptCount;
    }
    await recordAttemptTime(tenantKey, dueTrigger);

    // ====================================================================
    // 9. Generate Report (SINGLE CODE PATH: handleAutoTrigger)
    // ====================================================================

    let reportGenerated = false;
    let generationError: string | null = null;

    try {
      const result = await handleAutoTrigger(dueTrigger);

      if (result.success) {
        console.info(`[Phase5Scheduler] ${dueTrigger} report generated successfully for ${tenantKey}`);
        reportGenerated = true;

        // AUTHORITATIVE: Write DONE marker (prevents future runs)
        await writeCompletionMarker(tenantKey, dueTrigger);

        // Update state
        if (dueTrigger === 'AUTO_12H') {
          state.auto_12h_generated_at = startTime;
        } else if (dueTrigger === 'AUTO_24H') {
          state.auto_24h_generated_at = startTime;
        }
        state.last_error = null;
        state.last_backoff_until = null;

        // Update metrics for resolver
        await updateMetrics(cloudId, true, installationTimestamp);
      } else {
        // result.success === false, so we know result has 'error' field
        generationError = (result as { success: false; error: string }).error;
        console.error(
          `[Phase5Scheduler] ${dueTrigger} generation failed (attempt #${newAttemptCount}) for ${tenantKey}: ${generationError}`
        );

        // Apply bounded backoff on failure (specific to this trigger)
        const backoffMs = calculateBackoffMs(newAttemptCount);
        state.last_backoff_until = new Date(Date.now() + backoffMs).toISOString();
        state.last_error = {
          timestamp: startTime,
          message: generationError,
          trigger: dueTrigger,
          attempt_count: newAttemptCount,
        };

        // Update metrics for resolver (failure)
        await updateMetrics(cloudId, false);

        console.warn(
          `[Phase5Scheduler] Backoff ${backoffMs}ms (${newAttemptCount} attempt(s)) applied; ` +
          `next eligible at ${state.last_backoff_until}`
        );
      }
    } catch (err) {
      generationError = err instanceof Error ? err.message : String(err);
      console.error(
        `[Phase5Scheduler] Unexpected error during ${dueTrigger} generation: ${generationError}`
      );

      // Apply bounded backoff on unexpected error
      const nextAttempt = newAttemptCount + 1;
      const backoffMs = calculateBackoffMs(nextAttempt);
      state.last_backoff_until = new Date(Date.now() + backoffMs).toISOString();
      state.last_error = {
        timestamp: startTime,
        message: `Unexpected error: ${generationError}`,
        trigger: dueTrigger,
        attempt_count: nextAttempt,
      };

      // Update metrics for resolver (error)
      await updateMetrics(cloudId, false);

      console.warn(
        `[Phase5Scheduler] Backoff ${backoffMs}ms (attempt ${nextAttempt}) applied; ` +
        `next eligible at ${state.last_backoff_until}`
      );
    }

    // ====================================================================
    // 10. Final State Update and Response
    // ====================================================================

    state.last_run_at = startTime;
    await saveSchedulerState(tenantKey, state);

    // Write final status snapshot
    if (reportGenerated) {
      await writeStatusSnapshot(cloudId, startTime, startTime, null);
    } else if (generationError) {
      await writeStatusSnapshot(cloudId, startTime, null, {
        code: 'GENERATION_ERROR',
        message: generationError,
      });
    }

    const httpStatus = reportGenerated ? 200 : 202;

    return {
      statusCode: httpStatus,
      body: JSON.stringify({
        success: reportGenerated,
        message: reportGenerated ? `${dueTrigger} report generated successfully` : `${dueTrigger} generation failed: ${generationError}`,
        cloudId: cloudId || tenantKey,
        due_trigger: dueTrigger,
        report_generated: reportGenerated,
        attempt_count: newAttemptCount,
        backoff_until: state.last_backoff_until,
        timestamp: startTime,
      } as SchedulerResult),
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[Phase5Scheduler] Unexpected error in scheduler: ${errorMsg}`);

    // FAIL CLOSED: Do not throw
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        message: `Scheduler error: ${errorMsg}`,
        timestamp: new Date().toISOString(),
      } as SchedulerResult),
    };
  }
}

/**
 * Forge scheduled trigger entry point
 * Matches manifest.yml handler path: scheduled/phase5_scheduler.run
 */
export async function run(request: any, context: any): Promise<{ statusCode: number; body: string }> {
  return phase5SchedulerHandler(request, context);
}
