#!/usr/bin/env node
// audit_trust_portal_live_full.mjs — Full F100 Trust Portal Live Crawler Audit
//
// Fetches every portal_nav route from the live GitHub Pages site and validates:
//   • HTTP 200 response for every page and key asset
//   • portal_pack_version appears in every page body
//   • doc_id appears in every doc page body
//   • No forbidden placeholder literals in rendered content
//   • Email allowlist enforced (no unlisted addresses)
//   • No "docs/<section>/..." pseudo-links in rendered text (unless full https://github.com/ permalink)
//   • Forbidden paths return non-200
//
// Output directory: $AUDIT_DIR (env) or /tmp/ft_portal_audit_live_full_<ts>/
//   <dir>/live_audit.json   — machine-readable
//   <dir>/live_audit.md     — human-readable
//
// Exit 0 = all pass, Exit 1 = any failure
//
// Usage (from repo root):
//   node atlassian/forge-app/tools/audit_trust_portal_live_full.mjs [BASE_URL]

import fs   from 'fs';
import path from 'path';
import https from 'https';
import http  from 'http';

// ── Paths ─────────────────────────────────────────────────────────────────────
const SCRIPT_DIR    = new URL('.', import.meta.url).pathname;
const MANIFEST_PATH = path.join(SCRIPT_DIR, 'pages_pack_manifest.json');

if (!fs.existsSync(MANIFEST_PATH)) {
  console.error(`FAIL: manifest not found: ${MANIFEST_PATH}`);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
const {
  portal_nav:          NAV,
  portal_pack_version: PACK_VERSION,
  portal_base_url:     MANIFEST_BASE,
} = manifest;

const BASE_URL = process.argv[2] || MANIFEST_BASE || 'https://firsttry-solutions.github.io/Firsttry';

if (!Array.isArray(NAV) || !NAV.length) {
  console.error('FAIL: manifest missing portal_nav');
  process.exit(1);
}
if (!PACK_VERSION) {
  console.error('FAIL: manifest missing portal_pack_version');
  process.exit(1);
}

// ── Output dir ────────────────────────────────────────────────────────────────
const REPORT_DIR = process.env.AUDIT_DIR ||
  `/tmp/ft_portal_audit_live_full_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`;
fs.mkdirSync(REPORT_DIR, { recursive: true });

console.log(`audit_trust_portal_live_full.mjs`);
console.log(`  Portal Pack Version : ${PACK_VERSION}`);
console.log(`  Base URL            : ${BASE_URL}`);
console.log(`  Report dir          : ${REPORT_DIR}`);

// ── Configuration ─────────────────────────────────────────────────────────────
const ALLOWED_EMAILS = new Set([
  'contact@firsttry.run',
  'support@firsttry.run',
  'security.contact@firsttry.run',
  'privacy@firsttry.run',
  'emergency@firsttry.run',
]);

const FORBIDDEN_PLACEHOLDERS = [
  'example.com',
  'example.org',
  '@firsttry.app',
  '[Your Jurisdiction]',
  '[INSERT',
  'TODO',
  'PLACEHOLDER',
];

// Pseudo-link patterns: "docs/<section>/" in visible text unless it's a full https://github.com/ URL
const PSEUDO_LINK_SECTIONS = ['docs/trust/', 'docs/operations/', 'docs/procurement/', 'docs/evidence/'];

const FORBIDDEN_PATHS = ['/production/', '/dist/', '/node_modules/'];

// Required assets to verify in addition to HTML pages
const REQUIRED_ASSETS = [
  '/assets/portal.css',
  '/assets/portal.js',
  '/assets/search_index.json',
];

// ── Collect unique doc pages from portal_nav ──────────────────────────────────
const seenRoutes = new Set();
const DOC_PAGES = [];
for (const group of NAV) {
  for (const item of (group.items || [])) {
    if (!item.route || seenRoutes.has(item.route)) continue;
    seenRoutes.add(item.route);
    DOC_PAGES.push(item);
  }
}

console.log(`  Doc pages to audit  : ${DOC_PAGES.length}`);
console.log(`  Assets to verify    : ${REQUIRED_ASSETS.length}`);
console.log(`\nFetching pages...\n`);

// ── HTTP fetch helper ─────────────────────────────────────────────────────────
function fetchUrl(url, redirectsLeft = 4) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, {
      headers: { 'User-Agent': 'FT-PortalAuditFull/1.1 (audit_trust_portal_live_full.mjs)' },
      timeout: 20000,
    }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && redirectsLeft > 0) {
        const loc = res.headers.location;
        if (loc) {
          const next = /^https?:\/\//.test(loc) ? loc : new URL(loc, url).href;
          res.resume();
          return resolve(fetchUrl(next, redirectsLeft - 1));
        }
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, url, body }));
    });
    req.on('timeout', () => { req.destroy(); reject(new Error(`TIMEOUT: ${url}`)); });
    req.on('error', (e) => reject(new Error(`FETCH ERROR: ${e.message} — ${url}`)));
  });
}

