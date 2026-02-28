/**
 * Hash Chain Engine — ECL Enterprise Hardening
 *
 * Append-only tamper-evident hash chain for governance snapshots.
 *
 * Storage key: FT_SNAPSHOT_CHAIN_V1
 *
 * Chain structure:
 *   { chain: SnapshotHashChain[], lastHash: string }
 *
 * Hash derivation:
 *   newHash = SHA256(canonicalStringify({ snapshotPayload, previousHash }))
 *
 * Rules:
 * - previousHash MUST equal stored lastHash
 * - chainIndex MUST equal previous chainIndex + 1
 * - THROW on any mismatch
 * - No in-place mutation; append-only
 *
 * // FT_ECL_ENGINE: HASH_CHAIN_V1
 */

// FT_ECL_ENGINE: HASH_CHAIN_V1

import { storage } from '@forge/api';
import * as crypto from 'crypto';
import { canonicalStringify } from '../utils/canonicalJson';
import { SnapshotPayload, validateSnapshotPayload } from './snapshotSchema';

/** Forge storage key for the hash chain */
// AUDIT-ALLOWLIST FT-ALW-05-018
export const HASH_CHAIN_STORAGE_KEY = 'FT_SNAPSHOT_CHAIN_V1' as const;

/** Genesis hash sentinel — used as previousHash for the very first entry */
// AUDIT-ALLOWLIST FT-ALW-05-019
export const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000' as const;

/**
 * Single entry in the hash chain.
 */
export interface SnapshotHashChain {
  readonly chainIndex: number;       // 0-based; monotonically increasing
  readonly snapshotHash: string;     // SHA-256 of canonicalStringify(snapshotPayload)
  readonly previousHash: string;     // Must equal the previous entry's chainHash
  readonly chainHash: string;        // SHA-256 of canonicalStringify({ snapshotPayload, previousHash })
  readonly appendedUtc: string;      // ISO 8601 timestamp of append
  readonly schemaVersion: string;
  readonly ruleSetVersion: string;
}

export type SnapshotChainBlockMaterial = {
  index: number;
  prevHash: string;
  payloadHash: string;
  blockHash: string;
};

/**
 * Persisted chain state in Forge storage.
 */
interface ChainState {
  readonly chain: SnapshotHashChain[];
  readonly lastHash: string;
}

/**
 * Compute SHA-256 of a canonical JSON string.
 * All hashing MUST go through canonicalStringify.
 */
function sha256Hex(obj: unknown): string {
  const canonical = canonicalStringify(obj);
  return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
}

