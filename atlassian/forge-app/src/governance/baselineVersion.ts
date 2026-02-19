/**
 * Baseline Version Engine — ECL Enterprise Hardening
 *
 * Governance baseline versioning. Baseline may ONLY be set when a review
 * cycle is sealed. No overwrite without seal. Fail-closed on violation.
 *
 * Storage key: FT_BASELINE_V1
 *
 * Rules:
 * - Baseline hash must equal snapshotHash at time of seal
 * - If baseline updated without seal → THROW
 * - No overwrite: baseline version increments monotonically
 * - Version is a deterministic integer
 *
 * // FT_ECL_ENGINE: BASELINE_V1
 */

// FT_ECL_ENGINE: BASELINE_V1

import { storage } from '@forge/api';

/** Forge storage key for the baseline */
export const BASELINE_STORAGE_KEY = 'FT_BASELINE_V1' as const;

/**
 * Stored baseline record.
 */
export interface BaselineRecord {
  readonly baselineVersion: number;  // Monotonic integer, starts at 1
  readonly snapshotHash: string;     // SHA-256 of the snapshot at time of seal
  readonly sealHash: string;         // Review seal hash that authorized this baseline
  readonly sealedUtc: string;        // ISO 8601 timestamp of the review seal
  readonly setUtc: string;           // ISO 8601 timestamp of baseline creation
  readonly schemaVersion: string;
  readonly ruleSetVersion: string;
}

/**
 * Load current baseline from Forge storage.
 * Returns null if no baseline has been set.
 */
async function loadBaseline(): Promise<BaselineRecord | null> {
  const raw = await storage.get(BASELINE_STORAGE_KEY);
  if (raw === undefined || raw === null) return null;
  return raw as BaselineRecord;
}

/**
 * Set a new baseline. ONLY allowed when a review cycle is sealed.
 *
 * @param params.snapshotHash - SHA-256 of the snapshot payload at time of seal
 * @param params.sealHash - The review seal hash (proof of sealed review)
 * @param params.sealedUtc - ISO 8601 timestamp of review seal
 * @param params.setUtc - ISO 8601 timestamp of this baseline set operation
 * @param params.schemaVersion - Schema version from snapshot
 * @param params.ruleSetVersion - RuleSet version from snapshot
 * @param params.isSealed - Must be true; THROW if false (fail-closed)
 * @returns The new baseline record
 * @throws {Error} if isSealed is false, or if any field is missing
 */
export async function setBaseline(params: {
  snapshotHash: string;
  sealHash: string;
  sealedUtc: string;
  setUtc: string;
  schemaVersion: string;
  ruleSetVersion: string;
  isSealed: boolean;
}): Promise<BaselineRecord> {
  const {
    snapshotHash,
    sealHash,
    sealedUtc,
    setUtc,
    schemaVersion,
    ruleSetVersion,
    isSealed,
  } = params;

  // FAIL-CLOSED: Baseline may only be set when review is sealed
  if (!isSealed) {
    throw new Error(
      '[FT_ECL_ENGINE:BASELINE_V1] FAIL-CLOSED: baseline may only be set when a review cycle is sealed (isSealed=false)'
    );
  }

  // Validate all required fields
  for (const [key, val] of Object.entries({ snapshotHash, sealHash, sealedUtc, setUtc, schemaVersion, ruleSetVersion })) {
    if (typeof val !== 'string' || val.length === 0) {
      throw new Error(
        `[FT_ECL_ENGINE:BASELINE_V1] FAIL-CLOSED: required field "${key}" must be a non-empty string`
      );
    }
  }

  // Load existing to get version; no overwrite
  const existing = await loadBaseline();
  const baselineVersion = existing ? existing.baselineVersion + 1 : 1;

  const newBaseline: BaselineRecord = {
    baselineVersion,
    snapshotHash,
    sealHash,
    sealedUtc,
    setUtc,
    schemaVersion,
    ruleSetVersion,
  };

  await storage.set(BASELINE_STORAGE_KEY, newBaseline);
  return newBaseline;
}

/**
 * Read the current baseline.
 * Returns null if not yet set.
 */
export async function readBaseline(): Promise<BaselineRecord | null> {
  return loadBaseline();
}

/**
 * Assert that a baseline exists and return it.
 * THROW if no baseline has been set.
 *
 * @throws {Error} if baseline is missing
 */
export async function requireBaseline(): Promise<BaselineRecord> {
  const baseline = await loadBaseline();
  if (!baseline) {
    throw new Error(
      '[FT_ECL_ENGINE:BASELINE_V1] FAIL-CLOSED: no baseline set — drift engine requires a baseline to operate'
    );
  }
  return baseline;
}

// FT_ECL_ENGINE: BASELINE_V1 END
