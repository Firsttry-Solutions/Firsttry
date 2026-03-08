#!/usr/bin/env node
/**
 * truth_claims_gate.mjs (v4.2.4)
 * Truth Audit validation gate for FirstTry documentation.
 * Node v20 ESM — No external dependencies.
 *
 * Rules:
 * - Parses CLAIMS_REGISTER.md (registry source of truth)
 * - Validates EVIDENCE proofs exist as files (relative to cwd = atlassian/forge-app)
 * - Validates ATLASSIAN proofs start with https://developer.atlassian.com/
 * - Scans ONLY enterprise docs (docs/trust, docs/operations, docs/procurement, docs/README.md)
 * - EXCLUDES docs/trust/CLAIMS_REGISTER.md from banned phrase scanning (meta-doc)
 * - Banned phrase matching is whitespace-normalized (case-insensitive, collapse whitespace, trim)
 * - Fails if banned phrase found but NOT in CLAIMS_REGISTER
 * - Deterministic sorted errors; exit non-zero on any failure
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { resolve, join, relative } from 'path';

// Absolute path of the repo root (atlassian/forge-app is cwd)
const CWD = process.cwd();

const CLAIMS_REGISTER_PATH = join(CWD, 'docs/trust/CLAIMS_REGISTER.md');

// Enterprise docs scan scope
const ENTERPRISE_DIRS = [
  join(CWD, 'docs/trust'),
  join(CWD, 'docs/operations'),
  join(CWD, 'docs/procurement')
];
const EXTRA_FILES = [join(CWD, 'docs/README.md')];

// Exclude CLAIMS_REGISTER from banned phrase scanning (meta-documentation)
const EXCLUDE_FROM_SCAN = new Set([CLAIMS_REGISTER_PATH, join(CWD, 'docs/trust/CLAIMS_REGISTER.md')]);

const BANNED_PHRASES = [
  'no pii',
  'automatically deleted',
  'no subprocessors',
  'guaranteed',
  'certified',
  'compliant',
  'cloud fortified'
];

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Normalize text for matching: lowercase + collapse whitespace + trim */
function norm(s) {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Recursively find all .md files in a directory */
function findMd(dir, results = []) {
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fp = join(dir, entry.name);
    if (entry.isDirectory()) findMd(fp, results);
    else if (entry.isFile() && entry.name.endsWith('.md')) results.push(fp);
  }
  return results;
}

/** Locate the header row + separator in a markdown table, return first data row index */
function findTableStart(lines) {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('|---')) return i + 1; // row after separator
  }
  return -1;
}

/** Parse a markdown table row into cells */
function parseCells(line) {
  return line.split('|').map(c => c.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1);
}

// ─── CLAIMS_REGISTER parsing ────────────────────────────────────────────────

const errors = [];

console.log('🔍 Truth Audit Gate');
console.log('═'.repeat(50));

// 1. Parse CLAIMS_REGISTER.md
console.log('\n1. Parsing CLAIMS_REGISTER.md...');
let claims = [];
try {
  const content = readFileSync(CLAIMS_REGISTER_PATH, 'utf-8');
  const lines = content.split('\n');

  const startIdx = findTableStart(lines);
  if (startIdx === -1) throw new Error('Could not find table separator row containing "|---" in CLAIMS_REGISTER.md');

  // Find header row (one before separator)
  const headerLine = lines[startIdx - 2] || '';
  const expectedCols = ['claimid', 'claimtext', 'scope', 'prooftype', 'proofpointer', 'validationrule', 'owner', 'lastreviewed'];
  const headerCells = parseCells(headerLine).map(h => h.toLowerCase().replace(/\s+/g, ''));
  for (const col of expectedCols) {
    if (!headerCells.some(h => h.includes(col.replace(/\s+/g, '')))) {
      errors.push(`REGISTER_FORMAT: Missing required column "${col}" in CLAIMS_REGISTER.md`);
    }
  }

  // Parse data rows
  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith('|') || line === '') break;
    const cells = parseCells(line);
    if (cells.length < 5) continue;
    claims.push({
      claimId:   cells[0],
      claimText: cells[1],
      scope:     cells[2],
      proofType: cells[3],
      proofPointer: cells[4],
      validationRule: cells[5] || '',
      owner:     cells[6] || '',
      lastReviewed: cells[7] || ''
    });
  }

  console.log(`   ✅ Loaded ${claims.length} claims`);
} catch (err) {
  console.error(`   ❌ Failed to parse CLAIMS_REGISTER.md: ${err.message}`);
  process.exit(1);
}