function sha256Text(input: string): string {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

/**
 * Load the current chain state from Forge storage.
 * Returns null if no chain exists yet (genesis state).
 *
 * @throws {Error} if storage read fails.
 */
async function loadChainState(): Promise<ChainState | null> {
  const raw = await storage.get(HASH_CHAIN_STORAGE_KEY);
  if (raw === undefined || raw === null) return null;
  return raw as ChainState;
}

/**
 * Persist the updated chain state to Forge storage.
 *
 * @throws {Error} if storage write fails.
 */
async function saveChainState(state: ChainState): Promise<void> {
  await storage.set(HASH_CHAIN_STORAGE_KEY, state);
}

/**
 * Append a new snapshot to the hash chain.
 *
 * Algorithm:
 * 1. Load current chain state (or initialize genesis state)
 * 2. Validate snapshot payload
 * 3. Compute snapshotHash = SHA256(canonicalStringify(snapshotPayload))
 * 4. Compute chainHash = SHA256(canonicalStringify({ snapshotPayload, previousHash }))
 * 5. Assert previousHash === lastHash (THROW on mismatch)
 * 6. Assert new chainIndex === previousIndex + 1 (THROW on mismatch)
 * 7. Append entry; persist
 *
 * @param payload - Validated governance snapshot payload
 * @param appendedUtc - ISO 8601 timestamp (must be a string, not a Date)
 * @returns The new chain entry
 * @throws {Error} on any integrity violation or incomplete input
 */
export async function appendToChain(
  payload: unknown,
  appendedUtc: string
): Promise<SnapshotHashChain> {
  // Validate snapshot payload — throws on incomplete input
  validateSnapshotPayload(payload);
  const snapshotPayload = payload as SnapshotPayload;

  if (typeof appendedUtc !== 'string' || appendedUtc.length === 0) {
    throw new Error(
      '[FT_ECL_ENGINE:HASH_CHAIN_V1] FAIL-CLOSED: appendedUtc must be a non-empty ISO string'
    );
  }

  // Load current chain state
  const existing = await loadChainState();

  const previousHash = existing ? existing.lastHash : GENESIS_HASH;
  const newChainIndex = existing ? existing.chain.length : 0;

  // Compute hashes — all via canonicalStringify
  const snapshotHash = sha256Hex(snapshotPayload);
  const chainHash = sha256Hex({ previousHash, snapshotPayload });

  // Integrity assertion: previousHash must match stored lastHash
  if (existing && existing.lastHash !== previousHash) {
    throw new Error(
      `[FT_ECL_ENGINE:HASH_CHAIN_V1] FAIL-CLOSED: previousHash mismatch. ` +
      `Expected "${existing.lastHash}", got "${previousHash}"`
    );
  }

  // Integrity assertion: chainIndex must be exactly previous + 1
  const expectedIndex = existing ? existing.chain.length : 0;
  if (newChainIndex !== expectedIndex) {
    throw new Error(
      `[FT_ECL_ENGINE:HASH_CHAIN_V1] FAIL-CLOSED: chainIndex mismatch. ` +
      `Expected ${expectedIndex}, computed ${newChainIndex}`
    );
  }

  const newEntry: SnapshotHashChain = {
    chainIndex: newChainIndex,
    snapshotHash,
    previousHash,
    chainHash,
    appendedUtc,
    schemaVersion: snapshotPayload.schemaVersion,
    ruleSetVersion: snapshotPayload.ruleSetVersion,
  };

  const updatedChain: SnapshotHashChain[] = existing
    ? [...existing.chain, newEntry]
    : [newEntry];

  const newState: ChainState = {
    chain: updatedChain,
    lastHash: chainHash,
  };

  // Persist — append-only (no in-place mutation)
  await saveChainState(newState);

  return newEntry;
}

/**
 * Read the current chain state.
 * Returns null if chain is empty.
 *
 * @throws {Error} if storage read fails.
 */
export async function readChain(): Promise<ChainState | null> {
  return loadChainState();
}

/**
 * Get the last chain entry, or null if chain is empty.
 */
export async function getLastChainEntry(): Promise<SnapshotHashChain | null> {
  const state = await loadChainState();
  if (!state || state.chain.length === 0) return null;
  return state.chain[state.chain.length - 1];
}

/**
 * Deterministic export material for offline verifier recompute.
 * Rule: blockHash = sha256(prevHash + payloadHash) using UTF-8 concatenation.
 */
export function toSnapshotChainBlockMaterial(blocks: ReadonlyArray<SnapshotHashChain>): SnapshotChainBlockMaterial[] {
  if (!Array.isArray(blocks)) {
    console.log('[FT_PROOF] SNAPSHOT_BLOCK_MATERIAL_V1=1 len=0');
    return [];
  }

  const material = blocks.map((block, idx) => {
    const index = typeof block.chainIndex === 'number' ? block.chainIndex : idx;
    const prevHash = typeof block.previousHash === 'string' ? block.previousHash : GENESIS_HASH;
    const payloadHash = typeof block.snapshotHash === 'string' ? block.snapshotHash : '';
    const blockHash = sha256Text(`${prevHash}${payloadHash}`);
    return { index, prevHash, payloadHash, blockHash };
  });

  console.log(`[FT_PROOF] SNAPSHOT_BLOCK_MATERIAL_V1=1 len=${material.length}`);
  return material;
}

// FT_ECL_ENGINE: HASH_CHAIN_V1 END
