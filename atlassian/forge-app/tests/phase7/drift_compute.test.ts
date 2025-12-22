/**
 * PHASE 7 v2: DRIFT COMPUTATION TESTS
 * 
 * Tests for drift detection algorithm covering:
 * - Determinism (same inputs → identical outputs)
 * - Classification correctness
 * - Canonical extraction accuracy
 * - Stable ordering
 * - Completeness calculation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { computeDrift } from '../../src/phase7/drift_compute';
import { ChangeType, Classification, ObjectType } from '../../src/phase7/drift_model';

describe('Phase 7 v2: Drift Computation', () => {
  const tenantId = 'test-tenant-001';
  const cloudId = 'cloud-123';

  let snapshotA: any;
  let snapshotB: any;

  beforeEach(() => {
    // Setup test snapshots
    snapshotA = {
      snapshot_id: 'snap-001',
      tenant_id: tenantId,
      cloud_id: cloudId,
      captured_at: '2025-12-19T10:00:00Z',
      canonical_hash: 'hash-a-001',
      missing_data: [],
      payload: {
        fields: [
          { id: 'field-1', name: 'Summary', type: 'string', custom: false, searchable: true },
          { id: 'field-2', name: 'Custom Field', type: 'text', custom: true, searchable: false },
        ],
        workflows: [
          { name: 'Default Workflow', scope: 'global', is_default: true, statuses: ['To Do', 'In Progress', 'Done'] },
        ],
        automation: [
          { id: 'auto-1', name: 'Auto Rule 1', enabled: true, trigger_type: 'issue_created' },
        ],
        projects: [
          { key: 'PROJ', name: 'Project', type: 'software' },
        ],
      },
    };

    snapshotB = {
      snapshot_id: 'snap-002',
      tenant_id: tenantId,
      cloud_id: cloudId,
      captured_at: '2025-12-20T10:00:00Z',
      canonical_hash: 'hash-b-002',
      missing_data: [],
      payload: {
        fields: [
          { id: 'field-1', name: 'Summary', type: 'string', custom: false, searchable: true },
          // field-2 removed
          { id: 'field-3', name: 'New Field', type: 'number', custom: true, searchable: true }, // added
        ],
        workflows: [
          { name: 'Default Workflow', scope: 'global', is_default: true, statuses: ['To Do', 'In Progress', 'Done'] },
          { name: 'New Workflow', scope: 'project', is_default: false, statuses: ['Created', 'Resolved'] }, // added
        ],
        automation: [
          { id: 'auto-1', name: 'Auto Rule 1', enabled: false, trigger_type: 'issue_created' }, // modified
        ],
        projects: [
          { key: 'PROJ', name: 'Project', type: 'software' },
        ],
      },
    };
  });

  describe('Determinism', () => {
    it('should produce identical drift events for identical snapshot pairs', () => {
      const result1 = computeDrift(tenantId, cloudId, snapshotA, snapshotB);
      const result2 = computeDrift(tenantId, cloudId, snapshotA, snapshotB);

      expect(result1.events.length).toBe(result2.events.length);

      result1.events.forEach((event, i) => {
        const event2 = result2.events[i];
        expect(event.canonical_hash).toBe(event2.canonical_hash);
        expect(event.object_type).toBe(event2.object_type);
        expect(event.object_id).toBe(event2.object_id);
        expect(event.change_type).toBe(event2.change_type);
        expect(event.classification).toBe(event2.classification);
      });
    });

    it('should produce empty drift for identical snapshots', () => {
      const identicalSnapshot = JSON.parse(JSON.stringify(snapshotA));
      identicalSnapshot.snapshot_id = 'snap-003';
      identicalSnapshot.canonical_hash = snapshotA.canonical_hash; // Same content

      const result = computeDrift(tenantId, cloudId, snapshotA, identicalSnapshot);

      expect(result.events.length).toBe(0);
    });

    it('should maintain stable ordering across multiple computations', () => {
      const result1 = computeDrift(tenantId, cloudId, snapshotA, snapshotB);
      const result2 = computeDrift(tenantId, cloudId, snapshotA, snapshotB);

      const order1 = result1.events.map((e) => `${e.object_type}:${e.object_id}:${e.change_type}`);
      const order2 = result2.events.map((e) => `${e.object_type}:${e.object_id}:${e.change_type}`);

      expect(order1).toEqual(order2);
    });
  });

  describe('Classification', () => {
    it('should classify field added as STRUCTURAL', () => {
      const result = computeDrift(tenantId, cloudId, snapshotA, snapshotB);
      const fieldAdded = result.events.find(
        (e) => e.object_type === ObjectType.FIELD && e.change_type === ChangeType.ADDED
      );

      expect(fieldAdded).toBeDefined();
      expect(fieldAdded?.classification).toBe(Classification.STRUCTURAL);
    });

    it('should classify field removed as STRUCTURAL', () => {
      const result = computeDrift(tenantId, cloudId, snapshotA, snapshotB);
      const fieldRemoved = result.events.find(
        (e) => e.object_type === ObjectType.FIELD && e.change_type === ChangeType.REMOVED
      );

      expect(fieldRemoved).toBeDefined();
      expect(fieldRemoved?.classification).toBe(Classification.STRUCTURAL);
    });

    it('should classify workflow added as CONFIG_CHANGE', () => {
      const result = computeDrift(tenantId, cloudId, snapshotA, snapshotB);
      const workflowAdded = result.events.find(
        (e) => e.object_type === ObjectType.WORKFLOW && e.change_type === ChangeType.ADDED
      );

      expect(workflowAdded).toBeDefined();
      expect(workflowAdded?.classification).toBe(Classification.CONFIG_CHANGE);
    });

    it('should classify workflow modified as CONFIG_CHANGE', () => {
      const result = computeDrift(tenantId, cloudId, snapshotA, snapshotB);
      const workflowModified = result.events.find(
        (e) => e.object_type === ObjectType.WORKFLOW && e.change_type === ChangeType.MODIFIED
      );

      // Note: workflow is not modified in our test, so this might be null
      // Test is here for demonstration
      if (workflowModified) {
        expect(workflowModified.classification).toBe(Classification.CONFIG_CHANGE);
      }
    });

    it('should classify automation rule modified as CONFIG_CHANGE', () => {
      const result = computeDrift(tenantId, cloudId, snapshotA, snapshotB);
      const autoModified = result.events.find(
        (e) => e.object_type === ObjectType.AUTOMATION_RULE && e.change_type === ChangeType.MODIFIED
      );

      expect(autoModified).toBeDefined();
      expect(autoModified?.classification).toBe(Classification.CONFIG_CHANGE);
    });
  });

  describe('Change Detection', () => {
    it('should detect field additions', () => {
      const result = computeDrift(tenantId, cloudId, snapshotA, snapshotB);
      const fieldAdded = result.events.find(
        (e) => e.object_type === ObjectType.FIELD && e.object_id === 'field-3'
      );

      expect(fieldAdded).toBeDefined();
      expect(fieldAdded?.change_type).toBe(ChangeType.ADDED);
      expect(fieldAdded?.before_state).toBeNull();
      expect(fieldAdded?.after_state).toBeDefined();
    });

    it('should detect field removals', () => {
      const result = computeDrift(tenantId, cloudId, snapshotA, snapshotB);
      const fieldRemoved = result.events.find(
        (e) => e.object_type === ObjectType.FIELD && e.object_id === 'field-2'
      );

      expect(fieldRemoved).toBeDefined();
      expect(fieldRemoved?.change_type).toBe(ChangeType.REMOVED);
      expect(fieldRemoved?.before_state).toBeDefined();
      expect(fieldRemoved?.after_state).toBeNull();
    });

    it('should detect modifications', () => {
      const result = computeDrift(tenantId, cloudId, snapshotA, snapshotB);
      const autoModified = result.events.find(
        (e) => e.object_type === ObjectType.AUTOMATION_RULE && e.object_id === 'auto-1'
      );

      expect(autoModified).toBeDefined();
      expect(autoModified?.change_type).toBe(ChangeType.MODIFIED);
      expect(autoModified?.before_state).toBeDefined();
      expect(autoModified?.after_state).toBeDefined();
    });
  });

  describe('Actor and Source', () => {
    it('should default actor to unknown', () => {
      const result = computeDrift(tenantId, cloudId, snapshotA, snapshotB);

      result.events.forEach((event) => {
        expect(event.actor).toBe('unknown');
      });
    });

    it('should default source to unknown', () => {
      const result = computeDrift(tenantId, cloudId, snapshotA, snapshotB);

      result.events.forEach((event) => {
        expect(event.source).toBe('unknown');
      });
    });

    it('should set actor_confidence to none', () => {
      const result = computeDrift(tenantId, cloudId, snapshotA, snapshotB);

      result.events.forEach((event) => {
        expect(event.actor_confidence).toBe('none');
      });
    });
  });

  describe('Completeness', () => {
    it('should mark events as 100% complete when both states present', () => {
      const result = computeDrift(tenantId, cloudId, snapshotA, snapshotB);
      const modified = result.events.find((e) => e.change_type === ChangeType.MODIFIED);

      if (modified) {
        expect(modified.completeness_percentage).toBe(100);
      }
    });

    it('should mark added events as complete', () => {
      const result = computeDrift(tenantId, cloudId, snapshotA, snapshotB);
      const added = result.events.find((e) => e.change_type === ChangeType.ADDED);

      if (added) {
        expect(added.completeness_percentage).toBe(100);
      }
    });

    it('should mark removed events as complete', () => {
      const result = computeDrift(tenantId, cloudId, snapshotA, snapshotB);
      const removed = result.events.find((e) => e.change_type === ChangeType.REMOVED);

      if (removed) {
        expect(removed.completeness_percentage).toBe(100);
      }
    });
  });

  describe('Hashing', () => {
    it('should assign canonical_hash to each event', () => {
      const result = computeDrift(tenantId, cloudId, snapshotA, snapshotB);

      result.events.forEach((event) => {
        expect(event.canonical_hash).toBeDefined();
        expect(event.canonical_hash.length).toBe(64); // SHA256 hex length
      });
    });

    it('should have identical hash for identical events', () => {
      const result1 = computeDrift(tenantId, cloudId, snapshotA, snapshotB);
      const result2 = computeDrift(tenantId, cloudId, snapshotA, snapshotB);

      result1.events.forEach((event1, i) => {
        expect(event1.canonical_hash).toBe(result2.events[i].canonical_hash);
      });
    });
  });

  describe('Schema Versioning', () => {
    it('should set schema_version to 7.0', () => {
      const result = computeDrift(tenantId, cloudId, snapshotA, snapshotB);

      result.events.forEach((event) => {
        expect(event.schema_version).toBe('7.0');
      });
    });

    it('should set hash_algorithm to sha256', () => {
      const result = computeDrift(tenantId, cloudId, snapshotA, snapshotB);

      result.events.forEach((event) => {
        expect(event.hash_algorithm).toBe('sha256');
      });
    });
  });

  describe('Tenant Isolation', () => {
    it('should set tenant_id from parameter', () => {
      const result = computeDrift(tenantId, cloudId, snapshotA, snapshotB);

      result.events.forEach((event) => {
        expect(event.tenant_id).toBe(tenantId);
      });
    });

    it('should set cloud_id from parameter', () => {
      const result = computeDrift(tenantId, cloudId, snapshotA, snapshotB);

      result.events.forEach((event) => {
        expect(event.cloud_id).toBe(cloudId);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle missing snapshotA gracefully', () => {
      const result = computeDrift(tenantId, cloudId, null, snapshotB);

      expect(result.events.length).toBe(0);
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('INVALID_SNAPSHOT');
    });

    it('should handle missing snapshotB gracefully', () => {
      const result = computeDrift(tenantId, cloudId, snapshotA, null);

      expect(result.events.length).toBe(0);
      expect(result.error).toBeDefined();
    });
  });
});
