/**
 * Diff Engine: Snapshot Change Detection
 * Detects administrative changes between snapshots
 *
 * FT_PROOF_DIFF_ENGINE_v1: This module compares snapshots for administrative changes
 * FT_PROOF_DIFF_FAIL_CLOSED_v1: Fails explicitly on schema mismatches
 */

export interface DiffResult {
  /**
   * Global admins added between snapshots
   */
  addedGlobalAdmins: Array<{ accountId: string; email?: string }>;

  /**
   * Global admins removed between snapshots
   */
  removedGlobalAdmins: Array<{ accountId: string; email?: string }>;

  /**
   * Risk escalations detected (nested admin patterns)
   */
  riskEscalations: Array<{
    projectKey: string;
    pattern: string;
    actors: string[];
  }>;

  /**
   * Total changed projects
   */
  changedProjectCount: number;

  /**
   * Schema version at time of comparison
   */
  schemaVersion: string;
}

/**
 * Compute diff between two snapshots
 * Fail-closed: throws on schema mismatch
 */
export function generateDiff(previousSnapshot: any, currentSnapshot: any): DiffResult {
  console.log("[FT_PROOF_DIFF_ENGINE_v1]", { marker: "FT_PROOF_DIFF_ENGINE_v1" });
  console.log("[FT_PROOF_DIFF_FAIL_CLOSED_v1]", { marker: "FT_PROOF_DIFF_FAIL_CLOSED_v1" });

  // Validate schema
  const prevSchema = previousSnapshot?.schemaVersion;
  const currSchema = currentSnapshot?.schemaVersion;

  if (prevSchema !== currSchema) {
    const msg = `Schema mismatch: prev=${prevSchema} curr=${currSchema} (FT_PROOF_DIFF_FAIL_CLOSED_v1)`;
    console.error(msg);
    throw new Error(msg);
  }

  // Validate expected array structures
  const prevAdmins = previousSnapshot?.globalAdmins;
  const currAdmins = currentSnapshot?.globalAdmins;
  const prevProjects = previousSnapshot?.projects;
  const currProjects = currentSnapshot?.projects;

  if (!Array.isArray(prevAdmins) || !Array.isArray(currAdmins)) {
    const msg = `Expected globalAdmins to be arrays (FT_PROOF_DIFF_FAIL_CLOSED_v1)`;
    console.error(msg);
    throw new Error(msg);
  }

  if (!Array.isArray(prevProjects) || !Array.isArray(currProjects)) {
    const msg = `Expected projects to be arrays (FT_PROOF_DIFF_FAIL_CLOSED_v1)`;
    console.error(msg);
    throw new Error(msg);
  }

  // Detect admin changes
  const prevAdminIds = new Set(prevAdmins.map((a) => a.accountId));
  const currAdminIds = new Set(currAdmins.map((a) => a.accountId));

  const addedGlobalAdmins = currAdmins.filter((a) => !prevAdminIds.has(a.accountId));
  const removedGlobalAdmins = prevAdmins.filter((a) => !currAdminIds.has(a.accountId));

  // Detect risk escalations in projects
  const riskEscalations: DiffResult["riskEscalations"] = [];
  const currProjectMap = new Map(
    currProjects.map((p) => [p.key, p])
  );

  for (const currProject of currProjects) {
    const prevProject = previousSnapshot.projects?.find((p: any) => p.key === currProject.key);
    if (!prevProject) continue; // New project, not a risk escalation

    // Check for privilege creep
    const prevHolders = prevProject.permissionScheme?.permissions?.flatMap((p: any) =>
      p.holders?.map((h: any) => h.parameter || h.type)
    ) || [];
    const currHolders = currProject.permissionScheme?.permissions?.flatMap((p: any) =>
      p.holders?.map((h: any) => h.parameter || h.type)
    ) || [];

    const newHolders = currHolders.filter((h) => !prevHolders.includes(h));
    if (newHolders.length > 0) {
      riskEscalations.push({
        projectKey: currProject.key,
        pattern: "privilege_expansion",
        actors: newHolders,
      });
    }
  }

  // Count changed projects
  let changedProjectCount = 0;
  for (const currProject of currProjects) {
    const prevProject = previousSnapshot.projects?.find((p: any) => p.key === currProject.key);
    if (
      !prevProject ||
      JSON.stringify(prevProject) !== JSON.stringify(currProject)
    ) {
      changedProjectCount++;
    }
  }

  return {
    addedGlobalAdmins: addedGlobalAdmins.sort((a, b) =>
      a.accountId.localeCompare(b.accountId)
    ),
    removedGlobalAdmins: removedGlobalAdmins.sort((a, b) =>
      a.accountId.localeCompare(b.accountId)
    ),
    riskEscalations: riskEscalations.sort((a, b) =>
      a.projectKey.localeCompare(b.projectKey)
    ),
    changedProjectCount,
    schemaVersion: currSchema,
  };
}
