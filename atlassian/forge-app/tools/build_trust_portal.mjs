#!/usr/bin/env node
// build_trust_portal.mjs — F100 Trust Center Portal Builder
//
// Reads pages_pack_manifest.json + portal_nav, renders each markdown doc to a
// styled HTML page (sidebar + content + meta panel), generates a search index,
// portal.css, portal.js, and an executive index.html.
//
// No external npm deps — uses vendored marked.min.js (v9.1.6, pinned, MIT).
//
// Usage (from repo root):
//   node atlassian/forge-app/tools/build_trust_portal.mjs
//
'use strict';

import fs   from 'fs';
import path from 'path';
import { execSync }    from 'child_process';
import { createRequire } from 'module';

// ── Load vendored marked ───────────────────────────────────────────────────────
const _require = createRequire(import.meta.url);
const { marked } = _require('./vendor/marked.min.js');
marked.setOptions({ gfm: true, breaks: false });

// ── Locate paths ──────────────────────────────────────────────────────────────
const SCRIPT_DIR = new URL('.', import.meta.url).pathname;
const REPO_ROOT  = path.resolve(SCRIPT_DIR, '../../..');
const MANIFEST_PATH = path.join(SCRIPT_DIR, 'pages_pack_manifest.json');

if (!fs.existsSync(MANIFEST_PATH)) {
  console.error(`FAIL: manifest not found: ${MANIFEST_PATH}`);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
const {
  portal_version:      VERSION,
  portal_pack_version: PACK_VERSION,
  portal_title:        PORTAL_TITLE,
  portal_tagline:      PORTAL_TAGLINE,
  publish_root:        PUBLISH_ROOT,
  portal_nav:          NAV,
  publish_dirs,
} = manifest;

if (!VERSION || !PORTAL_TITLE || !Array.isArray(NAV) || !NAV.length) {
  console.error('FAIL: manifest missing required portal fields (portal_version / portal_title / portal_nav)');
  process.exit(1);
}

const TODAY = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
const SITE  = path.join(REPO_ROOT, PUBLISH_ROOT);

console.log(`build_trust_portal.mjs — ${PORTAL_TITLE} v${VERSION}`);
console.log(`  repo root : ${REPO_ROOT}`);
console.log(`  output    : ${SITE}`);

// ── 1. Clean + mkdir ──────────────────────────────────────────────────────────
execSync(`rm -rf "${SITE}" _site`, { cwd: REPO_ROOT });
fs.mkdirSync(path.join(SITE, 'assets'), { recursive: true });

// ── 2. Copy raw markdown to site/raw/ (transparency + "View raw" links) ───────
for (const srcDir of publish_dirs) {
  const fullSrc = path.join(REPO_ROOT, srcDir);
  const rawDest = path.join(SITE, 'raw', path.basename(srcDir));
  fs.mkdirSync(rawDest, { recursive: true });
  execSync(`cp -r "${fullSrc}/." "${rawDest}/"`);
  console.log(`  raw: ${srcDir}/ → site/raw/${path.basename(srcDir)}/`);
}

// ── 3. Utilities ──────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Relative link from one site route to another (both relative to site root). */
function relPath(fromRoute, toRoute) {
  const fromDir   = fromRoute.includes('/') ? fromRoute.split('/').slice(0, -1).join('/') : '';
  if (!fromDir) return toRoute;
  const fromParts = fromDir.split('/').filter(Boolean);
  const toParts   = toRoute.split('/').filter(Boolean);
  let i = 0;
  while (i < fromParts.length && i < toParts.length && fromParts[i] === toParts[i]) i++;
  const ups   = fromParts.length - i;
  const downs = toParts.slice(i);
  return (ups > 0 ? '../'.repeat(ups) : './') + downs.join('/');
}

/** Relative href to site root index.html from a given route. */
function relHome(fromRoute) {
  const depth = (fromRoute.match(/\//g) || []).length;
  return depth === 0 ? 'index.html' : '../'.repeat(depth) + 'index.html';
}

/** Relative prefix ending with '/' pointing at site root from a given route. */
function relRoot(fromRoute) {
  return relHome(fromRoute).replace('index.html', '');
}

// ── 4. Extract front-matter metadata fields ────────────────────────────────────
function extractFrontMatter(md) {
  const meta = {};
  const patterns = [
    { key: 'version',      re: /^\*\*Version\*\*[:\s]+(.+)$/im },
    { key: 'owner',        re: /^\*\*Owner\*\*[:\s]+(.+)$/im },
    { key: 'last_updated', re: /^\*\*Last Updated\*\*[:\s]+(.+)$/im },
    { key: 'review_cycle', re: /^\*\*Review Cycle\*\*[:\s]+(.+)$/im },
  ];
  for (const { key, re } of patterns) {
    const m = md.match(re);
    if (m) meta[key] = m[1].trim().replace(/\s*\\$/, '').replace(/\s+$/, '');
  }
  return meta;
}

// ── 5. Sidebar nav HTML ────────────────────────────────────────────────────────
function buildSidebar(activeRoute) {
  const home = relHome(activeRoute);
  let html = '<nav id="sidebar-nav">\n';
  html += `  <div class="sidebar-header"><a href="${home}" class="portal-home-link">${escHtml(PORTAL_TITLE)}</a></div>\n`;
  html += '  <div class="sidebar-search"><input type="text" id="sidebar-search-input" placeholder="Search docs\u2026" aria-label="Search documentation" autocomplete="off" /></div>\n';
  html += '  <ul class="sidebar-groups">\n';
  for (const group of NAV) {
    html += '    <li class="sidebar-group">\n';
    html += `      <span class="sidebar-group-label">${escHtml(group.group)}</span>\n`;
    html += '      <ul class="sidebar-items">\n';
    for (const item of group.items) {
      const isActive = item.route === activeRoute;
      const href     = relPath(activeRoute, item.route);
      html += `        <li class="sidebar-item${isActive ? ' active' : ''}" data-search-title="${escHtml(item.title.toLowerCase())}">\n`;
      html += `          <a href="${href}">${escHtml(item.title)}</a>\n`;
      html += '        </li>\n';
    }
    html += '      </ul>\n    </li>\n';
  }
  html += '  </ul>\n</nav>\n';
  return html;
}

// ── 6. Breadcrumbs ─────────────────────────────────────────────────────────────
function buildBreadcrumbs(item, activeRoute) {
  const group   = NAV.find(g => g.items.some(i => i.route === activeRoute));
  const homeRef = relHome(activeRoute);
  let bc = '<nav class="breadcrumbs" aria-label="Breadcrumb">';
  bc += `<a href="${homeRef}">Home</a>`;
  if (group) bc += ` <span>/</span> <span class="bc-group">${escHtml(group.group)}</span>`;
  bc += ` <span>/</span> <span class="bc-current">${escHtml(item.title)}</span>`;
  bc += '</nav>';
  return bc;
}

// ── 7. Metadata panel ─────────────────────────────────────────────────────────
function buildMetaPanel(item, meta, activeRoute) {
  const rawRoute = 'raw/' + item.src.split('/').slice(-2).join('/');
  const rawHref  = relPath(activeRoute, rawRoute);
  let html = '<aside id="meta-panel">\n';
  html += '  <h4>Document Info</h4>\n';
  html += `  <p class="pack-version-label">Portal Pack Version: ${escHtml(PACK_VERSION || VERSION)}</p>\n`;
  html += '  <dl class="meta-dl">\n';
  html += `    <dt>Doc ID</dt><dd><code>${escHtml(item.doc_id)}</code></dd>\n`;
  if (meta.version)      html += `    <dt>Version</dt><dd>${escHtml(meta.version)}</dd>\n`;
  if (meta.owner)        html += `    <dt>Owner</dt><dd>${escHtml(meta.owner)}</dd>\n`;
  if (meta.last_updated) html += `    <dt>Last Updated</dt><dd>${escHtml(meta.last_updated)}</dd>\n`;
  if (meta.review_cycle) html += `    <dt>Review Cycle</dt><dd>${escHtml(meta.review_cycle)}</dd>\n`;
  html += '  </dl>\n';
  html += '  <div class="meta-actions">\n';
  html += `    <a href="${rawHref}" class="btn-raw" target="_blank">&#128196; View raw markdown</a>\n`;
  html += '    <button onclick="window.print()" class="btn-print">&#128424; Print page</button>\n';
  html += '  </div>\n';
  html += '</aside>\n';
  return html;
}

// ── 8. Full doc page HTML wrapper ─────────────────────────────────────────────
function buildPageHtml(item, mdContent) {
  const activeRoute = item.route;
  const meta        = extractFrontMatter(mdContent);
  const bodyHtml    = marked.parse(mdContent);
  const sidebar     = buildSidebar(activeRoute);
  const breadcrumbs = buildBreadcrumbs(item, activeRoute);
  const metaPanel   = buildMetaPanel(item, meta, activeRoute);
  const prefix      = relRoot(activeRoute);   // e.g. '../' for depth-1 routes
  const cssHref     = `${prefix}assets/portal.css`;
  const jsHref      = `${prefix}assets/portal.js`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escHtml(item.title)} | ${escHtml(PORTAL_TITLE)}</title>
  <meta name="description" content="${escHtml(PORTAL_TAGLINE)}" />
  <link rel="stylesheet" href="${cssHref}" />
</head>
<body class="doc-page">
  <div id="layout">
    ${sidebar}
    <div id="main-wrapper">
      <header id="top-bar">
        <button id="sidebar-toggle" aria-label="Toggle sidebar">&#9776;</button>
        <span class="portal-title-bar">${escHtml(PORTAL_TITLE)}</span>
        <span class="version-badge">v${escHtml(VERSION)}</span>
      </header>
      ${breadcrumbs}
      <main id="content">
        <article class="doc-content">
          ${bodyHtml}
        </article>
      </main>
      <footer id="page-footer">
        <p>Portal Pack Version: ${escHtml(PACK_VERSION || VERSION)} | ${escHtml(PORTAL_TITLE)} | Contact: <a href="mailto:security.contact@firsttry.run">security.contact@firsttry.run</a></p>
      </footer>
    </div>
    ${metaPanel}
  </div>
  <script src="${jsHref}"></script>
</body>
</html>`;
}

// ── 9. Build each portal doc page ─────────────────────────────────────────────
console.log('\nRendering portal pages:');
const searchIndex = [];

for (const group of NAV) {
  for (const item of group.items) {
    const mdPath = path.join(REPO_ROOT, item.src);
    if (!fs.existsSync(mdPath)) {
      console.error(`  FAIL: markdown source not found: ${mdPath}`);
      process.exit(1);
    }
    const mdContent = fs.readFileSync(mdPath, 'utf8');
    const outPath   = path.join(SITE, item.route);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    const html = buildPageHtml(item, mdContent);
    fs.writeFileSync(outPath, html, 'utf8');
    console.log(`  OK  ${item.doc_id}  site/${item.route}`);

    // Build search index entry
    const headings  = [...mdContent.matchAll(/^#{2,3}\s+(.+)$/gm)].map(m => m[1].replace(/\*\*/g, '').trim());
    const bodyText  = mdContent.replace(/^#.+$/gm, '').replace(/[#*`[\]]/g, ' ').replace(/\s+/g, ' ').trim();
    searchIndex.push({
      title:   item.title,
      route:   item.route,
      doc_id:  item.doc_id,
      group:   group.group,
      headings,
      excerpt: bodyText.slice(0, 220),
    });
  }
}

