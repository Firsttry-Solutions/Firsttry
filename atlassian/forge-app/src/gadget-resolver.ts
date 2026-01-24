/**
 * CANONICAL FORGE RESOLVER HANDLER - gadget-resolver.ts
 *
 * CRITICAL: This is the SINGLE source of truth for all gadget UI invoke keys.
 *
 * Forge UI invoke('key') ONLY works when:
 * 1. The manifest function handler points to this file's EXPORTED resolver instance
 * 2. The resolver.define('key', fn) calls register each invoke key
 * 3. The handler export is EXACTLY: resolver.getDefinitions()
 *
 * Exported wrapper functions and re-exported resolvers do NOT work.
 *
 * Structure:
 * - One Resolver instance
 * - Each invoke key defined via resolver.define()
 * - Export handler = resolver.getDefinitions()
 *
 * Manifest reference:
 * function:
 *   - key: get-status-snapshot-fn
 *     handler: src/gadget-resolver.handler
 *
 * UI invocations:
 *   invoke('getStatusSnapshot', {})
 *   invoke('getBuildInfo', { uiReqId: ... })
 *   invoke('refreshNow', {})
 *   invoke('exportTrustSnapshot', {})
 */

import Resolver from '@forge/resolver';
import { getStatusSnapshot_resolver } from './resolvers/getStatusSnapshot';
import { getBuildInfo_resolver } from './resolvers/getBuildInfo';
import { refreshNow_resolver } from './resolvers/refreshNow';
import { exportTrustSnapshot } from './resolvers/audit_snapshot_export';
import { getSnapshotDebug_resolver } from './resolvers/getSnapshotDebug';
import { ping } from './resolvers/ping';
import { ensureFirstSnapshot } from './resolvers/ensureFirstSnapshot';
import { probe } from './resolvers/probe'; // FORENSIC_PROBE
import { FtReasonCode, FtErrorCode } from './backbone/errorCodes';
import { FtResolverResponseV1, assertNoUnknownStrings, FtLedgerV1 } from './backbone/contract';
import { loadOrInitLedger, updateLedger } from './backbone/ledger';
import { nowUtcIso } from './backbone/time';
import { dashOk, dashErr } from './shared/dashEnvelopeV1';
import { BACKEND_BUILD_SHA } from './build/backend_build';

// Create single canonical resolver instance
const resolver = new Resolver();

// Register all gadget UI invoke keys with their handlers
// CRITICAL: Keys must match UI invoke() calls exactly
resolver.define('getStatusSnapshot', getStatusSnapshot_resolver);
resolver.define('getBuildInfo', getBuildInfo_resolver);
resolver.define('refreshNow', refreshNow_resolver);
resolver.define('exportTrustSnapshot', exportTrustSnapshot);
resolver.define('getSnapshotDebug', getSnapshotDebug_resolver);
resolver.define('ping', ping);
resolver.define('ensureFirstSnapshot', ensureFirstSnapshot);
resolver.define('probe', probe);  // FORENSIC_PROBE

// Layer-0 Backbone resolvers
resolver.define('ft_getDashboardState_v1', ft_getDashboardState_v1);
resolver.define('ft_setUiBuildSha_v1', ft_setUiBuildSha_v1);
resolver.define('ft_contractProof_dashEnvelope_v1', ft_contractProof_dashEnvelope_v1);

// Storage read resolvers (production proof)
resolver.define('ft_getInstallMarker_v1', ft_getInstallMarker_v1);
resolver.define('ft_getSnapshotAnchor_v1', ft_getSnapshotAnchor_v1);

// CRITICAL: Export as 'handler' - this is what Forge expects from manifest
export const handler = resolver.getDefinitions();

// ============================================================================
// LAYER-0 BACKBONE RESOLVERS (NEW)
// ============================================================================

