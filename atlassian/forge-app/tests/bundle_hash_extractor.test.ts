/**
 * v7.51 Contract Tests: Bundle Hash Extractor
 *
 * Tests the pure extractBundleHash() function for:
 * - app.<hash>.js → extracts hash (7 hex), reason='APP_HASH'
 * - /index.js (Forge serving) → hash='UNAVAILABLE', reason='FORGE_INDEX_JS', NO throw
 * - no scripts → hash='UNAVAILABLE', reason='NO_MATCH', NO throw
 */

import { describe, it, expect } from 'vitest';
import { extractBundleHash, isValidBundleHash, type BundleHashExtractionResult } from '../src/gadget-ui/src/ui_identity';

// ============================================================================
// app.<hash>.js → extracted hash
// ============================================================================

describe('extractBundleHash: app.<hash>.js scripts', () => {
  it('matches app.f1c06fb.js and returns first 7 hex chars', () => {
    const result = extractBundleHash([
      'https://cdn.example.com/govGadget2141/app.f1c06fb.js',
    ]);
    expect(result.hash).toBe('f1c06fb');
    expect(result.reason).toBe('APP_HASH');
    expect(result.entryUrl).toBe('https://cdn.example.com/govGadget2141/app.f1c06fb.js');
    expect(isValidBundleHash(result.hash)).toBe(true);
  });

  it('matches longer hash and truncates to 7', () => {
    const result = extractBundleHash([
      '/app.b0cdff1a91eafdf96edaf4146349f6f9dca7a5ae.js',
    ]);
    expect(result.hash).toBe('b0cdff1');
    expect(result.reason).toBe('APP_HASH');
    expect(isValidBundleHash(result.hash)).toBe(true);
  });

  it('matches app.<hash>.mjs', () => {
    const result = extractBundleHash([
      '/assets/app.abc1234.mjs',
    ]);
    expect(result.hash).toBe('abc1234');
    expect(result.reason).toBe('APP_HASH');
  });

  it('picks first matching script', () => {
    const result = extractBundleHash([
      '/other.js',
      '/app.1234567.js',
      '/app.aaaaaaa.js',
    ]);
    expect(result.hash).toBe('1234567');
    expect(result.reason).toBe('APP_HASH');
  });
});

// ============================================================================
// /index.js (Forge serving) → UNAVAILABLE, no throw
// ============================================================================

describe('extractBundleHash: Forge index.js serving', () => {
  it('/index.js returns UNAVAILABLE with reason FORGE_INDEX_JS', () => {
    const result = extractBundleHash([
      'https://cdn.forge.atlassian.com/gadget/index.js',
    ]);
    expect(result.hash).toBe('UNAVAILABLE');
    expect(result.reason).toBe('FORGE_INDEX_JS');
    expect(result.entryUrl).toBe('https://cdn.forge.atlassian.com/gadget/index.js');
  });

  it('bare index.js returns UNAVAILABLE', () => {
    const result = extractBundleHash(['index.js']);
    expect(result.hash).toBe('UNAVAILABLE');
    expect(result.reason).toBe('FORGE_INDEX_JS');
  });

  it('does NOT throw for index.js', () => {
    expect(() => {
      extractBundleHash(['https://cdn.forge.atlassian.com/gadget/index.js']);
    }).not.toThrow();
  });

  it('prefers app.<hash>.js over index.js', () => {
    const result = extractBundleHash([
      'https://cdn.forge.atlassian.com/gadget/index.js',
      '/app.abc1234.js',
    ]);
    expect(result.hash).toBe('abc1234');
    expect(result.reason).toBe('APP_HASH');
  });
});

// ============================================================================
// No scripts → UNAVAILABLE, no throw
// ============================================================================

describe('extractBundleHash: no scripts', () => {
  it('empty array returns UNAVAILABLE with reason NO_MATCH', () => {
    const result = extractBundleHash([]);
    expect(result.hash).toBe('UNAVAILABLE');
    expect(result.reason).toBe('NO_MATCH');
    expect(result.entryUrl).toBeNull();
  });

  it('does NOT throw for empty array', () => {
    expect(() => {
      extractBundleHash([]);
    }).not.toThrow();
  });

  it('non-matching scripts return NO_MATCH', () => {
    const result = extractBundleHash([
      '/vendor.js',
      '/polyfill.js',
    ]);
    expect(result.hash).toBe('UNAVAILABLE');
    expect(result.reason).toBe('NO_MATCH');
  });

  it('does NOT throw for non-matching scripts', () => {
    expect(() => {
      extractBundleHash(['/vendor.js']);
    }).not.toThrow();
  });
});

// ============================================================================
// Return type contract
// ============================================================================

describe('extractBundleHash: return type contract', () => {
  it('always returns hash, reason, and entryUrl fields', () => {
    const cases: string[][] = [
      ['/app.abc1234.js'],
      ['/index.js'],
      [],
      ['/vendor.js'],
    ];
    for (const srcs of cases) {
      const result: BundleHashExtractionResult = extractBundleHash(srcs);
      expect(result).toHaveProperty('hash');
      expect(result).toHaveProperty('reason');
      expect(result).toHaveProperty('entryUrl');
      expect(typeof result.hash).toBe('string');
      expect(['APP_HASH', 'FORGE_INDEX_JS', 'NO_MATCH']).toContain(result.reason);
    }
  });
});
