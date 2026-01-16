/**
 * Resolver: refreshNow
 * Called when user clicks "Refresh Now" button.
 *
 * Uses canonical collectSnapshotCore for all snapshot creation.
 * Returns structured result with snapshotId and status.
 * Logs SNAPSHOT_WRITE_PROOF on success.
 */

import { collectSnapshotCore, CollectedSnapshot } from "../status/collectSnapshotCore";

export interface RefreshNowResult {
  ok: boolean;
  snapshotId?: string;
  generatedAtUtc?: string;
  tenantKeyHash?: string;
  buildSha?: string;
  snapshotCount?: number;
  errorCode?: string;
  errorMessage?: string;
  errorStage?: string;
}

export async function refreshNow_resolver(req: any): Promise<RefreshNowResult> {
  const context = req.context || req;
  const uiReqId = req?.payload?.uiReqId || `refresh_${Date.now()}`;

  console.log(
    "REFRESH_NOW_INITIATED",
    JSON.stringify({
      uiReqId,
      ts: new Date().toISOString()
    })
  );

  try {
    // Call canonical collection core
    const snapshot: CollectedSnapshot = await collectSnapshotCore(context, uiReqId);

    console.log(
      "REFRESH_NOW_SUCCESS",
      JSON.stringify({
        uiReqId,
        snapshotId: snapshot.snapshotId,
        tenantKeyHash: snapshot.tenantKeyHash,
        buildSha: snapshot.buildSha,
        ts: new Date().toISOString()
      })
    );

    return {
      ok: true,
      snapshotId: snapshot.snapshotId,
      generatedAtUtc: snapshot.generatedAtUtc,
      tenantKeyHash: snapshot.tenantKeyHash,
      buildSha: snapshot.buildSha,
      snapshotCount: 1  // Will be incremented by collectSnapshotCore
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const errorCode = (err as any)?.code || "UNKNOWN_ERROR";
    const errorStage = errorMsg.match(/\[(.*?)\]/)?.[1] || "unknown";

    console.error(
      "REFRESH_NOW_ERROR",
      JSON.stringify({
        uiReqId,
        errorCode,
        errorStage,
        errorMessage: errorMsg,
        ts: new Date().toISOString()
      })
    );

    return {
      ok: false,
      errorCode,
      errorMessage: errorMsg,
      errorStage
    };
  }
}
