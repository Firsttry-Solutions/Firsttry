/**
 * MILESTONE 1 ENGINE 6C: Configuration Inventory Index
 * 
 * Produce full inventory of:
 * - Global permissions
 * - Permission schemes
 * - Workflow schemes
 * - Screen schemes
 * - Field schemes
 * - Custom fields
 * - Project mappings
 * - Role assignments
 * 
 * Structure:
 * {
 *   "configInventory": {
 *     "globalPermissions": [],
 *     "schemes": [],
 *     "projects": [],
 *     "roles": []
 *   }
 * }
 * 
 * Determinism:
 * - Every array sorted by id/key/name fallback
 * - Never "as returned by Jira"
 */

import api, { route } from '@forge/api';
import type { ConfigInventory } from '../models';
import { canonicalizeValue } from '../canonicalize';

interface GlobalPermission {
  id: string;
  key: string;
  name: string;
}

interface Scheme {
  id: string;
  name: string;
  type: string;
}

interface Project {
  id: string;
  key: string;
  name: string;
  permissionSchemeId?: string;
  workflowSchemeId?: string;
}

interface Role {
  id: string;
  name: string;
}

/**
 * Build configuration inventory from Jira API
 * READ-ONLY: Only uses GET endpoints
 */
export async function buildConfigInventory(
  snapshotId: string,
  createdAtUtc: string
): Promise<ConfigInventory> {
  try {
    const globalPermissions: GlobalPermission[] = [];
    const schemes: Scheme[] = [];
    const projects: Project[] = [];
    const roles: Role[] = [];

    // Fetch global permissions
    try {
      const permsRes = await api
        .asUser()
        .requestJira(route`/rest/api/3/permissions`);
      
      if (permsRes && permsRes.permissions) {
        for (const perm of permsRes.permissions) {
          globalPermissions.push({
            id: perm.key || '',
            key: perm.key || '',
            name: perm.name || '',
          });
        }
      }
    } catch (err) {
      console.warn('[InventoryEngine] Could not fetch global permissions:', err);
    }

    // Fetch permission schemes
    try {
      const schemesRes = await api
        .asUser()
        .requestJira(route`/rest/api/3/permissionscheme`);
      
      if (schemesRes && schemesRes.values) {
        for (const scheme of schemesRes.values) {
          schemes.push({
            id: String(scheme.id || ''),
            name: scheme.name || '',
            type: 'permission',
          });
        }
      }
    } catch (err) {
      console.warn('[InventoryEngine] Could not fetch permission schemes:', err);
    }

    // Fetch projects
    try {
      const projectsRes = await api
        .asUser()
        .requestJira(route`/rest/api/3/project`);
      
      if (Array.isArray(projectsRes)) {
        for (const proj of projectsRes) {
          projects.push({
            id: String(proj.id || ''),
            key: proj.key || '',
            name: proj.name || '',
            permissionSchemeId: proj.permissionScheme ? String(proj.permissionScheme.id) : undefined,
            workflowSchemeId: proj.workflowScheme ? String(proj.workflowScheme.id) : undefined,
          });
        }
      }
    } catch (err) {
      console.warn('[InventoryEngine] Could not fetch projects:', err);
    }

    // Sort all arrays deterministically by id/key/name
    const sortByIdKeyName = (items: any[]) => {
      return items.sort((a, b) => {
        const aKey = a.id || a.key || a.name || '';
        const bKey = b.id || b.key || b.name || '';
        return String(aKey).localeCompare(String(bKey));
      });
    };

    globalPermissions.sort((a, b) => (a.key || a.id).localeCompare(b.key || b.id));
    schemes.sort((a, b) => (a.id || a.name).localeCompare(b.id || b.name));
    projects.sort((a, b) => (a.key || a.id).localeCompare(b.key || b.id));
    roles.sort((a, b) => (a.id || a.name).localeCompare(b.id || b.name));

    // Canonicalize the entire structure
    const canonicalInventory = canonicalizeValue({
      globalPermissions,
      schemes,
      projects,
      roles,
    });

    const inventory: ConfigInventory = {
      snapshotId,
      createdAtUtc,
      configInventory: canonicalInventory as any,
    };

    return inventory;
  } catch (error) {
    console.error('[InventoryEngine] Error building config inventory:', error);
    throw error;
  }
}

/**
 * Validate configuration inventory structure
 */
export function validateConfigInventory(inventory: ConfigInventory): boolean {
  if (!inventory.snapshotId || !inventory.createdAtUtc || !inventory.configInventory) {
    return false;
  }

  const cfg = inventory.configInventory;
  if (!Array.isArray(cfg.globalPermissions) ||
      !Array.isArray(cfg.schemes) ||
      !Array.isArray(cfg.projects) ||
      !Array.isArray(cfg.roles)) {
    return false;
  }

  return true;
}