// ── 10. Search index ──────────────────────────────────────────────────────────
const siPath = path.join(SITE, 'assets', 'search_index.json');
fs.writeFileSync(siPath, JSON.stringify(searchIndex, null, 2), 'utf8');
console.log(`\n  wrote site/assets/search_index.json (${searchIndex.length} entries)`);

// ── 11. portal.css ────────────────────────────────────────────────────────────
const CSS_CONTENT = `/* portal.css — ${PORTAL_TITLE} | F100 Trust Portal v${VERSION} */
:root {
  --brand:        #0052cc;
  --brand-dark:   #003d99;
  --brand-light:  #e3f0ff;
  --text:         #172b4d;
  --muted:        #5e6c84;
  --bg:           #f4f5f7;
  --white:        #ffffff;
  --border:       #dfe1e6;
  --success:      #00875a;
  --warn:         #ff8b00;
  --code-bg:      #1e1e1e;
  --code-text:    #d4d4d4;
  --sidebar-w:    260px;
  --meta-w:       240px;
  --topbar-h:     52px;
  --sans:         -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --mono:         "JetBrains Mono", "Fira Code", Consolas, monospace;
  --radius:       6px;
  --shadow-sm:    0 1px 3px rgba(0,0,0,.10);
  --shadow-md:    0 4px 12px rgba(0,0,0,.13);
  --transition:   0.16s ease;
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{font-size:16px;-webkit-text-size-adjust:100%}
body{font-family:var(--sans);color:var(--text);background:var(--bg);line-height:1.65}
a{color:var(--brand);text-decoration:none}
a:hover{text-decoration:underline;color:var(--brand-dark)}

/* Layout */
#layout{display:grid;grid-template-columns:var(--sidebar-w) 1fr var(--meta-w);grid-template-areas:"sidebar main meta";min-height:100vh}

/* Sidebar */
#sidebar-nav{grid-area:sidebar;background:var(--white);border-right:1px solid var(--border);position:sticky;top:0;height:100vh;overflow-y:auto;overflow-x:hidden;display:flex;flex-direction:column;z-index:100}
.sidebar-header{padding:16px 16px 12px;border-bottom:1px solid var(--border);flex-shrink:0}
.portal-home-link{font-weight:700;font-size:.88rem;color:var(--brand);line-height:1.4;display:block}
.sidebar-search{padding:10px 12px;border-bottom:1px solid var(--border);flex-shrink:0}
.sidebar-search input{width:100%;padding:6px 10px;font-size:.82rem;border:1px solid var(--border);border-radius:var(--radius);background:var(--bg);color:var(--text);font-family:var(--sans);outline:none;transition:border-color var(--transition)}
.sidebar-search input:focus{border-color:var(--brand)}
.sidebar-groups{list-style:none;flex:1;overflow-y:auto;padding:8px 0 16px}
.sidebar-group{margin-bottom:4px}
.sidebar-group-label{display:block;padding:8px 14px 4px;font-size:.69rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.sidebar-items{list-style:none}
.sidebar-item a{display:block;padding:5px 14px 5px 18px;font-size:.82rem;color:var(--text);border-left:3px solid transparent;transition:background var(--transition),color var(--transition),border-color var(--transition);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sidebar-item a:hover{background:var(--brand-light);color:var(--brand);text-decoration:none;border-left-color:var(--brand-light)}
.sidebar-item.active a{background:var(--brand-light);color:var(--brand);font-weight:600;border-left-color:var(--brand)}
.sidebar-item.search-hidden{display:none}

/* Main wrapper */
#main-wrapper{grid-area:main;display:flex;flex-direction:column;min-height:100vh;min-width:0}

/* Top bar */
#top-bar{height:var(--topbar-h);background:var(--brand);color:white;display:flex;align-items:center;padding:0 20px;gap:12px;flex-shrink:0;position:sticky;top:0;z-index:99;box-shadow:var(--shadow-sm)}
#sidebar-toggle{display:none;background:none;border:none;color:white;font-size:1.2rem;cursor:pointer;padding:4px 6px}
.portal-title-bar{font-weight:600;font-size:.95rem;flex:1}
.version-badge{background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.35);border-radius:20px;padding:2px 10px;font-size:.72rem;font-weight:600;letter-spacing:.04em}

/* Breadcrumbs */
.breadcrumbs{padding:10px 24px;font-size:.78rem;color:var(--muted);border-bottom:1px solid var(--border);background:var(--white)}
.breadcrumbs a{color:var(--brand)}
.breadcrumbs span{margin:0 5px}
.bc-current{color:var(--text);font-weight:500}

/* Content */
#content{flex:1;padding:28px 32px 40px;background:var(--white);max-width:900px}
.doc-content{line-height:1.72}
.doc-content h1{font-size:1.6rem;margin-bottom:8px;color:var(--brand-dark)}
.doc-content h2{font-size:1.22rem;margin:28px 0 10px;padding-bottom:6px;border-bottom:1px solid var(--border);color:var(--text)}
.doc-content h3{font-size:1.04rem;margin:22px 0 8px;color:var(--text)}
.doc-content h4{font-size:.95rem;margin:16px 0 6px;font-weight:700}
.doc-content h5,.doc-content h6{font-size:.9rem;margin:12px 0 4px}
.doc-content p{margin:10px 0}
.doc-content ul,.doc-content ol{margin:8px 0 8px 22px}
.doc-content li{margin:4px 0}
.doc-content li>ul,.doc-content li>ol{margin-top:4px}
.doc-content strong{font-weight:700}
.doc-content em{font-style:italic}
.doc-content code{font-family:var(--mono);font-size:.83em;background:rgba(9,30,66,.08);border-radius:3px;padding:1px 5px;color:#c0392b}
.doc-content pre{background:var(--code-bg);border-radius:var(--radius);padding:16px 20px;overflow-x:auto;margin:16px 0;box-shadow:var(--shadow-sm)}
.doc-content pre code{background:none;color:var(--code-text);font-size:.82rem;padding:0;border-radius:0}
.doc-content table{border-collapse:collapse;width:100%;margin:16px 0;font-size:.88rem;box-shadow:var(--shadow-sm);border-radius:var(--radius);overflow:hidden}
.doc-content th{background:var(--brand);color:white;font-weight:600;padding:10px 12px;text-align:left}
.doc-content td{padding:9px 12px;border-bottom:1px solid var(--border);vertical-align:top}
.doc-content tr:last-child td{border-bottom:none}
.doc-content tr:nth-child(even) td{background:#f8f9fb}
.doc-content blockquote{border-left:4px solid var(--brand);background:var(--brand-light);margin:14px 0;padding:10px 16px;border-radius:0 var(--radius) var(--radius) 0;font-style:italic;color:var(--muted)}
.doc-content hr{border:none;border-top:1px solid var(--border);margin:24px 0}
.doc-content a{color:var(--brand)}
.doc-content a:hover{text-decoration:underline}
.note{background:#e3f0ff;border-left:4px solid #4c9aff;padding:10px 14px;border-radius:0 var(--radius) var(--radius) 0;margin:14px 0}
.warn{background:#fff3cd;border-left:4px solid #ffc400;padding:10px 14px;border-radius:0 var(--radius) var(--radius) 0;margin:14px 0}
.verified{background:#e3fcef;border-left:4px solid #00875a;padding:10px 14px;border-radius:0 var(--radius) var(--radius) 0;margin:14px 0}

/* Meta panel */
#meta-panel{grid-area:meta;background:var(--white);border-left:1px solid var(--border);padding:80px 16px 20px;position:sticky;top:0;height:100vh;overflow-y:auto;font-size:.82rem}
#meta-panel h4{font-size:.7rem;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);font-weight:700;margin-bottom:10px}
.meta-dl dt{font-size:.69rem;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-top:10px;font-weight:600}
.meta-dl dd{color:var(--text);margin-left:0;font-size:.82rem}
.meta-dl dd code{font-size:.79rem}
.meta-actions{margin-top:20px;display:flex;flex-direction:column;gap:8px}
.btn-raw,.btn-print{display:inline-block;padding:7px 12px;border-radius:var(--radius);font-size:.8rem;font-weight:500;cursor:pointer;text-align:center;font-family:var(--sans);transition:background var(--transition)}
.btn-raw{background:var(--bg);border:1px solid var(--border);color:var(--brand);text-decoration:none}
.btn-raw:hover{background:var(--brand-light);text-decoration:none}
.btn-print{background:var(--bg);border:1px solid var(--border);color:var(--text)}
.btn-print:hover{background:#ebebeb}

/* Search overlay */
#search-overlay{display:none;position:fixed;top:var(--topbar-h);left:var(--sidebar-w);right:var(--meta-w);background:white;border:1px solid var(--border);border-top:none;box-shadow:var(--shadow-md);max-height:420px;overflow-y:auto;z-index:200;padding:8px 0}
#search-overlay.visible{display:block}
.sr-item{padding:10px 20px;cursor:pointer;border-bottom:1px solid var(--border);font-size:.88rem}
.sr-item:hover{background:var(--brand-light)}
.sr-title{font-weight:600;color:var(--brand)}
.sr-group{font-size:.72rem;color:var(--muted)}
.sr-excerpt{font-size:.79rem;color:var(--muted);margin-top:2px}

/* Footer */
#page-footer{border-top:1px solid var(--border);padding:14px 32px;font-size:.76rem;color:var(--muted);background:var(--white)}

/* Mobile ≤1100px: hide meta panel */
@media(max-width:1100px){
  #layout{grid-template-columns:var(--sidebar-w) 1fr;grid-template-areas:"sidebar main"}
  #meta-panel{display:none}
  #search-overlay{right:0}
}
/* Mobile ≤768px: off-canvas sidebar */
@media(max-width:768px){
  #layout{grid-template-columns:1fr;grid-template-areas:"main"}
  #sidebar-nav{position:fixed;left:-100%;top:0;width:82vw;max-width:300px;transition:left var(--transition);z-index:1000;box-shadow:var(--shadow-md)}
  #sidebar-nav.open{left:0}
  #sidebar-toggle{display:block}
  #search-overlay{left:0;right:0}
  #content{padding:16px}
}
/* Print */
@media print{
  #sidebar-nav,#meta-panel,#top-bar,.breadcrumbs,#page-footer,.meta-actions,#sidebar-toggle,#search-overlay{display:none!important}
  #layout{display:block}
  #main-wrapper{min-height:unset}
  #content{padding:0;max-width:100%;box-shadow:none}
  .doc-content a{color:var(--text);text-decoration:underline}
  .doc-content pre{border:1px solid #ccc;page-break-inside:avoid}
  .doc-content table{page-break-inside:avoid}
  body{font-size:11pt}
  .doc-content h1{font-size:18pt}
  .doc-content h2{font-size:14pt}
  .doc-content h3{font-size:12pt}
}

/* Index page overrides */
.index-hero{background:linear-gradient(135deg,var(--brand) 0%,var(--brand-dark) 100%);color:white;padding:56px 40px;text-align:center}
.index-hero h1{font-size:2rem;font-weight:800;margin-bottom:10px}
.index-hero p{font-size:1.05rem;opacity:.9;max-width:640px;margin:0 auto}
.index-body{max-width:1040px;margin:0 auto;padding:36px 24px}
.badge-row{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0}
.badge{background:var(--brand-light);border:1px solid #b2d0ff;border-radius:20px;padding:4px 12px;font-size:.78rem;font-weight:600;color:var(--brand-dark)}
.badge.green{background:#e3fcef;border-color:#79e2b2;color:#006644}
.badge.amber{background:#fffae6;border-color:#ffe380;color:#7a5900}
.quick-links-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:14px;margin:20px 0}
.quick-card{background:var(--white);border:1px solid var(--border);border-radius:var(--radius);padding:16px;text-align:center;box-shadow:var(--shadow-sm);transition:box-shadow var(--transition),border-color var(--transition);display:flex;flex-direction:column;align-items:center;gap:8px;color:var(--text)}
.quick-card:hover{box-shadow:var(--shadow-md);border-color:var(--brand);text-decoration:none}
.quick-card .ci{font-size:1.7rem}
.quick-card .ct{font-size:.84rem;font-weight:600}
.quick-card .cd{font-size:.7rem;color:var(--muted)}
.nav-section{margin:32px 0}
.nav-section h2{font-size:1.12rem;color:var(--brand);margin-bottom:14px;border-bottom:2px solid var(--brand-light);padding-bottom:6px}
.doc-grid{list-style:none;display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px}
.doc-grid li a{display:flex;flex-direction:column;background:var(--white);border:1px solid var(--border);border-radius:var(--radius);padding:10px 14px;font-size:.87rem;color:var(--text);transition:border-color var(--transition),box-shadow var(--transition)}
.doc-grid li a:hover{border-color:var(--brand);box-shadow:var(--shadow-sm);text-decoration:none}
.doc-grid li a .di{font-size:.69rem;color:var(--muted);margin-bottom:2px}
.doc-grid li a .dt{font-weight:500}
.contact-block{background:var(--white);border:1px solid var(--border);border-radius:var(--radius);padding:20px;margin:20px 0;box-shadow:var(--shadow-sm)}
.contact-block h3{margin-bottom:10px;font-size:1rem}
.contact-block ul{list-style:none;margin:0}
.contact-block li{padding:4px 0;font-size:.9rem}
.disclaimer-list{list-style:none;display:flex;flex-direction:column;gap:6px}
.disclaimer-list li{font-size:.88rem;color:var(--muted);padding-left:14px;position:relative}
.disclaimer-list li::before{content:"\\2014";position:absolute;left:0;color:var(--muted)}
`;

