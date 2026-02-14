/**
 * MILESTONE 1 ENGINE 6F: Privilege Boundary Declaration
 * 
 * Output:
 * {
 *   "privilegeBoundary": {
 *     "jiraAdmin": true|false,
 *     "orgAdmin": true|false,
 *     "accessibleScopes": [],
 *     "inaccessibleScopes": []
 *   }
 * }
 * 
 * Derived from runtime permissions and available scopes.
 * If org scope missing -> must populate inaccessibleScopes.
 */

import api from '@forge/api';
// @ts-ignore route() is exported from @forge/api but TS definitions may lag
const { route } = require('@forge/api') as typeof import('@forge/api');
import type { Snapshot, PrivilegeBoundary } from '../models';
import { canonicalizeValue } from '../canonicalize';

/**
 * Build privilege boundary from snapshot and runtime context
 */
export async function buildPrivilegeBoundaryDeclaration(
  snapshotId: string,
  createdAtUtc: string,
  buildingSnapshot: Snapshot | null
): Promise<PrivilegeBoundary> {
  try {
    let jiraAdmin = false;
    let orgAdmin = false;
    const accessibleScopes: string[] = [];
    const inaccessibleScopes: string[] = [];

    // Check Jira admin status
    try {
      const meRes = await api
        .asUser()
        .requestJira(route`/rest/api/3/myself`);
      
      if (meRes && meRes.accountType === 'atlassian') {
        // Try to determine if admin
        // Note: This is a heuristic; Jira doesn't expose admin status directly
        jiraAdmin = meRes.isAdmin === true;
      }
    } catch (err) {
      console.warn('[PrivilegeEngine] Could not check Jira admin status:', err);
    }

    // Determine available scopes
    // From app manifest: scopes are storage:app and read:jira-work
    accessibleScopes.push('read:jira-work');
    accessibleScopes.push('storage:app');

    // Scopes NOT available for Milestone 1
    inaccessibleScopes.push('write:jira-work');
    inaccessibleScopes.push('admin:jira:organization');
    inaccessibleScopes.push('manage:jira:configuration');

    // Sort arrays for determinism
    accessibleScopes.sort();
    inaccessibleScopes.sort();

    // Canonicalize
    const canonicalBoundary = canonicalizeValue({
      jiraAdmin,
      orgAdmin,
      accessibleScopes,
      inaccessibleScopes,
    });

    // If building snapshot has privilege context, use it
    if (buildingSnapshot && buildingSnapshot.privilegeContext) {
      const ctx = buildingSnapshot.privilegeContext;
      canonicalBoundary.jiraAdmin = ctx.jiraAdmin;
      canonicalBoundary.orgAdmin = ctx.orgAdmin;
    }

    const boundary: PrivilegeBoundary = {
      snapshotId,
      createdAtUtc,
      privilegeBoundary: canonicalBoundary as any,
    };

    return boundary;
  } catch (error) {
    console.error('[PrivilegeEngine] Error building privilege boundary:', error);
    throw error;
  }
}

/**
 * Validate privilege boundary declaration
 */
export function validatePrivilegeBoundary(boundary: PrivilegeBoundary): boolean {
  if (!boundary.snapshotId || !boundary.createdAtUtc || !boundary.privilegeBoundary) {
    return false;
  }

  const pb = boundary.privilegeBoundary;
  if (typeof pb.jiraAdmin !== 'boolean' ||
      typeof pb.orgAdmin !== 'boolean' ||
      !Array.isArray(pb.accessibleScopes) ||
      !Array.isArray(pb.inaccessibleScopes)) {
    return false;
  }

  // Must have some scopes
  if (pb.accessibleScopes.length === 0) {
    return false;
  }

  return true;
}
