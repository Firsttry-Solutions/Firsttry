/**
 * _auth_headers.mjs
 * 
 * SAFE, DOMAIN-ALLOWLISTED Authorization header injection for E2E tests.
 * 
 * RULES:
 * - NEVER inject Authorization headers globally.
 * - ONLY attach Authorization header to requests destined for:
 *   - hostname === "firsttry.atlassian.net"
 *   - path startsWith "/rest/api/"
 * - NEVER log the Authorization header value or token.
 * - FAIL FAST if Authorization header would leak off-domain.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Determine if a given URL should receive Authorization header injection.
 * 
 * @param {string} urlString - The full request URL
 * @returns {boolean} - True if this is a firsttry.atlassian.net REST API call
 */
export function shouldAttachAuth(urlString) {
  try {
    const url = new URL(urlString);
    
    // RULE: Only firsttry.atlassian.net
    if (url.hostname !== 'firsttry.atlassian.net') {
      return false;
    }
    
    // RULE: Only /rest/api/* paths
    if (!url.pathname.startsWith('/rest/api/')) {
      return false;
    }
    
    return true;
  } catch (e) {
    // Invalid URL - do NOT attach auth
    return false;
  }
}

/**
 * Build the Authorization header value using API token.
 * 
 * SECURITY: This function NEVER logs the token or header value.
 * 
 * @returns {string|null} - "Basic <base64(user:token)>" or null if creds unavailable
 */
export function buildAuthHeaderValue() {
  const user = process.env.JIRA_USER;
  const token = process.env.JIRA_API_TOKEN;
  
  if (!user || !token) {
    return null;
  }
  
  const credentials = `${user}:${token}`;
  const base64 = Buffer.from(credentials).toString('base64');
  return `Basic ${base64}`;
}

/**
 * Create a route handler that conditionally injects Authorization header.
 * 
 * Usage in tests/preflight:
 * ```
 * await page.route('**\/*', route => createAuthRouteHandler(route));
 * ```
 * 
 * @param {Route} route - Playwright Route object
 * @returns {Promise<void>}
 */
export async function createAuthRouteHandler(route) {
  const url = route.request().url();
  const method = route.request().method();
  
  let headers = { ...route.request().headers() };
  
  // If this is a firsttry REST API call, add Authorization
  if (shouldAttachAuth(url)) {
    const authHeader = buildAuthHeaderValue();
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }
  }
  
  // GUARD: Fail if Authorization would leak off-domain
  if (headers['Authorization'] && !shouldAttachAuth(url)) {
    console.error(`[AUTH_GUARD] ❌ PREVENTED LEAK: Authorization header would be sent to: ${url}`);
    throw new Error(
      `[AUTH_GUARD_BREACH] Authorization header attempted to leak off-domain!\n` +
      `URL: ${url}\n` +
      `This is a security breach. The test cannot continue.`
    );
  }
  
  // Continue with potentially modified headers
  await route.continue({ headers });
}

/**
 * Verify that a page context is NOT set up with global Authorization headers.
 * Call this in tests to assert security.
 * 
 * @param {Page} page - Playwright Page object
 */
export async function verifyNoGlobalAuthHeaders(page) {
  // Try to make a request to a non-Jira domain and verify no auth header is present
  const testUrl = 'https://example.com/';
  
  let foundAuth = false;
  let interceptedUrl = null;
  
  const handler = async (route) => {
    const headers = route.request().headers();
    if (headers['Authorization']) {
      foundAuth = true;
      interceptedUrl = route.request().url();
    }
    await route.abort();
  };
  
  await page.route('**/*', handler);
  
  try {
    await page.goto(testUrl, { waitUntil: 'domcontentloaded', timeout: 5000 }).catch(() => {});
  } catch (e) {
    // Expected to fail (blocking/abort)
  }
  
  await page.unroute('**/*', handler);
  
  if (foundAuth) {
    throw new Error(
      `[AUTH_GUARD] Global Authorization header detected!\n` +
      `URL: ${interceptedUrl}\n` +
      `This violates security rules. Authorization must be injected per-route, not globally.`
    );
  }
}

export default {
  shouldAttachAuth,
  buildAuthHeaderValue,
  createAuthRouteHandler,
  verifyNoGlobalAuthHeaders,
};
