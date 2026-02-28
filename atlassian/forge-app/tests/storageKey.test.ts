/**
 * Tests for central storage key builder
 * 
 * Audit Requirements:
 * - NO process.env references
 * - Deterministic output for same inputs
 * - Validation of all segments
 * - Forbidden character rejection
 */

import { describe, it, expect } from 'vitest';
import {
  sanitizeKeySegment,
  makeStorageKey,
  makeGlobalStorageKey,
} from '../src/shared/storageKey';

describe('sanitizeKeySegment', () => {
  it('should accept valid alphanumeric segments', () => {
    expect(sanitizeKeySegment('metrics123')).toBe('metrics123');
    expect(sanitizeKeySegment('user-data')).toBe('user-data');
    expect(sanitizeKeySegment('config_v2')).toBe('config_v2');
    expect(sanitizeKeySegment('service.name')).toBe('service.name');
  });

  it('should trim whitespace', () => {
    expect(sanitizeKeySegment('  metrics  ')).toBe('metrics');
    expect(sanitizeKeySegment('\tdata\n')).toBe('data');
  });

  it('should reject empty segments', () => {
    expect(() => sanitizeKeySegment('')).toThrow('FT_STORAGE_KEY_EMPTY');
    expect(() => sanitizeKeySegment('  ')).toThrow('FT_STORAGE_KEY_EMPTY');
  });

  it('should reject non-string segments', () => {
    expect(() => sanitizeKeySegment(null as any)).toThrow('FT_STORAGE_KEY_INVALID_TYPE');
    expect(() => sanitizeKeySegment(undefined as any)).toThrow('FT_STORAGE_KEY_INVALID_TYPE');
    expect(() => sanitizeKeySegment(123 as any)).toThrow('FT_STORAGE_KEY_INVALID_TYPE');
    expect(() => sanitizeKeySegment({} as any)).toThrow('FT_STORAGE_KEY_INVALID_TYPE');
  });

  it('should reject forbidden characters', () => {
    // Spaces
    expect(() => sanitizeKeySegment('has space')).toThrow('FT_STORAGE_KEY_INVALID_CHARS');
    
    // Colons (reserved for separator)
    expect(() => sanitizeKeySegment('has:colon')).toThrow('FT_STORAGE_KEY_INVALID_CHARS');
    
    // Slashes
    expect(() => sanitizeKeySegment('has/slash')).toThrow('FT_STORAGE_KEY_INVALID_CHARS');
    expect(() => sanitizeKeySegment('has\\backslash')).toThrow('FT_STORAGE_KEY_INVALID_CHARS');
    
    // Special chars
    expect(() => sanitizeKeySegment('has@symbol')).toThrow('FT_STORAGE_KEY_INVALID_CHARS');
    expect(() => sanitizeKeySegment('has#hash')).toThrow('FT_STORAGE_KEY_INVALID_CHARS');
    expect(() => sanitizeKeySegment('has$dollar')).toThrow('FT_STORAGE_KEY_INVALID_CHARS');
  });

  it('should enforce maximum length', () => {
    const tooLong = 'a'.repeat(81);
    expect(() => sanitizeKeySegment(tooLong)).toThrow('FT_STORAGE_KEY_TOO_LONG');
    
    const maxLength = 'a'.repeat(80);
    expect(sanitizeKeySegment(maxLength)).toBe(maxLength);
  });
});

