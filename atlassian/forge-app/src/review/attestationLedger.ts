/**
 * Attestation Ledger — ECL Enterprise Hardening
 *
 * Append-only attestation ledger for governance review cycles.
 * Once sealed, the ledger is frozen. Any mutation attempt THROWS.
 *
 * Storage key: FT_ATTESTATION_LEDGER_V1
 *
 * Rules:
 * - Each attestation includes a deterministic attestationHash
 * - Ledger is append-only
 * - Seal hash = SHA256(canonicalStringify({ attestations: allAttestations, snapshotHash }))
 * - Once sealed → freeze ledger; any further append THROWS
 *
 * // FT_ECL_ENGINE: ATTESTATION_LEDGER_V1
 */

// FT_ECL_ENGINE: ATTESTATION_LEDGER_V1

import { storage } from '@forge/api';
import * as crypto from 'crypto';
import { canonicalStringify } from '../utils/canonicalJson';

/** Forge storage key for the attestation ledger */
export const ATTESTATION_LEDGER_STORAGE_KEY = 'FT_ATTESTATION_LEDGER_V1' as const;
const LEDGER_GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000' as const;

/**
 * A single attestation record.
 */
export interface AttestationRecord {
  readonly attestationId: string;    // Unique identifier for this attestation
  readonly attestedBy: string;       // Accountid/role of attester
  readonly attestedUtc: string;      // ISO 8601 timestamp
  readonly scope: string;            // What was attested (e.g., 'snapshot', 'review', 'drift')
  readonly snapshotHash: string;     // SHA-256 of the snapshot this attestation covers
  readonly notes: string;            // Free-text notes (may be empty string, not undefined)
  readonly attestationHash: string;  // SHA-256(canonicalStringify({ attestedBy, attestedUtc, scope, snapshotHash, notes }))
}

export type LedgerBlockMaterial = {
  index: number;
  prevHash: string;
  payloadHash: string;
  entryHash: string;
};

/**
 * Persisted ledger state.
 */
interface LedgerState {
  readonly attestations: AttestationRecord[];
  readonly sealed: boolean;
  readonly sealHash: string | null;   // null if not yet sealed
  readonly sealedUtc: string | null;  // null if not yet sealed
}

/**
 * Compute SHA-256 of a canonical JSON representation.
 */
function sha256Hex(obj: unknown): string {
  const canonical = canonicalStringify(obj);
  return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
}

