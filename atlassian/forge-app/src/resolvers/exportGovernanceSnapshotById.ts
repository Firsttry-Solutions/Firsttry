/**
 * Resolver: exportGovernanceSnapshotById
 * 
 * ENTERPRISE REQUIREMENT R3: Export governance snapshots only (block seed)
 * 
 * Fetches a Phase 6 governance snapshot by ID and returns it as JSON.
 * Server-side validation:
 * - 404 if not found
 * - 403 if snapshot_type === 'seed'
 * - 400 if snapshot_type not in ['daily', 'weekly']
 * 
 * Returns full snapshot payload including:
 * - snapshot_id, captured_at, snapshot_type, canonical_hash
 * - hash_algorithm, schema_version
 * - payload (real governance data)
 * - missing_data, input_provenance, scope
 */

import { SnapshotStorage } from '../phase6/snapshot_storage';
import { Snapshot } from '../phase6/snapshot_model';
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

export interface ExportGovernanceSnapshotResult {
  ok: boolean;
  snapshot?: {
    snapshot_id: string;
    captured_at: string;
    snapshot_type: string;
    canonical_hash: string;
    hash_algorithm: string;
    schema_version: string;
    payload: Record<string, any>;
    missing_data?: any[];
    input_provenance?: Record<string, any>;
    scope?: Record<string, any>;
    exported_at: string;
  };
  error?: {
    code: string;
    message: string;
    trace_id_stable: string;
  };
}

export async function exportGovernanceSnapshotById_resolver(
  req: any
): Promise<ExportGovernanceSnapshotResult> {
  const context = req.context || req;
  const payload = req.payload || {};
  const snapshotId = payload.id || payload.snapshotId || payload.snapshot_id;
  const uiReqId = req?.payload?.uiReqId || req?.ui_req_id || `export_gov_${Date.now()}`;
  const backendBuildSha = BACKEND_BUILD_SHA;

  console.log(
    JSON.stringify({
      marker: "EXPORT_GOVERNANCE_SNAPSHOT_INITIATED",
      ui_req_id: uiReqId,
      snapshot_id: snapshotId,
      backend_build_sha: backendBuildSha,
      ts: new Date().toISOString()
    })
  );

  try {
    // Validate snapshotId parameter
    if (!snapshotId || typeof snapshotId !== 'string') {
      const err = new Error('Missing or invalid snapshot_id parameter');
      const errorCode: ErrorCode = "STORAGE_ERROR";
      const traceIdStable = generateTraceIdStable(errorCode, err, backendBuildSha);
      const traceIdInstance = generateTraceIdInstance(traceIdStable, err);
      
      emitResolverErrorLog(
        traceIdStable,
        traceIdInstance,
        errorCode,
        err.message,
        backendBuildSha,
        uiReqId,
        "exportGovernanceSnapshotById"
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
        "exportGovernanceSnapshotById"
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

    // Fetch snapshot from Phase 6 storage
    const snapshotStorage = new SnapshotStorage(tenantId, cloudId);
    const snapshot: Snapshot | null = await snapshotStorage.getSnapshotById(snapshotId);

    // R3 Enforcement: 404 if not found
    if (!snapshot) {
      const err = new Error(`Snapshot not found: ${snapshotId}`);
      const errorCode: ErrorCode = "STORAGE_ERROR";
      const traceIdStable = generateTraceIdStable(errorCode, err, backendBuildSha);
      const traceIdInstance = generateTraceIdInstance(traceIdStable, err);
      
      emitResolverErrorLog(
        traceIdStable,
        traceIdInstance,
        errorCode,
        err.message,
        backendBuildSha,
        uiReqId,
        "exportGovernanceSnapshotById"
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

    // R3b Enforcement: 403 if snapshot_type === 'seed'
    if ((snapshot.snapshot_type as string) === 'seed') {
      const err = new Error('Seed snapshots are not exportable (not audit evidence)');
      const errorCode: ErrorCode = "STORAGE_ERROR";
      const traceIdStable = generateTraceIdStable(errorCode, err, backendBuildSha);
      const traceIdInstance = generateTraceIdInstance(traceIdStable, err);
      
      emitResolverErrorLog(
        traceIdStable,
        traceIdInstance,
        errorCode,
        err.message,
        backendBuildSha,
        uiReqId,
        "exportGovernanceSnapshotById"
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

    // R3a Enforcement: 400 if snapshot_type not in ['daily', 'weekly']
    if (!['daily', 'weekly'].includes(snapshot.snapshot_type)) {
      const err = new Error(`Invalid snapshot type for export: ${snapshot.snapshot_type}`);
      const errorCode: ErrorCode = "STORAGE_ERROR";
      const traceIdStable = generateTraceIdStable(errorCode, err, backendBuildSha);
      const traceIdInstance = generateTraceIdInstance(traceIdStable, err);
      
      emitResolverErrorLog(
        traceIdStable,
        traceIdInstance,
        errorCode,
        err.message,
        backendBuildSha,
        uiReqId,
        "exportGovernanceSnapshotById"
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

    // R3c: Export real governance data
    console.log(
      JSON.stringify({
        marker: "EXPORT_GOVERNANCE_SNAPSHOT_SUCCESS",
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
      snapshot: {
        snapshot_id: snapshot.snapshot_id,
        captured_at: snapshot.captured_at,
        snapshot_type: snapshot.snapshot_type,
        canonical_hash: snapshot.canonical_hash,
        hash_algorithm: snapshot.hash_algorithm || 'sha256',
        schema_version: snapshot.schema_version || 'v1',
        payload: snapshot.payload,
        missing_data: snapshot.missing_data,
        input_provenance: snapshot.input_provenance,
        scope: snapshot.scope,
        exported_at: new Date().toISOString()
      }
    };

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const errorCode: ErrorCode = classifyError(err, "export");
    const traceIdStable = generateTraceIdStable(errorCode, err, backendBuildSha);
    const traceIdInstance = generateTraceIdInstance(traceIdStable, err);
    
    emitResolverErrorLog(
      traceIdStable,
      traceIdInstance,
      errorCode,
      errorMsg,
      backendBuildSha,
      uiReqId,
      "exportGovernanceSnapshotById"
    );

    console.error(
      JSON.stringify({
        marker: "EXPORT_GOVERNANCE_SNAPSHOT_ERROR",
        ui_req_id: uiReqId,
        error_code: errorCode,
        error_message: errorMsg,
        trace_id_stable: traceIdStable,
        trace_id_instance: traceIdInstance,
        backend_build_sha: backendBuildSha,
        ts: new Date().toISOString()
      })
    );

    throw failClosed('FT_RESOLVER_EXPORT_GOVERNANCE_FAILED', `Export governance snapshot failed: ${errorMsg}`, err);
  }
}
