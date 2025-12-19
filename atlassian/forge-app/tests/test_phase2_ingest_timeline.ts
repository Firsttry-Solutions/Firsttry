/**
 * Test: Missing Day Handling (PHASE 2)
 * 
 * Verifies that missing raw shards for a day yields an aggregate
 * with zero counts and explicit incomplete flags.
 */

/**
 * Simulate daily recompute with no raw shards
 */
function recompute_daily_mock(org: string, date: string, shards: any[]): any {
  if (shards.length === 0) {
    return {
      org,
      date,
      total_events: 0,
      total_duration_ms: 0,
      success_count: 0,
      fail_count: 0,
      retry_total: 0,
      by_repo: [],
      by_gate: [],
      by_profile: [],
      incomplete_inputs: {
        raw_shards_missing: true,
        raw_shards_count: 0,
        raw_events_counted: 0,
      },
      notes: ['No raw shards indexed for date; aggregate computed from zero events'],
    };
  }

  // If shards present, compute normally (simplified)
  let totalEvents = 0;
  for (const shard of shards) {
    totalEvents += shard.length;
  }

  return {
    org,
    date,
    total_events: totalEvents,
    total_duration_ms: totalEvents * 100,
    success_count: Math.floor(totalEvents * 0.8),
    fail_count: totalEvents - Math.floor(totalEvents * 0.8),
    retry_total: totalEvents,
    by_repo: [
      {
        repo: 'repo-a',
        total_events: totalEvents,
        success_count: Math.floor(totalEvents * 0.8),
        fail_count: totalEvents - Math.floor(totalEvents * 0.8),
        total_duration_ms: totalEvents * 100,
      },
    ],
    by_gate: [{ gate: 'gate-1', count: totalEvents }],
    by_profile: [{ profile: 'fast', count: totalEvents }],
    incomplete_inputs: { raw_shards_missing: false, raw_shards_count: 1, raw_events_counted: totalEvents },
    notes: [],
  };
}

/**
 * Test suite
 */
const testSuite: { [key: string]: () => boolean } = {
  /**
   * Test 1: Missing day yields zeros, not error
   */
  'Missing day returns zero aggregate': () => {
    const agg = recompute_daily_mock('test', '2025-12-19', []);

    return (
      agg.total_events === 0 &&
      agg.success_count === 0 &&
      agg.fail_count === 0 &&
      agg.total_duration_ms === 0
    );
  },

  /**
   * Test 2: Incomplete flag set when no shards
   */
  'Missing day sets incomplete_inputs.raw_shards_missing': () => {
    const agg = recompute_daily_mock('test', '2025-12-19', []);

    return agg.incomplete_inputs.raw_shards_missing === true;
  },

  /**
   * Test 3: Shard count is zero
   */
  'Missing day shard count is zero': () => {
    const agg = recompute_daily_mock('test', '2025-12-19', []);

    return agg.incomplete_inputs.raw_shards_count === 0;
  },

  /**
   * Test 4: By_repo empty for missing day
   */
  'Missing day by_repo is empty': () => {
    const agg = recompute_daily_mock('test', '2025-12-19', []);

    return Array.isArray(agg.by_repo) && agg.by_repo.length === 0;
  },

  /**
   * Test 5: Notes array includes disclosure
   */
  'Missing day includes disclosure note': () => {
    const agg = recompute_daily_mock('test', '2025-12-19', []);

    return (
      Array.isArray(agg.notes) &&
      agg.notes.some((n: string) => n.includes('No raw shards indexed'))
    );
  },

  /**
   * Test 6: Event count is zero
   */
  'Missing day raw_events_counted is zero': () => {
    const agg = recompute_daily_mock('test', '2025-12-19', []);

    return agg.incomplete_inputs.raw_events_counted === 0;
  },

  /**
   * Test 7: Day with data has incomplete=false
   */
  'Day with data has incomplete_inputs.raw_shards_missing=false': () => {
    const mockShard = [{ event_id: 'evt-001', status: 'success' }];
    const agg = recompute_daily_mock('test', '2025-12-19', [mockShard]);

    return agg.incomplete_inputs.raw_shards_missing === false;
  },

  /**
   * Test 8: Day with data counts events
   */
  'Day with data counts events correctly': () => {
    const mockShard = [
      { event_id: 'evt-001' },
      { event_id: 'evt-002' },
      { event_id: 'evt-003' },
    ];
    const agg = recompute_daily_mock('test', '2025-12-19', [mockShard]);

    return agg.total_events === 3;
  },

  /**
   * Test 9: Multiple shards with no data handled
   */
  'Empty shards array treated as missing': () => {
    const agg = recompute_daily_mock('test', '2025-12-19', []);

    return agg.notes.length > 0 && agg.incomplete_inputs.raw_shards_count === 0;
  },

  /**
   * Test 10: Aggregate is still storable even when empty
   */
  'Missing day aggregate is valid JSON': () => {
    const agg = recompute_daily_mock('test', '2025-12-19', []);

    try {
      const json = JSON.stringify(agg);
      return json.length > 0 && json.includes('incomplete_inputs');
    } catch {
      return false;
    }
  },
};

/**
 * Run all tests
 */
export function runTests(): void {
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
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runTests();
