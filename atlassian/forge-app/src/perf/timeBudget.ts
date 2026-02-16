/**
 * Time Budget Enforcement (local synthetic testing)
 * Deterministic time boundary assertion for scale envelope verification
 */

export function assertWithinTimeBudget(elapsedMs: number, budgetMs: number): void {
  if (elapsedMs > budgetMs) {
    throw new Error(`TIME_BUDGET_EXCEEDED: elapsed=${elapsedMs}ms, budget=${budgetMs}ms`);
  }
}

/**
 * Synthetic scale envelope fixture generator (deterministic, no network)
 */
export function generateSyntheticScaleTestFixture(
  entityCount: number
): { entities: Array<{ id: string; type: string }> } {
  const entities: Array<{ id: string; type: string }> = [];
  for (let i = 0; i < entityCount; i++) {
    entities.push({
      id: `entity-${i.toString().padStart(6, "0")}`,
      type: i % 3 === 0 ? "USER" : i % 3 === 1 ? "GROUP" : "ROLE"
    });
  }
  return { entities };
}
