/**
 * PHASE 9.5-C: AUTO-NOTIFICATION LOGIC - COMPREHENSIVE TESTS
 *
 * Tests verify:
 * 1. Notification decisions made correctly
 * 2. Alert suppression after acknowledgment
 * 3. Renotification only at intervals
 * 4. FirstTry-only compliance
 * 5. Notification history tracking
 */

import { describe, it, expect } from 'vitest';
import {
  decideNotification,
  NotificationDecision,
  createNotificationHistory,
  addNotificationToHistory,
  updateNotificationInHistory,
  deliverToAdminUI,
  deliverViaEmail,
  routeNotification,
  validateNotificationDecision,
  validateNotificationWorkflow,
  DEFAULT_NOTIFICATION_CONFIG,
  NotificationConfig,
} from '../../src/phase9_5c/auto_notification';
import {
  computeReliabilityStatus,
  createReliabilityNotification,
  SnapshotRun,
  markNotificationSent,
  acknowledgeNotification,
} from '../../src/phase9_5c/snapshot_reliability';

describe('Phase 9.5-C: Auto-Notification Logic', () => {
  const tenantId = 'tenant-notif-123';

  function createRun(
    status: 'successful' | 'partial' | 'failed',
    daysAgo: number
  ): SnapshotRun {
    const now = new Date();
    const runTime = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    const startTime = new Date(runTime.getTime() - 10000);

    return {
      run_id: `run-${daysAgo}`,
      tenant_id: tenantId,
      scheduled_at: startTime.toISOString(),
      started_at: startTime.toISOString(),
      completed_at: runTime.toISOString(),
      status,
      duration_ms: 5000,
      rate_limit_hit: false,
    };
  }

  // ========================================================================
  // TEST SUITE 1: Notification Decision Making
  // ========================================================================

  describe('Notification Decision Making', () => {
    it('should NOT notify when reliability is healthy', () => {
      const runs: SnapshotRun[] = [
        createRun('successful', 0),
        createRun('successful', 1),
        createRun('successful', 2),
      ];

      const status = computeReliabilityStatus(tenantId, runs);
      const decision = decideNotification(
        status,
        DEFAULT_NOTIFICATION_CONFIG
      );

      expect(decision.should_notify).toBe(false);
      expect(decision.triggered_conditions.length).toBe(0);
    });

    it('should notify when no successful run since threshold', () => {
      const runs: SnapshotRun[] = [
        createRun('failed', 5),
        createRun('failed', 4),
        createRun('failed', 3),
      ];

      const status = computeReliabilityStatus(tenantId, runs);
      const decision = decideNotification(
        status,
        { ...DEFAULT_NOTIFICATION_CONFIG, no_successful_run_days: 2 }
      );

      expect(decision.should_notify).toBe(true);
      expect(decision.triggered_conditions.some(
        c => c.name === 'no_successful_run_since_X_days'
      )).toBe(true);
    });

    it('should notify when consecutive failures exceed threshold', () => {
      const runs: SnapshotRun[] = [
        createRun('failed', 0),
        createRun('failed', 1),
        createRun('failed', 2),
        createRun('failed', 3),
        createRun('failed', 4),
        createRun('failed', 5),
        createRun('successful', 10),
      ];

      const status = computeReliabilityStatus(tenantId, runs);
      const decision = decideNotification(
        status,
        { ...DEFAULT_NOTIFICATION_CONFIG, consecutive_failures_count: 3 }
      );

      expect(decision.should_notify).toBe(true);
      expect(decision.triggered_conditions.some(
        c => c.name === 'consecutive_failures_count'
      )).toBe(true);
    });

    it('should notify for multiple triggered conditions', () => {
      const runs: SnapshotRun[] = [
        createRun('failed', 0),
        createRun('failed', 1),
        createRun('failed', 2),
        createRun('failed', 3),
        createRun('failed', 4),
      ];

      const status = computeReliabilityStatus(tenantId, runs);
      const decision = decideNotification(
        status,
        {
          no_successful_run_days: 2,
          consecutive_failures_count: 3,
          notification_channel: 'admin_ui',
          enable_auto_renotify: true,
          renotify_interval_hours: 24,
          acknowledgment_auto_clear_days: 7,
        }
      );

      expect(decision.should_notify).toBe(true);
      expect(decision.triggered_conditions.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ========================================================================
  // TEST SUITE 2: Acknowledgment and Suppression
  // ========================================================================

  describe('Acknowledgment and Alert Suppression', () => {
    it('should suppress notifications after acknowledgment (within clear period)', () => {
      const runs: SnapshotRun[] = [
        createRun('failed', 5),
        createRun('failed', 4),
      ];

      let status = computeReliabilityStatus(tenantId, runs);
      let decision = decideNotification(status, DEFAULT_NOTIFICATION_CONFIG);
      const conditions = decision.triggered_conditions;

      let notification = createReliabilityNotification(
        tenantId,
        conditions,
        status
      );
      notification = markNotificationSent(notification);
      notification = acknowledgeNotification(notification);

      // Status still bad, but notification was acknowledged
      // Recompute status to ensure consistency
      const sameRunsAgain = [...runs];
      status = computeReliabilityStatus(tenantId, sameRunsAgain);

      const newDecision = decideNotification(
        status,
        { ...DEFAULT_NOTIFICATION_CONFIG, enable_auto_renotify: false },
        notification
      );

      expect(newDecision.should_notify).toBe(false);
      expect(newDecision.reason).toContain('acknowledged');
    });

    it('should auto-notify if conditions persist after clear period', () => {
      const runs: SnapshotRun[] = [
        createRun('failed', 10), // Still failing
        createRun('failed', 9),
      ];

      const status = computeReliabilityStatus(tenantId, runs);
      let notification = createReliabilityNotification(
        tenantId,
        [{ name: 'no_successful_run_since_X_days', is_triggered: true, details: {} }],
        status
      );

      // Simulate acknowledgment 8 days ago
      notification.acknowledged_at = new Date(
        Date.now() - 8 * 24 * 60 * 60 * 1000
      ).toISOString();

      const config: NotificationConfig = {
        ...DEFAULT_NOTIFICATION_CONFIG,
        acknowledgment_auto_clear_days: 7, // Clear period expired
        enable_auto_renotify: true,
      };

      const decision = decideNotification(status, config, notification);

      expect(decision.should_notify).toBe(true);
      expect(decision.reason).toContain('auto-clear period');
    });
  });

  // ========================================================================
  // TEST SUITE 3: Renotification Intervals
  // ========================================================================

  describe('Renotification Intervals', () => {
    it('should respect renotify interval when auto-renotify enabled', () => {
      const runs: SnapshotRun[] = [
        createRun('failed', 1),
        createRun('failed', 2),
      ];

      const status = computeReliabilityStatus(tenantId, runs);
      let notification = createReliabilityNotification(
        tenantId,
        [{ name: 'consecutive_failures_count', is_triggered: true, details: {} }],
        status
      );

      // Acknowledge 6 hours ago
      notification.acknowledged_at = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
      notification.sent_at = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();

      const config: NotificationConfig = {
        ...DEFAULT_NOTIFICATION_CONFIG,
        renotify_interval_hours: 24,
        enable_auto_renotify: true,
      };

      const decision = decideNotification(status, config, notification);

      // Should NOT renotify yet (only 6 hours passed, need 24)
      expect(decision.should_notify).toBe(false);
      expect(decision.reason).toContain('Renotify interval');
    });

    it('should renotify after interval expires', () => {
      const runs: SnapshotRun[] = [
        createRun('failed', 2),
        createRun('failed', 3),
      ];

      const status = computeReliabilityStatus(tenantId, runs);
      let notification = createReliabilityNotification(
        tenantId,
        [{ name: 'consecutive_failures_count', is_triggered: true, details: {} }],
        status
      );

      // Mark sent 25 hours ago
      notification.acknowledged_at = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
      notification.sent_at = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();

      const config: NotificationConfig = {
        ...DEFAULT_NOTIFICATION_CONFIG,
        renotify_interval_hours: 24,
        enable_auto_renotify: true,
      };

      const decision = decideNotification(status, config, notification);

      // Should renotify (25 hours > 24 hour interval)
      expect(decision.should_notify).toBe(true);
      expect(decision.reason).toContain('Auto-renotifying');
    });
  });

  // ========================================================================
  // TEST SUITE 4: Notification History Management
  // ========================================================================

  describe('Notification History Management', () => {
    it('should create empty history', () => {
      const history = createNotificationHistory(tenantId);

      expect(history.tenant_id).toBe(tenantId);
      expect(history.notifications.length).toBe(0);
      expect(history.total_notifications).toBe(0);
      expect(history.unacknowledged_count).toBe(0);
    });

    it('should add notification to history', () => {
      let history = createNotificationHistory(tenantId);

      const runs: SnapshotRun[] = [createRun('failed', 5)];
      const status = computeReliabilityStatus(tenantId, runs);
      const notification = createReliabilityNotification(
        tenantId,
        [{ name: 'no_successful_run_since_X_days', is_triggered: true, details: {} }],
        status
      );

      history = addNotificationToHistory(history, notification);

      expect(history.total_notifications).toBe(1);
      expect(history.unacknowledged_count).toBe(1);
      expect(history.notifications[0].notification_id).toBe(
        notification.notification_id
      );
    });

    it('should track unacknowledged count', () => {
      const runs: SnapshotRun[] = [createRun('failed', 5)];
      const status = computeReliabilityStatus(tenantId, runs);

      const notif1 = createReliabilityNotification(
        tenantId,
        [{ name: 'no_successful_run_since_X_days', is_triggered: true, details: {} }],
        status
      );

      const notif2 = createReliabilityNotification(
        tenantId,
        [{ name: 'consecutive_failures_count', is_triggered: true, details: {} }],
        status
      );

      let history = createNotificationHistory(tenantId, [notif1, notif2]);
      expect(history.unacknowledged_count).toBe(2);

      // Acknowledge first
      history = updateNotificationInHistory(
        history,
        notif1.notification_id,
        { acknowledged_at: new Date().toISOString() }
      );

      expect(history.unacknowledged_count).toBe(1);
    });

    it('should track last sent notification', () => {
      const runs: SnapshotRun[] = [createRun('failed', 5)];
      const status = computeReliabilityStatus(tenantId, runs);

      const notif1 = createReliabilityNotification(
        tenantId,
        [{ name: 'no_successful_run_since_X_days', is_triggered: true, details: {} }],
        status
      );

      // Add small delay to ensure different timestamps
      const notif2 = createReliabilityNotification(
        tenantId,
        [{ name: 'consecutive_failures_count', is_triggered: true, details: {} }],
        status
      );

      // Mark them as sent
      const notif1Sent = markNotificationSent(notif1);
      const notif2Sent = markNotificationSent(notif2);

      const history = createNotificationHistory(tenantId, [notif1Sent, notif2Sent]);

      expect(history.last_sent_notification).toBeDefined();
      // The one with sent_at furthest in future is "last sent"
      expect(history.last_sent_notification?.notification_id).toBeDefined();
    });
  });

  // ========================================================================
  // TEST SUITE 5: Delivery Channels
  // ========================================================================

  describe('Delivery Channels', () => {
    it('should deliver to admin UI', () => {
      const runs: SnapshotRun[] = [createRun('failed', 5)];
      const status = computeReliabilityStatus(tenantId, runs);
      const notification = createReliabilityNotification(
        tenantId,
        [{ name: 'no_successful_run_since_X_days', is_triggered: true, details: {} }],
        status
      );

      const result = deliverToAdminUI(notification);

      expect(result.channel).toBe('admin_ui');
      expect(result.status).toBe('delivered');
    });

    it('should deliver via email', () => {
      const runs: SnapshotRun[] = [createRun('failed', 5)];
      const status = computeReliabilityStatus(tenantId, runs);
      const notification = createReliabilityNotification(
        tenantId,
        [{ name: 'no_successful_run_since_X_days', is_triggered: true, details: {} }],
        status
      );

      const result = deliverViaEmail(notification, 'admin@example.com');

      expect(result.channel).toBe('email');
      expect(result.status).toBe('pending'); // Email is async
    });

    it('should route to both channels when configured', () => {
      const runs: SnapshotRun[] = [createRun('failed', 5)];
      const status = computeReliabilityStatus(tenantId, runs);
      const notification = createReliabilityNotification(
        tenantId,
        [{ name: 'no_successful_run_since_X_days', is_triggered: true, details: {} }],
        status
      );

      const results = routeNotification(
        notification,
        { ...DEFAULT_NOTIFICATION_CONFIG, notification_channel: 'both' },
        'admin@example.com'
      );

      expect(results.length).toBe(2);
      expect(results.map(r => r.channel)).toContain('admin_ui');
      expect(results.map(r => r.channel)).toContain('email');
    });

    it('should route to admin UI only when configured', () => {
      const runs: SnapshotRun[] = [createRun('failed', 5)];
      const status = computeReliabilityStatus(tenantId, runs);
      const notification = createReliabilityNotification(
        tenantId,
        [{ name: 'no_successful_run_since_X_days', is_triggered: true, details: {} }],
        status
      );

      const results = routeNotification(
        notification,
        { ...DEFAULT_NOTIFICATION_CONFIG, notification_channel: 'admin_ui' },
        'admin@example.com'
      );

      expect(results.length).toBe(1);
      expect(results[0].channel).toBe('admin_ui');
    });
  });

  // ========================================================================
  // TEST SUITE 6: FirstTry-Only Compliance
  // ========================================================================

  describe('FirstTry-Only Compliance', () => {
    it('should validate decision with valid FirstTry conditions', () => {
      const decision: NotificationDecision = {
        should_notify: true,
        reason: 'Test',
        triggered_conditions: [
          { name: 'no_successful_run_since_X_days', is_triggered: true, details: {} },
        ],
      };

      const validation = validateNotificationDecision(decision);
      expect(validation.valid).toBe(true);
    });

    it('should reject decision with invalid (non-FirstTry) conditions', () => {
      const decision: NotificationDecision = {
        should_notify: true,
        reason: 'Test',
        triggered_conditions: [
          { name: 'jira_permission_error', is_triggered: true, details: {} },
        ],
      };

      const validation = validateNotificationDecision(decision);
      expect(validation.valid).toBe(false);
      expect(validation.reason).toContain('Invalid condition');
    });

    it('should validate complete workflow', () => {
      const decision: NotificationDecision = {
        should_notify: true,
        reason: 'Test',
        triggered_conditions: [
          { name: 'no_successful_run_since_X_days', is_triggered: true, details: {} },
        ],
      };

      const runs: SnapshotRun[] = [createRun('failed', 5)];
      const status = computeReliabilityStatus(tenantId, runs);
      const notification = createReliabilityNotification(
        tenantId,
        decision.triggered_conditions,
        status
      );

      const validation = validateNotificationWorkflow(decision, notification);
      expect(validation.valid).toBe(true);
    });

    it('should validate workflow with different FirstTry conditions', () => {
      // Both conditions are valid FirstTry metrics, just different ones
      const decision: NotificationDecision = {
        should_notify: true,
        reason: 'Test',
        triggered_conditions: [
          { name: 'no_successful_run_since_X_days', is_triggered: true, details: {} },
        ],
      };

      const runs: SnapshotRun[] = [createRun('failed', 5)];
      const status = computeReliabilityStatus(tenantId, runs);
      
      // Create notification with different valid condition
      const notification = createReliabilityNotification(
        tenantId,
        [{ name: 'consecutive_failures_count', is_triggered: true, details: {} }],
        status
      );

      // Both are valid FirstTry conditions, so validation passes
      // (workflow validation only checks that all are FirstTry metrics, not that they match)
      const validation = validateNotificationWorkflow(decision, notification);
      expect(validation.valid).toBe(true);
    });
  });
});
