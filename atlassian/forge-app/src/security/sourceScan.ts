/* FT_PROOF:SOURCE_SCAN_V1 */

import fs from "fs";
import path from "path";

export type ScanMatch = { file: string; line: number; text: string };

function walk(dir: string, out: string[]) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === "dist" || e.name === ".git") continue;
      walk(p, out);
    } else if (e.isFile()) {
      if (p.endsWith(".ts") || p.endsWith(".tsx") || p.endsWith(".js")) out.push(p);
    }
  }
}

function scanFile(filePath: string, re: RegExp): ScanMatch[] {
  const raw = fs.readFileSync(filePath, "utf8");
  const lines = raw.split(/\r?\n/);
  const hits: ScanMatch[] = [];
  for (let i = 0; i < lines.length; i++) {
    // Reset lastIndex for global regex safety
    re.lastIndex = 0;
    if (re.test(lines[i])) {
      hits.push({ file: filePath, line: i + 1, text: lines[i].slice(0, 240) });
    }
  }
  return hits;
}

export function scanTree(rootDir: string, patterns: { id: string; re: RegExp }[]) {
  const files: string[] = [];
  walk(rootDir, files);

  const results = patterns.map(p => ({ id: p.id, status: "PASS" as "PASS" | "FAIL", matches: [] as ScanMatch[] }));

  for (const f of files) {
    for (let i = 0; i < patterns.length; i++) {
      const hits = scanFile(f, patterns[i].re);
      if (hits.length) {
        results[i].status = "FAIL";
        results[i].matches.push(...hits);
      }
    }
  }
  return results;
}

export function outboundPatterns() {
  return [
    { id: "SCAN_NO_FETCH", re: /\bfetch\s*\(/ },
    { id: "SCAN_NO_AXIOS", re: /\baxios\b/ },
    { id: "SCAN_NO_HTTP_HTTPS", re: /\bhttp\.request\b|\bhttps\.request\b/ },
    { id: "SCAN_NO_WS", re: /\bWebSocket\b/ },
    { id: "SCAN_NO_INVOKE_REMOTE", re: /\binvokeRemote\b/ }
  ];
}

// Conservative pattern: forbid requestJira usage mentioning HTTP write methods nearby.
export function mutationPatterns() {
  return [
    { id: "SCAN_NO_JIRA_WRITE_APIS", re: /\brequestJira\b[\s\S]{0,200}\b(method\s*:\s*['"]?(POST|PUT|DELETE|PATCH)|\bPOST\b|\bPUT\b|\bDELETE\b|\bPATCH\b)/i },
    { id: "SCAN_NO_MUTATION_ROUTES", re: /\/rest\/api\/[\S]*\s*(POST|PUT|DELETE|PATCH)/i }
  ];
}
