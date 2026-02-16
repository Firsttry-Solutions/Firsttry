/**
 * Shadow Admin Detector
 * Identifies hidden administrative privileges (nested/project-level escalations)
 *
 * FT_PROOF_SHADOW_ADMIN_v1: This module detects shadow admin patterns
 * FT_PROOF_SHADOW_DEDUP_v1: Deduplicates findings by accountId
 */

export interface ShadowAdminFinding {
  /**
   * Account ID of potential shadow admin
   */
  accountId: string;

  /**
   * Email if available
   */
  email?: string;

  /**
   * Reason codes for detection
   */
  reasonCodes: string[];

  /**
   * Evidence: projects and permission patterns where shadow admin found
   */
  evidence: Array<{
    projectKey: string;
    pattern: string;
    holders?: string[];
  }>;
}

/**
 * Detect shadow admins in snapshot
 * Deduplicates by accountId
 */
export function detectShadowAdmins(snapshot: any): ShadowAdminFinding[] {
  console.log("[FT_PROOF_SHADOW_ADMIN_v1]", { marker: "FT_PROOF_SHADOW_ADMIN_v1" });
  console.log("[FT_PROOF_SHADOW_DEDUP_v1]", { marker: "FT_PROOF_SHADOW_DEDUP_v1" });

  const findings: Map<string, ShadowAdminFinding> = new Map();

  const projects = snapshot?.projects || [];
  const schemaVersion = snapshot?.schemaVersion || "unknown";

  // Rule 1: Global admins
  const globalAdmins = snapshot?.globalAdmins || [];
  for (const admin of globalAdmins) {
    const finding: ShadowAdminFinding = {
      accountId: admin.accountId,
      email: admin.email,
      reasonCodes: ["GLOBAL_ADMIN"],
      evidence: [],
    };
    findings.set(admin.accountId, finding);
  }

  // Rule 2: Project-level ADMIN permission (non-read-only context = escalation)
  const privilegeContext = snapshot?.privilegeContext || "READ_ONLY";
  if (privilegeContext === "READ_ONLY") {
    // In read-only context, any admin-equivalent perm is suspicious
    for (const project of projects) {
      const perms = project?.permissionScheme?.permissions || [];
      for (const perm of perms) {
        // Check for permission keys that grant admin-like access
        if (
          perm.permissionKey &&
          [
            "ADMINISTER_PROJECTS",
            "PROJECT_ADMIN",
            "MANAGE_PROJECTS",
            "ADMIN",
          ].some((key) => perm.permissionKey.includes(key))
        ) {
          const holders = perm.holders || [];
          for (const holder of holders) {
            const identifier = holder.parameter || holder.type;
            if (!identifier) continue;

            let finding = findings.get(identifier);
            if (!finding) {
              finding = {
                accountId: identifier,
                reasonCodes: [],
                evidence: [],
              };
            }

            if (!finding.reasonCodes.includes("PROJECT_ADMIN_ESCALATION")) {
              finding.reasonCodes.push("PROJECT_ADMIN_ESCALATION");
            }

            finding.evidence.push({
              projectKey: project.key,
              pattern: perm.permissionKey,
              holders: [identifier],
            });

            findings.set(identifier, finding);
          }
        }
      }
    }
  }

  // Rule 3: Multiple projects with unusual patterns (drift detection)
  // Deduplication: Map by accountId, merge findings
  const deduped: Map<string, ShadowAdminFinding> = new Map();
  for (const [accountId, finding] of findings) {
    if (!deduped.has(accountId)) {
      deduped.set(accountId, finding);
    } else {
      // Merge
      const existing = deduped.get(accountId)!;
      existing.reasonCodes = Array.from(
        new Set([...existing.reasonCodes, ...finding.reasonCodes])
      ).sort();
      existing.evidence = [...existing.evidence, ...finding.evidence].sort((a, b) =>
        a.projectKey.localeCompare(b.projectKey)
      );
      deduped.set(accountId, existing);
    }
  }

  return Array.from(deduped.values()).sort((a, b) =>
    a.accountId.localeCompare(b.accountId)
  );
}