export async function ft_getDashboardState_v1(request: any): Promise<any> {
  /**
   * Layer-0 Marketplace Dashboard State Resolver
   * 
   * Returns ONLY persisted snapshot metadata (dumb reader pattern):
   * - Read ft:snapshot:last:v1 from storage
   * - Validate structure
   * - Return status + snapshotId + createdAtUtc + schemaVersion
   * - NO state machine, NO derived logic, NO ledger
   * 
   * Dashboard MUST show ONLY:
   * - AVAILABLE: if snapshot exists and is valid
   * - HARD ERROR: if snapshot missing or invalid
   * 
   * Response format for UI:
   * {
   *   status: "AVAILABLE" | "HARD ERROR",
   *   snapshotId: "<uuid>",
   *   createdAtUtc: "<ISO>",
   *   schemaVersion: "L0",
   *   containsText: "Jira governance evidence snapshot (export for full details)."
   * }
   */
  try {
    const now = nowUtcIso();
    const context = request?.context || {};
    const requestId = context?.requestId ?? null;
    
    // Read snapshot from storage (single source of truth)
    const snapshot = await (async () => {
      try {
        const api_imported = require("@forge/api").api;
        let storedSnapshot: any = null;
        await api_imported.asApp().requestStorage(async (storage: any) => {
          storedSnapshot = await storage.get("ft:snapshot:last:v1");
        });
        return storedSnapshot;
      } catch (e) {
        console.error("[FT_L0_DASHBOARD] Storage read failed:", e instanceof Error ? e.message : String(e));
        return null;
      }
    })();
    
    // Validate snapshot structure (fail-closed)
    const isValid = snapshot && 
      typeof snapshot.snapshotId === 'string' && snapshot.snapshotId.trim() &&
      typeof snapshot.createdAtUtc === 'string' && snapshot.createdAtUtc.trim() &&
      snapshot.schemaVersion === "L0" &&
      typeof snapshot.data === 'object' && snapshot.data &&
      snapshot.createdAtUtc.endsWith('Z');
    
    if (!isValid) {
      console.log("[FT_L0_DASHBOARD] Snapshot invalid or missing", {
        present: !!snapshot,
        hasSnapshotId: snapshot?.snapshotId != null,
        hasCreatedAt: snapshot?.createdAtUtc != null,
        isSchemaL0: snapshot?.schemaVersion === "L0",
        hasData: snapshot?.data != null,
      });
      
      return {
        status: "HARD ERROR",
        error: "FT_SNAPSHOT_INVALID",
        schemaVersion: "L0",
      };
    }
    
    // Return metadata only (dumb reader)
    console.log("[FT_L0_DASHBOARD] Returning valid snapshot meta", {
      snapshotId: snapshot.snapshotId,
      createdAtUtc: snapshot.createdAtUtc,
      requestId,
    });
    
    return {
      status: "AVAILABLE",
      snapshotId: snapshot.snapshotId,
      createdAtUtc: snapshot.createdAtUtc,
      schemaVersion: "L0",
      containsText: "Jira governance evidence snapshot (export for full details).",
      // Pass through metadata verbatim (dumb reader - no transforms)
      metadata: snapshot.metadata || {
        coverage: { declaration: "NOT_DECLARED_IN_SNAPSHOT" },
        integrity: { declaration: "NOT_DECLARED_IN_SNAPSHOT" },
        provenance: { capturedBy: "UNKNOWN" },
        export: { formats: ["JSON"], readiness: "AVAILABLE" },
        compliance: { declaration: "NOT_DECLARED_IN_SNAPSHOT" },
        disclaimer: {
          doesNotMonitor: "Live Jira activity",
          doesNotModify: "Jira data or configuration",
          doesNotAutoFix: "Compliance issues",
          doesNotProvide: "Compliance guarantees or substitutes for professional audit"
        }
      }
    };
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    console.error("[FT_L0_DASHBOARD] Resolver error:", errorMsg);
    
    return {
      status: "HARD ERROR",
      error: "FT_META_FAILED",
      schemaVersion: "L0",
    };
  }
}

