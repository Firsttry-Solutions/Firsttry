/**
 * Canonical JSON Serialization
 * 
 * Produces deterministic, stable JSON strings by sorting all object keys lexicographically.
 * Arrays preserve insertion order. Output is UTF-8.
 */

export function toCanonicalJson(value: any): string {
  return JSON.stringify(sortObjectKeys(value));
}

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

  // Object: sort keys lexicographically
  const sorted: any = {};
  const keys = Object.keys(obj).sort();
  for (const key of keys) {
    sorted[key] = sortObjectKeys(obj[key]);
  }
  return sorted;
}
