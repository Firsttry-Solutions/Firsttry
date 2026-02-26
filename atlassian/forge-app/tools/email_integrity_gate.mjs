#!/usr/bin/env node
/**
 * Email Integrity Gate - Enterprise Docs Only (v4.3.0)
 * Node v20 ESM — No external dependencies.
 *
 * Enforces:
 * 1. Only approved emails appear (from tools/email_allowlist.txt)
 * 2. No placeholder patterns (example.com, @firsttry.app, [Your Jurisdiction], TBD, TODO)
 * 3. emergency@firsttry.run is RESTRICTED to specific documents only
 * 4. Required emails MUST appear in specific documents
 *
 * Scans ONLY enterprise docs:
 *   atlassian/forge-app/docs/trust/**
 *   atlassian/forge-app/docs/operations/**
 *   atlassian/forge-app/docs/procurement/**
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..', '..');

// Load allowlist
const allowlistPath = path.join(__dirname, 'email_allowlist.txt');
const allowlist = new Set(
  fs.readFileSync(allowlistPath, 'utf-8')
    .split('\n').map(e => e.trim()).filter(e => e)
);

// Email regex
const emailRegex = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

// Placeholder patterns that must NEVER appear
const PLACEHOLDER_PATTERNS = [
  'example.com', 'example.org', 'yourcompany', 'placeholder',
  '@firsttry.app', '[Your Jurisdiction]', 'TBD@', '@example.'
];
// Full-word forbidden tokens (case-insensitive, not inside URLs or code)
const PLACEHOLDER_TOKENS = ['\\bTBD\\b', '\\bTODO\\b'];

// RESTRICTION: emergency@firsttry.run ONLY allowed in these docs (repo-root relative)
const EMERGENCY_ALLOWED_DOCS = new Set([
  'atlassian/forge-app/docs/operations/INCIDENT_RESPONSE_PLAN.md',
  'atlassian/forge-app/docs/trust/SECURITY_CONTACT.md',
  'atlassian/forge-app/docs/operations/BCP_DRP.md'
]);

// REQUIRED PRESENCE: these emails MUST appear in these docs
const REQUIRED_PRESENCE = {
  'security.contact@firsttry.run': [
    'atlassian/forge-app/docs/trust/SECURITY_CONTACT.md',
    'atlassian/forge-app/docs/trust/VULNERABILITY_DISCLOSURE_POLICY.md',
    'atlassian/forge-app/docs/trust/SECURITY_TXT.md',
    'atlassian/forge-app/docs/procurement/ENTERPRISE_SECURITY_PACK_INDEX.md'
  ],
  'support@firsttry.run': [
    'atlassian/forge-app/docs/operations/SUPPORT_POLICY.md',
    'atlassian/forge-app/docs/operations/SLA.md'
  ],
  'privacy@firsttry.run': [
    'atlassian/forge-app/docs/trust/PRIVACY_POLICY.md',
    'atlassian/forge-app/docs/trust/DATA_CLASSIFICATION_AND_PII.md',
    'atlassian/forge-app/docs/trust/UNINSTALL_DELETION.md',
    'atlassian/forge-app/docs/trust/SUBPROCESSORS.md'
  ],
  'contact@firsttry.run': [
    'atlassian/forge-app/docs/trust/TERMS_OF_SERVICE.md',
    'atlassian/forge-app/docs/procurement/ENTERPRISE_SECURITY_PACK_INDEX.md'
  ],
  'emergency@firsttry.run': [
    'atlassian/forge-app/docs/operations/INCIDENT_RESPONSE_PLAN.md',
    'atlassian/forge-app/docs/trust/SECURITY_CONTACT.md'
  ]
};

const errors = [];
const fileEmails = new Map(); // relPath -> Set<email>

function findMd(dir, results = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const fp = path.join(dir, e.name);
    if (e.isDirectory()) findMd(fp, results);
    else if (e.isFile() && e.name.endsWith('.md')) results.push(fp);
  }
  return results;
}

function scanFile(abs, rel) {
  if (!fs.existsSync(abs)) return;
  const content = fs.readFileSync(abs, 'utf-8');

  // Check literal placeholder strings
  for (const p of PLACEHOLDER_PATTERNS) {
    if (content.includes(p)) errors.push(`PLACEHOLDER [${rel}]: Found pattern "${p}"`);
  }
  // Check whole-word placeholder tokens (TBD, TODO) — skip lines that are code fences or URLs
  for (const tok of PLACEHOLDER_TOKENS) {
    const re = new RegExp(tok, 'i');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('```') || trimmed.startsWith('//') || trimmed.startsWith('#!')) continue;
      if (re.test(line) && !line.includes('http')) {
        errors.push(`PLACEHOLDER [${rel}]: Found token "${tok.replace(/\\b/g, '')}" in: ${trimmed.slice(0, 80)}`);
        break; // one error per file per token
      }
    }
  }

  // Extract emails
  const found = new Set([...content.matchAll(emailRegex)].map(m => m[0]));
  fileEmails.set(rel, found);

  // Allowlist check
  for (const email of found) {
    if (!allowlist.has(email)) errors.push(`DISALLOWED_EMAIL [${rel}]: "${email}" not in approved allowlist`);
  }

  // emergency@ restriction
  if (found.has('emergency@firsttry.run') && !EMERGENCY_ALLOWED_DOCS.has(rel)) {
    errors.push(`ROUTING_RESTRICTION [${rel}]: emergency@firsttry.run not allowed here`);
  }
}

// Build file list — scan ONLY enterprise docs dirs
const allFiles = [];
for (const dir of [
  path.join(repoRoot, 'atlassian/forge-app/docs/trust'),
  path.join(repoRoot, 'atlassian/forge-app/docs/operations'),
  path.join(repoRoot, 'atlassian/forge-app/docs/procurement')
]) {
  if (fs.existsSync(dir)) allFiles.push(...findMd(dir).map(fp => ({ abs: fp, rel: path.relative(repoRoot, fp) })));
}

console.log('🔍 Email Integrity Gate');
console.log('═'.repeat(50));
console.log(`\nAllowlist (${allowlist.size} approved): ${[...allowlist].sort().join(', ')}`);
console.log(`\nScanning ${allFiles.length} enterprise docs...`);

for (const { abs, rel } of allFiles) scanFile(abs, rel);

// Required presence checks
for (const [email, required] of Object.entries(REQUIRED_PRESENCE)) {
  for (const doc of required) {
    const found = fileEmails.get(doc);
    if (found === undefined) {
      const absDoc = path.join(repoRoot, doc);
      if (!fs.existsSync(absDoc)) {
        errors.push(`MISSING_REQUIRED_DOC [${doc}]: file does not exist — required to contain ${email}`);
      } else {
        errors.push(`REQUIRED_MISSING [${doc}]: "${email}" must appear in this document`);
      }
      continue;
    }
    if (!found.has(email)) errors.push(`REQUIRED_MISSING [${doc}]: "${email}" must appear in this document`);
  }
}

if (errors.length === 0) {
  console.log('\n✅ ALL CHECKS PASSED');
  console.log('Summary:');
  console.log(`  • Files scanned: ${allFiles.length}`);
  console.log(`  • No disallowed emails detected`);
  console.log(`  • No placeholder patterns found`);
  console.log(`  • emergency@ routing restrictions: OK`);
  console.log(`  • Required email presences: all confirmed`);
  process.exit(0);
} else {
  console.error('\n❌ EMAIL INTEGRITY VIOLATIONS DETECTED');
  console.error('\nErrors (sorted):');
  errors.sort().forEach(e => console.error(`  ${e}`));
  console.error(`\nTotal violations: ${errors.length}`);
  process.exit(1);
}
