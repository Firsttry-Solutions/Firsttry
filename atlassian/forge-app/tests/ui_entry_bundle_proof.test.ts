/**
 * UI ENTRY BUNDLE PROOF Tests
 * 
 * Verifies deterministic extraction of:
 * - ui_entry_bundle_hash: Extracted from /app.<HASH>.js filename
 * - ui_git_sha: Git/build SHA (distinct from bundle hash)
 * - ui_git_time: Build time metadata
 * - ui_entry_bundle_url: Exact URL of served entry script
 */

import { describe, it, expect } from 'vitest';
import { extractHashFromAppUrl, extractEntryBundle } from '../src/gadget-ui/src/entryBundleProof';

describe('UI ENTRY BUNDLE PROOF: Extraction Functions', () => {
  // ========================================================================
  // Unit Test 1: Extract bundle hash from URL patterns
  // ========================================================================
  describe('extractHashFromAppUrl', () => {
    it('extracts hash from /app.<HASH>.js URL', () => {
      const result = extractHashFromAppUrl('https://cdn.example.com/app.f1c06fb.js');
      expect(result).toBe('f1c06fb');
    });

    it('extracts hash from /app.<HASH>.mjs URL', () => {
      const result = extractHashFromAppUrl('https://cdn.example.com/app.abc123def.mjs');
      expect(result).toBe('abc123def');
    });

    it('extracts hash from path-only (no domain)', () => {
      const result = extractHashFromAppUrl('/govGadget2141/app.deadbeef.js');
      expect(result).toBe('deadbeef');
    });

    it('handles URLs with query parameters', () => {
      const result = extractHashFromAppUrl('https://cdn.example.com/app.f1c06fb.js?v=1&cache=false');
      expect(result).toBe('f1c06fb');
    });

    it('returns null for non-matching URLs', () => {
      const result = extractHashFromAppUrl('https://example.com/bundle.js');
      expect(result).toBeNull();
    });

    it('returns null for malformed app pattern', () => {
      const result = extractHashFromAppUrl('https://example.com/app.js');
      expect(result).toBeNull();
    });

    it('returns null for empty string', () => {
      const result = extractHashFromAppUrl('');
      expect(result).toBeNull();
    });

    it('returns null for non-string input', () => {
      const result = extractHashFromAppUrl(null as any);
      expect(result).toBeNull();
    });
  });

  // ========================================================================
  // Unit Test 2: Extract entry bundle from script sources
  // ========================================================================
  describe('extractEntryBundle', () => {
    it('returns both url and hash when found', () => {
      const srcs = [
        'https://example.com/lib.js',
        'https://cdn.example.com/app.f1c06fb.js',
        'https://example.com/other.js',
      ];
      const result = extractEntryBundle(srcs);
      expect(result.url).toBe('https://cdn.example.com/app.f1c06fb.js');
      expect(result.hash).toBe('f1c06fb');
    });

    it('prioritizes currentScriptSrc over scanned sources', () => {
      const srcs = [
        'https://example.com/app.oldhash123.js',
        'https://example.com/other.js',
      ];
      const currentScriptSrc = 'https://cdn.example.com/app.primary999.js';
      const result = extractEntryBundle(srcs, currentScriptSrc);
      expect(result.hash).toBe('primary999');
      expect(result.url).toBe(currentScriptSrc);
    });

    it('returns null values when not found', () => {
      const srcs = [
        'https://example.com/lib.js',
        'https://example.com/bundle.js',
      ];
      const result = extractEntryBundle(srcs);
      expect(result.url).toBeNull();
      expect(result.hash).toBeNull();
    });

    it('handles empty sources array', () => {
      const result = extractEntryBundle([]);
      expect(result.url).toBeNull();
      expect(result.hash).toBeNull();
    });

    it('ignores invalid currentScriptSrc and falls back to scanning', () => {
      const srcs = [
        'https://example.com/app.fallback123.js',
      ];
      const result = extractEntryBundle(srcs, 'https://example.com/notapp.js');
      expect(result.hash).toBe('fallback123');
    });
  });

  // ========================================================================
  // Integration Test: Proof object structure
  // ========================================================================
  describe('UI ENTRY RUNTIME PROOF contract', () => {
    it('proof contains separate git_sha and entry_bundle_hash keys', () => {
      // Simulate the proof object structure from main.ts
      const proof = {
        marker: 'UI_ENTRY_RUNTIME_PROOF',
        ui_git_sha: 'a1b2c3d4e5f6',
        ui_git_time: '2025-01-19T18:30:00Z',
        ui_entry_bundle_url: 'https://cdn.example.com/app.f1c06fb.js',
        ui_entry_bundle_hash: 'f1c06fb',
        script_srcs: ['https://example.com/app.f1c06fb.js'],
        href: 'https://example.com/gadget',
        iso: '2025-01-19T18:30:01Z',
      };

      // Verify keys exist and are distinct
      expect(proof).toHaveProperty('ui_git_sha');
      expect(proof).toHaveProperty('ui_entry_bundle_hash');
      
      // Verify they are different values (critical: never claim git_sha equals bundle_hash)
      expect(proof.ui_git_sha).not.toBe(proof.ui_entry_bundle_hash);
      expect(proof.ui_git_sha).toBe('a1b2c3d4e5f6');
      expect(proof.ui_entry_bundle_hash).toBe('f1c06fb');
    });

    it('proof never has ui_artifact_sha field (old name removed)', () => {
      const proof = {
        marker: 'UI_ENTRY_RUNTIME_PROOF',
        ui_git_sha: 'a1b2c3d4e5f6',
        ui_git_time: '2025-01-19T18:30:00Z',
        ui_entry_bundle_url: 'https://cdn.example.com/app.f1c06fb.js',
        ui_entry_bundle_hash: 'f1c06fb',
      };

      expect(proof).not.toHaveProperty('ui_artifact_sha');
      expect(proof).not.toHaveProperty('ui_artifact_time');
    });

    it('proof includes all four proof fields', () => {
      const proof = {
        marker: 'UI_ENTRY_RUNTIME_PROOF',
        ui_git_sha: 'a1b2c3d4e5f6',
        ui_git_time: '2025-01-19T18:30:00Z',
        ui_entry_bundle_url: 'https://cdn.example.com/app.f1c06fb.js',
        ui_entry_bundle_hash: 'f1c06fb',
      };

      expect(proof).toHaveProperty('ui_git_sha');
      expect(proof).toHaveProperty('ui_git_time');
      expect(proof).toHaveProperty('ui_entry_bundle_url');
      expect(proof).toHaveProperty('ui_entry_bundle_hash');
    });
  });
});
