/**
 * Canonicalize: Deterministic Ordering & Serialization (PHASE 2)
 * 
 * Ensures aggregate outputs are deterministic:
 * - Object keys sorted lexicographically
 * - Arrays of objects sorted by key field, then stable tie-breakers
 * - Arrays of strings sorted
 * - Deep recursion
 */

/**
 * Deep sort object keys lexicographically
 */
function sortObjectKeys(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => sortObjectKeys(item));
  }

  // It's an object
  const sorted: any = {};
  const keys = Object.keys(obj).sort();
  for (const key of keys) {
    sorted[key] = sortObjectKeys(obj[key]);
  }
  return sorted;
}

/**
 * Sort array of objects by a key field, with stable secondary sort
 */
function sortArrayByKey(arr: any[], keyField: string): any[] {
  return arr.sort((a, b) => {
    const aVal = a[keyField];
    const bVal = b[keyField];
    if (aVal < bVal) return -1;
    if (aVal > bVal) return 1;
    // Stable secondary sort: by JSON string representation
    const aStr = JSON.stringify(sortObjectKeys(a));
    const bStr = JSON.stringify(sortObjectKeys(b));
    return aStr.localeCompare(bStr);
  });
}

/**
 * Canonicalize an object for deterministic output
 * - Sorts all object keys
 * - Sorts arrays of strings lexicographically
 * - Sorts arrays of objects by specific key fields (e.g., "repo", "gate", "profile")
 */
export function canonicalize(obj: any): any {
  // First, deep sort all keys
  let result = sortObjectKeys(obj);

  // Then, handle special array sorting
  if (typeof result === 'object' && result !== null && !Array.isArray(result)) {
    // For rollup arrays, sort by their natural key fields
    if (Array.isArray(result.by_repo)) {
      result.by_repo = sortArrayByKey(result.by_repo, 'repo');
    }
    if (Array.isArray(result.by_gate)) {
      result.by_gate = sortArrayByKey(result.by_gate, 'gate');
    }
    if (Array.isArray(result.by_profile)) {
      result.by_profile = sortArrayByKey(result.by_profile, 'profile');
    }
    if (Array.isArray(result.array_field)) {
      // For generic arrays of objects with 'repo' field, sort by repo
      result.array_field = result.array_field.map((item: any) => {
        if (typeof item === 'object' && item !== null) {
          return sortObjectKeys(item);
        }
        return item;
      }).sort((a: any, b: any) => {
        if (typeof a === 'object' && a.repo && typeof b === 'object' && b.repo) {
          return a.repo.localeCompare(b.repo);
        }
        return JSON.stringify(a).localeCompare(JSON.stringify(b));
      });
    }
    if (Array.isArray(result.missing_days)) {
      result.missing_days = result.missing_days.sort();
    }
    if (Array.isArray(result.recent_event_ids)) {
      result.recent_event_ids = result.recent_event_ids.sort();
    }
  }

  return result;
}

/**
 * Serialize to canonical JSON string (for hashing, comparison)
 */
export function canonicalizeToJSON(obj: any): string {
  return JSON.stringify(canonicalize(obj));
}

/**
 * Compute SHA256 hash of canonical JSON (for determinism proof)
 * Uses node crypto
 */
export function canonicalHash(obj: any): string {
  try {
    const crypto = require('crypto');
    const canonical = canonicalizeToJSON(obj);
    return crypto.createHash('sha256').update(canonical).digest('hex');
  } catch (e) {
    console.error('[Canonicalize] Error computing hash:', e);
    return '';
  }
}
