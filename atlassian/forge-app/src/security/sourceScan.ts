/* FT_PROOF:SOURCE_SCAN_V1 */

import * as fs from "fs";
import * as path from "path";
import { ALLOWLIST, AllowlistedMatch } from "./scanAllowlist";

export type ScanMatch = {
  ruleId: string;
  fileAbs: string;
  fileRel: string;
  line: number;
  text: string;
};

function toRel(appRoot: string, absPath: string): string {
  const rel = path.relative(appRoot, absPath).replace(/\\/g, "/");
  return rel;
}

function isAllowlisted(m: ScanMatch, family: "outbound" | "mutation"): { ok: boolean; entry?: AllowlistedMatch } {
  for (const a of ALLOWLIST) {
    if (a.family !== family) continue;
    if (a.ruleId !== m.ruleId) continue;
    if (a.fileRel !== m.fileRel) continue;
    if (a.line !== m.line) continue;
    if (!m.text.includes(a.lineMustInclude)) continue;
    return { ok: true, entry: a };
  }
  return { ok: false };
}

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

function scanFile(filePath: string, ruleId: string, appRoot: string, re: RegExp): ScanMatch[] {
  const raw = fs.readFileSync(filePath, "utf8");
  const lines = raw.split(/\r?\n/);
  const hits: ScanMatch[] = [];
  for (let i = 0; i < lines.length; i++) {
    re.lastIndex = 0;
    if (re.test(lines[i])) {
      hits.push({
        ruleId,
        fileAbs: filePath,
        fileRel: toRel(appRoot, filePath),
        line: i + 1,
        text: lines[i].slice(0, 240)
      });
    }
  }
  return hits;
}

export function scanTree(appRoot: string, rootDir: string, family: "outbound" | "mutation", patterns: { id: string; re: RegExp }[]) {
  const files: string[] = [];
  walk(rootDir, files);

  const results = patterns.map(p => ({
    id: p.id,
    status: "PASS" as "PASS" | "FAIL",
    matches: [] as ScanMatch[],
    summary: {
      totalMatches: 0,
      allowlistedMatches: 0,
      nonAllowlistedMatches: 0
    }
  }));

  for (const f of files) {
    for (let pi = 0; pi < patterns.length; pi++) {
      const rule = patterns[pi];
      const hits = scanFile(f, rule.id, appRoot, rule.re);

      for (const hit of hits) {
        results[pi].summary.totalMatches += 1;

        const allow = isAllowlisted(hit, family);
        if (allow.ok) {
          results[pi].summary.allowlistedMatches += 1;
          continue;
        }

        results[pi].summary.nonAllowlistedMatches += 1;
        results[pi].status = "FAIL";
        results[pi].matches.push(hit);
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

export function mutationPatterns() {
  return [
    { id: "SCAN_NO_JIRA_WRITE_APIS", re: /\brequestJira\b[\s\S]{0,200}\b(method\s*:\s*['"]?(POST|PUT|DELETE|PATCH)|\bPOST\b|\bPUT\b|\bDELETE\b|\bPATCH\b)/i },
    { id: "SCAN_NO_MUTATION_ROUTES", re: /\/rest\/api\/[\S]*\s*(POST|PUT|DELETE|PATCH)/i }
  ];
}
