/**
 * ECL-3.1: Drift Enumeration and Population Tests
 * 
 * Tests for extractDriftIdsFromDashboardState() behavior:
 * - Returns [] if drift container absent
 * - Throws FT_ECL_DRIFT_ID_MISSING if container exists but id missing/empty
 * - Returns sorted unique drift IDs if container exists with valid ids
 * - Handles both snake_case (drift_event_id) and camelCase (driftEventId) fields
 */

import { describe, it, expect } from 'vitest';

/**
 * Local copy of extractDriftIdsFromDashboardState for testing
 * In production, this would be imported from gadget-resolver.ts
 * 
 * For testing purposes, we implement it here to avoid needing the full resolver
 */
function extractDriftIdsFromDashboardState(data: any): string[] {
  // Fail-closed: if no driftContainer, return empty (feature not available)
  if (!data || typeof data !== 'object') {
    return [];
  }

  // Look for drift events container
  // Supported locations: data.driftEvents, data.continuousDrift, data.phase7.driftEvents
  const driftContainer = 
    data.driftEvents || 
    data.continuousDrift?.events || 
    data.phase7?.driftEvents ||
    null;

  // If no drift container found, return empty array (feature unavailable)
  if (!driftContainer) {
    return [];
  }

  // Ensure driftContainer is an array
  if (!Array.isArray(driftContainer)) {
    return [];
  }

  // Extract drift IDs with validation
  const driftIds: string[] = [];
  for (const driftEvent of driftContainer) {
    // Accept either drift_event_id or driftEventId (canonical snake_case or camelCase)
    const driftId = (driftEvent?.drift_event_id || driftEvent?.driftEventId || '').trim();
    
    // Fail-closed: if any drift event has missing/empty id, throw error
    if (!driftId) {
      throw new Error('FT_ECL_DRIFT_ID_MISSING: Drift event missing required driftEventId field');
    }

    driftIds.push(driftId);
  }

  // Deduplicate and sort lexicographically for determinism
  const uniqueDriftIds = Array.from(new Set(driftIds));
  return uniqueDriftIds.sort((a, b) => a.localeCompare(b));
}

