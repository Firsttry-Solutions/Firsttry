/**
 * Migration Guard — ECL Enterprise Hardening
 *
 * If legacy storage keys from older versions are detected:
 * - Must NOT delete them
 * - Must NOT auto-migrate silently
 * - Must log: FT_ECL_MIGRATION_REQUIRED
 * - Must halt (THROW)
 *
 * // FT_ECL_ENGINE: MIGRATION_GUARD_V1
 */

// FT_ECL_ENGINE: MIGRATION_GUARD_V1

import { storage } from '@forge/api';

/**
 * Migration guard marker emitted before halting.
 */
// AUDIT-ALLOWLIST FT-ALW-05-017
export const MIGRATION_REQUIRED_MARKER = 'FT_ECL_MIGRATION_REQUIRED' as const;

/**
 * Known legacy storage keys from older versions.
 * If ANY of these are detected, migration is required.
 */
const LEGACY_STORAGE_KEYS: ReadonlyArray<string> = [
  // V0 keys (pre-ECL) — must not auto-migrate
  'FT_SNAPSHOT_CHAIN_V0',
  'FT_BASELINE_V0',
  'FT_ATTESTATION_LEDGER_V0',
  'FT_GOVERNANCE_STATE_V0',
  'FT_RISK_STATE_V0',
  // Phase 1-4 legacy keys
  'ft_governance_snapshot',
  'ft_baseline_state',
  'ft_review_ledger',
  'ft_risk_posture',
  'ft_hash_chain',
] as const;

/**
 * Check a single storage key for presence.
 * Returns true if the key exists (value is not null/undefined).
 */
async function storageKeyExists(key: string): Promise<boolean> {
  const val = await storage.get(key);
  return val !== null && val !== undefined;
}

/**
 * Run the migration guard.
 *
 * Scans for all known legacy storage keys.
 * If any are found:
 * - Logs: FT_ECL_MIGRATION_REQUIRED
 * - Lists detected legacy keys
 * - THROWS to halt execution
 *
 * Does NOT delete or migrate any data.
 *
 * Call this at the start of any engine that operates on persistent state.
 *
 * @throws {Error} if any legacy storage key is detected
 */
export async function runMigrationGuard(): Promise<void> {
  const detected: string[] = [];

  for (const key of LEGACY_STORAGE_KEYS) {
    const exists = await storageKeyExists(key);
    if (exists) {
      detected.push(key);
    }
  }

  if (detected.length > 0) {
    const message =
      `${MIGRATION_REQUIRED_MARKER}: legacy storage keys detected. ` +
      `Manual migration required before ECL-ENTERPRISE engines can operate. ` +
      `Detected keys: [${detected.join(', ')}]. ` +
      `DO NOT auto-migrate. DO NOT delete. Halt.`;

    // Log the marker explicitly — must appear in logs for detection
    console.error(`[FT_ECL_ENGINE:MIGRATION_GUARD_V1] ${message}`);

    throw new Error(
      `[FT_ECL_ENGINE:MIGRATION_GUARD_V1] FAIL-CLOSED: ${message}`
    );
  }
}

/**
 * Read-only report of migration status.
 * Does NOT throw — use for diagnostic/reporting purposes only.
 * For enforcement, use runMigrationGuard().
 */
export async function getMigrationStatus(): Promise<{
  migrationRequired: boolean;
  detectedLegacyKeys: string[];
}> {
  const detected: string[] = [];

  for (const key of LEGACY_STORAGE_KEYS) {
    const exists = await storageKeyExists(key);
    if (exists) {
      detected.push(key);
    }
  }

  return {
    migrationRequired: detected.length > 0,
    detectedLegacyKeys: detected,
  };
}

// FT_ECL_ENGINE: MIGRATION_GUARD_V1 END