fs.writeFileSync(path.join(SITE, 'assets', 'portal.css'), CSS_CONTENT, 'utf8');
console.log('  wrote site/assets/portal.css');

// ── 12. portal.js ─────────────────────────────────────────────────────────────
const JS_CONTENT = `/* portal.js — ${escHtml(PORTAL_TITLE)} | F100 v${VERSION} */
(function(){
'use strict';

// Sidebar toggle (mobile off-canvas)
var sidebar=document.getElementById('sidebar-nav');
var toggleBtn=document.getElementById('sidebar-toggle');
var ov=document.createElement('div');
ov.id='sidebar-overlay';
ov.style.cssText='display:none;position:fixed;inset:0;background:rgba(0,0,0,.42);z-index:999;';
document.body.appendChild(ov);
if(toggleBtn&&sidebar){
  toggleBtn.addEventListener('click',function(){
    sidebar.classList.toggle('open');
    ov.style.display=sidebar.classList.contains('open')?'block':'none';
  });
  ov.addEventListener('click',function(){
    sidebar.classList.remove('open');
    ov.style.display='none';
  });
}

// Sidebar inline filter
var si=document.getElementById('sidebar-search-input');
if(si){
  si.addEventListener('input',function(){
    var q=this.value.toLowerCase().trim();
    var items=document.querySelectorAll('.sidebar-item');
    var groups=document.querySelectorAll('.sidebar-group');
    items.forEach(function(item){
      var t=item.dataset.searchTitle||'';
      item.classList.toggle('search-hidden',!!(q&&!t.includes(q)));
    });
    groups.forEach(function(g){
      var vis=g.querySelectorAll('.sidebar-item:not(.search-hidden)');
      g.style.display=vis.length?'':'none';
    });
  });
}

// Full-text search overlay from search_index.json
var searchIdx=null;
var so=null;

function getSo(){
  if(!so){
    so=document.createElement('div');
    so.id='search-overlay';
    document.body.appendChild(so);
  }
  return so;
}

function getRoot(){
  var l=document.querySelectorAll('link[rel="stylesheet"]');
  for(var i=0;i<l.length;i++){
    var h=l[i].getAttribute('href');
    if(h&&h.includes('assets/portal.css'))return h.replace('assets/portal.css','');
  }
  return '';
}

function loadIdx(cb){
  if(searchIdx){cb(searchIdx);return;}
  var r=getRoot();
  var x=new XMLHttpRequest();
  x.open('GET',r+'assets/search_index.json',true);
  x.onload=function(){
    if(x.status===200){try{searchIdx=JSON.parse(x.responseText);}catch(e){searchIdx=[];}}
    else searchIdx=[];
    cb(searchIdx);
  };
  x.onerror=function(){searchIdx=[];cb(searchIdx);};
  x.send();
}

function search(q,idx){
  if(!q)return[];
  var ql=q.toLowerCase();
  return idx.filter(function(e){
    return(e.title.toLowerCase().includes(ql)||
      (e.excerpt&&e.excerpt.toLowerCase().includes(ql))||
      (e.headings&&e.headings.some(function(h){return h.toLowerCase().includes(ql);}))||
      (e.doc_id&&e.doc_id.toLowerCase().includes(ql)));
  }).slice(0,12);
}

function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

function renderResults(rs,q){
  var r=getRoot();
  var el=getSo();
  if(!rs.length){
    el.innerHTML='<div class="sr-item" style="color:#5e6c84">No results for "'+esc(q)+'"</div>';
  }else{
    el.innerHTML=rs.map(function(e){
      return'<div class="sr-item" onclick="location.href=\\''+r+e.route+'\\'">'
        +'<div class="sr-title">'+esc(e.title)+'</div>'
        +'<div class="sr-group">'+esc(e.group)+' &middot; '+esc(e.doc_id)+'</div>'
        +(e.excerpt?'<div class="sr-excerpt">'+esc(e.excerpt.slice(0,130))+'&hellip;</div>':'')
        +'</div>';
    }).join('');
  }
  el.classList.add('visible');
}

if(si){
  var timer=null;
  si.addEventListener('input',function(){
    var q=this.value.trim();
    if(timer)clearTimeout(timer);
    if(!q){var el=getSo();if(el)el.classList.remove('visible');return;}
    timer=setTimeout(function(){loadIdx(function(idx){renderResults(search(q,idx),q);});},220);
  });
  document.addEventListener('click',function(e){
    var el=getSo();
    if(el&&!el.contains(e.target)&&e.target!==si)el.classList.remove('visible');
  });
  si.addEventListener('keydown',function(e){
    if(e.key==='Escape'){
      var el=getSo();if(el)el.classList.remove('visible');
      this.value='';
      document.querySelectorAll('.sidebar-item').forEach(function(i){i.classList.remove('search-hidden');});
      document.querySelectorAll('.sidebar-group').forEach(function(g){g.style.display='';});
    }
  });
}

})();
`;

