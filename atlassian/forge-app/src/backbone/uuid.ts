import crypto from "node:crypto";
import { nowUtcIso } from "./time";

export function uuidLike(): string {
  const anyCrypto: any = crypto as any;
  if (typeof anyCrypto.randomUUID === "function") return anyCrypto.randomUUID();
  return "uuid_" + nowUtcIso().replace(/[-:.TZ]/g, "") + "_" + Math.random().toString(16).slice(2);
}
