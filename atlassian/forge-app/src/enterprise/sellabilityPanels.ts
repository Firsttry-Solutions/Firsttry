/**
 * Enterprise Sellability Panels Wiring
 * 
 * FT_PROOF_ENTERPRISE_SELLABILITY_PANELS_WIRED_v1
 * 
 * Central integration point for all Phase 5.1.8 enterprise modules.
 * Called from dashboard resolver to build complete enterprise panel state.
 * 
 * FAIL-CLOSED: Returns graceful fallbacks on any error, never throws
 */

import { buildLifecyclePanelState, LifecyclePanelState } from "../enterprise/lifecyclePanel";
import { getStorageMetrics, StorageMetrics } from "../enterprise/storageMetrics";
import { detectPossibleRestore, RestoreDetectionResult } from "../enterprise/restoreHeuristic";
import { getVerifyAudit, VerifyAuditState } from "../enterprise/verifyAudit";
import { getSnapshotFrequency, SnapshotFrequencyResult } from "../enterprise/snapshotFrequency";
import { getTimeline, TimelineEvent } from "../enterprise/timeline";
import { runCertificationPrecheck, CertPrecheckResult } from "../enterprise/certPrecheck";

export interface EnterpriseSellabilityPanelState {
  lifecycle: LifecyclePanelState | null;
  storage: StorageMetrics | null;
  restore: RestoreDetectionResult | null;
  verify: VerifyAuditState | null;
  frequency: SnapshotFrequencyResult | null;
  timeline: TimelineEvent[] | null;
  certPrecheck: CertPrecheckResult | null;
  errors: string[];
}

/**
 * Build complete enterprise sellability panel state
 * 
 * FAIL-CLOSED: Graceful degradation on errors
 * Returns null fields for failed queries, continues collecting other data
 */
export async function buildEnterpriseSellabilityPanels(
  tenantKey: string,
  snapshot?: any
): Promise<EnterpriseSellabilityPanelState> {
  const errors: string[] = [];

  // Load all panels in parallel with error handling
  let lifecycle: LifecyclePanelState | null = null;
  let storage: StorageMetrics | null = null;
  let restore: RestoreDetectionResult | null = null;
  let verify: VerifyAuditState | null = null;
  let frequency: SnapshotFrequencyResult | null = null;
  let timeline: TimelineEvent[] | null = null;
  let certPrecheck: CertPrecheckResult | null = null;

  try {
    lifecycle = await buildLifecyclePanelState(tenantKey, snapshot || {});
  } catch (err) {
    console.error("[enterprise] Lifecycle panel error:", err);
    errors.push(`Lifecycle panel failed: ${err}`);
  }

  try {
    storage = await getStorageMetrics(tenantKey);
  } catch (err) {
    console.error("[enterprise] Storage metrics error:", err);
    errors.push(`Storage metrics failed: ${err}`);
  }

  try {
    restore = await detectPossibleRestore(tenantKey);
  } catch (err) {
    console.error("[enterprise] Restore detection error:", err);
    errors.push(`Restore detection failed: ${err}`);
  }

  try {
    verify = await getVerifyAudit(tenantKey);
  } catch (err) {
    console.error("[enterprise] Verify audit error:", err);
    errors.push(`Verify audit failed: ${err}`);
  }

  try {
    frequency = await getSnapshotFrequency(tenantKey);
  } catch (err) {
    console.error("[enterprise] Snapshot frequency error:", err);
    errors.push(`Snapshot frequency failed: ${err}`);
  }

  try {
    timeline = await getTimeline(tenantKey);
  } catch (err) {
    console.error("[enterprise] Timeline error:", err);
    errors.push(`Timeline failed: ${err}`);
  }

  try {
    certPrecheck = await runCertificationPrecheck(tenantKey, snapshot);
  } catch (err) {
    console.error("[enterprise] Cert precheck error:", err);
    errors.push(`Cert precheck failed: ${err}`);
  }

  return {
    lifecycle,
    storage,
    restore,
    verify,
    frequency,
    timeline,
    certPrecheck,
    errors,
  };
}

/**
 * Format enterprise panels for UI display
 * 
 * Returns markdown or HTML panel blocks suitable for UI rendering
 */
export function formatEnterprisePanelsUI(state: EnterpriseSellabilityPanelState): string[] {
  const panels: string[] = [];

  // Lifecycle panel
  if (state.lifecycle) {
    panels.push(`
## Lifecycle & Installation
- Installation ID: ${state.lifecycle.installationId?.slice(0, 16) || "Not assigned"}
- Tenant Hash: ${state.lifecycle.tenantKeyHash16}
- Ledger Created: ${state.lifecycle.ledgerCreatedAtUtc || "Unknown"}
- Oldest Segment: ${state.lifecycle.oldestSegmentRetained || "None"}
- Retention Policy: ${state.lifecycle.retentionPolicy}
- Reset Detected: ${state.lifecycle.resetDetected ? "⚠️ Yes" : "No"}
${state.lifecycle.resetMessage ? `- Reset Reason: ${state.lifecycle.resetMessage}` : ""}
    `);
  }

  // Storage panel
  if (state.storage) {
    panels.push(`
## Storage Metrics
- Total Blocks: ${state.storage.totalBlocks}
- Segments Retained: ${state.storage.segmentsRetained}/8
- Estimated Size: ${(state.storage.estimatedSizeBytes / 1024).toFixed(1)} KB
- Retention Policy: ${state.storage.retentionPolicy} segments
    `);
  }

  // Restore panel
  if (state.restore) {
    panels.push(`
## Restore Detection
- Suspected: ${state.restore.suspected ? "⚠️ Yes" : "No"}
${state.restore.reason ? `- Reason: ${state.restore.reason}` : ""}
    `);
  }

  // Verify panel
  if (state.verify) {
    panels.push(`
## Verification Status
- Last Window Verify: ${state.verify.lastWindowStatus || "Not run"}
- Last Window Time: ${state.verify.lastWindowVerifyAtUtc || "Never"}
- Last Full Verify: ${state.verify.lastFullVerifyAtUtc || "Never"}
    `);
  }

  // Frequency panel
  if (state.frequency) {
    panels.push(`
## Snapshot Frequency
- Bucket: ${state.frequency.bucket || "Unknown"}
- Average Interval: ${state.frequency.avgHours ? `${state.frequency.avgHours}h` : "Unknown"}
    `);
  }

  // Timeline (abbreviated for UI)
  if (state.timeline && state.timeline.length > 0) {
    const recentEvents = state.timeline.slice(-5);
    panels.push(`
## Recent Timeline Events (Last 5)
${recentEvents.map((e) => `- ${e.observedAtUtc.slice(0, 10)}: ${e.type}`).join("\n")}
    `);
  }

  // Cert precheck
  if (state.certPrecheck) {
    panels.push(`
## Certification Precheck
- Allowed: ${state.certPrecheck.allowed ? "✅ Yes" : `❌ No - ${state.certPrecheck.blockedReason}`}
    `);
  }

  // Errors
  if (state.errors && state.errors.length > 0) {
    panels.push(`
## Collection Errors
${state.errors.map((e) => `- ${e}`).join("\n")}
    `);
  }

  return panels;
}