function sha256Text(input: string): string {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

/**
 * Compute the deterministic attestation hash for a new attestation.
 */
function computeAttestationHash(params: {
  attestedBy: string;
  attestedUtc: string;
  scope: string;
  snapshotHash: string;
  notes: string;
}): string {
  return sha256Hex({
    attestedBy: params.attestedBy,
    attestedUtc: params.attestedUtc,
    notes: params.notes,
    scope: params.scope,
    snapshotHash: params.snapshotHash,
  });
}

/**
 * Load ledger from Forge storage.
 */
async function loadLedger(): Promise<LedgerState> {
  const raw = await storage.get(ATTESTATION_LEDGER_STORAGE_KEY);
  if (raw === undefined || raw === null) {
    return { attestations: [], sealed: false, sealHash: null, sealedUtc: null };
  }
  return raw as LedgerState;
}

/**
 * Persist ledger to Forge storage.
 */
async function saveLedger(state: LedgerState): Promise<void> {
  await storage.set(ATTESTATION_LEDGER_STORAGE_KEY, state);
}

/**
 * Append a new attestation to the ledger.
 *
 * @throws {Error} if ledger is already sealed (frozen)
 * @throws {Error} if any required field is missing
 */
export async function appendAttestation(params: {
  attestationId: string;
  attestedBy: string;
  attestedUtc: string;
  scope: string;
  snapshotHash: string;
  notes: string;
}): Promise<AttestationRecord> {
  const { attestationId, attestedBy, attestedUtc, scope, snapshotHash, notes } = params;

  // Validate all required fields
  for (const [key, val] of Object.entries({ attestationId, attestedBy, attestedUtc, scope, snapshotHash })) {
    if (typeof val !== 'string' || val.length === 0) {
      throw new Error(
        `[FT_ECL_ENGINE:ATTESTATION_LEDGER_V1] FAIL-CLOSED: required field "${key}" must be a non-empty string`
      );
    }
  }
  if (typeof notes !== 'string') {
    throw new Error(
      '[FT_ECL_ENGINE:ATTESTATION_LEDGER_V1] FAIL-CLOSED: notes must be a string (may be empty but not undefined)'
    );
  }

  const ledger = await loadLedger();

  // FAIL-CLOSED: sealed ledger is frozen
  if (ledger.sealed) {
    throw new Error(
      '[FT_ECL_ENGINE:ATTESTATION_LEDGER_V1] FAIL-CLOSED: attempt to modify a sealed review ledger is forbidden'
    );
  }

  const attestationHash = computeAttestationHash({ attestedBy, attestedUtc, scope, snapshotHash, notes });

  const record: AttestationRecord = {
    attestationId,
    attestedBy,
    attestedUtc,
    scope,
    snapshotHash,
    notes,
    attestationHash,
  };

  const updated: LedgerState = {
    attestations: [...ledger.attestations, record],
    sealed: false,
    sealHash: null,
    sealedUtc: null,
  };

  await saveLedger(updated);
  return record;
}

/**
 * Seal the attestation ledger.
 * Seal hash = SHA256(canonicalStringify({ attestations, snapshotHash }))
 * Once sealed, no further modifications are allowed.
 *
 * @param snapshotHash - The snapshot hash that this seal covers
 * @param sealedUtc - ISO 8601 timestamp
 * @returns The seal hash
 * @throws {Error} if already sealed
 * @throws {Error} if ledger is empty (nothing to seal)
 */
export async function sealLedger(snapshotHash: string, sealedUtc: string): Promise<string> {
  if (typeof snapshotHash !== 'string' || snapshotHash.length === 0) {
    throw new Error(
      '[FT_ECL_ENGINE:ATTESTATION_LEDGER_V1] FAIL-CLOSED: snapshotHash must be a non-empty string'
    );
  }
  if (typeof sealedUtc !== 'string' || sealedUtc.length === 0) {
    throw new Error(
      '[FT_ECL_ENGINE:ATTESTATION_LEDGER_V1] FAIL-CLOSED: sealedUtc must be a non-empty string'
    );
  }

  const ledger = await loadLedger();

  if (ledger.sealed) {
    throw new Error(
      '[FT_ECL_ENGINE:ATTESTATION_LEDGER_V1] FAIL-CLOSED: attempt to re-seal an already-sealed ledger'
    );
  }

  if (ledger.attestations.length === 0) {
    throw new Error(
      '[FT_ECL_ENGINE:ATTESTATION_LEDGER_V1] FAIL-CLOSED: cannot seal empty ledger — no attestations present'
    );
  }

  const sealHash = sha256Hex({ attestations: ledger.attestations, snapshotHash });

  const sealed: LedgerState = {
    attestations: ledger.attestations,
    sealed: true,
    sealHash,
    sealedUtc,
  };

  await saveLedger(sealed);
  return sealHash;
}

/**
 * Read the current ledger state.
 */
export async function readLedger(): Promise<{
  attestations: AttestationRecord[];
  sealed: boolean;
  sealHash: string | null;
  sealedUtc: string | null;
}> {
  return loadLedger();
}

/**
 * Deterministic export material for offline verifier recompute.
 * Rule: entryHash = sha256(prevHash + payloadHash) using UTF-8 concatenation.
 */
export function toLedgerBlockMaterial(entries: ReadonlyArray<AttestationRecord>): LedgerBlockMaterial[] {
  if (!Array.isArray(entries)) {
    console.log('[FT_PROOF] LEDGER_BLOCK_MATERIAL_V1=1 len=0');
    return [];
  }

  let prevHash = LEDGER_GENESIS_HASH;
  const material: LedgerBlockMaterial[] = entries.map((entry, index) => {
    const payloadHash = typeof entry.attestationHash === 'string' ? entry.attestationHash : '';
    const entryHash = sha256Text(`${prevHash}${payloadHash}`);
    const block = {
      index,
      prevHash,
      payloadHash,
      entryHash,
    };
    prevHash = entryHash;
    return block;
  });

  console.log(`[FT_PROOF] LEDGER_BLOCK_MATERIAL_V1=1 len=${material.length}`);
  return material;
}

// FT_ECL_ENGINE: ATTESTATION_LEDGER_V1 END
