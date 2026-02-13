/**
 * Phase 2: Health Status Monitoring
 * Provides health data to UI dashboard
 */

import api from "@forge/api";
import { MonitoringHealth } from "./types";
import { getDriftCountLast30Days, loadDriftBuffer } from "../storage/ringBuffer";

const HEALTH_KEY = "phase2.health";

/**
 * Get current monitoring health status
 */
export async function getMonitoringHealth(): Promise<MonitoringHealth> {
  const storage = api.asApp().requestStorage();

  try {
    const healthStr = await storage.get(HEALTH_KEY);
    if (healthStr) {
      return JSON.parse(healthStr);
    }
  } catch (err) {
    console.error(`[FT_DRIFT_HEALTH_LOAD_FAILED]`, err);
  }

  // Return initializing defaults
  const now = new Date();
  const nextScan = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  return {
    lastScanUtc: now.toISOString(),
    nextScanUtc: nextScan.toISOString(),
    status: "initializing",
    estimatedUsageBytes: 0,
    estimatedQuotaBytes: 8 * 1024 * 1024,
    driftCountLast30d: 0,
  };
}

/**
 * Get full health summary including buffer stats
 */
export async function getHealthSummary(): Promise<MonitoringHealth & { bufferEntries: number }> {
  const health = await getMonitoringHealth();
  const buffer = await loadDriftBuffer();

  return {
    ...health,
    bufferEntries: buffer.length,
  };
}

/**
 * Update health status (internal use)
 */
export async function updateHealth(updates: Partial<MonitoringHealth>): Promise<void> {
  const storage = api.asApp().requestStorage();
  const currentHealth = await getMonitoringHealth();

  const newHealth: MonitoringHealth = {
    ...currentHealth,
    ...updates,
  };

  try {
    await storage.set(HEALTH_KEY, JSON.stringify(newHealth));
    console.log(`[FT_DRIFT_HEALTH_UPDATED] status=${newHealth.status}`);
  } catch (err) {
    console.error(`[FT_DRIFT_HEALTH_UPDATE_FAILED]`, err);
  }
}
