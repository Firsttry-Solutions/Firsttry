#!/usr/bin/env node
// inject_doc_ids.mjs — One-shot: inject Doc ID into every markdown doc in portal_nav
// Safe to re-run: skips docs that already have **Doc ID**.
// Runs from repo root.
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const SCRIPT_DIR = new URL('.', import.meta.url).pathname;
const MANIFEST_PATH = path.join(SCRIPT_DIR, 'pages_pack_manifest.json');
const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '../../..');

// Build a deduplicated map: src -> doc_id (first occurrence wins)
const docIdMap = new Map();
for (const group of (manifest.portal_nav || [])) {
  for (const item of group.items) {
    if (!docIdMap.has(item.src)) docIdMap.set(item.src, item.doc_id);
  }
}

let injected = 0;
let skipped = 0;

for (const [src, doc_id] of docIdMap) {
  const mdPath = path.join(REPO_ROOT, src);
  if (!fs.existsSync(mdPath)) {
    console.warn(`  WARN: not found: ${src}`);
    continue;
  }
  let content = fs.readFileSync(mdPath, 'utf8');

  // Skip if already has Doc ID line
  if (/^\*\*Doc ID\*\*/m.test(content)) {
    console.log(`  SKIP (already has Doc ID): ${src}`);
    skipped++;
    continue;
  }

  // Insert Doc ID line after "**Review Cycle**:..." line (end of metadata block)
  // Pattern: a line starting with **Review Cycle** followed by any content
  if (/^\*\*Review Cycle\*\*/m.test(content)) {
    content = content.replace(
      /^(\*\*Review Cycle\*\*[^\n]*)\n/m,
      `$1\n**Doc ID**: ${doc_id}  \n`
    );
  } else if (/^\*\*Last Updated\*\*/m.test(content)) {
    // Fallback: insert after Last Updated
    content = content.replace(
      /^(\*\*Last Updated\*\*[^\n]*)\n/m,
      `$1\n**Doc ID**: ${doc_id}  \n`
    );
  } else {
    // Fallback: insert after first H1 line
    content = content.replace(
      /^(# .+)\n/m,
      `$1\n\n**Doc ID**: ${doc_id}  \n`
    );
  }

  fs.writeFileSync(mdPath, content, 'utf8');
  console.log(`  INJECTED ${doc_id} → ${src}`);
  injected++;
}

console.log(`\ninject_doc_ids.mjs done: ${injected} injected, ${skipped} already had Doc ID`);
