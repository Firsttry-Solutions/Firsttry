/**
 * STORAGE PROOF CHECKER
 * 
 * Checks storage keys and returns deterministic proof of state (EMPTY vs EXISTS).
 * Used to verify whether expected data is present in storage.
 */

import { storage } from '@forge/api';
import type { StorageProofV1 } from '../shared/invocationEnvelope';

/**
 * Check storage keys and generate proof
 * 
 * Requirements:
 * - state: EMPTY (all keys missing), EXISTS (found any key), UNKNOWN (error occurred)
 * - proof: reproducible string like "MISSING_ALL" or "FOUND:snapshots/latest"
 * - keysChecked: list of keys that were checked
 * - errors: any errors encountered
 * 
 * @param keysToCheck Array of storage keys to check
 * @returns StorageProofV1 with state and evidence
 */
export async function checkStorageProof(args: {
  keysToCheck: string[];
}): Promise<StorageProofV1> {
  const { keysToCheck } = args;
  const checkedAtIso = new Date().toISOString();
  const errors: string[] = [];
  let foundKeys: string[] = [];

  // If no keys provided, return UNKNOWN state
  if (!keysToCheck || keysToCheck.length === 0) {
    return {
      state: 'UNKNOWN',
      checkedAtIso,
      proof: null,
      keysChecked: [],
      errors: ['No keys provided to check'],
    };
  }

  // Check each key in storage
  for (const key of keysToCheck) {
    try {
      const value = await storage.get(key);
      if (value !== null && value !== undefined) {
        foundKeys.push(key);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      errors.push(`Failed to check key "${key}": ${errorMsg}`);
    }
  }

  // Determine state based on results
  let state: 'EMPTY' | 'EXISTS' | 'UNKNOWN';
  let proof: string | null;

  if (errors.length > 0 && foundKeys.length === 0) {
    // Errors occurred and no keys found
    state = 'UNKNOWN';
    proof = errors.length === 1 ? errors[0] : `${errors.length} errors`;
  } else if (foundKeys.length > 0) {
    // Found at least one key
    state = 'EXISTS';
    proof = `FOUND:${foundKeys.join(',')}`;
  } else {
    // No keys found, no errors
    state = 'EMPTY';
    proof = 'MISSING_ALL';
  }

  return {
    state,
    checkedAtIso,
    proof,
    keysChecked: keysToCheck,
    errors,
  };
}
