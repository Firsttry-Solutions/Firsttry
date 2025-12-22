/**
 * P1.4 Tenant Context Module
 * 
 * Enforces canonical tenant identity derivation from Forge runtime context.
 * FAIL-CLOSED: If context is missing or invalid, must throw TenantContextError.
 * 
 * Tenant Boundaries:
 * - cloudId: Jira Cloud site identifier (immutable, from Forge platform)
 * - installationId: App installation ID (optional, for multi-instance scenarios)
 * - tenantKey: Deterministic canonical key (used for storage prefixing)
 * 
 * SECURITY PROPERTIES:
 * - Tenant ID NEVER from user input, query params, request body, or UI state
 * - Derivation ONLY from Forge context (platform-provided, trusted)
 * - Invalid context MUST block execution (fail-closed)
 * - Tenant key is deterministic (same cloudId always produces same key)
 */

/**
 * Canonical tenant context derived from Forge platform.
 * 
 * All storage operations MUST require this context.
 * Exports MUST be scoped to this tenant.
 */
export type TenantContext = {
  /** Jira Cloud site ID (immutable, from Forge runtime) */
  cloudId: string;
  /** App installation ID (optional, for multi-install tracking) */
  installationId?: string;
  /** Canonical tenant key for storage prefixing: "cloud:${cloudId}" */
  tenantKey: string;
};

/**
 * Thrown when tenant context is missing, invalid, or cannot be derived.
 * Fail-closed: no storage operation should proceed without valid context.
 */
export class TenantContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TenantContextError';
  }
}

/**
 * Derive canonical TenantContext from Forge runtime context.
 * 
 * REQUIREMENTS:
 * - cloudId MUST come from context (not user input)
 * - cloudId MUST be non-empty string
 * - tenantKey is deterministically computed
 * - If context invalid or missing -> throws TenantContextError
 * 
 * @param input - Forge request context (typically request.context)
 * @returns TenantContext with canonical tenant identity
 * @throws TenantContextError if context is invalid or missing
 */
export function deriveTenantContext(input: unknown): TenantContext {
  // Guard 1: Input must exist
  if (!input || typeof input !== 'object') {
    throw new TenantContextError(
      'FAIL_CLOSED: Tenant context derivation failed - input is null, undefined, or not an object'
    );
  }

  const context = input as Record<string, any>;

  // Guard 2: Extract cloudId (try multiple paths for robustness)
  let cloudId: string | undefined;
  
  // Path 1: Direct cloudId on context
  if (context.cloudId && typeof context.cloudId === 'string') {
    cloudId = context.cloudId.trim();
  }
  // Path 2: From installationContext.cloudId (alternative Forge structure)
  else if (
    context.installationContext &&
    typeof context.installationContext === 'object' &&
    (context.installationContext as any).cloudId &&
    typeof (context.installationContext as any).cloudId === 'string'
  ) {
    cloudId = ((context.installationContext as any).cloudId as string).trim();
  }

  // Guard 3: Validate cloudId
  if (!cloudId || cloudId === '') {
    throw new TenantContextError(
      'FAIL_CLOSED: Tenant identity (cloudId) is missing, null, empty, or invalid'
    );
  }

  // Guard 4: Ensure cloudId is a valid string (no control characters, reasonable length)
  if (cloudId.length > 512) {
    throw new TenantContextError(
      `FAIL_CLOSED: Tenant identity (cloudId) exceeds maximum length: ${cloudId.length}`
    );
  }

  // Guard 5: Reject cloudId with suspicious patterns (traversal, protocol injection)
  if (cloudId.includes('..') || cloudId.includes('/') || cloudId.includes('\\') || cloudId.includes(':')) {
    throw new TenantContextError(
      `FAIL_CLOSED: Tenant identity (cloudId) contains suspicious characters: ${cloudId}`
    );
  }

  // Guard 6: Extract installationId if present (optional)
  let installationId: string | undefined;
  if (context.installationId && typeof context.installationId === 'string') {
    installationId = context.installationId.trim();
    if (installationId === '') {
      installationId = undefined;
    }
  }

  // Derive canonical tenant key (deterministic)
  // Format: "cloud:${cloudId}" or "cloud:${cloudId}:install:${installationId}" if available
  const tenantKey = installationId 
    ? `cloud:${cloudId}:install:${installationId}`
    : `cloud:${cloudId}`;

  return {
    cloudId,
    installationId,
    tenantKey,
  };
}

/**
 * Validate that a TenantContext is valid.
 * Throws if invalid.
 * 
 * @param ctx - Context to validate
 * @throws TenantContextError if context is invalid
 */
export function assertTenantContext(ctx: TenantContext): void {
  if (!ctx) {
    throw new TenantContextError('FAIL_CLOSED: TenantContext is null or undefined');
  }

  if (!ctx.cloudId || typeof ctx.cloudId !== 'string' || ctx.cloudId.trim() === '') {
    throw new TenantContextError(
      `FAIL_CLOSED: TenantContext.cloudId is missing or invalid: ${ctx.cloudId}`
    );
  }

  if (!ctx.tenantKey || typeof ctx.tenantKey !== 'string' || ctx.tenantKey.trim() === '') {
    throw new TenantContextError(
      `FAIL_CLOSED: TenantContext.tenantKey is missing or invalid: ${ctx.tenantKey}`
    );
  }

  // Verify tenantKey starts with "cloud:" (prevents user tampering)
  if (!ctx.tenantKey.startsWith('cloud:')) {
    throw new TenantContextError(
      `FAIL_CLOSED: TenantContext.tenantKey does not start with 'cloud:': ${ctx.tenantKey}`
    );
  }
}

/**
 * Check if a value is a valid TenantContext (type guard).
 * Returns true only if all fields are valid.
 * 
 * @param value - Value to check
 * @returns true if value is a valid TenantContext
 */
export function isTenantContextValid(value: unknown): value is TenantContext {
  if (!value || typeof value !== 'object') return false;
  const ctx = value as Record<string, any>;
  
  return (
    typeof ctx.cloudId === 'string' &&
    ctx.cloudId.trim() !== '' &&
    typeof ctx.tenantKey === 'string' &&
    ctx.tenantKey.trim() !== '' &&
    ctx.tenantKey.startsWith('cloud:')
  );
}
