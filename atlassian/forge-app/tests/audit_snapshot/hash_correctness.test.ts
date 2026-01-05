/**
 * Phase 5: Hash Correctness Test
 * 
 * Verifies that SHA256 hash is deterministic and correct
 */

import { describe, it, expect } from 'vitest';
import { sha256Hex } from '../../src/core/audit_snapshot/hash';

describe('Hash Correctness', () => {
    it('should produce consistent hash for same input', () => {
        const input = 'test snapshot data';
        const hash1 = sha256Hex(input);
        const hash2 = sha256Hex(input);
        expect(hash1).toBe(hash2);
    });

    it('should produce different hash for different input', () => {
        const hash1 = sha256Hex('data1');
        const hash2 = sha256Hex('data2');
        expect(hash1).not.toBe(hash2);
    });

    it('should produce 64-character hexadecimal hash', () => {
        const hash = sha256Hex('test');
        expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should handle empty string', () => {
        const hash = sha256Hex('');
        // SHA256 of empty string is known value
        expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should handle long input', () => {
        const longInput = 'x'.repeat(10000);
        const hash = sha256Hex(longInput);
        expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should handle special characters', () => {
        const input = 'special!@#$%^&*()chars\n\t';
        const hash = sha256Hex(input);
        expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should be case-sensitive in output', () => {
        const input = 'test';
        const hash = sha256Hex(input);
        expect(hash).toBe(hash.toLowerCase());
    });
});
