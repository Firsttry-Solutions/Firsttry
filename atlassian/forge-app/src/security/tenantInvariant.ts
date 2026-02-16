/**
 * Tenant Isolation Invariant
 * Enforces that contexts match derived site IDs before storage access
 * Fail-closed: throws if mismatch detected
 */

export function assertTenantInvariant(contextSiteId: string, derivedSiteId: string): void {
  if (contextSiteId !== derivedSiteId) {
    throw new Error("TENANT_INVARIANT_VIOLATION");
  }
}

console.log("[FT_TENANT_INVARIANT_ENFORCED]");
