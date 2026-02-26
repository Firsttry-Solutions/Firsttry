#!/usr/bin/env node
// audit_trust_portal_source_full.mjs — Full F100 Trust Portal Source Content Audit
//
// Reads each markdown source doc registered in portal_nav and validates:
//   • All required metadata keys present (Doc ID, Version, Owner, Last Updated, Review Cycle)
//   • doc_id value matches the manifest doc_id for that item
//   • No forbidden placeholder literals (outside code fences)
//   • No repo-internal pseudo-links: markdown links with href containing "docs/<section>/"
//     that are NOT full https://github.com/ permalinks
//   • Exactly one H1 heading (outside code fences)
//   • Last Updated matches YYYY-MM-DD format
//   • Doc ID matches pattern ^FT-[A-Z]+-[0-9]{3}$
//
// Output directory: $AUDIT_DIR (env) or /tmp/ft_portal_audit_source_full_<ts>/
//   <dir>/source_audit.json   — machine-readable
//   <dir>/source_audit.md     — human-readable
//
// Exit 0 = all pass, Exit 1 = any failure
//
// Usage (from repo root):
//   node atlassian/forge-app/tools/audit_trust_portal_source_full.mjs

import fs   from 'fs';
import path from 'path';

// ── Paths ─────────────────────────────────────────────────────────────────────
const SCRIPT_DIR    = new URL('.', import.meta.url).pathname;
const REPO_ROOT     = path.resolve(SCRIPT_DIR, '../../..');
const MANIFEST_PATH = path.join(SCRIPT_DIR, 'pages_pack_manifest.json');

if (!fs.existsSync(MANIFEST_PATH)) {
  console.error(`FAIL: manifest not found: ${MANIFEST_PATH}`);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
const {
  portal_nav:          NAV,
  metadata_contract:   CONTRACT,
  portal_pack_version: PACK_VERSION,
} = manifest;

if (!Array.isArray(NAV) || !NAV.length) {
  console.error('FAIL: manifest missing portal_nav');
  process.exit(1);
}

// ── Output dir ────────────────────────────────────────────────────────────────
const REPORT_DIR = process.env.AUDIT_DIR ||
  `/tmp/ft_portal_audit_source_full_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`;
fs.mkdirSync(REPORT_DIR, { recursive: true });

// ── Contract ──────────────────────────────────────────────────────────────────
const REQUIRED_KEYS    = (CONTRACT?.required_keys) || ['Doc ID', 'Version', 'Owner', 'Last Updated', 'Review Cycle'];
const DOC_ID_PATTERN   = new RegExp((CONTRACT?.doc_id_pattern) || '^FT-[A-Z]+-[0-9]{3}$');
const LAST_UPDATED_PAT = new RegExp((CONTRACT?.last_updated_pattern) || '^[0-9]{4}-[0-9]{2}-[0-9]{2}$');

// ── Forbidden placeholders ────────────────────────────────────────────────────
const FORBIDDEN_PLACEHOLDERS = [
  'example.com',
  'example.org',
  '@firsttry.app',
  '[Your Jurisdiction]',
  '[INSERT',
  'PLACEHOLDER',
];
// TBD and TODO — only flag in prose (not code blocks), and only if standalone word
const FORBIDDEN_WORDS = ['TODO', 'TBD'];

// Pseudo-link sections: href containing these that are not full github.com URLs
const PSEUDO_LINK_RE = /\[([^\]]*)\]\((docs\/(?:trust|operations|procurement|evidence)\/[^)]+)\)/g;

// ── Collect unique docs ───────────────────────────────────────────────────────
const seen = new Set();
const DOCS = [];
for (const group of NAV) {
  for (const item of (group.items || [])) {
    const srcKey = item.src || item.source_md;
    if (!srcKey || seen.has(srcKey)) continue;
    seen.add(srcKey);
    DOCS.push({ ...item, _src: srcKey });
  }
}

console.log(`audit_trust_portal_source_full.mjs`);
console.log(`  Portal Pack Version : ${PACK_VERSION || '?'}`);
console.log(`  Docs to audit       : ${DOCS.length}`);
console.log(`  Required keys       : ${REQUIRED_KEYS.join(', ')}`);
console.log(`  Report dir          : ${REPORT_DIR}\n`);

