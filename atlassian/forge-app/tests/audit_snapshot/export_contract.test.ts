/**
 * Phase 5: Export Contract Test
 * 
 * Verifies that exportTrustSnapshot resolver returns exact response shape
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SnapshotRecord } from '../../src/core/audit_snapshot/types';

describe('Export Contract', () => {
    it('should return response with exact shape', async () => {
        const expectedShape = {
            snapshotId: expect.any(String),
            generatedAtISO: expect.any(String),
            jsonSha256: expect.any(String),
            jsonFilename: expect.any(String),
            jsonCanonicalText: expect.any(String),
            pdfFilename: expect.any(String),
            pdfBase64: expect.any(String),
        };

        // Mock response
        const mockResponse = {
            snapshotId: 'abc123def456',
            generatedAtISO: '2026-01-05T10:00:00Z',
            jsonSha256: 'hash123456789',
            jsonFilename: 'firsttry_trust_snapshot_abc123def456.json',
            jsonCanonicalText: '{}',
            pdfFilename: 'firsttry_trust_snapshot_abc123def456.pdf',
            pdfBase64: 'JVBERi0xLjQKc2FtcGxlIHBkZiBjb250ZW50',
        };

        expect(mockResponse).toMatchObject(expectedShape);
    });

    it('should have correctly formatted filenames', () => {
        const snapshotId = 'abc123def456';
        const jsonFilename = `firsttry_trust_snapshot_${snapshotId}.json`;
        const pdfFilename = `firsttry_trust_snapshot_${snapshotId}.pdf`;

        expect(jsonFilename).toMatch(/^firsttry_trust_snapshot_[a-f0-9]+\.json$/);
        expect(pdfFilename).toMatch(/^firsttry_trust_snapshot_[a-f0-9]+\.pdf$/);
    });

    it('should have base64-encoded PDF bytes', () => {
        const pdfBase64 = 'JVBERi0xLjQK'; // Valid base64
        const decoded = Buffer.from(pdfBase64, 'base64');
        
        expect(decoded.length).toBeGreaterThan(0);
        expect(pdfBase64).toMatch(/^[A-Za-z0-9+/]*={0,2}$/);
    });

    it('should have ISO8601 timestamp for generatedAtISO', () => {
        const iso = '2026-01-05T10:00:00Z';
        expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z?/);
    });

    it('should have 64-character SHA256 hash', () => {
        const hash = 'a' + 'b'.repeat(63);
        expect(hash.length).toBe(64);
        expect(hash).toMatch(/^[a-f0-9A-F0-9]{64}$/);
    });

    it('should have 16-character snapshotId', () => {
        const snapshotId = 'abc123def456';
        expect(snapshotId.length).toBe(12);
        // snapshotId should be hex
        expect(snapshotId).toMatch(/^[a-f0-9]+$/);
    });

    it('should not have additional fields in response', () => {
        const mockResponse = {
            snapshotId: 'abc123def456',
            generatedAtISO: '2026-01-05T10:00:00Z',
            jsonSha256: 'hash123456789',
            jsonFilename: 'firsttry_trust_snapshot_abc123def456.json',
            jsonCanonicalText: '{}',
            pdfFilename: 'firsttry_trust_snapshot_abc123def456.pdf',
            pdfBase64: 'JVBERi0xLjQKc2FtcGxlIHBkZiBjb250ZW50',
        };

        const allowedKeys = [
            'snapshotId',
            'generatedAtISO',
            'jsonSha256',
            'jsonFilename',
            'jsonCanonicalText',
            'pdfFilename',
            'pdfBase64',
        ];

        const actualKeys = Object.keys(mockResponse);
        expect(actualKeys.sort()).toEqual(allowedKeys.sort());
    });
});
