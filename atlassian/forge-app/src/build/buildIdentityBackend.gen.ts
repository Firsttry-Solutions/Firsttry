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
export const BACKEND_GIT_SHA = 'b52cad285f837398945a50e984b467380a93fe07';

/** Short form: first 7 characters of git SHA */
export const BACKEND_GIT_SHA_SHORT = 'b52cad2';

/** ISO-8601 UTC build time from git commit (git show -s --format=%cI HEAD) */
export const BACKEND_BUILD_TIME_UTC = '2026-02-23T04:08:16Z';

/** App version from package.json */
export const BACKEND_APP_VERSION = '2.14.0';

/**
 * Format build identity for logging
 */
export function formatBackendBuildIdentity(): string {
  return `Backend: ${BACKEND_GIT_SHA_SHORT} | ${BACKEND_BUILD_TIME_UTC}`;
}
