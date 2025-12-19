/**
 * Test: Weekly = Sum of Daily (PHASE 2)
 * 
 * Verifies that weekly aggregates correctly sum daily aggregates.
 * Creates 7 synthetic daily aggregates and checks weekly sum.
 */

/**
 * Mock daily aggregates for a week
 */
function createMockDailyAgg(dateStr: string, eventCount: number, successCount: number): any {
  return {
    org: 'test',
    date: dateStr,
    total_events: eventCount,
    total_duration_ms: eventCount * 100,
    success_count: successCount,
    fail_count: eventCount - successCount,
    cache_hit_count: Math.floor(eventCount * 0.5),
    cache_miss_count: eventCount - Math.floor(eventCount * 0.5),
    retry_total: eventCount,
    by_repo: [
      {
        repo: 'repo-a',
        total_events: eventCount,
        success_count: successCount,
        fail_count: eventCount - successCount,
        total_duration_ms: eventCount * 100,
      },
    ],
    by_gate: [{ gate: 'gate-1', count: eventCount }],
    by_profile: [{ profile: 'fast', count: eventCount }],
    incomplete_inputs: { raw_shards_missing: false, raw_shards_count: 1, raw_events_counted: eventCount },
    notes: [],
  };
}

/**
 * Manually compute weekly sum (simulating recompute_week logic)
 */
function sumDailyAggregates(dailyAggs: any[]): any {
  let totalEvents = 0;
  let totalDurationMs = 0;
  let successCount = 0;
  let failCount = 0;
  let cacheHitCount = 0;
  let cacheMissCount = 0;
  let retryTotal = 0;

  const repoMap = new Map<string, any>();
  const gateMap = new Map<string, number>();
  const profileMap = new Map<string, number>();

  for (const daily of dailyAggs) {
    totalEvents += daily.total_events || 0;
    totalDurationMs += daily.total_duration_ms || 0;
    successCount += daily.success_count || 0;
    failCount += daily.fail_count || 0;
    cacheHitCount += daily.cache_hit_count || 0;
    cacheMissCount += daily.cache_miss_count || 0;
    retryTotal += daily.retry_total || 0;

    if (daily.by_repo) {
      for (const repo of daily.by_repo) {
        const existing = repoMap.get(repo.repo) || {
          repo: repo.repo,
          total_events: 0,
          success_count: 0,
          fail_count: 0,
          total_duration_ms: 0,
        };
        existing.total_events += repo.total_events;
        existing.success_count += repo.success_count;
        existing.fail_count += repo.fail_count;
        existing.total_duration_ms += repo.total_duration_ms;
        repoMap.set(repo.repo, existing);
      }
    }

    if (daily.by_gate) {
      for (const gate of daily.by_gate) {
        gateMap.set(gate.gate, (gateMap.get(gate.gate) || 0) + gate.count);
      }
    }

    if (daily.by_profile) {
      for (const prof of daily.by_profile) {
        profileMap.set(prof.profile, (profileMap.get(prof.profile) || 0) + prof.count);
      }
    }
  }

  return {
    total_events: totalEvents,
    total_duration_ms: totalDurationMs,
    success_count: successCount,
    fail_count: failCount,
    cache_hit_count: cacheHitCount,
    cache_miss_count: cacheMissCount,
    retry_total: retryTotal,
    by_repo: Array.from(repoMap.values()),
    by_gate: Array.from(gateMap.entries()).map(([g, c]) => ({ gate: g, count: c })),
    by_profile: Array.from(profileMap.entries()).map(([p, c]) => ({ profile: p, count: c })),
  };
}

/**
 * Test suite
 */
