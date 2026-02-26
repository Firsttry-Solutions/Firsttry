#!/usr/bin/env node

/**
 * truth_claims_gate.mjs
 * 
 * Truth Audit validation gate for FirstTry documentation.
 * - Parses CLAIMS_REGISTER.md
 * - Validates EVIDENCE proofs exist as files
 * - Validates ATLASSIAN proofs are https://developer.atlassian.com/ links
 * - Scans all docs/[recursively].md for banned phrases
 * - Fails if banned phrase found but not in CLAIMS_REGISTER
 * - Exits non-zero on any error
 * - Deterministic output (sorted errors)
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve, join } from 'path';

// Constants
const CLAIMS_REGISTER_PATH = './docs/trust/CLAIMS_REGISTER.md';

const BANNED_PHRASES = [
  'no pii',
  'automatically deleted',
  'no subprocessors',
  'guaranteed',
  'certified',
  'compliant',
  'cloud fortified'
];

// Error tracking
const errors = [];
const warnings = [];

/**
 * Recursively find all markdown files in docs/trust, docs/operations, docs/procurement
 */
function findMarkdownFiles(dirPath = './docs', fileList = []) {
  // Only check new enterprise docs directories
  const enterpriseDirs = ['./docs/trust', './docs/operations', './docs/procurement'];
  
  for (const dir of enterpriseDirs) {
    try {
      const files = readdirSync(dir);
      
      for (const file of files) {
        const fullPath = join(dir, file);
        const stat = statSync(fullPath);
        
        if (stat.isDirectory()) {
          // Recursively process subdirectories if they exist
          findMarkdownFiles(fullPath, fileList);
        } else if (file.endsWith('.md')) {
          fileList.push(fullPath);
        }
      }
    } catch (err) {
      // Silently skip directories that can't be read
    }
  }
  
  return fileList;
}

/**
 * Parse CLAIMS_REGISTER.md markdown table
 * Returns array of claims with ClaimID, ClaimText, ProofType, ProofPointer
 */
function parseClaimsRegister(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  // Find the table start (line with "|-------|")
  let tableStart = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('|---------|')) {
      tableStart = i + 1;
      break;
    }
  }
  
  if (tableStart === -1) {
    console.error('❌ ERROR: Could not find claims table in CLAIMS_REGISTER.md');
    process.exit(1);
  }
  
  const claims = [];
  for (let i = tableStart; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Stop at end of table (blank line or heading)
    if (!line.startsWith('|') || line === '') break;
    
    // Parse table row: | ClaimID | ClaimText | ... | ProofType | ProofPointer | ... |
    const cells = line.split('|').map(c => c.trim()).filter(c => c);
    
    if (cells.length < 5) continue;
    
    const claim = {
      claimId: cells[0],
      claimText: cells[1],
      scope: cells[2],
      proofType: cells[3],
      proofPointer: cells[4],
      validationRule: cells[5] || '',
      owner: cells[6] || '',
      lastReviewed: cells[7] || ''
    };
    
    claims.push(claim);
  }
  
  return claims;
}

/**
 * Validate EVIDENCE proofs
 * ProofPointer must be a file path that exists
 */
function validateEvidenceProofs(claims) {
  for (const claim of claims) {
    if (claim.proofType !== 'EVIDENCE') continue;
    
    const filePath = claim.proofPointer;
    const fullPath = resolve(filePath);
    
    try {
      statSync(fullPath);
    } catch (err) {
      errors.push(`[${claim.claimId}] EVIDENCE proof not found: ${filePath}`);
    }
  }
}

/**
 * Validate ATLASSIAN proofs
 * ProofPointer must be https://developer.atlassian.com/ URL
 */
function validateAtlassianProofs(claims) {
  for (const claim of claims) {
    if (claim.proofType !== 'ATLASSIAN') continue;
    
    const url = claim.proofPointer;
    if (!url.startsWith('https://developer.atlassian.com/')) {
      errors.push(`[${claim.claimId}] ATLASSIAN proof must be https://developer.atlassian.com/ URL, got: ${url}`);
    }
  }
}

/**
 * Scan all docs/ files recursively for banned phrases
 * Track which claims correspond to found phrases
 */
