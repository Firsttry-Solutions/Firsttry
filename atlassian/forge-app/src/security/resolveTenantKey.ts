/**
 * UNIFIED TENANT KEY RESOLUTION
 * 
 * Single source of truth for all tenant identity within the application.
 * Every resolver, storage operation, and proof log MUST use this module.
 *
 * RULES:
 * - Deterministic per Jira site/installation (stable across page loads)
 * - Fails closed if required identity missing
 * - Returns both raw tenantKey and tenantKeyHash (privacy-safe for logs)
 * - NOT dependent on viewer/user account identity
 */

import * as crypto from 'crypto';

export type TenantKeyInfo = {
  tenantKey: string;
  tenantKeyHash: string;
  source: string;
};

/**
 * Resolve tenant key from Forge context.
 * 
 * Priority order:
 * 1) context.installationId (preferred if present)
 * 2) context.cloudId (fallback)
 * 3) context.siteUrl OR context.hostUrl (last resort)
 * 
 * FAILS CLOSED: throws if none available
 */
export function resolveTenantKey(context: any): TenantKeyInfo {
  if (!context) {
    throw new Error('TENANT_KEY_ERROR: context is null or undefined');
  }

  let tenantKey: string | null = null;
  let source: string = 'UNKNOWN';

  // Priority 1: installationId
  if (context.installationId && typeof context.installationId === 'string') {
    tenantKey = context.installationId;
    source = 'installationId';
  }
  // Priority 2: cloudId
  else if (context.cloudId && typeof context.cloudId === 'string') {
    tenantKey = context.cloudId;
    source = 'cloudId';
  }
  // Priority 3: siteUrl or hostUrl
  else if (context.siteUrl && typeof context.siteUrl === 'string') {
    tenantKey = context.siteUrl;
    source = 'siteUrl';
  }
  else if (context.hostUrl && typeof context.hostUrl === 'string') {
    tenantKey = context.hostUrl;
    source = 'hostUrl';
  }

  // FAIL-CLOSED: no tenant identity found
  if (!tenantKey) {
    throw new Error('TENANT_KEY_ERROR: no installationId, cloudId, siteUrl, or hostUrl in context');
  }

  // Compute tenantKeyHash: first 12 hex chars of SHA256(tenantKey)
  const hash = crypto.createHash('sha256').update(tenantKey).digest('hex');
  const tenantKeyHash = hash.substring(0, 12);

  return {
    tenantKey,
    tenantKeyHash,
    source
  };
}

/**
 * Wrapper for safe calling (returns null on error instead of throwing).
 * Use this when you want to handle errors gracefully without throwing.
 */
export function resolveTenantKeyOrNull(context: any): TenantKeyInfo | null {
  try {
    return resolveTenantKey(context);
  } catch (err) {
    console.error('[resolveTenantKey] Error:', err instanceof Error ? err.message : String(err));
    return null;
  }
}
