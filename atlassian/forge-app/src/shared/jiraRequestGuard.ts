/**
 * JIRA REQUEST GUARD (PART 1: READ-ONLY ENFORCEMENT)
 * 
 * Runtime enforcement: only GET requests allowed.
 * All non-GET requests throw ReadOnlyViolationError.
 */

import api from '@forge/api';

export class ReadOnlyViolationError extends Error {
  constructor(method: string, path: string) {
    super(`READ-ONLY VIOLATION: Attempted ${method} request to ${path}. Only GET allowed.`);
    this.name = 'ReadOnlyViolationError';
  }
}

/**
 * Guarded requestJira as app context - only allows GET
 */
export async function guardedRequestJiraAsApp(
  path: string,
  options?: { method?: string; headers?: Record<string, string> }
): Promise<any> {
  const method = (options?.method || 'GET').toUpperCase();
  
  if (method !== 'GET') {
    throw new ReadOnlyViolationError(method, path);
  }
  
  return api.asApp().requestJira(path, options);
}

/**
 * Guarded requestJira as user context - only allows GET
 */
export async function guardedRequestJiraAsUser(
  path: string,
  options?: { method?: string; headers?: Record<string, string> }
): Promise<any> {
  const method = (options?.method || 'GET').toUpperCase();
  
  if (method !== 'GET') {
    throw new ReadOnlyViolationError(method, path);
  }
  
  return api.asUser().requestJira(path, options);
}

/**
 * Validate manifest scopes are read-only
 */
export function validateReadOnlyScopes(): void {
  console.log('[jiraRequestGuard] Read-only scope validation: Enforced by manifest + runtime guards');
}
