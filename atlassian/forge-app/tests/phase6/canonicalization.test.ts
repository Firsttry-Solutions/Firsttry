/**
 * PHASE 6 v2: CANONICALIZATION TESTS
 * 
 * Tests for deterministic JSON canonicalization and SHA256 hashing.
 * 
 * Key test: Determinism
 * If you call canonicalHash(obj) twice with the same object, you always get the same hash.
 * This is essential for idempotency.
 */

import { describe, it, expect } from 'vitest';
import {
  canonicalJSON,
  computeCanonicalHash,
  verifyCanonicalHash,
  testDeterminism,
} from '../../src/phase6/canonicalization';

describe('Canonicalization: canonicalJSON', () => {
  it('should handle null', () => {
    expect(canonicalJSON(null)).toBe('null');
  });

  it('should handle booleans', () => {
    expect(canonicalJSON(true)).toBe('true');
    expect(canonicalJSON(false)).toBe('false');
  });

  it('should handle numbers', () => {
    expect(canonicalJSON(42)).toBe('42');
    expect(canonicalJSON(3.14)).toBe('3.14');
  });

  it('should handle strings with JSON escaping', () => {
    expect(canonicalJSON('hello')).toBe('"hello"');
    expect(canonicalJSON('hello"world')).toContain('\\"');
  });

  it('should sort object keys alphabetically', () => {
    const obj1 = { z: 1, a: 2, m: 3 };
    const canonical = canonicalJSON(obj1);
    
    // Check order: a comes before m comes before z
    const aIndex = canonical.indexOf('"a"');
    const mIndex = canonical.indexOf('"m"');
    const zIndex = canonical.indexOf('"z"');
    
    expect(aIndex).toBeLessThan(mIndex);
    expect(mIndex).toBeLessThan(zIndex);
  });

  it('should handle arrays', () => {
    const arr = [1, 2, 3];
    const canonical = canonicalJSON(arr);
    expect(canonical).toBe('[1,2,3]');
  });

  it('should produce minified output (no spaces)', () => {
    const obj = { a: 1, b: 2 };
    const canonical = canonicalJSON(obj);
    expect(canonical).not.toContain(' ');
  });

  it('should produce same output for equivalent objects with different key order', () => {
    const obj1 = { a: 1, b: 2, c: 3 };
    const obj2 = { c: 3, a: 1, b: 2 };
    
    expect(canonicalJSON(obj1)).toBe(canonicalJSON(obj2));
  });

  it('should handle nested objects', () => {
    const obj = {
      level1: {
        level2: {
          value: 42,
        },
      },
    };
    
    const canonical = canonicalJSON(obj);
    expect(canonical).toContain('level1');
    expect(canonical).toContain('level2');
  });

  it('should handle mixed types', () => {
    const obj = {
      string: 'hello',
      number: 42,
      boolean: true,
      null: null,
      array: [1, 2, 3],
      nested: { key: 'value' },
    };
    
    const canonical = canonicalJSON(obj);
    expect(canonical).toContain('"string"');
    expect(canonical).toContain('"hello"');
  });
});

