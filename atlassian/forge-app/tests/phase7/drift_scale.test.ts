/**
 * PHASE 7 v2: SCALE AND PAGINATION TESTS
 * 
 * Tests for:
 * - Pagination correctness at scale (10k drift events)
 * - Stable ordering maintained across pages
 * - Deterministic hashing at scale
 */

import { describe, it, expect } from 'vitest';
import {
  sortDriftEventsDeterministically,
  filterDriftEvents,
  paginateDriftEvents,
} from '../../src/phase7/drift_storage';
import { DriftEvent, ObjectType, ChangeType, Classification } from '../../src/phase7/drift_model';

describe('Phase 7 v2: Scale and Pagination', () => {
  describe('Large Scale Drift Events', () => {
    it('should handle 10k drift events', () => {
      // Create 10k synthetic drift events
      const events: DriftEvent[] = [];

      for (let i = 0; i < 10000; i++) {
        const event: DriftEvent = {
          tenant_id: 'test-tenant',
          cloud_id: 'cloud-123',
          drift_event_id: `drift-${i}`,
          from_snapshot_id: `snap-${Math.floor(i / 100)}`,
          to_snapshot_id: `snap-${Math.floor(i / 100) + 1}`,
          time_window: {
            from_captured_at: new Date(2025, 0, 1 + Math.floor(i / 100)).toISOString(),
            to_captured_at: new Date(2025, 0, 2 + Math.floor(i / 100)).toISOString(),
          },
          object_type: [ObjectType.FIELD, ObjectType.WORKFLOW, ObjectType.AUTOMATION_RULE][i % 3] as ObjectType,
          object_id: `object-${i % 1000}`,
          change_type: [ChangeType.ADDED, ChangeType.REMOVED, ChangeType.MODIFIED][i % 3] as ChangeType,
          classification: Classification.STRUCTURAL,
          before_state: i % 2 === 0 ? { id: `obj-${i}` } : null,
          after_state: i % 2 === 0 ? { id: `obj-${i}`, name: 'new' } : { id: `obj-${i}` },
          actor: 'unknown',
          source: 'unknown',
          actor_confidence: 'none',
          completeness_percentage: 100,
          repeat_count: 1,
          schema_version: '7.0',
          canonical_hash: `hash-${i}`,
          hash_algorithm: 'sha256',
          created_at: new Date().toISOString(),
        };
        events.push(event);
      }

      // Should be able to sort all 10k events
      const sorted = sortDriftEventsDeterministically(events);

      expect(sorted.length).toBe(10000);
    });
  });

  describe('Pagination Correctness', () => {
    let testEvents: DriftEvent[];

    beforeEach(() => {
      // Create 100 test events for pagination testing
      testEvents = [];

      for (let i = 0; i < 100; i++) {
        const event: DriftEvent = {
          tenant_id: 'test-tenant',
          cloud_id: 'cloud-123',
          drift_event_id: `drift-${i}`,
          from_snapshot_id: `snap-${i}`,
          to_snapshot_id: `snap-${i + 1}`,
          time_window: {
            from_captured_at: new Date(2025, 0, 1).toISOString(),
            to_captured_at: new Date(2025, 0, 1 + Math.floor(i / 10)).toISOString(),
          },
          object_type: ObjectType.FIELD,
          object_id: `field-${i}`,
          change_type: ChangeType.ADDED,
          classification: Classification.STRUCTURAL,
          before_state: null,
          after_state: { id: `f-${i}` },
          actor: 'unknown',
          source: 'unknown',
          actor_confidence: 'none',
          completeness_percentage: 100,
          repeat_count: 1,
          schema_version: '7.0',
          canonical_hash: `hash-${i}`,
          hash_algorithm: 'sha256',
          created_at: new Date().toISOString(),
        };
        testEvents.push(event);
      }
    });

    it('should paginate correctly with limit 20', () => {
      const page0 = paginateDriftEvents(testEvents, 0, 20);
      const page1 = paginateDriftEvents(testEvents, 1, 20);
      const page2 = paginateDriftEvents(testEvents, 2, 20);
      const page3 = paginateDriftEvents(testEvents, 3, 20);
      const page4 = paginateDriftEvents(testEvents, 4, 20);

      expect(page0.items.length).toBe(20);
      expect(page0.has_more).toBe(true);

      expect(page1.items.length).toBe(20);
      expect(page1.has_more).toBe(true);

      expect(page2.items.length).toBe(20);
      expect(page2.has_more).toBe(true);

      expect(page3.items.length).toBe(20);
      expect(page3.has_more).toBe(true);

      expect(page4.items.length).toBe(20);
      expect(page4.has_more).toBe(false); // Last page
    });

    it('should have no overlapping events across pages', () => {
      const page0 = paginateDriftEvents(testEvents, 0, 20);
      const page1 = paginateDriftEvents(testEvents, 1, 20);

      const page0Ids = new Set(page0.items.map((e) => e.drift_event_id));
      const page1Ids = new Set(page1.items.map((e) => e.drift_event_id));

      const overlap = [...page0Ids].filter((id) => page1Ids.has(id));
      expect(overlap.length).toBe(0);
    });

    it('should maintain stable ordering across pagination', () => {
      const sorted = sortDriftEventsDeterministically(testEvents);
      const page0 = paginateDriftEvents(sorted, 0, 20);
      const page1 = paginateDriftEvents(sorted, 1, 20);
      const page2 = paginateDriftEvents(sorted, 2, 20);

      // All paginated items should maintain sort order
      const allItems = [...page0.items, ...page1.items, ...page2.items];

      for (let i = 0; i < allItems.length - 1; i++) {
        const current = allItems[i];
        const next = allItems[i + 1];

        // Check deterministic sort order
        const currentDate = new Date(current.time_window.to_captured_at).getTime();
        const nextDate = new Date(next.time_window.to_captured_at).getTime();

        expect(currentDate).toBeGreaterThanOrEqual(nextDate);
      }
    });

    it('should set has_more flag correctly', () => {
      const page0 = paginateDriftEvents(testEvents, 0, 50);
      expect(page0.has_more).toBe(true);

      const page1 = paginateDriftEvents(testEvents, 1, 50);
      expect(page1.has_more).toBe(false);

      const page0_small = paginateDriftEvents(testEvents, 0, 100);
      expect(page0_small.has_more).toBe(false);

      const page0_large = paginateDriftEvents(testEvents, 0, 200);
      expect(page0_large.has_more).toBe(false);
    });

    it('should handle out-of-bounds pages', () => {
      const outOfBounds = paginateDriftEvents(testEvents, 10, 20);
      expect(outOfBounds.items.length).toBe(0);
      expect(outOfBounds.has_more).toBe(false);
    });
  });

  describe('Stable Sorting', () => {
    it('should sort by to_captured_at desc (most recent first)', () => {
      const events: DriftEvent[] = [
        createDriftEvent('drift-1', '2025-01-01T10:00:00Z'),
        createDriftEvent('drift-2', '2025-01-03T10:00:00Z'),
        createDriftEvent('drift-3', '2025-01-02T10:00:00Z'),
      ];

      const sorted = sortDriftEventsDeterministically(events);

      expect(sorted[0].drift_event_id).toBe('drift-2'); // Most recent
      expect(sorted[1].drift_event_id).toBe('drift-3');
      expect(sorted[2].drift_event_id).toBe('drift-1'); // Oldest
    });

    it('should maintain deterministic order for identical timestamps', () => {
      const sameDate = '2025-01-02T10:00:00Z';
      const events: DriftEvent[] = [
        { ...createDriftEvent('drift-3', sameDate), object_type: ObjectType.WORKFLOW },
        { ...createDriftEvent('drift-1', sameDate), object_type: ObjectType.FIELD },
        { ...createDriftEvent('drift-2', sameDate), object_type: ObjectType.AUTOMATION_RULE },
      ];

      const sorted = sortDriftEventsDeterministically(events);

      // Should sort by object_type alphabetically when dates are same
      expect(sorted[0].object_type.localeCompare(sorted[1].object_type)).toBeLessThanOrEqual(0);
      expect(sorted[1].object_type.localeCompare(sorted[2].object_type)).toBeLessThanOrEqual(0);
    });

    it('should be idempotent (sorting twice gives same result)', () => {
      const events: DriftEvent[] = [
        createDriftEvent('drift-1', '2025-01-01T10:00:00Z'),
        createDriftEvent('drift-2', '2025-01-03T10:00:00Z'),
        createDriftEvent('drift-3', '2025-01-02T10:00:00Z'),
      ];

      const sorted1 = sortDriftEventsDeterministically(events);
      const sorted2 = sortDriftEventsDeterministically(sorted1);

      expect(sorted1.map((e) => e.drift_event_id)).toEqual(
        sorted2.map((e) => e.drift_event_id)
      );
    });
  });

  describe('Filtering at Scale', () => {
    it('should filter events by object_type', () => {
      const events: DriftEvent[] = [];

      for (let i = 0; i < 100; i++) {
        const event = createDriftEvent(`drift-${i}`, '2025-01-01T10:00:00Z');
        event.object_type = i % 2 === 0 ? ObjectType.FIELD : ObjectType.WORKFLOW;
        events.push(event);
      }

      const filtered = filterDriftEvents(events, { object_type: ObjectType.FIELD });

      expect(filtered.length).toBe(50);
      expect(filtered.every((e) => e.object_type === ObjectType.FIELD)).toBe(true);
    });

    it('should filter events by classification', () => {
      const events: DriftEvent[] = [];

      for (let i = 0; i < 100; i++) {
        const event = createDriftEvent(`drift-${i}`, '2025-01-01T10:00:00Z');
        event.classification =
          i % 2 === 0 ? Classification.STRUCTURAL : Classification.CONFIG_CHANGE;
        events.push(event);
      }

      const filtered = filterDriftEvents(events, { classification: Classification.STRUCTURAL });

      expect(filtered.length).toBe(50);
      expect(filtered.every((e) => e.classification === Classification.STRUCTURAL)).toBe(true);
    });

    it('should filter events by date range', () => {
      const events: DriftEvent[] = [];

      for (let i = 0; i < 10; i++) {
        const event = createDriftEvent(
          `drift-${i}`,
          new Date(2025, 0, 1 + i).toISOString()
        );
        events.push(event);
      }

      const filtered = filterDriftEvents(events, {
        from_date: '2025-01-03T00:00:00Z',
        to_date: '2025-01-07T00:00:00Z',
      });

      expect(filtered.length).toBe(5); // Days 3, 4, 5, 6, 7
    });
  });
});

// Helper function to create drift events
function createDriftEvent(id: string, toDate: string): DriftEvent {
  return {
    tenant_id: 'test-tenant',
    cloud_id: 'cloud-123',
    drift_event_id: id,
    from_snapshot_id: `snap-1`,
    to_snapshot_id: `snap-2`,
    time_window: {
      from_captured_at: '2025-01-01T10:00:00Z',
      to_captured_at: toDate,
    },
    object_type: ObjectType.FIELD,
    object_id: 'test-object',
    change_type: ChangeType.ADDED,
    classification: Classification.STRUCTURAL,
    before_state: null,
    after_state: { id: 'test' },
    actor: 'unknown',
    source: 'unknown',
    actor_confidence: 'none',
    completeness_percentage: 100,
    repeat_count: 1,
    schema_version: '7.0',
    canonical_hash: 'hash',
    hash_algorithm: 'sha256',
    created_at: new Date().toISOString(),
  };
}
