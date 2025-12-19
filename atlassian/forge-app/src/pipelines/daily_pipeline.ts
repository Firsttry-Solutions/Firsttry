/**
 * Daily Pipeline - Scheduled Daily Aggregation
 * PHASE 3: Backfill missing days and run daily aggregation
 *
 * Behavior (exact order):
 * 1. Record attempt
 * 2. Get all orgs from index
 * 3. For each org:
 *    a. Get last_success_at
 *    b. Select backfill dates (max 7 days)
 *    c. For each date: call recompute_daily
 *    d. Call retention_cleanup
 *    e. Record success (even if no data)
 * 4. Never crash; catch all errors per-org
 *
 * Handler signature matches Forge scheduled:trigger requirement
 */

import {
  record_daily_attempt,
  record_daily_success,
  record_last_error,
  get_daily_last_success,
  get_all_orgs,
} from '../run_ledgers';
import { select_backfill_dates } from '../backfill_selector';
import { recompute_daily } from '../aggregation/daily';
import { retention_cleanup } from '../retention/cleanup';

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
 * Daily pipeline handler - entry point for scheduled trigger
 * Forge scheduled:trigger calls this function
 */
export async function dailyPipelineHandler(event: any): Promise<{ statusCode: number; body: string }> {
  try {
    const nowISO = new Date().toISOString();
    console.info(`[DailyPipeline] Starting at ${nowISO}`);

    // Get all orgs
    const orgs = await get_all_orgs();
    console.info(`[DailyPipeline] Found ${orgs.length} orgs to process`);

    if (orgs.length === 0) {
      console.warn('[DailyPipeline] No orgs found; nothing to process');
      return {
        statusCode: 200,
        body: JSON.stringify({ status: 'success', message: 'No orgs to process' }),
      };
    }

    // Process each org independently
    let successCount = 0;
    let errorCount = 0;

    for (const org of orgs) {
      try {
        await process_org_daily(org, nowISO);
        successCount++;
      } catch (error) {
        errorCount++;
        const errorMsg =
          error instanceof Error
            ? error.message
            : String(error);
        console.error(`[DailyPipeline] Error processing org ${org}:`, errorMsg);
        
        // Record error (non-fatal)
        try {
          await record_last_error(org, `Daily pipeline error: ${errorMsg}`, nowISO);
        } catch {
          // Ignore error recording failures
        }
      }
    }

    console.info(
      `[DailyPipeline] Completed: ${successCount} orgs succeeded, ${errorCount} orgs failed`
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
    // Fatal error: pipeline cannot execute at all
    console.error('[DailyPipeline] Fatal error:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        status: 'error',
        message: `Daily pipeline fatal error: ${errorMsg}`,
      }),
    };
  }
}

/**
 * Scheduled trigger entry point - matches manifest handler path
 * Forge scheduledTrigger invokes this directly
 */
export async function run(request: any, context: any): Promise<{ statusCode: number; body: string }> {
  return dailyPipelineHandler(request);
}

/**
 * Process a single org's daily aggregation (exported for testing)
 */
export async function process_org_daily(org: string, nowISO: string): Promise<void> {
  console.info(`[DailyPipeline] Processing org: ${org}`);

  // Record attempt
  await record_daily_attempt(org, nowISO);

  // Get last success (may be null)
  const lastSuccess = await get_daily_last_success(org);
  console.info(`[DailyPipeline] Org ${org}: last_success = ${lastSuccess || '(never)'}`);

  // Select backfill dates
  const dateStr = nowISO.substring(0, 10); // yyyy-mm-dd
  const dates = select_backfill_dates(lastSuccess, nowISO);
  console.info(`[DailyPipeline] Org ${org}: backfill dates = ${JSON.stringify(dates)}`);

  // Process each date
  for (const date of dates) {
    try {
      console.info(`[DailyPipeline] Org ${org}: running daily agg for ${date}`);
      await recompute_daily(org, date);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[DailyPipeline] Org ${org}: daily agg failed for ${date}: ${errorMsg}`);
      // Continue to next date (best-effort)
    }
  }

  // Run retention cleanup
  try {
    console.info(`[DailyPipeline] Org ${org}: running retention cleanup`);
    await retention_cleanup(org, nowISO);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[DailyPipeline] Org ${org}: retention cleanup failed: ${errorMsg}`);
    // Continue anyway (best-effort)
  }

  // Record success (even if we had no data or partial failures)
  await record_daily_success(org, nowISO);
  console.info(`[DailyPipeline] Org ${org}: marked as success`);
}
