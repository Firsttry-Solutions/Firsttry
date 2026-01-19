import { FT_LEDGER_KEY } from "./keys";
import { FtLedgerV1, FtStorageState } from "./contract";
import { nowUtcIso } from "./time";
import { uuidLike } from "./uuid";
import { storageGetJson, storageSetJson } from "./storage";

export async function loadOrInitLedger(buildShaBackend: string | null): Promise<{ ledger: FtLedgerV1; storage_state: FtStorageState }> {
  const got = await storageGetJson<FtLedgerV1>(FT_LEDGER_KEY);
  let ledger: FtLedgerV1;
  if (got.state === "MISSING" || !got.value) {
    ledger = {
      version: 1,
      install_id: uuidLike(),
      installed_at_utc: nowUtcIso(),
      build_sha_last_seen_ui: null,
      build_sha_last_seen_backend: buildShaBackend ?? null,
      storage_verified_at_utc: null,
      scheduler_last_attempt_at_utc: null,
      scheduler_last_success_at_utc: null,
      scheduler_consecutive_failures: 0,
      scheduler_last_error: null,
      snapshot_count: 0,
      snapshot_last_id: null,
      snapshot_last_at_utc: null,
      snapshot_last_build_sha: null,
      snapshot_last_hash: null,
    };
    await storageSetJson(FT_LEDGER_KEY, ledger);
    return { ledger, storage_state: "MISSING" };
  }
  ledger = got.value;
  if (buildShaBackend) {
    ledger = { ...ledger, build_sha_last_seen_backend: buildShaBackend };
    await storageSetJson(FT_LEDGER_KEY, ledger);
  }
  return { ledger, storage_state: got.state };
}

export async function updateLedger(mutator: (l: FtLedgerV1) => FtLedgerV1): Promise<FtLedgerV1> {
  const got = await storageGetJson<FtLedgerV1>(FT_LEDGER_KEY);
  const base = got.value;
  if (!base) throw new Error("FtLedger missing during updateLedger (should not happen)");
  const next = mutator(base);
  await storageSetJson(FT_LEDGER_KEY, next);
  return next;
}
