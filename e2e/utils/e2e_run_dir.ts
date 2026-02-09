import fs from "fs";
import path from "path";

export function utcStampForPath(d = new Date()) {
  // Example: 20260209T064500Z
  const iso = d.toISOString(); // 2026-02-09T06:45:00.000Z
  const y = iso.slice(0,4);
  const mo = iso.slice(5,7);
  const da = iso.slice(8,10);
  const hh = iso.slice(11,13);
  const mi = iso.slice(14,16);
  const ss = iso.slice(17,19);
  return `${y}${mo}${da}T${hh}${mi}${ss}Z`;
}

export function ensureRunDir(prefix: string) {
  const base = "/tmp";
  const stamp = utcStampForPath();
  const dir = path.join(base, `${prefix}_${stamp}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function ensureFileExists(p: string, stopFilePath: string) {
  if (!fs.existsSync(p)) {
    fs.writeFileSync(stopFilePath, `STOP_MISSING_REQUIRED_FILE ${p}\n`, "utf8");
    throw new Error(`STOP_MISSING_REQUIRED_FILE ${p}`);
  }
}
