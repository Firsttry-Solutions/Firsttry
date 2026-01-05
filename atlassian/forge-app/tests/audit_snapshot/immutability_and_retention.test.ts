/**
 * Phase 5: Immutability and Retention Test
 * 
 * Verifies:
 * - Records are append-only (never overwritten)
 * - Retention policy keeps max 20 snapshots
 * - SnapshotId is deterministic
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { storeSnapshotRecord, generateSnapshotId, getSnapshotIndex } from '../../src/core/audit_snapshot/storage';
import { SnapshotRecord } from '../../src/core/audit_snapshot/types';
import { storage } from '@forge/api';

// Mock storage
vi.mock('@forge/api', () => ({
    storage: {
        get: vi.fn(),
        set: vi.fn(),
    },
}));

describe('Immutability and Retention', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should generate deterministic snapshotId from ISO + hash', () => {
        const iso = '2026-01-05T10:00:00Z';
        const hash = 'abc123def456';
        
        const id1 = generateSnapshotId(iso, hash);
        const id2 = generateSnapshotId(iso, hash);

        expect(id1).toBe(id2);
        expect(id1).toMatch(/^[a-f0-9]{16}$/);
    });

    it('should generate different IDs for different inputs', () => {
        const id1 = generateSnapshotId('2026-01-05T10:00:00Z', 'hash1');
        const id2 = generateSnapshotId('2026-01-05T10:00:01Z', 'hash1');
        const id3 = generateSnapshotId('2026-01-05T10:00:00Z', 'hash2');

        expect(id1).not.toBe(id2);
        expect(id1).not.toBe(id3);
        expect(id2).not.toBe(id3);
    });

    it('should store record without overwriting existing', async () => {
        const record: SnapshotRecord = {
            snapshotId: 'test-id-1234567890',
            generatedAtISO: '2026-01-05T10:00:00Z',
            jsonSha256: 'hash123',
            jsonCanonicalText: '{}',
            appVersion: 'v2.14.0',
            environment: 'production',
        };

        // Mock: record already exists
        (storage.get as any).mockResolvedValueOnce(record);

        const result = await storeSnapshotRecord('cloud-123', record);

        expect(result).toBe(record.snapshotId);
        // Verify storage.set was NOT called (idempotent)
        expect(storage.set).not.toHaveBeenCalled();
    });

    it('should store new record and add to index', async () => {
        const record: SnapshotRecord = {
            snapshotId: 'new-id-1234567890',
            generatedAtISO: '2026-01-05T10:00:00Z',
            jsonSha256: 'hash123',
            jsonCanonicalText: '{}',
            appVersion: 'v2.14.0',
            environment: 'production',
        };

        // Mock: no existing record
        (storage.get as any).mockResolvedValueOnce(null);
        // Mock: empty index
        (storage.get as any).mockResolvedValueOnce([]);

        const result = await storeSnapshotRecord('cloud-123', record);

        expect(result).toBe(record.snapshotId);
        // Verify storage.set was called twice (record + index)
        expect(storage.set).toHaveBeenCalledTimes(2);
    });

    it('should maintain max 20 snapshots in index', async () => {
        const record: SnapshotRecord = {
            snapshotId: 'new-id-1234567890',
            generatedAtISO: '2026-01-05T10:00:00Z',
            jsonSha256: 'hash123',
            jsonCanonicalText: '{}',
            appVersion: 'v2.14.0',
            environment: 'production',
        };

        // Mock: no existing record
        (storage.get as any).mockResolvedValueOnce(null);
        // Mock: index with 20 existing IDs
        const existingIndex = Array.from({ length: 20 }, (_, i) => `id-${i}`);
        (storage.get as any).mockResolvedValueOnce(existingIndex);

        await storeSnapshotRecord('cloud-123', record);

        // Verify index was pruned to 20
        const setCalls = (storage.set as any).mock.calls;
        const indexCall = setCalls.find((call: any) => call[0].includes('index'));
        
        expect(indexCall).toBeDefined();
        const newIndex = indexCall[1];
        expect(newIndex.length).toBeLessThanOrEqual(20);
    });

    it('should add new record as most recent (first in index)', async () => {
        const record: SnapshotRecord = {
            snapshotId: 'new-id-1234567890',
            generatedAtISO: '2026-01-05T10:00:00Z',
            jsonSha256: 'hash123',
            jsonCanonicalText: '{}',
            appVersion: 'v2.14.0',
            environment: 'production',
        };

        // Mock: no existing record
        (storage.get as any).mockResolvedValueOnce(null);
        // Mock: index with existing IDs
        const existingIndex = ['id-2', 'id-3'];
        (storage.get as any).mockResolvedValueOnce(existingIndex);

        await storeSnapshotRecord('cloud-123', record);

        const setCalls = (storage.set as any).mock.calls;
        const indexCall = setCalls.find((call: any) => call[0].includes('index'));
        const newIndex = indexCall[1];

        expect(newIndex[0]).toBe(record.snapshotId);
        expect(newIndex[1]).toBe('id-2');
        expect(newIndex[2]).toBe('id-3');
    });
});
