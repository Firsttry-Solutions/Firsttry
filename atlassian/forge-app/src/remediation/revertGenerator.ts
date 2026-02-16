/**
 * Revert Instruction Generator
 * Generates remediation instructions (text-only, NO mutations)
 *
 * FT_PROOF_REVERT_GENERATOR_v1: This module generates remediation instructions
 * FT_PROOF_NO_MUTATION_v1: Instructions are text-only, parsed templates, never executed
 */

import { DiffResult } from "../diff/diffEngine";
import { ShadowAdminFinding } from "../security/shadowAdminDetector";

export interface RevertInstruction {
  /**
   * Title of remediation
   */
  title: string;

  /**
   * Human-readable description
   */
  description: string;

  /**
   * JQL suggestions for bulk operations (admin copies/pastes into Jira UI)
   */
  jqlSuggestions: string[];

  /**
   * UI steps for manual remediation
   */
  adminUiSteps: string[];

  /**
   * API call templates (TEXT ONLY for documentation, never executed by app)
   */
  apiTemplates: Array<{
    method: "GET" | "POST" | "PUT" | "DELETE";
    endpoint: string;
    body?: string;
  }>;

  /**
   * Severity: "INFO" | "WARNING" | "CRITICAL"
   */
  severity: "INFO" | "WARNING" | "CRITICAL";
}

/**
 * Generate revert instructions from diff and shadow admin findings
 * NO mutations are performed; instructions are templates only
 * FT_PROOF_NO_MUTATION_v1: Confirmed - no POST/DELETE to Jira performed
 */
export function generateRevertInstructions(params: {
  diff: DiffResult;
  shadowAdmins?: ShadowAdminFinding[];
}): RevertInstruction[] {
  console.log("[FT_PROOF_REVERT_GENERATOR_v1]", {
    marker: "FT_PROOF_REVERT_GENERATOR_v1",
  });
  console.log("[FT_PROOF_NO_MUTATION_v1]", {
    marker: "FT_PROOF_NO_MUTATION_v1",
    note: "Instructions are text templates only; app does not execute mutations",
  });

  const { diff, shadowAdmins = [] } = params;
  const instructions: RevertInstruction[] = [];

  // Instruction 1: Removal of added global admins
  if (diff.addedGlobalAdmins.length > 0) {
    const accountIds = diff.addedGlobalAdmins.map((a) => a.accountId);
    instructions.push({
      title: "Remove Unwanted Global Admins",
      description: `${diff.addedGlobalAdmins.length} global admin(s) were added and should be reviewed/removed.`,
      jqlSuggestions: [
        `accountId IN (${accountIds.map((id) => `"${id}"`).join(", ")})`,
      ],
      adminUiSteps: [
        "1. Navigate to Jira > Administration > People > Global Permissions",
        "2. Review each added admin:",
        ...diff.addedGlobalAdmins.map(
          (a) =>
            `   - ${a.email || a.accountId} (ID: ${a.accountId}) [ADDED in this period]`
        ),
        "3. If unauthorized, click Remove next to their name",
        "4. Confirm removal in the dialog",
      ],
      apiTemplates: [
        {
          method: "DELETE",
          endpoint: "/rest/api/3/permissions/global/{accountId}",
          body: '{"permission": "ADMINISTER"}',
        },
      ],
      severity: "CRITICAL",
    });
  }

  // Instruction 2: Unexplained removal of authorized admins
  if (diff.removedGlobalAdmins.length > 0) {
    instructions.push({
      title: "Review Removals of Global Admins",
      description: `${diff.removedGlobalAdmins.length} global admin(s) were removed. Verify removal was authorized.`,
      jqlSuggestions: [],
      adminUiSteps: [
        "1. Review audit log for removal reason",
        ...diff.removedGlobalAdmins.map(
          (a) => `   - ${a.email || a.accountId} (removed in this period)`
        ),
        "2. If unintended, re-add the admin via Jira Administration",
      ],
      apiTemplates: [
        {
          method: "POST",
          endpoint: "/rest/api/3/permissions/global",
          body: '{"accountId": "{accountId}", "permission": "ADMINISTER"}',
        },
      ],
      severity: "WARNING",
    });
  }

  // Instruction 3: Risk escalations detected
  if (diff.riskEscalations.length > 0) {
    instructions.push({
      title: "Review Project-Level Privilege Escalations",
      description: `${diff.riskEscalations.length} project(s) have suspicious privilege grants.`,
      jqlSuggestions: [
        "PROJECT IN (" +
          diff.riskEscalations.map((r) => `"${r.projectKey}"`).join(", ") +
          ")",
      ],
      adminUiSteps: [
        "1. For each project listed below, navigate to Project Settings > Permissions",
        ...diff.riskEscalations.map((re) => `   - ${re.projectKey}: ${re.pattern}`),
        "2. Review the assigned groups/users",
        "3. Revoke if unauthorized",
      ],
      apiTemplates: [
        {
          method: "DELETE",
          endpoint: "/rest/api/3/projects/{projectKey}/permission-scheme",
        },
      ],
      severity: "WARNING",
    });
  }

  // Instruction 4: Shadow admin findings
  if (shadowAdmins.length > 0) {
    const criticalShadows = shadowAdmins.filter((s) =>
      s.reasonCodes.includes("PROJECT_ADMIN_ESCALATION")
    );
    if (criticalShadows.length > 0) {
      instructions.push({
        title: "Investigate Shadow Admin Activity",
        description: `${criticalShadows.length} account(s) have suspicious admin-like permissions outside global admin role.`,
        jqlSuggestions: [
          `accountId IN (${criticalShadows.map((s) => `"${s.accountId}"`).join(", ")})`,
        ],
        adminUiSteps: [
          "1. Navigate to Jira > Administration > Audit Log",
          "2. Filter for actions by these accounts in the past 30 days:",
          ...criticalShadows.map((s) => `   - ${s.email || s.accountId}`),
          "3. Review for unauthorized project/permission changes",
          "4. If violations found, revoke project admin role",
        ],
        apiTemplates: [
          {
            method: "GET",
            endpoint:
              "/rest/api/3/events?filter=assignee={accountId}&from={periodStartISO}",
          },
        ],
        severity: "CRITICAL",
      });
    }
  }

  // Instruction 5: Summary if no issues
  if (instructions.length === 0) {
    instructions.push({
      title: "No Remediation Required",
      description: "No administrative changes or risk escalations detected.",
      jqlSuggestions: [],
      adminUiSteps: ["No action required"],
      apiTemplates: [],
      severity: "INFO",
    });
  }

  return instructions;
}
