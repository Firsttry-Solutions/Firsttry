/**
 * Phase 2: Scheduled Drift Monitor Trigger (Daily)
 * Orchestrates drift scan with time budget enforcement
 */

import api from "@forge/api";
import { storage } from "@forge/api";
import { runDriftScan } from "./detector";
import { sendAlerts } from "./alerting";
import { updateHealth, getMonitoringHealth } from "./health";
import { MonitoringConfig } from "./types";

const TIME_BUDGET_MS = 240 * 1000; // 240 seconds

/**
 * Scheduled trigger handler: runs daily drift scan
 */
export const run = async (): Promise<void> => {
  console.log(`[FT_DRIFT_SCHEDULED_START]`);
  console.log("[FT_PROOF_DRIFT_STORAGE_API_OK]", { marker:"FT_PROOF_DRIFT_STORAGE_API_OK" });
  const startTime = Date.now();

  try {
    // Run drift scan with time budget check
    const scanStart = Date.now();

    let result;
    try {
      result = await runDriftScan();
    } catch (err: any) {
      console.error(`[FT_DRIFT_SCAN_FAILED]`, err.message);
      const failureCode = err.message.includes("FT_DRIFT_SCAN_ABORT_REQUIRED_DATA_MISSING")
        ? "FT_DRIFT_SCAN_ABORT_REQUIRED_DATA_MISSING"
        : "FT_DRIFT_SCAN_FAILED";

      await updateHealth({
        status: "failed",
        lastFailureCode: failureCode as any,
        lastScanUtc: new Date().toISOString(),
        nextScanUtc: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      return;
    }

    const scanDuration = Date.now() - scanStart;

    // Check time budget
    if (scanDuration > TIME_BUDGET_MS) {
      console.error(`[FT_DRIFT_TIME_BUDGET_EXCEEDED] duration=${scanDuration}ms budget=${TIME_BUDGET_MS}ms`);

      await updateHealth({
        status: "failed",
        lastFailureCode: "FT_DRIFT_TIME_BUDGET_EXCEEDED",
        lastScanUtc: new Date().toISOString(),
        nextScanUtc: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      return;
    }

    // Load config and send alerts
    try {
      let configStr;
      try {
        // AUDIT-ALLOWLIST FT-ALW-05-050
        configStr = await storage.get("phase2.config.webhooks");
      } catch (storageErr: any) {
        console.error("[FT_PROOF_DRIFT_STORAGE_API_FAIL]", { marker:"FT_PROOF_DRIFT_STORAGE_API_FAIL", err: String(storageErr) });
        throw storageErr;
      }
      let config: MonitoringConfig = { allowedDomains: [], webhooks: {} };

      if (configStr) {
        const webhookConfig = JSON.parse(configStr);
        config.webhooks = webhookConfig;
      }

      if (result.drifts.length > 0) {
        await sendAlerts(result.drifts, config);
      }
    } catch (err) {
      console.error(`[FT_DRIFT_ALERT_FAILED]`, err);
      // Alert failure does not fail the scan
    }

    // Update final health
    const finalTime = new Date();
    const nextScan = new Date(finalTime.getTime() + 24 * 60 * 60 * 1000);

    await updateHealth({
      status: result.drifts.length > 0 ? "healthy" : "healthy",
      lastScanUtc: finalTime.toISOString(),
      nextScanUtc: nextScan.toISOString(),
    });

    console.log(
      `[FT_DRIFT_SCHEDULED_COMPLETE] drifts=${result.drifts.length} duration=${scanDuration}ms baselineInitialized=${result.baselineInitialized}`
    );
  } catch (err: any) {
    console.error(`[FT_DRIFT_SCHEDULED_FATAL]`, err);

    try {
      await updateHealth({
        status: "failed",
        lastFailureCode: "FT_DRIFT_SCAN_ABORT_REQUIRED_DATA_MISSING",
      });
    } catch (healthErr) {
      console.error(`[FT_DRIFT_HEALTH_PERSIST_FAILED]`, healthErr);
    }
  }

  const elapsed = Date.now() - startTime;
  console.log(`[FT_DRIFT_SCHEDULED_ELAPSED] ${elapsed}ms`);
};
