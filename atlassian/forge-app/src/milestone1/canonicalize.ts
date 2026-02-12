/**
 * MILESTONE 1: Deterministic Canonical Serializer & Hash Functions
 * 
 * Strict Implementation of Spec Section 4: DETERMINISM SPEC (NO AMBIGUITY)
 * 
 * Rules:
 * - Objects: keys sorted lexicographically (UTF-16 consistent)
 * - Arrays: sorted with explicit rules (primitives ASC, objects by composite key)
 * - No undefined values: omit undefined keys entirely
 * - UTF-8 JSON without BOM, newlines as \n
 * - Compact JSON for canonical storage (pretty printing allowed only for display)
 */

import crypto from 'crypto';

/**
 * Canonical composite key extractor for array elements
 * Priority: id > key > name > stable hash of object
 */
function getArrayElementKey(element: any): string {
  if (typeof element === 'string') return element;
  if (typeof element === 'number') return String(element);
  if (typeof element === 'boolean') return String(element);
  
  if (typeof element === 'object' && element !== null && !Array.isArray(element)) {
    if (element.id && typeof element.id === 'string' && element.id.trim()) return element.id;
    if (element.key && typeof element.key === 'string' && element.key.trim()) return element.key;
    if (element.name && typeof element.name === 'string' && element.name.trim()) return element.name;
    
    // Stable hash of the object
    return sha256Hex(JSON.stringify(element));
  }
  
  // Fallback: stringify and hash
  return sha256Hex(JSON.stringify(element));
}

/**
 * Deep canonicalization: Objects -> sorted keys, Arrays -> sorted elements
 */
export function canonicalizeValue(value: any): any {
  // Nullish values
  if (value === null || value === undefined) {
    return value;
  }
  
  // Primitives
  if (typeof value !== 'object') {
    return value;
  }
  
  // Arrays: recursively canonicalize, then sort
  if (Array.isArray(value)) {
    const canonicalized = value.map(v => canonicalizeValue(v));
    
    // Determine if elements are primitives or objects
    if (canonicalized.length === 0) return [];
    
    const firstElement = canonicalized[0];
    const isPrimitive = typeof firstElement !== 'object' || firstElement === null;
    
    if (isPrimitive) {
      // Sort primitives ascending
      return canonicalized.sort((a, b) => {
        if (a === null && b === null) return 0;
        if (a === null) return -1;
        if (b === null) return 1;
        
        const aStr = String(a);
        const bStr = String(b);
        return aStr.localeCompare(bStr);
      });
    } else {
      // Sort objects by composite key
      return canonicalized.sort((a, b) => {
        const aKey = getArrayElementKey(a);
        const bKey = getArrayElementKey(b);
        return aKey.localeCompare(bKey);
      });
    }
  }
  
  // Objects: sort keys lexicographically and recursively canonicalize
  const sorted: any = {};
  const keys = Object.keys(value).sort();
  
  for (const key of keys) {
    const val = value[key];
    // Omit undefined keys
    if (val !== undefined) {
      sorted[key] = canonicalizeValue(val);
    }
  }
  
  return sorted;
}

/**
 * SHA-256 hash function (lowercase hex output)
 */
export function sha256Hex(data: string | Buffer): string {
  const input = typeof data === 'string' ? Buffer.from(data, 'utf-8') : data;
  return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * Canonical JSON serialization (compact, no pretty-printing for hashing)
 * Returns UTF-8 JSON without BOM, \n for newlines
 */
export function canonicalJsonString(obj: any): string {
  const canonicalized = canonicalizeValue(obj);
  // Compact JSON (no spaces), UTF-8 encoding
  return JSON.stringify(canonicalized);
}

/**
 * Compute SHA-256 hash of canonical JSON representation
 * This is used for canonicalHash field in snapshots
 */
export function computeCanonicalHash(obj: any): string {
  const jsonStr = canonicalJsonString(obj);
  const bytes = Buffer.from(jsonStr, 'utf-8');
  return sha256Hex(bytes);
}

/**
 * Pretty-print canonical JSON for display (readability)
 * Does NOT change canonical hash
 */
export function canonicalJsonPretty(obj: any): string {
  const canonicalized = canonicalizeValue(obj);
  return JSON.stringify(canonicalized, null, 2);
}

/**
 * Strict determinism test: verify an object's canonical representation
 */
export function canonicalFingerprint(obj: any): string {
  return sha256Hex(canonicalJsonString(obj));
}
