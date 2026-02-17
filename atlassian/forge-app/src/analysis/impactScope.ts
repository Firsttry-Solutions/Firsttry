/**
 * Impact Scope Calculator (Glass Box Analytics)
 * Deterministic analysis of permissions affected by changes
 *
 * FT_PROOF_IMPACT_SCOPE_v1: Scope calculation is transparent and deterministic
 * FT_PROOF_NO_SIMULATION_v1: No predictive simulation or forecasting
 *
 * Input: snapshot + groupId (deterministic, from snapshot state only)
 * Output: projectCount + permissionTypes (sorted, unique)
 * No networking, no storage, no external state.
 */

export interface ImpactScopeResult {
  /**
   * Number of unique projects affected
   * FT_PROOF_IMPACT_SCOPE_v1: Scope is calculated deterministically
   */
  projectCount: number;

  /**
   * Unique permission types affected (sorted)
   * Examples: "PROJECT_ADMIN", "READ", "WRITE"
   */
  permissionTypes: string[];
}

/**
 * Calculate impact scope from snapshot for a specific group
 * FT_PROOF_IMPACT_SCOPE_v1: Deterministic scope calculation
 * FT_PROOF_NO_SIMULATION_v1: Analysis only, no forecasting or prediction
 *
 * This function:
 * - Does NOT create new drift state
 * - Does NOT fetch remote data
 * - Does NOT simulate future state
 * - Only analyzes existing snapshot state
 */
export function getImpactScopeFromSnapshot(
  snapshot: any,
  groupId: string
): ImpactScopeResult {
  console.log("[FT_PROOF_IMPACT_SCOPE_v1]", { marker: "FT_PROOF_IMPACT_SCOPE_v1" });
  console.log("[FT_PROOF_NO_SIMULATION_v1]", { marker: "FT_PROOF_NO_SIMULATION_v1" });

  if (!snapshot || typeof snapshot !== "object") {
    return { projectCount: 0, permissionTypes: [] };
  }

  if (!groupId || typeof groupId !== "string") {
    return { projectCount: 0, permissionTypes: [] };
  }

  // Scan snapshot projects for permissions assigned to this group
  const projects = snapshot.projects || [];
  const affectedProjects = new Set<string>();
  const permissionTypeSet = new Set<string>();

  for (const project of projects) {
    if (!project || typeof project !== "object") continue;

    // Check project-level permissions
    const perms = project.permissionScheme?.permissions || [];

    for (const perm of perms) {
      if (!perm || typeof perm !== "object") continue;

      const holders = perm.holders || [];
      for (const holder of holders) {
        if (!holder || typeof holder !== "object") continue;

        // Match if holder parameter equals groupId
        if (holder.parameter === groupId || holder.id === groupId) {
          affectedProjects.add(project.key || project.id || "");
          const permName = perm.permission || perm.name || perm.type || "";
          if (permName) {
            permissionTypeSet.add(permName);
          }
        }
      }
    }
  }

  // Also check group-level permissions
  const groups = snapshot.groups || [];
  for (const group of groups) {
    if (!group || typeof group !== "object") continue;

    // Direct match on group ID
    if (group.id === groupId) {
      // This group exists - check its assigned permissions in projects
      const assignedProjects = group.projects || [];
      for (const projRef of assignedProjects) {
        if (projRef && (typeof projRef === "string" || projRef.key)) {
          affectedProjects.add(projRef.key || projRef);
          const permType = projRef.permission || "MEMBER";
          permissionTypeSet.add(permType);
        }
      }
    }
  }

  // Sort permission types for deterministic output
  const sortedPermissionTypes = Array.from(permissionTypeSet).sort();

  return {
    projectCount: affectedProjects.size,
    permissionTypes: sortedPermissionTypes,
  };
}

/**
 * Get all affected groups from a snapshot transition
 * Useful for batch impact analysis (no simulation)
 *
 * FT_PROOF_IMPACT_SCOPE_v1: Each group analyzed independently
 * FT_PROOF_NO_SIMULATION_v1: Actual state only, no predictions
 */
export function getGroupImpactsFromSnapshot(snapshot: any): Map<string, ImpactScopeResult> {
  console.log("[FT_PROOF_IMPACT_SCOPE_v1]", { marker: "FT_PROOF_IMPACT_SCOPE_v1" });

  const impactMap = new Map<string, ImpactScopeResult>();

  if (!snapshot || typeof snapshot !== "object") {
    return impactMap;
  }

  const groups = snapshot.groups || [];
  for (const group of groups) {
    if (group && group.id) {
      const impact = getImpactScopeFromSnapshot(snapshot, group.id);
      impactMap.set(group.id, impact);
    }
  }

  return impactMap;
}
