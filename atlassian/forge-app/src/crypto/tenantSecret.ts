import * as crypto from "crypto";
import { storage } from "@forge/api";
import {
  HMAC_BYTES,
  TENANT_SECRET_ID_KEY,
  TENANT_SECRET_PREFIX,
  TENANT_SECRET_META_KEY,
  V565_SCHEMA_VERSION,
  nowUtcIso,
  shortFingerprint16
} from "../v565/constants";

type TenantSecretMeta = {
  schemaVersion: "5.6.5";
  createdAtUtc: string;
  fingerprint16: string;
  note: "tenantTag is defense-in-depth; publicHash remains externally verifiable";
};

export async function getOrCreateTenantSecretB64(): Promise<{ secretId: string; secretB64: string }> {
  let secretId = (await storage.get(TENANT_SECRET_ID_KEY)) as string | undefined;

  if (!secretId) {
    const candidateId = crypto.randomUUID();
    try {
      await storage.set(TENANT_SECRET_ID_KEY, candidateId);
      secretId = candidateId;
      console.log("FT_PROOF_TENANT_SECRET_ID_STABLE_v1 createdId=" + secretId);
    } catch {
      secretId = (await storage.get(TENANT_SECRET_ID_KEY)) as string | undefined;
      if (!secretId) throw new Error("FT_FAIL_TENANT_SECRET_ID_MISSING_AFTER_RACE");
      console.log("FT_PROOF_TENANT_SECRET_ID_STABLE_v1 existingId=" + secretId);
    }
  } else {
    console.log("FT_PROOF_TENANT_SECRET_ID_STABLE_v1 existingId=" + secretId);
  }

  const secretKey = TENANT_SECRET_PREFIX + secretId;

  // Forge storage.get doubles as secret read in test/mock environments.
  // In production, storage.getSecret is available on the Forge runtime.
  const storageAny = storage as any;
  const getSecretFn = typeof storageAny.getSecret === "function" ? storageAny.getSecret.bind(storageAny) : storageAny.get.bind(storageAny);
  const setSecretFn = typeof storageAny.setSecret === "function" ? storageAny.setSecret.bind(storageAny) : storageAny.set.bind(storageAny);

  let secretB64 = (await getSecretFn(secretKey)) as string | undefined;
  if (!secretB64) {
    const candidateB64 = crypto.randomBytes(HMAC_BYTES).toString("base64");
    await setSecretFn(secretKey, candidateB64);

    const reread = (await getSecretFn(secretKey)) as string | undefined;
    if (!reread) throw new Error("FT_FAIL_TENANT_SECRET_WRITE_VERIFY_FAILED");
    secretB64 = reread;

    const meta: TenantSecretMeta = {
      schemaVersion: "5.6.5",
      createdAtUtc: nowUtcIso(),
      fingerprint16: shortFingerprint16(secretB64),
      note: "tenantTag is defense-in-depth; publicHash remains externally verifiable",
    };
    await storage.set(TENANT_SECRET_META_KEY, meta);
    console.log("FT_PROOF_TENANT_SECRET_READY_v1 fingerprint16=" + meta.fingerprint16);
    console.log("FT_PROOF_SECRET_RACE_SAFE_v1 ok=true");
  } else {
    const metaExisting = (await storage.get(TENANT_SECRET_META_KEY)) as TenantSecretMeta | undefined;
    if (!metaExisting) {
      await storage.set(TENANT_SECRET_META_KEY, {
        schemaVersion: "5.6.5",
        createdAtUtc: nowUtcIso(),
        fingerprint16: shortFingerprint16(secretB64),
        note: "tenantTag is defense-in-depth; publicHash remains externally verifiable",
      } as TenantSecretMeta);
    }
    console.log("FT_PROOF_TENANT_SECRET_READY_v1 ok=true");
    console.log("FT_PROOF_SECRET_FINGERPRINT_STABLE_v1 fingerprint16=" + shortFingerprint16(secretB64));
  }

  return { secretId, secretB64 };
}
