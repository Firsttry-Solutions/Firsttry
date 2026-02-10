import { FT_SENTINEL_KEY } from "./keys";
import { nowUtcIso } from "./time";
import { storageGetJson, storageSetJson } from "./storage";
import { updateLedger } from "./ledger";

export async function verifyStorageSentinel(): Promise<{ ok: boolean; verified_at_utc: string | null }> {
  const at = nowUtcIso();
  const nonce = "sent_" + at + "_" + Math.random().toString(16).slice(2);
  await storageSetJson(FT_SENTINEL_KEY, { nonce, written_at_utc: at });
  const read = await storageGetJson<{ nonce: string; written_at_utc: string }>(FT_SENTINEL_KEY);
  const ok = read.value?.nonce === nonce;
  if (ok) {
    await updateLedger((l) => ({ ...l, storage_verified_at_utc: at }));
    return { ok: true, verified_at_utc: at };
  }
  return { ok: false, verified_at_utc: null };
}
