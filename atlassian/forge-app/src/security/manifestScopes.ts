/* FT_PROOF:MANIFEST_SCOPES_V1 */

import * as fs from "fs";

export function extractForgeScopesFromManifestYml(manifestPath: string): string[] {
  const raw = fs.readFileSync(manifestPath, "utf8");
  const lines = raw.split(/\r?\n/);

  let scopesLineIdx = -1;
  let scopesIndent = -1;

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(\s*)scopes\s*:\s*$/);
    if (m) {
      scopesLineIdx = i;
      scopesIndent = m[1].length;
      break;
    }
  }

  if (scopesLineIdx < 0) {
    throw new Error(`Could not find "scopes:" block in manifest: ${manifestPath}`);
  }

  const scopes: string[] = [];
  for (let i = scopesLineIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    const indent = (line.match(/^(\s*)/)?.[1]?.length ?? 0);
    const trimmed = line.trim();

    if (trimmed === "" || trimmed.startsWith("#")) continue;
    if (indent <= scopesIndent) break;

    const item = line.match(/^\s*-\s*([A-Za-z0-9:._-]+)\s*$/);
    if (item) scopes.push(item[1]);
  }

  if (scopes.length === 0) {
    throw new Error(`Found "scopes:" but no scope items parsed in manifest: ${manifestPath}`);
  }

  return scopes;
}
