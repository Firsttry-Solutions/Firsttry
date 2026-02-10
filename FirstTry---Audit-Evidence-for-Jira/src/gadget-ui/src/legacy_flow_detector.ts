/**
 * Legacy flow detector - FAIL CLOSED
 * Prevents any legacy invoke patterns from executing in production
 * 
 * CRITICAL: After Phase 6-7 fixes:
 * - ping, ensureFirstSnapshot, getBuildInfo, getSnapshotDebug are FORBIDDEN
 * - Only ft_getDashboardState_v1 is allowed
 * - UNKNOWN and NOT_AVAILABLE strings must NOT appear in dist bundle
 * - INITIALIZING is allowed temporarily during startup
 */

export function validateNonLegacyFlow(resolverName: string): void {
  const FORBIDDEN_RESOLVERS = ['ping', 'ensureFirstSnapshot', 'getBuildInfo', 'getSnapshotDebug'];
  
  if (FORBIDDEN_RESOLVERS.includes(resolverName)) {
    throw new Error(
      `[FATAL_UI_LEGACY_RESOLVER] Attempted to invoke forbidden legacy resolver "${resolverName}". ` +
      `Only ft_getDashboardState_v1 is allowed. This indicates the UI has fallen back to legacy code paths.`
    );
  }
}

export function validateResponseNoLegacyMode(response: any): void {
  if (response && typeof response === 'object') {
    if (response.mode === 'LEGACY') {
      throw new Error(
        `[FATAL_UI_LEGACY_MODE] Response contains mode=LEGACY. ` +
        `This indicates the resolver returned a legacy response format. Only {trace, data} is allowed.`
      );
    }
    if (response.data?.mode === 'LEGACY') {
      throw new Error(
        `[FATAL_UI_LEGACY_MODE] Response.data contains mode=LEGACY. ` +
        `This indicates a legacy response structure is being used.`
      );
    }
  }
}

export function validateNoUnknownState(state: any): void {
  // CRITICAL: Only reject UNKNOWN and NOT_AVAILABLE
  // INITIALIZING is allowed as a temporary startup state
  const FORBIDDEN_STATES = ['UNKNOWN', 'NOT_AVAILABLE'];
  
  if (typeof state === 'string' && FORBIDDEN_STATES.includes(state)) {
    throw new Error(
      `[FATAL_UI_LEGACY_STATE] Attempted to render forbidden UI state "${state}". ` +
      `The UI should only render valid states from ft_getDashboardState_v1 or error panels. ` +
      `UNKNOWN and NOT_AVAILABLE must be normalized to other states before rendering.`
    );
  }
}