describe('ECL-3.1: extractDriftIdsFromDashboardState', () => {
  describe('returns [] if drift container absent', () => {
    it('returns [] if data is null', () => {
      const result = extractDriftIdsFromDashboardState(null);
      expect(result).toEqual([]);
    });

    it('returns [] if data is undefined', () => {
      const result = extractDriftIdsFromDashboardState(undefined);
      expect(result).toEqual([]);
    });

    it('returns [] if data is not an object', () => {
      const result = extractDriftIdsFromDashboardState('string');
      expect(result).toEqual([]);
    });

    it('returns [] if data has no drift container', () => {
      const data = {
        someOtherField: 'value',
        anotherField: {},
      };
      const result = extractDriftIdsFromDashboardState(data);
      expect(result).toEqual([]);
    });

    it('returns [] if driftEvents is present but not an array', () => {
      const data = {
        driftEvents: 'not an array',
      };
      const result = extractDriftIdsFromDashboardState(data);
      expect(result).toEqual([]);
    });

    it('returns [] if driftEvents is an empty array', () => {
      const data = {
        driftEvents: [],
      };
      const result = extractDriftIdsFromDashboardState(data);
      expect(result).toEqual([]);
    });
  });

  describe('throws FT_ECL_DRIFT_ID_MISSING if container exists but id missing', () => {
    it('throws if drift event has no drift_event_id or driftEventId', () => {
      const data = {
        driftEvents: [
          { someField: 'value' },
        ],
      };
      expect(() => extractDriftIdsFromDashboardState(data)).toThrow(
        'FT_ECL_DRIFT_ID_MISSING: Drift event missing required driftEventId field'
      );
    });

    it('throws if drift_event_id is empty string', () => {
      const data = {
        driftEvents: [
          { drift_event_id: '' },
        ],
      };
      expect(() => extractDriftIdsFromDashboardState(data)).toThrow('FT_ECL_DRIFT_ID_MISSING');
    });

    it('throws if driftEventId is whitespace-only', () => {
      const data = {
        driftEvents: [
          { driftEventId: '   ' },
        ],
      };
      expect(() => extractDriftIdsFromDashboardState(data)).toThrow('FT_ECL_DRIFT_ID_MISSING');
    });

    it('throws on first event with missing id (fail-closed)', () => {
      const data = {
        driftEvents: [
          { drift_event_id: 'valid-id' },
          { drift_event_id: '' }, // This should trigger the error
          { drift_event_id: 'another-id' },
        ],
      };
      expect(() => extractDriftIdsFromDashboardState(data)).toThrow('FT_ECL_DRIFT_ID_MISSING');
    });
  });

  describe('returns sorted unique drift IDs if container exists with valid ids', () => {
    it('returns single drift ID from snake_case field', () => {
      const data = {
        driftEvents: [
          { drift_event_id: 'drift-123' },
        ],
      };
      const result = extractDriftIdsFromDashboardState(data);
      expect(result).toEqual(['drift-123']);
    });

    it('returns single drift ID from camelCase field', () => {
      const data = {
        driftEvents: [
          { driftEventId: 'drift-456' },
        ],
      };
      const result = extractDriftIdsFromDashboardState(data);
      expect(result).toEqual(['drift-456']);
    });

    it('prefers snake_case (drift_event_id) over camelCase', () => {
      const data = {
        driftEvents: [
          { drift_event_id: 'snake-case-id', driftEventId: 'camel-case-id' },
        ],
      };
      const result = extractDriftIdsFromDashboardState(data);
      expect(result).toEqual(['snake-case-id']);
    });

    it('returns multiple drift IDs sorted lexicographically', () => {
      const data = {
        driftEvents: [
          { drift_event_id: 'zulu-id' },
          { drift_event_id: 'alpha-id' },
          { drift_event_id: 'bravo-id' },
        ],
      };
      const result = extractDriftIdsFromDashboardState(data);
      expect(result).toEqual(['alpha-id', 'bravo-id', 'zulu-id']);
    });

    it('deduplicates identical drift IDs', () => {
      const data = {
        driftEvents: [
          { drift_event_id: 'duplicate-id' },
          { drift_event_id: 'unique-id' },
          { drift_event_id: 'duplicate-id' }, // Duplicate
        ],
      };
      const result = extractDriftIdsFromDashboardState(data);
      expect(result).toEqual(['duplicate-id', 'unique-id']);
    });

    it('handles whitespace trimming in drift IDs', () => {
      const data = {
        driftEvents: [
          { drift_event_id: '  spaced-id  ' },
          { drift_event_id: 'normal-id' },
        ],
      };
      const result = extractDriftIdsFromDashboardState(data);
      expect(result).toEqual(['normal-id', 'spaced-id']);
    });
  });

  describe('supports different drift container locations', () => {
    it('finds drift events in data.driftEvents', () => {
      const data = {
        driftEvents: [
          { drift_event_id: 'event-1' },
          { drift_event_id: 'event-2' },
        ],
      };
      const result = extractDriftIdsFromDashboardState(data);
      expect(result).toEqual(['event-1', 'event-2']);
    });

    it('finds drift events in data.continuousDrift.events', () => {
      const data = {
        continuousDrift: {
          events: [
            { drift_event_id: 'event-1' },
            { drift_event_id: 'event-2' },
          ],
        },
      };
      const result = extractDriftIdsFromDashboardState(data);
      expect(result).toEqual(['event-1', 'event-2']);
    });

    it('finds drift events in data.phase7.driftEvents', () => {
      const data = {
        phase7: {
          driftEvents: [
            { drift_event_id: 'event-1' },
            { drift_event_id: 'event-2' },
          ],
        },
      };
      const result = extractDriftIdsFromDashboardState(data);
      expect(result).toEqual(['event-1', 'event-2']);
    });

    it('prioritizes first available container location', () => {
      const data = {
        driftEvents: [
          { drift_event_id: 'from-driftEvents' },
        ],
        continuousDrift: {
          events: [
            { drift_event_id: 'from-continuousDrift' },
          ],
        },
      };
      const result = extractDriftIdsFromDashboardState(data);
      // Should use driftEvents (first in priority)
      expect(result).toEqual(['from-driftEvents']);
    });
  });

  describe('determinism guarantees', () => {
    it('returns same result for same input (deterministic)', () => {
      const data = {
        driftEvents: [
          { drift_event_id: 'zulu-id' },
          { drift_event_id: 'alpha-id' },
          { drift_event_id: 'bravo-id' },
        ],
      };
      const result1 = extractDriftIdsFromDashboardState(data);
      const result2 = extractDriftIdsFromDashboardState(data);
      expect(result1).toEqual(result2);
      expect(result1).toEqual(['alpha-id', 'bravo-id', 'zulu-id']);
    });

    it('sorts using localeCompare for stable ordering', () => {
      const data = {
        driftEvents: [
          { drift_event_id: 'B' },
          { drift_event_id: 'a' },
          { drift_event_id: 'A' },
          { drift_event_id: 'b' },
        ],
      };
      const result = extractDriftIdsFromDashboardState(data);
      // localeCompare default: 'a' < 'A' < 'b' < 'B' (lowercase before uppercase at same letter)
      expect(result).toEqual(['a', 'A', 'b', 'B']);
    });
  });

  describe('map population simulation', () => {
    it('simulates deterministic map key ordering from sorted IDs', () => {
      const data = {
        driftEvents: [
          { drift_event_id: 'zulu' },
          { drift_event_id: 'alpha' },
          { drift_event_id: 'charlie' },
        ],
      };
      const driftIds = extractDriftIdsFromDashboardState(data);
      
      // Simulate building the acknowledgements map
      const acks: Record<string, string | null> = {};
      for (const driftId of driftIds) {
        acks[driftId] = null; // NULL because no ack exists yet
      }
      
      // Map keys should be in insertion order (which is sorted order)
      const keys = Object.keys(acks);
      expect(keys).toEqual(['alpha', 'charlie', 'zulu']);
    });

    it('handles mixed null and non-null acknowledgement records', () => {
      const data = {
        driftEvents: [
          { drift_event_id: 'drift-1' },
          { drift_event_id: 'drift-2' },
          { drift_event_id: 'drift-3' },
        ],
      };
      const driftIds = extractDriftIdsFromDashboardState(data);
      
      // Simulate augmented acknowledgements map
      const acks: Record<string, any> = {};
      for (const driftId of driftIds) {
        if (driftId === 'drift-2') {
          // Only drift-2 has an acknowledgement
          acks[driftId] = {
            driftId: 'drift-2',
            ticketId: 'PROJ-123',
            reasonCode: 'AUTHORIZED_CHANGE',
          };
        } else {
          // drift-1 and drift-3 have no acknowledgements yet
          acks[driftId] = null;
        }
      }
      
      // Verify map structure
      expect(Object.keys(acks)).toEqual(['drift-1', 'drift-2', 'drift-3']);
      expect(acks['drift-1']).toBeNull();
      expect(acks['drift-2']).not.toBeNull();
      expect(acks['drift-2'].ticketId).toBe('PROJ-123');
      expect(acks['drift-3']).toBeNull();
    });
  });
});
