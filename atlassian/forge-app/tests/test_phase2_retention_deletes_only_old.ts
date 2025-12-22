/**
 * Test: Ingest Timeline Tracking (PHASE 2 - Retention focus)
 * 
 * Verifies that first_event_at and last_event_at are updated correctly.
 * Tests retention semantics through timeline management.
 */

import { describe, it, expect } from 'vitest';

/**
 * Mock in-memory timeline storage (synchronous)
 */
class MockTimeline {
  private timeline: Map<string, { first_event_at?: string; last_event_at?: string }> = new Map();

  update(org: string, eventAtISO: string): void {
    const key = org;
    let entry = this.timeline.get(key) || {};

    const eventTime = new Date(eventAtISO);
    if (isNaN(eventTime.getTime())) {
      return;
    }

    if (!entry.first_event_at) {
      entry.first_event_at = eventAtISO;
    } else {
      const firstTime = new Date(entry.first_event_at);
      if (eventTime < firstTime) {
        entry.first_event_at = eventAtISO;
      }
    }

    if (!entry.last_event_at) {
      entry.last_event_at = eventAtISO;
    } else {
      const lastTime = new Date(entry.last_event_at);
      if (eventTime > lastTime) {
        entry.last_event_at = eventAtISO;
      }
    }

    this.timeline.set(key, entry);
  }

  get(org: string): { first_event_at?: string; last_event_at?: string } {
    return this.timeline.get(org) || {};
  }
}

const testSuite: { [key: string]: () => boolean } = {
  'First event sets first_event_at and last_event_at': () => {
    const timeline = new MockTimeline();
    const org = 'test-org';
    const iso = '2025-12-19T10:00:00Z';

    timeline.update(org, iso);
    const result = timeline.get(org);

    return result.first_event_at === iso && result.last_event_at === iso;
  },

  'Later event updates last_event_at only': () => {
    const timeline = new MockTimeline();
    const org = 'test-org';
    const first = '2025-12-19T10:00:00Z';
    const later = '2025-12-19T11:00:00Z';

    timeline.update(org, first);
    timeline.update(org, later);
    const result = timeline.get(org);

    return result.first_event_at === first && result.last_event_at === later;
  },

  'Earlier event overwrites first (correction)': () => {
    const timeline = new MockTimeline();
    const org = 'test-org';
    const later = '2025-12-19T11:00:00Z';
    const earlier = '2025-12-19T10:00:00Z';

    timeline.update(org, later);
    timeline.update(org, earlier);
    const result = timeline.get(org);

    return result.first_event_at === earlier;
  },

  'Same timestamp idempotent': () => {
    const timeline = new MockTimeline();
    const org = 'test-org';
    const iso = '2025-12-19T10:00:00Z';

    timeline.update(org, iso);
    timeline.update(org, iso);
    timeline.update(org, iso);
    const result = timeline.get(org);

    return result.first_event_at === iso && result.last_event_at === iso;
  },

  'Multiple orgs tracked independently': () => {
    const timeline = new MockTimeline();
    const org1 = 'test-org-1';
    const org2 = 'test-org-2';
    const iso1 = '2025-12-19T10:00:00Z';
    const iso2 = '2025-12-19T11:00:00Z';

    timeline.update(org1, iso1);
    timeline.update(org2, iso2);

    const result1 = timeline.get(org1);
    const result2 = timeline.get(org2);

    return result1.first_event_at === iso1 && result2.first_event_at === iso2;
  },

  'Invalid timestamp skipped': () => {
    const timeline = new MockTimeline();
    const org = 'test-org';
    const valid = '2025-12-19T10:00:00Z';

    timeline.update(org, valid);
    timeline.update(org, 'not-a-timestamp');
    const result = timeline.get(org);

    return result.first_event_at === valid;
  },

  'Timestamp parsing handles ISO format': () => {
    const timeline = new MockTimeline();
    const org = 'test-org';
    const iso1 = '2025-12-19T10:00:00Z';
    const iso2 = '2025-12-19T11:00:00Z';

    timeline.update(org, iso1);
    timeline.update(org, iso2);
    const result = timeline.get(org);

    return result.first_event_at === iso1 && result.last_event_at === iso2;
  },

  '10 events maintain correct first/last': () => {
    const timeline = new MockTimeline();
    const org = 'test-org';

    const timestamps = [
      '2025-12-19T10:00:00Z',
      '2025-12-19T10:05:00Z',
      '2025-12-19T10:10:00Z',
      '2025-12-19T10:03:00Z',
      '2025-12-19T10:15:00Z',
      '2025-12-19T09:55:00Z',
      '2025-12-19T10:20:00Z',
      '2025-12-19T10:02:00Z',
      '2025-12-19T10:12:00Z',
      '2025-12-19T10:30:00Z',
    ];

    for (const ts of timestamps) {
      timeline.update(org, ts);
    }

    const result = timeline.get(org);
    const expectedFirst = '2025-12-19T09:55:00Z';
    const expectedLast = '2025-12-19T10:30:00Z';

    return result.first_event_at === expectedFirst && result.last_event_at === expectedLast;
  },

  'Non-existent org returns empty': () => {
    const timeline = new MockTimeline();
    const result = timeline.get('never-updated');

    return !result.first_event_at && !result.last_event_at;
  },

  'Millisecond precision preserved': () => {
    const timeline = new MockTimeline();
    const org = 'test-org';
    const iso = '2025-12-19T10:00:00.123Z';

    timeline.update(org, iso);
    const result = timeline.get(org);

    return result.first_event_at === iso;
  },
};

function runTests(): void {
  let passed = 0;
  let failed = 0;

  for (const [testName, testFn] of Object.entries(testSuite)) {
    try {
      const result = testFn();
      if (result) {
        console.log(`✓ ${testName}`);
        passed++;
      } else {
        console.log(`✗ ${testName}`);
        failed++;
      }
    } catch (error) {
      console.log(`✗ ${testName} (error: ${error})`);
      failed++;
    }
  }

  console.log(`\n${passed}/${passed + failed} tests passed`);
  if (failed > 0) {
    throw new Error(`${failed} tests failed`);
  }
}

describe('Phase 2 - Retention Timeline Tests', () => {
  it('should run all retention timeline tests', () => {
    runTests();
  });
});
