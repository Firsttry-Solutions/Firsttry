#!/usr/bin/env node
// audit_trust_portal_source.mjs — F100 Trust Portal Source Audit
//
// Reads pages_pack_manifest.json and validates every markdown doc registered in
// portal_nav for:
//   • required metadata keys (Doc ID, Version, Owner, Last Updated, Review Cycle)
//   • Doc ID format matches doc_id_pattern
//   • Last Updated format matches last_updated_pattern
//   • No forbidden placeholder literals
//   • No ASCII-art tables (space-aligned columns without pipe syntax)
//   • Exactly one H1 heading
//   • No broken relative markdown links (resolved against portal_nav routes)
//
// Output: JSON + Markdown report written to /tmp/ft_portal_audit_source_<ts>/
// Exit: 0 = all PASS, 1 = one or more FAILs
//
// Usage (from repo root):
//   node atlassian/forge-app/tools/audit_trust_portal_source.mjs
//

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
  portal_nav:       NAV,
  metadata_contract: CONTRACT,
  portal_pack_version: PACK_VERSION,
} = manifest;

if (!Array.isArray(NAV) || !NAV.length) {
  console.error('FAIL: manifest missing portal_nav');
  process.exit(1);
}
if (!CONTRACT) {
  console.error('FAIL: manifest missing metadata_contract');
  process.exit(1);
}

const REQUIRED_KEYS      = CONTRACT.required_keys   || [];
const DOC_ID_PATTERN     = new RegExp(CONTRACT.doc_id_pattern    || '^FT-[A-Z]+-[0-9]{3}$');
const LAST_UPDATED_PAT   = new RegExp(CONTRACT.last_updated_pattern || '^[0-9]{4}-[0-9]{2}-[0-9]{2}$');

// ── Collect unique docs from portal_nav (by src) ──────────────────────────────
const seen = new Set();
const DOCS = [];
for (const group of NAV) {
  for (const item of (group.items || [])) {
    if (!item.src || seen.has(item.src)) continue;
    seen.add(item.src);
    DOCS.push(item);
  }
}

console.log(`audit_trust_portal_source.mjs — Portal Pack v${PACK_VERSION || '?'}`);
console.log(`  docs to audit : ${DOCS.length}`);
console.log(`  required keys : ${REQUIRED_KEYS.join(', ')}`);

// ── Forbidden placeholder strings ─────────────────────────────────────────────
const FORBIDDEN_PLACEHOLDERS = [
  'example.com',
  'example.org',
  '@firsttry.app',
  '[Your Jurisdiction]',
  '[INSERT',
  'TODO',
  'TBD',
  'PLACEHOLDER',
  'your-company',
];

// ── Build set of known route stems for relative link checking ─────────────────
const KNOWN_ROUTES = new Set();
for (const group of NAV) {
  for (const item of (group.items || [])) {
    if (item.route) KNOWN_ROUTES.add(item.route);
  }
}

