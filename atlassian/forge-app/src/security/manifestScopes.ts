/**
 * Manifest Scopes Extractor (dependency-free)
 * Deterministic YAML scope extraction from manifest text
 */

export function extractScopesFromManifestText(manifestText: string): string[] {
  const lines = manifestText.split('\n');
  const scopes: string[] = [];
  
  let inScopesBlock = false;
  let firstListItemIndent = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Look for the scopes: line
    if (/^\s*scopes:\s*$/.test(line)) {
      inScopesBlock = true;
      firstListItemIndent = -1;
      continue;
    }

    if (!inScopesBlock) {
      continue;
    }

    // If blank line, skip
    if (/^\s*$/.test(line)) {
      continue;
    }

    // Check if this is a list item
    const listMatch = line.match(/^(\s*)-\s+(.+?)\s*$/);
    if (listMatch) {
      const indent = listMatch[1].length;
      const scope = listMatch[2];

      if (firstListItemIndent === -1) {
        firstListItemIndent = indent;
      }

      if (indent === firstListItemIndent) {
        scopes.push(scope);
        continue;
      } else if (indent > firstListItemIndent) {
        // Nested item, skip
        continue;
      } else {
        // Less indented, end of block
        break;
      }
    }

    // Check for a key at same or higher level (end of block)
    if (/^[a-zA-Z]/.test(line)) {
      // Key found at root level, end block
      break;
    }
  }

  if (scopes.length === 0 && inScopesBlock) {
    throw new Error("SCOPES_EMPTY");
  }

  if (!inScopesBlock) {
    throw new Error("SCOPES_BLOCK_NOT_FOUND");
  }

  // Return sorted unique scopes
  return [...new Set(scopes)].sort();
}
