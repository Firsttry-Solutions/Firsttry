import { FtErrorCode } from "./errorCodes";
import { loadOrInitLedger, updateLedger } from "./ledger";
import { verifyStorageSentinel } from "./sentinel";
import { withSchedulerLock } from "./lock";
import { nowUtcIso } from "./time";
import { sha256Hex } from "./crypto";
import { storageSetJson } from "./storage";
import { FT_SNAPSHOT_LAST_KEY } from "./keys";

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
      console.error("runScheduledCycle: loadOrInitLedger failed:", e);
      return;
    }

    try {
      await verifyStorageSentinel();
    } catch (e) {
      try {
        await updateLedger((l) => ({
          ...l,
          scheduler_last_attempt_at_utc: now,
          scheduler_consecutive_failures: l.scheduler_consecutive_failures + 1,
          scheduler_last_error: {
            code: FtErrorCode.STORAGE_WRITE_FAILED,
            step: "sentinel",
            message_short: shortMsg(e),
            request_id: requestId,
            at_utc: now,
          },
        }));
      } catch (e2) {
        console.error("runScheduledCycle: failed to persist sentinel error:", e2);
      }
      return;
    }

    try {
      await updateLedger((l) => ({ ...l, scheduler_last_attempt_at_utc: now }));
    } catch (e) {
      console.error("runScheduledCycle: failed to persist attempt:", e);
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
        try {
          await updateLedger((l) => ({
            ...l,
            scheduler_consecutive_failures: l.scheduler_consecutive_failures + 1,
            scheduler_last_error: {
              code: FtErrorCode.SNAPSHOT_WRITE_FAILED,
              step: "snapshot_write",
              message_short: shortMsg(e),
              request_id: requestId,
              at_utc: at,
            },
          }));
        } catch (e2) {
          console.error("runScheduledCycle: failed to persist snapshot error:", e2);
        }
        return;
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
        console.error("runScheduledCycle: failed to persist snapshot success:", e);
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
        console.error("runScheduledCycle: failed to persist lock busy:", e);
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
      console.error("runScheduledCycle: failed to persist final success:", e);
    }
  } catch (fatal) {
    console.error("runScheduledCycle: fatal uncaught swallowed:", fatal);
    return;
  }
}
