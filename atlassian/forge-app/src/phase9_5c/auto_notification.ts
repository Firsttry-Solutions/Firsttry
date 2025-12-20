/**
 * PHASE 9.5-C: AUTO-NOTIFICATION LOGIC
 *
 * Admin notification system for FirstTry snapshot reliability.
 * Only sends notifications when FirstTry's snapshot capability degrades.
 *
 * Rules:
 * 1. Alert ONLY when no successful snapshot since N days ago (configurable)
 * 2. Alert ONLY when M consecutive failed runs occur (configurable)
 * 3. No alerts for Jira issues, permission problems, or system issues
 * 4. Admin can acknowledge to suppress further alerts for that condition
 * 5. Alert history is maintained for audit trail
 */

import crypto from 'crypto';
import {
  SnapshotReliabilityStatus,
  ReliabilityAlertCondition,
  ReliabilityNotification,
  detectReliabilityAlertConditions,
  enforceFirstTryOnlyAlerts,
  validateFirstTryOnlyNotification,
} from './snapshot_reliability';

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Admin notification configuration
 */
export interface NotificationConfig {
  // Alert thresholds
  no_successful_run_days: number;      // Alert if no successful run since N days
  consecutive_failures_count: number;  // Alert if N consecutive failures

  // Notification behavior
  notification_channel: 'admin_ui' | 'email' | 'both';  // Where to send
  enable_auto_renotify: boolean;       // Resend alert if still failing
  renotify_interval_hours: number;    // How often to renotify (if still failing)

  // Acknowledgment
  acknowledgment_auto_clear_days: number;  // Auto-clear acknowledged alert after N days
}

/**
 * Default configuration (sensible defaults)
 */
export const DEFAULT_NOTIFICATION_CONFIG: NotificationConfig = {
  no_successful_run_days: 3,
  consecutive_failures_count: 5,
  notification_channel: 'admin_ui',
  enable_auto_renotify: true,
  renotify_interval_hours: 24,
  acknowledgment_auto_clear_days: 7,
};

// ============================================================================
// NOTIFICATION DECISION ENGINE
// ============================================================================

/**
 * Decision: Should we send a notification for this reliability status?
 */
export interface NotificationDecision {
  should_notify: boolean;
  reason: string; // Explanation for decision
  triggered_conditions: ReliabilityAlertCondition[];
}

/**
 * Decides whether notification should be sent
 */
export function decideNotification(
  status: SnapshotReliabilityStatus,
  config: NotificationConfig,
  previousNotification?: ReliabilityNotification
): NotificationDecision {
  // Compute alert conditions
  const conditions = detectReliabilityAlertConditions(status, {
    no_successful_run_threshold_days: config.no_successful_run_days,
    consecutive_failures_threshold: config.consecutive_failures_count,
  });

  // Filter to FirstTry-only alerts
  const firstTryConditions = enforceFirstTryOnlyAlerts(conditions);

  // Check for triggered conditions
  const triggeredConditions = firstTryConditions.filter(c => c.is_triggered);

  if (triggeredConditions.length === 0) {
    // No alert conditions triggered
    if (previousNotification?.acknowledged_at) {
      return {
        should_notify: false,
        reason: 'No alert conditions triggered. Previous notification acknowledged and conditions resolved.',
        triggered_conditions: [],
      };
    }
    return {
      should_notify: false,
      reason: 'No alert conditions triggered.',
      triggered_conditions: [],
    };
  }

  // Some conditions are triggered
  if (previousNotification?.acknowledged_at) {
    // Was acknowledged - check if we should auto-clear it
    const acknowledgedAtTime = new Date(previousNotification.acknowledged_at).getTime();
    const nowTime = new Date().getTime();
    const daysSinceAcknowledged = (nowTime - acknowledgedAtTime) / (24 * 60 * 60 * 1000);

    if (daysSinceAcknowledged > config.acknowledgment_auto_clear_days) {
      // Auto-clear period expired, send new notification
      return {
        should_notify: true,
        reason: `Acknowledgment auto-clear period (${config.acknowledgment_auto_clear_days} days) expired. Alert conditions still triggered.`,
        triggered_conditions: triggeredConditions,
      };
    }

    if (!config.enable_auto_renotify) {
      return {
        should_notify: false,
        reason: 'Alert acknowledged and auto-renotify disabled.',
        triggered_conditions: [],
      };
    }

    // Check renotify interval
    if (previousNotification.sent_at) {
      const sentAtTime = new Date(previousNotification.sent_at).getTime();
      const hoursSinceSent = (nowTime - sentAtTime) / (60 * 60 * 1000);

      if (hoursSinceSent < config.renotify_interval_hours) {
        return {
          should_notify: false,
          reason: `Acknowledged notification sent ${hoursSinceSent.toFixed(1)} hours ago. Renotify interval: ${config.renotify_interval_hours} hours.`,
          triggered_conditions: [],
        };
      }
    }

    // Conditions still triggered, auto-renotify enabled, interval passed
    return {
      should_notify: true,
      reason: `Acknowledged alert still triggered after ${config.renotify_interval_hours} hours. Auto-renotifying.`,
      triggered_conditions: triggeredConditions,
    };
  }

  // No previous notification - send one
  return {
    should_notify: true,
    reason: 'FirstTry snapshot reliability alert conditions triggered.',
    triggered_conditions: triggeredConditions,
  };
}

