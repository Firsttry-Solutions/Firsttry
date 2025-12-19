/**
 * Weekly Pipeline - Scheduled Weekly Aggregation & Readiness Gating
 * PHASE 3: Recompute weekly aggregates and write readiness status
 *
 * Behavior:
 * 1. Record attempt
 * 2. Get all orgs
 * 3. For each org:
 *    a. Compute current ISO week
 *    b. Call recompute_week
 *    c. Evaluate readiness gate
 *    d. Write readiness status
 *    e. Record success
 * 4. Never crash; catch all errors per-org
 *
 * Note: NO report generation in Phase 3
 */

import {
  record_weekly_attempt,
  record_weekly_success,
  record_last_error,
  get_all_orgs,
} from '../run_ledgers';
import { recompute_week } from '../aggregation/weekly';
import { evaluate_readiness, write_readiness_status } from '../readiness_gate';

let api: any;
try {
  api = require('@forge/api').default;
} catch {
  // Test environment
}

/**
 * (Test only) Set mock api for testing
 */
export function setMockApi(mockApiObj: any): void {
  api = mockApiObj;
}

/**
 * Get ISO week string (yyyy-WW) for a given date
 */
function getISOWeek(date: Date): string {
  const iso = date.toISOString().substring(0, 10); // yyyy-mm-dd
  return isoDateToWeek(iso);
}

/**
 * Convert yyyy-mm-dd to yyyy-WW (ISO week)
 */
function isoDateToWeek(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return '';
  
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  
  const date = new Date(Date.UTC(year, month - 1, day));
  
  // ISO week calculation
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  
  return `${date.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

/**
 * Scheduled trigger entry point - matches manifest handler path
 * Forge scheduledTrigger invokes this directly
 */
export async function run(request: any, context: any): Promise<{ statusCode: number; body: string }> {
  return weeklyPipelineHandler(request);
}

/**
 * Weekly pipeline handler - entry point for scheduled trigger
 */
export async function weeklyPipelineHandler(event: any): Promise<{ statusCode: number; body: string }> {
  try {
    const nowISO = new Date().toISOString();
    console.info(`[WeeklyPipeline] Starting at ${nowISO}`);

    // Get all orgs
    const orgs = await get_all_orgs();
    console.info(`[WeeklyPipeline] Found ${orgs.length} orgs to process`);

    if (orgs.length === 0) {
      console.warn('[WeeklyPipeline] No orgs found; nothing to process');
      return {
        statusCode: 200,
        body: JSON.stringify({ status: 'success', message: 'No orgs to process' }),
      };
    }

    let successCount = 0;
    let errorCount = 0;

    for (const org of orgs) {
      try {
        await process_org_weekly(org, nowISO);
        successCount++;
      } catch (error) {
        errorCount++;
        const errorMsg =
          error instanceof Error
            ? error.message
            : String(error);
        console.error(`[WeeklyPipeline] Error processing org ${org}:`, errorMsg);
        
        try {
          await record_last_error(org, `Weekly pipeline error: ${errorMsg}`, nowISO);
        } catch {
          // Ignore error recording failures
        }
      }
    }

    console.info(
      `[WeeklyPipeline] Completed: ${successCount} orgs succeeded, ${errorCount} orgs failed`
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        status: 'success',
        orgs_processed: orgs.length,
        orgs_succeeded: successCount,
        orgs_failed: errorCount,
      }),
    };
  } catch (error) {
    console.error('[WeeklyPipeline] Fatal error:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        status: 'error',
        message: `Weekly pipeline fatal error: ${errorMsg}`,
      }),
    };
  }
}

/**
 * Process a single org's weekly aggregation and readiness
 */
export async function process_org_weekly(org: string, nowISO: string): Promise<void> {
  console.info(`[WeeklyPipeline] Processing org: ${org}`);

  // Record attempt
  await record_weekly_attempt(org, nowISO);

  // Get current ISO week
  const now = new Date(nowISO);
  const currentWeek = getISOWeek(now);
  console.info(`[WeeklyPipeline] Org ${org}: current week = ${currentWeek}`);

  // Recompute weekly aggregate
  try {
    console.info(`[WeeklyPipeline] Org ${org}: running weekly agg for ${currentWeek}`);
    await recompute_week(org, currentWeek);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(
      `[WeeklyPipeline] Org ${org}: weekly agg failed for ${currentWeek}: ${errorMsg}`
    );
    // Continue anyway (best-effort)
  }

  // Evaluate and write readiness status
  try {
    console.info(`[WeeklyPipeline] Org ${org}: evaluating readiness`);
    const { status, reason } = await evaluate_readiness(org, nowISO);
    await write_readiness_status(org, status, reason, nowISO);
    console.info(`[WeeklyPipeline] Org ${org}: readiness = ${status}`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[WeeklyPipeline] Org ${org}: readiness eval failed: ${errorMsg}`);
    // Continue anyway (best-effort)
  }

  // Record success
  await record_weekly_success(org, nowISO);
  console.info(`[WeeklyPipeline] Org ${org}: marked as success`);
}