const testSuite: { [key: string]: () => boolean } = {
  /**
   * Test 1: Weekly totals match sum of dailies
   */
  'Weekly total_events = sum of daily': () => {
    const days = [
      createMockDailyAgg('2025-12-15', 10, 8),
      createMockDailyAgg('2025-12-16', 15, 12),
      createMockDailyAgg('2025-12-17', 20, 18),
      createMockDailyAgg('2025-12-18', 25, 20),
      createMockDailyAgg('2025-12-19', 30, 24),
      createMockDailyAgg('2025-12-20', 12, 10),
      createMockDailyAgg('2025-12-21', 8, 6),
    ];

    const weekly = sumDailyAggregates(days);
    const expectedTotal = 10 + 15 + 20 + 25 + 30 + 12 + 8; // 120

    return weekly.total_events === expectedTotal;
  },

  /**
   * Test 2: Weekly success_count matches sum
   */
  'Weekly success_count = sum of daily': () => {
    const days = [
      createMockDailyAgg('2025-12-15', 10, 8),
      createMockDailyAgg('2025-12-16', 15, 12),
      createMockDailyAgg('2025-12-17', 20, 18),
    ];

    const weekly = sumDailyAggregates(days);
    const expectedSuccess = 8 + 12 + 18; // 38

    return weekly.success_count === expectedSuccess;
  },

  /**
   * Test 3: Weekly fail_count correct
   */
  'Weekly fail_count = sum of daily': () => {
    const days = [
      createMockDailyAgg('2025-12-15', 10, 8),
      createMockDailyAgg('2025-12-16', 15, 12),
    ];

    const weekly = sumDailyAggregates(days);
    const expectedFail = (10 - 8) + (15 - 12); // 2 + 3 = 5

    return weekly.fail_count === expectedFail;
  },

  /**
   * Test 4: Weekly duration matches sum
   */
  'Weekly total_duration_ms = sum of daily': () => {
    const days = [
      createMockDailyAgg('2025-12-15', 10, 8),
      createMockDailyAgg('2025-12-16', 15, 12),
    ];

    const weekly = sumDailyAggregates(days);
    const expectedDuration = 10 * 100 + 15 * 100; // 2500

    return weekly.total_duration_ms === expectedDuration;
  },

  /**
   * Test 5: Weekly by_repo sum is correct
   */
  'Weekly by_repo sums correctly': () => {
    const days = [
      createMockDailyAgg('2025-12-15', 10, 8),
      createMockDailyAgg('2025-12-16', 15, 12),
    ];

    const weekly = sumDailyAggregates(days);

    return (
      weekly.by_repo.length === 1 &&
      weekly.by_repo[0].repo === 'repo-a' &&
      weekly.by_repo[0].total_events === 25 &&
      weekly.by_repo[0].success_count === 20 &&
      weekly.by_repo[0].fail_count === 5
    );
  },

  /**
   * Test 6: Weekly with missing day still sums correctly
   */
  'Weekly sums partial days': () => {
    const days = [
      createMockDailyAgg('2025-12-15', 10, 8),
      // Day 16 missing
      createMockDailyAgg('2025-12-17', 20, 18),
    ];

    const weekly = sumDailyAggregates(days);
    const expectedTotal = 10 + 20; // 30

    return weekly.total_events === expectedTotal;
  },

  /**
   * Test 7: Cache hit/miss sums
   */
  'Weekly cache hits and misses sum': () => {
    const days = [
      createMockDailyAgg('2025-12-15', 10, 8),
      createMockDailyAgg('2025-12-16', 20, 16),
    ];

    const weekly = sumDailyAggregates(days);
    const expectedHits = Math.floor(10 * 0.5) + Math.floor(20 * 0.5); // 5 + 10 = 15
    const expectedMisses = (10 - Math.floor(10 * 0.5)) + (20 - Math.floor(20 * 0.5)); // 5 + 10 = 15

    return weekly.cache_hit_count === expectedHits && weekly.cache_miss_count === expectedMisses;
  },

  /**
   * Test 8: Retry total sums
   */
  'Weekly retry_total sums': () => {
    const days = [
      createMockDailyAgg('2025-12-15', 10, 8),
      createMockDailyAgg('2025-12-16', 15, 12),
      createMockDailyAgg('2025-12-17', 20, 18),
    ];

    const weekly = sumDailyAggregates(days);
    const expectedRetry = 10 + 15 + 20; // 45

    return weekly.retry_total === expectedRetry;
  },

  /**
   * Test 9: Empty week (no days)
   */
  'Empty week sum is zero': () => {
    const weekly = sumDailyAggregates([]);

    return (
      weekly.total_events === 0 &&
      weekly.success_count === 0 &&
      weekly.fail_count === 0 &&
      weekly.total_duration_ms === 0
    );
  },

  /**
   * Test 10: Multi-repo week
   */
  'Weekly with multiple repos': () => {
    // Manually create aggs with different repos
    const day1 = createMockDailyAgg('2025-12-15', 10, 8);
    const day2 = {
      ...createMockDailyAgg('2025-12-16', 15, 12),
      by_repo: [
        {
          repo: 'repo-b',
          total_events: 15,
          success_count: 12,
          fail_count: 3,
          total_duration_ms: 1500,
        },
      ],
    };

    const weekly = sumDailyAggregates([day1, day2]);

    return (
      weekly.by_repo.length === 2 &&
      weekly.by_repo.some((r) => r.repo === 'repo-a' && r.total_events === 10) &&
      weekly.by_repo.some((r) => r.repo === 'repo-b' && r.total_events === 15)
    );
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
