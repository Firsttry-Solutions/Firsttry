#!/usr/bin/env node
// build_pages_site.mjs — Manifest-driven Pages site builder
//
// Runs from repo root. Reads atlassian/forge-app/tools/pages_pack_manifest.json,
// copies all publish_dirs into site/, and generates site/index.html.
//
// Usage: node atlassian/forge-app/tools/build_pages_site.mjs
//
'use strict';

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const MANIFEST_PATH = 'atlassian/forge-app/tools/pages_pack_manifest.json';
const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));

const VERSION = manifest.version;
const PUBLISH_ROOT = manifest.publish_root; // 'site'
const TODAY = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

console.log(`build_pages_site.mjs — enterprise pack v${VERSION}`);

// ── 1. Clean and recreate site/ ───────────────────────────────────────────────
execSync('rm -rf site _site');
fs.mkdirSync(PUBLISH_ROOT, { recursive: true });

// ── 2. Copy each publish_dir to site/<basename> ───────────────────────────────
for (const srcDir of manifest.publish_dirs) {
  const destDir = path.join(PUBLISH_ROOT, path.basename(srcDir));
  fs.mkdirSync(destDir, { recursive: true });
  execSync(`cp -r ${srcDir}/. ${destDir}/`);
  console.log(`  copied ${srcDir}/ → ${destDir}/`);
}

// ── 3. Generate site/index.html ───────────────────────────────────────────────
const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>FirstTry - Enterprise Security Documentation</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 1000px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
        h1, h2 { color: #0052cc; }
        .container { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .nav-section { margin: 30px 0; }
        ul { list-style: none; padding: 0; }
        li { padding: 6px 0; }
        a { color: #0052cc; text-decoration: none; }
        a:hover { text-decoration: underline; }
        .badge { background: #e3f2fd; border-radius: 4px; padding: 2px 8px; font-size: 0.85em; }
    </style>
</head>
<body>
    <div class="container">
        <h1>FirstTry - Enterprise Security Documentation</h1>
        <p><strong>Version:</strong> ${VERSION} | <strong>Last Updated:</strong> ${TODAY} UTC</p>
        <p>Enterprise security and compliance documentation for Atlassian Marketplace diligence and procurement reviews.</p>
        <p><span class="badge">No certifications claimed</span> &nbsp; <span class="badge">Read-only Forge app</span> &nbsp; <span class="badge">Fail-closed validation</span></p>

        <div class="nav-section">
            <h2>Getting Started</h2>
            <ul>
                <li><a href="procurement/ENTERPRISE_SECURITY_PACK_INDEX.md">Enterprise Security Pack Index</a></li>
                <li><a href="trust/SECURITY_OVERVIEW.md">Security Overview</a></li>
            </ul>
        </div>

        <div class="nav-section">
            <h2>Trust Center</h2>
            <ul>
                <li><a href="trust/SECURITY_OVERVIEW.md">Security Overview</a></li>
                <li><a href="trust/SECURITY_CONTACT.md">Security Contact</a></li>
                <li><a href="trust/PRIVACY_POLICY.md">Privacy Policy</a></li>
                <li><a href="trust/SUBPROCESSORS.md">Subprocessors</a></li>
                <li><a href="trust/TERMS_OF_SERVICE.md">Terms of Service</a></li>
                <li><a href="trust/THREAT_MODEL.md">Threat Model (STRIDE)</a></li>
                <li><a href="trust/RESOLVER_INVENTORY.md">Resolver Inventory (0 mutations)</a></li>
                <li><a href="trust/VULNERABILITY_DISCLOSURE_POLICY.md">Vulnerability Disclosure Policy</a></li>
                <li><a href="trust/DATA_FLOW.md">Data Flow</a></li>
                <li><a href="trust/DATA_CLASSIFICATION_AND_PII.md">Data Classification and PII</a></li>
                <li><a href="trust/UNINSTALL_DELETION.md">Uninstall and Deletion</a></li>
                <li><a href="trust/CLAIMS_REGISTER.md">Claims Register (Truth Audit)</a></li>
            </ul>
        </div>

        <div class="nav-section">
            <h2>Operations</h2>
            <ul>
                <li><a href="operations/INCIDENT_RESPONSE_PLAN.md">Incident Response Plan</a></li>
                <li><a href="operations/SLA.md">SLA (support response times only - no uptime guarantee)</a></li>
                <li><a href="operations/SUPPORT_POLICY.md">Support Policy</a></li>
                <li><a href="operations/BCP_DRP.md">Business Continuity and Disaster Recovery</a></li>
                <li><a href="operations/SECURE_SDLC_POLICY.md">Secure SDLC Policy</a></li>
                <li><a href="operations/CI_CD_EVIDENCE.md">CI/CD Evidence</a></li>
                <li><a href="operations/ACCESS_CONTROL_POLICY.md">Access Control Policy</a></li>
                <li><a href="operations/CHANGE_MANAGEMENT_POLICY.md">Change Management Policy</a></li>
                <li><a href="operations/RBAC_MATRIX.md">RBAC Matrix</a></li>
            </ul>
        </div>

        <div class="nav-section">
            <h2>Procurement and Compliance</h2>
            <ul>
                <li><a href="procurement/ENTERPRISE_SECURITY_PACK_INDEX.md">Enterprise Security Pack Index</a></li>
                <li><a href="procurement/SECURITY_QUESTIONNAIRE_MASTER.md">Security Questionnaire</a></li>
                <li><a href="procurement/CONTROL_MAPPING_MATRIX.md">Control Mapping Matrix</a></li>
            </ul>
        </div>

        <div class="nav-section">
            <h2>Evidence</h2>
            <ul>
                <li><a href="evidence/RETENTION_POLICY.md">Retention Policy</a></li>
            </ul>
        </div>

        <div class="nav-section">
            <h2>Contact</h2>
            <ul>
                <li>General enquiries: contact@firsttry.run</li>
                <li>Support: support@firsttry.run</li>
                <li>Security disclosures: security.contact@firsttry.run</li>
                <li>Privacy requests: privacy@firsttry.run</li>
                <li>Emergency (P1 incident): emergency@firsttry.run</li>
            </ul>
        </div>

        <div class="nav-section">
            <h2>Disclaimers</h2>
            <ul>
                <li>No certifications claimed - documentation and evidence artifacts only</li>
                <li>Zero runtime changes - no app code, manifest scopes, or egress modifications</li>
                <li>Platform dependent - Atlassian Forge provides data residency, encryption, and uptime</li>
                <li>Fail-closed design - all validation gates exit non-zero on any error</li>
            </ul>
        </div>

        <hr>
        <p>Repository: <a href="https://github.com/Firsttry-Solutions/Firsttry">Firsttry-Solutions/Firsttry</a> | Validated: ${TODAY} UTC</p>
    </div>
</body>
</html>
`;

const indexPath = path.join(PUBLISH_ROOT, 'index.html');
fs.writeFileSync(indexPath, html, 'utf8');
console.log(`  generated ${indexPath} (v${VERSION}, ${TODAY})`);

// ── 4. Summary ────────────────────────────────────────────────────────────────
const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else files.push(full);
  }
}
walk(PUBLISH_ROOT);
files.sort();
console.log(`\nsite/ contains ${files.length} files:`);
files.forEach(f => console.log(`  ${f}`));
console.log(`\nbuild_pages_site.mjs DONE — v${VERSION}`);
