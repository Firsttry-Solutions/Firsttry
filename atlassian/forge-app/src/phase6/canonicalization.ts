/**
 * PHASE 6 v2: SNAPSHOT CANONICALIZATION
 * 
 * Deterministic JSON serialization + SHA256 hashing.
 * Ensures that identical Jira state produces identical hash.
 * 
 * Rules:
 * 1. JSON keys sorted alphabetically (canonical order)
 * 2. No whitespace (minified)
 * 3. Numbers/booleans/nulls as-is
 * 4. Strings in UTF-8 (no special encoding)
 * 5. SHA256 hash of resulting string
 */

import crypto from 'crypto';

/**
 * Canonical JSON: sorted keys, no whitespace
 */
export function canonicalJSON(obj: any): string {
  if (obj === null) return 'null';
  if (obj === undefined) return 'undefined';

  const type = typeof obj;
  
  if (type === 'string') {
    return JSON.stringify(obj);
  }
  if (type === 'number' || type === 'boolean') {
    return String(obj);
  }
  if (Array.isArray(obj)) {
    const items = obj.map(item => canonicalJSON(item));
    return `[${items.join(',')}]`;
  }
  if (type === 'object') {
    const keys = Object.keys(obj).sort();
    const pairs = keys.map(key => {
      const value = canonicalJSON(obj[key]);
      return `${JSON.stringify(key)}:${value}`;
    });
    return `{${pairs.join(',')}}`;
  }

  throw new Error(`Cannot canonicalize type: ${type}`);
}

/**
 * Compute SHA256 hash of canonical JSON
 */
export function computeCanonicalHash(obj: any): string {
  const canonical = canonicalJSON(obj);
  return crypto.createHash('sha256').update(canonical, 'utf-8').digest('hex');
}

/**
 * Verify that a hash matches a payload
 */
export function verifyCanonicalHash(obj: any, expectedHash: string): boolean {
  const computedHash = computeCanonicalHash(obj);
  return computedHash === expectedHash;
}

/**
 * Test fixture: ensure determinism
 * If you call this twice with the same object, you get the same hash
 */
export function testDeterminism(obj: any): {
  hash1: string;
  hash2: string;
  isDeterministic: boolean;
} {
  const hash1 = computeCanonicalHash(obj);
  const hash2 = computeCanonicalHash(obj);
  return {
    hash1,
    hash2,
    isDeterministic: hash1 === hash2,
  };
}
