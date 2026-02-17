/**
 * Risk Index Calculator (Glass Box Analytics)
 * Deterministic, transparent formula for audit risk scoring
 *
 * FT_PROOF_RISK_FORMULA_VISIBLE_v1: Formula is deterministic and disclosed
 * Formula: score = max(0, 100 - (shadowAdmins*5) - (publicProjects*2) - (unresolvedDrifts*3))
 *
 * No storage, no networking, no timestamps. Input snapshot only.
 */

export interface RiskIndexResult {
  score: number;
  breakdown: {
    shadowAdmins: number;
    publicProjects: number;
    unresolvedDrifts: number;
    penalties: Record<string, number>;
  };
}

/**
 * Calculate deterministic risk index from snapshot
 * FT_PROOF_RISK_FORMULA_VISIBLE_v1: Formula publicly disclosed
 *
 * Score = max(0, 100 - penalties)
 * where penalties = (shadowAdmins * 5) + (publicProjects * 2) + (unresolvedDrifts * 3)
 */
export function calculateRiskIndex(snapshot: any): RiskIndexResult {
  console.log("[FT_PROOF_RISK_FORMULA_VISIBLE_v1]", { marker: "FT_PROOF_RISK_FORMULA_VISIBLE_v1" });

  // Extract metrics from snapshot (no external state, no networking, no storage)
  const shadowAdmins = extractShadowAdminCount(snapshot);
  const publicProjects = extractPublicProjectCount(snapshot);
  const unresolvedDrifts = extractUnresolvedDriftCount(snapshot);

  // Calculate penalties (deterministic formula)
  const penalties: Record<string, number> = {
    shadowAdmins: shadowAdmins * 5,
    publicProjects: publicProjects * 2,
    unresolvedDrifts: unresolvedDrifts * 3,
  };

  const totalPenalty = Object.values(penalties).reduce((sum, val) => sum + val, 0);
  const score = Math.max(0, 100 - totalPenalty);

  return {
    score,
    breakdown: {
      shadowAdmins,
      publicProjects,
      unresolvedDrifts,
      penalties,
    },
  };
}

/**
 * Extract shadow admin count from snapshot
 * Deterministic: based on existing snapshot fields only
 */
function extractShadowAdminCount(snapshot: any): number {
  if (!snapshot || typeof snapshot !== "object") return 0;

  // Shadow admins = users with admin role in "shadow" context
  // Deterministic count from snapshot's user/group structures
  const groups = snapshot.groups || [];
  let count = 0;

  for (const group of groups) {
    if (group.name && group.name.toLowerCase().includes("shadow")) {
      if (group.members) {
        count += group.members.length;
      }
    }
  }

  return count;
}

/**
 * Extract public project count from snapshot
 * Deterministic: based on existing snapshot fields only
 */
function extractPublicProjectCount(snapshot: any): number {
  if (!snapshot || typeof snapshot !== "object") return 0;

  const projects = snapshot.projects || [];
  let count = 0;

  for (const project of projects) {
    if (project.isPublic === true) {
      count++;
    }
  }

  return count;
}

/**
 * Extract unresolved drift count from snapshot
 * Deterministic: derived ONLY from existing snapshot diff summary fields
 * Do NOT create new drift state or fetch drift data
 */
function extractUnresolvedDriftCount(snapshot: any): number {
  if (!snapshot || typeof snapshot !== "object") return 0;

  // Unresolved drifts = existing diff summary count fields in snapshot
  // If snapshot has a diffSummary or similar field, use it
  if (snapshot.diffSummary && typeof snapshot.diffSummary === "object") {
    const unresolvedCount = snapshot.diffSummary.unresolved || 0;
    return Math.max(0, unresolvedCount);
  }

  // Fallback: no drift data in snapshot
  return 0;
}
