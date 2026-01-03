/**
 * TENANT IDENTITY RESOLVER
 * 
 * Derives tenant identity from Forge scheduled trigger context.
 * Supports both direct cloudId and ARI-encoded installContext.
 * 
 * Key insight from production logs:
 * Scheduled trigger context keys are: ["principal","installContext","installation","workspaceId"]
 * NOT cloudId. So we use installContext as the canonical tenant key.
 * 
 * Used by: Scheduled trigger handler for Phase5 scheduler
 */

/**
 * Tenant identity resolved from Forge context
 */
export type TenantIdentity = {
  /** Canonical tenant key for storage isolation (ARI string or cloudId) */
  tenantKey: string;
  /** Extracted cloudId if present (optional, may be null) */
  cloudId: string | null;
  /** Source of the tenant identity (for debugging) */
  source: 'installContext' | 'installationContext' | 'cloudId' | 'other';
};

/**
 * Resolve tenant identity from Forge context using scheduled trigger reality
 * 
 * Resolution order (based on production log evidence):
 * 1. context.installContext (ARI string) - PRIMARY
 * 2. context.installationContext (ARI string) - backup
 * 3. context.cloudId (direct) - fallback
 * 
 * Always returns tenantKey (never null if identity exists).
 * cloudId is optional and may be null.
 * 
 * @param context - Forge request context
 * @returns TenantIdentity if derivable, null otherwise
 */
export function resolveTenantIdentity(context: any): TenantIdentity | null {
  if (!context || typeof context !== 'object') {
    return null;
  }

  // Strategy 1: installContext (PRIMARY - matches production log keys)
  if (context.installContext && typeof context.installContext === 'string') {
    const tenantKey = context.installContext.trim();
    if (tenantKey.length > 0) {
      const cloudId = extractCloudIdFromAri(tenantKey);
      return {
        tenantKey,
        cloudId,
        source: 'installContext',
      };
    }
  }

  // Strategy 2: installationContext (back-compat)
  if (context.installationContext && typeof context.installationContext === 'string') {
    const tenantKey = context.installationContext.trim();
    if (tenantKey.length > 0) {
      const cloudId = extractCloudIdFromAri(tenantKey);
      return {
        tenantKey,
        cloudId,
        source: 'installationContext',
      };
    }
  }

  // Strategy 3: Direct cloudId
  if (context.cloudId && typeof context.cloudId === 'string') {
    const cloudId = context.cloudId.trim();
    if (cloudId.length > 0) {
      return {
        tenantKey: `cloudId:${cloudId}`,
        cloudId,
        source: 'cloudId',
      };
    }
  }

  // No tenant identity derivable
  return null;
}

/**
 * Extract cloudId from ARI format
 * 
 * Patterns:
 * - "ari:cloud:jira::site/<CLOUDID>"
 * - "ari:cloud:jira:site/<CLOUDID>"
 * - "/site/<CLOUDID>"
 * 
 * Returns null if no match found
 */
function extractCloudIdFromAri(ari: string): string | null {
  if (!ari || typeof ari !== 'string') {
    return null;
  }

  // Try pattern: ::site/<id> or :site/<id>
  const match1 = ari.match(/[:/]site[:/]([a-f0-9\-]+)/);
  if (match1 && match1[1]) {
    return match1[1].trim();
  }

  // Try pattern: /site/<id>
  const match2 = ari.match(/\/site\/([a-f0-9\-]+)/);
  if (match2 && match2[1]) {
    return match2[1].trim();
  }

  return null;
}

/**
 * Validate that a cloudId is safe to use
 * 
 * Rules:
 * - Must be non-empty string
 * - Must not exceed 512 characters
 * - Must not contain suspicious path traversal or injection patterns
 * 
 * @param cloudId - The cloudId to validate
 * @returns true if valid, false otherwise
 */
export function isValidCloudId(cloudId: string | null): boolean {
  if (!cloudId || typeof cloudId !== 'string') {
    return false;
  }

  if (cloudId.trim() === '') {
    return false;
  }

  if (cloudId.length > 512) {
    return false;
  }

  // Reject obvious traversal/injection patterns
  if (cloudId.includes('..') || cloudId.includes('\\')) {
    return false;
  }

  return true;
}
