import * as crypto from "crypto";

export function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

export function hmacSha256Hex(secretB64: string, msg: string): string {
  const key = Buffer.from(secretB64, "base64");
  return crypto.createHmac("sha256", key).update(msg, "utf8").digest("hex");
}
