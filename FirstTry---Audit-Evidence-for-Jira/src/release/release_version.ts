/**
 * Human-controlled release marker.
 * PURPOSE: proves what code is actually running in production via runtime logs.
 *
 * RULE:
 * - MUST be bumped on every production deploy where behavior/logging changes.
 * - MUST NOT be auto-generated (avoid dirty trees).
 */
export const FT_RELEASE_VERSION = "2026.01.24.01";
