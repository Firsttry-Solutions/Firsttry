import { FtErrorCode } from "./errorCodes";
import { loadOrInitLedger, updateLedger } from "./ledger";
import { verifyStorageSentinel } from "./sentinel";
import { withSchedulerLock } from "./lock";
import { nowUtcIso } from "./time";
import { sha256Hex } from "./crypto";
import { storageSetJson } from "./storage";
import { FT_SNAPSHOT_LAST_KEY } from "./keys";
import { failClosed } from '../shared/failClosed';

function shortMsg(e: unknown): string {
  const s = e instanceof Error ? e.message : String(e ?? "");
  return s.length > 180 ? s.slice(0, 180) : s;
}

export async function runScheduledCycle(params: { invocationId: string; requestId: string | null; buildShaBackend: string | null }): Promise<void> {
  try {
    const { invocationId, requestId, buildShaBackend } = params;
    const now = nowUtcIso();

    try {
      await loadOrInitLedger(buildShaBackend);
    } catch (e) {
      throw failClosed('FT_SCHEDULER_LEDGER_INIT_FAILED', 'Scheduler cannot initialize ledger', e);
    }

    try {
      await verifyStorageSentinel();
    } catch (e) {
      throw failClosed('FT_SCHEDULER_SENTINEL_FAILED', 'Scheduler cannot verify storage sentinel', e);
    }

    try {
      await updateLedger((l) => ({ ...l, scheduler_last_attempt_at_utc: now }));
    } catch (e) {
      throw failClosed('FT_SCHEDULER_LEDGER_UPDATE_FAILED', 'Scheduler cannot persist attempt to ledger', e);
    }

    const locked = await withSchedulerLock(invocationId, async () => {
      const at = nowUtcIso();
      const ledgerNow = await loadOrInitLedger(buildShaBackend);
      const payload = { at_utc: at, build_sha_backend: buildShaBackend, install_id: ledgerNow.ledger.install_id };
      const snapshot_id = "snap_" + at;
      const snapshot_hash = sha256Hex(JSON.stringify(payload));

      try {
        await storageSetJson(FT_SNAPSHOT_LAST_KEY, { snapshot_id, at_utc: at, build_sha_backend: buildShaBackend, snapshot_hash, payload });
      } catch (e) {
        throw failClosed('FT_SCHEDULER_SNAPSHOT_WRITE_FAILED', 'Scheduler cannot write snapshot to storage', e);
      }

      try {
        await updateLedger((l) => ({
          ...l,
          snapshot_count: l.snapshot_count + 1,
          snapshot_last_id: snapshot_id,
          snapshot_last_at_utc: at,
          snapshot_last_build_sha: buildShaBackend ?? null,
          snapshot_last_hash: snapshot_hash,
        }));
      } catch (e) {
        throw failClosed('FT_SCHEDULER_LEDGER_UPDATE_FAILED', 'Scheduler cannot persist snapshot success to ledger', e);
      }
    });

    if (!locked.acquired) {
      try {
        await updateLedger((l) => ({
          ...l,
          scheduler_last_error: {
            code: FtErrorCode.LOCK_BUSY,
            step: "lock",
            message_short: "Lock not acquired (another invocation running)",
            request_id: requestId,
            at_utc: now,
          },
        }));
      } catch (e) {
        throw failClosed('FT_SCHEDULER_LEDGER_UPDATE_FAILED', 'Scheduler cannot persist lock busy state to ledger', e);
      }
      return;
    }

    try {
      await updateLedger((l) => ({
        ...l,
        scheduler_last_success_at_utc: nowUtcIso(),
        scheduler_consecutive_failures: 0,
        scheduler_last_error: null,
      }));
    } catch (e) {
      throw failClosed('FT_SCHEDULER_LEDGER_UPDATE_FAILED', 'Scheduler cannot persist final success to ledger', e);
    }
  } catch (fatal) {
    throw failClosed('FT_SCHEDULER_FATAL_ERROR', 'Scheduler encountered fatal uncaught error', fatal);
  }
}
