/**
 * AUTO-GENERATED FILE - DO NOT EDIT
 * 
 * Generated at build time by tools/gen_backend_build_identity.mjs
 * Contains deterministic build identity values from git HEAD and package.json
 * 
 * These values are returned by the resolver to:
 * 1. Enable runtime mismatch detection (UI SHA vs Backend SHA)
 * 2. Provide cryptographic proof of backend build identity
 * 3. Support forensic probes and audit trails
 */

/** Full 40-character git SHA (lowercase hex) from git rev-parse HEAD */
export const BACKEND_GIT_SHA = 'a0b48cc29de2e7fbc214995ce76f2e6282ca5e0b';

/** Short form: first 7 characters of git SHA */
export const BACKEND_GIT_SHA_SHORT = 'a0b48cc';

/** ISO-8601 UTC build time from git commit (git show -s --format=%cI HEAD) */
export const BACKEND_BUILD_TIME_UTC = '2026-02-22T04:48:17Z';

/** App version from package.json */
export const BACKEND_APP_VERSION = '2.14.0';

/**
 * Format build identity for logging
 */
export function formatBackendBuildIdentity(): string {
  return `Backend: ${BACKEND_GIT_SHA_SHORT} | ${BACKEND_BUILD_TIME_UTC}`;
}