fs.writeFileSync(path.join(SITE, 'assets', 'portal.js'), JS_CONTENT, 'utf8');
console.log('  wrote site/assets/portal.js');

// ── 13. index.html — executive landing page ───────────────────────────────────
// Quick-link cards: 5 key docs
const QUICK_LINKS = [
  { icon: '&#128196;', route: 'procurement/enterprise-pack-index.html',  id: 'FT-PROC-001', label: 'Enterprise Pack Index' },
  { icon: '&#128274;', route: 'trust/security-overview.html',            id: 'FT-TRUST-001', label: 'Security Overview' },
  { icon: '&#128221;', route: 'procurement/security-questionnaire.html', id: 'FT-PROC-002', label: 'Security Questionnaire' },
  { icon: '&#9745;',   route: 'procurement/control-mapping-matrix.html', id: 'FT-PROC-003', label: 'Control Mapping' },
  { icon: '&#128202;', route: 'evidence/retention-policy.html',          id: 'FT-EVID-001', label: 'Evidence Index' },
];

const quickCardsHtml = QUICK_LINKS.map(l =>
  `<a href="${escHtml(l.route)}" class="quick-card"><span class="ci">${l.icon}</span><span class="ct">${escHtml(l.label)}</span><span class="cd">${escHtml(l.id)}</span></a>`
).join('\n        ');

