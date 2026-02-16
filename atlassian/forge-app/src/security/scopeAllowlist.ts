/**
 * Scope Allowlist
 * Must exactly match the current manifest scope SET (order-independent comparison)
 */

export const SCOPE_ALLOWLIST: string[] = [
  "read:jira-user",
  "read:jira-work",
  "read:jira-project",
  "read:jira-configuration",
  "storage:app"
];