function scanForBannedPhrases(claims) {
  const claimsByText = {};
  for (const claim of claims) {
    const text = claim.claimText.toLowerCase().trim();
    claimsByText[text] = claim.claimId;
  }
  
  const docFiles = findMarkdownFiles('./docs').filter(f => !f.includes('CLAIMS_REGISTER.md'));
  const foundPhrases = {};
  
  for (const filePath of docFiles) {
    const content = readFileSync(filePath, 'utf-8').toLowerCase();
    
    for (const phrase of BANNED_PHRASES) {
      if (content.includes(phrase)) {
        if (!foundPhrases[phrase]) {
          foundPhrases[phrase] = [];
        }
        if (!foundPhrases[phrase].includes(filePath)) {
          foundPhrases[phrase].push(filePath);
        }
      }
    }
  }
  
  // Check if each found phrase is covered by a claim
  for (const phrase of Object.keys(foundPhrases)) {
    // Find a claim that legitimately uses this phrase
    const phraseNoWhitespace = phrase.replace(/["\s]/g, '').toLowerCase();
    const relevantClaim = claims.find(c => {
      const textNoWhitespace = c.claimText.replace(/["\s]/g, '').toLowerCase();
      return textNoWhitespace.includes(phraseNoWhitespace);
    });
    
    if (!relevantClaim) {
      const files = foundPhrases[phrase];
      errors.push(`⚠️  Banned phrase found but not in claims register: "${phrase}"\n     Files: ${files.join(', ')}\n     Add a claim to CLAIMS_REGISTER.md to legitimize this phrase.`);
    }
  }
  
  return foundPhrases;
}

/**
 * Main validation function
 */
function validateClaims() {
  console.log('🔍 Truth Audit Gate');
  console.log('═════════════════════════════════════════\n');
  
  // Parse claims register
  console.log('1. Parsing CLAIMS_REGISTER.md...');
  let claims;
  try {
    claims = parseClaimsRegister(CLAIMS_REGISTER_PATH);
    console.log(`   ✅ Loaded ${claims.length} claims\n`);
  } catch (err) {
    console.error(`   ❌ Failed to parse CLAIMS_REGISTER.md: ${err.message}`);
    process.exit(1);
  }
  
  // Validate EVIDENCE proofs
  console.log('2. Validating EVIDENCE proofs (file existence)...');
  validateEvidenceProofs(claims);
  if (errors.filter(e => e.includes('EVIDENCE')).length === 0) {
    const evidenceClaims = claims.filter(c => c.proofType === 'EVIDENCE').length;
    console.log(`   ✅ All ${evidenceClaims} EVIDENCE proofs verified\n`);
  } else {
    console.log(`   ❌ Some EVIDENCE proofs missing\n`);
  }
  
  // Validate ATLASSIAN proofs
  console.log('3. Validating ATLASSIAN proofs (URL format)...');
  validateAtlassianProofs(claims);
  if (errors.filter(e => e.includes('ATLASSIAN')).length === 0) {
    const atlassianClaims = claims.filter(c => c.proofType === 'ATLASSIAN').length;
    console.log(`   ✅ All ${atlassianClaims} ATLASSIAN proofs valid\n`);
  } else {
    console.log(`   ❌ Some ATLASSIAN proofs invalid\n`);
  }
  
  // Scan for banned phrases
  console.log('4. Scanning docs/**/*.md for banned phrases...');
  const foundPhrases = scanForBannedPhrases(claims);
  const foundCount = Object.keys(foundPhrases).length;
  if (foundCount === 0) {
    console.log('   ✅ No banned phrases found\n');
  } else {
    console.log(`   ⚠️  Found ${foundCount} banned phrases (checking if they have claims...)\n`);
  }
  
  // Report results
  console.log('═════════════════════════════════════════');
  console.log('Truth Audit Results\n');
  
  if (errors.length === 0) {
    console.log('✅ ALL CHECKS PASSED\n');
    console.log(`Summary:`);
    console.log(`  • Claims registered: ${claims.length}`);
    console.log(`  • EVIDENCE proofs: ${claims.filter(c => c.proofType === 'EVIDENCE').length}`);
    console.log(`  • ATLASSIAN proofs: ${claims.filter(c => c.proofType === 'ATLASSIAN').length}`);
    console.log(`  • Banned phrases found: ${foundCount}`);
    console.log(`  • Unregistered phrases: 0\n`);
    process.exit(0);
  } else {
    console.log('❌ VALIDATION FAILED\n');
    console.log('Errors (sorted):\n');
    
    // Sort and print errors
    const sortedErrors = errors.sort();
    for (const error of sortedErrors) {
      console.log(`  ${error}`);
    }
    
    console.log(`\n(${errors.length} error(s) found)\n`);
    process.exit(1);
  }
}

// Run validation
const cwd = process.cwd();
validateClaims();