describe('Canonicalization: Determinism', () => {
  it('should produce same hash for same object (determinism test)', () => {
    const obj = {
      projects: [
        { id: 'PROJ1', name: 'Project 1' },
        { id: 'PROJ2', name: 'Project 2' },
      ],
      fields: [
        { id: 'field1', name: 'Field 1' },
      ],
    };

    const result = testDeterminism(obj);
    expect(result.isDeterministic).toBe(true);
    expect(result.hash1).toBe(result.hash2);
  });

  it('should produce same hash when object keys are reordered', () => {
    const obj1 = { a: 1, b: 2, c: 3 };
    const obj2 = { c: 3, a: 1, b: 2 };
    
    const hash1 = computeCanonicalHash(obj1);
    const hash2 = computeCanonicalHash(obj2);
    
    expect(hash1).toBe(hash2);
  });

  it('should produce different hashes for different objects', () => {
    const obj1 = { a: 1, b: 2 };
    const obj2 = { a: 1, b: 3 }; // Different value
    
    const hash1 = computeCanonicalHash(obj1);
    const hash2 = computeCanonicalHash(obj2);
    
    expect(hash1).not.toBe(hash2);
  });

  it('should produce same hash for snapshots captured at same instant', () => {
    const payload1 = {
      projects: ['PROJ1', 'PROJ2'],
      fields: ['field1', 'field2'],
      workflows: ['workflow1'],
    };

    const payload2 = {
      projects: ['PROJ1', 'PROJ2'],
      fields: ['field1', 'field2'],
      workflows: ['workflow1'],
    };

    expect(computeCanonicalHash(payload1)).toBe(computeCanonicalHash(payload2));
  });

  it('should handle large objects deterministically', () => {
    const largeObj = {
      items: Array.from({ length: 100 }, (_, i) => ({
        id: `item${i}`,
        value: i * 2,
        nested: {
          field1: `value${i}`,
          field2: i % 2 === 0,
        },
      })),
    };

    const result = testDeterminism(largeObj);
    expect(result.isDeterministic).toBe(true);
  });
});

describe('Canonicalization: Hash Verification', () => {
  it('should verify correct hash', () => {
    const obj = { a: 1, b: 2 };
    const hash = computeCanonicalHash(obj);
    
    expect(verifyCanonicalHash(obj, hash)).toBe(true);
  });

  it('should reject incorrect hash', () => {
    const obj = { a: 1, b: 2 };
    const wrongHash = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    
    expect(verifyCanonicalHash(obj, wrongHash)).toBe(false);
  });

  it('should reject modified object', () => {
    const obj1 = { a: 1, b: 2 };
    const hash = computeCanonicalHash(obj1);
    
    const obj2 = { a: 1, b: 3 }; // Modified
    expect(verifyCanonicalHash(obj2, hash)).toBe(false);
  });

  it('should verify hash of modified object with new hash', () => {
    const obj1 = { a: 1, b: 2 };
    const hash1 = computeCanonicalHash(obj1);
    
    const obj2 = { a: 1, b: 2 }; // Same values
    expect(verifyCanonicalHash(obj2, hash1)).toBe(true);
  });
});

describe('Canonicalization: Edge Cases', () => {
  it('should handle empty objects', () => {
    const obj = {};
    const hash = computeCanonicalHash(obj);
    
    expect(hash).toBeDefined();
    expect(hash.length).toBe(64); // SHA256 hex is 64 chars
  });

  it('should handle empty arrays', () => {
    const obj = { items: [] };
    const hash = computeCanonicalHash(obj);
    
    expect(hash).toBeDefined();
    expect(hash.length).toBe(64);
  });

  it('should handle arrays with null elements', () => {
    const obj = { items: [1, null, 3] };
    const canonical = canonicalJSON(obj);
    
    expect(canonical).toContain('null');
  });

  it('should handle special JSON characters', () => {
    const obj = {
      text: 'Line1\nLine2\tTab',
      path: 'C:\\Users\\name',
    };
    
    const hash = computeCanonicalHash(obj);
    expect(hash).toBeDefined();
    expect(hash.length).toBe(64);
  });

  it('should handle very large numbers', () => {
    const obj = { big: 9007199254740991 }; // MAX_SAFE_INTEGER
    const hash = computeCanonicalHash(obj);
    
    expect(hash).toBeDefined();
  });

  it('should handle Unicode characters', () => {
    const obj = {
      emoji: '🚀',
      chinese: '中文',
      arabic: 'العربية',
    };
    
    const hash = computeCanonicalHash(obj);
    expect(hash).toBeDefined();
    expect(hash.length).toBe(64);
  });
});

describe('Canonicalization: Hash Format', () => {
  it('should produce 64-character hex string (SHA256)', () => {
    const obj = { test: 'value' };
    const hash = computeCanonicalHash(obj);
    
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should be lowercase hex', () => {
    const obj = { test: 'value' };
    const hash = computeCanonicalHash(obj);
    
    expect(hash).toBe(hash.toLowerCase());
  });
});