describe('makeStorageKey', () => {
  it('should build keys with tenant:namespace pattern', () => {
    const key = makeStorageKey('tenant123', 'metrics');
    expect(key).toBe('tenant123:metrics');
  });

  it('should append additional segments', () => {
    const key = makeStorageKey('tenant123', 'metrics', 'heartbeat', 'v1');
    expect(key).toBe('tenant123:metrics:heartbeat:v1');
  });

  it('should be deterministic (same inputs -> same output)', () => {
    const key1 = makeStorageKey('acct456', 'evidence', 'ledger', 'entry1');
    const key2 = makeStorageKey('acct456', 'evidence', 'ledger', 'entry1');
    expect(key1).toBe(key2);
  });

  it('should validate tenant key', () => {
    expect(() => makeStorageKey('', 'metrics')).toThrow('FT_STORAGE_KEY_EMPTY');
    expect(() => makeStorageKey('has space', 'metrics')).toThrow('FT_STORAGE_KEY_INVALID_CHARS');
  });

  it('should validate namespace', () => {
    expect(() => makeStorageKey('tenant123', '')).toThrow('FT_STORAGE_KEY_EMPTY');
    expect(() => makeStorageKey('tenant123', 'has:colon')).toThrow('FT_STORAGE_KEY_INVALID_CHARS');
  });

  it('should validate all segments', () => {
    expect(() => makeStorageKey('tenant123', 'metrics', 'valid', 'has space')).toThrow('FT_STORAGE_KEY_INVALID_CHARS');
  });

  it('should handle variable-length segment arrays', () => {
    expect(makeStorageKey('t1', 'ns')).toBe('t1:ns');
    expect(makeStorageKey('t1', 'ns', 's1')).toBe('t1:ns:s1');
    expect(makeStorageKey('t1', 'ns', 's1', 's2')).toBe('t1:ns:s1:s2');
    expect(makeStorageKey('t1', 'ns', 's1', 's2', 's3')).toBe('t1:ns:s1:s2:s3');
  });
});

describe('makeGlobalStorageKey', () => {
  it('should build keys with __global__ prefix', () => {
    const key = makeGlobalStorageKey('ratelimit');
    expect(key).toBe('__global__:ratelimit');
  });

  it('should append segments to global keys', () => {
    const key = makeGlobalStorageKey('ratelimit', 'api', 'counter');
    expect(key).toBe('__global__:ratelimit:api:counter');
  });

  it('should validate namespace and segments', () => {
    expect(() => makeGlobalStorageKey('')).toThrow('FT_STORAGE_KEY_EMPTY');
    expect(() => makeGlobalStorageKey('ns', 'bad segment')).toThrow('FT_STORAGE_KEY_INVALID_CHARS');
  });
});

describe('Audit compliance', () => {
  it('should NEVER reference process.env in code', () => {
    // This test ensures the storage key builder module has NO process.env references in actual code
    // (documentation/comments showing anti-patterns are OK)
    // If this test fails, it indicates a regression in audit compliance
    
    const fs = require('fs');
    const path = require('path');
    const storageKeyPath = path.join(__dirname, '../src/shared/storageKey.ts');
    const content = fs.readFileSync(storageKeyPath, 'utf-8');
    
    // Remove comments and strings to check only code
    const codeOnly = content
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
      .replace(/\/\/.*/g, '') // Remove line comments
      .replace(/'[^']*'/g, "''") // Remove single-quoted strings
      .replace(/`[^`]*`/g, "``"); // Remove template strings
    
    expect(codeOnly).not.toContain('process.env');
  });

  it('should enforce determinism (no Date.now, no Math.random)', () => {
    const fs = require('fs');
    const path = require('path');
    const storageKeyPath = path.join(__dirname, '../src/shared/storageKey.ts');
    const content = fs.readFileSync(storageKeyPath, 'utf-8');
    
    expect(content).not.toContain('Date.now');
    expect(content).not.toContain('Math.random');
    expect(content).not.toContain('crypto.randomUUID');
  });

  it('should produce identical keys across multiple calls', () => {
    const tenant = 'test-tenant';
    const namespace = 'test-namespace';
    const segments = ['seg1', 'seg2'];
    
    const keys = Array.from({ length: 100 }, () =>
      makeStorageKey(tenant, namespace, ...segments)
    );
    
    // All keys should be identical
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(1);
    expect(keys[0]).toBe('test-tenant:test-namespace:seg1:seg2');
  });
});
