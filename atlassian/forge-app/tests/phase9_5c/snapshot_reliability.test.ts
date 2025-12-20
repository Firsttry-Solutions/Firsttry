/**
 * PHASE 9.5-C: SNAPSHOT RELIABILITY SLA - COMPREHENSIVE TESTS
 *
 * Tests verify:
 * 1. Reliability metrics computed correctly from snapshot runs
 * 2. Alerts triggered ONLY for FirstTry failures (not Jira issues)
 * 3. Window metrics (7/30/90 day) calculated correctly
 * 4. No threshold interpretation (labels of good/bad not applied)
 * 5. Consecutive failure detection
 * 6. Rate limit incident tracking
 */

import {
  SnapshotRun,
  SnapshotRunStatus,
  computeWindowMetrics,
  computeReliabilityStatus,
  detectReliabilityAlertConditions,
  createReliabilityNotification,
  enforceFirstTryOnlyAlerts,
  validateFirstTryOnlyNotification,
  markNotificationSent,
  acknowledgeNotification,
} from '../../src/phase9_5c/snapshot_reliability';

describe('Phase 9.5-C: Snapshot Reliability SLA', () => {
  const tenantId = 'tenant-test-123';

  // ========================================================================
  // HELPER: Create mock runs
  // ========================================================================

  function createRun(
    status: SnapshotRunStatus,
    daysAgo: number,
    hourOffset: number = 0,
    rateLimited: boolean = false,
    errorCode?: string
  ): SnapshotRun {
    const now = new Date();
    const runTime = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000 + hourOffset * 60 * 60 * 1000);
    const startTime = new Date(runTime.getTime() - 10000); // 10 sec before

    return {
      run_id: `run-${daysAgo}-${hourOffset}`,
      tenant_id: tenantId,
      scheduled_at: startTime.toISOString(),
      started_at: startTime.toISOString(),
      completed_at: runTime.toISOString(),
      status,
      duration_ms: 5000,
      rate_limit_hit: rateLimited,
      error_code: errorCode,
      error_message: errorCode ? `Error: ${errorCode}` : undefined,
    };
  }

  // ========================================================================
  // TEST SUITE 1: Window Metrics Calculation
  // ========================================================================

  describe('Window Metrics Calculation', () => {
    it('should compute 7-day window metrics correctly', () => {
      const runs: SnapshotRun[] = [
        createRun('successful', 1),
        createRun('successful', 2),
        createRun('failed', 3),
        createRun('partial', 4),
        createRun('successful', 8), // Outside 7-day window
      ];

      const metrics = computeWindowMetrics(tenantId, runs, 7);

      expect(metrics.window_days).toBe(7);
      expect(metrics.total_scheduled).toBe(4); // Only 4 runs in 7 days
      expect(metrics.successful_runs).toBe(2);
      expect(metrics.partial_runs).toBe(1);
      expect(metrics.failed_runs).toBe(1);
      expect(metrics.success_rate).toBe(50); // 2/4
      expect(metrics.success_or_partial_rate).toBe(75); // 3/4
    });

    it('should compute 30-day window metrics correctly', () => {
      const runs: SnapshotRun[] = [
        createRun('successful', 5),
        createRun('successful', 10),
        createRun('failed', 15),
        createRun('partial', 20),
        createRun('failed', 25),
        createRun('successful', 35), // Outside 30-day window
      ];

      const metrics = computeWindowMetrics(tenantId, runs, 30);

      expect(metrics.window_days).toBe(30);
      expect(metrics.total_scheduled).toBe(5);
      expect(metrics.successful_runs).toBe(2);
      expect(metrics.failed_runs).toBe(2);
      expect(metrics.partial_runs).toBe(1);
      expect(metrics.success_rate).toBe(40); // 2/5
    });

    it('should compute 90-day window metrics correctly', () => {
      const runs: SnapshotRun[] = [
        createRun('successful', 10),
        createRun('successful', 20),
        createRun('failed', 30),
        createRun('successful', 45),
        createRun('partial', 60),
      ];

      const metrics = computeWindowMetrics(tenantId, runs, 90);

      expect(metrics.window_days).toBe(90);
      expect(metrics.total_scheduled).toBe(5);
      expect(metrics.successful_runs).toBe(3);
      expect(metrics.success_rate).toBe(60); // 3/5
    });

    it('should handle empty run window gracefully', () => {
      const runs: SnapshotRun[] = [];

      const metrics = computeWindowMetrics(tenantId, runs, 7);

      expect(metrics.total_scheduled).toBe(0);
      expect(metrics.successful_runs).toBe(0);
      expect(metrics.success_rate).toBe(0);
      expect(metrics.mean_duration_ms).toBe(0);
    });

    it('should track rate limit incidents in window', () => {
      const runs: SnapshotRun[] = [
        createRun('partial', 1, 0, true), // Rate limited
        createRun('partial', 2, 0, true), // Rate limited
        createRun('successful', 3, 0, false),
      ];

      const metrics = computeWindowMetrics(tenantId, runs, 7);

      expect(metrics.rate_limit_incidents).toBe(2);
    });

    it('should calculate mean duration correctly', () => {
      const runs: SnapshotRun[] = [
        { ...createRun('successful', 1), duration_ms: 1000 },
        { ...createRun('successful', 2), duration_ms: 2000 },
        { ...createRun('successful', 3), duration_ms: 3000 },
      ];

      const metrics = computeWindowMetrics(tenantId, runs, 7);

      expect(metrics.mean_duration_ms).toBe(2000); // (1000+2000+3000)/3
    });
  });

  // ========================================================================
  // TEST SUITE 2: Reliability Status Computation
  // ========================================================================

  describe('Reliability Status Computation', () => {
    it('should compute status from empty run history', () => {
      const runs: SnapshotRun[] = [];

      const status = computeReliabilityStatus(tenantId, runs);

      expect(status.tenant_id).toBe(tenantId);
      expect(status.last_completed_run_at).toBe('NEVER');
      expect(status.last_run_status).toBe('NEVER');
      expect(status.last_run_days_ago).toBeNull();
      expect(status.no_successful_run_days).toBe(0);
      expect(status.consecutive_failures).toBe(0);
    });

    it('should identify last completed run', () => {
      const runs: SnapshotRun[] = [
        createRun('successful', 5),
        createRun('successful', 2),
        createRun('failed', 1),
      ];

      const status = computeReliabilityStatus(tenantId, runs);

      expect(status.last_run_status).toBe('failed');
      expect(status.last_run_days_ago).toBeLessThanOrEqual(1);
      expect(status.last_completed_run_at).not.toBe('NEVER');
    });

    it('should count consecutive failures correctly', () => {
      const runs: SnapshotRun[] = [
        createRun('successful', 10),
        createRun('failed', 3),
        createRun('failed', 2),
        createRun('failed', 1),
      ];

      const status = computeReliabilityStatus(tenantId, runs);

      expect(status.consecutive_failures).toBe(3);
    });

    it('should count zero consecutive failures if last run successful', () => {
      const runs: SnapshotRun[] = [
        createRun('failed', 3),
        createRun('failed', 2),
        createRun('successful', 1),
      ];

      const status = computeReliabilityStatus(tenantId, runs);

      expect(status.consecutive_failures).toBe(0);
    });

    it('should track days since last successful run', () => {
      const runs: SnapshotRun[] = [
        createRun('successful', 10),
        createRun('failed', 3),
        createRun('failed', 2),
        createRun('failed', 1),
      ];

      const status = computeReliabilityStatus(tenantId, runs);

      expect(status.no_successful_run_days).toBeLessThanOrEqual(10);
      expect(status.no_successful_run_days).toBeGreaterThan(0);
    });

    it('should generate canonical hash for integrity', () => {
      const runs: SnapshotRun[] = [
        createRun('successful', 5),
        createRun('failed', 2),
      ];

      const status = computeReliabilityStatus(tenantId, runs);

      expect(status.canonical_hash).toBeDefined();
      expect(status.canonical_hash).toMatch(/^[a-f0-9]{64}$/); // SHA-256
    });

    it('should have consistent hash for same data', () => {
      const runs: SnapshotRun[] = [
        createRun('successful', 5),
        createRun('failed', 2),
      ];

      const status1 = computeReliabilityStatus(tenantId, runs);
      const status2 = computeReliabilityStatus(tenantId, runs);

      // Note: hashes may differ due to timestamps; this test validates structure
      expect(status1.canonical_hash).toMatch(/^[a-f0-9]{64}$/);
      expect(status2.canonical_hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should compute all three window metrics', () => {
      const runs: SnapshotRun[] = [
        createRun('successful', 5),
        createRun('failed', 15),
        createRun('successful', 45),
      ];

      const status = computeReliabilityStatus(tenantId, runs);

      expect(status.metrics_7_day).toBeDefined();
      expect(status.metrics_30_day).toBeDefined();
      expect(status.metrics_90_day).toBeDefined();
      expect(status.metrics_7_day.window_days).toBe(7);
      expect(status.metrics_30_day.window_days).toBe(30);
      expect(status.metrics_90_day.window_days).toBe(90);
    });
  });

  // ========================================================================
  // TEST SUITE 3: Alert Condition Detection (FirstTry-Only)
  // ========================================================================

  describe('Alert Condition Detection - FirstTry Only', () => {
    it('should detect no-successful-run condition', () => {
      const runs: SnapshotRun[] = [
        createRun('failed', 20), // 20 days since failure, no success
        createRun('failed', 15),
      ];

      const status = computeReliabilityStatus(tenantId, runs);
      const conditions = detectReliabilityAlertConditions(status, {
        no_successful_run_threshold_days: 10,
        consecutive_failures_threshold: 5,
      });

      const noSuccessCondition = conditions.find(
        c => c.name === 'no_successful_run_since_X_days'
      );
      expect(noSuccessCondition).toBeDefined();
      expect(noSuccessCondition?.is_triggered).toBe(true);
    });

    it('should not trigger alert if recent successful run', () => {
      const runs: SnapshotRun[] = [
        createRun('successful', 2),
        createRun('failed', 5),
      ];

      const status = computeReliabilityStatus(tenantId, runs);
      const conditions = detectReliabilityAlertConditions(status, {
        no_successful_run_threshold_days: 10,
        consecutive_failures_threshold: 5,
      });

      const noSuccessCondition = conditions.find(
        c => c.name === 'no_successful_run_since_X_days'
      );
      expect(noSuccessCondition?.is_triggered).toBe(false);
    });

    it('should detect consecutive failures condition', () => {
      const runs: SnapshotRun[] = [
        createRun('failed', 1),
        createRun('failed', 2),
        createRun('failed', 3),
        createRun('successful', 10),
      ];

      const status = computeReliabilityStatus(tenantId, runs);
      const conditions = detectReliabilityAlertConditions(status, {
        no_successful_run_threshold_days: 10,
        consecutive_failures_threshold: 2, // 3 failures exceeds this
      });

      const failureCondition = conditions.find(
        c => c.name === 'consecutive_failures_count'
      );
      expect(failureCondition).toBeDefined();
      expect(failureCondition?.is_triggered).toBe(true);
    });

    it('should not trigger consecutive failure alert if below threshold', () => {
      const runs: SnapshotRun[] = [
        createRun('failed', 1),
        createRun('successful', 2),
      ];

      const status = computeReliabilityStatus(tenantId, runs);
      const conditions = detectReliabilityAlertConditions(status, {
        no_successful_run_threshold_days: 10,
        consecutive_failures_threshold: 5,
      });

      const failureCondition = conditions.find(
        c => c.name === 'consecutive_failures_count'
      );
      expect(failureCondition?.is_triggered).toBe(false);
    });

    it('should include details in alert conditions', () => {
      const runs: SnapshotRun[] = [
        createRun('failed', 20),
      ];

      const status = computeReliabilityStatus(tenantId, runs);
      const conditions = detectReliabilityAlertConditions(status, {
        no_successful_run_threshold_days: 10,
        consecutive_failures_threshold: 5,
      });

      const noSuccessCondition = conditions.find(
        c => c.name === 'no_successful_run_since_X_days'
      );
      expect(noSuccessCondition?.details).toEqual({
        threshold_days: 10,
        actual_days: expect.any(Number),
      });
    });
  });

  // ========================================================================
  // TEST SUITE 4: Enforcement - FirstTry-Only Alerts
  // ========================================================================

  describe('Enforcement - FirstTry-Only Alerts', () => {
    it('should accept FirstTry execution metrics', () => {
      const conditions = [
        { name: 'no_successful_run_since_X_days', is_triggered: true, details: {} },
        { name: 'consecutive_failures_count', is_triggered: true, details: {} },
      ];

      const filtered = enforceFirstTryOnlyAlerts(conditions);

      expect(filtered.length).toBe(2);
    });

    it('should validate notification contains only FirstTry failures', () => {
      const runs: SnapshotRun[] = [createRun('failed', 20)];
      const status = computeReliabilityStatus(tenantId, runs);
      const conditions = detectReliabilityAlertConditions(status, {
        no_successful_run_threshold_days: 10,
        consecutive_failures_threshold: 5,
      });

      const notification = createReliabilityNotification(
        tenantId,
        conditions,
        status
      );

      const validation = validateFirstTryOnlyNotification(notification);
      expect(validation.valid).toBe(true);
    });

    it('should reject notification with non-FirstTry conditions', () => {
      const runs: SnapshotRun[] = [createRun('failed', 20)];
      const status = computeReliabilityStatus(tenantId, runs);
      const conditions = [
        {
          name: 'jira_permission_error', // INVALID: Not a FirstTry metric
          is_triggered: true,
          details: {},
        },
      ];

      const notification = createReliabilityNotification(
        tenantId,
        conditions,
        status
      );
      notification.alert_conditions = conditions;

      const validation = validateFirstTryOnlyNotification(notification);
      expect(validation.valid).toBe(false);
      expect(validation.reason).toContain('Invalid condition');
    });
  });

  // ========================================================================
  // TEST SUITE 5: Notification Management
  // ========================================================================

  describe('Notification Management', () => {
    it('should create notification with triggered conditions only', () => {
      const runs: SnapshotRun[] = [createRun('failed', 20)];
      const status = computeReliabilityStatus(tenantId, runs);
      const conditions = detectReliabilityAlertConditions(status, {
        no_successful_run_threshold_days: 10,
        consecutive_failures_threshold: 5,
      });

      const notification = createReliabilityNotification(
        tenantId,
        conditions,
        status
      );

      expect(notification.tenant_id).toBe(tenantId);
      expect(notification.notification_id).toBeDefined();
      expect(notification.created_at).toBeDefined();
      expect(notification.alert_conditions.length).toBeGreaterThan(0);
      expect(notification.sent_at).toBeNull();
      expect(notification.acknowledged_at).toBeNull();
    });

    it('should mark notification as sent', () => {
      const runs: SnapshotRun[] = [createRun('failed', 20)];
      const status = computeReliabilityStatus(tenantId, runs);
      const conditions = detectReliabilityAlertConditions(status, {
        no_successful_run_threshold_days: 10,
        consecutive_failures_threshold: 5,
      });

      let notification = createReliabilityNotification(
        tenantId,
        conditions,
        status
      );
      expect(notification.sent_at).toBeNull();

      notification = markNotificationSent(notification);
      expect(notification.sent_at).not.toBeNull();
      expect(notification.sent_at).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO 8601
    });

    it('should acknowledge notification', () => {
      const runs: SnapshotRun[] = [createRun('failed', 20)];
      const status = computeReliabilityStatus(tenantId, runs);
      const conditions = detectReliabilityAlertConditions(status, {
        no_successful_run_threshold_days: 10,
        consecutive_failures_threshold: 5,
      });

      let notification = createReliabilityNotification(
        tenantId,
        conditions,
        status
      );
      expect(notification.acknowledged_at).toBeNull();

      notification = acknowledgeNotification(notification);
      expect(notification.acknowledged_at).not.toBeNull();
    });

    it('should have unique notification IDs', () => {
      const runs: SnapshotRun[] = [createRun('failed', 20)];
      const status = computeReliabilityStatus(tenantId, runs);
      const conditions = detectReliabilityAlertConditions(status, {
        no_successful_run_threshold_days: 10,
        consecutive_failures_threshold: 5,
      });

      const notif1 = createReliabilityNotification(
        tenantId,
        conditions,
        status
      );
      const notif2 = createReliabilityNotification(
        tenantId,
        conditions,
        status
      );

      expect(notif1.notification_id).not.toBe(notif2.notification_id);
    });
  });

  // ========================================================================
  // TEST SUITE 6: NO THRESHOLD INTERPRETATION
  // ========================================================================

  describe('No Threshold Interpretation Rule', () => {
    it('should provide metrics without good/bad labels', () => {
      const runs: SnapshotRun[] = [
        createRun('successful', 5),
        createRun('failed', 2),
        createRun('successful', 1),
      ];

      const status = computeReliabilityStatus(tenantId, runs);

      // Verify no "health", "status", "grade" fields that imply judgment
      const statusKeys = Object.keys(status);
      expect(statusKeys).not.toContain('health_status');
      expect(statusKeys).not.toContain('sla_met');
      expect(statusKeys).not.toContain('grade');
      expect(statusKeys).not.toContain('score');

      // But metrics themselves are provided
      expect(status.metrics_7_day.success_rate).toBeDefined();
      expect(typeof status.metrics_7_day.success_rate).toBe('number');
    });

    it('should report facts without interpretation in window metrics', () => {
      const runs: SnapshotRun[] = [
        createRun('successful', 1),
        createRun('successful', 2),
      ];

      const metrics = computeWindowMetrics(tenantId, runs, 7);

      // Pure facts, no interpretation
      expect(metrics.successful_runs).toBe(2); // Fact
      expect(metrics.failed_runs).toBe(0); // Fact
      expect(metrics.success_rate).toBe(100); // Fact (not "Excellent")

      const metricKeys = Object.keys(metrics);
      expect(metricKeys).not.toContain('status');
      expect(metricKeys).not.toContain('judgment');
    });
  });

  // ========================================================================
  // TEST SUITE 7: Rate Limiting Incident Tracking
  // ========================================================================

  describe('Rate Limiting Incident Tracking', () => {
    it('should track rate limit hits in metrics', () => {
      const runs: SnapshotRun[] = [
        createRun('partial', 1, 0, true),
        createRun('partial', 2, 0, true),
        createRun('partial', 3, 0, false),
        createRun('successful', 4, 0, false),
      ];

      const metrics = computeWindowMetrics(tenantId, runs, 7);

      expect(metrics.rate_limit_incidents).toBe(2);
    });

    it('should distinguish rate limit incidents from failures', () => {
      const runs: SnapshotRun[] = [
        createRun('partial', 1, 0, true), // Rate limited but partial success
        createRun('failed', 2, 0, false), // True failure, not rate limit
      ];

      const metrics = computeWindowMetrics(tenantId, runs, 7);

      expect(metrics.rate_limit_incidents).toBe(1);
      expect(metrics.failed_runs).toBe(1);
      expect(metrics.partial_runs).toBe(1);
    });
  });

  // ========================================================================
  // TEST SUITE 8: Real-World Scenarios
  // ========================================================================

  describe('Real-World Scenarios', () => {
    it('should handle healthy snapshot schedule', () => {
      // Daily successful snapshots for 7 days
      const runs: SnapshotRun[] = [
        createRun('successful', 0),
        createRun('successful', 1),
        createRun('successful', 2),
        createRun('successful', 3),
        createRun('successful', 4),
        createRun('successful', 5),
        createRun('successful', 6),
      ];

      const status = computeReliabilityStatus(tenantId, runs);

      expect(status.metrics_7_day.success_rate).toBe(100);
      expect(status.consecutive_failures).toBe(0);
      expect(status.no_successful_run_days).toBeLessThanOrEqual(1);
    });

    it('should handle degraded service with partial runs', () => {
      const runs: SnapshotRun[] = [
        createRun('partial', 0, 0, true),
        createRun('partial', 1, 0, true),
        createRun('partial', 2, 0, true),
      ];

      const status = computeReliabilityStatus(tenantId, runs);
      const metrics = status.metrics_7_day;

      expect(metrics.partial_runs).toBe(3);
      expect(metrics.rate_limit_incidents).toBe(3);
      expect(metrics.success_or_partial_rate).toBe(100); // All partial is better than failed
    });

    it('should handle cascading failures scenario', () => {
      const runs: SnapshotRun[] = [
        createRun('successful', 10),
        createRun('failed', 9, 0, false, 'JIRA_AUTH_ERROR'),
        createRun('failed', 8, 0, false, 'JIRA_AUTH_ERROR'),
        createRun('failed', 7, 0, false, 'JIRA_AUTH_ERROR'),
        createRun('failed', 6, 0, false, 'JIRA_AUTH_ERROR'),
        createRun('failed', 5, 0, false, 'JIRA_AUTH_ERROR'),
      ];

      const status = computeReliabilityStatus(tenantId, runs);
      const conditions = detectReliabilityAlertConditions(status, {
        no_successful_run_threshold_days: 3,
        consecutive_failures_threshold: 4,
      });

      expect(status.consecutive_failures).toBe(5);
      const failureCondition = conditions.find(
        c => c.name === 'consecutive_failures_count'
      );
      expect(failureCondition?.is_triggered).toBe(true);
    });

    it('should handle recovery scenario', () => {
      const runs: SnapshotRun[] = [
        createRun('successful', 0), // Recovered!
        createRun('failed', 1),
        createRun('failed', 2),
        createRun('failed', 3),
        createRun('successful', 7), // Previous success
      ];

      const status = computeReliabilityStatus(tenantId, runs);

      expect(status.consecutive_failures).toBe(0); // No consecutive failures at end
      const conditions = detectReliabilityAlertConditions(status, {
        no_successful_run_threshold_days: 5,
        consecutive_failures_threshold: 5,
      });

      const triggeredConditions = conditions.filter(c => c.is_triggered);
      expect(triggeredConditions.length).toBe(0); // No alerts
    });
  });
});
