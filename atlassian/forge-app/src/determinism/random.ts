/**
 * Randomness Prevention Module
 *
 * FirstTry exports MUST be deterministic.
 * No Math.random(), no nanoid(), no randomUUID() in export paths.
 *
 * If you need a random ID:
 * - Use deterministic input-derived hash (content-addressable)
 * - Use sequence number + timestamp
 * - NEVER use randomness in filenames or hashes
 */

/**
 * Throws if called. Used as a guard to prevent accidental randomness in exports.
 *
 * @throws Always throws with marker [FT_NONDETERMINISTIC_RANDOM_USED]
 */
export function randomId(): never {
  throw new Error(
    "[FT_NONDETERMINISTIC_RANDOM_USED] Randomness forbidden in deterministic export paths. " +
    "Use content-addressable IDs (hashes) or sequence numbers instead."
  );
}

/**
 * Marks code that uses randomness (outside export).
 * For documentation only; does not enforce.
 *
 * Example:
 *   // This is OK (not in export path):
 *   markRandomnessOK("shuffle test data");
 *   const shuffled = _.shuffle(items);
 *
 * @param reason - Why randomness is acceptable here
 */
export function markRandomnessOK(reason: string): void {
  // Intentional no-op. Just for code documentation.
  void reason;
}
