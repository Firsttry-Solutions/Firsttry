/**
 * FirstTry Governance - Phase 3 Configuration Constants
 * PHASE 3: Scheduled pipelines, run ledgers, readiness gating
 *
 * All Phase 3 components reference these constants from a single source.
 * Do not hardcode values in individual modules.
 */

/**
 * REPORT_FIRST_DELAY_HOURS
 * Time window (in hours) before first report is eligible for generation.
 * Used by: readiness_gate.ts
 */
export const REPORT_FIRST_DELAY_HOURS = 12;

/**
 * MIN_EVENTS_FOR_FIRST_REPORT
 * Minimum event count (cumulative across all days) before first report is eligible.
 * Used by: readiness_gate.ts
 */
export const MIN_EVENTS_FOR_FIRST_REPORT = 10;

/**
 * MAX_DAILY_BACKFILL_DAYS
 * Maximum number of days to backfill on daily pipeline.
 * Prevents unbounded backlog if pipeline hasn't run.
 * Used by: backfill_selector.ts, daily_pipeline.ts
 */
export const MAX_DAILY_BACKFILL_DAYS = 7;

/**
 * DAILY_PIPELINE_SCHEDULE
 * Cron expression for daily pipeline (UTC).
 * Example: "0 1 * * *" = 1 AM UTC daily
 * Note: Actual scheduling is in manifest.yml
 */
export const DAILY_PIPELINE_SCHEDULE = "0 1 * * *";

/**
 * WEEKLY_PIPELINE_SCHEDULE
 * Cron expression for weekly pipeline (UTC).
 * Example: "0 2 * * 1" = 2 AM UTC every Monday
 * Note: Actual scheduling is in manifest.yml
 */
export const WEEKLY_PIPELINE_SCHEDULE = "0 2 * * 1";

/**
 * ERROR_MESSAGE_MAX_LENGTH
 * Maximum length for error messages stored in runs/{org}/last_error
 * Prevents unbounded storage growth.
 */
export const ERROR_MESSAGE_MAX_LENGTH = 300;
