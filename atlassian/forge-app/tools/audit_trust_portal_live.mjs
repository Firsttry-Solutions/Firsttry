#!/usr/bin/env node
// audit_trust_portal_live.mjs — F100 Trust Portal Live Audit
//
// Fetches every portal_nav route from the live GitHub Pages site and validates:
//   • HTTP 200 response
//   • Page body contains "Portal Pack Version: X.Y.Z" (from portal_pack_version)
//   • Page body contains the expected doc_id (FT-XXX-NNN)
//   • No forbidden placeholder literals in page body
//   • Only approved email addresses present (allowlist)
//   • Forbidden paths return non-200
//
// Output: JSON + Markdown report written to /tmp/ft_portal_audit_live_<ts>/
// Exit: 0 = all PASS, 1 = one or more FAILs
//
// Usage (from repo root):
//   node atlassian/forge-app/tools/audit_trust_portal_live.mjs [BASE_URL]
//   e.g.  node atlassian/forge-app/tools/audit_trust_portal_live.mjs https://firsttry-solutions.github.io/Firsttry
//

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

const BASE = process.argv[2] || MANIFEST_BASE || 'https://firsttry-solutions.github.io/Firsttry';

if (!Array.isArray(NAV) || !NAV.length) {
  console.error('FAIL: manifest missing portal_nav');
  process.exit(1);
}
if (!PACK_VERSION) {
  console.error('FAIL: manifest missing portal_pack_version');
  process.exit(1);
}

console.log(`audit_trust_portal_live.mjs — Portal Pack v${PACK_VERSION}`);
console.log(`  base URL : ${BASE}`);

// ── Allowed emails ────────────────────────────────────────────────────────────
const ALLOWED_EMAILS = new Set([
  'contact@firsttry.run',
  'support@firsttry.run',
  'security.contact@firsttry.run',
  'privacy@firsttry.run',
  'emergency@firsttry.run',
]);

// ── Forbidden placeholder strings ─────────────────────────────────────────────
const FORBIDDEN_PLACEHOLDERS = [
  'example.com',
  'example.org',
  '@firsttry.app',
  '[Your Jurisdiction]',
  '[INSERT',
  'TODO',
  'PLACEHOLDER',
];

// ── Forbidden paths (must return non-200) ─────────────────────────────────────
const FORBIDDEN_PATHS = ['/production/', '/dist/', '/node_modules/'];

// ── Collect unique docs from portal_nav ──────────────────────────────────────
const seen = new Set();
const DOCS = [];
for (const group of NAV) {
  for (const item of (group.items || [])) {
    if (!item.route || seen.has(item.route)) continue;
    seen.add(item.route);
    DOCS.push(item);
  }
}

console.log(`  routes to audit : ${DOCS.length}`);

// ── HTTP fetch helper ─────────────────────────────────────────────────────────
function fetchUrl(url, { followRedirects = 3 } = {}) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, {
      headers: { 'User-Agent': 'FT-PortalAudit/1.0 (audit_trust_portal_live.mjs)' },
      timeout: 15000,
    }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && followRedirects > 0) {
        const loc = res.headers.location;
        if (loc) {
          const next = loc.startsWith('http') ? loc : new URL(loc, url).href;
          res.resume();
          return resolve(fetchUrl(next, { followRedirects: followRedirects - 1 }));
        }
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('TIMEOUT')); });
    req.on('error', reject);
  });
}

// ── Audit one doc page ────────────────────────────────────────────────────────
async function auditPage(item) {
  const url = `${BASE}/${item.route}`;
  const issues = [];
  const notes  = [];
  let status = null;
  let body   = '';

  try {
    const res = await fetchUrl(url);
    status = res.status;
    body   = res.body;
  } catch (err) {
    issues.push(`FETCH ERROR: ${err.message}`);
    return { item, url, status, issues, notes };
  }

  // 1. HTTP 200
  if (status !== 200) {
    issues.push(`HTTP ${status} (expected 200)`);
    return { item, url, status, issues, notes };
  }
  notes.push('HTTP 200 ✓');

  // 2. Portal Pack Version string
  const packVersionStr = `Portal Pack Version: ${PACK_VERSION}`;
  if (!body.includes(packVersionStr)) {
    issues.push(`Missing "${packVersionStr}" in page body`);
  } else {
    notes.push(`"${packVersionStr}" ✓`);
  }

  // 3. Doc ID present
  if (item.doc_id && !body.includes(item.doc_id)) {
    issues.push(`Missing doc_id "${item.doc_id}" in page body`);
  } else if (item.doc_id) {
    notes.push(`doc_id "${item.doc_id}" ✓`);
  }

  // 4. Forbidden placeholders
  for (const ph of FORBIDDEN_PLACEHOLDERS) {
    // Search in visible text (strip HTML tags roughly for checking)
    const textBody = body.replace(/<[^>]+>/g, ' ');
    if (textBody.toLowerCase().includes(ph.toLowerCase())) {
      issues.push(`Forbidden placeholder found: "${ph}"`);
    }
  }

  // 5. Email allowlist — extract all emails, check each is allowed
  const emailRe = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  const textBody = body.replace(/<[^>]+>/g, ' ');
  const emails   = [...new Set(textBody.match(emailRe) || [])];
  for (const email of emails) {
    if (!ALLOWED_EMAILS.has(email.toLowerCase())) {
      issues.push(`Unlisted email found: "${email}"`);
    }
  }
  if (emails.length > 0 && issues.filter(i => i.startsWith('Unlisted')).length === 0) {
    notes.push(`Emails OK: ${emails.join(', ')}`);
  }

  return { item, url, status, issues, notes };
}

