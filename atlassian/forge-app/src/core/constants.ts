/**
 * APPLICATION CONSTANTS
 * 
 * Single source of truth for scheduler intervals, retention policies, and versioning.
 */

/**
 * Expected schedule interval for meaningful checks (minutes).
 * Derived from manifest scheduledTrigger interval: fiveMinute.
 * Used for staleness calculation: stale if lastSuccessAt > 2 × this value.
 */
export const EXPECTED_SCHEDULE_INTERVAL_MINUTES = 5;

/**
 * Staleness multiplier.
 * Status = DEGRADED if lastSuccessAt > (EXPECTED_SCHEDULE_INTERVAL_MINUTES × STALENESS_MULTIPLIER).
 */
export const STALENESS_MULTIPLIER = 2;

/**
 * Retention policy: max snapshots retained in storage.
 */
export const RETENTION_MAX_SNAPSHOTS = 100;

/**
 * Retention policy: max days of snapshots retained.
 */
export const RETENTION_MAX_DAYS = 30;

/**
 * Application version (used in gadget and exports).
 * Must match manifest/package.json version during deployment.
 */
export const APP_VERSION = '2.14.0';

/**
 * Application environment (production, staging, etc.).
 * Set by deployment context; defaults to 'production'.
 */
export const APP_ENVIRONMENT = process.env.FORGE_ENVIRONMENT || 'production';
