import crypto from "node:crypto";
import { nowUtcIso } from "./time";

/**
 * Generate UUID-like identifier for NON-CANONICAL metadata (locks, audit events).
 * NOT for use in canonical hashes/ledgers - use deterministic hash(inputs) instead.
 */
export function uuidLike(): string {
  const anyCrypto: any = crypto as any;
  if (typeof anyCrypto.randomUUID === "function") return anyCrypto.randomUUID();
  return "uuid_" + nowUtcIso().replace(/[-:.TZ]/g, "") + "_" + Math.random().toString(16).slice(2); // Random for non-canonical metadata
}
