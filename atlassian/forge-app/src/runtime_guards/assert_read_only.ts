/**
 * Pure read-only enforcement helper.
 * No import-time side effects. Safe for tests and runtime.
 */
export function assertReadOnlyRequest(method?: string): void {
  const m = (method || "GET").toUpperCase();
  const mutationMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
  if (mutationMethods.has(m)) {
    throw new Error("READ_ONLY_GUARD: Jira mutation blocked");
  }
}
