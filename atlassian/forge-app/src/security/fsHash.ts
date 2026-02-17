/* FT_PROOF:FS_HASH_V1 */

import * as fs from "fs";
import * as path from "path";
import { sha256HexBytes } from "./hash";

export function readFileBytes(p: string): Buffer {
  return fs.readFileSync(p);
}

export function sha256HexFileBytes(p: string): string {
  const buf = readFileBytes(p);
  return sha256HexBytes(buf);
}

export function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

export function writeUtf8(p: string, s: string) {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, s, { encoding: "utf8" });
}

export function writeBytes(p: string, b: Buffer) {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, b);
}