// ── Audit one doc ─────────────────────────────────────────────────────────────
function auditDoc(item) {
  const srcPath = path.join(REPO_ROOT, item.src);
  const issues  = [];
  const notes   = [];

  if (!fs.existsSync(srcPath)) {
    return { item, issues: [`MISSING FILE: ${item.src}`], notes: [] };
  }

  const raw = fs.readFileSync(srcPath, 'utf8');
  const lines = raw.split('\n');

  // ── 1. Extract metadata block (bold key: value lines before first ---)
  const metaValues = {};
  for (const line of lines) {
    const m = line.match(/^\*\*([^*]+)\*\*\s*[:：]\s*(.+)/);
    if (m) {
      metaValues[m[1].trim()] = m[2].trim();
    }
  }

  // ── 2. Required keys
  for (const key of REQUIRED_KEYS) {
    if (!metaValues[key]) {
      issues.push(`MISSING metadata key: "${key}"`);
    }
  }

  // ── 3. Doc ID format
  const docId = metaValues['Doc ID'];
  if (docId) {
    // Strip trailing markdown formatting (bold markers, spaces)
    const cleanId = docId.replace(/\*\*/g, '').replace(/\s+$/, '').trim();
    if (!DOC_ID_PATTERN.test(cleanId)) {
      issues.push(`Doc ID format invalid: "${cleanId}" (expected ${DOC_ID_PATTERN})`);
    } else if (cleanId !== item.doc_id) {
      issues.push(`Doc ID mismatch: file has "${cleanId}", manifest expects "${item.doc_id}"`);
    } else {
      notes.push(`Doc ID: ${cleanId} ✓`);
    }
  }

  // ── 4. Last Updated format
  const lastUpdated = metaValues['Last Updated'];
  if (lastUpdated) {
    const cleanDate = lastUpdated.split(/\s/)[0]; // first token in case of trailing text
    if (!LAST_UPDATED_PAT.test(cleanDate)) {
      issues.push(`Last Updated format invalid: "${lastUpdated}" (expected YYYY-MM-DD)`);
    } else {
      notes.push(`Last Updated: ${cleanDate} ✓`);
    }
  }

  // ── 5. Forbidden placeholders
  for (const ph of FORBIDDEN_PLACEHOLDERS) {
    const phLower = ph.toLowerCase();
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(phLower)) {
        issues.push(`Forbidden placeholder "${ph}" at line ${i + 1}: ${lines[i].trim().slice(0, 80)}`);
        break; // one report per placeholder
      }
    }
  }

  // ── 6. ASCII-art tables (lines that align with > 3 consecutive spaces outside
  //        markdown code blocks and without a leading pipe character, yet look
  //        like tabular data — heuristic: 4+ spaces between non-space runs)
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^```/.test(l)) { inFence = !inFence; continue; }
    if (inFence) continue;
    // Skip markdown pipe-table lines (fine) and blank lines
    if (l.trim() === '' || l.trimStart().startsWith('|')) continue;
    // Heuristic: line has 4+ consecutive internal spaces used for alignment
    if (/\S {4,}\S/.test(l) && !/^\s*([-*+]|\d+\.)/.test(l)) {
      // Additional signal: line has 2+ such gaps (column alignment)
      const gaps = (l.match(/ {4,}/g) || []).length;
      if (gaps >= 2) {
        issues.push(`Possible ASCII-art table at line ${i + 1}: ${l.trim().slice(0, 80)}`);
      }
    }
  }

  // ── 7. Exactly one H1 heading (skip fenced code blocks)
  const h1Lines = [];
  let inFenceForH1 = false;
  for (const l of lines) {
    if (/^```/.test(l)) { inFenceForH1 = !inFenceForH1; continue; }
    if (!inFenceForH1 && /^# /.test(l)) h1Lines.push(l);
  }
  if (h1Lines.length === 0) {
    issues.push('No H1 heading found');
  } else if (h1Lines.length > 1) {
    issues.push(`Multiple H1 headings (${h1Lines.length}): ${h1Lines.map(l => l.trim()).join(' | ')}`);
  } else {
    notes.push(`H1: "${h1Lines[0].replace(/^# /, '').trim()}" ✓`);
  }

  // ── 8. Broken relative HTML links (only .html hrefs checked against portal routes)
  //        .md relative links are validated separately by md_link_check.mjs
  const linkRe = /\[([^\]]*)\]\(([^)]+)\)/g;
  let lm;
  inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^```/.test(l)) { inFence = !inFence; continue; }
    if (inFence) continue;
    while ((lm = linkRe.exec(l)) !== null) {
      const href = lm[2];
      if (/^https?:\/\//.test(href) || /^mailto:/.test(href) || href.startsWith('#')) continue;
      // Only flag explicit .html relative hrefs that don't match a known portal route
      const normHref = href.replace(/^\//, '');
      if (normHref.endsWith('.html') && !KNOWN_ROUTES.has(normHref)) {
        issues.push(`Broken relative .html link at line ${i + 1}: [${lm[1]}](${href})`);
      }
    }
    linkRe.lastIndex = 0;
  }

  return { item, issues, notes };
}

// ── Run audit ─────────────────────────────────────────────────────────────────
const results = DOCS.map(auditDoc);

const failCount = results.filter(r => r.issues.length > 0).length;
const passCount = results.length - failCount;

// ── Report ────────────────────────────────────────────────────────────────────
const TS = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const REPORT_DIR = `/tmp/ft_portal_audit_source_${TS}`;
fs.mkdirSync(REPORT_DIR, { recursive: true });

// JSON report
const jsonReport = {
  generated: new Date().toISOString(),
  portal_pack_version: PACK_VERSION || '?',
  total: results.length,
  pass: passCount,
  fail: failCount,
  results: results.map(r => ({
    doc_id: r.item.doc_id,
    src:    r.item.src,
    title:  r.item.title,
    status: r.issues.length === 0 ? 'PASS' : 'FAIL',
    issues: r.issues,
    notes:  r.notes,
  })),
};
const jsonPath = path.join(REPORT_DIR, 'audit_source_report.json');
fs.writeFileSync(jsonPath, JSON.stringify(jsonReport, null, 2));

// Markdown report
let md = `# Trust Portal Source Audit Report\n\n`;
md += `**Portal Pack Version**: ${PACK_VERSION || '?'}\n`;
md += `**Generated**: ${new Date().toISOString()}\n`;
md += `**Result**: ${failCount === 0 ? '✅ ALL PASS' : `❌ ${failCount} FAIL`}\n`;
md += `**Docs audited**: ${results.length} (${passCount} pass, ${failCount} fail)\n\n`;
md += `---\n\n`;

for (const r of results) {
  const status = r.issues.length === 0 ? '✅ PASS' : '❌ FAIL';
  md += `## ${status} ${r.item.doc_id} — ${r.item.title}\n\n`;
  md += `**File**: \`${r.item.src}\`\n\n`;
  if (r.issues.length) {
    md += `**Issues (${r.issues.length})**:\n`;
    for (const iss of r.issues) md += `- ❌ ${iss}\n`;
    md += '\n';
  }
  if (r.notes.length) {
    md += `**Notes**:\n`;
    for (const n of r.notes) md += `- ${n}\n`;
    md += '\n';
  }
}

const mdPath = path.join(REPORT_DIR, 'audit_source_report.md');
fs.writeFileSync(mdPath, md);

// Console summary
console.log(`\n${'─'.repeat(70)}`);
console.log(`  SOURCE AUDIT  Portal Pack v${PACK_VERSION || '?'}`);
console.log(`${'─'.repeat(70)}`);
for (const r of results) {
  const icon = r.issues.length === 0 ? '✅' : '❌';
  console.log(`  ${icon} ${r.item.doc_id.padEnd(14)} ${r.item.title}`);
  for (const iss of r.issues) console.log(`       ↳ ${iss}`);
}
console.log(`${'─'.repeat(70)}`);
console.log(`  ${passCount}/${results.length} PASS   ${failCount} FAIL`);
console.log(`  Report: ${REPORT_DIR}`);
console.log(`${'─'.repeat(70)}\n`);

if (failCount > 0) {
  console.error(`\naudit_trust_portal_source FAILED — ${failCount} doc(s) have issues`);
  process.exit(1);
}

console.log('audit_trust_portal_source DONE — all pass ✅');
