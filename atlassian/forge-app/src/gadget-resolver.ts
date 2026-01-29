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
import api from '@forge/api';
import { storage } from '@forge/api';
import { FT_RELEASE_VERSION } from './release/release_version';
import { getStatusSnapshot_resolver } from './resolvers/getStatusSnapshot';
import { getBuildInfo_resolver } from './resolvers/getBuildInfo';
import { refreshNow_resolver } from './resolvers/refreshNow';
import { exportTrustSnapshot } from './resolvers/audit_snapshot_export';
import { getSnapshotDebug_resolver } from './resolvers/getSnapshotDebug';
import { ping } from './resolvers/ping';
import { debugSnapshotState_resolver } from './resolvers/debugSnapshotState';
import { ensureFirstSnapshot } from './resolvers/ensureFirstSnapshot';
import { probe } from './resolvers/probe'; // FORENSIC_PROBE
import { FtReasonCode, FtErrorCode } from './backbone/errorCodes';
import { FtResolverResponseV1, assertNoUnknownStrings, FtLedgerV1 } from './backbone/contract';
import { loadOrInitLedger, updateLedger } from './backbone/ledger';
import { nowUtcIso } from './backbone/time';
import { dashOk, dashErr, DashEnvelopeV1 } from './shared/dashEnvelopeV1';
import { BACKEND_BUILD_SHA } from './build/backend_build';
import {
  FT_DASH_ENVELOPE_MARKER_V1,
  okEnvelope,
  notAvailableEnvelope,
  hardErrorEnvelope,
  FtDashEnvelopeV1,
  enforceDashEnvelopeV1Invariant,
} from './contracts/ft_dash_envelope_v1';

// Create single canonical resolver instance
const resolver = new Resolver();

// Register all gadget UI invoke keys with their handlers
// CRITICAL: Keys must match UI invoke() calls exactly
resolver.define('getStatusSnapshot', getStatusSnapshot_resolver);
resolver.define('getBuildInfo', getBuildInfo_resolver);
resolver.define('refreshNow', refreshNow_resolver);
resolver.define('exportTrustSnapshot', exportTrustSnapshot);
resolver.define('debugSnapshotState', debugSnapshotState_resolver);
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

// Runtime proof resolver (admin-only)
resolver.define('ft_getRuntimeProof_v1', ft_getRuntimeProof_v1);

// UI log relay resolver (UI → backend log relay for markers)
resolver.define('ft_uiLogRelay_v1', ft_uiLogRelay_v1);

// CRITICAL: Export as 'handler' - this is what Forge expects from manifest
export const handler = resolver.getDefinitions();

// ============================================================================
// LAYER-0 BACKBONE RESOLVERS (NEW)
// ============================================================================

