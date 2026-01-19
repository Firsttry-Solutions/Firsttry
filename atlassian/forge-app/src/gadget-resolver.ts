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
import { FtTrace, FtErrorCode as TraceErrorCode } from './trace/trace_types';
import { makeTraceBase, traceOk, traceFail, attachStorageProof } from './trace/trace_helpers';

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

// CRITICAL: Export as 'handler' - this is what Forge expects from manifest
export const handler = resolver.getDefinitions();

// ============================================================================
// LAYER-0 BACKBONE RESOLVERS (NEW)
// ============================================================================

async function ft_getDashboardState_v1(event: any, context: any): Promise<{ trace: FtTrace; data: FtResolverResponseV1 }> {
  const now = nowUtcIso();
  const requestId = context?.requestId ?? null;
  const trace = makeTraceBase('ft_getDashboardState_v1', context, event);
  
  try {
    const { ledger, storage_state } = await loadOrInitLedger(null);
    
    // Determine status based on ledger state
    let status: "BOOTSTRAP" | "OK" | "DEGRADED" | "FAILED" = "BOOTSTRAP";
    let reason_code: FtReasonCode = FtReasonCode.NO_LEDGER;
    
    if (storage_state === "ERROR") {
      status = "FAILED";
      reason_code = FtReasonCode.NO_LEDGER;
    } else if (!ledger.storage_verified_at_utc) {
      status = "BOOTSTRAP";
      reason_code = FtReasonCode.STORAGE_UNVERIFIED;
    } else if (!ledger.scheduler_last_attempt_at_utc) {
      status = "BOOTSTRAP";
      reason_code = FtReasonCode.SCHEDULER_NEVER_RAN;
    } else if (ledger.scheduler_last_error && ledger.scheduler_consecutive_failures > 0) {
      status = "DEGRADED";
      reason_code = FtReasonCode.LAST_RUN_FAILED;
    } else if (ledger.snapshot_count === 0) {
      status = "DEGRADED";
      reason_code = FtReasonCode.NO_SNAPSHOT_YET;
    } else {
      status = "OK";
      reason_code = FtReasonCode.OK;
    }
    
    const response: FtResolverResponseV1 = {
      ok: true,
      resolver: "ft_getDashboardState_v1",
      step: "success",
      now_utc: now,
      request_id: requestId,
      build_sha_backend: null,
      storage_state,
      status,
      reason_code,
      ledger,
    };
    
    assertNoUnknownStrings(response);
    
    const proofTrace = await attachStorageProof(traceOk(trace, 'success'), {
      ledgerKey: 'ft.ledger.v1',
      lockKey: 'ft.ledger.lock',
      sentinelKey: 'ft.storage_ok_sentinel',
      snapshotCountKey: 'ft.snapshot_count',
    });
    
    return {
      trace: proofTrace,
      data: response,
    };
  } catch (e) {
    const now_error = nowUtcIso();
    const errorTrace = traceFail(
      trace,
      'storage_error',
      TraceErrorCode.STORAGE_READ_FAILED,
      e instanceof Error ? e.message : String(e)
    );
    
    const errorResponse: FtResolverResponseV1 = {
      ok: false,
      resolver: "ft_getDashboardState_v1",
      step: "storage_error",
      now_utc: now_error,
      request_id: requestId,
      build_sha_backend: null,
      storage_state: "ERROR",
      status: "FAILED",
      reason_code: FtReasonCode.NO_LEDGER,
      ledger: {
        version: 1,
        install_id: "ERROR",
        installed_at_utc: now_error,
        build_sha_last_seen_ui: null,
        build_sha_last_seen_backend: null,
        storage_verified_at_utc: null,
        scheduler_last_attempt_at_utc: null,
        scheduler_last_success_at_utc: null,
        scheduler_consecutive_failures: 0,
        scheduler_last_error: {
          code: FtErrorCode.STORAGE_READ_FAILED,
          step: "loadOrInitLedger",
          message_short: e instanceof Error ? e.message.slice(0, 180) : String(e).slice(0, 180),
          request_id: requestId,
          at_utc: now_error,
        },
        snapshot_count: 0,
        snapshot_last_id: null,
        snapshot_last_at_utc: null,
        snapshot_last_build_sha: null,
        snapshot_last_hash: null,
      },
    };
    
    return {
      trace: errorTrace,
      data: errorResponse,
    };
  }
}

async function ft_setUiBuildSha_v1(event: any, context: any): Promise<{ ok: boolean; error?: string }> {
  try {
    const { build_sha_ui } = event ?? {};
    if (!build_sha_ui) return { ok: false, error: "missing build_sha_ui" };
    
    await updateLedger((l) => ({ ...l, build_sha_last_seen_ui: build_sha_ui }));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: FtErrorCode.STORAGE_WRITE_FAILED };
  }
}
