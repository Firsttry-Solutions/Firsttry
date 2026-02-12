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
import { getBackendBuildIdentity_resolver } from './resolvers/getBackendBuildIdentity';
import { refreshNow_resolver } from './resolvers/refreshNow';
import { exportTrustSnapshot } from './resolvers/audit_snapshot_export';
import { getSnapshotDebug_resolver } from './resolvers/getSnapshotDebug';
import { getSnapshotVariant_resolver } from './resolvers/getSnapshotVariant';
import { ping } from './resolvers/ping';
import { debugSnapshotState_resolver } from './resolvers/debugSnapshotState';
import { ensureFirstSnapshot } from './resolvers/ensureFirstSnapshot';
import { probe } from './resolvers/probe'; // FORENSIC_PROBE
import { getDashboardSnapshotV1_resolver } from './resolvers/getDashboardSnapshotV1';
import { handler as ft_runAccessIntelligence_v1_handler } from './resolvers/ft_runAccessIntelligence_v1'; // PHASE 1
import { handler as ft_exportAccessPack_v1_handler } from './resolvers/ft_exportAccessPack_v1'; // PHASE 1
import { FtReasonCode, FtErrorCode } from './backbone/errorCodes';
import { FtResolverResponseV1, assertNoUnknownStrings, FtLedgerV1 } from './backbone/contract';
import { loadOrInitLedger, updateLedger } from './backbone/ledger';
import { nowUtcIso } from './backbone/time';
import { dashOk, dashErr, DashEnvelopeV1 } from './shared/dashEnvelopeV1';
import { BACKEND_BUILD_SHA } from './build/backend_build';
import { BACKEND_GIT_SHA, BACKEND_GIT_SHA_SHORT, BACKEND_BUILD_TIME_UTC, BACKEND_APP_VERSION } from './build/buildIdentityBackend.gen';
import { FT_BUILD_SHA } from './shared/backend_build_meta';
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
resolver.define('getBackendBuildIdentity', getBackendBuildIdentity_resolver);
resolver.define('refreshNow', refreshNow_resolver);
resolver.define('exportTrustSnapshot', exportTrustSnapshot);
resolver.define('debugSnapshotState', debugSnapshotState_resolver);
resolver.define('getSnapshotDebug', getSnapshotDebug_resolver);
resolver.define('getSnapshotVariant', getSnapshotVariant_resolver);
resolver.define('ping', ping);
resolver.define('ensureFirstSnapshot', ensureFirstSnapshot);
resolver.define('probe', probe);  // FORENSIC_PROBE

// Enterprise dashboard resolver (NEW - Phase 9)
resolver.define('getDashboardSnapshotV1', getDashboardSnapshotV1_resolver);

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
// CANONICAL ACTION RESULT ENVELOPE TYPE
// ============================================================================

/**
 * FT_ACTION_RESULT_V1: Canonical envelope for Phase1 action responses
 * 
 * INVARIANTS (fail-closed):
 * - envelopeKind ALWAYS 'FT_ACTION_RESULT_V1'
 * - ok: boolean
 * - action: 'RUN_ACCESS_REVIEW' | 'EXPORT_PHASE1_PACK'
 * - traceId: NEVER empty, format: trace_<timestamp>_<random>
 * - build: {buildShaShort,buildUtc,version} all NEVER empty
 * - If ok=false: MUST include reason (non-empty) and error{code,message,traceId}
 * - data: optional, contains action-specific result data
 */
interface FtActionResultV1 {
  envelopeKind: 'FT_ACTION_RESULT_V1';
  ok: boolean;
  action: 'RUN_ACCESS_REVIEW' | 'EXPORT_PHASE1_PACK';
  traceId: string; // never empty
  build: {
    buildShaShort: string; // never empty, 12-char or 'unknown'
    buildUtc: string; // never empty, ISO-8601 or 'unknown'
    version: string; // never empty, semver or 'unknown'
  };
  reason?: string; // required if ok=false, must be non-empty
  error?: {
    code: string; // never empty
    message: string; // never empty
    traceId: string; // never empty
  };
  data?: any;
}

// ============================================================================
// HELPER FUNCTIONS: Error Handling & Metadata
// ============================================================================

/**
 * Generates a UUID-style traceId or returns existing one from request
 */