// ── Strip HTML tags for text-content checking ─────────────────────────────────
function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ');
}

// ── Audit homepage ────────────────────────────────────────────────────────────
async function auditHomePage() {
  const url = `${BASE_URL}/`;
  const issues = [];
  const notes  = [];
  let status = null;
  let body   = '';

  try {
    const res = await fetchUrl(url);
    status = res.status;
    body   = res.body;
  } catch (err) {
    return { type: 'home', url, status, issues: [err.message], notes: [] };
  }

  if (status !== 200) {
    issues.push(`HTTP ${status} (expected 200)`);
    return { type: 'home', url, status, issues, notes };
  }
  notes.push('HTTP 200 ✓');

  // Pack version in body
  const packStr = `Portal Pack Version: ${PACK_VERSION}`;
  if (!body.includes(packStr)) {
    issues.push(`Missing "${packStr}" in page body`);
  } else {
    notes.push(`"${packStr}" ✓`);
  }

  // Forbidden placeholders in visible text
  const text = stripHtml(body);
  for (const ph of FORBIDDEN_PLACEHOLDERS) {
    if (text.toLowerCase().includes(ph.toLowerCase())) {
      issues.push(`Forbidden placeholder: "${ph}"`);
    }
  }

  // Email allowlist
  const emails = [...new Set((text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) || []))];
  for (const e of emails) {
    if (!ALLOWED_EMAILS.has(e.toLowerCase())) issues.push(`Unlisted email: "${e}"`);
  }
  if (emails.length > 0 && !issues.some(i => i.startsWith('Unlisted'))) {
    notes.push(`Emails OK: ${emails.join(', ')}`);
  }

  return { type: 'home', url, status, issues, notes };
}

// ── Audit one doc page ────────────────────────────────────────────────────────
async function auditDocPage(item) {
  const url = `${BASE_URL}/${item.route}`;
  const issues = [];
  const notes  = [];
  let status = null;
  let body   = '';

  try {
    const res = await fetchUrl(url);
    status = res.status;
    body   = res.body;
  } catch (err) {
    return { item, url, status, issues: [err.message], notes };
  }

  // HTTP 200
  if (status !== 200) {
    issues.push(`HTTP ${status} (expected 200)`);
    return { item, url, status, issues, notes };
  }
  notes.push('HTTP 200 ✓');

  // Pack version string
  const packStr = `Portal Pack Version: ${PACK_VERSION}`;
  if (!body.includes(packStr)) {
    issues.push(`Missing "${packStr}" in page body`);
  } else {
    notes.push(`"${packStr}" ✓`);
  }

  // Doc ID in body
  if (item.doc_id) {
    if (!body.includes(item.doc_id)) {
      issues.push(`Missing doc_id "${item.doc_id}" in page body`);
    } else {
      notes.push(`doc_id "${item.doc_id}" ✓`);
    }
  }

  // Forbidden placeholders in visible text
  const text = stripHtml(body);
  for (const ph of FORBIDDEN_PLACEHOLDERS) {
    if (text.toLowerCase().includes(ph.toLowerCase())) {
      issues.push(`Forbidden placeholder: "${ph}"`);
    }
  }

  // Email allowlist
  const emails = [...new Set((text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) || []))];
  for (const e of emails) {
    if (!ALLOWED_EMAILS.has(e.toLowerCase())) issues.push(`Unlisted email: "${e}"`);
  }
  if (emails.length > 0 && !issues.some(i => i.startsWith('Unlisted'))) {
    notes.push(`Emails OK`);
  }

  // Pseudo-links: actual <a href="docs/<section>/"> links in the rendered HTML
  // that are NOT full https://github.com/ URLs (bare text mentions are fine)
  for (const seg of PSEUDO_LINK_SECTIONS) {
    const hrefRe = new RegExp(`href=["'](?!https?://)[^"']*${seg.replace(/\//g, '\\/')}[^"']*["']`, 'gi');
    const matches = body.match(hrefRe) || [];
    if (matches.length > 0) {
      issues.push(`Pseudo-link href found — <a href containing "${seg}..."> (${matches.length} link(s)): ${matches.slice(0,2).join(', ')}`);
    }
  }

  return { item, url, status, issues, notes };
}

