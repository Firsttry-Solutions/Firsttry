/**
 * Canonical JSON Engine — ECL Enterprise Hardening
 *
 * Produces deterministic, stable JSON serialization for all hashing operations.
 * All engines MUST use canonicalStringify. Direct JSON.stringify is FORBIDDEN.
 *
 * Rules:
 * - Keys sorted ASCII ascending (recursive)
 * - Array order preserved (arrays are ordered by definition)
 * - undefined values: THROW (non-JSON-safe)
 * - Date objects: THROW (must be ISO strings, not Date instances)
 * - Functions: THROW
 * - Non-finite numbers: THROW
 * - Circular references: THROW
 *
 * // FT_ECL_CORE: CANONICAL_JSON_V1
 */

// FT_ECL_CORE: CANONICAL_JSON_V1

/**
 * Canonical deterministic JSON serialization.
 * All hashing operations MUST use this function.
 *
 * @throws {Error} if value contains undefined, Date, Function, non-finite number, or circular reference.
 */
export function canonicalStringify(obj: unknown, _seen?: Set<unknown>): string {
  const seen = _seen ?? new Set<unknown>();

  if (obj === null) {
    return 'null';
  }

  if (obj === undefined) {
    throw new Error(
      '[FT_ECL_CORE:CANONICAL_JSON_V1] FAIL-CLOSED: undefined value is not JSON-safe'
    );
  }

  if (obj instanceof Date) {
    throw new Error(
      '[FT_ECL_CORE:CANONICAL_JSON_V1] FAIL-CLOSED: Date objects must be converted to ISO strings before serialization'
    );
  }

  if (typeof obj === 'function') {
    throw new Error(
      '[FT_ECL_CORE:CANONICAL_JSON_V1] FAIL-CLOSED: functions are not JSON-safe'
    );
  }

  if (typeof obj === 'boolean') {
    return obj ? 'true' : 'false';
  }

  if (typeof obj === 'number') {
    if (!Number.isFinite(obj)) {
      throw new Error(
        '[FT_ECL_CORE:CANONICAL_JSON_V1] FAIL-CLOSED: non-finite number (NaN/Infinity) is not JSON-safe'
      );
    }
    // Normalize -0 → 0
    if (Object.is(obj, -0)) return '0';
    return String(obj);
  }

  if (typeof obj === 'string') {
    return JSON.stringify(obj);
  }

  if (typeof obj === 'bigint') {
    throw new Error(
      '[FT_ECL_CORE:CANONICAL_JSON_V1] FAIL-CLOSED: BigInt is not JSON-safe'
    );
  }

  if (typeof obj === 'symbol') {
    throw new Error(
      '[FT_ECL_CORE:CANONICAL_JSON_V1] FAIL-CLOSED: Symbol is not JSON-safe'
    );
  }

  if (typeof obj === 'object') {
    // Circular reference guard
    if (seen.has(obj)) {
      throw new Error(
        '[FT_ECL_CORE:CANONICAL_JSON_V1] FAIL-CLOSED: circular reference detected'
      );
    }
    seen.add(obj);

    if (Array.isArray(obj)) {
      const items = (obj as unknown[]).map((item) => {
        if (item === undefined) {
          throw new Error(
            '[FT_ECL_CORE:CANONICAL_JSON_V1] FAIL-CLOSED: undefined in array is not JSON-safe'
          );
        }
        return canonicalStringify(item, seen);
      });
      seen.delete(obj);
      return '[' + items.join(',') + ']';
    }

    // Plain object: sort keys ASCII ascending
    const record = obj as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    const pairs = keys.map((key) => {
      const val = record[key];
      if (val === undefined) {
        throw new Error(
          `[FT_ECL_CORE:CANONICAL_JSON_V1] FAIL-CLOSED: undefined value for key "${key}" is not JSON-safe`
        );
      }
      return JSON.stringify(key) + ':' + canonicalStringify(val, seen);
    });
    seen.delete(obj);
    return '{' + pairs.join(',') + '}';
  }

  throw new Error(
    `[FT_ECL_CORE:CANONICAL_JSON_V1] FAIL-CLOSED: unsupported type "${typeof obj}"`
  );
}

// FT_ECL_CORE: CANONICAL_JSON_V1 END
