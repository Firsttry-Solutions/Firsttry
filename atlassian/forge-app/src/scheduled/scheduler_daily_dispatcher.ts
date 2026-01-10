/**
 * DAILY DISPATCHER
 *
 * Consolidates 4 daily scheduled tasks under a single daily trigger to comply with
 * Forge platform limit (max 5 scheduledTrigger modules).
 *
 * Calls all daily handlers in strict order without modifying their logic.
 * If a handler fails, it is logged, other handlers continue, and a summary error
 * is thrown at the end to ensure failure visibility while not blocking subsequent jobs.
 *
 * JOBS (in order):
 * 1. snapshot_daily.handle → Daily evidence snapshot
 * 2. config_visibility_scheduler.run → Daily config metrics
 * 3. perf_signals_scheduler.run → Daily perf signals
 * 4. phase4_scheduler.runDaily → Daily Phase 4 timeline update
 */

import { handle as snapshotDailyHandle } from './snapshot_daily';
import { run as configVisibilityRun } from './config_visibility_scheduler';
import { run as perfSignalsRun } from './perf_signals_scheduler';
import { runDaily as phase4RunDaily } from './phase4_scheduler';

interface StepResult {
  name: string;
  ok: boolean;
  error?: Error | string;
}

export async function runDailyDispatch(
  request: any,
  context: any
): Promise<void> {
  console.log('[DAILY_DISPATCH] START');

  const results: StepResult[] = [];
  const steps = [
    {
      name: 'snapshot_daily.handle',
      fn: () => snapshotDailyHandle(request, context),
    },
    {
      name: 'config_visibility_scheduler.run',
      fn: () => configVisibilityRun(request, context),
    },
    {
      name: 'perf_signals_scheduler.run',
      fn: () => perfSignalsRun(request, context),
    },
    {
      name: 'phase4_scheduler.runDaily',
      fn: () => phase4RunDaily(request, context),
    },
  ];

  for (const step of steps) {
    try {
      console.log(`[DAILY_DISPATCH] STEP "${step.name}" START`);
      await step.fn();
      console.log(`[DAILY_DISPATCH] STEP "${step.name}" OK`);
      results.push({ name: step.name, ok: true });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error(
        `[DAILY_DISPATCH] STEP "${step.name}" FAIL: ${error.message}`
      );
      results.push({
        name: step.name,
        ok: false,
        error: error.message,
      });
      // Continue to next step; do not throw yet
    }
  }

  console.log('[DAILY_DISPATCH] END');

  // Check if any step failed
  const failures = results.filter((r) => !r.ok);
  if (failures.length > 0) {
    const failureSummary = failures
      .map((f) => `${f.name}: ${f.error}`)
      .join('; ');
    throw new Error(
      `[DAILY_DISPATCH] ${failures.length} of ${steps.length} steps failed: ${failureSummary}`
    );
  }
}