// ── Audit helpers ─────────────────────────────────────────────────────────────

/** Parse `**Key**: value` lines from outside code fences */
function extractMeta(lines) {
  const meta = {};
  let inFence = false;
  for (const l of lines) {
    if (/^```/.test(l)) { inFence = !inFence; continue; }
    if (inFence) continue;
    const m = l.match(/^\*\*([^*]+)\*\*\s*[:：]\s*(.+)/);
    if (m) meta[m[1].trim()] = m[2].replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
  }
  return meta;
}

/** Count H1s outside code fences */
function countH1(lines) {
  let count = 0;
  let inFence = false;
  const h1List = [];
  for (const l of lines) {
    if (/^```/.test(l)) { inFence = !inFence; continue; }
    if (!inFence && /^# /.test(l)) { count++; h1List.push(l.slice(2).trim()); }
  }
  return { count, h1List };
}

/** Check for forbidden placeholders in prose lines (outside code fences, outside backtick spans) */
function findForbiddenPlaceholders(lines) {
  const found = [];
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^```/.test(l)) { inFence = !inFence; continue; }
    if (inFence) continue;
    // Strip inline backtick content for placeholder check
    const stripped = l.replace(/`[^`]*`/g, '');
    for (const ph of FORBIDDEN_PLACEHOLDERS) {
      if (stripped.toLowerCase().includes(ph.toLowerCase())) {
        found.push({ line: i + 1, placeholder: ph, text: l.trim().slice(0, 80) });
      }
    }
    for (const word of FORBIDDEN_WORDS) {
      // Match as standalone word (not inside a URL or compound identifier)
      const re = new RegExp(`(?<![A-Za-z0-9_])${word}(?![A-Za-z0-9_])`, 'g');
      if (re.test(stripped)) {
        found.push({ line: i + 1, placeholder: word, text: l.trim().slice(0, 80) });
      }
    }
  }
  return found;
}

/** Find pseudo-links: markdown links with href like docs/<section>/... not full GitHub URLs.
 *  Checks only actual markdown link hrefs — plain text mentions in prose or code blocks are fine.
 */
function findPseudoLinks(lines) {
  const found = [];
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^```/.test(l)) { inFence = !inFence; continue; }
    if (inFence) continue;
    // Only match actual markdown link hrefs: [text](docs/<section>/...)
    // NOT backtick spans, NOT plain text
    const stripped = l.replace(/`[^`]*`/g, ''); // remove inline code spans first
    let m;
    PSEUDO_LINK_RE.lastIndex = 0;
    while ((m = PSEUDO_LINK_RE.exec(stripped)) !== null) {
      // Allow if href is a full GitHub URL (shouldn't match regex, but belt+suspenders)
      if (/^https?:\/\/github\.com\//.test(m[2])) continue;
      found.push({ line: i + 1, text: m[1], href: m[2] });
    }
  }
  return found;
}

// ── Audit one doc ─────────────────────────────────────────────────────────────
function auditDoc(item) {
  const srcPath = path.join(REPO_ROOT, item._src);
  const issues  = [];
  const notes   = [];

  if (!fs.existsSync(srcPath)) {
    return { item, issues: [`MISSING FILE: ${item._src}`], notes: [] };
  }

  const raw   = fs.readFileSync(srcPath, 'utf8');
  const lines = raw.split('\n');
  const meta  = extractMeta(lines);

  // 1. Required keys
  for (const key of REQUIRED_KEYS) {
    if (!meta[key]) issues.push(`Missing metadata key: "${key}"`);
  }

  // 2. Doc ID value matches manifest
  if (meta['Doc ID']) {
    const fileDocId = meta['Doc ID'].trim();
    if (!DOC_ID_PATTERN.test(fileDocId)) {
      issues.push(`Doc ID format invalid: "${fileDocId}" (expected ${DOC_ID_PATTERN})`);
    } else if (fileDocId !== item.doc_id) {
      issues.push(`Doc ID mismatch: file has "${fileDocId}", manifest expects "${item.doc_id}"`);
    } else {
      notes.push(`Doc ID ${fileDocId} ✓`);
    }
  }

  // 3. Last Updated format
  if (meta['Last Updated']) {
    const date = meta['Last Updated'].split(/\s/)[0];
    if (!LAST_UPDATED_PAT.test(date)) {
      issues.push(`Last Updated format invalid: "${meta['Last Updated']}" (expected YYYY-MM-DD)`);
    } else {
      notes.push(`Last Updated: ${date} ✓`);
    }
  }

  // 4. Forbidden placeholders in prose
  const phFound = findForbiddenPlaceholders(lines);
  for (const { line, placeholder, text } of phFound) {
    issues.push(`Forbidden placeholder "${placeholder}" at line ${line}: ${text}`);
  }

  // 5. Pseudo-links with docs/<section>/ hrefs
  const pseudoLinks = findPseudoLinks(lines);
  for (const { line, text, href } of pseudoLinks) {
    issues.push(`Pseudo-link at line ${line}: [${text}](${href}) — rewrite to portal HTML route`);
  }

  // 6. H1 count (outside fences)
  const { count: h1Count, h1List } = countH1(lines);
  if (h1Count === 0) {
    issues.push('No H1 heading found');
  } else if (h1Count > 1) {
    issues.push(`Multiple H1 headings (${h1Count}): ${h1List.join(' | ')}`);
  } else {
    notes.push(`H1: "${h1List[0]}" ✓`);
  }

  return { item, issues, notes };
}