// Nav section grids (skip Overview group — already shown in quick links)
const navSectionsHtml = NAV.filter(g => g.group !== 'Overview').map(group => {
  const items = group.items.map(item =>
    `<li><a href="${escHtml(item.route)}"><span class="di">${escHtml(item.doc_id)}</span><span class="dt">${escHtml(item.title)}</span></a></li>`
  ).join('\n          ');
  return `<div class="nav-section">
      <h2>${escHtml(group.group)}</h2>
      <ul class="doc-grid">
        ${items}
      </ul>
    </div>`;
}).join('\n    ');

const INDEX_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escHtml(PORTAL_TITLE)}</title>
  <meta name="description" content="${escHtml(PORTAL_TAGLINE)}" />
  <link rel="stylesheet" href="assets/portal.css" />
</head>
<body>
  <div class="index-hero">
    <h1>${escHtml(PORTAL_TITLE)}</h1>
    <p>${escHtml(PORTAL_TAGLINE)}</p>
  </div>
  <div class="index-body">
    <div class="badge-row">
      <span class="badge">No certifications claimed</span>
      <span class="badge green">Read-only Forge app</span>
      <span class="badge green">Fail-closed validation</span>
      <span class="badge amber">Portal Pack Version: ${escHtml(PACK_VERSION || VERSION)} | ${escHtml(TODAY)} UTC</span>
    </div>

    <div class="nav-section">
      <h2>Start Here</h2>
      <div class="quick-links-grid">
        ${quickCardsHtml}
      </div>
    </div>

    ${navSectionsHtml}

    <div class="contact-block">
      <h3>Contact</h3>
      <ul>
        <li>General enquiries: <a href="mailto:contact@firsttry.run">contact@firsttry.run</a></li>
        <li>Support: <a href="mailto:support@firsttry.run">support@firsttry.run</a></li>
        <li>Security disclosures: <a href="mailto:security.contact@firsttry.run">security.contact@firsttry.run</a></li>
        <li>Privacy requests: <a href="mailto:privacy@firsttry.run">privacy@firsttry.run</a></li>
        <li>Emergency (P1 incident): <a href="mailto:emergency@firsttry.run">emergency@firsttry.run</a></li>
      </ul>
    </div>

    <div class="nav-section">
      <h2>Disclaimers</h2>
      <ul class="disclaimer-list">
        <li>No certifications claimed &mdash; documentation and evidence artifacts only</li>
        <li>Zero runtime changes &mdash; no app code, manifest scopes, or egress modifications</li>
        <li>Platform dependent &mdash; Atlassian Forge provides data residency, encryption, and uptime SLA</li>
        <li>Fail-closed design &mdash; all CI validation gates exit non-zero on any error</li>
      </ul>
    </div>

    <p style="font-size:.78rem;color:var(--muted);margin-top:32px">
      Repository: <a href="https://github.com/Firsttry-Solutions/Firsttry">Firsttry-Solutions/Firsttry</a>
      &nbsp;|&nbsp; Portal Pack Version: ${escHtml(PACK_VERSION || VERSION)} &nbsp;|&nbsp; Validated: ${escHtml(TODAY)} UTC
    </p>
  </div>
  <script src="assets/portal.js"></script>
</body>
</html>`;

const indexPath = path.join(SITE, 'index.html');
fs.writeFileSync(indexPath, INDEX_HTML, 'utf8');
console.log('  wrote site/index.html');

// ── 14. Summary ────────────────────────────────────────────────────────────────
function walkDir(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walkDir(full, out);
    else out.push(full);
  }
  return out;
}
const allFiles = walkDir(SITE).sort();
console.log(`\nsite/ contains ${allFiles.length} files:`);
allFiles.forEach(f => console.log(`  ${f}`));
console.log(`\nbuild_trust_portal.mjs DONE — v${VERSION}`);
