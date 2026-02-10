/**
 * Resolver: getBackendBuildIdentity
 * 
 * Purpose: Return AUTHORITATIVE backend build identity for deployment verification.
 * This bypasses CDN caching issues by providing git SHA directly from the backend.
 * 
 * Used by: Enterprise contract E2E test to verify deployment matches local git HEAD.
 * 
 * Returns:
 * - gitShaFull: 40-character git SHA from build time
 * - gitShaShort: 7-character short SHA
 * - buildTimeUtc: ISO-8601 UTC timestamp of build
 * - appVersion: Package.json version
 * 
 * CRITICAL: This resolver MUST be called after deployment to verify the deployed
 * backend matches the expected git SHA. Frontend console logs and buildinfo.json
 * are subject to CDN caching and cannot be trusted for immediate verification.
 */

import {
  BACKEND_GIT_SHA,
  BACKEND_GIT_SHA_SHORT,
  BACKEND_BUILD_TIME_UTC,
  BACKEND_APP_VERSION,
} from '../build/buildIdentityBackend.gen';

/**
 * Backend build identity response interface
 */
export interface BackendBuildIdentity {
  gitShaFull: string;
  gitShaShort: string;
  buildTimeUtc: string;
  appVersion: string;
  resolvedAt: string;
}

/**
 * Resolver implementation - returns backend build identity
 * This is a read-only operation with no side effects.
 */
export async function getBackendBuildIdentity_resolver(): Promise<BackendBuildIdentity> {
  const resolvedAt = new Date().toISOString();
  
  // Log invocation for audit trail
  console.log('[BACKEND_IDENTITY_RESOLVER]', {
    marker: 'BACKEND_IDENTITY_RESOLVED',
    git_sha_short: BACKEND_GIT_SHA_SHORT,
    build_time_utc: BACKEND_BUILD_TIME_UTC,
    resolved_at: resolvedAt,
  });
  
  return {
    gitShaFull: BACKEND_GIT_SHA,
    gitShaShort: BACKEND_GIT_SHA_SHORT,
    buildTimeUtc: BACKEND_BUILD_TIME_UTC,
    appVersion: BACKEND_APP_VERSION,
    resolvedAt,
  };
}
