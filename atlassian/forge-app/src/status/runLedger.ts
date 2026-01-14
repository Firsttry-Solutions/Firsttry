/**
 * Run Ledger: Append-only history of collection attempts
 * Enables 7-day failure count and root-cause audits.
 */

import { storage } from "@forge/api";
import { sanitizeKey } from "../utils/sanitizeKey";

export type RunLedgerEntry = {
  startedIso: string;
  endedIso: string;
  mode: "scheduled" | "manual" | "onload";
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
  producedEvidenceSnapshot: boolean;
  snapshotId?: string;
};

const RUN_LEDGER_PREFIX = (tenantKey: string) => `runLedger:${sanitizeKey(tenantKey)}`;

/**
 * Append a run entry to the ledger (keyed by startedIso for determinism)
 */
export async function appendRunEntry(
  tenantKey: string,
  entry: RunLedgerEntry
): Promise<void> {
  try {
    const key = `${RUN_LEDGER_PREFIX(tenantKey)}:${entry.startedIso}`;
    await storage.set(key, entry);
  } catch (err) {
    console.error(`[runLedger] Error appending entry for ${tenantKey}:`, err);
    throw err;
  }
}

/**
 * Get failure count in the last 7 days.
 * Approximation: We would need to enumerate all keys with a prefix pattern.
 * For now, we return 0 as a stub; production will need storage enumeration or a dedicated index.
 */
export async function getFailuresLast7d(tenantKey: string): Promise<number> {
  try {
    // TODO: Implement proper enumeration when Forge storage adds list API
    // For now, return 0 (will be updated in production)
    console.warn(
      `[runLedger] getFailuresLast7d not fully implemented (Forge storage lacks list API)`
    );
    return 0;
  } catch (err) {
    console.error(`[runLedger] Error in getFailuresLast7d for ${tenantKey}:`, err);
    return 0;
  }
}