function getOrCreateTraceId(request: any): string {
  // Try to extract traceId from request
  const existing = request?.traceId || request?.trace_id;
  if (typeof existing === 'string' && existing.length > 0) {
    return existing;
  }
  // Generate new traceId: trace_<timestamp>_<random>
  const newId = `trace_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  return newId;
}

/**
 * Extracts short build SHA from full SHA (first 12 chars)
 */
function getBuildShaShort(fullSha: string | null | undefined): string {
  if (!fullSha || typeof fullSha !== 'string') return 'unknown';
  const short = fullSha.slice(0, 12);
  return short && short.length > 0 ? short : 'unknown';
}

/**
 * Builds canonical build metadata object (no empty fields)
 */
function buildMeta(): { buildShaShort: string; buildUtc: string; version: string } {
  return {
    buildShaShort: getBuildShaShort(FT_BUILD_SHA),
    buildUtc: BACKEND_BUILD_TIME_UTC && BACKEND_BUILD_TIME_UTC.length > 0 ? BACKEND_BUILD_TIME_UTC : 'unknown',
    version: BACKEND_APP_VERSION && BACKEND_APP_VERSION.length > 0 ? BACKEND_APP_VERSION : 'unknown',
  };
}

/**
 * Normalizes action errors into a structured error response
 * Ensures NEVER returns empty strings for critical fields
 */
function normalizeActionError(
  action: string,
  traceId: string,
  err: any
): {
  reason: string;
  error: { code: string; message: string; traceId: string };
} {
  let code = 'PHASE1_FAILED';
  let message = 'Phase 1 failed';
  let reason = 'UNSPECIFIED_FAILURE';

  if (err) {
    // Extract message
    if (err.message && typeof err.message === 'string' && err.message.length > 0) {
      message = err.message;
    }

    // Map HTTP status to error code and reason
    const status = err.status || err.statusCode || err.code;
    if (typeof status === 'number') {
      if (status >= 500) {
        code = 'JIRA_5XX';
        reason = 'Jira service error';
      } else if (status === 429) {
        code = 'JIRA_429';
        reason = 'Rate limited by Jira';
      } else if (status === 403) {
        code = 'JIRA_403';
        reason = 'Permission denied';
      } else if (status === 401) {
        code = 'JIRA_401';
        reason = 'Authentication failed';
      } else if (status >= 400) {
        code = `JIRA_${status}`;
        reason = 'Jira API error';
      }
    }
  }

  // Ensure no empty strings
  return {
    reason: reason && reason.length > 0 ? reason : 'UNSPECIFIED_FAILURE',
    error: {
      code: code && code.length > 0 ? code : 'PHASE1_FAILED',
      message: message && message.length > 0 ? message : 'Phase 1 failed',
      traceId: traceId && traceId.length > 0 ? traceId : 'unknown',
    },
  };
}

// ============================================================================
// LAYER-0 BACKBONE RESOLVERS (NEW)
// ============================================================================

/**
 * Internal handler for Phase 1 Access Intelligence actions
 * Returns FT_ACTION_RESULT_V1 envelope (never wrapped in dashboard state)
 * 
 * Handles both:
 * A) thrown exceptions → normalizeActionError
 * B) soft failures (result.ok === false) → maps to compliant envelope
 */
async function handlePhase1AccessReview(request: any): Promise<FtActionResultV1> {
  const traceId = getOrCreateTraceId(request);
  const build = buildMeta();

  try {
    console.log('[FT_PROOF_PHASE1_DISPATCH]', 'entering handlePhase1AccessReview');
    console.log('[FT_PROOF_PHASE1_PRE_HANDLER_CALL]', 'about to call ft_runAccessIntelligence_v1_handler');
    
    let handlerResult: any;
    try {
      handlerResult = await ft_runAccessIntelligence_v1_handler(request);
    } catch (handlerErr: any) {
      console.log('[FT_PROOF_PHASE1_HANDLER_THROWN]', JSON.stringify({
        name: handlerErr?.name || 'unknown',
        message: handlerErr?.message || 'unknown',
      }));
      throw handlerErr;
    }
    
    // **SOFT FAILURE DETECTION**: Handler may return { ok:false } without throwing
    if (handlerResult && typeof handlerResult === 'object' && handlerResult.ok === false) {
      // Handler returned a soft failure - map to compliant error envelope
      const softFailureMessage = String(handlerResult.reason || handlerResult.error?.message || 'Phase 1 failed');
      const softFailureCode = String(handlerResult.error?.code || 'PHASE1_SOFT_FAILED');
      
      console.log('[FT_PROOF_PHASE1_FAIL]', JSON.stringify({
        action: 'RUN_ACCESS_REVIEW',
        traceId,
        code: softFailureCode,
        reason: softFailureMessage,
        source: 'soft_failure',
        ts: new Date().toISOString(),
      }));

      // Log action envelope proof marker on soft failure
      console.log('[FT_PROOF_ACTION_ENVELOPE]', JSON.stringify({
        action: 'RUN_ACCESS_REVIEW',
        ok: false,
        envelopeKind: 'FT_ACTION_RESULT_V1',
        traceId,
        buildShaShort: build.buildShaShort,
        code: softFailureCode,
        reason: softFailureMessage,
        ts: new Date().toISOString(),
      }));

      // Return compliant failure envelope from soft failure
      return {
        envelopeKind: 'FT_ACTION_RESULT_V1',
        ok: false,
        action: 'RUN_ACCESS_REVIEW',
        traceId,
        build,
        reason: softFailureMessage,
        error: {
          code: softFailureCode,
          message: softFailureMessage,
          traceId,
        },
        data: handlerResult, // Include handler result for debugging
      };
    }

    // Handler call succeeded (ok === true or success case)
    console.log('[FT_PROOF_PHASE1_AFTER_HANDLER_SUCCESS]', 'handler returned successfully');
    console.log(JSON.stringify({
      marker: '[FT_DASH_ACTION_END]',
      action: 'RUN_ACCESS_REVIEW',
      ok: handlerResult?.ok,
      ts: new Date().toISOString(),
    }));

    // Log action envelope proof marker
    console.log('[FT_PROOF_ACTION_ENVELOPE]', JSON.stringify({
      action: 'RUN_ACCESS_REVIEW',
      ok: handlerResult?.ok === true,
      envelopeKind: 'FT_ACTION_RESULT_V1',
      traceId,
      buildShaShort: build.buildShaShort,
      ts: new Date().toISOString(),
    }));

    // Return canonical success envelope
    return {
      envelopeKind: 'FT_ACTION_RESULT_V1',
      ok: handlerResult?.ok === true,
      action: 'RUN_ACCESS_REVIEW',
      traceId,
      build,
      data: handlerResult,
    };
  } catch (error: any) {
    // Exception thrown - use normalizer for structured error
    const normalized = normalizeActionError('RUN_ACCESS_REVIEW', traceId, error);
    
    console.log('[FT_PROOF_PHASE1_FAIL]', JSON.stringify({
      action: 'RUN_ACCESS_REVIEW',
      traceId,
      code: normalized.error.code,
      reason: normalized.reason,
      source: 'thrown_exception',
      ts: new Date().toISOString(),
    }));

    console.error(JSON.stringify({
      marker: '[FT_DASH_ACTION_ERROR]',
      action: 'RUN_ACCESS_REVIEW',
      error: error?.message || String(error),
      ts: new Date().toISOString(),
    }));

    // Log action envelope proof marker on failure
    console.log('[FT_PROOF_ACTION_ENVELOPE]', JSON.stringify({
      action: 'RUN_ACCESS_REVIEW',
      ok: false,
      envelopeKind: 'FT_ACTION_RESULT_V1',
      traceId,
      buildShaShort: build.buildShaShort,
      code: normalized.error.code,
      reason: normalized.reason,
      ts: new Date().toISOString(),
    }));

    // Return canonical failure envelope with structured error
    return {
      envelopeKind: 'FT_ACTION_RESULT_V1',
      ok: false,
      action: 'RUN_ACCESS_REVIEW',
      traceId,
      build,
      reason: normalized.reason,
      error: normalized.error,
    };
  }
}

/**
 * Internal handler for Phase 1 Export Pack actions
 * Returns FT_ACTION_RESULT_V1 envelope (never wrapped in dashboard state)
 * 
 * Handles both:
 * A) thrown exceptions → normalizeActionError
 * B) soft failures (result.ok === false) → maps to compliant envelope
 */
async function handlePhase1ExportPack(request: any): Promise<FtActionResultV1> {
  const traceId = getOrCreateTraceId(request);
  const build = buildMeta();

  try {
    console.log(JSON.stringify({
      marker: '[FT_DASH_ACTION_START]',
      action: 'EXPORT_PHASE1_PACK',
      ts: new Date().toISOString(),
    }));

    let handlerResult: any;
    try {
      handlerResult = await ft_exportAccessPack_v1_handler(request);
    } catch (handlerErr: any) {
      console.log('[FT_PROOF_PHASE1_HANDLER_THROWN]', JSON.stringify({
        name: handlerErr?.name || 'unknown',
        message: handlerErr?.message || 'unknown',
      }));
      throw handlerErr;
    }
    
    console.log(JSON.stringify({
      marker: '[FT_DASH_ACTION_END]',
      action: 'EXPORT_PHASE1_PACK',
      ok: handlerResult?.ok,
      ts: new Date().toISOString(),
    }));

    // **SOFT FAILURE DETECTION**: Handler may return { ok:false } without throwing
    if (handlerResult && typeof handlerResult === 'object' && handlerResult.ok === false) {
      // Handler returned a soft failure - map to compliant error envelope
      const softFailureMessage = String(handlerResult.reason || handlerResult.error?.message || 'Export failed');
      const softFailureCode = String(handlerResult.error?.code || 'PHASE1_SOFT_FAILED');
      
      console.log('[FT_PROOF_PHASE1_FAIL]', JSON.stringify({
        action: 'EXPORT_PHASE1_PACK',
        traceId,
        code: softFailureCode,
        reason: softFailureMessage,
        source: 'soft_failure',
        ts: new Date().toISOString(),
      }));

      // Log action envelope proof marker on soft failure
      console.log('[FT_PROOF_ACTION_ENVELOPE]', JSON.stringify({
        action: 'EXPORT_PHASE1_PACK',
        ok: false,
        envelopeKind: 'FT_ACTION_RESULT_V1',
        traceId,
        buildShaShort: build.buildShaShort,
        code: softFailureCode,
        reason: softFailureMessage,
        ts: new Date().toISOString(),
      }));

      // Return compliant failure envelope from soft failure
      return {
        envelopeKind: 'FT_ACTION_RESULT_V1',
        ok: false,
        action: 'EXPORT_PHASE1_PACK',
        traceId,
        build,
        reason: softFailureMessage,
        error: {
          code: softFailureCode,
          message: softFailureMessage,
          traceId,
        },
        data: handlerResult, // Include handler result for debugging
      };
    }

    // Log action envelope proof marker on success
    console.log('[FT_PROOF_ACTION_ENVELOPE]', JSON.stringify({
      action: 'EXPORT_PHASE1_PACK',
      ok: handlerResult?.ok === true,
      envelopeKind: 'FT_ACTION_RESULT_V1',
      traceId,
      buildShaShort: build.buildShaShort,
      ts: new Date().toISOString(),
    }));

    return {
      envelopeKind: 'FT_ACTION_RESULT_V1',
      ok: handlerResult?.ok === true,
      action: 'EXPORT_PHASE1_PACK',
      traceId,
      build,
      data: handlerResult,
    };
  } catch (error: any) {
    const normalized = normalizeActionError('EXPORT_PHASE1_PACK', traceId, error);

    console.log('[FT_PROOF_PHASE1_FAIL]', JSON.stringify({
      action: 'EXPORT_PHASE1_PACK',
      traceId,
      code: normalized.error.code,
      reason: normalized.reason,
      source: 'thrown_exception',
      ts: new Date().toISOString(),
    }));

    console.error(JSON.stringify({
      marker: '[FT_DASH_ACTION_ERROR]',
      action: 'EXPORT_PHASE1_PACK',
      error: error?.message || String(error),
      ts: new Date().toISOString(),
    }));

    // Log action envelope proof marker on failure
    console.log('[FT_PROOF_ACTION_ENVELOPE]', JSON.stringify({
      action: 'EXPORT_PHASE1_PACK',
      ok: false,
      envelopeKind: 'FT_ACTION_RESULT_V1',
      traceId,
      buildShaShort: build.buildShaShort,
      code: normalized.error.code,
      reason: normalized.reason,
      ts: new Date().toISOString(),
    }));

    return {
      envelopeKind: 'FT_ACTION_RESULT_V1',
      ok: false,
      action: 'EXPORT_PHASE1_PACK',
      traceId,
      build,
      reason: normalized.reason,
      error: normalized.error,
    };
  }
}

export async function ft_getDashboardState_v1(request: any): Promise<FtDashEnvelopeV1> {
  try {
    // ALWAYS-ON build fingerprint - logs on every resolver call (critical for proof window)
    const action = request?.action || request?.payload?.action;
    console.log('[FT_PROOF_BUILD_FINGERPRINT]', JSON.stringify({
      marker: 'FT_PROOF_BUILD_FINGERPRINT',
      ts: new Date().toISOString(),
      action: action || null,
      buildSha: FT_BUILD_SHA || null,
      buildUtc: BACKEND_BUILD_TIME_UTC || null,
      version: BACKEND_APP_VERSION || null,
    }));

    // Extract correlation_id and ui_req_id from request (sent by UI)
    const correlationId = request?.correlation_id || request?.correlationId || 'unknown';
    const uiReqId = request?.ui_req_id || request?.uiReqId || 'unknown';
    
    // Log resolver entry marker with correlation IDs
    console.log(JSON.stringify({
      marker: '[FT_RESOLVER_ENTRY]',
      resolver: 'ft_getDashboardState_v1',
      correlationId,
      uiReqId,
      ts: new Date().toISOString(),
    }));

    // STEP 1: Check for optional action parameter (NEW - BACKBONE LAYER 1)
    // If action is present, return the action result envelope DIRECTLY (no wrapping)
    if (action && typeof action === 'string') {
      console.log(JSON.stringify({
        marker: '[FT_DASH_ACTION_DISPATCH]',
        action,
        correlationId,
        ts: new Date().toISOString(),
      }));

      if (action === 'RUN_ACCESS_REVIEW') {
        console.log('[FT_PROOF_PHASE1_ACTION_START]', 'RUN_ACCESS_REVIEW action triggered');
        const actionResult = await handlePhase1AccessReview(request);
        // Return FT_ACTION_RESULT_V1 envelope DIRECTLY (no dashboard wrapping)
        return actionResult as any;
      } else if (action === 'EXPORT_PHASE1_PACK') {
        const actionResult = await handlePhase1ExportPack(request);
        // Return FT_ACTION_RESULT_V1 envelope DIRECTLY (no dashboard wrapping)
        return actionResult as any;
      } else {
        // Invalid action string - return failure envelope in canonical form
        const traceId = getOrCreateTraceId(request);
        const build = buildMeta();
        const normalized = normalizeActionError(action, traceId, new Error(`Unknown action: ${action}`));

        console.error(JSON.stringify({
          marker: '[FT_DASH_ACTION_INVALID]',
          action,
          reason: 'Unknown action name',
          ts: new Date().toISOString(),
        }));

        // Return canonical action failure envelope
        return {
          envelopeKind: 'FT_ACTION_RESULT_V1',
          ok: false,
          action: action as any,
          traceId,
          build,
          reason: normalized.reason,
          error: normalized.error,
        } as any;
      }
    }

    // STEP 2: No action present - return normal dashboard state
    
    // ENTERPRISE PROOF PACK: Extract dashboard context (non-PII)
    const dashboardId = request?.payload?.dashboardId || request?.dashboardId || 'MISSING';
    const dashboardPath = request?.payload?.dashboardPath || request?.dashboardPath || 'MISSING';
    const cloudId = request?.context?.cloudId || 'MISSING';
    
    // Validate dashboardId format (fail-closed)
    // Rule: If MISSING, keep as MISSING. Otherwise must match \d{1,10} or becomes INVALID.
    const dashboardIdValid = dashboardId === 'MISSING' || /^\d{1,10}$/.test(dashboardId);
    if (!dashboardIdValid) {
      console.log(JSON.stringify({
        marker: '[FT_DASHBOARD_CONTEXT_INVALID]',
        dashboardId,
        reason: 'Invalid dashboardId format (expected digits only, max 10 chars, or MISSING)',
        ts: new Date().toISOString(),
      }));
    }
    
    // Compute tenantHashPrefix: sha256(cloudId).slice(0,12)
    const tenantHashPrefix = await (async () => {
      if (cloudId === 'MISSING') return 'MISSING';
      try {
        const crypto = require('crypto');
        const hash = crypto.createHash('sha256').update(cloudId).digest('hex');
        return hash.slice(0, 12);
      } catch (e) {
        console.error('[FT_TENANT_HASH_FAILED]', e);
        return 'HASH_FAILED';
      }
    })();
    
    // Build dashboard context for envelope (preserve MISSING, never use INVALID)
    // Phase 2 fix: dashboardId comes from view.getContext() (frontend), preserve as-is
    const dashboardContext = {
      dashboardId,  // Keep as-is: either actual ID or "MISSING"
      tenantHashPrefix,
      dashboardPath,
    };
    
    console.log(JSON.stringify({
      marker: '[FT_DASHBOARD_CONTEXT]',
      dashboardId: dashboardContext.dashboardId,
      tenantHashPrefix: dashboardContext.tenantHashPrefix,
      dashboardPath: dashboardContext.dashboardPath,
      ts: new Date().toISOString(),
    }));
    
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
                // Repaired snapshot is now valid - return it with enterprise contract structure
                console.log(JSON.stringify({
                  marker: "[FT_RESOLVER_REPAIR_SUCCESS]",
                  snapshotId: repairedSnapshot.snapshotId,
                  ts: new Date().toISOString()
                }));
                
                // ENTERPRISE CONTRACT: Compute integrity hash
                const computeIntegrityHash = (snapshotData: any): string => {
                  try {
                    const crypto = require('crypto');
                    const canonicalInput = {
                      snapshotId: snapshotData.snapshotId,
                      createdAtUtc: snapshotData.createdAtUtc,
                      schemaVersion: snapshotData.schemaVersion,
                      data: snapshotData.data,
                    };
                    const canonicalJson = JSON.stringify(canonicalInput, Object.keys(canonicalInput).sort());
                    return crypto.createHash('sha256').update(canonicalJson, 'utf8').digest('hex');
                  } catch (e) {
                    console.error('[FT_INTEGRITY_HASH_FAILED]', e);
                    return '0000000000000000000000000000000000000000000000000000000000000000';
                  }
                };
                
                const integrityHash = computeIntegrityHash(repairedSnapshot);
                const snapshotKind = repairedSnapshot.snapshotId.includes('-seed') ? "SEED" : "GOVERNANCE";
                
                // FRESHNESS SEMANTICS: SEED snapshots are NOT governance evidence
                // Only GOVERNANCE snapshots contribute to freshness
                const FRESHNESS_STALE_AFTER_DAYS = 30;
                let evidenceFreshness: any;
                if (snapshotKind === "SEED") {
                  // No governance snapshots exist - freshness is NO_GOVERNANCE with null values
                  evidenceFreshness = {
                    lastCollectedUtc: null,
                    ageSeconds: null,
                    status: "NO_GOVERNANCE",
                    staleAfterDays: FRESHNESS_STALE_AFTER_DAYS,
                  };
                } else {
                  // GOVERNANCE snapshot - compute actual freshness
                  const lastCollectedUtc = repairedSnapshot.createdAtUtc;
                  const ageSeconds = Math.floor((Date.now() - new Date(lastCollectedUtc).getTime()) / 1000);
                  const freshnessStatus = ageSeconds > (FRESHNESS_STALE_AFTER_DAYS * 86400) ? "STALE" : "CURRENT";
                  evidenceFreshness = {
                    lastCollectedUtc,
                    ageSeconds,
                    status: freshnessStatus,
                    staleAfterDays: FRESHNESS_STALE_AFTER_DAYS,
                  };
                }
                
                const READ_ONLY_STATEMENT_EXACT = "FirstTry is a read-only system. It does not modify Jira data, settings, or configurations.";
                const IMMUTABILITY_STATEMENT_EXACT = "Timestamp recorded at snapshot creation (UTC) and cannot be modified.";
                const EXPORT_DECLARATION_EXACT = "This export contains governance evidence collected from a live Jira tenant.";
                const SEED_VS_GOVERNANCE_TITLE_EXACT = "Seed vs Governance";
                const SEED_BULLETS_EXACT = [
                  "Seed snapshots initialize baseline context and are not audit evidence.",
                  "Governance snapshots are immutable evidence captured after initialization.",
                  "Only governance snapshots can be exported as evidence."
                ];
                
                // Build snapshots array with main snapshot + Phase 1 governance snapshots
                const snapshotsArray = [
                  {
                    snapshotId: repairedSnapshot.snapshotId,
                    snapshotKind,
                    origin: snapshotKind === "SEED" ? "SCHEDULED" : "ON_DEMAND",
                    initiator: snapshotKind === "SEED" ? "system" : "user",
                    triggerReason: undefined,
                    createdAtUtc: repairedSnapshot.createdAtUtc,
                    immutabilityStatement: IMMUTABILITY_STATEMENT_EXACT,
                    integrity: {
                      algorithm: "sha256",
                      value: integrityHash,
                    },
                    scope: {
                      included: [
                        "Jira projects configuration metadata",
                        "Workflow schemes and statuses",
                        "Permission schemes and roles",
                        "Automation rules metadata",
                        "App/plugin installation list"
                      ],
                      excluded: [
                        "Issue contents (summaries, descriptions, comments, attachments)",
                        "User profile data (names, emails, avatars)",
                        "Personally Identifiable Information (PII)",
                        "Authentication tokens or credentials",
                        "Real-time activity or audit logs"
                      ],
                    },
                    controls: [
                      "Change management (workflow configuration)",
                      "Access control configuration (permission schemes)",
                      "Automation governance (rule inventory)",
                      "Third-party app risk assessment (installed apps list)"
                    ],
                    exportEligible: snapshotKind === "GOVERNANCE",
                    exportDeclaration: EXPORT_DECLARATION_EXACT,
                  }
                ];
                
                // PHASE 1: Add governance snapshots scanned by ft_runAccessIntelligence_v1
                try {
                  const lastGovernanceSnapshot = await storage.get('ft:snapshot:last:v1');
                  if (lastGovernanceSnapshot && lastGovernanceSnapshot.canonicalHash && lastGovernanceSnapshot.riskModel) {
                    // This is a Phase 1 access intelligence snapshot
                    const phase1SnapshotMeta = {
                      snapshotId: lastGovernanceSnapshot.canonicalHash,
                      snapshotKind: "GOVERNANCE",
                      phase1: true,
                      scanType: "ACCESS_INTELLIGENCE",
                      origin: "ON_DEMAND",
                      initiator: "user",
                      triggerReason: "Phase 1 Access Governance Scan",
                      createdAtUtc: lastGovernanceSnapshot.buildUtc || new Date().toISOString(),
                      immutabilityStatement: IMMUTABILITY_STATEMENT_EXACT,
                      integrity: {
                        algorithm: "sha256",
                        value: lastGovernanceSnapshot.canonicalHash,
                      },
                      scope: {
                        included: [
                          "User enumeration (active, external)",
                          "Project access visibility",
                          "Global admin detection",
                          "Toxic rule evaluation",
                          "Risk model computation"
                        ],
                        excluded: [
                          "Issue contents",
                          "User profile data (names, emails)",
                          "Audit logs",
                          "Authentication tokens"
                        ],
                      },
                      controls: [
                        "External user proliferation detection",
                        "Admin density assessment",
                        "Public project exposure",
                        "Toxic permission combinations"
                      ],
                      exportEligible: true,
                      exportDeclaration: EXPORT_DECLARATION_EXACT,
                      riskTier: computeRiskTier(lastGovernanceSnapshot.riskModel.finalRiskScore),
                      counts: {
                        totalUsers: lastGovernanceSnapshot.totals?.totalUsers,
                        externalUsers: lastGovernanceSnapshot.totals?.externalUsers,
                        globalAdmins: lastGovernanceSnapshot.exposure?.globalAdmins?.length,
                        publicProjects: lastGovernanceSnapshot.exposure?.publicProjects?.length,
                        toxicFindings: lastGovernanceSnapshot.toxicFindings?.length,
                      },
                    };
                    snapshotsArray.push(phase1SnapshotMeta);
                  }
                } catch (e: any) {
                  console.debug('[FT_PHASE1_SNAPSHOT_LOAD]', {
                    status: 'error',
                    reason: e?.message || String(e),
                  });
                }
                
                return {
                  status: "AVAILABLE",
                  readOnlyGuarantee: READ_ONLY_STATEMENT_EXACT,
                  seedVsGovernanceExplanation: {
                    title: SEED_VS_GOVERNANCE_TITLE_EXACT,
                    bullets: SEED_BULLETS_EXACT,
                  },
                  evidenceFreshness,
                  snapshots: snapshotsArray,
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
                  dashboardContext,
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
      
      // TASK 1C: Add backend build identity fields (from generated file)
      // These are deterministically generated at build time from git HEAD and package.json
      
      // ENTERPRISE CONTRACT: Compute integrity hash (deterministic sha256)
      const computeIntegrityHash = (snapshotData: any): string => {
        try {
          const crypto = require('crypto');
          // Create canonical representation (sorted keys, exclude volatile fields)
          const canonicalInput = {
            snapshotId: snapshotData.snapshotId,
            createdAtUtc: snapshotData.createdAtUtc,
            schemaVersion: snapshotData.schemaVersion,
            data: snapshotData.data,
          };
          const canonicalJson = JSON.stringify(canonicalInput, Object.keys(canonicalInput).sort());
          return crypto.createHash('sha256').update(canonicalJson, 'utf8').digest('hex');
        } catch (e) {
          console.error('[FT_INTEGRITY_HASH_FAILED]', e);
          return '0000000000000000000000000000000000000000000000000000000000000000';
        }
      };
      
      const integrityHash = computeIntegrityHash(snapshot);
      
      // PHASE 1: Check for governance snapshots (newer than seed)
      let governanceSnapshot = null;
      try {
        governanceSnapshot = await storage.get('ft:snapshot:latest:governance');
      } catch (e) {
        console.warn('[FT_GOVERNANCE_SNAPSHOT_NOT_FOUND]', 'No Phase 1 governance snapshot yet');
      }
      
      // ENTERPRISE CONTRACT: Detect snapshot kind (SEED vs GOVERNANCE)
      // For now, all snapshots from seedSnapshot are SEED
      // Future: Governance snapshots will be created via scheduled/triggered/on-demand collectors
      const snapshotKind = snapshot.snapshotId.includes('-seed') ? "SEED" : "GOVERNANCE";
      
      // ENTERPRISE CONTRACT: Compute freshness (SEED snapshots are NOT governance evidence)
      // FRESHNESS SEMANTICS: Only GOVERNANCE snapshots contribute to freshness
      const FRESHNESS_STALE_AFTER_DAYS = 30;
      let evidenceFreshness: any;
      if (snapshotKind === "SEED") {
        // No governance snapshots exist - freshness is NO_GOVERNANCE with null values
        evidenceFreshness = {
          lastCollectedUtc: null,
          ageSeconds: null,
          status: "NO_GOVERNANCE",
          staleAfterDays: FRESHNESS_STALE_AFTER_DAYS,
        };
      } else {
        // GOVERNANCE snapshot - compute actual freshness
        const lastCollectedUtc = snapshot.createdAtUtc;
        const ageSeconds = Math.floor((Date.now() - new Date(lastCollectedUtc).getTime()) / 1000);
        const freshnessStatus = ageSeconds > (FRESHNESS_STALE_AFTER_DAYS * 86400) ? "STALE" : "CURRENT";
        evidenceFreshness = {
          lastCollectedUtc,
          ageSeconds,
          status: freshnessStatus,
          staleAfterDays: FRESHNESS_STALE_AFTER_DAYS,
        };
      }
      
      // ENTERPRISE CONTRACT CONSTANTS (exact strings)
      const READ_ONLY_STATEMENT_EXACT = "FirstTry is a read-only system. It does not modify Jira data, settings, or configurations.";
      const IMMUTABILITY_STATEMENT_EXACT = "Timestamp recorded at snapshot creation (UTC) and cannot be modified.";
      const EXPORT_DECLARATION_EXACT = "This export contains governance evidence collected from a live Jira tenant.";
      const SEED_VS_GOVERNANCE_TITLE_EXACT = "Seed vs Governance";
      const SEED_BULLETS_EXACT = [
        "Seed snapshots initialize baseline context and are not audit evidence.",
        "Governance snapshots are immutable evidence captured after initialization.",
        "Only governance snapshots can be exported as evidence."
      ];
      
      // ENTERPRISE CONTRACT: Structure response
      const enterpriseContractData = {
        // Global dashboard fields
        readOnlyGuarantee: READ_ONLY_STATEMENT_EXACT,
        seedVsGovernanceExplanation: {
          title: SEED_VS_GOVERNANCE_TITLE_EXACT,
          bullets: SEED_BULLETS_EXACT,
        },
        evidenceFreshness,
        // Snapshots array (currently only one, but may include governance if available)
        snapshots: (() => {
          const snapshotsArray = [
            {
              snapshotId: snapshot.snapshotId,
              snapshotKind,
              origin: snapshotKind === "SEED" ? "SCHEDULED" : "ON_DEMAND",
              initiator: snapshotKind === "SEED" ? "system" : "user",
              triggerReason: undefined, // Only for TRIGGERED snapshots
              createdAtUtc: snapshot.createdAtUtc,
              immutabilityStatement: IMMUTABILITY_STATEMENT_EXACT,
              integrity: {
                algorithm: "sha256",
                value: integrityHash,
              },
              scope: {
                included: [
                  "Jira projects configuration metadata",
                  "Workflow schemes and statuses",
                  "Permission schemes and roles",
                  "Automation rules metadata",
                  "App/plugin installation list"
                ],
                excluded: [
                  "Issue contents (summaries, descriptions, comments, attachments)",
                  "User profile data (names, emails, avatars)",
                  "Personally Identifiable Information (PII)",
                  "Authentication tokens or credentials",
                  "Real-time activity or audit logs"
                ],
              },
              controls: [
                "Change management (workflow configuration)",
                "Access control configuration (permission schemes)",
                "Automation governance (rule inventory)",
                "Third-party app risk assessment (installed apps list)"
              ],
              exportEligible: snapshotKind === "GOVERNANCE",
              exportDeclaration: EXPORT_DECLARATION_EXACT,
            }
          ];
          
          // PHASE 1: Add governance snapshot if available
          if (governanceSnapshot && governanceSnapshot.data) {
            const govIntegrityHash = computeIntegrityHash(governanceSnapshot);
            snapshotsArray.unshift({
              snapshotId: governanceSnapshot.snapshotId,
              snapshotKind: "GOVERNANCE",
              origin: "ON_DEMAND",
              initiator: "user",
              triggerReason: "Phase 1 Access Intelligence Scan",
              createdAtUtc: governanceSnapshot.createdAtUtc,
              immutabilityStatement: IMMUTABILITY_STATEMENT_EXACT,
              integrity: {
                algorithm: "sha256",
                value: govIntegrityHash,
              },
              scope: {
                included: [
                  "Global admin assignments",
                  "Project admin assignments",
                  "External user detection",
                  "Public project visibility",
                  "Permission scheme analysis"
                ],
                excluded: [
                  "Issue contents",
                  "User profile data",
                  "Personally Identifiable Information (PII)",
                  "Authentication tokens",
                  "Real-time activity"
                ],
              },
              controls: [
                "Admin assignment governance",
                "External access control",
                "Project visibility governance",
                "Permission boundary definition"
              ],
              exportEligible: true,
              exportDeclaration: EXPORT_DECLARATION_EXACT,
            });
            
            // Update freshness to reflect governance snapshot if it's newer
            if (!evidenceFreshness.lastCollectedUtc || 
                new Date(governanceSnapshot.createdAtUtc) > new Date(evidenceFreshness.lastCollectedUtc)) {
              const govAgeSeconds = Math.floor((Date.now() - new Date(governanceSnapshot.createdAtUtc).getTime()) / 1000);
              const govFreshnessStatus = govAgeSeconds > (FRESHNESS_STALE_AFTER_DAYS * 86400) ? "STALE" : "CURRENT";
              Object.assign(evidenceFreshness, {
                lastCollectedUtc: governanceSnapshot.createdAtUtc,
                ageSeconds: govAgeSeconds,
                status: govFreshnessStatus,
              });
            }
          }
          
          return snapshotsArray;
        })(),
        // Backend build identity fields (canonical names with full/short SHA distinction)
        backend_git_sha: BACKEND_GIT_SHA,
        backend_git_sha_short: BACKEND_GIT_SHA_SHORT,
        backend_build_time_utc: BACKEND_BUILD_TIME_UTC,
        backend_app_version: BACKEND_APP_VERSION,
        // Legacy: Keep for backward compat with existing UI
        snapshotId: snapshot.snapshotId,
        createdAtUtc: snapshot.createdAtUtc,
        schemaVersion: "L0",
        containsText: "Jira governance evidence snapshot (export for full details).",
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
        },
        dashboardContext,  // Enterprise: add dashboard context
      };
      
      // ENTERPRISE CONTRACT: Fail-closed validation
      const governanceSnapshots = enterpriseContractData.snapshots.filter(s => s.snapshotKind === "GOVERNANCE");
      if (governanceSnapshots.length > 0) {
        // Verify ALL governance snapshots have ALL required fields
        for (const snap of governanceSnapshots) {
          const requiredFields = [
            'snapshotId', 'snapshotKind', 'origin', 'initiator', 'createdAtUtc',
            'immutabilityStatement', 'integrity', 'scope', 'controls',
            'exportEligible', 'exportDeclaration'
          ];
          for (const field of requiredFields) {
            if (!(field in snap) || snap[field as keyof typeof snap] === undefined) {
              console.error(`[FT_ENTERPRISE_CONTRACT_MISSING_FIELDS] Field ${field} missing in governance snapshot ${snap.snapshotId}`);
              return {
                status: "HARD ERROR",
                error: "FT_ENTERPRISE_CONTRACT_MISSING_FIELDS",
                message: `Governance snapshot ${snap.snapshotId} missing required field: ${field}`,
              };
            }
          }
        }
      }
      
      // Backend logging (MANDATORY for corroboration)
      console.log(JSON.stringify({
        marker: "[FT_ENTERPRISE_CONTRACT_BACKEND_OK]",
        dashboardId: dashboardContext.dashboardId,
        tenantHashPrefix: dashboardContext.tenantHashPrefix,
        governanceSnapshotCount: governanceSnapshots.length,
        lastCollectedUtc: evidenceFreshness.lastCollectedUtc,  // null for NO_GOVERNANCE
        freshnessStatus: evidenceFreshness.status,
        ts: new Date().toISOString(),
      }));
      
      return {
        status: "AVAILABLE",
        ...enterpriseContractData,
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
        "Dashboard resolver implementation returned invalid response shape",
        undefined,
        dashboardContext
      );
    }

    // BACKBONE FIX: Use okEnvelope/notAvailableEnvelope/hardErrorEnvelope
    // (envelopeKind: 'FT_DASH_ENVELOPE_v1', schemaVersion: 1, status: 'AVAILABLE'|'NOT_AVAILABLE'|'HARD_ERROR'|'NO_SNAPSHOT'|'INVALID_SNAPSHOT')
    let result: FtDashEnvelopeV1;
    if (raw.status === "AVAILABLE") {
      result = okEnvelope(raw, dashboardContext);
    } else if (raw.status === "NO_SNAPSHOT") {
      // Missing snapshot - non-fatal state (user can still see dashboard with no data)
      result = notAvailableEnvelope(
        raw.error ?? "NO_SNAPSHOT_POINTER",
        raw.error ? `Dashboard state: ${raw.error}` : "Snapshot is not available",
        undefined,
        dashboardContext
      );
    } else if (raw.status === "INVALID_SNAPSHOT") {
      // Invalid snapshot - non-fatal state (schema/parse error but not a contract violation)
      result = notAvailableEnvelope(
        raw.error ?? "SNAPSHOT_SCHEMA_MISMATCH",
        raw.error ? `Dashboard state: ${raw.error}` : "Snapshot schema is invalid",
        undefined,
        dashboardContext
      );
    } else if (raw.status === "NOT_AVAILABLE") {
      result = notAvailableEnvelope(
        raw.error ?? "FT_SNAPSHOT_INVALID",
        raw.error ? `Dashboard state not available: ${raw.error}` : "Snapshot is not available",
        undefined,
        dashboardContext
      );
    } else if (raw.status === "HARD ERROR") {
      result = hardErrorEnvelope(
        raw.error ?? "FT_SNAPSHOT_INVALID",
        raw.error ? `Dashboard state failed: ${raw.error}` : "Snapshot is invalid or missing",
        undefined,
        dashboardContext
      );
    } else {
      // Unexpected status value - fail-closed
      console.error("[FT_L0_DASHBOARD] CRITICAL: Unexpected status value", {
        status: raw.status,
        statusType: typeof raw.status,
      });
      result = hardErrorEnvelope(
        "FT_UNEXPECTED_STATUS",
        `Unexpected status value: ${raw.status}`,
        undefined,
        dashboardContext
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
    // Note: dashboardContext may not be available if error occurred before extraction
    const dashboardContextSafe = {
      dashboardId: 'ERROR_BEFORE_EXTRACTION',
      tenantHashPrefix: 'ERROR_BEFORE_EXTRACTION',
      dashboardPath: 'ERROR_BEFORE_EXTRACTION',
    };
    return hardErrorEnvelope(
      "FT_RESOLVER_EXCEPTION",
      `Dashboard resolver failed: ${errorMsg.slice(0, 150)}`,
      undefined,
      dashboardContextSafe
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

    // Log resolver OK marker for correlation tracking
    console.log(JSON.stringify({
      marker: '[FT_RESOLVER_OK]',
      resolver: 'ft_getDashboardState_v1',
      correlationId: request?.correlation_id || request?.correlationId || 'unknown',
      uiReqId: request?.ui_req_id || request?.uiReqId || 'unknown',
      okType: (envelope as any).okType || 'unknown',
      ts: new Date().toISOString(),
    }));

    return envelope;
  } catch (e) {
    const now = nowUtcIso();
    const errorMessage = e instanceof Error ? e.message : String(e);
    
    // Log resolver ERROR marker with correlationId for correlation cross-check
    console.log(JSON.stringify({
      marker: '[FT_RESOLVER_ERR]',
      resolver: 'ft_getDashboardState_v1',
      correlationId: request?.correlation_id || request?.correlationId || 'unknown',
      uiReqId: request?.ui_req_id || request?.uiReqId || 'unknown',
      error: errorMessage.slice(0, 100),
      ts: new Date().toISOString(),
    }));

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

/**
 * Compute risk tier from Phase 1 risk score (0-1)
 * HIGH: > 0.7
 * MEDIUM: 0.4-0.7
 * LOW: < 0.4
 */
function computeRiskTier(score: number): string {
  if (score > 0.7) return 'HIGH';
  if (score > 0.4) return 'MEDIUM';
  return 'LOW';
}