async function ft_setUiBuildSha_v1(request: any): Promise<{ ok: boolean; error?: string }> {
  const event = request?.payload || {};
  try {
    const { build_sha_ui } = event ?? {};
    if (!build_sha_ui) return { ok: false, error: "missing build_sha_ui" };
    
    await updateLedger((l) => ({ ...l, build_sha_last_seen_ui: build_sha_ui }));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: FtErrorCode.STORAGE_WRITE_FAILED };
  }
}

/**
 * BACKBONE CONTRACT PROOF RESOLVER
 * Returns ONLY envelope structure proof (no tenant data, read-only).
 * Used for non-interactive CLI verification of production envelope shape.
 */
export async function ft_contractProof_dashEnvelope_v1(request: any): Promise<any> {
  try {
    const now = nowUtcIso();
    
    // Build the proof data - no tenant secrets, only structure
    const proofData = {
      proofName: "ft_contractProof_dashEnvelope_v1",
      envelopeKind: "FT_DASH_ENVELOPE_V1",
      envelopeVersion: 1,
      schemaVersion: "v1",
      okType: "boolean",
      hasMeta: true,
      hasData: true,
      hasError: false,
      dataKeys: ["proofName", "envelopeKind", "envelopeVersion", "schemaVersion", "okType", "hasMeta", "hasData", "hasError", "dataKeys", "metaKeys"],
      metaKeys: ["backend_build_sha", "ui_build_sha", "ui_req_id", "probe_nonce", "ts_utc"],
      timestampUtc: now,
      build: {
        backendBuild: BACKEND_BUILD_SHA, // BACKBONE FIX D: Always provide backend build SHA (no || undefined fallback)
        uiBuild: undefined
      }
    };

    // Return wrapped in proper envelope using dashOk
    const envelope = dashOk({
      data: proofData,
      meta: {
        backend_build_sha: BACKEND_BUILD_SHA, // BACKBONE FIX D: Always provide backend build SHA
        ui_build_sha: null,
        ui_req_id: "contract-proof",
        probe_nonce: null,
        ts_utc: now
      }
    });

    // Log proof marker (non-secret, deterministic)
    console.log(JSON.stringify({
      marker: "FT_CONTRACT_PROOF",
      envelopeKind: envelope.envelopeKind,
      envelopeVersion: envelope.envelopeVersion,
      schemaVersion: envelope.schemaVersion,
      ok: envelope.ok,
      ts_utc: now
    }));

    return envelope;
  } catch (e) {
    const now = nowUtcIso();
    const errorMessage = e instanceof Error ? e.message : String(e);

    return dashErr({
      error: {
        code: "CONTRACT_PROOF_FAILED",
        message: errorMessage.slice(0, 180)
      },
      meta: {
        backend_build_sha: BACKEND_BUILD_SHA, // BACKBONE FIX D: Always provide backend build SHA even on error
        ui_build_sha: null,
        ui_req_id: "contract-proof",
        probe_nonce: null,
        ts_utc: now
      }
    });
  }
}

/**
 * Storage read resolver: ft_getInstallMarker_v1
 * Returns ONLY the raw install marker from storage.
 * No transforms, no writes.
 */
async function ft_getInstallMarker_v1(request: any): Promise<{ key: string; value: any }> {
  try {
    const api_imported = require("@forge/api").api;
    let value: any = null;
    await api_imported.asApp().requestStorage(async (storage: any) => {
      value = await storage.get("ft:install:marker:v1");
    });
    return { key: "ft:install:marker:v1", value };
  } catch (e) {
    throw new Error("FT_META_FAILED");
  }
}

/**
 * Storage read resolver: ft_getSnapshotAnchor_v1
 * Returns ONLY the raw snapshot anchor from storage.
 * No transforms, no writes.
 */
async function ft_getSnapshotAnchor_v1(request: any): Promise<{ key: string; value: any }> {
  try {
    const api_imported = require("@forge/api").api;
    let value: any = null;
    await api_imported.asApp().requestStorage(async (storage: any) => {
      value = await storage.get("ft:snapshot:last:v1");
    });
    return { key: "ft:snapshot:last:v1", value };
  } catch (e) {
    throw new Error("FT_META_FAILED");
  }
}

