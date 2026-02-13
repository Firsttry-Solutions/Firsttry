/**
 * Phase 2: Webhook-based alerting (Slack + generic webhooks only)
 * No email API. Webhook failures do not fail the drift scan.
 */

import crypto from "crypto";
import { DriftEvent, MonitoringConfig } from "./types";

interface AlertPayload {
  app: string;
  version: string;
  siteId: string;
  snapshotHash: string;
  severity: "high" | "medium" | "low";
  eventType: DriftType;
  entity: string;
  timestampUtc: string;
  recommendation: string;
}

type DriftType = "new_global_admin" | "admin_removed" | "external_elevated" | "project_became_widely_browsable" | "permission_scheme_modified";

/**
 * Send alerts for drift events
 * Failures are logged but do not fail the drift scan
 */
export async function sendAlerts(drifts: DriftEvent[], config: MonitoringConfig): Promise<void> {
  if (drifts.length === 0) {
    console.log(`[FT_ALERT_NO_DRIFTS]`);
    return;
  }

  const siteId = process.env.FORGE_SITE_ID || "unknown";

  // Group by severity
  const driftsByType: Record<string, DriftEvent[]> = {};
  for (const drift of drifts) {
    if (!driftsByType[drift.type]) {
      driftsByType[drift.type] = [];
    }
    driftsByType[drift.type].push(drift);
  }

  // Create payload for each drift
  for (const drift of drifts) {
    const payload: AlertPayload = {
      app: "FirstTry",
      version: "2.0.0-phase2",
      siteId,
      snapshotHash: drift.snapshotHash,
      severity: drift.severity,
      eventType: drift.type,
      entity: drift.entity,
      timestampUtc: drift.timestampUtc,
      recommendation: "Review and manually revoke if unauthorized.",
    };

    const payloadJson = JSON.stringify(payload);

    // Send to Slack webhook if configured
    if (config.webhooks.slackWebhookUrl) {
      try {
        await sendSlackAlert(config.webhooks.slackWebhookUrl, payload);
        console.log(`[FT_ALERT_SLACK_SENT] entity=${drift.entity}`);
      } catch (err) {
        console.error(`[FT_ALERT_DELIVERY_FAILED] slack endpoint, error=${err}`);
      }
    }

    // Send to generic webhook if configured
    if (config.webhooks.genericWebhookUrl) {
      try {
        await sendGenericAlert(config.webhooks.genericWebhookUrl, payload);
        console.log(`[FT_ALERT_GENERIC_SENT] entity=${drift.entity}`);
      } catch (err) {
        console.error(`[FT_ALERT_DELIVERY_FAILED] generic endpoint, error=${err}`);
      }
    }
  }
}

/**
 * Send Slack message
 */
async function sendSlackAlert(webhookUrl: string, payload: AlertPayload): Promise<void> {
  const color = payload.severity === "high" ? "danger" : payload.severity === "medium" ? "warning" : "good";

  const message = {
    attachments: [
      {
        color,
        title: `FirstTry: ${payload.eventType}`,
        text: `${payload.recommendation}`,
        fields: [
          { title: "Severity", value: payload.severity, short: true },
          { title: "Entity", value: payload.entity, short: true },
          { title: "Snapshot", value: payload.snapshotHash.substring(0, 8), short: true },
          { title: "Time (UTC)", value: payload.timestampUtc, short: true },
        ],
      },
    ],
  };

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message),
  });

  if (!response.ok) {
    throw new Error(`Slack webhook returned ${response.status}`);
  }
}

/**
 * Send generic webhook
 */
async function sendGenericAlert(webhookUrl: string, payload: AlertPayload): Promise<void> {
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Generic webhook returned ${response.status}`);
  }
}
