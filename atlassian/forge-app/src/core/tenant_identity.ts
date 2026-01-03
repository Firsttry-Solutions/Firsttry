/**
 * TENANT IDENTITY RESOLVER
 * 
 * Robustly derives cloudId from various Forge context formats.
 * Supports both direct cloudId and ARI-encoded installationContext.
 * 
 * Used by: Scheduled trigger handler for Phase5 scheduler
 */

/**
 * Resolve cloudId from Forge context using multiple strategies
 * 
 * Resolution order:
 * 1. Direct context.cloudId (string)
 * 2. context.installationContext.cloudId (string)
 * 3. Parse context.installationContext as ARI string (extract site ID)
 *    - Format: "ari:cloud:jira::site/<CLOUDID>"
 *    - Returns extracted <CLOUDID> if valid
 * 4. Return null if none above succeed
 * 
 * @param context - Forge request context (any)
 * @returns cloudId string if derivable, null otherwise
 */
export function resolveCloudId(context: any): string | null {
  if (!context || typeof context !== 'object') {
    return null;
  }

  // Strategy 1: Direct cloudId on context
  if (context.cloudId && typeof context.cloudId === 'string') {
    const id = context.cloudId.trim();
    if (id.length > 0) {
      return id;
    }
  }

  // Strategy 2: installationContext as object with cloudId property
  if (context.installationContext && typeof context.installationContext === 'object') {
    if (context.installationContext.cloudId && typeof context.installationContext.cloudId === 'string') {
      const id = context.installationContext.cloudId.trim();
      if (id.length > 0) {
        return id;
      }
    }
  }

  // Strategy 3: installationContext as ARI string
  // Format: "ari:cloud:jira::site/<CLOUDID>" or similar variants
  if (context.installationContext && typeof context.installationContext === 'string') {
    const ari = context.installationContext.trim();
    
    // Try to extract cloudId from ARI format
    // Match patterns like:
    //   "ari:cloud:jira::site/<CLOUDID>"
    //   "ari:cloud:jira:site/<CLOUDID>"
    const match = ari.match(/(?:^|\/|\/)site[:/]([a-f0-9\-]+)(?:$|\/)/);
    if (match && match[1]) {
      const id = match[1].trim();
      if (id.length > 0) {
        return id;
      }
    }

    // Alternative: if ARI ends with a UUID-like pattern after site/, extract that
    const uuidMatch = ari.match(/\/site\/([a-f0-9\-]+)$/);
    if (uuidMatch && uuidMatch[1]) {
      const id = uuidMatch[1].trim();
      if (id.length > 0) {
        return id;
      }
    }
  }

  // No cloudId derivable
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
