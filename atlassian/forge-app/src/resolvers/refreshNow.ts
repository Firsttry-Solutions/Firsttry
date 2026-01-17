/**
 * Resolver: refreshNow
 * Called when user clicks "Refresh Now" button.
 *
 * Uses canonical collectSnapshotCore for all snapshot creation.
 * Returns structured result with snapshotId and status.
 * Logs SNAPSHOT_WRITE_PROOF on success.
 */

import { collectSnapshotCore, CollectedSnapshot } from "../status/collectSnapshotCore";
import {
  generateTraceIdStable,
  generateTraceIdInstance,
  emitResolverErrorLog,
  classifyError,
  ErrorCode,
} from "./backbone_error_handling";

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
  const backendBuildSha = process.env.BUILD_SHA || null;

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
    const errorCode: ErrorCode = classifyError(err, "collection");
    const traceIdStable = generateTraceIdStable(errorCode, err, backendBuildSha);
    const traceIdInstance = generateTraceIdInstance(traceIdStable, err);
    
    emitResolverErrorLog(
      traceIdStable,
      traceIdInstance,
      errorCode,
      errorMsg,
      backendBuildSha,
      uiReqId,
      "refreshNow"
    );

    console.error(
      "REFRESH_NOW_ERROR",
      JSON.stringify({
        uiReqId,
        errorCode,
        errorMessage: errorMsg,
        trace_id_stable: traceIdStable,
        trace_id_instance: traceIdInstance,
        ts: new Date().toISOString()
      })
    );

    return {
      ok: false,
      errorCode,
      errorMessage: errorMsg,
      errorStage: "collection"
    };
  }
}