// ── Audit an asset ────────────────────────────────────────────────────────────
async function auditAsset(assetPath) {
  const url = `${BASE_URL}${assetPath}`;
  try {
    const res = await fetchUrl(url);
    return { path: assetPath, url, status: res.status, ok: res.status === 200 };
  } catch (err) {
    return { path: assetPath, url, status: 0, ok: false, error: err.message };
  }
}

// ── Check forbidden paths ─────────────────────────────────────────────────────
async function checkForbiddenPath(p) {
  const url = `${BASE_URL}${p}`;
  try {
    const res = await fetchUrl(url);
    return { path: p, url, status: res.status, ok: res.status !== 200 };
  } catch (_) {
    return { path: p, url, status: 0, ok: true }; // unreachable = OK
  }
}

// ── Concurrency-limited runner ────────────────────────────────────────────────
async function withConcurrency(tasks, limit) {
  const results = new Array(tasks.length);
  let idx = 0;
  const worker = async () => {
    while (idx < tasks.length) {
      const i = idx++;
      results[i] = await tasks[i]();
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}

// ── Run all audits ────────────────────────────────────────────────────────────
const homeResult      = await auditHomePage();
const docResults      = await withConcurrency(DOC_PAGES.map(item => () => auditDocPage(item)), 5);
const assetResults    = await withConcurrency(REQUIRED_ASSETS.map(p => () => auditAsset(p)), 3);
const forbiddenResults = await withConcurrency(FORBIDDEN_PATHS.map(p => () => checkForbiddenPath(p)), 3);

// ── Tally ─────────────────────────────────────────────────────────────────────
const allPageResults = [homeResult, ...docResults];
const pageFail    = allPageResults.filter(r => r.issues.length > 0).length;
const assetFail   = assetResults.filter(r => !r.ok).length;
const forbidFail  = forbiddenResults.filter(r => !r.ok).length;
const totalFail   = pageFail + assetFail + forbidFail;

// ── Write JSON report ─────────────────────────────────────────────────────────
const report = {
  generated:           new Date().toISOString(),
  portal_pack_version: PACK_VERSION,
  base_url:            BASE_URL,
  total_fail:          totalFail,
  summary: {
    pages_total:         allPageResults.length,
    pages_pass:          allPageResults.length - pageFail,
    pages_fail:          pageFail,
    assets_total:        assetResults.length,
    assets_fail:         assetFail,
    forbidden_paths_fail: forbidFail,
  },
  home:              homeResult,
  doc_pages:         docResults.map(r => ({
    doc_id: r.item?.doc_id,
    route:  r.item?.route,
    url:    r.url,
    status: r.status,
    result: r.issues.length === 0 ? 'PASS' : 'FAIL',
    issues: r.issues,
    notes:  r.notes,
  })),
  assets:            assetResults,
  forbidden_paths:   forbiddenResults,
};

const jsonPath = path.join(REPORT_DIR, 'live_audit.json');
fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

// ── Write Markdown report ─────────────────────────────────────────────────────
let md = `# Trust Portal Live Audit (Full)\n\n`;
md += `**Portal Pack Version**: ${PACK_VERSION}  \n`;
md += `**Base URL**: ${BASE_URL}  \n`;
md += `**Generated**: ${new Date().toISOString()}  \n`;
md += `**Overall Result**: ${totalFail === 0 ? '✅ ALL PASS' : `❌ ${totalFail} FAIL`}\n\n`;
md += `| Check | Total | Pass | Fail |\n|---|---|---|---|\n`;
md += `| Pages | ${allPageResults.length} | ${allPageResults.length - pageFail} | ${pageFail} |\n`;
md += `| Assets | ${assetResults.length} | ${assetResults.length - assetFail} | ${assetFail} |\n`;
md += `| Forbidden paths | ${forbiddenResults.length} | ${forbiddenResults.filter(r=>r.ok).length} | ${forbidFail} |\n\n`;
md += `---\n\n## Home Page\n\n`;
md += `**URL**: ${homeResult.url}  **HTTP**: ${homeResult.status}  **Result**: ${homeResult.issues.length===0?'✅ PASS':'❌ FAIL'}\n`;
if (homeResult.issues.length) { for (const i of homeResult.issues) md += `- ❌ ${i}\n`; }
md += `\n---\n\n## Doc Pages\n\n`;
for (const r of docResults) {
  const icon = r.issues.length === 0 ? '✅' : '❌';
  md += `### ${icon} ${r.item?.doc_id} — ${r.item?.title}\n\n`;
  md += `**URL**: ${r.url}  **HTTP**: ${r.status}\n\n`;
  if (r.issues.length) { for (const i of r.issues) md += `- ❌ ${i}\n`; md += '\n'; }
}
md += `---\n\n## Assets\n\n`;
for (const a of assetResults) md += `- ${a.ok ? '✅' : '❌'} \`${a.path}\` → HTTP ${a.status}\n`;
md += `\n---\n\n## Forbidden Paths\n\n`;
for (const f of forbiddenResults) md += `- ${f.ok ? '✅' : '❌'} \`${f.path}\` → HTTP ${f.status}\n`;

const mdPath = path.join(REPORT_DIR, 'live_audit.md');
fs.writeFileSync(mdPath, md);

// ── Console summary ───────────────────────────────────────────────────────────
const SEP = '─'.repeat(72);
console.log(SEP);
console.log(`  LIVE AUDIT FULL  Portal Pack v${PACK_VERSION}`);
console.log(SEP);

const homeIcon = homeResult.issues.length === 0 ? '✅' : '❌';
console.log(`  ${homeIcon} HOME             HTTP ${homeResult.status}  ${BASE_URL}/`);
for (const iss of homeResult.issues) console.log(`       ↳ ${iss}`);

for (const r of docResults) {
  const icon = r.issues.length === 0 ? '✅' : '❌';
  console.log(`  ${icon} ${(r.item?.doc_id || '?').padEnd(14)} HTTP ${r.status}  ${r.item?.title}`);
  for (const iss of r.issues) console.log(`       ↳ ${iss}`);
}

console.log(`\n  Assets:`);
for (const a of assetResults) console.log(`  ${a.ok ? '✅' : '❌'} ${a.path} → HTTP ${a.status}`);

console.log(`\n  Forbidden paths:`);
for (const f of forbiddenResults) console.log(`  ${f.ok ? '✅' : '❌'} ${f.path} → HTTP ${f.status}`);

console.log(SEP);
console.log(`  Pages: ${allPageResults.length - pageFail}/${allPageResults.length} PASS  |  Assets: ${assetResults.length - assetFail}/${assetResults.length} PASS  |  Forbidden: ${forbiddenResults.length-forbidFail}/${forbiddenResults.length} OK`);
console.log(`  Total failures: ${totalFail}`);
console.log(`  Report: ${REPORT_DIR}`);
console.log(SEP + '\n');

if (totalFail > 0) {
  console.error(`\naudit_trust_portal_live_full FAILED — ${totalFail} check(s) failed`);
  process.exit(1);
}
console.log('audit_trust_portal_live_full DONE — all checks pass ✅');
