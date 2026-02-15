/**
 * Phase 2: Alerting Disabled (FT_ALERTING_DISABLED_NO_EGRESS)
 * 
 * FirstTry does NOT send external webhooks or make outbound HTTP calls.
 * This maintains a no-egress posture and fail-closed design.
 * 
 * Customers manage incident communication via their own tools.
 */

import { DriftEvent, MonitoringConfig } from "./types";

/**
 * Alerting is disabled - all external egress calls are banned
 */
export async function sendAlerts(drifts: DriftEvent[], config: MonitoringConfig): Promise<void> {
  if (drifts.length === 0) {
    console.log(`[FT_ALERT_NO_DRIFTS]`);
    return;
  }

  console.log(`[FT_ALERTING_DISABLED_NO_EGRESS] Drift events detected but alerting is disabled. Customers must configure their own monitoring/alerting.`);
  console.log(`[FT_DRIFT_COUNT] ${drifts.length} drift events found. Use FirstTry audit logs to review.`);

  // Log drifts to internal audit only (no external dispatch)
  for (const drift of drifts) {
    console.log(`[FT_DRIFT_LOGGED] type=${drift.type} entity=${drift.entity} severity=${drift.severity}`);
  }

  console.log(`[FT_ALERTING_COMPLETE_NO_EGRESS] All drifts logged to audit trail (no external egress)`);
}
