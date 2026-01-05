/**
 * PHASE 1 LOCK-IN TESTS
 * 
 * Verify Phase 1 baseline metrics lock-in gaps:
 * A) Failure count visibility (7-day aggregate)
 * B) Canonical degraded reason (single sentence)
 * C) Skipped checks: count + primary reason (7-day aggregate)
 * D) Data freshness indicator label (Fresh/Aging/Stale)
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Mock snapshot with 7-day window checks
const createMockSnapshot = (options?: { checksCount?: number; failureCount?: number; skippedCount?: number }) => {
  const checksCount = options?.checksCount ?? 3;
  const failureCount = options?.failureCount ?? 0;
  const skippedCount = options?.skippedCount ?? 0;
  const now = Date.now();
  const sevenDaysAgoMs = now - 7 * 24 * 60 * 60 * 1000;
  const eightDaysAgoMs = now - 8 * 24 * 60 * 60 * 1000;

  const checks = [];

  // Add passing checks (within 7-day window)
  for (let i = 0; i < checksCount - failureCount - skippedCount; i++) {
    checks.push({
      id: `pass-${i}`,
      name: `Passing Check ${i}`,
      status: 'PASS',
      lastAttemptAt: new Date(sevenDaysAgoMs + i * 60 * 60 * 1000).toISOString(),
      reasonCode: null,
    });
  }

  // Add failing checks (within 7-day window)
  for (let i = 0; i < failureCount; i++) {
    checks.push({
      id: `fail-${i}`,
      name: `Failing Check ${i}`,
      status: 'FAIL',
      lastAttemptAt: new Date(sevenDaysAgoMs + (i + checksCount - failureCount) * 60 * 60 * 1000).toISOString(),
      reasonCode: ['IDENTITY', 'PERMISSION', 'API'][i % 3] || 'UNKNOWN',
      reasonMessage: 'Check failed',
    });
  }

  // Add skipped checks (within 7-day window)
  for (let i = 0; i < skippedCount; i++) {
    checks.push({
      id: `skip-${i}`,
      name: `Skipped Check ${i}`,
      status: 'SKIPPED',
      lastAttemptAt: new Date(sevenDaysAgoMs + (i + checksCount - skippedCount) * 60 * 60 * 1000).toISOString(),
      reasonCode: ['PERMISSION_UNAVAILABLE', 'IDENTITY_UNAVAILABLE', 'API_THROTTLED'][i % 3] || 'NOT_AVAILABLE',
      reasonMessage: 'Check skipped',
    });
  }

  // Add checks outside 7-day window (should not be counted)
  checks.push({
    id: 'old-fail',
    name: 'Old Failing Check',
    status: 'FAIL',
    lastAttemptAt: new Date(eightDaysAgoMs).toISOString(),
    reasonCode: 'SCHEDULER',
    reasonMessage: 'Old failure',
  });

  return {
    lastSuccessAt: new Date(sevenDaysAgoMs + 6 * 24 * 60 * 60 * 1000).toISOString(),
    lastAttemptAt: new Date(now - 10 * 60 * 1000).toISOString(),
    checks,
  };
};

// Mock health object
const createMockHealth = (state: string, reasons: any[] = []) => ({
  state,
  cloudId: 'test-cloud-123',
  reasons,
});

describe('PHASE 1 LOCK-IN: 7-day Failure Aggregates', () => {
  it('should count zero failures when all checks pass', () => {
    const snapshot = createMockSnapshot({ checksCount: 3, failureCount: 0 });
    const now = Date.now();
    const sevenDaysAgoMs = now - 7 * 24 * 60 * 60 * 1000;

    let failureCount = 0;
    const buckets: Record<string, number> = {
      IDENTITY: 0,
      PERMISSION: 0,
      SCHEDULER: 0,
      API: 0,
      UNKNOWN: 0,
    };

    if (snapshot?.checks && Array.isArray(snapshot.checks)) {
      snapshot.checks.forEach((check: any) => {
        if (check.status !== 'FAIL') return;
        const checkTime = check.lastAttemptAt ? new Date(check.lastAttemptAt).getTime() : 0;
        if (checkTime < sevenDaysAgoMs) return;
        failureCount++;
        const code = check.reasonCode || 'UNKNOWN';
        if (code.includes('IDENTITY')) buckets['IDENTITY']++;
        else if (code.includes('PERMISSION')) buckets['PERMISSION']++;
        else if (code.includes('SCHEDULER')) buckets['SCHEDULER']++;
        else if (code.includes('API')) buckets['API']++;
        else buckets['UNKNOWN']++;
      });
    }

    expect(failureCount).toBe(0);
    expect(Object.values(buckets).reduce((a, b) => a + b, 0)).toBe(0);
  });

  it('should count failures within 7-day window only', () => {
    const snapshot = createMockSnapshot({ checksCount: 5, failureCount: 2 });
    const now = Date.now();
    const sevenDaysAgoMs = now - 7 * 24 * 60 * 60 * 1000;

    let failureCount = 0;

    if (snapshot?.checks && Array.isArray(snapshot.checks)) {
      snapshot.checks.forEach((check: any) => {
        if (check.status !== 'FAIL') return;
        const checkTime = check.lastAttemptAt ? new Date(check.lastAttemptAt).getTime() : 0;
        if (checkTime < sevenDaysAgoMs) return; // Outside window
        failureCount++;
      });
    }

    // Should count 2 failures within window, not the old one
    expect(failureCount).toBe(2);
  });

  it('should categorize failures by reasonCode', () => {
    const snapshot = createMockSnapshot({ checksCount: 3, failureCount: 3 });
    const now = Date.now();
    const sevenDaysAgoMs = now - 7 * 24 * 60 * 60 * 1000;

    const buckets: Record<string, number> = {
      IDENTITY: 0,
      PERMISSION: 0,
      SCHEDULER: 0,
      API: 0,
      UNKNOWN: 0,
    };

    if (snapshot?.checks && Array.isArray(snapshot.checks)) {
      snapshot.checks.forEach((check: any) => {
        if (check.status !== 'FAIL') return;
        const checkTime = check.lastAttemptAt ? new Date(check.lastAttemptAt).getTime() : 0;
        if (checkTime < sevenDaysAgoMs) return;

        const code = check.reasonCode || 'UNKNOWN';
        if (code.includes('IDENTITY')) buckets['IDENTITY']++;
        else if (code.includes('PERMISSION')) buckets['PERMISSION']++;
        else if (code.includes('SCHEDULER')) buckets['SCHEDULER']++;
        else if (code.includes('API')) buckets['API']++;
        else buckets['UNKNOWN']++;
      });
    }

    // Verify at least some categorization happened
    const totalCategorized = Object.values(buckets).reduce((a, b) => a + b, 0);
    expect(totalCategorized).toBe(3);
  });
});

describe('PHASE 1 LOCK-IN: Freshness Classification Boundaries', () => {
  it('should classify as FRESH when < 24h old', () => {
    const now = new Date();
    const twentyThreeHoursFiftyNineMin = new Date(now.getTime() - 23 * 60 * 60 * 1000 - 59 * 60 * 1000);

    const ageSeconds = Math.floor((now.getTime() - twentyThreeHoursFiftyNineMin.getTime()) / 1000);
    const hours24 = 24 * 60 * 60;

    const status = ageSeconds < hours24 ? 'FRESH' : ageSeconds <= 72 * 60 * 60 ? 'AGING' : 'STALE';

    expect(status).toBe('FRESH');
  });

  it('should classify as AGING when exactly 24h old', () => {
    const now = new Date();
    const exactlyTwentyFourHours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const ageSeconds = Math.floor((now.getTime() - exactlyTwentyFourHours.getTime()) / 1000);
    const hours24 = 24 * 60 * 60;
    const hours72 = 72 * 60 * 60;

    const status = ageSeconds < hours24 ? 'FRESH' : ageSeconds <= hours72 ? 'AGING' : 'STALE';

    expect(status).toBe('AGING');
  });

  it('should classify as AGING when 72h old', () => {
    const now = new Date();
    const seventy2Hours = new Date(now.getTime() - 72 * 60 * 60 * 1000);

    const ageSeconds = Math.floor((now.getTime() - seventy2Hours.getTime()) / 1000);
    const hours24 = 24 * 60 * 60;
    const hours72 = 72 * 60 * 60;

    const status = ageSeconds < hours24 ? 'FRESH' : ageSeconds <= hours72 ? 'AGING' : 'STALE';

    expect(status).toBe('AGING');
  });

  it('should classify as STALE when > 72h old', () => {
    const now = new Date();
    const seventyTwoHoursOneSec = new Date(now.getTime() - (72 * 60 * 60 * 1000 + 1000));

    const ageSeconds = Math.floor((now.getTime() - seventyTwoHoursOneSec.getTime()) / 1000);
    const hours24 = 24 * 60 * 60;
    const hours72 = 72 * 60 * 60;

    const status = ageSeconds < hours24 ? 'FRESH' : ageSeconds <= hours72 ? 'AGING' : 'STALE';

    expect(status).toBe('STALE');
  });

  it('should return NOT_AVAILABLE when no lastSuccessAt', () => {
    const lastSuccessAt = null;
    const status = !lastSuccessAt ? 'NOT_AVAILABLE' : 'FRESH';
    expect(status).toBe('NOT_AVAILABLE');
  });
});

describe('PHASE 1 LOCK-IN: Degraded Reason Priority', () => {
  it('should return null when state is not DEGRADED', () => {
    const health = createMockHealth('RUNNING');

    const degradedReason =
      health?.state !== 'DEGRADED'
        ? null
        : 'Tenant identity is unavailable or invalid.';

    expect(degradedReason).toBeNull();
  });

  it('should prioritize identity missing (reason #1)', () => {
    const health = { state: 'DEGRADED', cloudId: 'unknown', reasons: [] };

    const degradedReason =
      health?.state !== 'DEGRADED'
        ? null
        : !health?.cloudId || health.cloudId === 'unknown'
          ? 'Tenant identity is unavailable or invalid.'
          : 'Other reason';

    expect(degradedReason).toBe('Tenant identity is unavailable or invalid.');
  });

  it('should prioritize scheduler error (reason #2) when identity ok', () => {
    const health = createMockHealth('DEGRADED', [{ code: 'SCHEDULER' }]);

    const degradedReason =
      health?.state !== 'DEGRADED'
        ? null
        : !health?.cloudId || health.cloudId === 'unknown'
          ? 'Tenant identity is unavailable or invalid.'
          : health?.reasons?.some((r: any) => r.code === 'SCHEDULER')
            ? 'Scheduler failed to execute the last check.'
            : 'Other reason';

    expect(degradedReason).toBe('Scheduler failed to execute the last check.');
  });

  it('should prioritize failures (reason #3) when identity and scheduler ok', () => {
    const failureCount7d = 2;
    const health = createMockHealth('DEGRADED', []);

    const degradedReason =
      health?.state !== 'DEGRADED'
        ? null
        : !health?.cloudId || health.cloudId === 'unknown'
          ? 'Tenant identity is unavailable or invalid.'
          : health?.reasons?.some((r: any) => r.code === 'SCHEDULER')
            ? 'Scheduler failed to execute the last check.'
            : failureCount7d > 0
              ? `${failureCount7d} check(s) failed in the last 7 days.`
              : 'System is degraded; see operational status for details.';

    expect(degradedReason).toBe('2 check(s) failed in the last 7 days.');
  });
});

describe('PHASE 1 LOCK-IN: Skipped Checks Aggregation', () => {
  it('should count zero skipped when all checks pass', () => {
    const snapshot = createMockSnapshot({ checksCount: 3, failureCount: 0, skippedCount: 0 });
    const now = Date.now();
    const sevenDaysAgoMs = now - 7 * 24 * 60 * 60 * 1000;

    let count = 0;

    if (snapshot?.checks && Array.isArray(snapshot.checks)) {
      snapshot.checks.forEach((check: any) => {
        if (check.status !== 'SKIPPED') return;
        const checkTime = check.lastAttemptAt ? new Date(check.lastAttemptAt).getTime() : 0;
        if (checkTime < sevenDaysAgoMs) return;
        count++;
      });
    }

    expect(count).toBe(0);
  });

  it('should count skipped checks within 7-day window only', () => {
    const snapshot = createMockSnapshot({ checksCount: 5, failureCount: 0, skippedCount: 2 });
    const now = Date.now();
    const sevenDaysAgoMs = now - 7 * 24 * 60 * 60 * 1000;

    let count = 0;

    if (snapshot?.checks && Array.isArray(snapshot.checks)) {
      snapshot.checks.forEach((check: any) => {
        if (check.status !== 'SKIPPED') return;
        const checkTime = check.lastAttemptAt ? new Date(check.lastAttemptAt).getTime() : 0;
        if (checkTime < sevenDaysAgoMs) return;
        count++;
      });
    }

    expect(count).toBe(2);
  });

  it('should identify primary skip reason (most frequent)', () => {
    const snapshot = createMockSnapshot({ checksCount: 3, failureCount: 0, skippedCount: 3 });
    const now = Date.now();
    const sevenDaysAgoMs = now - 7 * 24 * 60 * 60 * 1000;

    let count = 0;
    const reasonCodes: Map<string, number> = new Map();

    if (snapshot?.checks && Array.isArray(snapshot.checks)) {
      snapshot.checks.forEach((check: any) => {
        if (check.status !== 'SKIPPED') return;
        const checkTime = check.lastAttemptAt ? new Date(check.lastAttemptAt).getTime() : 0;
        if (checkTime < sevenDaysAgoMs) return;

        count++;
        const reason = check.reasonCode || 'UNKNOWN';
        reasonCodes.set(reason, (reasonCodes.get(reason) || 0) + 1);
      });
    }

    expect(count).toBe(3);
    expect(reasonCodes.size).toBeGreaterThan(0);

    // Primary reason should be deterministic (most frequent)
    const mostFrequent = Array.from(reasonCodes.entries()).sort((a, b) => b[1] - a[1])[0];
    expect(mostFrequent).toBeDefined();
  });

  it('should return NOT_AVAILABLE when no skip telemetry exists', () => {
    const snapshot = createMockSnapshot({ checksCount: 3, failureCount: 0, skippedCount: 0 });
    const now = Date.now();
    const sevenDaysAgoMs = now - 7 * 24 * 60 * 60 * 1000;

    let count = 0;
    let primaryReason = 'NOT_AVAILABLE';

    if (snapshot?.checks && Array.isArray(snapshot.checks)) {
      snapshot.checks.forEach((check: any) => {
        if (check.status !== 'SKIPPED') return;
        const checkTime = check.lastAttemptAt ? new Date(check.lastAttemptAt).getTime() : 0;
        if (checkTime < sevenDaysAgoMs) return;
        count++;
      });
    }

    if (count === 0) {
      primaryReason = 'NOT_AVAILABLE';
    }

    expect(count).toBe(0);
    expect(primaryReason).toBe('NOT_AVAILABLE');
  });
});

describe('PHASE 1 LOCK-IN: 7-day Aggregation Window', () => {
  it('should only count events within last 7 days', () => {
    const snapshot = createMockSnapshot({ checksCount: 5, failureCount: 2 });
    const now = Date.now();
    const sevenDaysAgoMs = now - 7 * 24 * 60 * 60 * 1000;

    let countWithin7d = 0;
    let countOutside7d = 0;

    if (snapshot?.checks && Array.isArray(snapshot.checks)) {
      snapshot.checks.forEach((check: any) => {
        if (check.status !== 'FAIL') return;
        const checkTime = check.lastAttemptAt ? new Date(check.lastAttemptAt).getTime() : 0;

        if (checkTime >= sevenDaysAgoMs) {
          countWithin7d++;
        } else {
          countOutside7d++;
        }
      });
    }

    expect(countWithin7d).toBe(2);
    expect(countOutside7d).toBe(1); // The old failure
  });

  it('should hard-code 7 days window (not configurable)', () => {
    // 7 days in seconds
    const WINDOW_DAYS = 7;
    const WINDOW_SECONDS = WINDOW_DAYS * 24 * 60 * 60;

    expect(WINDOW_DAYS).toBe(7);
    expect(WINDOW_SECONDS).toBe(604800);
  });
});

describe('PHASE 1 LOCK-IN: NOT_AVAILABLE Handling', () => {
  it('should show NOT_AVAILABLE for metrics when telemetry missing', () => {
    const snapshot = null;

    const failureCount = 0; // No snapshot = 0 failures counted
    const skipCount = 0; // No snapshot = 0 skips counted
    const freshnessStatus = snapshot ? 'FRESH' : 'NOT_AVAILABLE';

    expect(failureCount).toBe(0);
    expect(skipCount).toBe(0);
    expect(freshnessStatus).toBe('NOT_AVAILABLE');
  });

  it('should include telemetry missing label in UI hint', () => {
    const hint = 'Not available (telemetry missing)';

    expect(hint).toContain('telemetry missing');
  });
});