// 2. Validate EVIDENCE proofs
console.log('\n2. Validating EVIDENCE proofs (file existence)...');
const evidenceClaims = claims.filter(c => c.proofType === 'EVIDENCE');
for (const c of evidenceClaims) {
  const fp = resolve(CWD, c.proofPointer);
  if (!existsSync(fp)) {
    errors.push(`[${c.claimId}] EVIDENCE_MISSING: File not found: ${c.proofPointer}`);
  }
}
const evErrors = errors.filter(e => e.includes('EVIDENCE_MISSING'));
if (evErrors.length === 0) {
  console.log(`   ✅ All ${evidenceClaims.length} EVIDENCE proofs verified`);
} else {
  console.log(`   ❌ ${evErrors.length} EVIDENCE proof(s) missing`);
}

// 3. Validate ATLASSIAN proofs
console.log('\n3. Validating ATLASSIAN proofs (URL format)...');
const atlassianClaims = claims.filter(c => c.proofType === 'ATLASSIAN');
for (const c of atlassianClaims) {
  if (!c.proofPointer.startsWith('https://developer.atlassian.com/')) {
    errors.push(`[${c.claimId}] ATLASSIAN_INVALID: Must start with https://developer.atlassian.com/, got: ${c.proofPointer}`);
  }
}
const atlErrors = errors.filter(e => e.includes('ATLASSIAN_INVALID'));
if (atlErrors.length === 0) {
  console.log(`   ✅ All ${atlassianClaims.length} ATLASSIAN proofs valid`);
} else {
  console.log(`   ❌ ${atlErrors.length} ATLASSIAN proof(s) invalid`);
}

// 4. Scan enterprise docs for banned phrases
console.log('\n4. Scanning enterprise docs for banned phrases...');
console.log(`   Scope: docs/trust, docs/operations, docs/procurement, docs/README.md`);
console.log(`   Excluded from scan: docs/trust/CLAIMS_REGISTER.md (meta-doc)`);

// Collect all enterprise doc files
const allDocFiles = [];
for (const dir of ENTERPRISE_DIRS) findMd(dir, allDocFiles);
for (const fp of EXTRA_FILES) { if (existsSync(fp)) allDocFiles.push(fp); }
const scanFiles = allDocFiles.filter(fp => !EXCLUDE_FROM_SCAN.has(fp));

console.log(`   Files to scan: ${scanFiles.length}`);

// Build normalized claim texts for matching
const normalizedClaims = claims.map(c => ({ ...c, normText: norm(c.claimText) }));

const foundPhrases = {};
for (const fp of scanFiles) {
  const content = norm(readFileSync(fp, 'utf-8'));
  const relPath = relative(CWD, fp);
  for (const phrase of BANNED_PHRASES) {
    const normPhrase = norm(phrase);
    if (content.includes(normPhrase)) {
      if (!foundPhrases[phrase]) foundPhrases[phrase] = [];
      if (!foundPhrases[phrase].includes(relPath)) foundPhrases[phrase].push(relPath);
    }
  }
}

const foundCount = Object.keys(foundPhrases).length;
if (foundCount > 0) {
  console.log(`   ⚠️  Found ${foundCount} banned phrase(s) — checking claims...`);
}

// For each found phrase, check if a claim covers it
for (const [phrase, files] of Object.entries(foundPhrases)) {
  const normPhrase = norm(phrase);
  const covering = normalizedClaims.find(c => c.normText.includes(normPhrase));
  if (!covering) {
    errors.push(
      `UNREGISTERED_PHRASE: "${phrase}" found in [${files.join(', ')}] but no registered claim covers it. ` +
      `Add a claim to CLAIMS_REGISTER.md.`
    );
  }
}

// ─── Final Results ────────────────────────────────────────────────────────

console.log('\n' + '═'.repeat(50));
console.log('Truth Audit Results\n');

if (errors.length === 0) {
  console.log('✅ ALL CHECKS PASSED\n');
  console.log('Summary:');
  console.log(`  • Claims registered: ${claims.length}`);
  console.log(`  • EVIDENCE proofs verified: ${evidenceClaims.length}`);
  console.log(`  • ATLASSIAN proofs validated: ${atlassianClaims.length}`);
  console.log(`  • Banned phrases found: ${foundCount}`);
  console.log(`  • Unregistered phrases: 0`);
  process.exit(0);
} else {
  console.error('❌ VALIDATION FAILED\n');
  console.error('Errors (sorted):');
  errors.sort().forEach(e => console.error(`  ${e}`));
  console.error(`\nTotal errors: ${errors.length}`);
  process.exit(1);
}
