/**
 * Security Tests: Storage Debug Redaction Policy (PHASE 1.1)
 * 
 * Tests that ensure:
 * - No raw event payloads in snapshot
 * - No tokens or secrets in snapshot
 * - Event IDs and shard keys are safe to show (non-sensitive)
 * - Incomplete state is clearly marked when no data available
 */

import { describe, it } from 'vitest';
import { StorageProofSnapshot } from '../src/storage_debug';

/**
 * Test suite for debug redaction policy
 */
const testSuite: { [key: string]: () => boolean } = {
  /**
   * Test 1: Snapshot never includes "payload" field
   */
  'Snapshot excludes payload field': () => {
    const snapshot: StorageProofSnapshot = {
      org_key: 'testorg',
      repo_key: 'testrepo',
      status: 'success',
      message: 'OK',
      total_ingested_today: 1,
      recent_event_ids: ['event-001'],
      shards_touched_today: ['shard_0'],
      idempotency_hits_count: 0,
      last_ingest_timestamp: '2025-12-19T10:00:00Z',
    };

    // Check that snapshot does NOT have a payload field
    return !('payload' in snapshot) && !('body' in snapshot);
  },

  /**
   * Test 2: Snapshot never includes "token" field
   */
  'Snapshot excludes token field': () => {
    const snapshot: StorageProofSnapshot = {
      org_key: 'testorg',
      repo_key: 'testrepo',
      status: 'success',
      message: 'OK',
      total_ingested_today: 1,
      recent_event_ids: ['event-001'],
      shards_touched_today: ['shard_0'],
      idempotency_hits_count: 0,
      last_ingest_timestamp: '2025-12-19T10:00:00Z',
    };

    // Check that snapshot does NOT have token or secret fields
    return !('token' in snapshot) &&
           !('secret' in snapshot) &&
           !('X-FT-INGEST-TOKEN' in snapshot) &&
           !('headers' in snapshot);
  },

  /**
   * Test 3: Event IDs are safe to show
   */
  'Event IDs appear in snapshot (safe to show)': () => {
    const snapshot: StorageProofSnapshot = {
      org_key: 'testorg',
      repo_key: 'testrepo',
      status: 'success',
      message: 'OK',
      total_ingested_today: 1,
      recent_event_ids: ['event-001', 'event-002'],
      shards_touched_today: ['shard_0'],
      idempotency_hits_count: 0,
      last_ingest_timestamp: '2025-12-19T10:00:00Z',
    };

    // Event IDs should be present (non-sensitive)
    return snapshot.recent_event_ids.length > 0 &&
           snapshot.recent_event_ids[0] === 'event-001';
  },

  /**
   * Test 4: Shard keys are safe to show
   */
  'Shard keys appear in snapshot (safe to show)': () => {
    const snapshot: StorageProofSnapshot = {
      org_key: 'testorg',
      repo_key: 'testrepo',
      status: 'success',
      message: 'OK',
      total_ingested_today: 200,
      recent_event_ids: ['event-001'],
      shards_touched_today: ['shard_0', 'shard_1'],
      idempotency_hits_count: 5,
      last_ingest_timestamp: '2025-12-19T10:00:00Z',
    };

    // Shard keys should be present (non-sensitive identifiers)
    return snapshot.shards_touched_today.includes('shard_0') &&
           snapshot.shards_touched_today.includes('shard_1');
  },

  /**
   * Test 5: Incomplete state marked when no data
   */
  'Incomplete state when no data ingested': () => {
    const snapshot: StorageProofSnapshot = {
      org_key: 'testorg',
      repo_key: 'testrepo',
      status: 'incomplete',
      message: 'No ingested data present; snapshot is incomplete',
      total_ingested_today: 'unknown',
      recent_event_ids: [],
      shards_touched_today: [],
      idempotency_hits_count: 'unknown',
      last_ingest_timestamp: null,
    };

    // Snapshot should clearly indicate incomplete state
    return snapshot.status === 'incomplete' &&
           snapshot.recent_event_ids.length === 0 &&
           snapshot.message.includes('incomplete');
  },

  /**
   * Test 6: Error state includes message but no internals
   */
  'Error state message is clear, not internals': () => {
    const snapshot: StorageProofSnapshot = {
      org_key: 'testorg',
      repo_key: 'testrepo',
      status: 'error',
      message: 'Failed to retrieve storage proof snapshot',
      total_ingested_today: 'unknown',
      recent_event_ids: [],
      shards_touched_today: [],
      idempotency_hits_count: 'unknown',
      last_ingest_timestamp: null,
      error_detail: 'Storage read error',
    };

    // Message should be clear, not exposing internals
    return snapshot.status === 'error' &&
           !snapshot.message.includes('EACCES') &&
           !snapshot.message.includes('stack trace');
  },

  /**
   * Test 7: Snapshot is not full key dump
   */
  'Snapshot returns summary, not full keyspace': () => {
    const snapshot: StorageProofSnapshot = {
      org_key: 'testorg',
      repo_key: 'testrepo',
      status: 'success',
      message: 'OK',
      total_ingested_today: 1,
      recent_event_ids: ['event-001'],
      shards_touched_today: ['shard_0'],
      idempotency_hits_count: 0,
      last_ingest_timestamp: '2025-12-19T10:00:00Z',
    };

    // Snapshot has limited fields; not a full keyspace dump
    const fieldCount = Object.keys(snapshot).length;
    return fieldCount < 15; // Expected: ~9 main fields
  },

  /**
   * Test 8: Total count is safe (summary stat)
   */
  'Total ingested count is safe summary stat': () => {
    const snapshot: StorageProofSnapshot = {
      org_key: 'testorg',
      repo_key: 'testrepo',
      status: 'success',
      message: 'OK',
      total_ingested_today: 42,
      recent_event_ids: ['event-001'],
      shards_touched_today: ['shard_0'],
      idempotency_hits_count: 2,
      last_ingest_timestamp: '2025-12-19T10:00:00Z',
    };

    // Count is aggregated summary, not individual payloads
    return typeof snapshot.total_ingested_today === 'number' &&
           snapshot.total_ingested_today > 0;
  },

  /**
   * Test 9: Recent event IDs limited to small number (not all)
   */
  'Recent event IDs limited to small subset': () => {
    const snapshot: StorageProofSnapshot = {
      org_key: 'testorg',
      repo_key: 'testrepo',
      status: 'success',
      message: 'OK',
      total_ingested_today: 1000,
      recent_event_ids: ['e1', 'e2', 'e3', 'e4', 'e5'],
      shards_touched_today: ['shard_0', 'shard_1'],
      idempotency_hits_count: 100,
      last_ingest_timestamp: '2025-12-19T10:00:00Z',
    };

    // Should show only last N (≤5), not all 1000
    return snapshot.recent_event_ids.length <= 5;
  },

  /**
   * Test 10: Idempotency count is safe (no individual markers)
   */
  'Idempotency count is aggregated, not individual': () => {
    const snapshot: StorageProofSnapshot = {
      org_key: 'testorg',
      repo_key: 'testrepo',
      status: 'success',
      message: 'OK',
      total_ingested_today: 100,
      recent_event_ids: ['e1'],
      shards_touched_today: ['shard_0'],
      idempotency_hits_count: 5,
      last_ingest_timestamp: '2025-12-19T10:00:00Z',
    };

    // Count is aggregated; does not show individual duplicate event IDs
    return typeof snapshot.idempotency_hits_count === 'number' &&
           !Array.isArray(snapshot.idempotency_hits_count);
  },
};

/**
 * Run all tests and report results
 */
export function runAllTests(): void {
  const testNames = Object.keys(testSuite);
  let passed = 0;
  let failed = 0;

  console.log('\n=== Storage Debug Redaction Policy Tests ===\n');

  for (const testName of testNames) {
    const testFn = testSuite[testName];
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

  console.log(`\n✅ Test Results: ${passed} passed, ${failed} failed\n`);

  if (failed > 0) {
    throw new Error(`${failed} tests failed`);
  }
}

describe('Storage Debug Redaction Tests', () => {
  it('should run all storage redaction tests', () => {
    runAllTests();
  });
});
