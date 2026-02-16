/**
 * Scope Rationale
 * Factual minimum rationale for each required scope
 */

export const SCOPE_RATIONALE: Record<string, string> = {
  "read:jira-user": "Required to identify users and their current permissions context.",
  "read:jira-work": "Required to enumerate issues, track review history, and detect drift.",
  "read:jira-project": "Required to understand project structure and access model.",
  "read:jira-configuration": "Required to audit configuration changes and permission governance.",
  "storage:app": "Required to persist governance state, snapshots, and review metadata."
};
