#!/usr/bin/env node

/**
 * Documentation Credibility Guardrails
 * 
 * Verifies Marketplace-required documentation exists and contains no contradictions.
 * 
 * Checks:
 * 1. Required files exist (privacy.html, terms.html, claims_proof_catalog.md)
 * 2. Required sections present in privacy.html and terms.html
 * 3. No forbidden overclaims (SOC2, ISO, HIPAA, etc.) unless in disclaimer context
 * 4. External egress consistency between manifest.yml and docs
 * 5. Claims proof catalog integrity
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ANSI color codes
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

let exitCode = 0;
const errors = [];
const warnings = [];

function log(message, color = RESET) {
  console.log(`${color}${message}${RESET}`);
}

function error(message) {
  errors.push(message);
  log(`❌ ERROR: ${message}`, RED);
  exitCode = 1;
}

function warn(message) {
  warnings.push(message);
  log(`⚠️  WARNING: ${message}`, YELLOW);
}

function success(message) {
  log(`✅ ${message}`, GREEN);
}

function fileExists(filePath) {
  return fs.existsSync(filePath);
}

function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    error(`Failed to read ${filePath}: ${err.message}`);
    return null;
  }
}

// CHECK 1: Required files exist
function checkRequiredFiles() {
  log('\n=== CHECK 1: Required Files Existence ===');
  
  const requiredFiles = [
    'docs/index.html',
    'docs/privacy.html',
    'docs/terms.html',
    'docs/claims_proof_catalog.md'
  ];
  
  requiredFiles.forEach(file => {
    if (fileExists(file)) {
      success(`${file} exists`);
    } else {
      error(`${file} is missing`);
    }
  });
}

// CHECK 2: Privacy Policy required sections
function checkPrivacySections() {
  log('\n=== CHECK 2: Privacy Policy Required Sections ===');
  
  const privacyFile = 'docs/privacy.html';
  if (!fileExists(privacyFile)) {
    error(`Cannot check sections: ${privacyFile} missing`);
    return;
  }
  
  const content = readFile(privacyFile);
  if (!content) return;
  
  const requiredSections = [
    { pattern: /Who We Are/i, name: 'Who We Are' },
    { pattern: /(What data the app accesses|Data the App Accesses)/i, name: 'What Data the App Accesses' },
    { pattern: /(What data the app does NOT collect|Data the App Does NOT Collect)/i, name: 'What Data the App Does NOT Collect' },
    { pattern: /(Where data is processed and stored|Data Processing and Storage)/i, name: 'Where Data is Processed and Stored' },
    { pattern: /(Third-Party Data Sharing|Third-party sharing)/i, name: 'Third-Party Data Sharing' },
    { pattern: /Data Retention/i, name: 'Data Retention' },
    { pattern: /Security Practices/i, name: 'Security Practices' },
    { pattern: /Contact/i, name: 'Contact' }
  ];
  
  requiredSections.forEach(({ pattern, name }) => {
    if (pattern.test(content)) {
      success(`Privacy Policy contains: ${name}`);
    } else {
      error(`Privacy Policy missing required section: ${name}`);
    }
  });
}

// CHECK 3: Terms of Use required sections
function checkTermsSections() {
  log('\n=== CHECK 3: Terms of Use Required Sections ===');
  
  const termsFile = 'docs/terms.html';
  if (!fileExists(termsFile)) {
    error(`Cannot check sections: ${termsFile} missing`);
    return;
  }
  
  const content = readFile(termsFile);
  if (!content) return;
  
  const requiredSections = [
    { pattern: /Acceptance/i, name: 'Acceptance' },
    { pattern: /License/i, name: 'License' },
    { pattern: /Prohibited/i, name: 'Prohibited' },
    { pattern: /Disclaimer/i, name: 'Disclaimer' },
    { pattern: /Limitation/i, name: 'Limitation' },
    { pattern: /Termination/i, name: 'Termination' },
    { pattern: /Governing Law/i, name: 'Governing Law' },
    { pattern: /Contact/i, name: 'Contact' }
  ];
  
  requiredSections.forEach(({ pattern, name }) => {
    if (pattern.test(content)) {
      success(`Terms of Use contains: ${name}`);
    } else {
      error(`Terms of Use missing required section: ${name}`);
    }
  });
}

// CHECK 4: Forbidden overclaims scan
function checkForbiddenClaims() {
  log('\n=== CHECK 4: Forbidden Overclaims Scan ===');
  
  const forbiddenPatterns = [
    { pattern: /\bSOC\s?2\b/gi, name: 'SOC 2' },
    { pattern: /\bSOC2\b/gi, name: 'SOC2' },
    { pattern: /\bISO\s?27001\b/gi, name: 'ISO 27001' },
    { pattern: /\bCloud Fortified\b/gi, name: 'Cloud Fortified' },
    { pattern: /\bHIPAA\b/gi, name: 'HIPAA' },
    { pattern: /\bGDPR compliant\b/gi, name: 'GDPR compliant' },
    { pattern: /\bcertified\b/gi, name: 'certified' }
  ];
  
  // Scan all .md, .html, .yml files
  const extensions = ['.md', '.html', '.yml', '.yaml'];
  const filesToScan = [];
  
  function scanDirectory(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    entries.forEach(entry => {
      const fullPath = path.join(dir, entry.name);
      
      // Skip node_modules, .git, etc.
      if (entry.name.startsWith('.') || entry.name === 'node_modules') return;
      
      if (entry.isDirectory()) {
        scanDirectory(fullPath);
      } else if (entry.isFile() && extensions.some(ext => entry.name.endsWith(ext))) {
        filesToScan.push(fullPath);
      }
    });
  }
  
  scanDirectory('.');
  
  let foundViolations = false;
  
  filesToScan.forEach(file => {
    const content = readFile(file);
    if (!content) return;
    
    forbiddenPatterns.forEach(({ pattern, name }) => {
      const matches = [...content.matchAll(pattern)];
      
      matches.forEach(match => {
        const matchPos = match.index;
        const contextStart = Math.max(0, matchPos - 80);
        const contextEnd = Math.min(content.length, matchPos + 80);
        const context = content.substring(contextStart, contextEnd);
        
        // Check for disclaimer context (within ±80 chars)
        const disclaimerKeywords = [
          'not', 'no ', 'without', 'disclaim', 'not certified', 
          'do not claim', 'does not', 'not hold', 'not provide',
          'explicitly', 'no independent'
        ];
        
        const hasDisclaimer = disclaimerKeywords.some(keyword => 
          context.toLowerCase().includes(keyword.toLowerCase())
        );
        
        if (!hasDisclaimer) {
          foundViolations = true;
          const snippet = context.replace(/\n/g, ' ').substring(0, 120);
          error(`Forbidden claim "${name}" in ${file} without disclaimer: "${snippet}..."`);
        }
      });
    });
  });
  
  if (!foundViolations) {
    success('No forbidden overclaims found (or all in disclaimer context)');
  }
}

// CHECK 5: External egress consistency
function checkEgressConsistency() {
  log('\n=== CHECK 5: External Egress Consistency ===');
  
  const manifestPath = 'atlassian/forge-app/manifest.yml';
  const privacyPath = 'docs/privacy.html';
  
  if (!fileExists(manifestPath)) {
    warn(`Cannot check egress: ${manifestPath} not found`);
    return;
  }
  
  if (!fileExists(privacyPath)) {
    error(`Cannot check egress: ${privacyPath} not found`);
    return;
  }
  
  const manifestContent = readFile(manifestPath);
  const privacyContent = readFile(privacyPath);
  
  if (!manifestContent || !privacyContent) return;
  
  const hasExternalFetch = /external\.fetch/i.test(manifestContent);
  const claimsNoEgress = /no external egress/i.test(privacyContent);
  
  if (hasExternalFetch && claimsNoEgress) {
    error('Contradiction: manifest.yml has external.fetch permission but privacy.html claims "no external egress"');
  } else if (!hasExternalFetch && !claimsNoEgress) {
    warn('Privacy policy should explicitly state "no external egress" when external.fetch permission is absent');
  } else {
    success('External egress claims consistent between manifest and documentation');
  }
}

// CHECK 6: Claims proof catalog integrity
function checkClaimsCatalog() {
  log('\n=== CHECK 6: Claims Proof Catalog Integrity ===');
  
  const catalogPath = 'docs/claims_proof_catalog.md';
  if (!fileExists(catalogPath)) {
    error(`Cannot validate: ${catalogPath} missing`);
    return;
  }
  
  const content = readFile(catalogPath);
  if (!content) return;
  
  const requiredClaims = [
    'Privacy Policy URL exists (GitHub Pages)',
    'Terms of Use URL exists (GitHub Pages)',
    'No third-party data sharing',
    'No external network egress beyond Atlassian/Forge',
    'Tenant-isolated storage (Forge storage only)',
    'Read-only Jira access (no writes)'
  ];
  
  requiredClaims.forEach(claim => {
    if (content.includes(claim)) {
      success(`Claims catalog includes: "${claim}"`);
      
      // Check that claim has Proof location and Status
      const claimLine = content.split('\n').find(line => line.includes(claim));
      if (claimLine) {
        const cells = claimLine.split('|').map(c => c.trim());
        if (cells.length < 5) {
          error(`Claim "${claim}" has incomplete table row (expected 5 cells)`);
        } else {
          const proofLocation = cells[2];
          const status = cells[4];
          
          if (!proofLocation || proofLocation === '') {
            error(`Claim "${claim}" has empty Proof location`);
          }
          
          if (!status || !['PASS', 'FAIL'].includes(status)) {
            error(`Claim "${claim}" has invalid Status (must be PASS or FAIL, got: "${status}")`);
          }
        }
      }
    } else {
      error(`Claims catalog missing required claim: "${claim}"`);
    }
  });
}

// Main execution
function main() {
  log('╔═══════════════════════════════════════════════════════════╗');
  log('║   Documentation Credibility Guardrails                   ║');
  log('║   Marketplace Legal & Compliance Verification             ║');
  log('╚═══════════════════════════════════════════════════════════╝');
  
  checkRequiredFiles();
  checkPrivacySections();
  checkTermsSections();
  checkForbiddenClaims();
  checkEgressConsistency();
  checkClaimsCatalog();
  
  // Summary
  log('\n' + '='.repeat(60));
  if (errors.length === 0 && warnings.length === 0) {
    log('✅ ALL CHECKS PASSED', GREEN);
    log('Documentation is Marketplace-ready.', GREEN);
  } else {
    if (errors.length > 0) {
      log(`❌ ${errors.length} ERROR(S) FOUND`, RED);
      errors.forEach(err => log(`   • ${err}`, RED));
    }
    if (warnings.length > 0) {
      log(`⚠️  ${warnings.length} WARNING(S) FOUND`, YELLOW);
      warnings.forEach(warn => log(`   • ${warn}`, YELLOW));
    }
  }
  log('='.repeat(60) + '\n');
  
  process.exit(exitCode);
}

main();