// ── Check forbidden paths ─────────────────────────────────────────────────────
async function checkForbiddenPaths() {
  const results = [];
  for (const p of FORBIDDEN_PATHS) {
    const url = `${BASE}${p}`;
    let status = null;
    try {
      const res = await fetchUrl(url);
      status = res.status;
    } catch (_) {
      status = 0; // unreachable = fine
    }
    const ok = status !== 200;
    results.push({ path: p, url, status, ok });
  }
  return results;
}

// ── Run audit ─────────────────────────────────────────────────────────────────
console.log('\nFetching pages (this may take ~30s)...\n');

// Fetch with concurrency limit of 5 to avoid hammering GitHub Pages
async function runWithConcurrency(tasks, limit) {
  const results = [];
  let i = 0;
  async function next() {
    while (i < tasks.length) {
      const idx = i++;
      results[idx] = await tasks[idx]();
    }
  }
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => next());
  await Promise.all(workers);
  return results;
}

const pageTasks = DOCS.map(item => () => auditPage(item));
const pageResults = await runWithConcurrency(pageTasks, 5);

const forbiddenResults = await checkForbiddenPaths();

// ── Tally ─────────────────────────────────────────────────────────────────────
const failCount = pageResults.filter(r => r.issues.length > 0).length;
const passCount = pageResults.length - failCount;
const forbiddenFail = forbiddenResults.filter(r => !r.ok).length;
const totalFail = failCount + forbiddenFail;

// ── Report ────────────────────────────────────────────────────────────────────
const TS = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const REPORT_DIR = `/tmp/ft_portal_audit_live_${TS}`;
fs.mkdirSync(REPORT_DIR, { recursive: true });

const jsonReport = {
  generated: new Date().toISOString(),
  portal_pack_version: PACK_VERSION,
  base_url: BASE,
  total_pages: pageResults.length,
  pass: passCount,
  fail: failCount,
  forbidden_paths_fail: forbiddenFail,
  pages: pageResults.map(r => ({
    doc_id: r.item.doc_id,
    route:  r.item.route,
    url:    r.url,
    http:   r.status,
    status: r.issues.length === 0 ? 'PASS' : 'FAIL',
    issues: r.issues,
    notes:  r.notes,
  })),
  forbidden_paths: forbiddenResults,
};
const jsonPath = path.join(REPORT_DIR, 'audit_live_report.json');
fs.writeFileSync(jsonPath, JSON.stringify(jsonReport, null, 2));

// Markdown report
let md = `# Trust Portal Live Audit Report\n\n`;
md += `**Portal Pack Version**: ${PACK_VERSION}\n`;
md += `**Base URL**: ${BASE}\n`;
md += `**Generated**: ${new Date().toISOString()}\n`;
md += `**Result**: ${totalFail === 0 ? '✅ ALL PASS' : `❌ ${totalFail} FAIL`}\n`;
md += `**Pages audited**: ${pageResults.length} (${passCount} pass, ${failCount} fail)\n\n`;
md += `---\n\n`;

for (const r of pageResults) {
  const icon = r.issues.length === 0 ? '✅ PASS' : '❌ FAIL';
  md += `## ${icon} ${r.item.doc_id} — ${r.item.title}\n\n`;
  md += `**URL**: ${r.url}  \n**HTTP**: ${r.status}\n\n`;
  if (r.issues.length) {
    md += `**Issues**:\n`;
    for (const iss of r.issues) md += `- ❌ ${iss}\n`;
    md += '\n';
  }
  if (r.notes.length) {
    md += `**Notes**:\n`;
    for (const n of r.notes) md += `- ${n}\n`;
    md += '\n';
  }
}

md += `---\n\n## Forbidden Paths\n\n`;
for (const fp of forbiddenResults) {
  md += `- ${fp.ok ? '✅' : '❌'} \`${fp.path}\` → HTTP ${fp.status}\n`;
}

const mdPath = path.join(REPORT_DIR, 'audit_live_report.md');
fs.writeFileSync(mdPath, md);

// Console summary
console.log(`${'─'.repeat(70)}`);
console.log(`  LIVE AUDIT  Portal Pack v${PACK_VERSION}  Base: ${BASE}`);
console.log(`${'─'.repeat(70)}`);
for (const r of pageResults) {
  const icon = r.issues.length === 0 ? '✅' : '❌';
  console.log(`  ${icon} ${r.item.doc_id.padEnd(14)} HTTP ${r.status}  ${r.item.title}`);
  for (const iss of r.issues) console.log(`       ↳ ${iss}`);
}
console.log(`\n  Forbidden paths:`);
for (const fp of forbiddenResults) {
  console.log(`  ${fp.ok ? '✅' : '❌'} ${fp.path} → HTTP ${fp.status}`);
}
console.log(`${'─'.repeat(70)}`);
console.log(`  ${passCount}/${pageResults.length} PASS   ${failCount} page FAIL   ${forbiddenFail} forbidden FAIL`);
console.log(`  Report: ${REPORT_DIR}`);
console.log(`${'─'.repeat(70)}\n`);

if (totalFail > 0) {
  console.error(`\naudit_trust_portal_live FAILED — ${totalFail} check(s) failed`);
  process.exit(1);
}

console.log('audit_trust_portal_live DONE — all pass ✅');
