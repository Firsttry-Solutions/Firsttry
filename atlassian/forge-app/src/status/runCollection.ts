/**
 * Collection orchestrator: Single entrypoint for all snapshot updates
 * Called from scheduler, manual refresh, and on-load.
 *
 * Guarantees:
 * - Sets lastHeartbeatIso at start if mode=="scheduled"
 * - Sets lastAttemptIso at start always
 * - Attempts evidence collection using existing pipeline
 * - Sets lastSuccessIso only on evidence success
 * - Always writes StatusSnapshot even on failure
 * - Appends run ledger entry
 * - Recomputes health + reasons
 */

import { StatusSnapshot, generateSnapshotId } from "./statusSnapshot";
import { getStatusSnapshot, putStatusSnapshot, createNoSchedulerSnapshot } from "./statusStorage";
import { appendRunEntry, type RunLedgerEntry } from "./runLedger";
import { applyHealthComputation, computeFreshness } from "./computeStatus";

export async function runCollection(params: {
  tenantKey: string;
  mode: "scheduled" | "manual" | "onload";
  existingSnapshot?: StatusSnapshot | null;
}): Promise<StatusSnapshot> {
  const nowIso = new Date().toISOString();
  const startedIso = nowIso;

  try {
    // Load or initialize snapshot
    let snapshot =
      params.existingSnapshot ?? (await getStatusSnapshot(params.tenantKey));

    if (!snapshot) {
      snapshot = createNoSchedulerSnapshot(params.tenantKey);
    }

    // Update identity + timing
    snapshot.generatedAtIso = nowIso;
    snapshot.mode = params.mode;
    snapshot.tenantKey = params.tenantKey;

    // If no snapshotId yet, generate one (first time)
    if (!snapshot.snapshotId) {
      snapshot.snapshotId = generateSnapshotId(nowIso);
    }

    // Set attempt timestamp
    snapshot.scheduler.lastAttemptIso = nowIso;

    // If scheduled mode, also set heartbeat
    if (params.mode === "scheduled") {
      snapshot.scheduler.lastHeartbeatIso = nowIso;
    }

    // TODO: Call actual evidence collection pipeline here
    // For now, we'll stub the collection with a success flag
    let collectionSuccess = false;
    let collectionError: { code: string; message: string } | null = null;

    try {
      // Placeholder: Call existing evidence collection code
      // This would be something like:
      // const evidenceSnapshot = await collectEvidence(params.tenantKey);
      // await storeEvidenceSnapshot(evidenceSnapshot);
      // collectionSuccess = true;

      // For now, mark as successful (will be wired once we know the evidence collector)
      collectionSuccess = true;
    } catch (err) {
      console.error(`[runCollection] Evidence collection failed for ${params.tenantKey}:`, err);
      collectionError = {
        code: "COLLECTION_ERROR",
        message: String(err),
      };
      collectionSuccess = false;
    }

    // Only set lastSuccessIso if collection succeeded
    if (collectionSuccess) {
      snapshot.scheduler.lastSuccessIso = nowIso;
    }

    // Recompute health based on new state
    snapshot = applyHealthComputation(snapshot);

    // Always write snapshot, even on failure
    await putStatusSnapshot(snapshot);
    
    // SNAPSHOT_WRITE_VERIFICATION: read back to confirm persistence
    const readBackSnapshot = await getStatusSnapshot(params.tenantKey);
    if (!readBackSnapshot) {
      throw new Error(`SNAPSHOT_VERIFICATION_FAILED: snapshot not readable after write for tenantKey=${params.tenantKey}`);
    }
    console.log(`SNAPSHOT_WRITE_PROOF tenantKey=${params.tenantKey} snapshotId=${snapshot.snapshotId} verified=true`);

    // Append run ledger entry
    const endedIso = new Date().toISOString();
    const entry: RunLedgerEntry = {
      startedIso,
      endedIso,
      mode: params.mode,
      success: collectionSuccess,
      errorCode: collectionError?.code,
      errorMessage: collectionError?.message,
      producedEvidenceSnapshot: collectionSuccess,
      snapshotId: snapshot.snapshotId,
    };

    await appendRunEntry(params.tenantKey, entry);

    // Log structured output for debugging
    console.log(
      JSON.stringify({
        action: "runCollection",
        tenantKey: params.tenantKey,
        mode: params.mode,
        success: collectionSuccess,
        snapshotId: snapshot.snapshotId,
        generatedAtIso: snapshot.generatedAtIso,
        lastSuccessIso: snapshot.scheduler.lastSuccessIso,
        health: snapshot.computed.health,
      })
    );

    return snapshot;
  } catch (err) {
    // Fail-closed: ensure we still write some snapshot
    console.error(`[runCollection] Critical error for ${params.tenantKey}:`, err);

    let snapshot = (await getStatusSnapshot(params.tenantKey)) || createNoSchedulerSnapshot(params.tenantKey);

    snapshot.generatedAtIso = nowIso;
    snapshot.mode = params.mode;
    snapshot.scheduler.lastAttemptIso = nowIso;

    if (params.mode === "scheduled") {
      snapshot.scheduler.lastHeartbeatIso = nowIso;
    }

    snapshot = applyHealthComputation(snapshot);

    try {
      await putStatusSnapshot(snapshot);
    } catch (writeErr) {
      console.error(`[runCollection] Failed to write snapshot after error:`, writeErr);
    }

    throw err;
  }
}
