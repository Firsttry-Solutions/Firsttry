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

// APP_VERSION is derived from package.json at build time.
// It is not user-configurable, not tenant-specific, and cannot be overridden at runtime.
const pkg = require('../../package.json');
export const APP_VERSION = `v${pkg.version}`;

// environment reflects the Forge deployment environment (e.g., production or staging).
// It is derived from the Forge runtime context and is not user-configurable.
export const APP_ENVIRONMENT = process.env.FORGE_ENVIRONMENT || 'production';