// ============================================================================
// NOTIFICATION HISTORY TRACKING
// ============================================================================

/**
 * Complete history record of all notifications for an tenant
 */
export interface NotificationHistory {
  tenant_id: string;
  notifications: ReliabilityNotification[];
  last_sent_notification?: ReliabilityNotification;
  last_acknowledged_notification?: ReliabilityNotification;
  total_notifications: number;
  unacknowledged_count: number;
}

/**
 * Creates notification history object
 */
export function createNotificationHistory(
  tenant_id: string,
  notifications: ReliabilityNotification[] = []
): NotificationHistory {
  const unacknowledged = notifications.filter(n => !n.acknowledged_at);
  const lastSent = [...notifications].sort(
    (a, b) => new Date(b.sent_at || b.created_at).getTime() - new Date(a.sent_at || a.created_at).getTime()
  )[0];
  const lastAcknowledged = notifications.find(n => n.acknowledged_at);

  return {
    tenant_id,
    notifications,
    last_sent_notification: lastSent,
    last_acknowledged_notification: lastAcknowledged,
    total_notifications: notifications.length,
    unacknowledged_count: unacknowledged.length,
  };
}

/**
 * Adds notification to history
 */
export function addNotificationToHistory(
  history: NotificationHistory,
  notification: ReliabilityNotification
): NotificationHistory {
  return createNotificationHistory(history.tenant_id, [
    ...history.notifications,
    notification,
  ]);
}

/**
 * Updates notification in history (e.g., marking as sent or acknowledged)
 */
export function updateNotificationInHistory(
  history: NotificationHistory,
  notificationId: string,
  updates: Partial<ReliabilityNotification>
): NotificationHistory {
  const updated = history.notifications.map(n =>
    n.notification_id === notificationId
      ? { ...n, ...updates }
      : n
  );

  return createNotificationHistory(history.tenant_id, updated);
}

// ============================================================================
// DELIVERY: Simulated notification channels
// ============================================================================

/**
 * Result of sending notification through a channel
 */
export interface DeliveryResult {
  channel: 'admin_ui' | 'email';
  status: 'delivered' | 'failed' | 'pending';
  message: string;
  timestamp: string;
}

/**
 * Sends notification to admin UI (in-app notification)
 * This is a mock - real implementation would store in DB
 */
export function deliverToAdminUI(
  notification: ReliabilityNotification
): DeliveryResult {
  // In production: Store in notifications table, trigger real-time UI update via WebSocket
  return {
    channel: 'admin_ui',
    status: 'delivered',
    message: `Notification ${notification.notification_id} delivered to admin UI`,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Sends notification via email
 * This is a mock - real implementation would call email service
 */
export function deliverViaEmail(
  notification: ReliabilityNotification,
  adminEmail: string
): DeliveryResult {
  // In production: Call email service (SendGrid, AWS SES, etc.)
  return {
    channel: 'email',
    status: 'pending',
    message: `Email notification queued for ${adminEmail} (mock delivery)`,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Routes notification to configured channels
 */
export function routeNotification(
  notification: ReliabilityNotification,
  config: NotificationConfig,
  adminEmail?: string
): DeliveryResult[] {
  const results: DeliveryResult[] = [];

  if (config.notification_channel === 'admin_ui' || config.notification_channel === 'both') {
    results.push(deliverToAdminUI(notification));
  }

  if (
    (config.notification_channel === 'email' || config.notification_channel === 'both') &&
    adminEmail
  ) {
    results.push(deliverViaEmail(notification, adminEmail));
  }

  return results;
}

// ============================================================================
// ENFORCEMENT: FIRSTTRY-ONLY PROTECTION
// ============================================================================

/**
 * CRITICAL RULE: This notification system is ONLY for FirstTry failures.
 * Validates that a decision contains no non-FirstTry alerts.
 */
export function validateNotificationDecision(
  decision: NotificationDecision
): { valid: boolean; reason?: string } {
  for (const condition of decision.triggered_conditions) {
    if (
      !['no_successful_run_since_X_days', 'consecutive_failures_count'].includes(
        condition.name
      )
    ) {
      return {
        valid: false,
        reason: `Invalid condition in decision: ${condition.name}. Only FirstTry execution metrics allowed.`,
      };
    }
  }

  return { valid: true };
}

/**
 * Validates entire notification workflow for FirstTry compliance
 */
export function validateNotificationWorkflow(
  decision: NotificationDecision,
  notification: ReliabilityNotification | null
): { valid: boolean; reason?: string } {
  // Validate decision
  const decisionValid = validateNotificationDecision(decision);
  if (!decisionValid.valid) {
    return decisionValid;
  }

  // Validate notification if provided
  if (notification) {
    // Check all conditions are FirstTry metrics
    for (const condition of notification.alert_conditions) {
      if (
        !['no_successful_run_since_X_days', 'consecutive_failures_count'].includes(
          condition.name
        )
      ) {
        return {
          valid: false,
          reason: `Notification contains invalid condition: ${condition.name}`,
        };
      }
    }

    // Ensure notification matches decision
    const decisionIds = new Set(
      decision.triggered_conditions.map(c => c.name)
    );
    const notificationIds = new Set(
      notification.alert_conditions.filter(c => c.is_triggered).map(c => c.name)
    );

    if (decisionIds.size !== notificationIds.size) {
      return {
        valid: false,
        reason: 'Notification conditions do not match decision conditions',
      };
    }
  }

  return { valid: true };
}
