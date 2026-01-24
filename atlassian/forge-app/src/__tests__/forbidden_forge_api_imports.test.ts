/**
 * REGRESSION TEST: Forbid named import { api } from '@forge/api'
 * 
 * ROOT CAUSE: Production error "Cannot read properties of undefined (reading 'asApp')"
 * 
 * @forge/api exports api as DEFAULT export only.
 * Named import { api } yields api=undefined, causing:
 *   api.asApp().requestStorage(...) -> TypeError: Cannot read properties of undefined
 * 
 * This test enforces that all resolver files use the correct default import:
 *   import api from '@forge/api';   ✓ CORRECT
 *   import { api } from '@forge/api';  ✗ FORBIDDEN (this test catches it)
 */

import fs from "node:fs";
import path from "node:path";

function walk(dir: string, out: string[] = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (ent.isFile() && (p.endsWith(".ts") || p.endsWith(".tsx"))) out.push(p);
  }
  return out;
}

test("FORBID named import { api } from '@forge/api' (causes api.asApp undefined)", () => {
  const root = path.join(process.cwd(), "src");
  const files = walk(root);
  const bad: string[] = [];
  for (const f of files) {
    const txt = fs.readFileSync(f, "utf8");
    // Forbidden ES6 named import pattern
    if (txt.match(/import\s*\{\s*api\s*\}\s*from\s*['"]@forge\/api['"]/)) {
      bad.push(`${f}: forbidden named import { api }`);
    }
    // Forbidden require(.api) pattern  
    if (txt.match(/require\(['"]@forge\/api['"]\)\s*\.\s*api/)) {
      bad.push(`${f}: forbidden require(...).api pattern`);
    }
    // Forbidden const { api } = require(...) pattern
    if (txt.match(/const\s*\{\s*api\s*\}\s*=\s*require\(['"]@forge\/api['"]\)/)) {
      bad.push(`${f}: forbidden const { api } = require(...) pattern`);
    }
  }
  expect(bad).toEqual([]);
});
