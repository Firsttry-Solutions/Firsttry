/**
 * BACKBONE: Single source of truth for storage state path resolution and defaults.
 * All scripts must use this module to ensure consistent, unambiguous path handling.
 * 
 * Key invariants:
 * - Relative paths always resolve to REPO_ROOT, never process.cwd()
 * - Canonical default: /workspaces/Firsttry/.auth/storageState.json
 * - All logs print FULL absolute paths, never basenames
 * - e2e/.auth is NOT a valid location; guard against accidental usage
 */

import path from 'path';

/**
 * Repository root directory
 * All relative paths resolve against this, not process.cwd()
 */
export const REPO_ROOT = '/workspaces/Firsttry';

/**
 * Canonical storage state location
 * Used as default when STORAGE_STATE env var is unset
 */
export const CANONICAL_STORAGE_STATE = '/workspaces/Firsttry/.auth/storageState.json';

/**
 * Resolve storage state path to absolute path
 * 
 * Rules:
 * 1. If input is "__NONE__" → return "__NONE__" (unauth mode)
 * 2. If input is empty/undefined/null → return CANONICAL_STORAGE_STATE
 * 3. If input is absolute → return input as-is
 * 4. If input is relative → resolve against REPO_ROOT (not cwd)
 * 
 * @param {string|null|undefined} input - STORAGE_STATE value (usually from env var)
 * @returns {string} - Absolute path or "__NONE__"
 * @throws {Error} - If resolved path points to e2e/.auth (invalid location)
 */
export function resolveStorageStatePath(input) {
  // Rule 1: __NONE__ is special (unauth mode)
  if (input === '__NONE__') {
    return '__NONE__';
  }

  // Rule 2: Empty/undefined → canonical default
  if (!input) {
    return CANONICAL_STORAGE_STATE;
  }

  // Rule 3: Absolute → keep as-is
  if (path.isAbsolute(input)) {
    return input;
  }

  // Rule 4: Relative → resolve against REPO_ROOT (not cwd)
  const resolved = path.resolve(REPO_ROOT, input);

  // Guard: Reject e2e/.auth as a valid location
  if (resolved.startsWith(path.join(REPO_ROOT, 'e2e', '.auth'))) {
    throw new Error(
      `INVALID: e2e/.auth is not a valid storage state location.\n` +
      `Use canonical: ${CANONICAL_STORAGE_STATE}\n` +
      `Got: ${resolved}`
    );
  }

  return resolved;
}

/**
 * Describe the resolution process for logging/artifacts
 * Returns non-sensitive metadata about how the path was resolved
 * 
 * @param {string|null|undefined} input - STORAGE_STATE value
 * @returns {object} - Resolution metadata
 */
export function describeResolution(input) {
  let resolved;
  let isNone = false;
  let isAbsoluteInput = false;
  let resolverUsed = 'unknown';

  try {
    if (input === '__NONE__') {
      isNone = true;
      resolved = '__NONE__';
      resolverUsed = 'none_mode';
    } else if (!input) {
      resolved = CANONICAL_STORAGE_STATE;
      resolverUsed = 'default_canonical';
    } else if (path.isAbsolute(input)) {
      isAbsoluteInput = true;
      resolved = input;
      resolverUsed = 'absolute_input';
    } else {
      isAbsoluteInput = false;
      resolved = path.resolve(REPO_ROOT, input);
      resolverUsed = 'relative_to_repo_root';

      // Check guard
      if (resolved.startsWith(path.join(REPO_ROOT, 'e2e', '.auth'))) {
        throw new Error(
          `INVALID: e2e/.auth is not a valid storage state location.\n` +
          `Use canonical: ${CANONICAL_STORAGE_STATE}\n` +
          `Got: ${resolved}`
        );
      }
    }
  } catch (err) {
    // Re-throw errors with context
    throw new Error(`Path resolution failed: ${err.message}`);
  }

  return {
    envValue: input || null,
    resolved,
    isNone,
    isAbsoluteInput,
    resolverUsed,
    repoRoot: REPO_ROOT,
    canonical: CANONICAL_STORAGE_STATE,
    cwd: process.cwd(),
  };
}
