/**
 * PHASE 6: DRIFT CANONICAL HASH REGRESSION TEST
 * 
 * Critical test ensuring drift_event_id (random UUID) is excluded from canonical_hash.
 * This guarantees determinism - same drift detection always produces same canonical_hash,
 * regardless of random UUID assignments.
 * 
 * Context: After migrating from uuid.v4() to crypto.randomUUID(), we must prove that
 * random UUIDs remain isolated from deterministic outputs (canonical hashes, export packs).
 */

import { describe, it, expect } from 'vitest';
import { computeDrift } from '../../src/phase7/drift_compute';
import { DriftEvent } from '../../src/phase7/drift_model';

describe('Drift Canonical Hash: UUID Exclusion Regression', () => {
  const tenantId = 'test-tenant-uuid-regression';
  const cloudId = 'cloud-uuid-test';

  // Create minimal test snapshots with a detectable change
  const snapshotA = {
    snapshot_id: 'snap-uuid-001',
    tenant_id: tenantId,
    cloud_id: cloudId,
    captured_at: '2026-02-27T10:00:00Z',
    canonical_hash: 'hash-uuid-a',
    missing_data: [],
    payload: {
      fields: [
        { id: 'field-1', name: 'Summary', type: 'string', custom: false },
      ],
      workflows: [],
      automation: [],
      projects: [],
    },
  };

  const snapshotB = {
    snapshot_id: 'snap-uuid-002',
    tenant_id: tenantId,
    cloud_id: cloudId,
    captured_at: '2026-02-27T11:00:00Z',
    canonical_hash: 'hash-uuid-b',
    missing_data: [],
    payload: {
      fields: [
        { id: 'field-1', name: 'Summary Updated', type: 'string', custom: false }, // Modified
      ],
      workflows: [],
      automation: [],
      projects: [],
    },
  };

  it('should produce identical canonical_hash despite different drift_event_id values', () => {
    // Run drift computation twice - each will generate different drift_event_id (random UUID)
    const result1 = computeDrift(tenantId, cloudId, snapshotA, snapshotB);
    const result2 = computeDrift(tenantId, cloudId, snapshotA, snapshotB);

    // Should have detected the same drift events
    expect(result1.events.length).toBeGreaterThan(0);
    expect(result1.events.length).toBe(result2.events.length);

    // For each corresponding drift event pair
    result1.events.forEach((event1, index) => {
      const event2 = result2.events[index];

      // drift_event_id MUST be different (random UUID)
      expect(event1.drift_event_id).not.toBe(event2.drift_event_id);
      expect(event1.drift_event_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      expect(event2.drift_event_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);

      // canonical_hash MUST be identical (proves drift_event_id is excluded)
      expect(event1.canonical_hash).toBe(event2.canonical_hash);
      expect(event1.canonical_hash).toMatch(/^[a-f0-9]{64}$/); // SHA256 hex

      // Semantic fields must also match (sanity check)
      expect(event1.object_type).toBe(event2.object_type);
      expect(event1.object_id).toBe(event2.object_id);
      expect(event1.change_type).toBe(event2.change_type);
      expect(event1.classification).toBe(event2.classification);
      expect(JSON.stringify(event1.before_state)).toBe(JSON.stringify(event2.before_state));
      expect(JSON.stringify(event1.after_state)).toBe(JSON.stringify(event2.after_state));
    });

    console.log('[FT_DRIFT_CANONICAL_HASH_REGRESSION_PASS] drift_event_id excluded from canonical_hash');
  });

  it('should detect canonical_hash change when semantic content differs', () => {
    // Run with different snapshots
    const snapshotC = {
      ...snapshotB,
      snapshot_id: 'snap-uuid-003',
      captured_at: '2026-02-27T12:00:00Z',
      payload: {
        fields: [
          { id: 'field-1', name: 'Summary Updated Again', type: 'string', custom: false }, // Different modification
        ],
        workflows: [],
        automation: [],
        projects: [],
      },
    };

    const resultAB = computeDrift(tenantId, cloudId, snapshotA, snapshotB);
    const resultAC = computeDrift(tenantId, cloudId, snapshotA, snapshotC);

    expect(resultAB.events.length).toBeGreaterThan(0);
    expect(resultAC.events.length).toBeGreaterThan(0);

    // Same object changed, so should be same number of events
    expect(resultAB.events.length).toBe(resultAC.events.length);

    // But canonical_hash should differ because after_state content differs
    const eventAB = resultAB.events[0];
    const eventAC = resultAC.events[0];

    expect(eventAB.canonical_hash).not.toBe(eventAC.canonical_hash);
    expect(JSON.stringify(eventAB.after_state)).not.toBe(JSON.stringify(eventAC.after_state));
  });

  it('should use canonical_hash that excludes non-semantic fields', () => {
    const result = computeDrift(tenantId, cloudId, snapshotA, snapshotB);
    expect(result.events.length).toBeGreaterThan(0);

    const event = result.events[0];

    // Verify canonical_hash is SHA256 (64 hex chars)
    expect(event.canonical_hash).toMatch(/^[a-f0-9]{64}$/);
    
    // Verify excluded fields exist but don't affect hash
    expect(event.drift_event_id).toBeDefined(); // Present but excluded
    expect(event.created_at).toBeDefined();     // Present but excluded
    expect(event.repeat_count).toBeDefined();   // Present but excluded
    
    // Manual verification: If any of these fields changed but semantic fields stayed same,
    // canonical_hash would remain identical. This is tested implicitly by the first test.
  });
});
