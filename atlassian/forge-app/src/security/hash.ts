/* FT_PROOF:SHA256_V1 */

import * as crypto from "crypto";
import { canonicalJsonStringify } from "./canonicalJson";

export function sha256HexBytes(buf: Buffer): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

export function sha256HexCanonicalJson(obj: any): string {
  const canonical = canonicalJsonStringify(obj);
  return sha256HexBytes(Buffer.from(canonical, "utf8"));
}
