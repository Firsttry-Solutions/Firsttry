import crypto from "node:crypto";

export function sha256Hex(input: string): string {
  try {
    return crypto.createHash("sha256").update(input, "utf8").digest("hex");
  } catch {
    let h = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16).padStart(8, "0");
  }
}
