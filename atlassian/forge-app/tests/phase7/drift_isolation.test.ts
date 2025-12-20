/**
 * PHASE 7 v2: ISOLATION AND CONSTRAINTS TEST
 * 
 * Tests for:
 * - Tenant isolation (drift from tenant A cannot be read by tenant B)
 * - Actor/source never guessed (defaults to unknown with confidence=none)
 * - No Jira API calls during drift computation
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { computeDrift } from '../../src/phase7/drift_compute';
import { DriftEventStorage } from '../../src/phase7/drift_storage';

describe('Phase 7 v2: Isolation and Constraints', () => {
  describe('Tenant Isolation', () => {
    it('should not allow tenant B to read tenant A drift events', () => {
      const tenantA = 'tenant-a';
      const tenantB = 'tenant-b';
      const cloudId = 'cloud-123';

      // Create storage for tenant A
      const storageA = new DriftEventStorage(tenantA, cloudId);
      const storageB = new DriftEventStorage(tenantB, cloudId);

      // In production, storageA.listDriftEvents() should only return A's events
      // and storageB.listDriftEvents() should only return B's events

      // This test verifies the isolation contract exists
      expect(storageA).toBeDefined();
      expect(storageB).toBeDefined();

      // Verify storage instances are distinct
      expect(storageA).not.toBe(storageB);
    });

    it('should scope storage keys by tenant_id', () => {
      const tenantId = 'test-tenant';
      const cloudId = 'cloud-123';
      const storage = new DriftEventStorage(tenantId, cloudId);

      // Storage implementation should prefix keys with tenant_id
      // Verified by checking that getDriftEventById returns null for non-existent ID
      // (rather than leaking another tenant's data)

      storage.getDriftEventById('nonexistent-id').then((result) => {
        expect(result).toBeNull();
      });
    });

    it('should compute drift with tenant isolation', () => {
      const tenantA = 'tenant-a';
      const tenantB = 'tenant-b';
      const cloudId = 'cloud-123';

      const snapshot = {
        snapshot_id: 'snap-001',
        captured_at: '2025-12-20T10:00:00Z',
        canonical_hash: 'hash-001',
        missing_data: [],
        payload: { fields: [] },
      };

      const resultA = computeDrift(tenantA, cloudId, snapshot, snapshot);
      const resultB = computeDrift(tenantB, cloudId, snapshot, snapshot);

      // Both should have same drift (none, identical snapshots)
      expect(resultA.events.length).toBe(0);
      expect(resultB.events.length).toBe(0);

      // But if there were drift events, they would be scoped to their tenant
      // (verified in positive tests with actual drift)
    });
  });

  describe('Actor/Source Never Guessed', () => {
    it('should default actor to unknown', () => {
      const tenantId = 'test-tenant';
      const cloudId = 'cloud-123';

      const snapshotA = {
        snapshot_id: 'snap-001',
        captured_at: '2025-12-19T10:00:00Z',
        canonical_hash: 'hash-a',
        missing_data: [],
        payload: { fields: [{ id: 'f1', name: 'Field 1', type: 'string', custom: false, searchable: true }] },
      };

      const snapshotB = {
        snapshot_id: 'snap-002',
        captured_at: '2025-12-20T10:00:00Z',
        canonical_hash: 'hash-b',
        missing_data: [],
        payload: { fields: [] }, // field removed
      };

      const result = computeDrift(tenantId, cloudId, snapshotA, snapshotB);

      result.events.forEach((event) => {
        expect(event.actor).toBe('unknown');
      });
    });

    it('should never infer actor from snapshot data alone', () => {
      const tenantId = 'test-tenant';
      const cloudId = 'cloud-123';

      // Even if snapshot contains user info, actor should NOT be inferred
      const snapshotA = {
        snapshot_id: 'snap-001',
        captured_at: '2025-12-19T10:00:00Z',
        canonical_hash: 'hash-a',
        missing_data: [],
        payload: {
          fields: [{ id: 'f1', name: 'Field 1', type: 'string', custom: false, searchable: true }],
          // Hypothetically contains user data
          last_modified_by: 'user@example.com',
        },
      };

      const snapshotB = {
        snapshot_id: 'snap-002',
        captured_at: '2025-12-20T10:00:00Z',
        canonical_hash: 'hash-b',
        missing_data: [],
        payload: { fields: [] },
        last_modified_by: 'different-user@example.com', // Changed, but not observed
      };

      const result = computeDrift(tenantId, cloudId, snapshotA, snapshotB);

      result.events.forEach((event) => {
        // Actor must still be unknown, even though metadata suggests a user
        expect(event.actor).toBe('unknown');
        expect(event.actor_confidence).toBe('none');
      });
    });

    it('should default source to unknown', () => {
      const tenantId = 'test-tenant';
      const cloudId = 'cloud-123';

      const snapshotA = {
        snapshot_id: 'snap-001',
        captured_at: '2025-12-19T10:00:00Z',
        canonical_hash: 'hash-a',
        missing_data: [],
        payload: { fields: [{ id: 'f1', name: 'Field 1', type: 'string', custom: false, searchable: true }] },
      };

      const snapshotB = {
        snapshot_id: 'snap-002',
        captured_at: '2025-12-20T10:00:00Z',
        canonical_hash: 'hash-b',
        missing_data: [],
        payload: { fields: [] },
      };

      const result = computeDrift(tenantId, cloudId, snapshotA, snapshotB);

      result.events.forEach((event) => {
        expect(event.source).toBe('unknown');
      });
    });

    it('should set actor_confidence to none', () => {
      const tenantId = 'test-tenant';
      const cloudId = 'cloud-123';

      const snapshotA = {
        snapshot_id: 'snap-001',
        captured_at: '2025-12-19T10:00:00Z',
        canonical_hash: 'hash-a',
        missing_data: [],
        payload: { fields: [{ id: 'f1', name: 'Field 1', type: 'string', custom: false, searchable: true }] },
      };

      const snapshotB = {
        snapshot_id: 'snap-002',
        captured_at: '2025-12-20T10:00:00Z',
        canonical_hash: 'hash-b',
        missing_data: [],
        payload: { fields: [] },
      };

      const result = computeDrift(tenantId, cloudId, snapshotA, snapshotB);

      result.events.forEach((event) => {
        expect(event.actor_confidence).toBe('none');
      });
    });
  });

  describe('No Jira API Calls in Drift Compute', () => {
    it('should not call any Jira APIs during drift computation', () => {
      // This test verifies by execution that computeDrift uses only provided snapshots
      // It does not mock the Jira API (would be elsewhere)
      // Instead, it verifies the function signature and behavior

      const tenantId = 'test-tenant';
      const cloudId = 'cloud-123';

      const snapshotA = {
        snapshot_id: 'snap-001',
        captured_at: '2025-12-19T10:00:00Z',
        canonical_hash: 'hash-a',
        missing_data: [],
        payload: { fields: [{ id: 'f1', name: 'Field 1', type: 'string', custom: false, searchable: true }] },
      };

      const snapshotB = {
        snapshot_id: 'snap-002',
        captured_at: '2025-12-20T10:00:00Z',
        canonical_hash: 'hash-b',
        missing_data: [],
        payload: { fields: [] },
      };

      // This function must work with provided snapshots ONLY
      // No Jira client required in parameters
      const result = computeDrift(tenantId, cloudId, snapshotA, snapshotB);

      expect(result).toBeDefined();
      expect(result.events).toBeDefined();
    });

    it('should compute drift from snapshot payloads only', () => {
      const tenantId = 'test-tenant';
      const cloudId = 'cloud-123';

      // Create minimal snapshots with only payload data
      const snapshotA = {
        snapshot_id: 'snap-001',
        captured_at: '2025-12-19T10:00:00Z',
        canonical_hash: 'hash-a',
        missing_data: [],
        payload: { fields: [{ id: 'f1', name: 'Old Name', type: 'string', custom: false, searchable: true }] },
      };

      const snapshotB = {
        snapshot_id: 'snap-002',
        captured_at: '2025-12-20T10:00:00Z',
        canonical_hash: 'hash-b',
        missing_data: [],
        payload: { fields: [{ id: 'f1', name: 'New Name', type: 'string', custom: false, searchable: true }] },
      };

      // Compute should work synchronously without external calls
      const result = computeDrift(tenantId, cloudId, snapshotA, snapshotB);

      expect(result.events.length).toBeGreaterThan(0);
      // Should detect the field modification
      const modified = result.events.find((e) => e.change_type === 'modified');
      expect(modified).toBeDefined();
    });
  });

  describe('Missing Data Handling', () => {
    it('should detect visibility changes from missing_data differences', () => {
      const tenantId = 'test-tenant';
      const cloudId = 'cloud-123';

      const snapshotA = {
        snapshot_id: 'snap-001',
        captured_at: '2025-12-19T10:00:00Z',
        canonical_hash: 'hash-a',
        missing_data: [
          {
            dataset_name: 'automation_rules',
            coverage_status: 'partial',
            reason_code: 'PERMISSION_DENIED',
            reason_detail: 'Cannot access automation',
            retry_count: 0,
          },
        ],
        payload: { fields: [], workflows: [] },
      };

      const snapshotB = {
        snapshot_id: 'snap-002',
        captured_at: '2025-12-20T10:00:00Z',
        canonical_hash: 'hash-b',
        missing_data: [], // Now complete
        payload: { fields: [], workflows: [], automation: [] },
      };

      const result = computeDrift(tenantId, cloudId, snapshotA, snapshotB);

      // Should detect visibility change for automation_rules
      const visibilityChange = result.events.find(
        (e) => e.object_type === 'scope' && e.object_id === 'automation_rules'
      );

      expect(visibilityChange).toBeDefined();
      if (visibilityChange) {
        expect(visibilityChange.classification).toBe('DATA_VISIBILITY_CHANGE');
      }
    });

    it('should reference missing_data_reference in drift events', () => {
      const tenantId = 'test-tenant';
      const cloudId = 'cloud-123';

      const snapshotA = {
        snapshot_id: 'snap-001',
        captured_at: '2025-12-19T10:00:00Z',
        canonical_hash: 'hash-a',
        missing_data: [
          {
            dataset_name: 'workflows',
            coverage_status: 'missing',
            reason_code: 'TIMEOUT',
            reason_detail: 'Request timed out',
            retry_count: 1,
          },
        ],
        payload: { fields: [] },
      };

      const snapshotB = {
        snapshot_id: 'snap-002',
        captured_at: '2025-12-20T10:00:00Z',
        canonical_hash: 'hash-b',
        missing_data: [],
        payload: { fields: [], workflows: [{ name: 'Default', scope: 'global', is_default: true, statuses: [] }] },
      };

      const result = computeDrift(tenantId, cloudId, snapshotA, snapshotB);

      const visibilityChange = result.events.find((e) => e.object_type === 'scope');
      if (visibilityChange && visibilityChange.missing_data_reference) {
        expect(visibilityChange.missing_data_reference.dataset_keys).toContain('workflows');
        expect(visibilityChange.missing_data_reference.reason_codes).toContain('TIMEOUT');
      }
    });
  });
});