export async function ft_getDashboardState_v1(request: any): Promise<FtDashEnvelopeV1> {
  try {
    // Log version proof at start of resolver invocation
    let buildSha = BACKEND_BUILD_SHA || "UNSET";
    console.log(JSON.stringify({
      marker: "[FT_L0_DASHBOARD] VERSION_PROOF",
      release: FT_RELEASE_VERSION,
      buildSha,
      ts: new Date().toISOString(),
    }));

    // IMPLEMENTATION: Layer-0 Marketplace Dashboard State Resolver
    const __impl = async () => {
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
      const now = nowUtcIso();
      const context = request?.context || {};
      const requestId = context?.requestId ?? null;
      
      // Read snapshot from storage (single source of truth)
      const snapshot = await (async () => {
        try {
          // Use correct Forge storage API: storage.get()
          const storedSnapshot = await storage.get("ft:snapshot:last:v1");
          return storedSnapshot;
        } catch (e) {
          console.error("[FT_STORAGE_FAIL] Storage read failed for ft:snapshot:last:v1", {
            name: (e as any)?.name,
            message: (e as any)?.message,
            code: (e as any)?.code,
          });
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
        
        // CRITICAL FIX: Try to repair invalid snapshot inline
        // If snapshot exists but is invalid, rebuild and store a canonical one
        if (snapshot && !isValid) {
          console.log(JSON.stringify({
            marker: "[FT_RESOLVER_REPAIR_ATTEMPT]",
            action: "ATTEMPT_REPAIR_INVALID_SNAPSHOT",
            reason: "Resolver detected invalid snapshot, attempting inline repair",
            snapshotIdBefore: snapshot?.snapshotId,
            ts: new Date().toISOString()
          }));
          
          try {
            // Import seed function dynamically to avoid circular imports
            const { seedFirstSnapshotIfMissingOrRepair } = await import("./lifecycle/seedSnapshot");
            const repairResult = await seedFirstSnapshotIfMissingOrRepair();
            
            console.log(JSON.stringify({
              marker: "[FT_RESOLVER_REPAIR_RESULT]",
              action: repairResult.action,
              snapshotIdAfter: repairResult.snapshotId,
              ts: new Date().toISOString()
            }));
            
            // If repair succeeded, re-fetch snapshot
            if (repairResult.action === "REPAIRED_INVALID" || repairResult.action === "CREATED") {
              const repairedSnapshot = await storage.get("ft:snapshot:last:v1");
              if (repairedSnapshot && 
                  typeof repairedSnapshot.snapshotId === 'string' && 
                  repairedSnapshot.snapshotId.trim() &&
                  typeof repairedSnapshot.createdAtUtc === 'string' && 
                  repairedSnapshot.createdAtUtc.trim() &&
                  repairedSnapshot.schemaVersion === "L0" &&
                  typeof repairedSnapshot.data === 'object' && 
                  repairedSnapshot.data &&
                  repairedSnapshot.createdAtUtc.endsWith('Z')) {
                // Repaired snapshot is now valid - return it
                console.log(JSON.stringify({
                  marker: "[FT_RESOLVER_REPAIR_SUCCESS]",
                  snapshotId: repairedSnapshot.snapshotId,
                  ts: new Date().toISOString()
                }));
                
                return {
                  status: "AVAILABLE",
                  snapshotId: repairedSnapshot.snapshotId,
                  createdAtUtc: repairedSnapshot.createdAtUtc,
                  schemaVersion: "L0",
                  containsText: "Jira governance evidence snapshot (export for full details).",
                  metadata: repairedSnapshot.metadata || {
                    coverage: { declaration: "NOT_DECLARED_IN_SNAPSHOT" },
                    integrity: { declaration: "NOT_DECLARED_IN_SNAPSHOT" },
                    provenance: { capturedBy: "RESOLVER_REPAIR" },
                  },
                  data: repairedSnapshot.data,
                };
              }
            }
          } catch (repairErr) {
            console.log(JSON.stringify({
              marker: "[FT_RESOLVER_REPAIR_FAILED]",
              error: repairErr instanceof Error ? repairErr.message : String(repairErr),
              ts: new Date().toISOString()
            }));
            // If repair fails, fall through to return invalid state
          }
        }
        
        // Return as NO_SNAPSHOT (non-fatal state)
        // Missing or invalid snapshot is not a contract failure - just means we don't have data
        const subcode = !snapshot ? "NO_SNAPSHOT_POINTER" : "SNAPSHOT_SCHEMA_MISMATCH";
        console.log(JSON.stringify({
          marker: "[BACKEND_DASH_STATE_FAIL]",
          code: "FT_SNAPSHOT_INVALID",
          subcode,
          correlationId: requestId,
          snapshotIdCandidate: snapshot?.snapshotId,
        }));
        return {
          status: "NO_SNAPSHOT",
          error: "FT_SNAPSHOT_INVALID",
          schemaVersion: "L0",
          subcode,
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
    };

    // WRAPPER: Execute implementation and wrap in proper envelope (fail-closed)
    const raw = await __impl();
    
    // CRITICAL VALIDATION: status MUST be set (fail-closed)
    if (!raw || typeof raw !== 'object' || !raw.status) {
      console.error("[FT_L0_DASHBOARD] CRITICAL: __impl returned invalid response", {
        hasRaw: !!raw,
        isObject: raw && typeof raw === 'object',
        hasStatus: raw?.status != null,
        raw: raw ? { keys: Object.keys(raw).slice(0, 10) } : null,
      });
      return hardErrorEnvelope(
        "FT_IMPL_RESPONSE_INVALID",
        "Dashboard resolver implementation returned invalid response shape"
      );
    }

    // BACKBONE FIX: Use okEnvelope/notAvailableEnvelope/hardErrorEnvelope
    // (envelopeKind: 'FT_DASH_ENVELOPE_v1', schemaVersion: 1, status: 'AVAILABLE'|'NOT_AVAILABLE'|'HARD_ERROR'|'NO_SNAPSHOT'|'INVALID_SNAPSHOT')
    let result: FtDashEnvelopeV1;
    if (raw.status === "AVAILABLE") {
      result = okEnvelope(raw);
    } else if (raw.status === "NO_SNAPSHOT") {
      // Missing snapshot - non-fatal state (user can still see dashboard with no data)
      result = notAvailableEnvelope(
        raw.error ?? "NO_SNAPSHOT_POINTER",
        raw.error ? `Dashboard state: ${raw.error}` : "Snapshot is not available"
      );
    } else if (raw.status === "INVALID_SNAPSHOT") {
      // Invalid snapshot - non-fatal state (schema/parse error but not a contract violation)
      result = notAvailableEnvelope(
        raw.error ?? "SNAPSHOT_SCHEMA_MISMATCH",
        raw.error ? `Dashboard state: ${raw.error}` : "Snapshot schema is invalid"
      );
    } else if (raw.status === "NOT_AVAILABLE") {
      result = notAvailableEnvelope(
        raw.error ?? "FT_SNAPSHOT_INVALID",
        raw.error ? `Dashboard state not available: ${raw.error}` : "Snapshot is not available"
      );
    } else if (raw.status === "HARD ERROR") {
      result = hardErrorEnvelope(
        raw.error ?? "FT_SNAPSHOT_INVALID",
        raw.error ? `Dashboard state failed: ${raw.error}` : "Snapshot is invalid or missing"
      );
    } else {
      // Unexpected status value - fail-closed
      console.error("[FT_L0_DASHBOARD] CRITICAL: Unexpected status value", {
        status: raw.status,
        statusType: typeof raw.status,
      });
      result = hardErrorEnvelope(
        "FT_UNEXPECTED_STATUS",
        `Unexpected status value: ${raw.status}`
      );
    }

    // =====================================================================
    // RESOLVER BOUNDARY INVARIANT: Enforce at the last step before return
    // This makes it IMPOSSIBLE for status to ever be undefined in production
    // =====================================================================
    const safe = enforceDashEnvelopeV1Invariant(result);

    // WIRE-LEVEL PROOF: Serialize to JSON and verify status presence + mutual exclusivity
    const wireJson = JSON.stringify(safe);
    const hasOwnStatus = Object.prototype.hasOwnProperty.call(safe, 'status');
    const jsonHasStatus = wireJson.includes('"status"');
    const jsonHasData = wireJson.includes('"data"');
    const jsonHasError = wireJson.includes('"error"');
    const violatesExclusivity = (safe.ok === true && jsonHasError && !jsonHasData) ||
                                (safe.ok === false && jsonHasData && !jsonHasError);

    // Log WIRE-PROOF with all critical invariants
    console.log(JSON.stringify({
      marker: "[FT_DASH_V1_WIRE_PROOF]",
      hasOwnStatus,
      statusValue: safe.status,
      hasDataKey: Object.prototype.hasOwnProperty.call(safe, 'data'),
      hasErrorKey: Object.prototype.hasOwnProperty.call(safe, 'error'),
      ok: safe.ok,
      keys: Object.keys(safe),
      json: wireJson,
      jsonHasStatus,
      jsonHasData,
      jsonHasError,
      violatesExclusivity,
      buildSha: BACKEND_BUILD_SHA || "UNSET",
      ts: new Date().toISOString(),
    }));

    return safe;
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    console.error("[FT_L0_DASHBOARD] Resolver error:", errorMsg);
    
    // BACKBONE FIX: Use hardErrorEnvelope which produces CORRECT envelope format
    return hardErrorEnvelope(
      "FT_RESOLVER_EXCEPTION",
      `Dashboard resolver failed: ${errorMsg.slice(0, 150)}`
    );
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
export async function ft_contractProof_dashEnvelope_v1(request: any): Promise<DashEnvelopeV1> {
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
    const value = await storage.get("ft:install:marker:v1");
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
    const value = await storage.get("ft:snapshot:last:v1");
    return { key: "ft:snapshot:last:v1", value };
  } catch (e) {
    throw new Error("FT_META_FAILED");
  }
}

/**
 * Admin-only runtime proof resolver: ft_getRuntimeProof_v1
 * Returns deterministic proof of deployed release version and build SHA.
 * Access restricted to admins only (fail-closed).
 */
async function ft_getRuntimeProof_v1(request: any): Promise<any> {
  console.log("[FT_RUNTIME_PROOF_UI] INVOKED", { release: FT_RELEASE_VERSION, buildSha: BACKEND_BUILD_SHA });
  
  try {
    // Fail-closed: check admin permission
    // Use Jira REST API to verify global ADMINISTER permission
    let isAdmin = false;
    try {
      const resp = await api.asUser().requestJira(async (client: any) => {
        return await client.get('/rest/api/3/mypermissions?permissions=ADMINISTER');
      });
      const permissions = (resp as any)?.permissions || [];
      isAdmin = permissions.some((p: any) => p.key === 'ADMINISTER' && p.havePermission === true);
    } catch (e) {
      // If permission check fails, fail closed: deny access
      isAdmin = false;
    }
    
    if (!isAdmin) {
      return {
        ok: false,
        marker: "FT_RUNTIME_PROOF_UI",
        error: "forbidden",
      };
    }
    
    // Build @forge/api introspection
    let apiShape = {
      type: typeof api,
      hasAsApp: typeof api?.asApp === "function",
      keys: [] as string[],
    };
    
    try {
      apiShape.keys = Object.keys(api as any).slice(0, 20);
    } catch {
      // Safe fallback
    }
    
    // Return proof
    const proof = {
      ok: true,
      marker: "FT_RUNTIME_PROOF_UI",
      release: FT_RELEASE_VERSION,
      buildSha: BACKEND_BUILD_SHA,
      env: process.env.FORGE_ENV || "unknown",
      tsUtc: new Date().toISOString(),
      forgeApi: apiShape,
    };
    
    console.log("[FT_RUNTIME_PROOF_UI] UI_RENDERED", { ok: proof.ok, release: proof.release, buildSha: proof.buildSha });
    return proof;
  } catch (e) {
    console.error("[FT_RUNTIME_PROOF_UI] ERROR", { error: (e as any)?.message });
    return {
      ok: false,
      marker: "FT_RUNTIME_PROOF_UI",
      error: "internal_error",
    };
  }
}

/**
 * UI Log Relay Resolver - ft_uiLogRelay_v1
 * 
 * Accepts markers from UI and logs them in backend logs for forensic analysis.
 * This allows UI-side events to be captured in Forge logs for deterministic proof.
 * 
 * Payload shape:
 * {
 *   marker: string,          // e.g., "UI_ENTRY_RUNTIME_PROOF", "L0_DASHBOARD_RENDERED"
 *   ui_git_sha?: string,     // UI build git SHA
 *   ui_req_id?: string,      // Request ID for correlation
 *   extra?: any              // Additional context (status, reasonCode, etc)
 * }
 * 
 * Returns: { ok: true } always (fire-and-forget)
 */
export async function ft_uiLogRelay_v1(request: any): Promise<{ ok: boolean }> {
  try {
    // DEFENSIVE UNWRAP: Accept both old nested { payload: { marker, ... } } and correct flat { marker, ... }
    let payload = request?.payload || {};
    if (
      payload &&
      typeof payload === "object" &&
      (payload as any).payload &&
      typeof (payload as any).payload === "object"
    ) {
      // Old nested format - unwrap it
      payload = (payload as any).payload;
    }
    const marker = payload.marker || "UNKNOWN_MARKER";
    const ui_git_sha = payload.ui_git_sha || "MISSING";
    const ui_req_id = payload.ui_req_id || "MISSING";
    let extra = payload.extra;

    // Validate required fields are present
    const presentKeys = Object.keys(payload);
    let finalMarker = marker;
    if (!payload.marker || !payload.ui_git_sha || !payload.ui_req_id) {
      finalMarker = "MALFORMED_RELAY";
    }

    // Truncate extra if too large (max 500 chars when stringified)
    let extraStr: string | any;
    if (extra !== undefined) {
      if (typeof extra === "string") {
        extraStr = extra.length > 500 ? extra.substring(0, 500) : extra;
      } else {
        const extraJson = JSON.stringify(extra);
        extraStr = extraJson.length > 500 ? extraJson.substring(0, 500) : extra;
      }
    }

    // LINE 1: Strict JSON log for parsing
    const jsonLog = {
      marker: finalMarker,
      ui_git_sha,
      ui_req_id,
      extra: extraStr || null,
      presentKeys,
      ts: new Date().toISOString(),
    };
    console.log(`[UI_RELAY_JSON] ${JSON.stringify(jsonLog)}`);

    // LINE 2: Key=value log for grep binding
    console.log(
      `[UI_RELAY_BIND] marker=${finalMarker} ui_git_sha=${ui_git_sha} ui_req_id=${ui_req_id}`
    );

    return { ok: true };
  } catch (e) {
    // Swallow errors (fire-and-forget relay)
    console.error("[UI_RELAY_ERROR]", { error: (e as any)?.message });
    return { ok: true };  // Still return ok so UI doesn't break
  }
}