// ── Run ───────────────────────────────────────────────────────────────────────
const results = DOCS.map(auditDoc);
const failCount = results.filter(r => r.issues.length > 0).length;
const passCount = results.length - failCount;

// ── JSON report ───────────────────────────────────────────────────────────────
const report = {
  generated:           new Date().toISOString(),
  portal_pack_version: PACK_VERSION || '?',
  total:               results.length,
  pass:                passCount,
  fail:                failCount,
  results: results.map(r => ({
    doc_id: r.item.doc_id,
    src:    r.item._src,
    title:  r.item.title,
    status: r.issues.length === 0 ? 'PASS' : 'FAIL',
    issues: r.issues,
    notes:  r.notes,
  })),
};
const jsonPath = path.join(REPORT_DIR, 'source_audit.json');
fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

// ── Markdown report ───────────────────────────────────────────────────────────
let md = `# Trust Portal Source Audit (Full)\n\n`;
md += `**Portal Pack Version**: ${PACK_VERSION || '?'}  \n`;
md += `**Generated**: ${new Date().toISOString()}  \n`;
md += `**Result**: ${failCount === 0 ? '✅ ALL PASS' : `❌ ${failCount} FAIL`}  \n`;
md += `**Docs audited**: ${results.length} (${passCount} pass, ${failCount} fail)\n\n---\n\n`;
for (const r of results) {
  const icon = r.issues.length === 0 ? '✅ PASS' : '❌ FAIL';
  md += `## ${icon} ${r.item.doc_id} — ${r.item.title}\n\n`;
  md += `**File**: \`${r.item._src}\`\n\n`;
  if (r.issues.length) {
    md += `**Issues (${r.issues.length})**:\n`;
    for (const i of r.issues) md += `- ❌ ${i}\n`;
    md += '\n';
  }
  if (r.notes.length) {
    md += `**Notes**: ${r.notes.join(' | ')}\n\n`;
  }
}
const mdPath = path.join(REPORT_DIR, 'source_audit.md');
fs.writeFileSync(mdPath, md);

// ── Console summary ───────────────────────────────────────────────────────────
const SEP = '─'.repeat(72);
console.log(SEP);
console.log(`  SOURCE AUDIT FULL  Portal Pack v${PACK_VERSION || '?'}`);
console.log(SEP);
for (const r of results) {
  const icon = r.issues.length === 0 ? '✅' : '❌';
  console.log(`  ${icon} ${r.item.doc_id.padEnd(14)} ${r.item.title}`);
  for (const iss of r.issues) console.log(`       ↳ ${iss}`);
}
console.log(SEP);
console.log(`  ${passCount}/${results.length} PASS   ${failCount} FAIL`);
console.log(`  Report: ${REPORT_DIR}`);
console.log(`${SEP}\n`);

if (failCount > 0) {
  console.error(`\naudit_trust_portal_source_full FAILED — ${failCount} doc(s) have issues`);
  process.exit(1);
}
console.log('audit_trust_portal_source_full DONE — all pass ✅');
