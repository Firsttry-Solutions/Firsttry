/**
 * Web Trigger: Backend Build Identity
 * 
 * Purpose: Expose backend build identity via HTTP endpoint for E2E verification.
 * This provides an authoritative source for deployment validation that bypasses
 * CDN caching issues.
 * 
 * Endpoint: /backend-identity (public, read-only)
 * Returns: JSON with gitShaFull, gitShaShort, buildTimeUtc, appVersion
 * 
 * Used by: Enterprise contract E2E test to verify deployment
 */

import {
  BACKEND_GIT_SHA,
  BACKEND_GIT_SHA_SHORT,
  BACKEND_BUILD_TIME_UTC,
  BACKEND_APP_VERSION,
} from '../build/buildIdentityBackend.gen';

/**
 * Web trigger handler - returns backend build identity
 * This is a public endpoint with no authentication required (read-only, non-sensitive data)
 */
export async function handler(req: any) {
  const resolvedAt = new Date().toISOString();
  
  // Log invocation for audit trail
  console.log('[BACKEND_IDENTITY_WEBTRIGGER]', {
    marker: 'BACKEND_IDENTITY_HTTP',
    git_sha_short: BACKEND_GIT_SHA_SHORT,
    build_time_utc: BACKEND_BUILD_TIME_UTC,
    resolved_at: resolvedAt,
    method: req?.method,
    path: req?.path,
  });
  
  const identity = {
    gitShaFull: BACKEND_GIT_SHA,
    gitShaShort: BACKEND_GIT_SHA_SHORT,
    buildUtc: BACKEND_BUILD_TIME_UTC, // Match E2E test expectations
    buildTimeUtc: BACKEND_BUILD_TIME_UTC,
    appVersion: BACKEND_APP_VERSION,
    resolvedAt,
  };
  
  return {
    body: JSON.stringify(identity, null, 2),
    headers: {
      'Content-Type': ['application/json'],
      'Access-Control-Allow-Origin': ['*'], // Allow CORS for E2E tests
    },
    statusCode: 200,
  };
}
