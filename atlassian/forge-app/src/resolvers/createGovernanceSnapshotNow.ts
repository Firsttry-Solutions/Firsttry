/**
 * Resolver: createGovernanceSnapshotNow
 * 
 * ENTERPRISE REQUIREMENT R1c: On-demand governance snapshot creation
 * 
 * Creates a Phase 6 governance snapshot (type='daily') on-demand when user triggers.
 * Uses SnapshotCapturer and SnapshotStorage (NOT collectSnapshotCore).
 * 
 * Returns: snapshot_id, captured_at, canonical_hash, snapshot_type
 * Fail-closed: ok:false with trace_id_stable on errors
 */

import { SnapshotCapturer } from '../phase6/snapshot_capture';
import { SnapshotStorage, SnapshotRunStorage } from '../phase6/snapshot_storage';
import { resolveTenantIdentity } from '../core/tenant_identity';
import { failClosed } from '../shared/failClosed';
import {
  generateTraceIdStable,
  generateTraceIdInstance,
  emitResolverErrorLog,
  classifyError,
  ErrorCode,
} from "./backbone_error_handling";
import { BACKEND_BUILD_SHA } from "../build/backend_build";

export interface CreateGovernanceSnapshotResult {
  ok: boolean;
  snapshot_id?: string;
  captured_at?: string;
  canonical_hash?: string;
  snapshot_type?: string;
  run_id?: string;
  error?: {
    code: string;
    message: string;
    trace_id_stable: string;
  };
}

export async function createGovernanceSnapshotNow_resolver(
  req: any
): Promise<CreateGovernanceSnapshotResult> {
  const context = req.context || req;
  const uiReqId = req?.payload?.uiReqId || req?.ui_req_id || `gov_snap_${Date.now()}`;
  const backendBuildSha = BACKEND_BUILD_SHA;

  console.log(
    JSON.stringify({
      marker: "CREATE_GOVERNANCE_SNAPSHOT_INITIATED",
      ui_req_id: uiReqId,
      backend_build_sha: backendBuildSha,
      ts: new Date().toISOString()
    })
  );

  try {
    // Guard: verify tenant identity
    const tenantIdentity = await resolveTenantIdentity(context);
    if (!tenantIdentity || !tenantIdentity.cloudId) {
      const err = new Error('Tenant identity unavailable');
      const errorCode: ErrorCode = "TENANT_CONTEXT_MISSING";
      const traceIdStable = generateTraceIdStable(errorCode, err, backendBuildSha);
      const traceIdInstance = generateTraceIdInstance(traceIdStable, err);
      
      emitResolverErrorLog(
        traceIdStable,
        traceIdInstance,
        errorCode,
        err.message,
        backendBuildSha,
        uiReqId,
        "createGovernanceSnapshotNow"
      );

      return {
        ok: false,
        error: {
          code: errorCode,
          message: err.message,
          trace_id_stable: traceIdStable
        }
      };
    }

    const tenantId = tenantIdentity.tenantKey || tenantIdentity.cloudId;
    const cloudId = tenantIdentity.cloudId;

    // Create Phase 6 governance snapshot (type='daily' for on-demand)
    const capturer = new SnapshotCapturer(tenantId, cloudId, 'daily');
    const { run, snapshot } = await capturer.capture();

    if (!snapshot) {
      const err = new Error('Snapshot capture returned no snapshot');
      const errorCode: ErrorCode = "RESOLVER_UNHANDLED_EXCEPTION";
      const traceIdStable = generateTraceIdStable(errorCode, err, backendBuildSha);
      const traceIdInstance = generateTraceIdInstance(traceIdStable, err);
      
      emitResolverErrorLog(
        traceIdStable,
        traceIdInstance,
        errorCode,
        err.message,
        backendBuildSha,
        uiReqId,
        "createGovernanceSnapshotNow"
      );

      return {
        ok: false,
        error: {
          code: errorCode,
          message: err.message,
          trace_id_stable: traceIdStable
        }
      };
    }

    // Save run record
    const runStorage = new SnapshotRunStorage(tenantId, cloudId);
    await runStorage.createRun(run);

    // Save snapshot
    const snapshotStorage = new SnapshotStorage(tenantId, cloudId);
    await snapshotStorage.createSnapshot(snapshot);

    console.log(
      JSON.stringify({
        marker: "CREATE_GOVERNANCE_SNAPSHOT_SUCCESS",
        ui_req_id: uiReqId,
        snapshot_id: snapshot.snapshot_id,
        snapshot_type: snapshot.snapshot_type,
        captured_at: snapshot.captured_at,
        canonical_hash: snapshot.canonical_hash,
        backend_build_sha: backendBuildSha,
        ts: new Date().toISOString()
      })
    );

    return {
      ok: true,
      snapshot_id: snapshot.snapshot_id,
      captured_at: snapshot.captured_at,
      canonical_hash: snapshot.canonical_hash,
      snapshot_type: snapshot.snapshot_type,
      run_id: run.run_id
    };

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const errorCode: ErrorCode = classifyError(err, "snapshot_creation");
    const traceIdStable = generateTraceIdStable(errorCode, err, backendBuildSha);
    const traceIdInstance = generateTraceIdInstance(traceIdStable, err);
    
    emitResolverErrorLog(
      traceIdStable,
      traceIdInstance,
      errorCode,
      errorMsg,
      backendBuildSha,
      uiReqId,
      "createGovernanceSnapshotNow"
    );

    console.error(
      JSON.stringify({
        marker: "CREATE_GOVERNANCE_SNAPSHOT_ERROR",
        ui_req_id: uiReqId,
        error_code: errorCode,
        error_message: errorMsg,
        trace_id_stable: traceIdStable,
        trace_id_instance: traceIdInstance,
        backend_build_sha: backendBuildSha,
        ts: new Date().toISOString()
      })
    );

    throw failClosed('FT_RESOLVER_SNAPSHOT_CREATE_FAILED', `Create governance snapshot failed: ${errorMsg}`, err);
  }
}
