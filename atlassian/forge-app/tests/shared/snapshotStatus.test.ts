/**
 * Unit tests for snapshotStatus
 */

import { describe, it, expect } from 'vitest';
import {
  SnapshotStatus,
  computeSnapshotStatus,
  validateSnapshotIntegrity,
  StatusComputationError,
  type RequiredFetchResult,
  type SnapshotMetadata,
} from '../../src/shared/snapshotStatus';

describe('snapshotStatus', () => {
  describe('computeSnapshotStatus', () => {
    it('should return COMPLETE when all fetches succeeded', () => {
      const fetchResults: RequiredFetchResult[] = [
        { datasetName: 'projects', succeeded: true },
        { datasetName: 'issues', succeeded: true },
        { datasetName: 'fields', succeeded: true },
      ];

      expect(computeSnapshotStatus(fetchResults)).toBe(SnapshotStatus.COMPLETE);
    });

    it('should return PARTIAL when some fetches failed', () => {
      const fetchResults: RequiredFetchResult[] = [
        { datasetName: 'projects', succeeded: true },
        { datasetName: 'issues', succeeded: false, errorMessage: 'HTTP 403' },
        { datasetName: 'fields', succeeded: true },
      ];

      expect(computeSnapshotStatus(fetchResults)).toBe(SnapshotStatus.PARTIAL);
    });

    it('should return FAILED when all fetches failed', () => {
      const fetchResults: RequiredFetchResult[] = [
        { datasetName: 'projects', succeeded: false, errorMessage: 'Timeout' },
        { datasetName: 'issues', succeeded: false, errorMessage: 'HTTP 500' },
        { datasetName: 'fields', succeeded: false, errorMessage: 'Network error' },
      ];

      expect(computeSnapshotStatus(fetchResults)).toBe(SnapshotStatus.FAILED);
    });

    it('should throw StatusComputationError when fetchResults is empty', () => {
      expect(() => computeSnapshotStatus([])).toThrow(StatusComputationError);
    });

    it('should throw StatusComputationError when fetchResults is null', () => {
      expect(() => computeSnapshotStatus(null as any)).toThrow(StatusComputationError);
    });
  });

  describe('validateSnapshotIntegrity', () => {
    it('should not throw for valid COMPLETE snapshot', () => {
      const metadata: Pick<SnapshotMetadata, 'snapshotId' | 'createdAtUtc' | 'status' | 'fetchResults'> = {
        snapshotId: 'snap-123',
        createdAtUtc: '2026-02-07T10:00:00Z',
        status: SnapshotStatus.COMPLETE,
        fetchResults: [
          { datasetName: 'projects', succeeded: true },
        ],
      };

      expect(() => validateSnapshotIntegrity(metadata)).not.toThrow();
    });

    it('should not throw for valid PARTIAL snapshot', () => {
      const metadata: Pick<SnapshotMetadata, 'snapshotId' | 'createdAtUtc' | 'status' | 'fetchResults'> = {
        snapshotId: 'snap-456',
        createdAtUtc: '2026-02-07T10:00:00Z',
        status: SnapshotStatus.PARTIAL,
        fetchResults: [
          { datasetName: 'projects', succeeded: true },
          { datasetName: 'fields', succeeded: false, errorMessage: 'HTTP 403' },
        ],
      };

      expect(() => validateSnapshotIntegrity(metadata)).not.toThrow();
    });

    it('should throw when snapshotId is missing', () => {
      const metadata: any = {
        createdAtUtc: '2026-02-07T10:00:00Z',
        status: SnapshotStatus.COMPLETE,
        fetchResults: [{ datasetName: 'projects', succeeded: true }],
      };

      expect(() => validateSnapshotIntegrity(metadata)).toThrow(StatusComputationError);
    });

    it('should throw when createdAtUtc is missing', () => {
      const metadata: any = {
        snapshotId: 'snap-123',
        status: SnapshotStatus.COMPLETE,
        fetchResults: [{ datasetName: 'projects', succeeded: true }],
      };

      expect(() => validateSnapshotIntegrity(metadata)).toThrow(StatusComputationError);
    });

    it('should throw when status is missing', () => {
      const metadata: any = {
        snapshotId: 'snap-123',
        createdAtUtc: '2026-02-07T10:00:00Z',
        fetchResults: [{ datasetName: 'projects', succeeded: true }],
      };

      expect(() => validateSnapshotIntegrity(metadata)).toThrow(StatusComputationError);
    });

    it('should throw when status is invalid', () => {
      const metadata: any = {
        snapshotId: 'snap-123',
        createdAtUtc: '2026-02-07T10:00:00Z',
        status: 'INVALID',
        fetchResults: [{ datasetName: 'projects', succeeded: true }],
      };

      expect(() => validateSnapshotIntegrity(metadata)).toThrow(StatusComputationError);
    });

    it('should throw when fetchResults is empty', () => {
      const metadata: any = {
        snapshotId: 'snap-123',
        createdAtUtc: '2026-02-07T10:00:00Z',
        status: SnapshotStatus.COMPLETE,
        fetchResults: [],
      };

      expect(() => validateSnapshotIntegrity(metadata)).toThrow(StatusComputationError);
    });
  });
});
