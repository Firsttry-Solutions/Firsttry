import { FT_LOCK_KEY } from "./keys";
import { nowUtcIso } from "./time";
import { storageGetJson, storageSetJson } from "./storage";

interface LockValue {
  holder: string;
  lease_expires_at_utc: string;
}

function isExpired(leaseExpiresUtc: string, nowUtc: string): boolean {
  return Date.parse(leaseExpiresUtc) <= Date.parse(nowUtc);
}

function plusSecondsIso(nowUtc: string, seconds: number): string {
  const d = new Date(nowUtc);
  d.setSeconds(d.getSeconds() + seconds);
  return d.toISOString();
}

export async function withSchedulerLock<T>(invocationId: string, fn: () => Promise<T>): Promise<{ acquired: boolean; result?: T }> {
  const now = nowUtcIso();
  const got = await storageGetJson<LockValue>(FT_LOCK_KEY);
  const canTake = got.state === "MISSING" || !got.value || isExpired(got.value.lease_expires_at_utc, now);

  if (!canTake) return { acquired: false };

  const candidate: LockValue = { holder: invocationId, lease_expires_at_utc: plusSecondsIso(now, 120) };
  await storageSetJson(FT_LOCK_KEY, candidate);

  const proof = await storageGetJson<LockValue>(FT_LOCK_KEY);
  if (proof.value?.holder !== invocationId) return { acquired: false };

  try {
    const result = await fn();
    return { acquired: true, result };
  } finally {
    await storageSetJson(FT_LOCK_KEY, { holder: invocationId, lease_expires_at_utc: nowUtcIso() });
  }
}
