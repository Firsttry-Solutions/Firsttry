import { storage } from "@forge/api";
import { FtErrorCode, normalizeErrorCode } from "./errorCodes";
import { FtStorageState } from "./contract";

export async function storageGetJson<T>(key: string): Promise<{ state: FtStorageState; value: T | null }> {
  try {
    const v = await storage.get(key);
    if (v === undefined || v === null) return { state: "MISSING", value: null };
    return { state: "PRESENT", value: v as T };
  } catch (e) {
    const code = normalizeErrorCode(e);
    const err = new Error(`${code === FtErrorCode.STORAGE_RATE_LIMIT ? FtErrorCode.STORAGE_RATE_LIMIT : FtErrorCode.STORAGE_READ_FAILED}: ${e instanceof Error ? e.message : String(e)}`);
    (err as any).cause = e;
    throw err;
  }
}

export async function storageSetJson<T>(key: string, value: T): Promise<void> {
  try {
    await storage.set(key, value as any);
  } catch (e) {
    const code = normalizeErrorCode(e);
    const err = new Error(`${code === FtErrorCode.STORAGE_RATE_LIMIT ? FtErrorCode.STORAGE_RATE_LIMIT : FtErrorCode.STORAGE_WRITE_FAILED}: ${e instanceof Error ? e.message : String(e)}`);
    (err as any).cause = e;
    throw err;
  }
}
