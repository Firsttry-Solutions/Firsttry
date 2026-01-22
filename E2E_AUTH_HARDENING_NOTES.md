# E2E Authentication - Hardened, Safe, and Truthful

## TL;DR - What You Need to Know

**Jira Cloud does NOT support automated SESSION-based authentication.**

- JIRA_PASSWORD doesn't work (basic auth disabled)
- Browser session cookies expire and can't be reliably captured
- **Solution:** REST API token injection (safe, domain-allowlisted, REST endpoints only)

## What Changed

Previously, E2E tests injected the `Authorization` header globally across ALL requests. This was unsafe.

**Now: Safe, Domain-Allowlisted REST-Only Injection**

- Authorization headers are **ONLY** injected for requests to:
  - Hostname: `firsttry.atlassian.net`
  - Path: `/rest/api/*`
- All other requests (including cross-domain) proceed **unmodified**
- Route interception guards actively prevent off-domain leakage
- Tests fail fast if Authorization would escape the allowlist

## Why Cookies Aren't Enough

Jira Cloud:
- Uses SSO/MFA which requires interactive approval
- Session cookies expire after ~24 hours
- Requires REST API token for automated testing
- StorageState cookies are incomplete/insufficient alone

**This is why E2E automation MUST use REST API token injection.**

## Architecture

### Safe Header Injection: `e2e/scripts/_auth_headers.mjs`

```javascript
export function shouldAttachAuth(urlString) {
  const url = new URL(urlString);
  // ONLY firsttry.atlassian.net + /rest/api/* paths
  if (url.hostname !== 'firsttry.atlassian.net') return false;
  if (!url.pathname.startsWith('/rest/api/')) return false;
  return true;
}

export async function createAuthRouteHandler(route) {
  // Conditionally inject Authorization header
  // GUARD: Fail if Authorization would leak off-domain
}
```

### Usage: REST API Calls Only

For page navigation (no auth header needed):
```javascript
await page.goto(DASHBOARD_URL);  // Cookies + page auth redirect handling
```

For REST API calls (explicit header injection):
```javascript
const { shouldAttachAuth, buildAuthHeaderValue } = await import('./_auth_headers.mjs');
if (shouldAttachAuth(apiUrl)) {
  const authHeader = buildAuthHeaderValue();  // "Basic <base64(user:token)>"
  const response = await context.request.get(apiUrl, {
    headers: { Authorization: authHeader },
  });
}
```

## Files Modified

1. **NEW:** `e2e/scripts/_auth_headers.mjs` - Safe header injection module
2. **UPDATED:** `e2e/scripts/auth_preflight_check.mjs` - Uses cookies + REST header injection
3. **UPDATED:** `e2e/scripts/auth_smoke_strict.mjs` - Uses route interception + explicit headers
4. **UPDATED:** `e2e/playwright.config.ts` - Removed global extraHTTPHeaders
5. **UPDATED:** `e2e/scripts/auth_via_token.mjs` - Generates storageState (canonical location)
6. **NEW:** `e2e/scripts/verify_no_global_auth_injection.mjs` - Security gate

## Security Properties

### ✅ Token Leakage Prevented
- Authorization header NEVER sent to non-Jira domains
- Explicit guards fail if leak attempted
- Tests include integration guard (verify_no_global_auth_injection.mjs)

### ✅ Deterministic
- Behavior defined by hostname + path patterns
- No random/conditional token injection
- Repeatable across runs

### ✅ Truthful
- Docs state exactly what auth mode is used (REST header, NOT SESSION)
- Preflight result includes `authMode: 'REST_HEADER_WORKAROUND'`
- No misleading SESSION/cookie claims

## Verification

```bash
# Regenerate fresh storageState (canonical location)
node e2e/scripts/auth_via_token.mjs

# Run smoke test (REST-only auth)
node e2e/scripts/auth_smoke_strict.mjs

# Verify no global auth injection
node e2e/scripts/verify_no_global_auth_injection.mjs
```

## Acceptance Criteria Met

✅ No request to non-firsttry.atlassian.net contains Authorization header  
✅ /rest/api/3/myself returns 200 in smoke/preflight (when API called)  
✅ Docs no longer claim SESSION/cookie auth exists  
✅ verify_no_global_auth_injection.mjs gate passes  
✅ Token never logged or exposed in output  

## Key Differences: Old vs New

| Aspect | Before | After |
|--------|--------|-------|
| Header Scope | Global (all requests) | Per-route (REST only) + explicit |
| Domain Protection | None | Allowlist (firsttry only) |
| Guard | None | Active (fails on leak) |
| Token Logging | Potentially | Never |
| Session Claims | Misleading | Truthful (REST workaround) |
| Session Cookies | Tried to capture (unreliable) | Accepted as metadata only |

## Why This Design is Necessary

Jira Cloud infrastructure:
- SSO/MFA blocks interactive browser login → Can't establish sessions
- Session expiration → Cookies become invalid
- REST API token → Only reliable auth method for CI/automation
- Domain-allowlisting → Prevents accidental token leakage
- Route interception → Enables safe, conditional header injection

This is the only viable approach for Jira Cloud E2E automation.


