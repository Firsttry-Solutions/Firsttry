/**
 * Audit Snapshot Export Resolver
 * 
 * Generates, canonicalizes, hashes, stores, and exports Trust Snapshot
 * in both JSON (machine) and PDF (human) formats.
 * 
 * Response shape is sealed and exact.
 */

import { storage } from '@forge/api';
import { generateTrustSnapshot } from '../core/audit_snapshot/generateTrustSnapshot';
import { toCanonicalJson } from '../core/audit_snapshot/canonicalJson';
import { sha256Hex } from '../core/audit_snapshot/hash';
import { storeSnapshotRecord, generateSnapshotId } from '../core/audit_snapshot/storage';
import { generateTrustSnapshotPdf } from '../core/audit_snapshot/exportPdf';
import { SnapshotRecord } from '../core/audit_snapshot/types';
import { resolveTenantIdentity } from '../core/tenant_identity';
import {
  generateTraceIdStable,
  generateTraceIdInstance,
  emitResolverErrorLog,
  classifyError,
  ErrorCode,
} from "./backbone_error_handling";

/**
 * Export Trust Snapshot
 * 
 * Requires:
 * - Tenant identity guard (user must be able to view gadget)
 * - No admin detection
 * - No new scopes
 */
export async function exportTrustSnapshot(
  req: any
): Promise<{
  snapshotId: string;
  generatedAtISO: string;
  jsonSha256: string;
  jsonFilename: string;
  jsonCanonicalText: string;
  pdfFilename: string;
  pdfBase64: string;
}> {
  // Extract context from request
  const context = req.context || req;
  const uiReqId = req?.payload?.uiReqId || `export_${Date.now()}`;
  const backendBuildSha = process.env.BUILD_SHA || null;

  try {
    // Guard: verify tenant identity (same as governance_status resolver)
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
        "MISSING",
        "UNKNOWN",
        "exportTrustSnapshot"
      );
      
      throw err;
    }

    const cloudId = tenantIdentity.cloudId;

    // 1. Generate snapshot from Phase 1-4 data
    const snapshot = await generateTrustSnapshot(cloudId);

    // 2. Canonicalize JSON
    const jsonCanonicalText = toCanonicalJson(snapshot);

    // 3. Compute SHA256 hash
    const jsonSha256 = sha256Hex(jsonCanonicalText);

    // 4. Generate deterministic snapshotId
    const snapshotId = generateSnapshotId(snapshot.generatedAtISO, jsonSha256);

    // 5. Create and store immutable record
    const record: SnapshotRecord = {
      snapshotId,
      generatedAtISO: snapshot.generatedAtISO,
      jsonSha256,
      jsonCanonicalText,
      appVersion: snapshot.versioning.appVersion,
      environment: snapshot.versioning.environment,
    };

    await storeSnapshotRecord(cloudId, record);

    // 6. Generate PDF
    const pdfBuffer = await generateTrustSnapshotPdf(snapshot, record);
    const pdfBase64 = pdfBuffer.toString('base64');

    // 7. Build response with exact shape
    const response = {
      snapshotId,
      generatedAtISO: snapshot.generatedAtISO,
      jsonSha256,
      jsonFilename: `firsttry_trust_snapshot_${snapshotId}.json`,
      jsonCanonicalText,
      pdfFilename: `firsttry_trust_snapshot_${snapshotId}.pdf`,
      pdfBase64,
    };

    return response;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    const errorCode: ErrorCode = classifyError(error, "export");
    const traceIdStable = generateTraceIdStable(errorCode, error, backendBuildSha);
    const traceIdInstance = generateTraceIdInstance(traceIdStable, error);
    
    emitResolverErrorLog(
      traceIdStable,
      traceIdInstance,
      errorCode,
      errorMsg,
      backendBuildSha,
      uiReqId,
      "OK",
      "ERROR",
      "exportTrustSnapshot"
    );
    
    throw new Error(`Export failed: ${errorMsg}`);
  }
}
